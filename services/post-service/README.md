# Post Service

This service powers the social posting experience in VerbaScope. It handles post creation, feed retrieval, likes, comments, shares, recommendations, and realtime engagement signals.

## Overview

The post service is an Express-based backend that stores post data in MongoDB, uploads images to ImageKit, publishes and consumes RabbitMQ events, and broadcasts live updates over Socket.IO. It also keeps a local copy of user records and user-interest pulse data used for recommendations and trending analysis.

## Features

- Create posts with text and up to 4 images
- Retrieve a paginated feed of posts
- View posts by a specific user or by post ID
- Like and unlike posts
- Share and unshare posts with supported reasons
- Add, list, reply to, and delete comments
- Record dwell time for post engagement analysis
- Recommend users based on shared hashtags and user interest signals
- Expose trending and activity pulse endpoints
- Broadcast live updates such as post changes and pulse changes

## Tech Stack

- Node.js + Express
- MongoDB + Mongoose
- Socket.IO for real-time updates
- RabbitMQ via amqplib
- ImageKit for image uploads
- JWT-based cookie authentication
- express-validator and multer

## Project Structure

- server.js - Starts the HTTP server, Socket.IO, DB connection, pulse seeding, and RabbitMQ consumers
- src/app.js - Express app setup and route mounting
- src/routes/posts.routes.js - All API endpoints for posts, comments, likes, shares, dwell tracking, and recommendations
- src/controllers/ - Request handlers for posts, likes, comments, dwell tracking, and recommendations
- src/middlewares/ - Authentication, validation, and upload middleware
- src/models/ - Mongoose schemas for posts, comments, users, and user pulse data
- src/pulse/ - In-memory engagement and trending logic
- src/broker/rabbit.js - RabbitMQ publish/consume logic
- src/utils/ - Helpers for auth client calls, language detection, normalization, and ImageKit uploads

## Environment Variables

Create a .env file in the service root with:

```env
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret
RABBITMQ_URI=amqp://localhost:5672
PORT=3003
CLIENT_URL=http://localhost:3002
IMAGEKIT_PUBLIC_KEY=your_imagekit_public_key
IMAGEKIT_PRIVATE_KEY=your_imagekit_private_key
IMAGEKIT_URL_ENDPOINT=https://ik.imagekit.io/your_instance
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

The service runs on port 3003 by default.

## API Endpoints

All routes are mounted under /api/posts.

### Pulse

- GET /api/posts/pulse/trending - Returns trending hashtags from the in-memory pulse tracker
- GET /api/posts/pulse/signal - Returns current engagement signal status
- GET /api/posts/:id/pulse/mood - Returns comment sentiment mood for a specific post

### Posts

- POST /api/posts - Create a post with optional images
- GET /api/posts/feed - Get a paginated feed of posts
- GET /api/posts/user/:userId - Get posts for a specific user
- GET /api/posts/:id - Get a single post by ID
- DELETE /api/posts/:id - Delete your own post

### Likes

- POST /api/posts/:id/like - Like a post
- DELETE /api/posts/:id/unlike - Remove a like

### Shares

- POST /api/posts/:id/share - Share a post
- DELETE /api/posts/:id/unshare - Remove a share

### Comments

- POST /api/posts/:id/comment - Add a comment or reply
- GET /api/posts/:id/comments - Get top-level comments for a post
- GET /api/posts/comments/:commentId/replies - Get replies for a comment
- DELETE /api/posts/:postId/comments/:commentId - Delete your own comment

### Engagement and Recommendations

- POST /api/posts/dwell - Record dwell time for a post
- GET /api/posts/recommendations/users - Get recommended users based on shared interests

## Image Uploads

- Uploads must use multipart/form-data under the images field
- Maximum 4 images per post
- Each image must be under 5 MB
- Allowed types: JPEG, PNG, WEBP, GIF

## Authentication

Most endpoints require a valid JWT stored in the token cookie. The middleware verifies the cookie and attaches the user payload to req.user.

## RabbitMQ Integration

The service publishes and consumes RabbitMQ events:

- Consumes user_created to upsert a local user copy
- Publishes post.created, post.liked, comment.added, post.shared, and notification_created events
- Uses pulse_events for engagement signal updates

## Socket.IO Events

The service emits live updates for clients to react to immediately:

- post:update - when likes, comments, or shares change
- post:deleted - when a post is deleted
- pulse:trending - when trending data changes
- pulse:update - when engagement signal changes
- pulse:mood - when a post comment mood is recalculated

## Data Models

- Post - stores author, content, tags, images, counts, likes, shares, and share reasons
- Comment - stores comment content, parent-child reply structure, and sentiment
- User - stores a local copy of auth-service user info for feed enrichment and recommendations
- UserPulse - tracks per-user hashtag interest scores

## Notes

- If RabbitMQ is unavailable at startup, the service still runs but realtime and notification-driven features will be limited.
- The service seeds its pulse state from existing posts when it starts.
- Authenticated user details are fetched from the auth service for feed enrichment and user profile display.
