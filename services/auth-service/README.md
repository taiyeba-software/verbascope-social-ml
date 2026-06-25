# Auth Service

Authentication microservice for Verbascope Social ML. Handles user registration, email/password login, Google OAuth 2.0, JWT cookie issuance, and publishes `user_created` events to RabbitMQ.

## Quick Start

### 1. Install Dependencies

```bash
cd services/auth-service
npm install
```

### 2. Configure Environment

Create a `.env` file with the following variables:

```env
MONGO_URI=mongodb://localhost:27017/verbascope
RABBITMQ_URI=amqp://localhost:5672
JWT_SECRET=your_jwt_secret_key
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_CALLBACK_URL=http://localhost:3000/api/auth/google/callback
CLIENT_URL=http://localhost:3002
NODE_ENV=development
```

### 3. Run the Service

**Development (with hot reload):**
```bash
npm run dev
```

**Production:**
```bash
npm start
```

The service runs on **port 3000** and exposes routes under `/api/auth`.

## Environment Variables

| Variable | Required | Default | Notes |
|----------|----------|---------|-------|
| `MONGO_URI` | Yes | — | MongoDB connection string |
| `RABBITMQ_URI` | Yes | — | RabbitMQ connection string |
| `JWT_SECRET` | No | `dev_jwt_secret` | Secret for signing JWTs |
| `GOOGLE_CLIENT_ID` | Yes | — | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Yes | — | Google OAuth client secret |
| `GOOGLE_CALLBACK_URL` | No | `http://localhost:3000/api/auth/google/callback` | OAuth callback URL |
| `CLIENT_URL` | No | `http://localhost:3002` | Frontend URL for post-OAuth redirects |
| `NODE_ENV` | No | `development` | Environment mode (affects cookie security) |

## CORS & Cookie Configuration

The service uses an **explicit origin allowlist** for CORS:

```
Allowed origins:
- http://localhost:3002
- http://127.0.0.1:3002
- http://localhost:3000
- http://127.0.0.1:3000
```

**Cookie behavior:**
- **Development (HTTP):** `secure: false`, `sameSite: 'lax'`
- **Production (HTTPS):** `secure: true`, `sameSite: 'none'`

Frontend requests must include `credentials: 'include'` (fetch) or `withCredentials: true` (axios) for cookies to be sent cross-origin.

### Troubleshooting Cookies

If cookies aren't being set or transmitted:
1. Check DevTools → Application → Cookies for `localhost:3000`
2. Verify the `token` cookie is present after login/OAuth
3. Ensure frontend uses `credentials: 'include'` in requests
4. Confirm CORS origin matches exactly (e.g., `localhost` vs `127.0.0.1`)

## API Endpoints

Base URL path: `/api/auth`

### 1. Register User

**`POST /api/auth/register`**

Creates a new user with email/password.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "secret123",
  "fullname": {
    "firstName": "John",
    "lastName": "Doe"
  }
}
```

**Validation:**
- `email` must be a valid email address
- `password` minimum 6 characters
- `fullname.firstName` required
- `fullname.lastName` required

**Response (201 Created):**
```json
{
  "success": true,
  "message": "User registered successfully",
  "user": {
    "_id": "user_id",
    "email": "user@example.com",
    "fullname": { "firstName": "John", "lastName": "Doe" },
    "role": "user",
    "followers": [],
    "following": [],
    "interests": {},
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
}
```

**On success:**
- Password hashed with bcrypt
- User created in MongoDB
- JWT signed with `{ id, role }` and 2-day expiry
- `token` cookie set (`httpOnly`, environment-aware `secure`/`sameSite`)
- Event published to RabbitMQ queue `user_created`
- User data returned without password

---

### 2. Login User

**`POST /api/auth/login`**

Authenticates user with email/password.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "secret123"
}
```

**Validation:**
- `email` required and must be valid
- `password` required

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Login successful",
  "user": { ... }
}
```

**Response (401 Unauthorized):**
```json
{
  "success": false,
  "message": "Invalid email or password"
}
```

---

### 3. Start Google OAuth

**`GET /api/auth/google`**

Initiates Google OAuth flow. Redirects user to Google consent screen.

**Scopes requested:** `profile`, `email`

---

### 4. Google OAuth Callback

**`GET /api/auth/google/callback`**

Google redirects here after user consent.

**Behavior:**
- Finds user by `googleID` or `email`
- If email user exists without `googleID`, links that account
- Otherwise creates new Google-based user
- Sets JWT and `token` cookie
- Publishes `user_created` event to RabbitMQ (only for new users)
- Redirects to `CLIENT_URL/feed` (e.g., `http://localhost:3002/feed`)

**On failure:** Redirects to `/api/auth/google/failure`

---

### 5. Google OAuth Failure

**`GET /api/auth/google/failure`**

Returns when Google OAuth flow fails.

**Response (401 Unauthorized):**
```json
{
  "success": false,
  "message": "Google authentication failed. Try again."
}
```

---

### 6. Get Current User

**`GET /api/auth/me`**

Protected endpoint. Returns authenticated user's data.

**Requirements:**
- `token` httpOnly cookie must be present
- Cookie value must be a valid, non-expired JWT

**Response (200 OK):**
```json
{
  "success": true,
  "user": {
    "_id": "user_id",
    "email": "user@example.com",
    "fullname": { "firstName": "John", "lastName": "Doe" },
    "googleID": null,
    "role": "user",
    "followers": [],
    "following": [],
    "interests": {},
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
}
```

**Response (401 Unauthorized):**
```json
{
  "success": false,
  "message": "No token provided. Please log in."
}
```

---

### 7. Logout

**`POST /api/auth/logout`**

Clears the authentication cookie and logs out the user.

**Requirements:**
- `token` httpOnly cookie must be present

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

---

## OAuth Flow Diagram

```
1. Frontend navigates to GET /api/auth/google
   ↓
2. Auth service redirects to Google consent screen
   ↓
3. User signs in with Google
   ↓
4. Google redirects to GET /api/auth/google/callback
   ↓
5. Auth service finds/creates user, sets token cookie
   ↓
6. Auth service redirects to CLIENT_URL/feed
   ↓
7. Frontend calls GET /api/auth/me with credentials
   ↓
8. Frontend is authenticated
```

---

## User Model

```typescript
{
  _id: ObjectId,
  email: string (unique, required),
  fullname: {
    firstName: string (required),
    lastName: string (required)
  },
  password: string (required if no googleID),
  googleID: string (optional),
  role: string (default: "user"),
  
  // Social graph
  followers: [ObjectId],
  following: [ObjectId],
  
  // Behavioral interests (built by post-service via RabbitMQ)
  interests: Map<string, number>,
  
  createdAt: Date,
  updatedAt: Date
}
```

---

## RabbitMQ Events

### `user_created` Queue

Published after successful user registration or Google OAuth for new users.

**Payload:**
```json
{
  "id": "mongodb_user_id",
  "email": "user@example.com",
  "fullname": {
    "firstName": "John",
    "lastName": "Doe"
  },
  "role": "user"
}
```

**Queue properties:**
- Durable: `true` (survives RabbitMQ restart)
- Message format: JSON string

---

## Testing Checklist

### Local Setup
1. Start auth-service: `npm run dev`
2. Start frontend: `next dev -p 3002`
3. Open browser DevTools (Network & Application tabs)

### Email/Password Flow
1. Navigate to login page
2. Submit registration form with valid data
3. Confirm `token` cookie appears in DevTools
4. Confirm `GET /api/auth/me` returns 200 with user data
5. Logout and confirm cookie is cleared

### Google OAuth Flow
1. Click "Continue with Google"
2. Confirm Google consent screen appears
3. Sign in with Google account
4. Confirm redirect to `/feed` on frontend
5. Confirm `token` cookie in DevTools
6. Confirm `GET /api/auth/me` returns 200 with user data

### Troubleshooting
- **Cookie not sent:** Ensure frontend uses `credentials: 'include'`
- **Cookie not saved:** Check DevTools → Application → Cookies for presence
- **CORS error:** Verify frontend origin is in allowlist (check exact hostname)
- **OAuth redirect fails:** Confirm `CLIENT_URL` environment variable is set
- **RabbitMQ events not published:** Verify `RABBITMQ_URI` is correct and RabbitMQ is running

---

## Project Structure

```
auth-service/
├── server.js                 # Server entry point
├── package.json              # Dependencies
├── .env                       # Environment variables
└── src/
    ├── app.js                # Express app setup (CORS, middleware)
    ├── broker/
    │   └── rabbit.js         # RabbitMQ connection & publish logic
    ├── config/
    │   ├── config.js         # Environment config object
    │   └── passport.js       # Google OAuth strategy setup
    ├── controller/
    │   └── auth.controller.js # Register, login, OAuth, logout handlers
    ├── db/
    │   └── db.js             # MongoDB connection
    ├── middlewares/
    │   ├── auth.middleware.js # JWT verification from cookies
    │   └── validation.middleware.js # Express-validator rules
    ├── model/
    │   └── user.model.js      # Mongoose user schema
    └── routes/
        └── auth.routes.js     # Route definitions
```

---

## Key Implementation Details

### JWT & Cookies
- JWT includes `{ id, role }` payload with 2-day expiry
- Cookie is `httpOnly` (not accessible to JavaScript) for security
- Cookie `secure` flag depends on `NODE_ENV`:
  - Development: `secure: false`, `sameSite: 'lax'`
  - Production: `secure: true`, `sameSite: 'none'`

### Google OAuth Linking
- If user registers with email, then signs in with Google using same email, the accounts are automatically linked
- Only new Google OAuth users trigger `user_created` event (not account links)

### Password Handling
- Passwords hashed with bcrypt (10 salt rounds)
- Passwords excluded from response objects
- Password required only for non-Google users

### Database Resilience
- Service starts even if MongoDB is unavailable (logs warning)
- Service starts even if RabbitMQ is unavailable (events skipped)

---

## Dependencies

```json
{
  "amqplib": "^1.0.3",           // RabbitMQ client
  "bcryptjs": "^3.0.3",          // Password hashing
  "cookie-parser": "^1.4.7",     // Parse cookies
  "cors": "^2.8.6",              // CORS middleware
  "dotenv": "^17.3.1",           // Environment variables
  "express": "^5.2.1",           // Web framework
  "express-validator": "^7.3.1", // Input validation
  "jsonwebtoken": "^9.0.3",      // JWT signing/verifying
  "mongoose": "^9.3.0",          // MongoDB ODM
  "morgan": "^1.10.1",           // HTTP request logging
  "passport": "^0.7.0",          // Authentication middleware
  "passport-google-oauth20": "^2.0.0" // Google OAuth strategy
}
```

---

## Development Notes

### Running Tests
No tests configured yet. To add tests, install Jest and configure in `package.json`.

### Linting
No linter configured. Consider adding ESLint for code quality.

### Nodemon
Development uses nodemon for auto-reload. Configuration in `package.json`:
```json
"dev": "npx nodemon server.js"
```

### Common Issues & Solutions

| Issue | Cause | Solution |
|-------|-------|----------|
| "Cannot find module" | Dependencies not installed | Run `npm install` |
| "ECONNREFUSED: MongoDB" | MongoDB not running | Start MongoDB service |
| "ECONNREFUSED: RabbitMQ" | RabbitMQ not running | Start RabbitMQ service |
| CORS errors | Frontend origin not in allowlist | Check `src/app.js` allowlist |
| Cookie not sent | `credentials` not set on frontend | Use `credentials: 'include'` (fetch) or `withCredentials: true` (axios) |
| OAuth fails | Google credentials or callback URL incorrect | Verify `.env` GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_CALLBACK_URL |
| Token rejected | JWT expired or secret mismatch | Check `JWT_SECRET` in `.env` |


