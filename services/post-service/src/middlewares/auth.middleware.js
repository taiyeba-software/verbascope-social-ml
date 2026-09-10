import jwt from 'jsonwebtoken';
import config from '../config/config.js';

/**
 * Protects routes by verifying a JWT.
 *
 * Reads the token from the `Authorization: Bearer <token>` header first —
 * this is the cross-origin-safe path, since post-service lives on a
 * different subdomain than auth-service and can never receive its
 * httpOnly cookie (public-suffix domain, no shared cookie scope).
 *
 * Falls back to the `token` cookie if no header is present, so this still
 * works for any same-origin/local-dev requests that haven't switched over.
 *
 * On success, attaches the decoded payload ({ id, role }) to req.user.
 */
const protect = (req, res, next) => {
	const authHeader = req.headers?.authorization;
	const headerToken = authHeader?.startsWith('Bearer ')
		? authHeader.slice(7)
		: null;

	const token = headerToken || req.cookies?.token;

	if (!token) {
		return res.status(401).json({ success: false, message: 'Not authenticated. No token found.' });
	}

	try {
		const decoded = jwt.verify(token, config.jwtSecret);
		req.user = decoded; // { id, role, iat, exp }
		next();
	} catch (err) {
		return res.status(401).json({ success: false, message: 'Invalid or expired token.' });
	}
};

export default protect;