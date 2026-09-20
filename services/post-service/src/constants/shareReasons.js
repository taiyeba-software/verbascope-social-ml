// Single source of truth for share reasons, used by the Post schema,
// share.controller.js and post.controller.js. Previously VALID_REASONS
// lived only in share.controller.js — pulling it out here means
// post.model.js can reference the same list for its enum without
// importing a controller file.
export const VALID_REASONS = [
	'agree',
	'funny',
	'needs_attention',
	'insightful',
	'concerning',
	'educational',
];