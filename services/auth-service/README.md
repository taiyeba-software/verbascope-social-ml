# Auth Service

This service is the authentication and user-profile backbone for the VerbaScope platform. It handles user sign-up, login, JWT-based session management, Google OAuth authentication, avatar uploads, follow relationships, and user-profile syncing to downstream services through RabbitMQ.

## What this service does

- Registers and authenticates users using email/password
- Issues JWT tokens stored in an HTTP-only cookie
- Supports Google OAuth login and account linking
- Returns the authenticated user profile and manages protected profile updates
- Supports follow/unfollow actions and social graph lookups
- Uploads user avatars to ImageKit and cleans up old avatars
- Publishes user events such as user_created and user_updated for other services

## Tech stack

- Node.js + Express
- MongoDB + Mongoose
- JWT + Passport.js
- RabbitMQ via amqplib
- Multer + ImageKit for avatar handling
- dotenv, cookie-parser, cors, morgan

## Project files and their purpose

### Root files

- package.json: Defines the service metadata, dependencies, and scripts such as npm run dev and npm start.
- server.js: Bootstraps the service, connects to MongoDB and RabbitMQ, mounts authentication and user routes, and starts the Express server on port 3000.
- README.md: Service documentation and module overview.

### Application setup

- src/app.js: Creates the Express app, enables CORS, JSON parsing, cookie parsing, request logging, and Passport initialization.

### Configuration and environment

- src/config/config.js: Loads environment variables and exposes configuration values for MongoDB, JWT, Google OAuth, RabbitMQ, and ImageKit.
- src/config/passport.js: Configures the Google OAuth strategy, creates or links users from Google sign-in, and returns authentication info to the controller.

### Database and messaging

- src/db/db.js: Connects the service to MongoDB using Mongoose and returns a success/failure boolean.
- src/broker/rabbit.js: Opens a RabbitMQ connection/channel and exposes publishing helpers for sending events such as user_created and user_updated.

### Routes

- src/routes/auth.routes.js: Defines the public authentication endpoints for register, login, Google OAuth, user profile retrieval, and logout.
- src/routes/user.routes.js: Defines protected routes for profile viewing, profile editing, avatar updates, follow/unfollow actions, and bulk user lookup.

### Controllers

- src/controller/auth.controller.js: Implements login, registration, Google OAuth callback handling, session/profile retrieval, and logout logic.
- src/controller/user.controller.js: Implements public profile lookup, profile updates, avatar uploading, follow/unfollow actions, following-list retrieval, and bulk user fetching.
- src/controller/auth.controller.js.bak: Backup copy of an earlier authentication controller version kept for reference.

### Middleware

- src/middlewares/auth.middleware.js: Verifies the JWT from the auth cookie and attaches the decoded user information to req.user.
- src/middlewares/validation.middleware.js: Validates login and registration payloads using express-validator before controller execution.
- src/middlewares/avatarUpload.middleware.js: Handles multipart avatar uploads, restricts allowed file types, enforces size limits, and formats upload errors into friendly responses.

### Data model

- src/model/user.model.js: Defines the Mongoose user schema with fields for email, fullname, password, Google ID, role, bio, headline, avatar, followers, following, and interests.

### Utilities

- src/utils/imagekit.js: Uploads avatar images to ImageKit and removes previously uploaded avatars for the same user to keep storage clean.

### Scripts

- src/scripts/backfillUserUpdated.js: One-off maintenance script that re-publishes user_updated events for all existing users so downstream services can sync profile changes.

## API overview

### Authentication endpoints

- POST /api/auth/register
  - Registers a new user and issues an auth cookie
- POST /api/auth/login
  - Authenticates an existing user and issues an auth cookie
- GET /api/auth/google
  - Starts the Google OAuth sign-in flow
- GET /api/auth/google/callback
  - Completes Google OAuth authentication and redirects to the client
- GET /api/auth/me
  - Returns the currently authenticated user profile
- POST /api/auth/logout
  - Clears the auth token cookie

### User endpoints

- GET /api/users/:id
  - Returns a public profile for a user, or the current user when id is me
- PATCH /api/users/profile
  - Updates profile fields such as bio, headline, and names; optionally uploads an avatar in the same request
- PATCH /api/users/avatar
  - Uploads a new avatar image for the current user
- POST /api/users/follow/:id
  - Follows another user
- POST /api/users/unfollow/:id
  - Unfollows another user
- GET /api/users/me/following
  - Returns the list of users the current user is following
- GET /api/users/bulk and POST /api/users/bulk
  - Return user summaries for a provided list of IDs

## Environment variables

Create a .env file in the service root with the following variables:

```env
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_CALLBACK_URL=http://localhost:3000/api/auth/google/callback
RABBITMQ_URI=amqp://localhost
IMAGEKIT_PUBLIC_KEY=your_imagekit_public_key
IMAGEKIT_PRIVATE_KEY=your_imagekit_private_key
IMAGEKIT_URL_ENDPOINT=https://ik.imagekit.io/your_instance
CLIENT_URL=http://localhost:3002
```

## Installation and run

```bash
npm install
npm run dev
```

For production:

```bash
npm start
```

The service runs on port 3000 by default.

## Notes

- Authentication is cookie-based and protected by the JWT middleware.
- Google OAuth users are created automatically when no matching account exists.
- User creation and profile updates publish events to RabbitMQ so other services can stay in sync.
- Avatar uploads are stored in ImageKit rather than on local disk.
