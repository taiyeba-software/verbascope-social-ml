import amqplib from 'amqplib';
import config from '../config/config.js';

let connection = null;
let channel    = null;

// ── connect ──────────────────────────────────────────────────────
// Opens one persistent connection + channel to RabbitMQ.
// Called once at server startup.
export const connect = async () => {
    try {
        connection = await amqplib.connect(config.RABBITMQ_URI);
        connection.on('error', (err) => {
            console.error('RabbitMQ connection error:', err.message);
        });

        channel    = await connection.createChannel();
        channel.on('error', (err) => {
            console.error('RabbitMQ channel error:', err.message);
        });

        console.log('✅ RabbitMQ connected (auth-service)');
    } catch (err) {
        console.error('❌ RabbitMQ connection failed:', err.message);
    }
};

// ── publishToQueue ────────────────────────────────────────────────
// Publishes a JSON message to a named durable queue.
// durable: true → queue survives RabbitMQ restart (no message loss)
export const publishToQueue = async (queueName, data) => {
    try {
        if (!channel) {
            console.warn('RabbitMQ unavailable. Event skipped.');
            return false;
        }

        await channel.assertQueue(queueName, { durable: true });
        channel.sendToQueue(
            queueName,
            Buffer.from(JSON.stringify(data))
        );
        console.log(`📤 Message sent to queue: ${queueName}`);
        return true;
    } catch (err) {
        console.error('❌ Failed to publish to queue:', err.message);
        return false;
    }
};