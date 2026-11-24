import User from '../models/user.model.js';
import authClient from './authClient.js';

// ── self-healing user mirror ────────────────────────────────────────
// 1. Look in the local mirror.
// 2. If missing, ask auth-service.
// 3. Try to save it into the mirror (best-effort).
//
// FIX: a failed mirror write (e.g. E11000 duplicate email: null) must
// NOT throw away the user we already fetched from auth-service.
export async function resolveUser(userId) {
	if (!userId) return null;

	const local = await User.findById(userId, 'fullname avatar email role').lean();
	if (local) return local;

	// ── step 2: ask auth-service ──
	let fetched = null;
	try {
		const usersRes = await authClient.post('/api/users/bulk', { ids: [userId] });
		fetched = usersRes.data.users?.[0] || null;
	} catch (err) {
		console.error(`🔧 [resolveUser] auth-service lookup failed for ${userId}:`, err.message);
		return null;
	}

	if (!fetched) {
		console.warn(`🔧 [resolveUser] auth-service has no user ${userId}`);
		return null;
	}

	// ── step 3: best-effort heal of the mirror ──
	try {
		// only write fields that actually have a value — never write
		// email: null (it collides with the unique email index)
		const fields = {};
		if (fetched.email)    fields.email = fetched.email;
		if (fetched.fullname) fields.fullname = fetched.fullname;
		if (fetched.avatar)   fields.avatar = fetched.avatar;
		if (fetched.role)     fields.role = fetched.role;

		await User.findByIdAndUpdate(
			userId,
			{ $set: fields },
			{ upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
		);
		console.log(`🔧 [resolveUser] self-healed missing mirror entry for ${userId}`);
	} catch (err) {
		// mirror write failed, but we still return the fetched user
		console.warn(`🔧 [resolveUser] mirror heal skipped for ${userId}:`, err.message);
	}

	return fetched;
}