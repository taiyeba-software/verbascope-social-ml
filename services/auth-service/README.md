# Auth Service

Auth service for Verbascope Social ML. Responsible for user registration, email/password login, Google OAuth, JWT cookie issuance and publishing `user_created` events to RabbitMQ.

This README documents local setup, environment variables, important CORS/cookie dev notes, and available endpoints.

## Quick start

1. From `services/auth-service` install deps:

```bash
npm install
```

2. Create a `.env` (see `Environment` below).

3. Run in development:

```bash
npm run dev   # uses nodemon
```

Or production-style:

```bash
npm start
```

The service listens on port `3000` (see `server.js`). Routes are mounted under `/api/auth`.

## Environment

Configure `services/auth-service/.env` with the following values (example values shown):

```env
MONGO_URI=mongodb://localhost:27017/verbascope
RABBITMQ_URI=amqp://localhost:5672
JWT_SECRET=super_secret_key
CLIENT_ID=<google_client_id>
CLIENT_SECRET=<google_client_secret>
GOOGLE_CALLBACK_URL=http://localhost:3000/api/auth/google/callback
CLIENT_URL=http://localhost:3002   # frontend URL used for redirects
```

`src/config/config.js` reads these variables. The code includes sensible defaults for local development.

## Important development notes (CORS & Cookies)

These are critical for Google OAuth to work reliably in local Chrome:

- CORS: the server uses an explicit allowlist for local origins. Confirm your frontend origin is allowed (e.g. `http://localhost:3002`, `http://127.0.0.1:3002`). CORS must be configured with `credentials: true` so cookies are permitted cross-origin.
- Cookies: for local HTTP development the service must set cookies with `secure: false` and `sameSite: 'lax'` (or `lax` by default in the code). In production (HTTPS) cookies should be `secure: true` and `sameSite: 'none'` to support cross-site redirects.

Current implementation sets cookie options to be environment-aware. If you hit Chrome issues, verify cookies in DevTools → Application → Cookies for `localhost:3000` and ensure the cookie `token` is present after the OAuth callback.

## Endpoints

Base path: `/api/auth`

- `POST /api/auth/register` — register with `{ email, password, fullname: { firstName, lastName } }`.
  - On success: creates user, publishes `user_created`, sets `token` cookie (httpOnly) and returns user data (password stripped).

- `POST /api/auth/login` — login with `{ email, password }`.
  - On success: sets `token` cookie and returns user data.

- `GET /api/auth/google` — start Google OAuth (Passport).

- `GET /api/auth/google/callback` — OAuth callback. On success sets `token` cookie and redirects to `CLIENT_URL/feed` (defaults to `http://localhost:3002/feed`). On failure, redirects to `/api/auth/google/failure`.

- `GET /api/auth/google/failure` — returns 401 + JSON error.

- `GET /api/auth/me` — protected endpoint. Reads JWT from `token` cookie, verifies it, fetches fresh user from MongoDB and returns `{ success: true, user }`.

## OAuth flow (high level)

1. Frontend navigates the browser to `GET http://localhost:3000/api/auth/google`.
2. Server (Passport) redirects to Google consent page.
3. User signs in with Google and Google redirects back to `GOOGLE_CALLBACK_URL` (server route `/api/auth/google/callback`).
4. Server finds/creates the user, signs a JWT, sets the `token` httpOnly cookie and redirects the browser to the frontend (e.g. `http://localhost:3002/feed`).
5. Frontend calls `GET /api/auth/me` with `credentials: 'include'` (or axios with `withCredentials`) to hydrate session.

## Testing checklist (local Chrome)

1. Start auth-service (`npm run dev`) and frontend (`next dev -p 3002`).
2. Open Chrome DevTools → Network & Application.
3. Load frontend login page; the app will call `GET /api/auth/me` (expected `401` on first visit).
4. Click "Continue with Google" — you should see the Google consent screen.
5. After signing in, the browser should redirect to `/feed` on the frontend.
6. Confirm `token` cookie appears under Application → Cookies → `localhost:3000` and `GET /api/auth/me` returns `200` with user data.

If you see `Not secure` browser warnings or Chrome blocking cookies, ensure cookie options for local dev are `secure: false` and `sameSite: 'lax'`, and that frontend requests use `credentials: 'include'`.

## RabbitMQ contract

Queue: `user_created` — payload:

```json
{
  "id": "<mongodb_user_id>",
  "email": "user@example.com",
  "fullname": { "firstName": "A", "lastName": "B" },
  "role": "user"
}
```

## Troubleshooting

- If Google consent doesn't appear in Chrome but works in VS Code embedded browser:
  - Confirm auth-service CORS allowlist includes the exact origin shown in the browser address bar (`localhost` vs `127.0.0.1` vs network IP).
  - Ensure frontend requests include credentials (`fetch` uses `credentials: 'include'`, axios uses `withCredentials: true`).
  - Check cookie `secure`/`sameSite` settings for local dev (see notes above).

- If `/api/auth/me` returns empty or `{}` in frontend logs, open Network tab and inspect the failing request and its response body.

## Files of interest

- `server.js` — mounts routes and starts server on port `3000`.
- `src/app.js` — Express app, CORS, cookie-parser, passport initialization.
- `src/config/passport.js` — GoogleStrategy and user linking/creation logic.
- `src/controller/auth.controller.js` — register, login, googleCallback and `GET /me` logic (places where the `token` cookie is set).
- `src/routes/auth.routes.js` — route definitions.

---

If you want, I can also add a short `curl` or `fetch` snippet to test `GET /api/auth/me` (including credentials) from the frontend context.
# Auth Service

This service handles user authentication for Verbascope Social ML.

It currently supports:

- Email/password registration
- Google OAuth login via Passport
- JWT cookie issuance after successful auth
- Publishing user creation events to RabbitMQ (`user_created` queue)

## Current Behavior

- Connects to MongoDB during startup (`src/db/db.js`)
- Connects to RabbitMQ during startup (`src/broker/rabbit.js`)
- Mounts auth routes under `/api/auth`
- Runs on port `3000` (hardcoded in `server.js`)
- If MongoDB is unavailable, the service still starts but logs a warning

## Tech Stack

- Node.js (ES modules)
- Express
- MongoDB + Mongoose
- Passport + `passport-google-oauth20`
- JWT (`jsonwebtoken`)
- `bcryptjs`
- `express-validator`
- RabbitMQ (`amqplib`)
- `cookie-parser`, `morgan`, `dotenv`

## Folder Structure

```text
services/auth-service/
├── server.js
├── package.json
├── .env
└── src/
    ├── app.js
    ├── broker/
    │   └── rabbit.js
    ├── config/
    │   ├── config.js
    │   └── passport.js
    ├── controller/
    │   └── auth.controller.js
    ├── db/
    │   └── db.js
    ├── middlewares/
    │   └── validation.middleware.js
    ├── model/
    │   └── user.model.js
    └── routes/
        └── auth.routes.js
```

## Setup

From `services/auth-service`:

```bash
npm install
```

Create/update `.env` with the required values.

## Environment Variables

Used by `src/config/config.js`:

- `MONGO_URI` (required for DB connectivity)
- `RABBITMQ_URI` (required for RabbitMQ connectivity)
- `JWT_SECRET` (optional, defaults to `dev_jwt_secret`)
- `GOOGLE_CLIENT_ID` (or fallback `CLIENT_ID`)
- `GOOGLE_CLIENT_SECRET` (or fallback `CLIENT_SECRET`)
- `GOOGLE_CALLBACK_URL` (optional, default: `http://localhost:3000/api/auth/google/callback`)

Example:

```env
MONGO_URI=mongodb://localhost:27017/verbascope
RABBITMQ_URI=amqp://localhost:5672
JWT_SECRET=super_secret_key
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_CALLBACK_URL=http://localhost:3000/api/auth/google/callback
```

## Run

Development:

```bash
npm run dev
```

Production-style:

```bash
npm start
```

## API

Base URL path: `/api/auth`

### 1. Register User

`POST /api/auth/register`

Request body:

```json
{
  "email": "user@example.com",
  "password": "secret123",
  "fullname": {
    "firstName": "Taiyeba",
    "lastName": "Islam"
  }
}
```

Validation:

- `email` must be a valid email
- `password` minimum length is 6
- `fullname.firstName` is required
- `fullname.lastName` is required

On success:

- Password is hashed with bcrypt
- User is created in MongoDB
- JWT is signed with `{ id, role }` and 2-day expiry
- `token` cookie is set (`httpOnly`, `sameSite: lax`)
- Event is published to RabbitMQ queue `user_created`
- Response returns user data without password

### 2. Start Google OAuth

`GET /api/auth/google`

Redirects user to Google consent screen.

### 3. Google OAuth Callback

`GET /api/auth/google/callback`

Behavior:

- Finds user by `googleID` or email
- If email user exists without `googleID`, links that account
- Otherwise creates a new Google-based user
- Signs JWT and sets `token` cookie
- Publishes `user_created` event to RabbitMQ
- Returns user data (without password)

### 4. Google OAuth Failure

`GET /api/auth/google/failure`

Returns:

- `401 Unauthorized`
- JSON: `{ success: false, message: 'Google authentication failed. Try again.' }`

### 5. Get Current Authenticated User

`GET /api/auth/me`

Protected route. Requires the `token` httpOnly cookie.

Behavior:

- Reads and verifies the JWT from the cookie in middleware
- Attaches the decoded payload to `req.user`
- Re-fetches the user from MongoDB with password excluded
- Returns the current user as JSON

Possible responses:

- `200 OK` with `{ success: true, user }`
- `401 Unauthorized` if the cookie is missing, invalid, expired, or the user no longer exists

## User Model Notes

The user schema includes:

- `email` (unique, required)
- `fullname.firstName` and `fullname.lastName` (required)
- `password` (required only when `googleID` is not set)
- `googleID` (optional)
- `role` (defaults to `"user"`)

## RabbitMQ Event Contract

Queue: `user_created`

Published payload shape:

```json
{
  "id": "<mongodb_user_id>",
  "email": "user@example.com",
  "fullname": {
    "firstName": "Taiyeba",
    "lastName": "Islam"
  },
  "role": "user"
}
```

## Important Implementation Notes

- The service exposes `POST /api/auth/login` for email/password login.
- RabbitMQ publish depends on a valid channel created at startup.
- Cookies are not marked `secure`; this is suitable for local HTTP development but should be reviewed for production HTTPS.
