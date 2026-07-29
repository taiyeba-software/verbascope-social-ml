import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { validationResult } from 'express-validator';
import userModel from '../model/user.model.js';

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
const COOKIE_NAME = 'token';
const isProd = process.env.NODE_ENV === 'production';

// Updated default fallback port from 3000 to 3002 (Next.js frontend)
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:3002';

/* ──────────────────────────────────────────────────────────
   Helpers
   ────────────────────────────────────────────────────────── */

function signToken(userId) {
  return jwt.sign({ id: userId }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

function setAuthCookie(res, token) {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'none' : 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });
}

function sanitizeUser(user) {
  const obj = user.toObject ? user.toObject() : user;
  delete obj.password;
  return obj;
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

    return res.status(201).json({
      success: true,
      user: sanitizeUser(user),
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
   Runs after Passport's GoogleStrategy has already verified
   the user and attached the Mongoose doc to req.user.
   ────────────────────────────────────────────────────────── */

const googleCallback = async (req, res) => {
  try {
    const user = req.user;

    if (!user) {
      return res.redirect(`${CLIENT_URL}/login?error=google_auth_failed`);
    }

    const token = signToken(user._id);
    setAuthCookie(res, token);

    return res.redirect(`${CLIENT_URL}/feed`);
  } catch (err) {
    console.error('[auth.controller] googleCallback error:', err);
    return res.redirect(`${CLIENT_URL}/login?error=google_auth_failed`);
  }
};

/* ──────────────────────────────────────────────────────────
   GET /api/auth/me
   Requires authenticateToken middleware to have run first
   and attached req.userId (or req.user.id).
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
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch current user.',
    });
  }
};

/* ──────────────────────────────────────────────────────────
   POST /api/auth/logout
   ────────────────────────────────────────────────────────── */

const logout = async (req, res) => {
  try {
    res.clearCookie(COOKIE_NAME, {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? 'none' : 'lax',
    });

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