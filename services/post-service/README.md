# VerbaScope Post Service

The Post Service is the Express and Socket.IO backend for VerbaScope posts and their social interactions. It stores posts and comments in MongoDB, uploads media to ImageKit, indexes posts in Meilisearch, tracks user pulse and interests, and exchanges asynchronous events with the auth, notification, and ML services through RabbitMQ.

## Responsibilities

- Create, read, and delete posts and comments.
- Support likes, shares, saves, replies, and dwell tracking.
- Build authenticated feeds, user-specific post lists, and recommendation data.
- Analyze post text asynchronously through the ML Brain and map model output into app-friendly signal states.
- Classify comment mood locally with a lightweight keyword-based classifier.
- Expose post and tag search through Meilisearch.
- Broadcast pulse, post, ML, and comment updates through Socket.IO.

## Directory And File Guide

```text
post-service/
├── server.js
├── package.json
├── package-lock.json
├── backfillSentiment.js
├── fix.mjs
├── .env                    # Local secrets/configuration
├── node_modules/           # Generated npm dependencies
├── src/
│   ├── app.js
│   ├── broker/
│   │   └── rabbit.js
│   ├── config/
│   │   └── config.js
│   ├── controllers/
│   │   ├── comment.controller.js
│   │   ├── dwell.controller.js
│   │   ├── like.controller.js
│   │   ├── post.controller.js
│   │   ├── recommendations.controller.js
│   │   ├── savedPost.controller.js
│   │   ├── search.controller.js
│   │   └── share.controller.js
│   ├── db/
│   │   └── db.js
│   ├── middlewares/
│   │   ├── auth.middleware.js
│   │   ├── upload.middleware.js
│   │   └── validation.middleware.js
│   ├── ml/
│   │   └── signalMapper.js
│   ├── models/
│   │   ├── comment.model.js
│   │   ├── like.model.js
│   │   ├── post.model.js
│   │   ├── savedPost.model.js
│   │   ├── user.model.js
│   │   └── userPulse.model.js
│   ├── pulse/
│   │   ├── pulse.js
│   │   └── updateUserPulse.js
│   ├── routes/
│   │   └── posts.routes.js
│   ├── scripts/
│   │   └── reindexPosts.js
│   ├── search/
│   │   ├── meiliClient.js
│   │   ├── postIndex.js
│   │   └── searchHealth.js
│   ├── services/
│   │   └── commentSentiment.js
│   └── utils/
│       ├── authClient.js
│       ├── detectLanguage.js
│       ├── imagekit.js
│       └── normalizeText.js
└── README.md
```

### Root files and folders

| Path | Purpose |
| --- | --- |
| `server.js` | Application entrypoint. Connects MongoDB, seeds pulse state, initializes Meilisearch, starts RabbitMQ consumers, and creates the HTTP and Socket.IO server on port `3003` by default. |
| `package.json` | Defines the service metadata, npm scripts, and runtime dependencies. |
| `package-lock.json` | npm lockfile that records the resolved dependency tree for the service. |
| `backfillSentiment.js` | One-off migration script that recalculates sentiment for existing comments. |
| `fix.mjs` | Placeholder module; it is currently unused. |
| `.env` | Local runtime configuration and secrets. Do not commit or copy its values into documentation. |
| `node_modules/` | Generated npm dependency directory; it is not application source. |
| `README.md` | This documentation. |

### `src/`

| Path | Purpose |
| --- | --- |
| `src/app.js` | Configures Express with Morgan logging, CORS, JSON parsing, cookie parsing, and mounts the post routes at `/api/posts`. |
| `src/broker/rabbit.js` | Owns the RabbitMQ connection, queue declarations, event publishing, ML-result consumption, and reconnect behavior. |
| `src/config/config.js` | Reads MongoDB, broker, JWT, HTTP, client, and ImageKit configuration from environment variables and defaults. |
| `src/db/db.js` | Opens the MongoDB connection used by the service. |
| `src/routes/posts.routes.js` | Registers all post, feed, interaction, search, dwell, recommendation, and pulse routes. |
| `src/controllers/post.controller.js` | Creates, reads, feeds, deletes, and updates persisted ML analysis on posts. |
| `src/controllers/comment.controller.js` | Creates and deletes comments and replies, and exposes comment mood data. |
| `src/controllers/like.controller.js` | Adds and removes post likes, updates counters, publishes notifications/events, and updates user pulse. |
| `src/controllers/share.controller.js` | Adds and removes shares, validates share reasons, updates counters, and updates user pulse. |
| `src/controllers/savedPost.controller.js` | Saves, unsaves, and paginates the current user's saved posts. |
| `src/controllers/dwell.controller.js` | Records qualifying post dwell activity; visits under three seconds are ignored. |
| `src/controllers/recommendations.controller.js` | Generates user recommendations from persisted interest data and user relationships. |
| `src/controllers/search.controller.js` | Handles post search, tag facet search, and exact tag-filtered search. |

### `src/middlewares/`

| Path | Purpose |
| --- | --- |
| `auth.middleware.js` | Verifies the JWT stored in the `token` cookie and attaches the authenticated user context. |
| `upload.middleware.js` | Configures memory uploads, accepts images only, limits each file to 5 MB, and allows at most four files. |
| `validation.middleware.js` | Validates post and comment request data before controller execution. |

### `src/ml/`

| Path | Purpose |
| --- | --- |
| `signalMapper.js` | Maps ML Brain risk outputs such as `green`, `yellow`, and `red` into the app's human-readable signal states used in post analysis and UI display. |

### `src/models/`

| Path | Purpose |
| --- | --- |
| `post.model.js` | Mongoose schema for post text, tags, media, author data, counters, sentiment/ML fields, share-reason counts, and indexes. |
| `comment.model.js` | Mongoose schema for comments and replies, including sentiment fields and indexes. |
| `like.model.js` | Standalone unique user/post like relation model. The current controller path still uses direct post updates rather than this model for core like behavior. |
| `savedPost.model.js` | Stores the user-to-post save relation and prevents duplicate saves for a user/post pair. |
| `user.model.js` | User reference model used in post author and relationship lookups. |
| `userPulse.model.js` | Stores normalized interest data used for recommendations and pulse-based ranking. |

### `src/pulse/`

| Path | Purpose |
| --- | --- |
| `pulse.js` | Maintains the in-memory trending and signal state used by the pulse widget and real-time UI updates. |
| `updateUserPulse.js` | Increments user pulse when a user likes, comments, shares, or dwells on a post. |

### `src/search/` and `src/scripts/`

| Path | Purpose |
| --- | --- |
| `meiliClient.js` | Builds and initializes the Meilisearch client and index bootstrap logic. |
| `postIndex.js` | Converts post documents into searchable payloads for the Meilisearch `posts` index. |
| `searchHealth.js` | Simple health-check helper for the Meilisearch integration. |
| `reindexPosts.js` | One-off backfill script to rebuild the Meilisearch index from MongoDB. |

### `src/services/` and `src/utils/`

| Path | Purpose |
| --- | --- |
| `commentSentiment.js` | Lightweight comment sentiment classifier that detects mood, sarcasm, and profanity-heavy language. |
| `authClient.js` | Small helper for auth-service interaction and user resolution during post operations. |
| `detectLanguage.js` | Language detection helper used to flatten or route content before ML analysis. |
| `imagekit.js` | Uploads post media to ImageKit and returns the resulting URL metadata. |
| `normalizeText.js` | Normalizes user content before indexing, mood scoring, or ML analysis. |

## Requirements And Setup

- Node.js 18+ recommended.
- MongoDB instance reachable through `MONGO_URI`.
- RabbitMQ broker reachable through `RABBITMQ_URI`.
- Meilisearch instance reachable through the default local client configuration or environment override.
- ImageKit credentials for image uploads.
- JWT secret shared with the auth service so the `token` cookie can be verified consistently.

Install dependencies:

```bash
npm install
```

## Environment Variables

The service reads configuration from `.env` and a few values have safe defaults in `src/config/config.js`.

| Variable | Required | Description |
| --- | --- | --- |
| `MONGO_URI` | Yes | MongoDB connection string for the post database. |
| `RABBITMQ_URI` | No | RabbitMQ connection string; defaults to `amqp://localhost:5672`. |
| `JWT_SECRET` | Yes | Shared secret used to validate the auth cookie JWT. |
| `PORT` | No | HTTP port for the service; defaults to `3003`. |
| `CLIENT_URL` | No | Client origin used for local CORS configuration; defaults to `http://localhost:3002`. |
| `IMAGEKIT_PUBLIC_KEY` | Yes for uploads | Public key for image upload / URL generation. |
| `IMAGEKIT_PRIVATE_KEY` | Yes for uploads | Private key used by the ImageKit SDK. |
| `IMAGEKIT_URL_ENDPOINT` | Yes for uploads | ImageKit URL endpoint used when building final image links. |

`CLIENT_ID` and `CLIENT_SECRET` may exist in the local environment but are not referenced by the current post-service source. Keep all credentials in `.env` or the deployment secret manager.

## Running

Start the service in production-like mode:

```bash
npm start
```

Start it in development with automatic reload:

```bash
npm run dev
```

The server exposes the HTTP API on the configured port and also starts a Socket.IO server for live post and pulse updates.

## HTTP API

All routes below are mounted under `/api/posts`. `protect` means the `token` cookie must contain a valid JWT.

| Method | Route | Auth | Description |
| --- | --- | --- | --- |
| `GET` | `/api/posts/pulse/trending` | No | Gets the current trending pulse snapshot. |
| `GET` | `/api/posts/pulse/signal` | No | Gets the live pulse signal object. |
| `GET` | `/api/posts/search/health` | No | Verifies Meilisearch health and returns status information. |
| `GET` | `/api/posts/search` | Yes | Searches posts by query, filters, and author metadata. |
| `GET` | `/api/posts/search/tags` | Yes | Performs a tag/facet search for matching post tags. |
| `GET` | `/api/posts/tag/:tagName` | Yes | Returns posts filtered to the specified tag. |
| `POST` | `/api/posts/` | Yes | Creates a new post with optional image uploads and ML analysis. |
| `GET` | `/api/posts/feed` | Yes | Returns the current user’s feed with state flags for likes/saves. |
| `GET` | `/api/posts/user/:userId` | Yes | Returns posts created by a specific user. |
| `GET` | `/api/posts/saved` | Yes | Returns the current user’s saved posts. |
| `GET` | `/api/posts/:id` | Yes | Returns a single post with viewer-specific flags. |
| `DELETE` | `/api/posts/:id` | Yes | Deletes the current user’s post. |
| `POST` | `/api/posts/:id/like` | Yes | Adds a like and emits socket/post update events. |
| `DELETE` | `/api/posts/:id/unlike` | Yes | Removes a like. |
| `POST` | `/api/posts/:id/share` | Yes | Records a share and optionally stores a reason. |
| `DELETE` | `/api/posts/:id/unshare` | Yes | Removes a share. |
| `POST` | `/api/posts/:id/save` | Yes | Saves a post to the current user’s bookmarks. |
| `DELETE` | `/api/posts/:id/unsave` | Yes | Removes a saved post bookmark. |
| `POST` | `/api/posts/dwell` | Yes | Records dwell time for a post when the user spends enough time viewing it. |
| `GET` | `/api/posts/recommendations/users` | Yes | Returns recommended users based on pulse and relationship signals. |
| `GET` | `/api/posts/:id/pulse/mood` | Yes | Returns the current comment mood distribution for a post. |

### Request details

- `POST /api/posts` accepts multipart form data in the `images` field and supports optional `tags` and text content.
- `POST /api/posts/:id/share` validates the share reason for user-generated share labels.
- `POST /api/posts/dwell` records dwell activity only when the session meets the service’s minimum dwell threshold.
- Most response payloads include state flags such as `likedByMe`, `bookmarkedByMe`, and `isOwner` when the viewer is known.

## RabbitMQ Integration

RabbitMQ is used for asynchronous communication between the post service and the rest of the platform.

- `pulse_events` handles community pulse updates sent from the platform and updates the in-memory activity model.
- `ml_analyze` sends post text to the ML Brain for analysis.
- `ml_results` receives model results, including language and risk classification, and stores them on the post document.
- The service starts consumer loops on boot and keeps the app running even when RabbitMQ is unavailable by logging warnings instead of crashing.

## Search And Pulse Behavior

- A Meilisearch index is initialized at startup and is treated as non-critical; the app continues even if search is temporarily unavailable.
- Post indexing uses an opinionated payload that carries the author name, avatar, content, tags, counts, and model-derived ML fields for search and filtering.
- Pulse data is seeded from the database on startup and then updated in real time from likes, comments, shares, and ML-driven events.
- Protected routes enforce JWT auth before enabling feed, tag, save, or recommendation access.

## Socket.IO Events

The service emits real-time events for the frontend, including:

- `pulse:trending` when trending signal information changes.
- `pulse:update` for general pulse updates.
- `pulse:mood` when comment mood distribution is recalculated.
- `post:update` when like or share counters change.
- `post:deleted` when a post is removed.

The server also logs socket connect and disconnect events for diagnostics.

## Maintenance Scripts

| Script | Purpose |
| --- | --- |
| `backfillSentiment.js` | Re-runs comment sentiment analysis for existing comments that were created before the local classifier was standardized. |
| `reindexPosts.js` | Rebuilds the Meilisearch post index from MongoDB to recover from stale or missing search documents. |

## Npm Scripts And Testing

```json
{
  "scripts": {
    "test": "echo \"Error: no test specified\" && exit 1",
    "start": "node server.js",
    "dev": "npx nodemon server.js"
  }
}
```

There is currently no automated test suite in this folder. Validate changes with the service integrations, maintenance scripts, and API workflows relevant to the change.

## Operational Notes

- The service uses `express.json()` and cookie parsing, and it applies explicit local CORS allow-listing for the frontend origins.
- The app treats Meilisearch and RabbitMQ as resilient dependencies: failed startup does not stop the HTTP server from serving requests.
- Uploads are restricted to image files and capped at 5 MB per file, with a maximum of four files per request.
- Routing carefully handles `/saved` before the generic `/:id` route to avoid incorrect route resolution.
- Local state and counters are updated in MongoDB plus the in-memory pulse engine to keep the UI responsive.

## Project Status

The Post Service is active and is the primary backend for social posting, interaction tracking, search, and recommendation behavior in VerbaScope. It is designed to operate with MongoDB, RabbitMQ, Meilisearch, ImageKit, and the shared auth system while remaining tolerant of non-critical service failures during startup.
