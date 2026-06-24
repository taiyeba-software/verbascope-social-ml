import mongoose from 'mongoose';
import Post from '../models/post.model.js';
import User from '../models/user.model.js';
import { publish } from '../broker/rabbit.js';
import { pulse } from '../pulse/pulse.js';
import { updateUserPulse } from '../pulse/updateUserPulse.js';
import { io } from '../../server.js';

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
		updateUserPulse(req.user.id, req.params.id, 'like'); // fire and forget

		// ── live sync: tell everyone viewing the feed ──
		console.log('📡 [SOCKET] About to emit post:update for', req.params.id);
		io.emit('post:update', {
			postId: req.params.id,
			likesCount: updated.likesCount,
		});
		console.log('📡 [SOCKET] post:update emitted:', req.params.id, '| likesCount:', updated.likesCount, '| connected clients:', io.engine?.clientsCount ?? 'unknown');

		// notify post owner — fire and forget, don't await
		console.log('🔍 [LIKE] req.user.id:', req.user.id);

		User.findById(req.user.id, 'fullname').lean().then((actor) => {
			console.log('🔍 [LIKE] Actor found:', actor);
			if (actor) {
				const actorName = `${actor.fullname?.firstName ?? ''} ${actor.fullname?.lastName ?? ''}`.trim();
				console.log('🔍 [LIKE] actorName:', actorName, '| recipientId:', post.author.toString());
				publish('notification_created', {
					recipientId: post.author.toString(),
					actorId:     req.user.id,
					actorName,
					type:        'like',
					postId:      req.params.id,
				});
				console.log('🔍 [LIKE] notification_created published ✅');
			} else {
				console.log('🔍 [LIKE] No actor found — User.findById returned null');
			}
		}).catch((err) => {
			console.error('🔍 [LIKE] Notification publish failed:', err.message);
		});

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

		const updated = await Post.findByIdAndUpdate(
			req.params.id,
			{
				$pull: { likedBy: new mongoose.Types.ObjectId(req.user.id) },
				$inc: { likesCount: -1 },
			},
			{ returnDocument: 'after', select: 'likesCount' }
		);

		// ── live sync ──
		io.emit('post:update', {
			postId: req.params.id,
			likesCount: updated.likesCount,
		});

		return res.status(200).json({ success: true, message: 'Post unliked.' });
	} catch (err) {
		console.error('unlikePost error:', err);
		return res.status(500).json({ success: false, message: 'Server error.' });
	}
};