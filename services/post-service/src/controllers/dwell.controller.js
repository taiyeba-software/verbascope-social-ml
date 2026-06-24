import { updateUserPulse } from '../pulse/updateUserPulse.js';

// POST /api/posts/dwell
// Body: { postId: string, duration: number (ms) }
export const recordDwell = async (req, res) => {
  try {
    const { postId, duration } = req.body;

    // Ignore accidental scrolls — only meaningful reads
    if (!postId || !duration || duration < 3000) {
      return res.status(200).json({ success: true }); // silent ignore
    }

    // Fire and forget — don't make the client wait
    updateUserPulse(req.user.id, postId, 'dwell');

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('recordDwell error:', err);
    return res.status(500).json({ success: false });
  }
};