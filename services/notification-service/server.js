import dotenv from 'dotenv';
dotenv.config();
import { createServer } from 'http';
import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import app from './src/app.js';
import { connect as connectRabbit } from './src/broker/rabbit.js';
import startListener from './src/broker/listener.js';
import config from './src/config/config.js';

const PORT = process.env.PORT || 3001;

// ── MongoDB ───────────────────────────────────────────────────────
await mongoose.connect(config.MONGO_URI);
console.log('MongoDB connected (notification-service)');

// ── Socket.io ─────────────────────────────────────────────────────
const defaultAllowedOrigins = [
    'http://localhost:3002',
    'http://127.0.0.1:3002',
    'http://localhost:3000',
    'http://127.0.0.1:3000',
];

// Merge in CLIENT_URL from the environment (e.g. the deployed frontend URL)
// so Socket.IO doesn't silently reject production connections. Socket.IO's
// CORS is separate from Express's CORS middleware in app.js, so this must
// be configured independently even though app.js already reads CLIENT_URL.
const allowedOrigins = process.env.CLIENT_URL
    ? [process.env.CLIENT_URL, ...defaultAllowedOrigins]
    : defaultAllowedOrigins;

const httpServer = createServer(app);
export const io = new Server(httpServer, {
    cors: {
        origin: (origin, callback) => {
            // Allow non-browser clients (no origin header)
            if (!origin) return callback(null, true);

            if (allowedOrigins.includes(origin)) {
                return callback(null, true);
            }

            return callback(new Error(`Socket.IO CORS blocked: ${origin}`));
        },
        credentials: true,
    },
});

// ── Socket.IO auth handshake ───────────────────────────────────────
// Mirrors the inline `protect` middleware in src/app.js: verifies the
// JWT the frontend sends via `io(url, { auth: { token } })`. Cookies
// never reach this service cross-origin, so the handshake token is the
// only reliable source — connections without a valid token are
// rejected before `connection` fires.
io.use((socket, next) => {
    const token = socket.handshake.auth?.token;

    if (!token) {
        return next(new Error('Unauthorized.'));
    }

    try {
        socket.user = jwt.verify(token, config.JWT_SECRET);
        next();
    } catch (err) {
        next(new Error('Invalid token.'));
    }
});

io.on('connection', (socket) => {
    console.log('Notification socket connected:', socket.id, 'user:', socket.user?.id);

    // each user joins their own room by userId
    socket.on('join', (userId) => {
        socket.join(userId);
        console.log(`User ${userId} joined notification room`);
    });

    socket.on('disconnect', () => {
        console.log('Notification socket disconnected:', socket.id);
    });
});

// ── RabbitMQ ──────────────────────────────────────────────────────
await connectRabbit();
startListener();

// ── Start ─────────────────────────────────────────────────────────
httpServer.listen(PORT, () => {
    console.log(`Notification service on ${PORT}`);
});