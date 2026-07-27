import { Router } from 'express';
import protect from '../middlewares/auth.middleware.js';
import { validatePost, validateComment } from '../middlewares/validation.middleware.js';
import { pulse } from '../pulse/pulse.js';
import upload, { handleMulterError } from '../middlewares/upload.middleware.js';

import { createPost, getFeed, getPost, getPostsByUser, deletePost } from '../controllers/post.controller.js';
import { likePost, unlikePost } from '../controllers/like.controller.js';
import { sharePost, unsharePost } from '../controllers/share.controller.js';
import { addComment, getComments, getReplies, deleteComment, getCommentMood } from '../controllers/comment.controller.js';
import { recordDwell } from '../controllers/dwell.controller.js';
import { getRecommendedUsers } from '../controllers/recommendations.controller.js';
import { savePost, unsavePost, getSavedPosts } from '../controllers/savedPost.controller.js';

const router = Router();

router.get('/pulse/trending', (req, res) => {
	res.json({ trending: pulse.getTrending() });
});

router.get('/pulse/signal', (req, res) => {
	res.json(pulse.getSignal());
});

// ── Milestone 4: per-post comment mood — computed live from the DB, so
// old threads are accurate immediately, not just newly-arriving comments. ──
router.get('/:id/pulse/mood', protect, getCommentMood);

// ── Post routes ──────────────────────────────────────────────────────
router.post('/',                              protect, upload.array('images', 4), validatePost, createPost);
router.get('/feed',                           protect,                  getFeed);
router.get('/user/:userId',                   protect,                  getPostsByUser);

// ── Saved post routes ─────────────────────────────────────────────────
// NOTE: '/saved' MUST be registered before the generic '/:id' route just
// below. Express matches routes top-to-bottom, so if '/:id' came first,
// a request to GET /api/posts/saved would match '/:id' with id="saved"
// and get routed into getPost instead of getSavedPosts.
router.get('/saved',                          protect,                  getSavedPosts);

router.get('/:id',                            protect,                  getPost);
router.delete('/:id',                         protect,                  deletePost);

// ── Like routes ──────────────────────────────────────────────────────
router.post('/:id/like',                      protect,                  likePost);
router.delete('/:id/unlike',                  protect,                  unlikePost);

// ── Share routes ────────────────────────────────────────────────────
router.post('/:id/share',                     protect,                  sharePost);
router.delete('/:id/unshare',                 protect,                  unsharePost);

// ── Save routes ──────────────────────────────────────────────────────
router.post('/:id/save',                      protect,                  savePost);
router.delete('/:id/unsave',                  protect,                  unsavePost);

// ── Comment routes ───────────────────────────────────────────────────
router.post('/:id/comment',                   protect, validateComment, addComment);
router.get('/:id/comments',                   protect,                  getComments);
router.get('/comments/:commentId/replies',    protect,                  getReplies); // ── NEW ──
router.delete('/:postId/comments/:commentId', protect,                  deleteComment); // ── FIXED: removed stray whitespace in path ──

// ── Dwell routes ─────────────────────────────────────────────────────
router.post('/dwell',                         protect,                  recordDwell);

// ── Recommendation routes ─────────────────────────────────────────────
router.get('/recommendations/users',          protect,                  getRecommendedUsers);

// Multer error handler — must be after all routes
router.use(handleMulterError);

export default router;