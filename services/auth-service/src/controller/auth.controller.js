import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { validationResult } from 'express-validator';
import userModel from '../model/user.model.js';
import { publishToQueue } from '../broker/rabbit.js';
import config from '../config/config.js';

// FIX: the secret now comes from the same config object the auth middleware
// uses, so signing and verifying can never disagree (previously the
// controller read process.env directly while the middleware used config).
const { JWT_SECRET, JWT_EXPIRES_IN, CLIENT_URL, IS_PROD } = config;
const COOKIE_NAME = 'token';

// FIX: IS_PROD also turns on when running on Render (RENDER=true), so the
// cookie is SameSite=None; Secure there even if NODE_ENV isn't set.
const baseCookieOptions = {
  httpOnly: true,
  secure: IS_PROD,
  sameSite: IS_PROD ? 'none' : 'lax',
  path: '/',
};

/* ──────────────────────────────────────────────────────────
   Helpers
   ────────────────────────────────────────────────────────── */

function signToken(userId) {
  return jwt.sign({ id: userId }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

function setAuthCookie(res, token) {
  res.cookie(COOKIE_NAME, token, {
    ...baseCookieOptions,
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });
}

function sanitizeUser(user) {
  const obj = user.toObject ? user.toObject() : user;
  delete obj.password;
  return obj;
}

// Payload shape matches what post-service's upsertUser() and
// notification-service's user_created handler both expect.
function publishUserCreated(user, authProvider = 'local') {
  try {
    Promise.resolve(
      publishToQueue('user_created', {
        id: user._id,
        email: user.email,
        fullname: user.fullname,
        role: user.role,
        authProvider,
      })
    ).catch((err) => {
      console.error('[auth.controller] failed to publish user_created:', err.message);
    });
  } catch (err) {
    // publishToQueue threw synchronously (e.g. channel not ready yet) -
    // never let that break register/login.
    console.error('[auth.controller] failed to publish user_created:', err.message);
  }
}

/* ──────────────────────────────────────────────────────────
   POST /api/auth/register
   ────────────────────────────────────────────────────────── */

const register = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: errors.array()[0]?.msg || 'Invalid input.',
        errors: errors.array(),
      });
    }

    const { email, password, fullname } = req.body;

    const existingUser = await userModel.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'An account with this email already exists.',
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await userModel.create({
      email: email.toLowerCase(),
      password: hashedPassword,
      fullname: {
        firstName: fullname.firstName,
        lastName: fullname.lastName,
      },
    });

    const token = signToken(user._id);
    setAuthCookie(res, token);

    publishUserCreated(user, 'local');

    return res.status(201).json({
      success: true,
      user: sanitizeUser(user),
      token, // returned so the frontend can send it as Authorization header
    });
  } catch (err) {
    console.error('[auth.controller] register error:', err);
    return res.status(500).json({
      success: false,
      message: 'Registration failed. Please try again.',
    });
  }
};

/* ──────────────────────────────────────────────────────────
   POST /api/auth/login
   ────────────────────────────────────────────────────────── */

const login = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: errors.array()[0]?.msg || 'Invalid input.',
        errors: errors.array(),
      });
    }

    const { email, password } = req.body;

    const user = await userModel.findOne({ email: email.toLowerCase() });
    if (!user || !user.password) {
      // no user, or account was created via Google (no password set)
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.',
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.',
      });
    }

    const token = signToken(user._id);
    setAuthCookie(res, token);

    return res.status(200).json({
      success: true,
      user: sanitizeUser(user),
      token,
    });
  } catch (err) {
    console.error('[auth.controller] login error:', err);
    return res.status(500).json({
      success: false,
      message: 'Login failed. Please try again.',
    });
  }
};

/* ──────────────────────────────────────────────────────────
   GET /api/auth/google/callback
   ────────────────────────────────────────────────────────── */

const googleCallback = async (req, res) => {
  try {
    const user = req.user;

    if (!user) {
      return res.redirect(`${CLIENT_URL}/login?error=google_auth_failed`);
    }

    const token = signToken(user._id);
    setAuthCookie(res, token);

    publishUserCreated(user, 'google');

    // Token goes in the query string so the SPA can store it as a Bearer
    // token (api.ts picks it up before the first /me call).
    return res.redirect(`${CLIENT_URL}/feed?token=${token}`);
  } catch (err) {
    console.error('[auth.controller] googleCallback error:', err);
    return res.redirect(`${CLIENT_URL}/login?error=google_auth_failed`);
  }
};

/* ──────────────────────────────────────────────────────────
   GET /api/auth/me
   ────────────────────────────────────────────────────────── */

const getMe = async (req, res) => {
  try {
    const userId = req.userId || req.user?.id || req.user?._id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Not authenticated.',
      });
    }

    const user = await userModel.findById(userId);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User not found.',
      });
    }

    return res.status(200).json({
      success: true,
      user: sanitizeUser(user),
    });
  } catch (err) {
    console.error('[auth.controller] getMe error:', err);
    // 503 (not 500) so the frontend knows this is temporary - e.g. the DB
    // is still connecting - and retries instead of logging the user out.
    return res.status(503).json({
      success: false,
      message: 'Service temporarily unavailable. Please retry.',
    });
  }
};

/* ──────────────────────────────────────────────────────────
   POST /api/auth/logout
   ────────────────────────────────────────────────────────── */

const logout = async (req, res) => {
  try {
    res.clearCookie(COOKIE_NAME, baseCookieOptions);

    return res.status(200).json({
      success: true,
      message: 'Logged out successfully.',
    });
  } catch (err) {
    console.error('[auth.controller] logout error:', err);
    return res.status(500).json({
      success: false,
      message: 'Logout failed.',
    });
  }
};

export default {
  register,
  login,
  googleCallback,
  getMe,
  logout,
};