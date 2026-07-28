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

// Handles profile changes (avatar, name) made after signup. Kept separate
// from upsertUser: this only ever updates an existing doc, and only the
// fields actually included in the payload, so it never clobbers a field
// (like email/role) that user_updated doesn't carry.
const applyUserUpdate = async (payload) => {
	if (!payload?.id) return;

	const setFields = {};
	if (payload.fullname !== undefined) setFields.fullname = payload.fullname;
	if (payload.avatar !== undefined) setFields.avatar = payload.avatar;

	if (Object.keys(setFields).length === 0) return;

	// upsert: true as a safety net in case a user_updated event somehow
	// arrives before user_created has been processed (e.g. queue replay,
	// out-of-order delivery) — same reasoning as upsertUser above.
	await User.findByIdAndUpdate(
		payload.id,
		{ $set: setFields },
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
		await consumeQueue('user_updated', applyUserUpdate);

		console.log('RabbitMQ connected (post-service)');
		return true;
	} catch (error) {
		console.error('RabbitMQ connection failed:', error.message);
		setTimeout(connect, 5000); // retry on initial connect failure too
		return false;
	}
};