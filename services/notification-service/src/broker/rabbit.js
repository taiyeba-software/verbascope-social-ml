import amqplib from 'amqplib';
import config from '../config/config.js';

let connection = null;
let channel    = null;

// ── connect ───────────────────────────────────────────────────────
export const connect = async () => {
    try {
        connection = await amqplib.connect(config.RABBITMQ_URI);

        // prevent ECONNRESET / dropped connections from crashing the process
        connection.on('error', (err) => {
            console.error('⚠️  RabbitMQ connection error:', err.message);
        });
        connection.on('close', () => {
            console.warn('⚠️  RabbitMQ connection closed. Attempting reconnect in 5s...');
            setTimeout(connect, 5000);
        });

        channel = await connection.createChannel();
        channel.on('error', (err) => {
            console.error('⚠️  RabbitMQ channel error:', err.message);
        });

        console.log('✅ RabbitMQ connected (notification-service)');
    } catch (err) {
        console.error('❌ RabbitMQ connection failed:', err.message);
        setTimeout(connect, 5000); // retry on initial connect failure too
    }
};

// ── subscribeToQueue ──────────────────────────────────────────────
// Listens on a queue and calls callback(parsedMessage) for each msg.
// channel.ack(msg) tells RabbitMQ the message was processed —
// it can now be deleted from the queue.
export const subscribeToQueue = async (queueName, callback) => {
    await channel.assertQueue(queueName, { durable: true });
    channel.consume(queueName, async (msg) => {
        await callback(JSON.parse(msg.content.toString()));
        channel.ack(msg);  // ← acknowledge = delete from queue
    });
};

// ── publish ───────────────────────────────────────────────────────
export const publish = (queueName, data) => {
    if (!channel) return;
    channel.sendToQueue(
        queueName,
        Buffer.from(JSON.stringify(data)),
        { persistent: true }
    );
};