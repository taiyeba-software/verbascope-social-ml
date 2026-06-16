import mongoose from 'mongoose';
import Post from '../models/post.model.js';
import User from '../models/user.model.js';
import { publish } from '../broker/rabbit.js';
import { pulse } from '../pulse/pulse.js';

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

		publish('post.liked', { postId: req.params.id });

		pulse.onPostLiked(req.params.id, req.user.id);

		// notify post owner — fire and forget, don't await
		User.findById(req.user.id, 'fullname').lean().then((actor) => {
			if (actor) {
				const actorName = `${actor.fullname?.firstName ?? ''} ${actor.fullname?.lastName ?? ''}`.trim();
				publish('notification_created', {
					recipientId: post.author.toString(),
					actorId:     req.user.id,
					actorName,
					type:        'like',
					postId:      req.params.id,
				});
			}
		}).catch(() => {}); // non-critical — never fail the like request

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