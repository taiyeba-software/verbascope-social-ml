import User from '../models/user.model.js';
import authClient from './authClient.js';

// ── PERMANENT FIX: self-healing user mirror ─────────────────────────
// post-service keeps a local mirror of users (synced via RabbitMQ's
// user_created/user_updated events) so it doesn't have to call
// auth-service on every read. But that mirror can fall out of sync —
// an event missed during a RabbitMQ outage, a user created before this
// sync existed, a message that failed silently — and until now, a
// missing mirror entry meant a permanent null (actorName unresolved,
// notifications silently dropped, comments/replies showing "Anonymous"
// forever, with no way to recover except manually re-running a backfill
// script).
//
// resolveUser() closes that gap: if the local mirror doesn't have the
// user, it falls back to asking auth-service directly (the same
// authClient + POST /api/users/bulk pattern already used everywhere in
// post.controller.js), then upserts the result into the local mirror so
// every future lookup for that user succeeds without needing any manual
// intervention. This makes the sync self-healing instead of something
// that silently breaks and stays broken.
export async function resolveUser(userId) {
  if (!userId) return null;

  const local = await User.findById(userId, 'fullname avatar email role').lean();
  if (local) return local;

  try {
    const usersRes = await authClient.post('/api/users/bulk', { ids: [userId] });
    const fetched = usersRes.data.users?.[0] || null;

    if (fetched) {
      await User.findByIdAndUpdate(
        userId,
        {
          _id: userId,
          email: fetched.email,
          fullname: fetched.fullname,
          avatar: fetched.avatar,
          role: fetched.role,
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
      console.log(`🔧 [resolveUser] self-healed missing mirror entry for ${userId}`);
    }

    return fetched;
  } catch (err) {
    console.error(`🔧 [resolveUser] fallback lookup failed for ${userId}:`, err.message);
    return null;
  }
}