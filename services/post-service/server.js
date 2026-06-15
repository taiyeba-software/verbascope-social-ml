import { createServer } from 'http';
import { Server } from 'socket.io';
import app from './src/app.js';
import connectDB from './src/db/db.js';
import { connect as connectRabbit, consumePulseEvents } from './src/broker/rabbit.js';
import { pulse } from './src/pulse/pulse.js';
import Post from './src/models/post.model.js';

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

const PORT = parseInt(process.env.PORT) || 3003;
const httpServer = createServer(app);
export const io = new Server(httpServer, {
    cors: { origin: 'http://localhost:3002', credentials: true }
});

io.on('connection', (socket) => {
    console.log('Socket connected:', socket.id);
    socket.on('disconnect', () => console.log('Socket disconnected:', socket.id));
});

await connectDB();
await seedPulseFromDB();
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
} catch (err) {
    console.warn('⚠️  RabbitMQ unavailable, continuing without it.');
}

httpServer.listen(PORT, () => console.log(`Post service on ${PORT}`));