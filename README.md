# Verbascope Social ML

Verbascope Social ML is a multi-service backend workspace for a social platform with machine learning support.

At the moment, the only implemented service is `auth-service`. The remaining folders are scaffolded for future work:

- `gateway/`
- `services/feed-service/`
- `services/ml-service/`
- `services/post-service/`
- `shared/`

## Current State

- `auth-service`: implemented and runnable
- `feed-service`: scaffolded only
- `post-service`: scaffolded only
- `ml-service`: scaffolded only
- `gateway`: scaffolded only
- `shared`: scaffolded only
- `docs/` and `docsmkdir/`: placeholder documentation folders

## Auth Service Overview

The auth service is an Express + MongoDB service that currently supports:

- user registration
- Google OAuth login with Passport
- JWT creation
- auth token cookie handling
- MongoDB persistence for users

### Implemented Flow

- `server.js` connects to MongoDB, mounts the auth routes, and starts the service on port `3000`
- `src/app.js` sets up Express, request logging, JSON parsing, cookie parsing, and Passport initialization
- `src/config/passport.js` configures the Google strategy
- `src/controller/auth.controller.js` handles local registration and Google callback login
- `src/routes/auth.routes.js` exposes the auth endpoints

## API Endpoints

Base path:

```text
/api/auth
```

### Register a User

```http
POST /api/auth/register
```

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

Validation rules:

- `email` must be a valid email address
- `password` must be at least 6 characters long
- `fullname.firstName` is required
- `fullname.lastName` is required

### Google Login

```http
GET /api/auth/google
```

Redirects the user to Google for authentication.

### Google Callback

```http
GET /api/auth/google/callback
```

Google redirects here after login. The service creates or links the user, issues a JWT, and sets a `token` cookie.

### Google Failure

```http
GET /api/auth/google/failure
```

Returns a 401 response if Google authentication fails.

## Environment Variables

The auth service reads its local environment from `services/auth-service/.env`.

Required:

- `MONGO_URI`

Optional:

- `JWT_SECRET` - defaults to `dev_jwt_secret`
- `GOOGLE_CLIENT_ID` or legacy `CLIENT_ID`
- `GOOGLE_CLIENT_SECRET` or legacy `CLIENT_SECRET`
- `GOOGLE_CALLBACK_URL` - defaults to `http://localhost:3000/api/auth/google/callback`

## Run the Auth Service

From `services/auth-service`:

```bash
npm install
npm run dev
```

Or start it directly:

```bash
node server.js
```

The service runs on port `3000`.

## Project Structure

```text
verbascope-social-ml/
├── about.md
├── README.md
├── docs/
├── docsmkdir/
├── gateway/
├── services/
│   ├── auth-service/
│   │   ├── .env
│   │   ├── package.json
│   │   ├── package-lock.json
│   │   ├── server.js
│   │   └── src/
│   │       ├── app.js
│   │       ├── config/
│   │       │   ├── config.js
│   │       │   └── passport.js
│   │       ├── controller/
│   │       │   └── auth.controller.js
│   │       ├── db/
│   │       │   └── db.js
│   │       ├── middlewares/
│   │       │   └── validation.middleware.js
│   │       ├── model/
│   │       │   └── user.model.js
│   │       └── routes/
│   │           └── auth.routes.js
│   ├── feed-service/
│   ├── ml-service/
│   └── post-service/
└── shared/
```

## Notes

- `auth-service` is the only active implementation right now.
- The other service folders are placeholders for future feature work.
- For a folder-by-folder explanation, see [about.md](about.md).