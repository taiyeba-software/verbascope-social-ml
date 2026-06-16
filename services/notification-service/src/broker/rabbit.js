import amqplib from 'amqplib';
import config from '../config/config.js';

let connection = null;
let channel    = null;

// ── connect ───────────────────────────────────────────────────────
export const connect = async () => {
    try {
        connection = await amqplib.connect(config.RABBITMQ_URI);
        channel    = await connection.createChannel();
        console.log('✅ RabbitMQ connected (notification-service)');
    } catch (err) {
        console.error('❌ RabbitMQ connection failed:', err.message);
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