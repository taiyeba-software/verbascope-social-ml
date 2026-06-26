import { Router } from 'express';
import authenticateToken from '../middlewares/auth.middleware.js';
import { avatarUpload } from '../middlewares/avatarUpload.middleware.js';
import {
  getUsersBulk,
  followUser,
  unfollowUser,
  getMyFollowing,
  getUserProfile,
  updateProfile,
  updateAvatar,
} from '../controller/user.controller.js';

const router = Router();

router.post('/bulk',          getUsersBulk);                      // public - accept ids in POST body
router.get('/bulk',           getUsersBulk);                      // fallback: GET /bulk?ids=id1,id2
router.get('/me/following',   authenticateToken, getMyFollowing);
router.patch('/profile',      authenticateToken, updateProfile);
router.patch('/avatar',       authenticateToken, avatarUpload, updateAvatar);
router.post('/follow/:id',    authenticateToken, followUser);
router.post('/unfollow/:id',  authenticateToken, unfollowUser);

// Keep this LAST — it's a catch-all param route. Anything above with a
// fixed path segment (e.g. /profile, /me/following) must be registered
// before this one, or Express will match /:id first and shadow them.
router.get('/:id',            authenticateToken, getUserProfile);

export default router;