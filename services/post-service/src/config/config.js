import dotenv from 'dotenv';
dotenv.config();

const config = {
    MONGO_URI:   process.env.MONGO_URI,                          // Atlas non-SRV URI from .env
    rabbitUri:   process.env.RABBITMQ_URI  || 'amqp://localhost:5672',
    jwtSecret:   process.env.JWT_SECRET,                         // must match auth-service!
    port:        parseInt(process.env.PORT) || 3003,
    clientUrl:   process.env.CLIENT_URL || 'http://localhost:3002',

    IMAGEKIT_PUBLIC_KEY:   process.env.IMAGEKIT_PUBLIC_KEY,
    IMAGEKIT_PRIVATE_KEY:  process.env.IMAGEKIT_PRIVATE_KEY,
    IMAGEKIT_URL_ENDPOINT: process.env.IMAGEKIT_URL_ENDPOINT,
};

export default config;