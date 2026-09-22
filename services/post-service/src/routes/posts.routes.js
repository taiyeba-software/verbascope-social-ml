import { Router } from 'express';
import protect from '../middlewares/auth.middleware.js';
import { validatePost, validateComment } from '../middlewares/validation.middleware.js';
import { pulse } from '../pulse/pulse.js';
import upload, { handleMulterError } from '../middlewares/upload.middleware.js';

import { createPost, getFeed, getPost, getPostsByUser, deletePost, getWeeklyPulse, reindexAllPosts, reanalyzeStalePosts, getPostCommunityEndorsements } from '../controllers/post.controller.js'; // ── UPDATED: getPostSharers renamed to getPostCommunityEndorsements
import { likePost, unlikePost } from '../controllers/like.controller.js';
import { sharePost, unsharePost, getCommunitySignalsSummary } from '../controllers/share.controller.js';
import { addComment, getComments, getReplies, deleteComment, getCommentMood } from '../controllers/comment.controller.js';
import { recordDwell } from '../controllers/dwell.controller.js';
import { getRecommendedUsers } from '../controllers/recommendations.controller.js';
import { savePost, unsavePost, getSavedPosts } from '../controllers/savedPost.controller.js';
import { getSearchHealth } from '../search/searchHealth.js';
import { search, searchTags, getPostsByTag } from '../controllers/search.controller.js';


const router = Router();

router.get('/pulse/trending', protect, getWeeklyPulse);

router.get('/pulse/signal', (req, res) => {
	res.json(pulse.getSignal());
});

router.get('/community-signals/summary', protect, getCommunitySignalsSummary);

router.get('/:id/pulse/mood', protect, getCommentMood);

// ── Search routes ────────────────────────────────────────────────────
router.get('/search/health', async (req, res) => {
	const health = await getSearchHealth();
	const statusCode = health.status === 'ok' ? 200 : 503;
	res.status(statusCode).json(health);
});

router.get('/search',                         protect,                  search);
router.get('/search/tags',                    protect,                  searchTags);
router.get('/tag/:tagName',                   protect,                  getPostsByTag);

// ── Admin / one-time backfill routes ───────────────────────────────────
router.post('/admin/reindex-search',          protect,                  reindexAllPosts);
router.post('/admin/reanalyze',               protect,                  reanalyzeStalePosts);

// ── Post routes ──────────────────────────────────────────────────────
router.post('/',                              protect, upload.array('images', 4), validatePost, createPost);
router.get('/feed',                           protect,                  getFeed);
router.get('/user/:userId',                   protect,                  getPostsByUser);

// ── Saved post routes ─────────────────────────────────────────────────
router.get('/saved',                          protect,                  getSavedPosts);

router.get('/:id',                            protect,                  getPost);
router.delete('/:id',                         protect,                  deletePost);

// ── Like routes ──────────────────────────────────────────────────────
router.post('/:id/like',                      protect,                  likePost);
router.delete('/:id/unlike',                  protect,                  unlikePost);

// ── Share routes ────────────────────────────────────────────────────
router.post('/:id/share',                     protect,                  sharePost);
router.delete('/:id/unshare',                 protect,                  unsharePost);

// ── UPDATED: renamed from /:id/sharers — returns who shared, why, and
// when, so "community-endorsements" better describes what's returned
// than just "sharers". ──
router.get('/:id/community-endorsements',     protect,                  getPostCommunityEndorsements);

// ── Save routes ──────────────────────────────────────────────────────
router.post('/:id/save',                      protect,                  savePost);
router.delete('/:id/unsave',                  protect,                  unsavePost);

// ── Comment routes ───────────────────────────────────────────────────
router.post('/:id/comment',                   protect, validateComment, addComment);
router.get('/:id/comments',                   protect,                  getComments);
router.get('/comments/:commentId/replies',    protect,                  getReplies);
router.delete('/:postId/comments/:commentId', protect,                  deleteComment);

// ── Dwell routes ─────────────────────────────────────────────────────
router.post('/dwell',                         protect,                  recordDwell);

// ── Recommendation routes ─────────────────────────────────────────────
router.get('/recommendations/users',          protect,                  getRecommendedUsers);

// Multer error handler — must be after all routes
router.use(handleMulterError);

export default router;