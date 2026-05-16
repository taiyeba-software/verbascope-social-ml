# Post Service

Post Service is the social-posts API for VerbaScope. It exposes authenticated endpoints for creating posts, retrieving feeds, liking/unliking posts, and managing comments.

## Features

- Create and delete posts
- Retrieve the global feed with pagination
- Retrieve posts by user and individual post details
- Like and unlike posts with duplicate protection
- Add, list, and delete comments
- MongoDB-backed persistence with schema indexes for feed performance
- JWT cookie-based route protection

## Tech Stack

- Node.js
- Express
- MongoDB with Mongoose
- JSON Web Tokens
- Cookie parser
- Express Validator
- Morgan
- CORS

## Project Structure

- `server.js` - service bootstrap and database startup
- `src/app.js` - Express app configuration and route mounting
- `src/config/config.js` - environment configuration
- `src/db/db.js` - MongoDB connection
- `src/middlewares/` - auth and validation middleware
- `src/models/` - Post, Like, and Comment schemas
- `src/controllers/` - request handlers for posts, likes, and comments
- `src/routes/posts.routes.js` - route definitions

## Environment Variables

Create a `.env` file in the service root with the following values:

```dotenv
MONGO_URI=mongodb://...
JWT_SECRET=your_jwt_secret
RABBITMQ_URI=amqps://...
PORT=3003
```

### Notes

- `MONGO_URI` is required for database access.
- `JWT_SECRET` must match the token issuer used by the auth service.
- `RABBITMQ_URI` falls back to `amqp://localhost:5672` if not provided.
- `PORT` defaults to `3003`.

## Service Integration

This service is designed to work with the following local ports:

- Frontend: `http://localhost:3002`
- Auth service: `http://localhost:3000`
- Notification service: `http://localhost:3001`

The Express CORS allowlist permits those origins and enables credentials so the `token` cookie can be sent with requests.

Post Service also consumes the `user_created` RabbitMQ event and stores a local user projection. That keeps `populate('author', 'fullname')` and `populate('user', 'fullname')` working against a local `User` collection.

## Install

```bash
npm install
```

## Run

Development:

```bash
npm run dev
```

Production:

```bash
npm start
```

## API Base Path

All post routes are mounted under:

```text
/api/posts
```

## Endpoints

### Posts

- `POST /api/posts` - create a post
- `GET /api/posts/feed` - get paginated feed
- `GET /api/posts/user/:userId` - get posts by a specific user
- `GET /api/posts/:id` - get a single post
- `DELETE /api/posts/:id` - delete a post you own

### Likes

- `POST /api/posts/:id/like` - like a post
- `DELETE /api/posts/:id/unlike` - unlike a post

### Comments

- `POST /api/posts/:id/comment` - add a comment
- `GET /api/posts/:id/comments` - list comments for a post
- `DELETE /api/posts/:postId/comments/:commentId` - delete your comment

## API Test Status

All APIs are fully tested and working! ✅

| Endpoint | Status |
|---|---|
| `POST /api/posts` | ✅ |
| `GET /api/posts/feed` | ✅ + populate working |
| `GET /api/posts/:id` | ✅ |
| `GET /api/posts/abc123` | ✅ 400 Invalid ID |
| `POST /api/posts/:id/like` | ✅ |
| `POST /api/posts/:id/like` again | ✅ 409 duplicate blocked |
| `DELETE /api/posts/:id/unlike` | ✅ |
| `POST /api/posts/:id/comment` | ✅ |
| `GET /api/posts/:id/comments` | ✅ + populate working |
| `DELETE /api/posts/:postId/comments/:commentId` | ✅ |
| `DELETE /api/posts/:id` | ✅ |

## Authentication Contract

All endpoints are protected by `protect` middleware and expect a valid JWT in the `token` httpOnly cookie.

The client must send requests with credentials enabled so the cookie is included.

## Data Model Summary

### Post

- `author` - MongoDB ObjectId of the user
- `content` - optional text content up to 1000 characters
- `image` - optional image URL or path
- `likesCount` - number of likes
- `commentsCount` - number of comments

### Like

- `user` - MongoDB ObjectId of the user
- `post` - reference to `Post`
- unique compound index on `user + post`

### Comment

- `user` - MongoDB ObjectId of the user
- `post` - reference to `Post`
- `content` - comment text up to 500 characters

## Operational Notes

- The feed and user-specific queries are indexed for better read performance.
- The post service expects the auth service to provide a JWT payload with `id` and `role`.
- The controller code currently populates `author` and `user` using the `fullname` field, so the auth service response should expose that field for best results.
- The auth service returns `fullname` as a nested object with `firstName` and `lastName`.
- If RabbitMQ is unavailable, the API can still start, but author/comment names may be missing until the `user_created` queue is processed.
- The service-level startup file should only import dependencies that exist in this folder. If you add or remove cross-service integrations, keep `server.js` in sync.

## Example Request

```bash
curl -X GET http://localhost:3003/api/posts/feed \
  -H "Cookie: token=YOUR_JWT_COOKIE"
```

## Troubleshooting

- `401 Not authenticated` usually means the `token` cookie is missing or invalid.
- `422 Unprocessable Entity` means request validation failed.
- `404 Not Found` can mean the post or comment ID does not exist.
- `409 Conflict` can mean the same user already liked the post.
