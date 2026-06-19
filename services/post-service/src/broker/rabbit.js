import amqplib from 'amqplib';
import config from '../config/config.js';
import User from '../models/user.model.js';

let connection = null;
let channel = null;
const pulseQueue = 'pulse_events';

const upsertUser = async (payload) => {
	if (!payload?.id) return;

	await User.findByIdAndUpdate(
		payload.id,
		{
			_id: payload.id,
			email: payload.email,
			fullname: payload.fullname,
			role: payload.role,
		},
		{ upsert: true, new: true, setDefaultsOnInsert: true }
	);
};

const consumeQueue = async (queueName, handler) => {
	await channel.assertQueue(queueName, { durable: true });
	await channel.consume(queueName, async (message) => {
		if (!message) return;

		try {
			const payload = JSON.parse(message.content.toString());
			await handler(payload);
			channel.ack(message);
		} catch (error) {
			console.error(`Failed to process ${queueName} message:`, error.message);
			channel.nack(message, false, false);
		}
	});
};

export const publish = (eventType, data) => {
	if (!channel) return;
	const payload = JSON.stringify({ type: eventType, ...data });

	if (eventType === 'notification_created') {
		channel.sendToQueue('notification_created', Buffer.from(payload));
	} else {
		// pulse events (post.liked, post.commented, etc.) keep going to pulseQueue
		channel.sendToQueue(pulseQueue, Buffer.from(payload));
	}
};

export const consumePulseEvents = async (onEvent) => {
	if (!channel) return;

	await channel.assertQueue(pulseQueue, { durable: false });
	await channel.consume(pulseQueue, (message) => {
		if (!message) return;

		const event = JSON.parse(message.content.toString());
		onEvent(event);
		channel.ack(message);
	});
};

export const connect = async () => {
	try {
		connection = await amqplib.connect(config.rabbitUri);

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

		await channel.assertQueue(pulseQueue, { durable: false });
		await channel.assertQueue('notification_created', { durable: true });

		await consumeQueue('user_created', upsertUser);

		console.log('RabbitMQ connected (post-service)');
		return true;
	} catch (error) {
		console.error('RabbitMQ connection failed:', error.message);
		setTimeout(connect, 5000); // retry on initial connect failure too
		return false;
	}
};