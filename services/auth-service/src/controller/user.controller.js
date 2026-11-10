// services/auth-service/src/controller/user.controller.js
import mongoose from 'mongoose';
import userModel from '../model/user.model.js';
import { uploadToImageKit, deleteOldAvatars } from '../utils/imagekit.js';
import { generateAvatarFileName } from '../middlewares/avatarUpload.middleware.js';
import { publishToQueue } from '../broker/rabbit.js';

// Fire-and-forget helpers that can never throw or reject into the request.
function safeDeleteOldAvatars(userId, keepFileId) {
  try {
    Promise.resolve(deleteOldAvatars(userId, keepFileId)).catch((err) => {
      console.error('[user.controller] avatar cleanup failed:', err?.message || err);
    });
  } catch (err) {
    console.error('[user.controller] avatar cleanup failed:', err?.message || err);
  }
}

function safePublishUserUpdated(user) {
  try {
    const raw = user?.toObject ? user.toObject() : user;
    Promise.resolve(
      publishToQueue('user_updated', {
        id: raw?._id,
        fullname: raw?.fullname,
        avatar: raw?.avatar || '',
      })
    ).catch(() => {});
  } catch {
    // broker not ready - never break the request
  }
}

// GET /api/users/:id - Public Profile Info
export const getUserProfile = async (req, res) => {
  try {
    const { id } = req.params;

    // `id` can be a real ObjectId or the literal "me".
    // req.user is the decoded JWT payload ({ id, iat, exp }) - it does NOT
    // contain followers/following, so never read those from it.
    const viewerId = String(req.user?.id || '');
    const targetId = id === 'me' ? viewerId : id;

    if (!mongoose.isValidObjectId(targetId)) {
      return res.status(400).json({ success: false, message: 'Invalid user id' });
    }

    const user = await userModel
      .findById(targetId)
      .select('fullname avatar headline bio followers following createdAt')
      .lean();

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // FIX: older documents (or ones created by Google sign-in) may not have
    // these arrays at all. Treat missing as empty instead of crashing with
    // "Cannot read properties of undefined (reading 'some')".
    const followers = Array.isArray(user.followers) ? user.followers : [];
    const following = Array.isArray(user.following) ? user.following : [];

    const isFollowing = viewerId
      ? followers.some((followerId) => String(followerId) === viewerId)
      : false;

    return res.status(200).json({
      success: true,
      user: {
        _id: user._id,
        fullname: user.fullname,
        avatar: user.avatar || '',
        headline: user.headline || '',
        bio: user.bio || '',
        followersCount: followers.length,
        followingCount: following.length,
        joinedAt: user.createdAt,
        isFollowing,
      },
    });
  } catch (error) {
    console.error('[user.controller] getUserProfile error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// PATCH /api/users/profile - Update Bio, Headline, Name, and (optionally) Avatar together
export const updateProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const { bio, headline, firstName, lastName } = req.body;

    const updateFields = {};
    if (bio !== undefined) updateFields.bio = bio;
    if (headline !== undefined) updateFields.headline = headline;
    if (firstName) updateFields['fullname.firstName'] = firstName;
    if (lastName) updateFields['fullname.lastName'] = lastName;

    if (req.file) {
      const fileName = generateAvatarFileName(userId, req.file.originalname);
      const { url, fileId } = await uploadToImageKit(req.file.buffer, fileName, '/avatars');
      updateFields.avatar = url;
      safeDeleteOldAvatars(userId, fileId);
    }

    if (Object.keys(updateFields).length === 0) {
      return res.status(400).json({ success: false, message: 'No fields to update' });
    }

    const updatedUser = await userModel
      .findByIdAndUpdate(userId, { $set: updateFields }, { new: true })
      .select('-password');

    if (!updatedUser) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    safePublishUserUpdated(updatedUser);

    return res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      user: updatedUser,
    });
  } catch (error) {
    console.error('[user.controller] updateProfile error:', error);
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
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    safeDeleteOldAvatars(userId, fileId);
    safePublishUserUpdated(updatedUser);

    return res.status(200).json({
      success: true,
      message: 'Avatar updated successfully',
      avatar: avatarUrl,
      user: updatedUser,
    });
  } catch (error) {
    console.error('[user.controller] updateAvatar error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// POST /api/users/follow/:id
export const followUser = async (req, res) => {
  try {
    const targetUserId = req.params.id;
    const currentUserId = String(req.user.id);

    if (!mongoose.isValidObjectId(targetUserId)) {
      return res.status(400).json({ success: false, message: 'Invalid user id' });
    }

    if (targetUserId === currentUserId) {
      return res.status(400).json({ success: false, message: 'You cannot follow yourself' });
    }

    const target = await userModel.exists({ _id: targetUserId });
    if (!target) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    await userModel.findByIdAndUpdate(currentUserId, { $addToSet: { following: targetUserId } });
    await userModel.findByIdAndUpdate(targetUserId, { $addToSet: { followers: currentUserId } });

    return res.status(200).json({ success: true, message: 'User followed successfully' });
  } catch (error) {
    console.error('[user.controller] followUser error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// POST /api/users/unfollow/:id
export const unfollowUser = async (req, res) => {
  try {
    const targetUserId = req.params.id;
    const currentUserId = String(req.user.id);

    if (!mongoose.isValidObjectId(targetUserId)) {
      return res.status(400).json({ success: false, message: 'Invalid user id' });
    }

    await userModel.findByIdAndUpdate(currentUserId, { $pull: { following: targetUserId } });
    await userModel.findByIdAndUpdate(targetUserId, { $pull: { followers: currentUserId } });

    return res.status(200).json({ success: true, message: 'User unfollowed successfully' });
  } catch (error) {
    console.error('[user.controller] unfollowUser error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/users/me/following
export const getMyFollowing = async (req, res) => {
  try {
    const user = await userModel
      .findById(req.user.id)
      .populate('following', '_id fullname avatar headline');
    return res.status(200).json({ success: true, following: user?.following ?? [] });
  } catch (error) {
    console.error('[user.controller] getMyFollowing error:', error);
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

    const validIds = ids.filter((id) => id && mongoose.isValidObjectId(id));

    const users = await userModel
      .find({ _id: { $in: validIds } })
      .select('_id fullname avatar headline bio');

    return res.status(200).json({
      success: true,
      users,
    });
  } catch (error) {
    console.error('[user.controller] getUsersBulk error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};