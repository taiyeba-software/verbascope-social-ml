import { config as dotenvConfig } from 'dotenv';

dotenvConfig();

const _config = {
    MONGO_URI:     process.env.MONGO_URI,
    JWT_SECRET:    process.env.JWT_SECRET,

    // Google OAuth2 / Nodemailer credentials
    CLIENT_ID:     process.env.CLIENT_ID,
    CLIENT_SECRET: process.env.CLIENT_SECRET,
    REFRESH_TOKEN: process.env.REFRESH_TOKEN,
    ACCESS_TOKEN:  process.env.ACCESS_TOKEN,
    EMAIL_USER:    process.env.EMAIL_USER,
};

export default Object.freeze(_config);