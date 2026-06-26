import User from '../model/user.model.js';
import { uploadToImageKit } from '../utils/imagekit.js';
import { generateAvatarFileName } from '../middlewares/avatarUpload.middleware.js';

// POST /api/users/bulk
// Accepts { ids: [id1, id2, ...] } in body. Also supports GET /bulk?ids=a,b as fallback.
export const getUsersBulk = async (req, res) => {
  try {
    const bodyIds = Array.isArray(req.body?.ids) ? req.body.ids : [];
    const queryIds = (req.query.ids || '').split(',').filter(Boolean);
    const ids = bodyIds.length > 0 ? bodyIds : queryIds;

    if (ids.length === 0) {
      return res.status(400).json({ success: false, message: 'No IDs provided.' });
    }

    const users = await User.find({ _id: { $in: ids } }).select(
      '_id fullname avatar bio headline'
    ).lean();

    return res.json({ success: true, users });
  } catch (err) {
    console.error('getUsersBulk error:', err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// POST /api/users/follow/:id
export const followUser = async (req, res) => {
  try {
    const targetId = req.params.id;
    const myId = req.user.id;

    if (targetId === myId) {
      return res.status(400).json({ success: false, message: "You can't follow yourself." });
    }

    await User.findByIdAndUpdate(targetId, { $addToSet: { followers: myId } });
    await User.findByIdAndUpdate(myId,     { $addToSet: { following: targetId } });

    return res.status(200).json({ success: true, message: 'Followed.' });
  } catch (err) {
    console.error('followUser error:', err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// POST /api/users/unfollow/:id
export const unfollowUser = async (req, res) => {
  try {
    const targetId = req.params.id;
    const myId = req.user.id;

    await User.findByIdAndUpdate(targetId, { $pull: { followers: myId } });
    await User.findByIdAndUpdate(myId,     { $pull: { following: targetId } });

    return res.status(200).json({ success: true, message: 'Unfollowed.' });
  } catch (err) {
    console.error('unfollowUser error:', err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// GET /api/users/me/following
export const getMyFollowing = async (req, res) => {
  try {
    const user = await User.findById(req.user.id, 'following').lean();
    return res.status(200).json({ success: true, following: user?.following ?? [] });
  } catch (err) {
    console.error('getMyFollowing error:', err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// GET /api/users/:id
// Supports /api/users/me as a shortcut for the logged-in user's own profile.
// Protected by authenticateToken — req.user is always present here.
export const getUserProfile = async (req, res) => {
  try {
    const targetId = req.params.id === 'me' ? req.user.id : req.params.id;

    const user = await User.findById(targetId)
      .select('-password -googleID')
      .populate('followers following', 'fullname')
      .lean();

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    return res.status(200).json({ success: true, user });
  } catch (err) {
    console.error('getUserProfile error:', err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// PATCH /api/users/profile
// Only bio/headline are editable here. Avatar has its own endpoint (Phase 4).
// Deliberately whitelisted — do not destructure additional fields like
// role/email/password into this updater.
export const updateProfile = async (req, res) => {
  try {
    const { bio, headline } = req.body;

    const updated = await User.findByIdAndUpdate(
      req.user.id,
      { bio, headline },
      { new: true }
    ).select('-password -googleID');

    if (!updated) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    return res.status(200).json({ success: true, user: updated });
  } catch (err) {
    console.error('updateProfile error:', err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// PATCH /api/users/avatar
// multipart/form-data, field name "avatar" (see avatarUpload.middleware.js).
// Flow: multer buffers the file in memory -> ImageKit upload -> save URL.
export const updateAvatar = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded.' });
    }

    const fileName = generateAvatarFileName(req.user.id, req.file.originalname);
    const avatarUrl = await uploadToImageKit(req.file.buffer, fileName, '/avatars');

    const updated = await User.findByIdAndUpdate(
      req.user.id,
      { avatar: avatarUrl },
      { new: true }
    ).select('-password -googleID');

    if (!updated) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    return res.status(200).json({ success: true, user: updated });
  } catch (err) {
    console.error('updateAvatar error:', err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};
