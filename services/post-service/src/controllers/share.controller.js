import mongoose from 'mongoose';
import Post from '../models/post.model.js';
import User from '../models/user.model.js';
import { publish } from '../broker/rabbit.js';
import { pulse } from '../pulse/pulse.js';
import { updateUserPulse } from '../pulse/updateUserPulse.js';
import { io } from '../../server.js';
import { VALID_REASONS } from '../constants/shareReasons.js';
import { getVisibleAuthorObjectIds } from '../utils/getVisibleAuthors.js'; // ── UPDATED

const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);

const sharerUserId = (entry) => (entry?.user ?? entry)?.toString();

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

const broadcastCommunityInsightsUpdate = () => {
	io.emit('community-insights:update');
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

		if (reason) {
			broadcastCommunityInsightsUpdate();
		}

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

		const reason = existingEntry.reason ?? null;
		const currentReasonCount = reason ? (post.shareReasons?.[reason] ?? 0) : 0;
		const shouldDecrementReason = Boolean(reason) && currentReasonCount > 0;

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

		if (shouldDecrementReason) {
			broadcastCommunityInsightsUpdate();
		}

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
// ── UPDATED: scoped by SHARER, not author ──
// Counts marks made BY people you follow (or you), on ANY post — not
// marks on posts authored by people you follow. This matches the "From
// people you follow" framing literally: it's about whose endorsement
// you're seeing, not who wrote the original content.
//
// The 7-day window now filters on sharedAt (when the mark was made)
// rather than the post's createdAt — this also fixes a previously
// documented limitation where a fresh share on an older post was never
// counted, since with sharer-scoping the post's own age is no longer
// the relevant signal.
export const getCommunitySignalsSummary = async (req, res) => {
	try {
		const windowStart = getInsightsWindowStart();
		const reasonKeys  = Object.values(SIGNAL_MAP);
		const visibleAuthorIds = await getVisibleAuthorObjectIds(req);

		const summary = await Post.aggregate([
			{ $match: { 'sharedBy.0': { $exists: true } } }, // cheap pre-filter: skip posts with zero shares
			{ $unwind: '$sharedBy' },
			{
				$match: {
					'sharedBy.user': { $in: visibleAuthorIds },
					'sharedBy.reason': { $in: reasonKeys },
					'sharedBy.sharedAt': { $gte: windowStart },
				},
			},
			{ $group: { _id: '$sharedBy.reason', totalMarked: { $sum: 1 } } },
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