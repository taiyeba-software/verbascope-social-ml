import { config as dotenvConfig } from 'dotenv';
dotenvConfig();

const config = {
    MONGO_URI:     process.env.MONGO_URI,
    JWT_SECRET:    process.env.JWT_SECRET || 'dev_jwt_secret',
    GOOGLE_CLIENT_ID:     process.env.GOOGLE_CLIENT_ID || process.env.CLIENT_ID,
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET || process.env.CLIENT_SECRET,
    GOOGLE_CALLBACK_URL:  process.env.GOOGLE_CALLBACK_URL
                          || 'http://localhost:3000/api/auth/google/callback',
    RABBITMQ_URI:  process.env.RABBITMQ_URI,  


    // ── ImageKit (avatar uploads) ──
    IMAGEKIT_PUBLIC_KEY:   process.env.IMAGEKIT_PUBLIC_KEY,
    IMAGEKIT_PRIVATE_KEY:  process.env.IMAGEKIT_PRIVATE_KEY,
    IMAGEKIT_URL_ENDPOINT: process.env.IMAGEKIT_URL_ENDPOINT,
};

export default config;