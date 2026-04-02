# Auth Service

The auth service is the implemented backend service for Verbascope Social ML. It handles local user registration and Google OAuth login, then issues a JWT cookie for authenticated sessions.

## What It Does

- Registers new users with email, password, and fullname
- Supports Google login with Passport
- Links Google accounts to existing users when possible
- Signs JWTs with the service secret
- Stores the token in an HTTP-only cookie
- Persists users in MongoDB

## Tech Stack

- Node.js
- Express
- MongoDB with Mongoose
- JWT
- bcryptjs
- Passport Google OAuth 2.0
- express-validator

## Project Structure

```text
services/auth-service/
├── .env
├── package.json
├── server.js
└── src/
    ├── app.js
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

From this folder:

```bash
npm install
```

Make sure `.env` is filled in before running the service.

### Environment Variables

Required:

- `MONGO_URI`

Optional:

- `JWT_SECRET` - defaults to `dev_jwt_secret`
- `GOOGLE_CLIENT_ID` or legacy `CLIENT_ID`
- `GOOGLE_CLIENT_SECRET` or legacy `CLIENT_SECRET`
- `GOOGLE_CALLBACK_URL` - defaults to `http://localhost:3000/api/auth/google/callback`

## Run the Service

```bash
npm run dev
```

Or:

```bash
node server.js
```

The service listens on port `3000`.

## API Routes

Base path:

```text
/api/auth
```

### Register User

```http
POST /api/auth/register
```

Example body:

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

Validation rules:

- `email` must be valid
- `password` must be at least 6 characters
- `fullname.firstName` is required
- `fullname.lastName` is required

### Start Google Login

```http
GET /api/auth/google
```

Redirects the user to Google for authentication.

### Google Callback

```http
GET /api/auth/google/callback
```

Google redirects here after login. The service creates or links the user, generates a JWT, and sets the `token` cookie.

### Google Failure

```http
GET /api/auth/google/failure
```

Returns a 401 response if Google login fails.

## Response Behavior

### Registration

On success, the service returns the created user without the password field and sets a `token` cookie.

### Google Login

On success, the service returns the matched or created user without the password field and sets a `token` cookie.

## Notes

- The user model supports `googleID`, so email-based users can be linked later to Google accounts.
- The current service starts the auth router in `server.js` under `/api/auth`.
- MongoDB connection is required for normal startup.
