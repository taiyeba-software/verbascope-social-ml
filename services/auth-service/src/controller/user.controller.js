// services/auth-service/src/controller/user.controller.js
import userModel from '../model/user.model.js';
import { uploadToImageKit } from '../utils/imagekit.js';
import { generateAvatarFileName } from '../middlewares/avatarUpload.middleware.js';

// GET /api/users/:id - Public Profile Info
export const getUserProfile = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await userModel.findById(id).select('-password');

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const followersCount = user.followers ? user.followers.length : 0;
    const followingCount = user.following ? user.following.length : 0;
    const isFollowing = req.user ? user.followers.includes(req.user.id) : false;

    return res.status(200).json({
      success: true,
      user: {
        ...user.toObject(),
        followersCount,
        followingCount,
        isFollowing,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// PATCH /api/users/profile - Update Bio, Headline, Name, etc.
export const updateProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const { bio, headline, firstName, lastName } = req.body;

    const updateFields = {};
    if (bio !== undefined) updateFields.bio = bio;
    if (headline !== undefined) updateFields.headline = headline;
    if (firstName) updateFields['fullname.firstName'] = firstName;
    if (lastName) updateFields['fullname.lastName'] = lastName;

    const updatedUser = await userModel
      .findByIdAndUpdate(userId, { $set: updateFields }, { new: true })
      .select('-password');

    return res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      user: updatedUser,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// PATCH /api/users/avatar - Upload & Update Profile Avatar
export const updateAvatar = async (req, res) => {
  try {
    const userId = req.user.id;

    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No image file provided' });
    }

    const fileName = generateAvatarFileName(userId, req.file.originalname);
    const avatarUrl = await uploadToImageKit(req.file.buffer, fileName, '/avatars');

    const updatedUser = await userModel
      .findByIdAndUpdate(userId, { $set: { avatar: avatarUrl } }, { new: true })
      .select('-password');

    return res.status(200).json({
      success: true,
      message: 'Avatar updated successfully',
      avatar: avatarUrl,
      user: updatedUser,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// POST /api/users/follow/:id
export const followUser = async (req, res) => {
  try {
    const targetUserId = req.params.id;
    const currentUserId = req.user.id;

    if (targetUserId === currentUserId) {
      return res.status(400).json({ success: false, message: 'You cannot follow yourself' });
    }

    await userModel.findByIdAndUpdate(currentUserId, { $addToSet: { following: targetUserId } });
    await userModel.findByIdAndUpdate(targetUserId, { $addToSet: { followers: currentUserId } });

    return res.status(200).json({ success: true, message: 'User followed successfully' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// POST /api/users/unfollow/:id
export const unfollowUser = async (req, res) => {
  try {
    const targetUserId = req.params.id;
    const currentUserId = req.user.id;

    await userModel.findByIdAndUpdate(currentUserId, { $pull: { following: targetUserId } });
    await userModel.findByIdAndUpdate(targetUserId, { $pull: { followers: currentUserId } });

    return res.status(200).json({ success: true, message: 'User unfollowed successfully' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/users/me/following
export const getMyFollowing = async (req, res) => {
  try {
    const user = await userModel.findById(req.user.id).populate('following', '_id fullname avatar headline');
    return res.status(200).json({ success: true, following: user ? user.following : [] });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// GET / POST /api/users/bulk
export const getUsersBulk = async (req, res) => {
  try {
    let ids = req.body?.ids || req.query?.ids;
    if (typeof ids === 'string') ids = ids.split(',');

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(200).json({ success: true, users: [] });
    }

    const validIds = ids.filter((id) => id && id.length === 24);

    const users = await userModel
      .find({ _id: { $in: validIds } })
      .select('_id fullname avatar headline bio');

    return res.status(200).json({
      success: true,
      users,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
