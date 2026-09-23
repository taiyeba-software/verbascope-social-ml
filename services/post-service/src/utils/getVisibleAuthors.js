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

    // ── FIX: /api/users/me/following returns full user objects
    // ({ fullname, _id, headline, avatar }), NOT plain ID strings. The
    // first version of this function assumed `following` was a string[]
    // and pushed those objects straight into visibleAuthors, which meant
    // Mongo's `author: { $in: visibleAuthors }` could never match them —
    // every filtered result silently collapsed to "just me", which is
    // exactly why Community Insights showed as empty. Normalize to plain
    // ID strings here regardless of which shape the endpoint returns, so
    // this keeps working even if that response shape changes later. ──
    const followingRaw = res.data?.following ?? [];
    const followingIds = followingRaw.map((f) => (typeof f === 'string' ? f : f._id));

    return [userId, ...followingIds];
  } catch (err) {
    console.error('getVisibleAuthors error:', err.message);
    // Fail safe to "just me" rather than throwing — a broken auth-service
    // call shouldn't take down Community Insights entirely, it should just
    // narrow the view to the user's own posts until the call works again.
    return [userId];
  }
};