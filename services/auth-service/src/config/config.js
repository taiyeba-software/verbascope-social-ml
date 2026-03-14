import {config as dotenvConfig} from 'dotenv';

dotenvConfig();

const config = {
    MONGO_URI: process.env.MONGO_URI,
    JWT_SECRET: process.env.JWT_SECRET || 'dev_jwt_secret',
};

export default config;