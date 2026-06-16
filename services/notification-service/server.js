

import dotenv from 'dotenv';
dotenv.config();
import { createServer } from 'http';
import { Server } from 'socket.io';
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
const httpServer = createServer(app);
export const io = new Server(httpServer, {
    cors: { origin: 'http://localhost:3002', credentials: true }
});

io.on('connection', (socket) => {
    console.log('Notification socket connected:', socket.id);

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