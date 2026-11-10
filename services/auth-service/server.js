import mongoose from 'mongoose';
import app from './src/app.js';
import config from './src/config/config.js';
import connectDB from './src/db/db.js';
import authRoutes from './src/routes/auth.routes.js';
import userRoutes from './src/routes/user.routes.js';
import { connect } from './src/broker/rabbit.js';

/* ── Health check (point UptimeRobot here, NOT at /api/auth/me) ── */
app.get('/health', (req, res) => {
    const dbReady = mongoose.connection.readyState === 1;
    res.status(200).json({
        success: true,
        service: 'auth-service',
        db: dbReady ? 'up' : 'down',
        uptime: Math.round(process.uptime()),
    });
});

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);

app.use((req, res) => {
    res.status(404).json({ success: false, message: 'Route not found' });
});

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
    if (err?.message?.startsWith('CORS blocked')) {
        return res.status(403).json({ success: false, message: err.message });
    }
    console.error('[server] unhandled error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
});

/* ── Start listening FIRST so Render's proxy never sees a dead port (502).
   Render injects PORT; it must bind to 0.0.0.0. ── */
app.listen(config.PORT, '0.0.0.0', () => {
    console.log(`Auth service running on port ${config.PORT}`);
});

/* ── Dependencies connect in the background with retry, so a slow or
   unavailable MongoDB / RabbitMQ can no longer kill or hang startup. ── */
const RETRY_MS = 10000;

async function connectDbWithRetry() {
    try {
        const ok = await connectDB();
        if (ok) return;
    } catch (err) {
        console.error('[server] MongoDB connect error:', err?.message || err);
    }
    console.warn(`⚠️  MongoDB not connected, retrying in ${RETRY_MS / 1000}s`);
    setTimeout(connectDbWithRetry, RETRY_MS);
}

async function connectBrokerWithRetry() {
    try {
        await connect();
    } catch (err) {
        console.error('[server] RabbitMQ connect error:', err?.message || err);
        console.warn(`⚠️  RabbitMQ not connected, retrying in ${RETRY_MS / 1000}s`);
        setTimeout(connectBrokerWithRetry, RETRY_MS);
    }
}

connectDbWithRetry();
connectBrokerWithRetry();

process.on('unhandledRejection', (reason) => {
    console.error('[server] unhandledRejection:', reason);
});