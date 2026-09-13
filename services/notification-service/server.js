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

const allowedOrigins = process.env.CLIENT_URL
    ? [process.env.CLIENT_URL, ...defaultAllowedOrigins]
    : defaultAllowedOrigins;

const httpServer = createServer(app);
export const io = new Server(httpServer, {
    cors: {
        origin: (origin, callback) => {
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

    // ── FIX: auto-join the room using the VERIFIED id from the JWT,
    // instead of trusting a client-emitted 'join' event. This removes
    // the old "socket.emit('join', user._id)" trust gap, and fixes the
    // real bug where `user._id` was sometimes undefined on the frontend
    // (the user object there actually carries `id`, not `_id`, in some
    // code paths) — which silently joined a room literally named
    // "undefined" and meant no notification ever matched.
    //
    // socket.user.id must be a string here so it matches whatever
    // format recipientId is emitted as (e.g. `recipientId.toString()`)
    // on the emit side in your RabbitMQ listener/controller.
    if (socket.user?.id) {
        socket.join(socket.user.id.toString());
        console.log(`User ${socket.user.id} auto-joined notification room`);
    }

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