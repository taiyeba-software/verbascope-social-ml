import authClient from './authClient.js';

// ── Community Insights personalization ──
// Returns the author IDs that should count toward "this week's" Community
// Insights and the signal-filtered feed: the current user's own posts plus
// everyone they follow.
//
// Reuses the EXISTING GET /api/users/me/following endpoint rather than
// requiring a new by-ID route on auth-service — that endpoint already
// returns exactly what's needed, it just needs to be called AS the
// current user. So instead of an ID, this takes the incoming Express
// `req` and forwards its own Authorization header through to auth-service,
// which is safe because we only ever ask for the requesting user's own
// following list, never anyone else's.
export const getVisibleAuthors = async (req) => {
  const userId = req.user.id;
  try {
    const res = await authClient.get('/api/users/me/following', {
      headers: { Authorization: req.headers.authorization },
    });
    const followingIds = res.data?.following ?? [];
    return [userId, ...followingIds];
  } catch (err) {
    console.error('getVisibleAuthors error:', err.message);
    // Fail safe to "just me" rather than throwing — a broken auth-service
    // call shouldn't take down Community Insights entirely, it should just
    // narrow the view to the user's own posts until the call works again.
    return [userId];
  }
};