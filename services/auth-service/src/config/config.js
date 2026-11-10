import { config as dotenvConfig } from 'dotenv';
dotenvConfig();

// Render sets RENDER=true automatically, so cookies become SameSite=None;
// Secure there even if NODE_ENV was never configured in the dashboard.
const IS_PROD = process.env.NODE_ENV === 'production' || Boolean(process.env.RENDER);

if (IS_PROD && !process.env.JWT_SECRET) {
    console.warn('⚠️  JWT_SECRET is not set in production - using insecure dev fallback!');
}

const config = {
    PORT: Number(process.env.PORT) || 3000,
    IS_PROD,
    CLIENT_URL: (process.env.CLIENT_URL || 'http://localhost:3002').replace(/\/+$/, ''),

    MONGO_URI:     process.env.MONGO_URI,
    JWT_SECRET:    process.env.JWT_SECRET || 'dev_jwt_secret',
    JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
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