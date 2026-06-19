import mongoose from 'mongoose';
import Comment from '../models/comment.model.js';
import Post from '../models/post.model.js';
import User from '../models/user.model.js';
import { publish } from '../broker/rabbit.js';
import { pulse } from '../pulse/pulse.js';
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

		const comment = await Comment.create({
			user: req.user.id,
			post: req.params.id,
			content: req.body.content,
		});

		// Atomic increment — race-condition safe
		const updatedPost = await Post.findByIdAndUpdate(
			req.params.id,
			{ $inc: { commentsCount: 1 } },
			{ returnDocument: 'after', select: 'commentsCount author' }
		);

		publish('comment.added', { postId: req.params.id });
		pulse.onCommentAdded(req.params.id, req.user.id);

		// ── live sync ──
		io.emit('post:update', {
			postId: req.params.id,
			commentsCount: updatedPost.commentsCount,
		});

		// notify post owner — fire and forget
		User.findById(req.user.id, 'fullname').lean().then((actor) => {
			if (actor && updatedPost) {
				const actorName = `${actor.fullname?.firstName ?? ''} ${actor.fullname?.lastName ?? ''}`.trim();
				publish('notification_created', {
					recipientId: updatedPost.author.toString(),
					actorId:     req.user.id,
					actorName,
					type:        'comment',
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
export const getComments = async (req, res) => {
	try {
		if (!isValidId(req.params.id)) {
			return res.status(400).json({ success: false, message: 'Invalid post ID.' });
		}

		const comments = await Comment.find({ post: req.params.id })
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