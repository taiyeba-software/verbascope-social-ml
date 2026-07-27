# Post Service

This service powers the social posting experience in the VerbaScope application. It handles post creation, feed delivery, likes, comments, shares, recommendations, trend signals, and realtime client updates.

## Architecture Overview

The `post-service` is built as a modular Express backend with these core responsibilities:

- Persist posts, comments, and engagement metadata to MongoDB
- Upload post images to ImageKit
- Verify user authentication via JWT cookies
- Broadcast live updates using Socket.IO
- Publish and consume RabbitMQ events for cross-service notifications and pulse signals
- Maintain a local user cache and per-user interest pulse data for recommendations

### High-level data flow

1. Client sends an authenticated request to `/api/posts/*`.
2. `src/app.js` parses JSON, cookies, and applies CORS and logging.
3. `src/routes/posts.routes.js` routes requests to the correct controller.
4. Controllers update MongoDB via `src/models/*`.
5. Controllers publish RabbitMQ events through `src/broker/rabbit.js` and emit Socket.IO notifications.
6. `src/server.js` seeds in-memory pulse state from existing posts and consumes event streams to refresh trending/signal metrics.
7. Recommendations and pulse endpoints use local DB state and in-memory pulse logic.

## System Diagram (textual)

Client Browser
  ↕
  HTTP /api/posts/*
  ↕
Express App (`src/app.js`)
  ↕
Routes (`src/routes/posts.routes.js`)
  ↕
Controllers (`src/controllers/*.js`)
  ↕
MongoDB via Mongoose (`src/models/*.js`)

Background / realtime:
- Socket.IO (`server.js`) broadcasts `post:update`, `post:deleted`, `pulse:update`, `pulse:trending`, `pulse:mood`
- RabbitMQ (`src/broker/rabbit.js`) publishes `post.created`, `post.liked`, `comment.added`, `post.shared`, `notification_created`
- RabbitMQ consumes `user_created` to keep a local user copy in sync

Pulse/Recommendation flow:
- `src/pulse/pulse.js` tracks active engagements and trending hashtags
- `src/pulse/updateUserPulse.js` updates `UserPulse` interests on likes/comments/shares/dwell
- `src/controllers/recommendations.controller.js` uses `UserPulse` and hashtag matching to suggest users

## Environment Variables

Create a `.env` file in the service root with:

```env
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret
RABBITMQ_URI=amqp://localhost:5672
PORT=3003
CLIENT_URL=http://localhost:3002
AUTH_SERVICE_URL=http://localhost:3001
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

The service listens on `PORT` or `3003` by default.

## API Endpoints

All routes are mounted under `/api/posts`.

### Pulse endpoints

- `GET /api/posts/pulse/trending` - returns trending hashtags from the in-memory pulse tracker
- `GET /api/posts/pulse/signal` - returns current community engagement signal
- `GET /api/posts/:id/pulse/mood` - returns sentiment mood for a single post's comments

### Post endpoints

- `POST /api/posts` - create a post with optional images
- `GET /api/posts/feed` - paginated feed
- `GET /api/posts/user/:userId` - posts by user
- `GET /api/posts/:id` - get a single post
- `DELETE /api/posts/:id` - delete a post you own

### Like endpoints

- `POST /api/posts/:id/like` - like a post
- `DELETE /api/posts/:id/unlike` - unlike a post

### Share endpoints

- `POST /api/posts/:id/share` - share a post with optional reason
- `DELETE /api/posts/:id/unshare` - remove a share

### Comment endpoints

- `POST /api/posts/:id/comment` - add a comment or reply
- `GET /api/posts/:id/comments` - top-level comments for a post
- `GET /api/posts/comments/:commentId/replies` - replies to a comment
- `DELETE /api/posts/:postId/comments/:commentId` - delete your own comment

### Engagement and recommendation

- `POST /api/posts/dwell` - record dwell time for post engagement
- `GET /api/posts/recommendations/users` - recommendation candidates based on shared hashtag interests

## Core File Responsibilities

### `server.js`
- Creates the HTTP server and Socket.IO instance
- Connects to MongoDB and RabbitMQ
- Seeds the in-memory pulse tracker from existing posts
- Consumes pulse events and emits realtime updates

### `src/app.js`
- Configures Express middleware: logging, CORS, JSON parsing, cookies
- Mounts the post routes

### `src/routes/posts.routes.js`
- Defines the full `/api/posts` route surface
- Applies authentication and validation middleware
- Includes the multer upload handler and error middleware

### `src/controllers/post.controller.js`
- Handles creating, listing, retrieving, and deleting posts
- Normalizes content, extracts hashtags, counts words, and detects language
- Uploads images to ImageKit
- Enriches post responses with user data from `auth-service`
- Emits realtime socket events for post deletion

### `src/controllers/like.controller.js`
- Handles liking and unliking a post
- Updates like counters and stores like metadata
- Publishes `post.liked` events
- Emits `post:update` socket events
- Sends notification events for post owners

### `src/controllers/share.controller.js`
- Handles sharing and unsharing
- Tracks share reasons and share counts
- Publishes `post.shared` events
- Emits `post:update` socket events
- Sends notification events for post owners

### `src/controllers/comment.controller.js`
- Creates comments and replies
- Classifies sentiment at write-time
- Updates comment/reply counts
- Recomputes and broadcasts post mood
- Emits `post:update` and `comment:reply` socket events

### `src/controllers/dwell.controller.js`
- Records dwell metrics for engagement scoring
- Filters out brief scrolls (< 3 seconds)
- Updates user pulse without blocking the request

### `src/controllers/recommendations.controller.js`
- Builds recommendations using the current user's interest vector
- Matches recent posts by hashtag overlap
- Returns authors ranked by shared hashtag relevance

### `src/middlewares/auth.middleware.js`
- Verifies JWT from the `token` cookie
- Attaches authenticated user payload to `req.user`
- Enforces route protection

### `src/middlewares/validation.middleware.js`
- Validates posts and comments using `express-validator`
- Returns structured 422 validation errors

### `src/middlewares/upload.middleware.js`
- Handles multipart image uploads with `multer`
- Restricts image types, maximum size, and count
- Provides error middleware for upload failures

### `src/broker/rabbit.js`
- Connects to RabbitMQ with reconnect logic
- Publishes event payloads for notifications and pulse events
- Consumes `user_created` to upsert local user copies
- Exposes `consumePulseEvents` for event-driven signal updates

### `src/db/db.js`
- Connects to MongoDB with a connection timeout
- Used at startup by `server.js`

### `src/pulse/pulse.js`
- Maintains an in-memory activity window for likes, posts, comments, and shares
- Computes trending hashtag counts and engagement signal state
- Classifies comment mood from sentiment tallies

### `src/pulse/updateUserPulse.js`
- Updates per-user hashtag interest scores on engagement actions
- Uses weighted signals for likes, comments, shares, and dwell
- Supports recommendation generation

### `src/models/post.model.js`
- Defines the post schema, indexes, and engagement counters
- Stores hashtags, images, likes, shares, and reason breakdowns

### `src/models/comment.model.js`
- Defines threaded comments with parent references and reply counts
- Stores denormalized sentiment labels and scores

### `src/models/user.model.js`
- Stores a local copy of user identity and profile data
- Used for feed enrichment and notification lookups

### `src/models/userPulse.model.js`
- Stores a map of hashtag interests for each user
- Used for recommendation logic

### `src/utils/authClient.js`
- Axios client to request user data from `auth-service`
- Supports bulk user lookups for feed responses

### `src/utils/detectLanguage.js`
- Detects Bangla, English, or mixed-language content
- Used to set `contentLanguage` on posts

### `src/utils/normalizeText.js`
- Normalizes Bengali and English text for text search indexing
- Supports language-agnostic search in MongoDB text indexes

### `src/utils/imagekit.js`
- Uploads image buffers to ImageKit
- Returns CDN URLs for stored images

### `src/services/commentSentiment.js`
- Classifies comment sentiment using word lists, negation, emoji, and masked profanity detection
- Returns a stable `{ label, score }` shape for comment metadata

## Realtime Event Summary

The service uses Socket.IO to notify clients about:

- `post:update` — changes to likes, shares, or comment counts
- `post:deleted` — a post was removed
- `pulse:trending` — hashtag trending changes
- `pulse:update` — community engagement signal updates
- `pulse:mood` — sentiment state for a post thread

## RabbitMQ Events

Published events:

- `post.created` — new post created
- `post.liked` — post received a like
- `comment.added` — new comment or reply added
- `post.shared` — post was shared
- `notification_created` — notifications for auth/notification service

Consumed events:

- `user_created` — to mirror user records locally for enrichment

## Notes

- Auth is based on a cookie JWT cookie (`token`) and must match the auth-service secret.
- RabbitMQ failures are handled gracefully at startup; the service can still serve posts without real-time features.
- Feed and single-post endpoints enrich author data by calling `auth-service` via `src/utils/authClient.js`.
- Trending and engagement signals are driven by a mix of in-memory pulse state and persistent DB data.
