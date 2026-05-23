import mongoose from 'mongoose';
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

		const post = await Post.findById(req.params.id);
		const alreadyLiked = post.likedBy.some((userId) => userId.toString() === req.user.id);
		if (alreadyLiked) {
			return res.status(409).json({ success: false, message: 'You already liked this post.' });
		}

		const updated = await Post.findByIdAndUpdate(
			req.params.id,
			{
				$push: { likedBy: req.user.id },
				$inc: { likesCount: 1 },
			},
			{ returnDocument: 'after', select: 'likesCount' }
		);

		return res.status(201).json({ success: true, message: 'Post liked.', likesCount: updated.likesCount });
	} catch (err) {
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

		const post = await Post.findById(req.params.id);
		if (!post) {
			return res.status(404).json({ success: false, message: 'Post not found.' });
		}

		const hasLiked = post.likedBy.some((userId) => userId.toString() === req.user.id);
		if (!hasLiked) {
			return res.status(404).json({ success: false, message: 'You have not liked this post.' });
		}

		await Post.findByIdAndUpdate(req.params.id, {
			$pull: { likedBy: new mongoose.Types.ObjectId(req.user.id) },
			$inc: { likesCount: -1 },
		});

		return res.status(200).json({ success: true, message: 'Post unliked.' });
	} catch (err) {
		console.error('unlikePost error:', err);
		return res.status(500).json({ success: false, message: 'Server error.' });
	}
};