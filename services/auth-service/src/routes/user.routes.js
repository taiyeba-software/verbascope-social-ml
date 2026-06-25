import { Router } from 'express';
import authenticateToken from '../middlewares/auth.middleware.js';
import {
  getUsersBulk,
  followUser,
  unfollowUser,
  getMyFollowing,
} from '../controller/user.controller.js';

const router = Router();

router.get('/bulk',           getUsersBulk);                      // public
router.get('/me/following',   authenticateToken, getMyFollowing);
router.post('/follow/:id',    authenticateToken, followUser);
router.post('/unfollow/:id',  authenticateToken, unfollowUser);

export default router;
