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
