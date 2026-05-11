import dotenv from 'dotenv';
dotenv.config();

const config = {
    MONGO_URI:   process.env.MONGO_URI,                          // Atlas non-SRV URI from .env
    rabbitUri:   process.env.RABBITMQ_URI  || 'amqp://localhost:5672',
    jwtSecret:   process.env.JWT_SECRET,                         // must match auth-service!
    port:        parseInt(process.env.PORT) || 3003,
};

export default config;