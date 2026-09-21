import mongoose from 'mongoose';
import Post from '../models/post.model.js';
import User from '../models/user.model.js';
import { publish } from '../broker/rabbit.js';
import { pulse } from '../pulse/pulse.js';
import { updateUserPulse } from '../pulse/updateUserPulse.js';
import { io } from '../../server.js';
import { VALID_REASONS } from '../constants/shareReasons.js';

const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);

// ── Helper: get the user id out of a sharedBy entry regardless of shape.
// Old documents store raw ObjectIds; new ones store { user, reason, sharedAt }.
// See the sharedBy migration note in post.model.js. ──
const sharerUserId = (entry) => (entry?.user ?? entry)?.toString();

// ── Community Insights shared config ──
// Defined ONCE here and imported by post.controller.js (getFeed), so the
// sidebar summary and the filtered feed can never drift apart.
export const SIGNAL_MAP = {
	'needs-attention': 'needs_attention',
	'agree':           'agree',
	'funny':           'funny',
	'insightful':      'insightful',
	'concerning':      'concerning',
	'educational':     'educational',
};

export const INSIGHTS_WINDOW_DAYS = 7;

export const getInsightsWindowStart = () =>
	new Date(Date.now() - INSIGHTS_WINDOW_DAYS * 24 * 60 * 60 * 1000);

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
			(entry) => sharerUserId(entry) === req.user.id
		);
		if (alreadyShared) {
			return res.status(409).json({ success: false, message: 'You already shared this post.' });
		}

		const reason = VALID_REASONS.includes(req.body.reason) ? req.body.reason : null;

		// ── UPDATED: sharedBy now carries who + which reason + when, not
		// just a bare user id, so unsharePost can correctly reverse
		// shareReasons.<reason> and PostCard can show who marked it. ──
		const update = {
			$push: { sharedBy: { user: req.user.id, reason, sharedAt: new Date() } },
			$inc: { sharesCount: 1, ...(reason && { [`shareReasons.${reason}`]: 1 }) },
		};

		const updated = await Post.findByIdAndUpdate(
			req.params.id,
			update,
			{ returnDocument: 'after', select: 'sharesCount shareReasons' }
		);

		publish('post.shared', { postId: req.params.id, reason });
		pulse.onPostShared(req.params.id, reason, req.user.id);
		broadcastPulseUpdate();
		updateUserPulse(req.user.id, req.params.id, 'share');

		io.emit('post:update', {
			postId: req.params.id,
			sharesCount: updated.sharesCount,
		});

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

		const existingEntry = post.sharedBy.find(
			(entry) => sharerUserId(entry) === req.user.id
		);
		if (!existingEntry) {
			return res.status(404).json({ success: false, message: 'You have not shared this post.' });
		}

		// ── UPDATED: we now know WHICH reason this user picked, so we
		// can decrement shareReasons.<reason> instead of leaving it stuck
		// forever. Only decrement if the count is actually above 0, so a
		// double-unshare race or already-migrated-away data can never
		// push it negative. ──
		const reason = existingEntry.reason ?? null;
		const currentReasonCount = reason ? (post.shareReasons?.[reason] ?? 0) : 0;
		const shouldDecrementReason = Boolean(reason) && currentReasonCount > 0;

		// Rebuild sharedBy without this user's entry rather than $pull, since
		// $pull's query shape can't cleanly match both the old (raw ObjectId)
		// and new ({ user, reason, sharedAt }) shapes in one filter.
		const newSharedBy = post.sharedBy.filter(
			(entry) => sharerUserId(entry) !== req.user.id
		);

		const update = {
			$set: { sharedBy: newSharedBy },
			$inc: {
				sharesCount: -1,
				...(shouldDecrementReason && { [`shareReasons.${reason}`]: -1 }),
			},
		};

		const updated = await Post.findByIdAndUpdate(
			req.params.id,
			update,
			{ returnDocument: 'after', select: 'sharesCount' }
		);

		broadcastPulseUpdate();

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