//import dependencies
import express from 'express';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import postsRoutes from './routes/posts.routes.js';

const defaultAllowedOrigins = [
	'http://localhost:3001',
	'http://127.0.0.1:3001',
	'http://localhost:3002',
	'http://127.0.0.1:3002',
	'http://localhost:3000',
	'http://127.0.0.1:3000',
];

// Merge in CLIENT_URL from the environment (e.g. the deployed frontend URL)
// so production origins aren't silently blocked by a hardcoded localhost-only list.
const allowlist = new Set(
	process.env.CLIENT_URL
		? [process.env.CLIENT_URL, ...defaultAllowedOrigins]
		: defaultAllowedOrigins
);

const cors = () => (req, res, next) => {
	const origin = req.headers.origin;

	if (!origin) {
		res.setHeader('Access-Control-Allow-Origin', '*');
		return next();
	}

	if (!allowlist.has(origin)) {
		return next(new Error(`CORS blocked: ${origin}`));
	}

	res.setHeader('Access-Control-Allow-Origin', origin);
	res.setHeader('Vary', 'Origin');
	res.setHeader('Access-Control-Allow-Credentials', 'true');
	res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
	res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');

	if (req.method === 'OPTIONS') {
		return res.sendStatus(204);
	}

	return next();
};

//initialize express app
const app = express();

//use middlewares
app.use(morgan('dev'));

// ── CORS (allowlist includes CLIENT_URL from environment) ─────────────────
app.use(cors());
app.use(express.json());
app.use(cookieParser());

// Mount post routes
app.use('/api/posts', postsRoutes);

//export app
export default app;