import mongoose from 'mongoose';
import Comment from '../models/comment.model.js';
import Post from '../models/post.model.js';

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
		await Post.findByIdAndUpdate(req.params.id, { $inc: { commentsCount: 1 } });

		return res.status(201).json({ success: true, comment });
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
			.populate('user', 'fullname')   // pulls firstName/lastName for comment author
			.lean();

		return res.status(200).json({ success: true, comments });
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

		// Atomic decrement — $inc with -1 is safe here because:
		// a comment document must exist (checked above) before we decrement,
		// so commentsCount will always be >= 1 at this point.
		await Post.findByIdAndUpdate(postId, { $inc: { commentsCount: -1 } });

		return res.status(200).json({ success: true, message: 'Comment deleted.' });
	} catch (err) {
		console.error('deleteComment error:', err);
		return res.status(500).json({ success: false, message: 'Server error.' });
	}
};