import User from '../model/user.model.js';

// GET /api/users/bulk?ids=id1,id2,id3
export const getUsersBulk = async (req, res) => {
  try {
    const ids = (req.query.ids || '').split(',').filter(Boolean);
    if (ids.length === 0) {
      return res.status(400).json({ success: false, message: 'No IDs provided.' });
    }

    const users = await User.find(
      { _id: { $in: ids } },
      'fullname email followers following'
    ).lean();

    return res.status(200).json({ success: true, users });
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
