import express from 'express';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import sendEmail from './email/email.js';
import Notification from './models/notification.model.js';
import config from './config/config.js';

const app = express();

// ── Logging ───────────────────────────────────────────────────────────
app.use(morgan('dev'));

// ── CORS ──────────────────────────────────────────────────────────────
const defaultAllowedOrigins = [
  'http://localhost:3002',
  'http://127.0.0.1:3002',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
];

const allowedOrigins = process.env.CLIENT_URL
  ? [process.env.CLIENT_URL, ...defaultAllowedOrigins]
  : defaultAllowedOrigins;

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow Postman, curl, server-to-server requests
      if (!origin) return callback(null, true);

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error(`CORS blocked: ${origin}`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// ── Middleware ────────────────────────────────────────────────────────
app.use(express.json());
app.use(cookieParser());

// ── Auth middleware ───────────────────────────────────────────────────
const protect = (req, res, next) => {
  const token = req.cookies?.token;

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Unauthorized.',
    });
  }

  try {
    req.user = jwt.verify(token, config.JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({
      success: false,
      message: 'Invalid token.',
    });
  }
};

// ── GET /api/notifications ────────────────────────────────────────────
app.get('/api/notifications', protect, async (req, res) => {
  try {
    const notifications = await Notification.find({
      recipientId: req.user.id,
    })
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();

    const unreadCount = await Notification.countDocuments({
      recipientId: req.user.id,
      isRead: false,
    });

    return res.status(200).json({
      success: true,
      notifications,
      unreadCount,
    });
  } catch (err) {
    console.error('getNotifications error:', err);

    return res.status(500).json({
      success: false,
      message: 'Server error.',
    });
  }
});

// ── PATCH /api/notifications/read ─────────────────────────────────────
app.patch('/api/notifications/read', protect, async (req, res) => {
  try {
    await Notification.updateMany(
      {
        recipientId: req.user.id,
        isRead: false,
      },
      {
        $set: {
          isRead: true,
        },
      }
    );

    return res.status(200).json({
      success: true,
      message: 'All notifications marked as read.',
    });
  } catch (err) {
    console.error('markRead error:', err);

    return res.status(500).json({
      success: false,
      message: 'Server error.',
    });
  }
});

// ── PATCH /api/notifications/:id/read ─────────────────────────────────
app.patch('/api/notifications/:id/read', protect, async (req, res) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      {
        _id: req.params.id,
        recipientId: req.user.id,
      },
      {
        $set: {
          isRead: true,
        },
      },
      {
        returnDocument: 'after', // replaces deprecated { new: true }
      }
    );

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found.',
      });
    }

    return res.status(200).json({
      success: true,
      notification,
    });
  } catch (err) {
    console.error('markSingleRead error:', err);

    return res.status(500).json({
      success: false,
      message: 'Server error.',
    });
  }
});

// ── POST /api/notification/test-email ─────────────────────────────────
app.post('/api/notification/test-email', async (req, res) => {
  const { to, subject } = req.body;

  try {
    await sendEmail(
      to || 'islamtaiyeba38@gmail.com',
      subject || 'VerbaScope Test Email',
      'This is a plain text test from VerbaScope notification service.',
      '<p>Hello from <b>VerbaScope</b>! Your notification service is working. 🎉</p>'
    );

    return res.status(200).json({
      success: true,
      message: 'Email sent successfully',
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

export default app;