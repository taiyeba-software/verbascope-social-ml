import { config as dotenvConfig } from 'dotenv';

dotenvConfig();

const _config = {
    MONGO_URI:     process.env.MONGO_URI,
    JWT_SECRET:    process.env.JWT_SECRET,
    EMAIL_USER:    process.env.EMAIL_USER,
    // RabbitMQ URI for message broker
    RABBITMQ_URI:  process.env.RABBITMQ_URI,
};

export default Object.freeze(_config);