// services/auth-service/src/controller/user.controller.js
import mongoose from 'mongoose';
import userModel from '../model/user.model.js';
import { uploadToImageKit, deleteOldAvatars } from '../utils/imagekit.js';
import { generateAvatarFileName } from '../middlewares/avatarUpload.middleware.js';

// GET /api/users/:id - Public Profile Info
export const getUserProfile = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ success: false, message: 'Invalid user id' });
    }

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

// PATCH /api/users/profile - Update Bio, Headline, Name, and (optionally) Avatar together
//
// Accepts multipart/form-data so the frontend can send text fields and an
// optional avatar file in one request — see updateAvatar below for the
// avatar-only endpoint, which stays for backwards compatibility.
export const updateProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const { bio, headline, firstName, lastName } = req.body;

    const updateFields = {};
    if (bio !== undefined) updateFields.bio = bio;
    if (headline !== undefined) updateFields.headline = headline;
    if (firstName) updateFields['fullname.firstName'] = firstName;
    if (lastName) updateFields['fullname.lastName'] = lastName;

    // Optional: this route can also carry an avatar file (field name
    // "avatar") when the frontend uses one combined "Save profile" action
    // instead of a separate avatar upload step. Wire avatarUpload
    // middleware onto this route only if you want that combined UX —
    // see routes file comment.
    if (req.file) {
      const fileName = generateAvatarFileName(userId, req.file.originalname);
      const { url, fileId } = await uploadToImageKit(req.file.buffer, fileName, '/avatars');
      updateFields.avatar = url;
      // Fire-and-forget: don't block the response on cleanup.
      deleteOldAvatars(userId, fileId);
    }

    if (Object.keys(updateFields).length === 0) {
      return res.status(400).json({ success: false, message: 'No fields to update' });
    }

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

// PATCH /api/users/avatar - Upload & Update Profile Avatar (avatar-only)
export const updateAvatar = async (req, res) => {
  try {
    const userId = req.user.id;

    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No image file provided' });
    }

    const fileName = generateAvatarFileName(userId, req.file.originalname);

    let uploadResult;
    try {
      uploadResult = await uploadToImageKit(req.file.buffer, fileName, '/avatars');
    } catch (uploadErr) {
      // Distinguish "ImageKit is down / rejected the file" from a generic
      // 500 so the frontend can show "try again" instead of a vague error.
      console.error('Avatar upload to ImageKit failed:', uploadErr);
      return res.status(502).json({
        success: false,
        message: 'Failed to upload avatar image. Please try again.',
      });
    }

    const { url: avatarUrl, fileId } = uploadResult;

    const updatedUser = await userModel
      .findByIdAndUpdate(userId, { $set: { avatar: avatarUrl } }, { new: true })
      .select('-password');

    if (!updatedUser) {
      // Extremely unlikely (authenticateToken already verified the user
      // exists), but if it happens, don't leave an orphaned ImageKit file
      // with nothing pointing to it.
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // New avatar is already saved and will be returned below — cleanup
    // runs after the response-critical work is done and never blocks it.
    deleteOldAvatars(userId, fileId);

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