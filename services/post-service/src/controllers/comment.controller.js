import mongoose from 'mongoose';
import Comment from '../models/comment.model.js';
import Post from '../models/post.model.js';
import { publish } from '../broker/rabbit.js';
import { pulse } from '../pulse/pulse.js';
import { updateUserPulse } from '../pulse/updateUserPulse.js';
import { io } from '../../server.js';
import { classifyComment } from '../services/commentSentiment.js';
import { resolveUser } from '../utils/resolveUser.js';
import { attachAuthors } from '../utils/attachAuthors.js';

const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);

// ── Milestone 4 (v2): compute mood straight from the Comment collection,
// so it's accurate for old threads too, not just live incoming comments.
async function computeMoodForPost(postId) {
	const counts = await Comment.aggregate([
		{ $match: { post: new mongoose.Types.ObjectId(postId) } },
		{ $group: { _id: '$sentiment.label', count: { $sum: 1 } } },
	]);

	const tally = { positive: 0, negative: 0, neutral: 0 };
	counts.forEach((c) => {
		if (c._id && Object.prototype.hasOwnProperty.call(tally, c._id)) {
			tally[c._id] = c.count;
		}
	});

	return pulse.classifyMood(postId, tally);
}

// ── GET /api/posts/:id/pulse/mood ─────────────────────────────────────
export const getCommentMood = async (req, res) => {
	try {
		if (!isValidId(req.params.id)) {
			return res.status(400).json({ success: false, message: 'Invalid post ID.' });
		}
		const mood = await computeMoodForPost(req.params.id);
		return res.status(200).json(mood);
	} catch (err) {
		console.error('getCommentMood error:', err);
		return res.status(500).json({ success: false, message: 'Server error.' });
	}
};

// ── POST /api/posts/:id/comment ──────────────────────────────────────
export const addComment = async (req, res) => {
	try {
		if (!isValidId(req.params.id)) {
			return res.status(400).json({ success: false, message: 'Invalid post ID.' });
		}

		const postExists = await Post.exists({ _id: req.params.id });
		if (!postExists) {
			return res.status(404).json({ success: false, message: 'Post not found.' });
		}

		// ── validate parentComment if this is a reply ──
		// CHANGED: fetch the parent comment's author (not just .exists) so we
		// know who to notify when someone replies.
		const { parentComment } = req.body;
		let parentAuthorId = null;
		if (parentComment) {
			if (!isValidId(parentComment)) {
				return res.status(400).json({ success: false, message: 'Invalid parent comment ID.' });
			}
			const parent = await Comment.findOne({ _id: parentComment, post: req.params.id })
				.select('user')
				.lean();
			if (!parent) {
				return res.status(404).json({ success: false, message: 'Parent comment not found.' });
			}
			parentAuthorId = parent.user.toString();
		}

		// ── Milestone 3: classify sentiment once, at write time ──
		const sentiment = await classifyComment(req.body.content);

		const comment = await Comment.create({
			user: req.user.id,
			post: req.params.id,
			content: req.body.content,
			parentComment: parentComment || null,
			sentiment,
		});

		// ── bump the parent's repliesCount, if this is a reply ──
		if (parentComment) {
			await Comment.findByIdAndUpdate(parentComment, { $inc: { repliesCount: 1 } });
		}

		// Atomic increment — race-condition safe
		const updatedPost = await Post.findByIdAndUpdate(
			req.params.id,
			{ $inc: { commentsCount: 1 } },
			{ returnDocument: 'after', select: 'commentsCount author' }
		);

		publish('comment.added', { postId: req.params.id });
		pulse.onCommentAdded(req.params.id, req.user.id);
		updateUserPulse(req.user.id, req.params.id, 'comment'); // fire and forget

		// ── Milestone 4 (v2): recompute mood from the DB (includes the
		// comment we just created) and broadcast, scoped to this post. ──
		const mood = await computeMoodForPost(req.params.id);
		io.emit('pulse:mood', mood);

		// ── live sync ──
		io.emit('post:update', {
			postId: req.params.id,
			commentsCount: updatedPost.commentsCount,
		});

		// ── tell listeners specifically about the parent thread ──
		if (parentComment) {
			io.emit('comment:reply', {
				parentCommentId: parentComment,
				postId: req.params.id,
			});
		}

		// CHANGED: replies notify the PARENT COMMENT's author;
		// top-level comments notify the post owner.
		// (The notification-service already skips recipient === actor.)
		const recipientId = parentComment
			? parentAuthorId
			: updatedPost?.author?.toString();

		resolveUser(req.user.id).then((actor) => {
			if (actor && recipientId) {
				const actorName = `${actor.fullname?.firstName ?? ''} ${actor.fullname?.lastName ?? ''}`.trim();
				const published = publish('notification_created', {
					recipientId,
					actorId:     req.user.id,
					actorName,
					type:        parentComment ? 'reply' : 'comment',
					postId:      req.params.id,
				});
				if (!published) {
					console.error('🔍 [COMMENT] notification_created publish FAILED — RabbitMQ channel unavailable');
				}
			} else {
				console.log('🔍 [COMMENT] No actor/recipient found — skipping notification');
			}
		}).catch((err) => {
			console.error('🔍 [COMMENT] Notification publish failed:', err.message);
		});

		// ── FIX: was comment.populate('user', ...) which only checks the
		// local mirror and returns null when the user is missing.
		// attachAuthors() uses resolveUser() → falls back to auth-service. ──
		const [withAuthor] = await attachAuthors([comment.toObject()]);
		return res.status(201).json({
			success: true,
			comment: withAuthor,
		});
	} catch (err) {
		console.error('addComment error:', err);
		return res.status(500).json({ success: false, message: 'Server error.' });
	}
};

// ── GET /api/posts/:id/comments ──────────────────────────────────────
export const getComments = async (req, res) => {
	try {
		if (!isValidId(req.params.id)) {
			return res.status(400).json({ success: false, message: 'Invalid post ID.' });
		}

		// FIX: no .populate() — authors are resolved with the
		// self-healing resolveUser() instead, so no more "Anonymous".
		const comments = await Comment.find({
			post: req.params.id,
			parentComment: null,
		})
			.sort({ createdAt: -1 })
			.lean();

		const mapped = await attachAuthors(comments);
		return res.status(200).json({ success: true, comments: mapped });
	} catch (err) {
		console.error('getComments error:', err);
		return res.status(500).json({ success: false, message: 'Server error.' });
	}
};

// ── GET /api/posts/comments/:commentId/replies ────────────────────────
export const getReplies = async (req, res) => {
	try {
		if (!isValidId(req.params.commentId)) {
			return res.status(400).json({ success: false, message: 'Invalid comment ID.' });
		}

		const parentExists = await Comment.exists({ _id: req.params.commentId });
		if (!parentExists) {
			return res.status(404).json({ success: false, message: 'Comment not found.' });
		}

		// FIX: same as getComments — resolve authors via resolveUser().
		const replies = await Comment.find({ parentComment: req.params.commentId })
			.sort({ createdAt: 1 })
			.lean();

		const mapped = await attachAuthors(replies);
		return res.status(200).json({ success: true, replies: mapped });
	} catch (err) {
		console.error('getReplies error:', err);
		return res.status(500).json({ success: false, message: 'Server error.' });
	}
};

// ── DELETE /api/posts/:postId/comments/:commentId ────────────────────
export const deleteComment = async (req, res) => {
	try {
		const { postId, commentId } = req.params;

		if (!isValidId(postId) || !isValidId(commentId)) {
			return res.status(400).json({ success: false, message: 'Invalid ID.' });
		}

		const comment = await Comment.findById(commentId);

		if (!comment) {
			return res.status(404).json({ success: false, message: 'Comment not found.' });
		}

		if (comment.user.toString() !== req.user.id) {
			return res.status(403).json({ success: false, message: 'Not authorized to delete this comment.' });
		}

		// If this comment is itself a reply, its parent loses one reply.
		if (comment.parentComment) {
			await Comment.findByIdAndUpdate(comment.parentComment, { $inc: { repliesCount: -1 } });
		}

		// CHANGED: collect this comment AND all of its descendants (replies,
		// replies-to-replies, ...) so no orphaned replies keep feeding the
		// Discussion Pulse or the comment count.
		const idsToDelete = [comment._id];
		let frontier = [comment._id];
		while (frontier.length > 0) {
			const children = await Comment.find({ parentComment: { $in: frontier } })
				.select('_id')
				.lean();
			frontier = children.map((c) => c._id);
			idsToDelete.push(...frontier);
		}

		const { deletedCount } = await Comment.deleteMany({ _id: { $in: idsToDelete } });

		// CHANGED: decrement by the real number of deleted comments, not just 1.
		const updatedPost = await Post.findByIdAndUpdate(
			postId,
			{ $inc: { commentsCount: -deletedCount } },
			{ returnDocument: 'after', select: 'commentsCount' }
		);

		// CHANGED: never let the count go negative.
		if (updatedPost && updatedPost.commentsCount < 0) {
			updatedPost.commentsCount = 0;
			await Post.updateOne({ _id: postId }, { $set: { commentsCount: 0 } });
		}

		io.emit('post:update', {
			postId,
			commentsCount: updatedPost?.commentsCount ?? 0,
		});

		// CHANGED: recompute the Discussion Pulse after a delete, exactly like
		// addComment does, so the card updates live. Wrapped in try/catch so a
		// pulse failure can't make a successful delete look like an error.
		try {
			const mood = await computeMoodForPost(postId);
			io.emit('pulse:mood', mood);
		} catch (moodErr) {
			console.error('deleteComment: pulse recompute failed:', moodErr);
		}

		return res.status(200).json({ success: true, message: 'Comment deleted.' });
	} catch (err) {
		console.error('deleteComment error:', err);
		return res.status(500).json({ success: false, message: 'Server error.' });
	}
};