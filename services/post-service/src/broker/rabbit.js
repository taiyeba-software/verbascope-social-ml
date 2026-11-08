import amqplib from 'amqplib';
import config from '../config/config.js';
import User from '../models/user.model.js';

let connection = null;
let channel = null;
const pulseQueue = 'pulse_events';
const mlAnalyzeQueue = 'ml_analyze';
const mlResultQueue = 'ml_results';

// ── FIX (reconnect): the pulse and ML-result handlers are now remembered
// here. Before, consumePulseEvents() / consumeMLResults() ran only once at
// server start. After a RabbitMQ connection drop, connect() built a new
// channel but only re-registered user_created / user_updated, so ML results
// silently stopped arriving until post-service was restarted. Also, if
// those functions were called while `channel` was still null, they returned
// without registering anything at all.
//
// `...RegisteredOn` remembers which channel a consumer is attached to, so
// the same consumer is never registered twice on the same channel.
let pulseHandler = null;
let mlResultHandler = null;
let pulseRegisteredOn = null;
let mlResultRegisteredOn = null;

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

// ── FIX: publish() previously did two dangerous things silently:
//   1. If `channel` was null (RabbitMQ not yet connected, or connection
//      dropped), it just `return`ed with no error — the caller had no way
//      to know the message was dropped, so a log like
//      "notification_created published ✅" right after calling this
//      could be printed even though NOTHING was actually sent.
//   2. `channel.sendToQueue(...)` can itself throw (e.g. channel closed
//      mid-call), and that was never caught, so callers not wrapping this
//      in try/catch could crash — or, since it's called fire-and-forget
//      in like.controller.js, the error would vanish into an unhandled
//      rejection with no useful log.
//
// Now publish() returns true/false so callers can actually check whether
// the message went out, and every failure path logs clearly. Also added
// `{ persistent: true }` to the notification_created send so it matches
// the queue's own `durable: true` — without it, a broker restart between
// publish and consume could still lose an in-flight message.
export const publish = (eventType, data) => {
	if (!channel) {
		console.error(`⚠️  publish('${eventType}') dropped — RabbitMQ channel not connected`);
		return false;
	}

	const payload = JSON.stringify({
		type: eventType,
		...data,
	});

	try {
		if (eventType === 'notification_created') {
			channel.sendToQueue(
				'notification_created',
				Buffer.from(payload),
				{ persistent: true }
			);
		} else if (eventType === 'ml.analyze') {
			channel.sendToQueue(
				mlAnalyzeQueue,
				Buffer.from(payload),
				{ persistent: true }
			);
		} else {
			// Existing pulse events
			channel.sendToQueue(
				pulseQueue,
				Buffer.from(payload)
			);
		}
		return true;
	} catch (err) {
		console.error(`⚠️  publish('${eventType}') failed:`, err.message);
		return false;
	}
};

// Registers the pulse consumer on the CURRENT channel (once per channel).
const registerPulseConsumer = async () => {
	if (!channel || !pulseHandler || pulseRegisteredOn === channel) return;

	const ch = channel; // keep this channel for ack(): `channel` may be replaced after a reconnect
	const handler = pulseHandler;
	pulseRegisteredOn = ch;

	try {
		await ch.assertQueue(pulseQueue, { durable: false });
		await ch.consume(pulseQueue, (message) => {
			if (!message) return;

			const event = JSON.parse(message.content.toString());
			handler(event);
			ch.ack(message);
		});
	} catch (err) {
		pulseRegisteredOn = null; // allow a later retry
		throw err;
	}
};

// Registers the ML-result consumer on the CURRENT channel (once per channel).
const registerMLResultConsumer = async () => {
	if (!channel || !mlResultHandler || mlResultRegisteredOn === channel) return;

	const ch = channel;
	const handler = mlResultHandler;
	mlResultRegisteredOn = ch;

	try {
		await ch.assertQueue(mlResultQueue, { durable: true });
		await ch.consume(mlResultQueue, async (message) => {
			if (!message) return;

			try {
				const result = JSON.parse(message.content.toString());
				await handler(result);
				ch.ack(message);
			} catch (error) {
				console.error('Failed to process ML result:', error.message);
				ch.nack(message, false, false);
			}
		});
	} catch (err) {
		mlResultRegisteredOn = null; // allow a later retry
		throw err;
	}
};

// Same names and arguments as before, so server.js needs no change.
export const consumePulseEvents = async (onEvent) => {
	pulseHandler = onEvent;
	await registerPulseConsumer();
};

export const consumeMLResults = async (onResult) => {
	mlResultHandler = onResult;
	await registerMLResultConsumer();
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
			channel = null; // ── FIX: null out channel immediately on close so
			// publish() correctly reports "dropped" during the reconnect
			// window instead of holding a stale, dead channel reference
			// that might still "succeed" at sendToQueue() but never
			// actually deliver.
			setTimeout(connect, 5000);
		});

		channel = await connection.createChannel();
		channel.on('error', (err) => {
			console.error('⚠️  RabbitMQ channel error:', err.message);
		});
		channel.on('close', () => {
			// ── FIX: a channel can close independently of the connection
			// (e.g. a protocol error on this channel specifically). Null
			// it out here too so publish() doesn't keep calling methods
			// on a dead channel object.
			channel = null;
		});

		await channel.assertQueue(pulseQueue, { durable: false });
		await channel.assertQueue('notification_created', { durable: true });
		await channel.assertQueue(mlAnalyzeQueue, { durable: true });
		await channel.assertQueue(mlResultQueue, { durable: true });

		await consumeQueue('user_created', upsertUser);
		await consumeQueue('user_updated', applyUserUpdate);

		// ── FIX: after a reconnect (or if server.js asked for these before the
		// channel existed), attach the pulse and ML-result consumers to the
		// new channel. On the very first connect the handlers are still null,
		// so these calls do nothing and server.js registers them as before.
		await registerPulseConsumer();
		await registerMLResultConsumer();

		console.log('RabbitMQ connected (post-service)');
		return true;
	} catch (error) {
		console.error('RabbitMQ connection failed:', error.message);
		setTimeout(connect, 5000); // retry on initial connect failure too
		return false;
	}
};