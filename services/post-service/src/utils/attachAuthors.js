import { resolveUser } from './resolveUser.js';

// ── attachAuthors ───────────────────────────────────────────────────
// Replaces Mongoose .populate('user') for comments.
//
// populate() only checks the local User mirror and silently returns
// null when the user is missing → frontend shows "Anonymous".
// This helper uses resolveUser() instead, which falls back to
// auth-service and self-heals the mirror.
//
// Input : array of plain comment objects (use .lean() or .toObject())
// Output: same comments, with `user` and `author` set to
//         { _id, fullname, avatar } — or null if truly unresolvable.
export async function attachAuthors(comments) {
	const ids = [
		...new Set(comments.map((c) => c.user?.toString()).filter(Boolean)),
	];

	// one lookup per unique user (not per comment), run in parallel
	const users = await Promise.all(
		ids.map((id) => resolveUser(id).catch(() => null))
	);
	const byId = new Map(ids.map((id, i) => [id, users[i]]));

	return comments.map((c) => {
		const id = c.user?.toString();
		const u = byId.get(id);
		const author = u
			? { _id: id, fullname: u.fullname, avatar: u.avatar }
			: null;

		return { ...c, user: author, author };
	});
}