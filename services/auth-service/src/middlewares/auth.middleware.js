import jwt from 'jsonwebtoken';
import config from '../config/config.js';

// Collects every token the request carries. Bearer header comes first (it
// works cross-site, e.g. vercel.app -> onrender.com, where browsers often
// block the cookie), then the HTTP-only cookie as a fallback.
function extractTokens(req) {
    const tokens = [];

    const header = req.headers?.authorization;
    if (typeof header === 'string' && header.startsWith('Bearer ')) {
        const bearer = header.slice(7).trim();
        if (bearer && bearer !== 'null' && bearer !== 'undefined') tokens.push(bearer);
    }

    const cookieToken = req.cookies?.token;
    if (cookieToken && !tokens.includes(cookieToken)) tokens.push(cookieToken);

    return tokens;
}

const authenticateToken = (req, res, next) => {
    const tokens = extractTokens(req);

    if (tokens.length === 0) {
        return res.status(401).json({
            success: false,
            message: 'No token provided. Please log in.',
        });
    }

    // Try each candidate: a stale Bearer token must not block a valid cookie
    // (or the other way round).
    for (const token of tokens) {
        try {
            req.user = jwt.verify(token, config.JWT_SECRET);
            return next();
        } catch {
            // try next candidate
        }
    }

    return res.status(401).json({
        success: false,
        message: 'Invalid or expired token. Please log in again.',
    });
};

export default authenticateToken;