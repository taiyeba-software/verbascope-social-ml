import { Router } from 'express';
import authenticateToken from '../middlewares/auth.middleware.js';
import { avatarUpload, handleAvatarUploadError } from '../middlewares/avatarUpload.middleware.js';
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

// avatarUpload is attached here too (not just /avatar) so the frontend can
// send bio/headline/name fields AND a new avatar file in a single
// multipart request from one "Save profile" action. If no "avatar" file
// part is present, multer just calls next() with req.file left undefined —
// updateProfile only touches the avatar field when req.file exists, so
// plain text-only profile edits are unaffected.
router.patch(
  '/profile',
  authenticateToken,
  avatarUpload,
  handleAvatarUploadError,
  updateProfile
);

// Dedicated avatar-only endpoint — kept for the existing frontend flow
// (userService.updateAvatar) and any client that wants to swap the
// avatar without touching other profile fields.
router.patch(
  '/avatar',
  authenticateToken,
  avatarUpload,
  handleAvatarUploadError,
  updateAvatar
);

router.post('/follow/:id',    authenticateToken, followUser);
router.post('/unfollow/:id',  authenticateToken, unfollowUser);

// Keep this LAST — it's a catch-all param route. Anything above with a
// fixed path segment (e.g. /profile, /me/following) must be registered
// before this one, or Express will match /:id first and shadow them.
router.get('/:id',            authenticateToken, getUserProfile);

export default router;