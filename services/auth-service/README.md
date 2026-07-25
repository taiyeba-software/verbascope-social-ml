# Auth Service

This service handles authentication, user profile management, and basic social account operations for the VerbaScope social platform.

## Overview

The auth service is an Express-based backend service built with MongoDB, JWT-based authentication, Google OAuth, RabbitMQ event publishing, and ImageKit avatar uploads. It powers user registration/login flows and supports profile-related actions for the frontend.

## Features

- Email/password registration and login
- JWT authentication stored in an HTTP-only cookie
- Google OAuth sign-in flow
- Protected user profile retrieval and updates
- Follow/unfollow support for the social graph
- Avatar upload integration with ImageKit
- RabbitMQ event publishing for new user creation

## Tech Stack

- Node.js + Express
- MongoDB + Mongoose
- JSON Web Tokens (JWT)
- Passport.js with Google OAuth 2.0
- RabbitMQ (amqplib)
- Multer + ImageKit for avatar uploads
- dotenv + CORS + cookie-parser

## Project Structure

- server.js - Starts the service and mounts routes
- src/app.js - Express app setup and middleware
- src/routes/ - Auth and user route definitions
- src/controller/ - Request handlers for auth and user actions
- src/middlewares/ - Auth, validation, and avatar upload middleware
- src/model/ - Mongoose user model
- src/config/ - Environment and passport configuration
- src/db/ - MongoDB connection setup
- src/broker/ - RabbitMQ connection and queue publishing
- src/utils/ - Helper utilities such as ImageKit integration

## Environment Variables

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

## Installation

```bash
npm install
```

## Running the Service

Development mode:

```bash
npm run dev
```

Production mode:

```bash
npm start
```

The service runs on port 3000 by default.

## API Endpoints

### Authentication

- POST /api/auth/register
  - Registers a new user
  - Expects email, password, and fullname.firstName/fullname.lastName
- POST /api/auth/login
  - Authenticates a user and returns a JWT in a cookie
- GET /api/auth/google
  - Starts Google OAuth login
- GET /api/auth/google/callback
  - Handles the Google OAuth redirect
- GET /api/auth/me
  - Returns the authenticated user profile
- POST /api/auth/logout
  - Clears the auth cookie

### User Management

- POST /api/users/bulk
- GET /api/users/bulk
  - Fetches users by ID list
- GET /api/users/me/following
  - Returns the currently authenticated user’s following list
- PATCH /api/users/profile
  - Updates bio/headline for the authenticated user
- PATCH /api/users/avatar
  - Uploads an avatar using multipart/form-data with field name avatar
- POST /api/users/follow/:id
  - Follows a user
- POST /api/users/unfollow/:id
  - Unfollows a user
- GET /api/users/:id
  - Returns a user profile by ID, or /api/users/me for the current user

## Notes

- Authentication is cookie-based and protected by a JWT middleware.
- Google OAuth users are created automatically if they do not already exist.
- New users publish a RabbitMQ event named user_created to support downstream services.
- Avatar uploads are stored in ImageKit rather than locally on disk.
