import jwt from 'jsonwebtoken';
import config from '../config/config.js';

/**
 * Protects routes by verifying the JWT stored in the httpOnly `token` cookie.
 * On success, attaches the decoded payload ({ id, role }) to req.user.
 * This mirrors the auth-service middleware so both services share the same
 * cookie/JWT contract without any inter-service HTTP call.
 */
const protect = (req, res, next) => {
	const token = req.cookies?.token;

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