//import dependencies
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';

//initialize express app
const app = express();

//use middlewares
app.use(morgan('dev'));

// ── CORS (explicit allowlist for local development) ─────────────────
app.use(
	cors({
		origin: (origin, callback) => {
			// Allow requests with no origin (Postman, server-to-server)
			if (!origin) return callback(null, true);

			const allowed = [
				'http://localhost:3002',
				'http://127.0.0.1:3002',
				'http://localhost:3000',
				'http://127.0.0.1:3000',
			];

			if (allowed.includes(origin)) {
				return callback(null, true);
			}

			return callback(new Error(`CORS blocked: ${origin}`));
		},
		credentials: true,
		methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
		allowedHeaders: ['Content-Type', 'Authorization'],
	})
);
app.use(express.json());
app.use(cookieParser());

//export app
export default app;