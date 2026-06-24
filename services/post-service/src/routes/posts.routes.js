import { Router } from 'express';
import protect from '../middlewares/auth.middleware.js';
import { validatePost, validateComment } from '../middlewares/validation.middleware.js';
import { pulse } from '../pulse/pulse.js';
import upload, { handleMulterError } from '../middlewares/upload.middleware.js';

import { createPost, getFeed, getPost, getPostsByUser, deletePost } from '../controllers/post.controller.js';
import { likePost, unlikePost } from '../controllers/like.controller.js';
import { sharePost, unsharePost } from '../controllers/share.controller.js';
import { addComment, getComments, deleteComment } from '../controllers/comment.controller.js';
import { recordDwell } from '../controllers/dwell.controller.js';
import { getRecommendedUsers } from '../controllers/recommendations.controller.js';

const router = Router();

router.get('/pulse/trending', (req, res) => {
	res.json({ trending: pulse.getTrending() });
});

router.get('/pulse/signal', (req, res) => {
	res.json(pulse.getSignal());
});

// ── Post routes ──────────────────────────────────────────────────────
router.post('/',                              protect, upload.array('images', 4), validatePost, createPost);
router.get('/feed',                           protect,                  getFeed);
router.get('/user/:userId',                   protect,                  getPostsByUser);
router.get('/:id',                            protect,                  getPost);
router.delete('/:id',                         protect,                  deletePost);

// ── Like routes ──────────────────────────────────────────────────────
router.post('/:id/like',                      protect,                  likePost);
router.delete('/:id/unlike',                  protect,                  unlikePost);

// ── Share routes ────────────────────────────────────────────────────
router.post('/:id/share',                     protect,                  sharePost);
router.delete('/:id/unshare',                 protect,                  unsharePost);

// ── Comment routes ───────────────────────────────────────────────────
router.post('/:id/comment',                   protect, validateComment, addComment);
router.get('/:id/comments',                   protect,                  getComments);
router.delete('/:postId/comments/:commentId', protect,                  deleteComment);

// ── Dwell routes ─────────────────────────────────────────────────────
router.post('/dwell',                         protect,                  recordDwell);

// ── Recommendation routes ─────────────────────────────────────────────
router.get('/recommendations/users',          protect,                  getRecommendedUsers);

// Multer error handler — must be after all routes
router.use(handleMulterError);

export default router;
