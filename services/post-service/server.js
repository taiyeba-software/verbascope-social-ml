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
import {
    postsIndex,
    startSearchBootstrap,
    startMeiliKeepAlive,
    reportSearchFailure,
} from './src/search/meiliClient.js';
import { rebuildSearchIndex } from './src/search/postIndex.js'; // self-heal after ephemeral-disk wipe on redeploy
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

// Runs after EVERY successful Meilisearch bootstrap (startup, or a later
// recovery). If the index is empty, this deploy/restart wiped the data, so
// rebuild it from Mongo. A normal restart where the index survived skips
// the rebuild entirely.
//
// `rebuilding` stops the watchdog below (or a second bootstrap) from
// starting a duplicate rebuild while one is still running — documents
// added by a rebuild take a moment to show up in getStats().
let rebuilding = false;

const rebuildSearchIndexIfEmpty = async () => {
    if (rebuilding) return;
    const stats = await postsIndex().getStats();
    if (stats.numberOfDocuments === 0) {
        rebuilding = true;
        try {
            console.log('🔧 Search index is empty — rebuilding from Mongo...');
            const { indexed, failed } = await rebuildSearchIndex();
            console.log(`🔧 Rebuild complete: ${indexed} indexed, ${failed} failed`);
        } finally {
            rebuilding = false;
        }
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

// ── Meilisearch bootstrap (non-blocking, self-retrying) ────────────
// Search is non-critical, and a sleeping free-tier Meilisearch can take
// 30-60s to wake. Instead of trying once and giving up (which forced a
// manual redeploy), this retries in the background with backoff until
// Meilisearch answers, then runs index/settings setup and the
// rebuild-if-empty check. NOT awaited, so the server starts listening
// immediately.
startSearchBootstrap({ onReady: rebuildSearchIndexIfEmpty });

// Periodic ping so the free-tier Meilisearch doesn't go to sleep.
startMeiliKeepAlive();

// ── Watchdog ───────────────────────────────────────────────────────
// Render's free tier can wipe Meilisearch's disk (or put it to sleep)
// while post-service stays up. A search on an empty index doesn't throw,
// it just returns nothing, so the retry loop alone would never notice.
// Every 5 minutes: if the index is empty, rebuild it; if the index is
// missing or Meilisearch is unreachable, restart the bootstrap loop
// (recreate index + settings, then rebuild). No redeploy needed.
setInterval(async () => {
    try {
        await rebuildSearchIndexIfEmpty();
    } catch (err) {
        console.warn('⚠️ Search watchdog:', err.message);
        reportSearchFailure();
    }
}, 5 * 60 * 1000).unref();

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