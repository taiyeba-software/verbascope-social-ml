import { createServer } from 'http';
import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import app from './src/app.js';
import connectDB from './src/db/db.js';
import {
    connect as connectRabbit,
    consumePulseEvents,
    consumeMLResults,
} from './src/broker/rabbit.js';
import { pulse } from './src/pulse/pulse.js';
import Post from './src/models/post.model.js';
import { initMeilisearch } from './src/search/meiliClient.js';
import { handleMLResult } from './src/controllers/post.controller.js';
import config from './src/config/config.js';

const seedPulseFromDB = async () => {
    try {
        pulse.resetForSeed();
        const posts = await Post.find({}, 'content').lean();
        posts.forEach(post => pulse.onPostCreated(post));
        console.log(`Pulse seeded from ${posts.length} existing posts.`);
    } catch (err) {
        console.warn('Pulse seed failed:', err.message);
    }
};

// Same allowlist logic as src/app.js — CLIENT_URL from the environment
// (the deployed frontend URL) plus local-dev fallbacks, so Socket.IO's
// own CORS check doesn't silently diverge from the HTTP CORS middleware.
const defaultAllowedOrigins = [
    'http://localhost:3001',
    'http://127.0.0.1:3001',
    'http://localhost:3002',
    'http://127.0.0.1:3002',
    'http://localhost:3000',
    'http://127.0.0.1:3000',
];

const socketAllowlist = process.env.CLIENT_URL
    ? [process.env.CLIENT_URL, ...defaultAllowedOrigins]
    : defaultAllowedOrigins;

const PORT = parseInt(process.env.PORT) || 3003;
const httpServer = createServer(app);
export const io = new Server(httpServer, {
    cors: { origin: socketAllowlist, credentials: true }
});

// ── Socket.IO auth handshake ───────────────────────────────────────
// Mirrors src/middlewares/auth.middleware.js: verifies the JWT the
// frontend sends via `io(url, { auth: { token } })`. Cookies never
// reach this service cross-origin, so the handshake token is the only
// reliable source — connections without a valid token are rejected
// before `connection` fires.
io.use((socket, next) => {
    const token = socket.handshake.auth?.token;

    if (!token) {
        return next(new Error('Not authenticated. No token found.'));
    }

    try {
        const decoded = jwt.verify(token, config.jwtSecret);
        socket.user = decoded; // { id, role, iat, exp }
        next();
    } catch (err) {
        next(new Error('Invalid or expired token.'));
    }
});

io.on('connection', (socket) => {
    console.log('Socket connected:', socket.id, 'user:', socket.user?.id);
    socket.on('disconnect', () => console.log('Socket disconnected:', socket.id));
});

await connectDB();
await seedPulseFromDB();

// Meilisearch is non-critical — if it's down, log a warning and keep going.
await initMeilisearch();

try {
    await connectRabbit();
    await consumePulseEvents((event) => {
        if (event.type === 'post.created') {
            pulse.onPostCreated(event.post);
            io.emit('pulse:trending', pulse.getTrending());
        }
        if (event.type === 'post.liked') {
            pulse.onPostLiked(event.postId);
            io.emit('pulse:update', pulse.getSignal());
        }
        if (event.type === 'comment.added') {
            pulse.onCommentAdded(event.postId);
            io.emit('pulse:update', pulse.getSignal());
        }
        if (event.type === 'post.shared') {
            pulse.onPostShared(event.postId, event.reason);
            io.emit('pulse:update', pulse.getSignal());
        }
    });
    await consumeMLResults(handleMLResult);
} catch (err) {
    console.warn('⚠️  RabbitMQ unavailable, continuing without it.');
}

httpServer.listen(PORT, () => console.log(`Post service on ${PORT}`));