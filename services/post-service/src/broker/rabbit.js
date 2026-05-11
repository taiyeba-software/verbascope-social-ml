import amqplib from 'amqplib';
import config from '../config/config.js';
import User from '../models/user.model.js';

let connection = null;
let channel = null;

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

export const connect = async () => {
	try {
		connection = await amqplib.connect(config.rabbitUri);
		channel = await connection.createChannel();

		await consumeQueue('user_created', upsertUser);

		console.log('RabbitMQ connected (post-service)');
		return true;
	} catch (error) {
		console.error('RabbitMQ connection failed:', error.message);
		return false;
	}
};