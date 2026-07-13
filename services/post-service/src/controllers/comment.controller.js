import mongoose from 'mongoose';
import Comment from '../models/comment.model.js';
import Post from '../models/post.model.js';
import User from '../models/user.model.js';
import { publish } from '../broker/rabbit.js';
import { pulse } from '../pulse/pulse.js';
import { updateUserPulse } from '../pulse/updateUserPulse.js';
import { io } from '../../server.js';

const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);

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

		// ── NEW: validate parentComment if this is a reply ──
		const { parentComment } = req.body;
		if (parentComment) {
			if (!isValidId(parentComment)) {
				return res.status(400).json({ success: false, message: 'Invalid parent comment ID.' });
			}
			const parentExists = await Comment.exists({ _id: parentComment, post: req.params.id });
			if (!parentExists) {
				return res.status(404).json({ success: false, message: 'Parent comment not found.' });
			}
		}

		const comment = await Comment.create({
			user: req.user.id,
			post: req.params.id,
			content: req.body.content,
			parentComment: parentComment || null, // ── NEW ──
		});

		// ── NEW: bump the parent's repliesCount, if this is a reply ──
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

		// ── live sync ──
		io.emit('post:update', {
			postId: req.params.id,
			commentsCount: updatedPost.commentsCount,
		});

		// ── NEW: tell listeners specifically about the parent thread ──
		if (parentComment) {
			io.emit('comment:reply', {
				parentCommentId: parentComment,
				postId: req.params.id,
			});
		}

		// notify post owner — fire and forget
		User.findById(req.user.id, 'fullname').lean().then((actor) => {
			if (actor && updatedPost) {
				const actorName = `${actor.fullname?.firstName ?? ''} ${actor.fullname?.lastName ?? ''}`.trim();
				publish('notification_created', {
					recipientId: updatedPost.author.toString(),
					actorId:     req.user.id,
					actorName,
					type:        parentComment ? 'reply' : 'comment', // ── NEW: distinguish reply notifications ──
					postId:      req.params.id,
				});
			}
		}).catch(() => {});

		const populated = await comment.populate('user', 'fullname');
		return res.status(201).json({
			success: true,
			comment: { ...populated.toObject(), author: populated.user },
		});
	} catch (err) {
		console.error('addComment error:', err);
		return res.status(500).json({ success: false, message: 'Server error.' });
	}
};

// ── GET /api/posts/:id/comments ──────────────────────────────────────
// Returns TOP-LEVEL comments only (parentComment: null). Replies are
// fetched on demand via getReplies below — same lazy-load philosophy
// as the rest of the feed.
export const getComments = async (req, res) => {
	try {
		if (!isValidId(req.params.id)) {
			return res.status(400).json({ success: false, message: 'Invalid post ID.' });
		}

		const comments = await Comment.find({
			post: req.params.id,
			parentComment: null, // ── NEW: only top-level ──
		})
			.sort({ createdAt: -1 })
			.populate('user', 'fullname')
			.lean();

		const mapped = comments.map((c) => ({
			...c,
			author: c.user,
		}));
		return res.status(200).json({ success: true, comments: mapped });
	} catch (err) {
		console.error('getComments error:', err);
		return res.status(500).json({ success: false, message: 'Server error.' });
	}
};

// ── NEW: GET /api/posts/comments/:commentId/replies ──────────────────
// Returns the direct replies to a single comment (one level, not the
// whole subtree). The frontend calls this again per-reply if it opens
// a nested thread further down — that's what makes it "lazy".
export const getReplies = async (req, res) => {
	try {
		if (!isValidId(req.params.commentId)) {
			return res.status(400).json({ success: false, message: 'Invalid comment ID.' });
		}

		const parentExists = await Comment.exists({ _id: req.params.commentId });
		if (!parentExists) {
			return res.status(404).json({ success: false, message: 'Comment not found.' });
		}

		const replies = await Comment.find({ parentComment: req.params.commentId })
			.sort({ createdAt: 1 }) // oldest first reads more naturally for replies
			.populate('user', 'fullname')
			.lean();

		const mapped = replies.map((c) => ({
			...c,
			author: c.user,
		}));
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

		// ── NEW: keep the parent's repliesCount accurate if this was a reply ──
		if (comment.parentComment) {
			await Comment.findByIdAndUpdate(comment.parentComment, { $inc: { repliesCount: -1 } });
		}

		await comment.deleteOne();

		const updatedPost = await Post.findByIdAndUpdate(
			postId,
			{ $inc: { commentsCount: -1 } },
			{ returnDocument: 'after', select: 'commentsCount' }
		);

		// ── live sync ──
		io.emit('post:update', {
			postId,
			commentsCount: updatedPost.commentsCount,
		});

		return res.status(200).json({ success: true, message: 'Comment deleted.' });
	} catch (err) {
		console.error('deleteComment error:', err);
		return res.status(500).json({ success: false, message: 'Server error.' });
	}
};