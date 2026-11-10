// import dependencies
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import config from './config/config.js';
import passport from './config/passport.js';

// initialize express app
const app = express();

// Render terminates TLS at its proxy; trust it so req.secure / req.ip are right.
app.set('trust proxy', 1);

app.use(morgan('dev'));

const normalize = (url) => url.trim().replace(/\/+$/, '');

const defaultAllowedOrigins = [
  'http://localhost:3002',
  'http://127.0.0.1:3002',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
];

// Optional extra origins: ALLOWED_ORIGINS="https://a.vercel.app,https://b.vercel.app"
const extraOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .filter(Boolean)
  .map(normalize);

const allowedOrigins = new Set([
  config.CLIENT_URL,
  ...extraOrigins,
  ...defaultAllowedOrigins,
]);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow Postman, UptimeRobot and server-to-server requests
      if (!origin) return callback(null, true);

      if (allowedOrigins.has(normalize(origin))) {
        return callback(null, true);
      }

      return callback(new Error(`CORS blocked: ${origin}`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

app.use(express.json());
app.use(cookieParser());
app.use(passport.initialize());

export default app;