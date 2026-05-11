import { Router } from 'express';
import protect from '../middlewares/auth.middleware.js';
import { validatePost, validateComment } from '../middlewares/validation.middleware.js';

import { createPost, getFeed, getPost, getPostsByUser, deletePost } from '../controllers/post.controller.js';
import { likePost, unlikePost } from '../controllers/like.controller.js';
import { addComment, getComments, deleteComment } from '../controllers/comment.controller.js';

const router = Router();

// ── Post routes ──────────────────────────────────────────────────────
router.post('/',                              protect, validatePost,    createPost);
router.get('/feed',                           protect,                  getFeed);
router.get('/user/:userId',                   protect,                  getPostsByUser);
router.get('/:id',                            protect,                  getPost);
router.delete('/:id',                         protect,                  deletePost);

// ── Like routes ──────────────────────────────────────────────────────
router.post('/:id/like',                      protect,                  likePost);
router.delete('/:id/unlike',                  protect,                  unlikePost);

// ── Comment routes ───────────────────────────────────────────────────
router.post('/:id/comment',                   protect, validateComment, addComment);
router.get('/:id/comments',                   protect,                  getComments);
router.delete('/:postId/comments/:commentId', protect,                  deleteComment);

export default router;
