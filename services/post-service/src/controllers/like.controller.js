import mongoose from 'mongoose';
import Like from '../models/like.model.js';
import Post from '../models/post.model.js';

const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);

// ── POST /api/posts/:id/like ─────────────────────────────────────────
export const likePost = async (req, res) => {
	try {
		if (!isValidId(req.params.id)) {
			return res.status(400).json({ success: false, message: 'Invalid post ID.' });
		}

		const postExists = await Post.exists({ _id: req.params.id });
		if (!postExists) {
			return res.status(404).json({ success: false, message: 'Post not found.' });
		}

		// The unique index on Like rejects duplicates — caught below
		await Like.create({ user: req.user.id, post: req.params.id });

		// Atomic increment — race-condition safe
		const updated = await Post.findByIdAndUpdate(
			req.params.id,
			{ $inc: { likesCount: 1 } },
			{ returnDocument: 'after', select: 'likesCount' }
		);

		return res.status(201).json({ success: true, message: 'Post liked.', likesCount: updated.likesCount });
	} catch (err) {
		if (err.code === 11000) {
			return res.status(409).json({ success: false, message: 'You already liked this post.' });
		}
		console.error('likePost error:', err);
		return res.status(500).json({ success: false, message: 'Server error.' });
	}
};

// ── DELETE /api/posts/:id/unlike ─────────────────────────────────────
export const unlikePost = async (req, res) => {
	try {
		if (!isValidId(req.params.id)) {
			return res.status(400).json({ success: false, message: 'Invalid post ID.' });
		}

		const like = await Like.findOneAndDelete({ user: req.user.id, post: req.params.id });

		if (!like) {
			return res.status(404).json({ success: false, message: 'Like not found.' });
		}

		// Atomic decrement — $inc with -1 is safe here because:
		// a like document must exist (checked above) before we decrement,
		// so likesCount will always be >= 1 at this point.
		await Post.findByIdAndUpdate(req.params.id, { $inc: { likesCount: -1 } });

		return res.status(200).json({ success: true, message: 'Post unliked.' });
	} catch (err) {
		console.error('unlikePost error:', err);
		return res.status(500).json({ success: false, message: 'Server error.' });
	}
};