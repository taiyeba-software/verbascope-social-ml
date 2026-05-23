import mongoose from 'mongoose';
import Post from '../models/post.model.js';

const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);

// ── POST /api/posts/:id/share ─────────────────────────────────────────
export const sharePost = async (req, res) => {
	try {
		if (!isValidId(req.params.id)) {
			return res.status(400).json({ success: false, message: 'Invalid post ID.' });
		}

		const post = await Post.findById(req.params.id);
		if (!post) {
			return res.status(404).json({ success: false, message: 'Post not found.' });
		}

		const alreadyShared = post.sharedBy.some(
			(userId) => userId.toString() === req.user.id
		);
		if (alreadyShared) {
			return res.status(409).json({ success: false, message: 'You already shared this post.' });
		}

		const updated = await Post.findByIdAndUpdate(
			req.params.id,
			{
				$push: { sharedBy: req.user.id },
				$inc: { sharesCount: 1 },
			},
			{ returnDocument: 'after', select: 'sharesCount' }
		);

		return res.status(201).json({
			success: true,
			message: 'Post shared.',
			sharesCount: updated.sharesCount,
		});
	} catch (err) {
		console.error('sharePost error:', err);
		return res.status(500).json({ success: false, message: 'Server error.' });
	}
};

// ── DELETE /api/posts/:id/unshare ─────────────────────────────────────
export const unsharePost = async (req, res) => {
	try {
		if (!isValidId(req.params.id)) {
			return res.status(400).json({ success: false, message: 'Invalid post ID.' });
		}

		const post = await Post.findById(req.params.id);
		if (!post) {
			return res.status(404).json({ success: false, message: 'Post not found.' });
		}

		const hasShared = post.sharedBy.some(
			(userId) => userId.toString() === req.user.id
		);
		if (!hasShared) {
			return res.status(404).json({ success: false, message: 'You have not shared this post.' });
		}

		await Post.findByIdAndUpdate(req.params.id, {
			$pull: { sharedBy: new mongoose.Types.ObjectId(req.user.id) },
			$inc: { sharesCount: -1 },
		});

		return res.status(200).json({ success: true, message: 'Post unshared.' });
	} catch (err) {
		console.error('unsharePost error:', err);
		return res.status(500).json({ success: false, message: 'Server error.' });
	}
};