import mongoose from 'mongoose';
import Post from '../models/post.model.js';
import User from '../models/user.model.js';
import { publish } from '../broker/rabbit.js';
import { pulse } from '../pulse/pulse.js';
import { updateUserPulse } from '../pulse/updateUserPulse.js';
import { io } from '../../server.js';

const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);
const VALID_REASONS = ['agree', 'funny', 'needs_attention', 'insightful', 'concerning', 'educational'];

// ── NEW: Community Insights shared config ──
// Defined ONCE here and imported by post.controller.js (getFeed), so the
// sidebar summary and the filtered feed can never drift apart.
//
// Maps the URL slug (/feed?signal=needs-attention) to the real key stored
// in Post.shareReasons. These keys MUST match VALID_REASONS above, since
// sharePost() writes `shareReasons.<reason>` using those exact values.
//
// Covers ALL six share reasons offered in the "Why are you passing this
// forward?" sheet. Order matches that sheet.
export const SIGNAL_MAP = {
	'needs-attention': 'needs_attention',
	'agree':           'agree',
	'funny':           'funny',
	'insightful':      'insightful',
	'concerning':      'concerning',
	'educational':     'educational',
};

// Both the sidebar summary and the filtered feed use this window.
export const INSIGHTS_WINDOW_DAYS = 7;

export const getInsightsWindowStart = () =>
	new Date(Date.now() - INSIGHTS_WINDOW_DAYS * 24 * 60 * 60 * 1000);

// ── Weekly Pulse ──
// Fire-and-forget: a share changes sharesCount and shareReasons, both
// inputs to getWeeklyPulse()'s score, so re-broadcast after every share/
// unshare. Never awaited — a slow aggregation must never block the
// share response itself.
const broadcastPulseUpdate = () => {
	pulse.getWeeklyPulse()
		.then((weeklyPulse) => io.emit('pulse:update', weeklyPulse))
		.catch((err) => console.error('broadcastPulseUpdate error:', err.message));
};

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

		const reason = VALID_REASONS.includes(req.body.reason) ? req.body.reason : null;

		const update = {
			$push: { sharedBy: req.user.id },
			$inc: { sharesCount: 1, ...(reason && { [`shareReasons.${reason}`]: 1 }) },
		};

		const updated = await Post.findByIdAndUpdate(
			req.params.id,
			update,
			{ returnDocument: 'after', select: 'sharesCount shareReasons' }
		);

		publish('post.shared', { postId: req.params.id, reason });
		pulse.onPostShared(req.params.id, reason, req.user.id);
		broadcastPulseUpdate(); // ── keep sidebar's weekly pulse live
		updateUserPulse(req.user.id, req.params.id, 'share');

		// ── live sync ──
		io.emit('post:update', {
			postId: req.params.id,
			sharesCount: updated.sharesCount,
		});

		// notify post owner — fire and forget
		User.findById(req.user.id, 'fullname').lean().then((actor) => {
			if (actor) {
				const actorName = `${actor.fullname?.firstName ?? ''} ${actor.fullname?.lastName ?? ''}`.trim();
				publish('notification_created', {
					recipientId: post.author.toString(),
					actorId:     req.user.id,
					actorName,
					type:        'share',
					postId:      req.params.id,
					reason:      reason || null,
				});
			}
		}).catch(() => {});

		return res.status(201).json({
			success: true,
			message: 'Post shared.',
			sharesCount: updated.sharesCount,
			shareReasons: updated.shareReasons,
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

		const updated = await Post.findByIdAndUpdate(
			req.params.id,
			{
				$pull: { sharedBy: new mongoose.Types.ObjectId(req.user.id) },
				$inc: { sharesCount: -1 },
			},
			{ returnDocument: 'after', select: 'sharesCount' }
		);

		broadcastPulseUpdate(); // ── unsharing also changes this week's standings

		// ── live sync ──
		io.emit('post:update', {
			postId: req.params.id,
			sharesCount: updated.sharesCount,
		});

		return res.status(200).json({ success: true, message: 'Post unshared.' });
	} catch (err) {
		console.error('unsharePost error:', err);
		return res.status(500).json({ success: false, message: 'Server error.' });
	}
};

// ── GET /api/posts/community-signals/summary ──────────────────────────
// ── NEW: Community Insights sidebar widget ──
// Lightweight aggregation: total community marks per core category, for
// posts created inside the shared 7-day window. Always returns all four
// keys (defaulting to 0) so the frontend never has to guard for missing ones.
export const getCommunitySignalsSummary = async (req, res) => {
	try {
		const windowStart = getInsightsWindowStart();
		const reasonKeys  = Object.values(SIGNAL_MAP);

		const summary = await Post.aggregate([
			{ $match: { createdAt: { $gte: windowStart } } },
			{ $project: { shareReasons: { $objectToArray: '$shareReasons' } } },
			{ $unwind: '$shareReasons' },
			{ $match: { 'shareReasons.k': { $in: reasonKeys } } },
			{ $group: { _id: '$shareReasons.k', totalMarked: { $sum: '$shareReasons.v' } } },
		]);

		const result = Object.fromEntries(reasonKeys.map((key) => [key, 0]));
		summary.forEach((item) => {
			result[item._id] = item.totalMarked;
		});

		return res.status(200).json({ success: true, summary: result });
	} catch (err) {
		console.error('getCommunitySignalsSummary error:', err);
		return res.status(500).json({ success: false, summary: {} });
	}
};