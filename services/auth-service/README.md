# Auth Service

**The login and account service for Verbascope Social ML.** Handles signing up, email/password login, "Sign in with Google," issuing secure login tokens, and announcing new users to the rest of the system.

---

## Simple Answers

This section explains the whole app in easy English.

- **What does each service do?**
  - `auth-service` handles sign up, login, Google login, and logout.
  - `post-service` handles post create, like/unlike, share, comment, and feed data.
  - `notification-service` sends notifications and emails.
  - `ml-service` is planned for future smart analysis work like sentiment or toxicity detection.

- **How does the auth flow work?**
  - The user sends email and password to the auth service.
  - The service checks the database.
  - If the data is correct, it creates a JWT token.
  - That token is stored in an `httpOnly` cookie named `token`.
  - The frontend uses that cookie to stay logged in.

- **How is a post created?**
  - This does not happen in the auth service.
  - The frontend sends the post data to the `post-service`.
  - The post service saves the post in MongoDB.
  - It then sends events to other services through RabbitMQ.

- **How does like/unlike work?**
  - This also happens in the `post-service`.
  - When a user likes a post, the service updates the like count and stores the user ID.
  - When the user unlikes it, the service removes that user ID and lowers the count.
  - The service also sends live updates and notification events.

- **How does RabbitMQ connect the services?**
  - RabbitMQ is the message system between services.
  - One service sends a message when something important happens.
  - Another service reads that message and does its own job.
  - For example, `auth-service` sends `user_created`, and `post-service` or `notification-service` can react to it.

- **Why is Socket.IO used?**
  - Socket.IO is used for real-time updates.
  - It lets the app show new likes, comments, shares, and notifications instantly.
  - The user does not need to refresh the page.

- **Why was MongoDB chosen?**
  - MongoDB is a good fit for social media data because the data changes a lot.
  - Users, posts, comments, and notifications do not all have the same shape.
  - MongoDB is flexible and easy to scale.

- **Why microservices instead of one monolith?**
  - Each service has one clear job.
  - It is easier to build, test, and fix one part without breaking everything.
  - A busy part of the app can be scaled separately.
  - The auth, post, notification, and ML features can grow on their own.

- **Where will the ML service go in the future?**
  - The ML service will stay as a separate service.
  - It will connect to the other services through API calls or RabbitMQ.
  - Later, it can analyze posts and give results like sentiment, emotion, or toxicity scores.

---

## 🚀 Quick Start

### 1. Install Dependencies

```bash
cd services/auth-service
npm install
```

### 2. Configure Environment

Create a `.env` file with the following values:

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

**Development (auto-restarts when you edit code):**
```bash
npm run dev
```

**Production:**
```bash
npm start
```

The service runs on **port 3000**, and all its routes start with `/api/auth`.

---

## 🌐 Environment Variables

| Variable | Required? | Default | What it's for |
|----------|----------|---------|-------|
| `MONGO_URI` | Yes | — | Address of your MongoDB database |
| `RABBITMQ_URI` | Yes | — | Address of your RabbitMQ messaging service |
| `JWT_SECRET` | No | `dev_jwt_secret` | Secret key used to sign login tokens |
| `GOOGLE_CLIENT_ID` | Yes | — | ID for "Sign in with Google" |
| `GOOGLE_CLIENT_SECRET` | Yes | — | Secret key for "Sign in with Google" |
| `GOOGLE_CALLBACK_URL` | No | `http://localhost:3000/api/auth/google/callback` | Where Google sends users back to after they sign in |
| `CLIENT_URL` | No | `http://localhost:3002` | Address of the frontend website, used after Google login |
| `NODE_ENV` | No | `development` | Tells the app whether it's running in development or production (changes cookie security) |

---

## 🔒 CORS & Cookie Configuration

CORS is a security rule that controls which websites are allowed to send requests to this service. This service only accepts requests from a specific, approved list of addresses:

```
Allowed origins:
- http://localhost:3002
- http://127.0.0.1:3002
- http://localhost:3000
- http://127.0.0.1:3000
```

**How login cookies behave:**
- **In development (plain HTTP):** the cookie is set to be less strict, so it works on `localhost`
- **In production (secure HTTPS):** the cookie is set to be more strict and secure

For the frontend to actually receive and send this cookie, it must include credentials in its requests — this means using `credentials: 'include'` if using `fetch`, or `withCredentials: true` if using `axios`.

### Troubleshooting Cookies

If login cookies aren't showing up or being sent:
1. Open your browser's Developer Tools → Application tab → Cookies, and check for `localhost:3000`
2. Confirm a cookie named `token` appears after logging in
3. Make sure the frontend code includes `credentials: 'include'` in its requests
4. Double-check that the website address matches exactly (e.g. `localhost` and `127.0.0.1` are treated as different addresses)

---

## 📡 API Endpoints

All endpoints below start with: `/api/auth`

### 1. Register a New User

**`POST /api/auth/register`**

Creates a new account using an email and password.

**Request body:**
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

**Rules the request must follow:**
- `email` must look like a real email address
- `password` must be at least 6 characters
- `fullname.firstName` is required
- `fullname.lastName` is required

**Successful response (201 Created):**
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

**What happens behind the scenes when this succeeds:**
- The password is scrambled (hashed) for security before saving
- A new user is saved to the database
- A secure login token is created, valid for 2 days
- A `token` cookie is sent back to the browser (it's "httpOnly," meaning JavaScript on the page can't read it — extra security)
- A message is sent to other services announcing that a new user was created
- The password itself is never included in the response

---

### 2. Log In

**`POST /api/auth/login`**

Logs a user in with their email and password.

**Request body:**
```json
{
  "email": "user@example.com",
  "password": "secret123"
}
```

**Rules:**
- `email` is required and must be a valid email
- `password` is required

**Successful response (200 OK):**
```json
{
  "success": true,
  "message": "Login successful",
  "user": { ... }
}
```

**If login fails (401 Unauthorized):**
```json
{
  "success": false,
  "message": "Invalid email or password"
}
```

---

### 3. Start Google Sign-In

**`GET /api/auth/google`**

Begins the "Sign in with Google" process by sending the user to Google's own sign-in screen.

**Information requested from Google:** basic profile info and email address

---

### 4. Google Sign-In Callback

**`GET /api/auth/google/callback`**

This is where Google sends the user back to after they approve the sign-in.

**What happens here:**
- The service checks if this Google account already matches an existing user (by Google ID or email)
- If someone already registered with that email using a password, their account gets linked to Google automatically
- Otherwise, a brand-new account is created
- A login token and `token` cookie are issued
- If this is a brand-new user, an announcement is sent to other services
- The user is then sent back to the frontend, to the page `CLIENT_URL/feed` (for example, `http://localhost:3002/feed`)

**If something goes wrong:** the user is redirected to `/api/auth/google/failure`

---

### 5. Google Sign-In Failure

**`GET /api/auth/google/failure`**

Shown when the Google sign-in process doesn't succeed.

**Response (401 Unauthorized):**
```json
{
  "success": false,
  "message": "Google authentication failed. Try again."
}
```

---

### 6. Get the Currently Logged-In User

**`GET /api/auth/me`**

A protected endpoint (you must be logged in) that returns your own account details.

**What's required:**
- A `token` cookie must be present
- That cookie must contain a valid, non-expired login token

**Successful response (200 OK):**
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

**If not logged in (401 Unauthorized):**
```json
{
  "success": false,
  "message": "No token provided. Please log in."
}
```

---

### 7. Log Out

**`POST /api/auth/logout`**

Logs the user out by clearing their login cookie.

**Requirement:** a `token` cookie must be present (you must already be logged in)

**Successful response (200 OK):**
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

---

## 🔁 Google Sign-In Flow (Step by Step)

```
1. The frontend sends the user to GET /api/auth/google
   ↓
2. The auth service redirects them to Google's sign-in screen
   ↓
3. The user signs in with their Google account
   ↓
4. Google sends them back to GET /api/auth/google/callback
   ↓
5. The auth service finds or creates their account, and sets a login cookie
   ↓
6. The auth service sends them to CLIENT_URL/feed
   ↓
7. The frontend calls GET /api/auth/me (including the cookie) to confirm login
   ↓
8. The user is now fully logged in
```

---

## 🗄️ User Model (What's Stored for Each User)

```typescript
{
  _id: ObjectId,
  email: string (unique, required),
  fullname: {
    firstName: string (required),
    lastName: string (required)
  },
  password: string (required only if they didn't sign up with Google),
  googleID: string (optional),
  role: string (default: "user"),
  
  // Who follows them, and who they follow
  followers: [ObjectId],
  following: [ObjectId],
  
  // Interests built up over time by the Post Service, based on activity
  interests: Map<string, number>,
  
  createdAt: Date,
  updatedAt: Date
}
```

---

## 📬 RabbitMQ Events

### `user_created` Queue

This message is sent out after someone successfully registers, or signs in with Google for the first time.

**Message contents:**
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

**Queue details:**
- Marked as "durable," meaning the message survives even if RabbitMQ restarts
- Sent as a JSON-formatted text message

---

## ✅ Testing Checklist

### Local Setup
1. Start the auth service: `npm run dev`
2. Start the frontend: `next dev -p 3002`
3. Open your browser's Developer Tools (Network and Application tabs)

### Email/Password Flow
1. Go to the login page
2. Submit the registration form with valid details
3. Confirm a `token` cookie shows up in Developer Tools
4. Confirm that calling `GET /api/auth/me` returns a 200 response with user data
5. Log out and confirm the cookie disappears

### Google Sign-In Flow
1. Click "Continue with Google"
2. Confirm Google's sign-in screen appears
3. Sign in with a Google account
4. Confirm you're redirected to `/feed` on the frontend
5. Confirm a `token` cookie appears in Developer Tools
6. Confirm that calling `GET /api/auth/me` returns a 200 response with user data

### Troubleshooting
- **Cookie not being sent:** Make sure the frontend uses `credentials: 'include'`
- **Cookie not being saved:** Check Developer Tools → Application → Cookies to see if it's there
- **CORS error:** Confirm the frontend's exact address is in the allowed list
- **Google sign-in redirect fails:** Confirm the `CLIENT_URL` setting is correct
- **RabbitMQ messages not being sent:** Confirm `RABBITMQ_URI` is correct and RabbitMQ is actually running

---

## 📁 Project Structure

```
auth-service/
├── server.js                 # Where the service starts
├── package.json              # List of dependencies
├── .env                       # Environment settings
└── src/
    ├── app.js                # Sets up the web server (CORS, middleware)
    ├── broker/
    │   └── rabbit.js         # Connects to and sends messages via RabbitMQ
    ├── config/
    │   ├── config.js         # Holds environment settings
    │   └── passport.js       # Sets up Google sign-in
    ├── controller/
    │   └── auth.controller.js # Handles register, login, Google sign-in, logout
    ├── db/
    │   └── db.js             # Connects to MongoDB
    ├── middlewares/
    │   ├── auth.middleware.js # Checks the login token from cookies
    │   └── validation.middleware.js # Checks that requests have valid data
    ├── model/
    │   └── user.model.js      # Describes what a "user" looks like in the database
    └── routes/
        └── auth.routes.js     # Lists all the available URLs
```

---

## 🔑 Key Implementation Details

### Login Tokens & Cookies
- The login token contains the user's ID and role, and expires after 2 days
- The cookie is "httpOnly," meaning page scripts can't read it — this protects against certain attacks
- Whether the cookie requires HTTPS depends on the environment:
  - Development: looser security, works on plain HTTP
  - Production: strict security, requires HTTPS

### Linking Google Accounts
- If someone first signs up using email/password, and later signs in with Google using the *same* email, their two accounts are automatically linked into one
- Only brand-new Google sign-ups trigger the "new user" announcement — linking an existing account does not

### Password Handling
- Passwords are scrambled (hashed) using bcrypt before being saved, so the real password is never stored
- Passwords are never included in any API response
- Users who sign up with Google don't need a password at all

### Reliability
- The service will still start even if MongoDB isn't available (it just logs a warning)
- The service will still start even if RabbitMQ isn't available (it just skips sending announcements)

---

## 📦 Dependencies

```json
{
  "amqplib": "^1.0.3",           // Connects to RabbitMQ
  "bcryptjs": "^3.0.3",          // Scrambles passwords for safe storage
  "cookie-parser": "^1.4.7",     // Reads cookies from requests
  "cors": "^2.8.6",              // Controls which websites can send requests here
  "dotenv": "^17.3.1",           // Loads settings from the .env file
  "express": "^5.2.1",           // Builds the web server
  "express-validator": "^7.3.1", // Checks that incoming data is valid
  "jsonwebtoken": "^9.0.3",      // Creates and checks login tokens
  "mongoose": "^9.3.0",          // Connects to and works with MongoDB
  "morgan": "^1.10.1",           // Logs incoming requests
  "passport": "^0.7.0",          // Handles login strategies
  "passport-google-oauth20": "^2.0.0" // Adds "Sign in with Google" support
}
```

---

## 🧰 Development Notes

### Running Tests
No tests are set up yet. To add tests, install Jest and configure it in `package.json`.

### Linting
No code-quality checker (linter) is set up yet. Adding ESLint is recommended.

### Auto-Restart While Developing
The development mode uses a tool called Nodemon, which automatically restarts the service whenever you change code:
```json
"dev": "npx nodemon server.js"
```

### Common Issues & Fixes

| Issue | Likely Cause | How to Fix |
|-------|-------|----------|
| "Cannot find module" | Dependencies aren't installed yet | Run `npm install` |
| "ECONNREFUSED: MongoDB" | MongoDB isn't running | Start your MongoDB service |
| "ECONNREFUSED: RabbitMQ" | RabbitMQ isn't running | Start your RabbitMQ service |
| CORS errors | The frontend's address isn't in the allowed list | Check the allowed list in `src/app.js` |
| Cookie not being sent | Frontend isn't including credentials | Use `credentials: 'include'` (fetch) or `withCredentials: true` (axios) |
| Google sign-in fails | Google settings or callback address are wrong | Double-check `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `GOOGLE_CALLBACK_URL` in `.env` |
| Login token rejected | The token expired, or the secret key doesn't match | Check the `JWT_SECRET` value in `.env` |