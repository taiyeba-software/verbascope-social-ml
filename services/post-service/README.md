# VerbaScope Post Service

The Post Service is the Express and Socket.IO backend for VerbaScope posts and their social interactions. It stores posts and comments in MongoDB, uploads images to ImageKit, indexes posts in Meilisearch, tracks pulse and user interests, and exchanges asynchronous events with the auth, notification, and ML services through RabbitMQ.

## Responsibilities

- Create, read, and delete posts and comments.
- Support likes, shares, saved posts, replies, and dwell tracking.
- Build authenticated feeds and user recommendations.
- Analyze post text asynchronously through the ML Brain.
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
| `server.js` | Application entrypoint. Connects MongoDB, seeds pulse state, initializes Meilisearch, starts RabbitMQ consumers, and creates the HTTP/Socket.IO server on port `3003` by default. |
| `package.json` | Defines the service metadata, npm scripts, and runtime dependencies. |
| `package-lock.json` | npm lockfile version 3 that records the resolved dependency tree. |
| `backfillSentiment.js` | One-off migration script that loads all existing comments and recalculates their sentiment. |
| `fix.mjs` | Empty module at present; it performs no action. |
| `.env` | Local runtime configuration and credentials. Do not commit or copy its values into documentation. |
| `node_modules/` | Generated npm dependency directory; not application source. |
| `README.md` | This documentation. |

### `src/`

| Path | Purpose |
| --- | --- |
| `src/app.js` | Configures Express with Morgan logging, CORS, JSON and cookie parsing, and mounts the post routes at `/api/posts`. |
| `src/broker/rabbit.js` | Owns the RabbitMQ connection, queue declarations, event publishing, user mirror consumers, ML result consumption, and reconnect behavior. |
| `src/config/config.js` | Reads MongoDB, broker, JWT, HTTP, client, and ImageKit configuration from environment variables and defaults. |
| `src/db/db.js` | Opens the MongoDB connection used by the service. |
| `src/routes/posts.routes.js` | Registers all post, feed, comment, interaction, pulse, search, dwell, and recommendation routes. |
| `src/controllers/post.controller.js` | Creates, reads, feeds, deletes, and updates persisted ML analysis on posts. There is no public post-update route. |
| `src/controllers/comment.controller.js` | Creates and deletes comments and replies, and exposes comment sentiment/mood data. |
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

### `src/models/`

| Path | Purpose |
| --- | --- |
| `post.model.js` | Mongoose schema for post text, tags, media, author data, counters, sentiment/ML fields, share-reason counts, and indexes. |
| `comment.model.js` | Mongoose schema for comments and replies, including sentiment fields and indexes. |
| `like.model.js` | Standalone unique user/post like relation model. The current like controller does not use this model. |
| `savedPost.model.js` | Unique user/post saved-post relation model. |
| `user.model.js` | Local mirror of auth-service user profiles, including names, avatars, and interest data. |
| `userPulse.model.js` | Persists per-user hashtag interest scores used by pulse and recommendations. |

### `src/pulse/`

| Path | Purpose |
| --- | --- |
| `pulse.js` | Maintains in-memory trending tags, activity signals, share breakdowns, and comment mood, and provides pulse data for routes/socket events. Most state resets after a restart. |
| `updateUserPulse.js` | Persists weighted hashtag interests for likes, comments, shares, and dwell events. The weights are `2`, `3`, `4`, and `1` respectively. |

### `src/search/` and `src/scripts/`

| Path | Purpose |
| --- | --- |
| `search/meiliClient.js` | Creates the Meilisearch client, checks availability, and initializes the `posts` index. |
| `search/postIndex.js` | Maps posts into search documents, indexes and deletes documents, and runs post/tag queries with facets. |
| `search/searchHealth.js` | Returns the Meilisearch health result used by the health endpoint. |
| `scripts/reindexPosts.js` | One-off batch script that rebuilds the Meilisearch `posts` index from MongoDB. |

### `src/services/` and `src/utils/`

| Path | Purpose |
| --- | --- |
| `services/commentSentiment.js` | Local comment sentiment classifier using keywords, emojis, negation handling, and masked-profanity detection. |
| `utils/authClient.js` | Axios client for auth-service calls and bulk user profile lookup. |
| `utils/detectLanguage.js` | Detects English, Bengali, or mixed text. |
| `utils/imagekit.js` | Uploads image buffers to ImageKit and returns hosted media information. |
| `utils/normalizeText.js` | Normalizes transliterated Bengali text for processing and search. |

## Requirements And Setup

Install Node.js and npm, then run from this directory:

```powershell
npm install
```

For a reproducible install from the lockfile:

```powershell
npm ci
```

The service expects MongoDB, RabbitMQ, and optionally Meilisearch, ImageKit, and the auth-service to be reachable. MongoDB is required for normal request handling. RabbitMQ is required for notifications, pulse events, and asynchronous ML analysis, but the HTTP server can start while the broker is unavailable. Meilisearch is optional and search is degraded or unavailable when it cannot be reached.

## Environment Variables

The service reads these variable names:

| Variable | Used for |
| --- | --- |
| `MONGO_URI` | MongoDB connection string |
| `RABBITMQ_URI` | RabbitMQ connection string |
| `JWT_SECRET` | JWT verification |
| `PORT` | HTTP server port; defaults to `3003` |
| `CLIENT_URL` | Read by the config module, but not currently used by Express or Socket.IO CORS; origins are hardcoded in `src/app.js` and `server.js` |
| `AUTH_SERVICE_URL` | Auth-service API base URL; defaults to `http://localhost:3000` |
| `IMAGEKIT_PUBLIC_KEY` | ImageKit public credential |
| `IMAGEKIT_PRIVATE_KEY` | ImageKit private credential |
| `IMAGEKIT_URL_ENDPOINT` | ImageKit URL endpoint |
| `MEILI_HOST` | Meilisearch host; defaults to `http://localhost:7700` |
| `MEILI_MASTER_KEY` | Meilisearch authentication key |

`CLIENT_ID` and `CLIENT_SECRET` may exist in the local environment but are not referenced by the current post-service source. Keep all credentials in `.env` or the deployment secret manager.

## Running

```powershell
npm start
```

Development mode uses nodemon:

```powershell
npm run dev
```

Startup attempts to connect to MongoDB, seed in-memory pulse tags from existing posts, initialize Meilisearch, connect RabbitMQ and start consumers, then listen for HTTP and Socket.IO traffic. MongoDB connection errors are logged and startup continues, but database-backed requests will fail until MongoDB is available. Meilisearch is optional. RabbitMQ is also non-fatal at startup and retries its connection every five seconds; notifications, pulse events, and ML analysis are unavailable until the broker reconnects.

## HTTP API

All routes below are mounted under `/api/posts`. `protect` means the `token` cookie must contain a valid JWT.

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| `GET` | `/pulse/trending` | Public | Return in-memory trending tags. |
| `GET` | `/pulse/signal` | Public | Return activity classification and pulse metadata. |
| `GET` | `/:id/pulse/mood` | Protected | Return comment sentiment mood for a post. |
| `GET` | `/search/health` | Public | Check Meilisearch health. |
| `GET` | `/search?q=&limit=&offset=` | Protected | Search indexed posts. Search failures degrade to an empty result. |
| `GET` | `/search/tags?q=&limit=` | Protected | Search tag facets. Meilisearch failures return an empty successful result. |
| `GET` | `/tag/:tagName?limit=&offset=` | Protected | Search posts with an exact tag. A Meilisearch failure returns HTTP 500. |
| `POST` | `/` | Protected | Create a multipart post; image field is `images`, with a maximum of four files. |
| `GET` | `/feed?page=&limit=` | Protected | Return a paginated global feed, sorted newest first. It is not filtered by following relationships; `limit` defaults to 10 and is capped at 50. |
| `GET` | `/user/:userId` | Protected | Return posts belonging to a user. |
| `GET` | `/saved?page=&limit=` | Protected | Return paginated saved posts. |
| `GET` | `/:id` | Protected | Return one post. |
| `DELETE` | `/:id` | Protected | Delete a post owned by the authenticated user. |
| `POST` | `/:id/like` | Protected | Like a post. |
| `DELETE` | `/:id/unlike` | Protected | Remove a post like. |
| `POST` | `/:id/share` | Protected | Share a post with a validated reason. |
| `DELETE` | `/:id/unshare` | Protected | Remove a share. |
| `POST` | `/:id/save` | Protected | Save a post. |
| `DELETE` | `/:id/unsave` | Protected | Remove a saved post. |
| `POST` | `/:id/comment` | Protected | Create a comment or reply. |
| `GET` | `/:id/comments` | Protected | List top-level comments. |
| `GET` | `/comments/:commentId/replies` | Protected | List replies for a comment. |
| `DELETE` | `/:postId/comments/:commentId` | Protected | Delete a comment owned by the authenticated user. |
| `POST` | `/dwell` | Protected | Record post dwell activity; durations below three seconds are ignored. |
| `GET` | `/recommendations/users` | Protected | Return recommended users. |

Valid share reasons are `agree`, `funny`, `needs_attention`, `insightful`, `concerning`, and `educational`.

### Request details

- Authenticated routes require a valid JWT in the `token` cookie. The route middleware does not read bearer tokens from the `Authorization` header.
- Create a post with `multipart/form-data`: send optional `content` and image files under the `images` field. Content is limited to 3,000 characters; a post must contain content or at least one image. Images are limited to JPEG, PNG, WebP, and GIF, 5 MB per file, with at most four files.
- Create a comment or reply with JSON `{ "content": "...", "parentComment": "<comment-id>" }`. `content` is required and limited to 500 characters; omit `parentComment` for a top-level comment.
- Like, share, save, comment, and dwell requests update authenticated-user state. Invalid IDs, ownership violations, missing resources, and duplicate actions can return `400`, `403`, `404`, or `409` responses.

## RabbitMQ Integration

The broker module declares and uses these queues:

| Queue | Durability | Behavior |
| --- | --- | --- |
| `pulse_events` | Non-durable | Publishes post-created, post-liked, comment-added, and post-shared events. |
| `notification_created` | Durable | Publishes notification events for the notification service. |
| `ml_analyze` | Durable | Publishes post text for asynchronous ML analysis. |
| `ml_results` | Durable | Consumes ML analysis results and persists them on the related post. |
| `user_created` | Durable | Consumes auth events and upserts mirrored users. |
| `user_updated` | Durable | Consumes auth events and updates mirrored names and avatars. |

RabbitMQ connection failures schedule reconnect attempts every five seconds. Message-handler failures are negatively acknowledged without requeueing. ML results also trigger post updates and Socket.IO `post:ml-analysis` events.

## Search And Pulse Behavior

Meilisearch uses the `posts` index with `_id` as its primary key. Search documents contain normalized content, tags, author metadata, language, word count, image count, and epoch timestamps. Indexing on creation and deletion is non-blocking, and search is intentionally non-fatal to the main post workflow.

The service creates the index but does not configure its filterable attributes. Configure `tags` before using exact tag filtering, for example:

```powershell
curl.exe -X PATCH http://localhost:7700/indexes/posts/settings `
	-H "Content-Type: application/json" `
	--data-raw '{"filterableAttributes":["tags"]}'
```

Run the reindex script after changing index settings or starting with an empty index.

Pulse state is primarily in memory, so live activity counts and mood data reset after a process restart. Existing posts seed trending tags at startup, but historical activity counts are not rebuilt. User hashtag interests are persisted in MongoDB and receive weights of like `2`, comment `3`, share `4`, and dwell `1`.

## Socket.IO Events

The server uses a local socket CORS origin of `http://localhost:3002` and emits:

- `pulse:trending`
- `pulse:update`
- `pulse:mood`
- `post:update`
- `post:deleted`
- `post:ml-analysis`
- `comment:reply`

## Maintenance Scripts

```powershell
node src/scripts/reindexPosts.js
node backfillSentiment.js
```

The first rebuilds the Meilisearch `posts` index. The second recalculates sentiment for all existing comments. `node fix.mjs` currently performs no work because `fix.mjs` is empty.

## Npm Scripts And Testing

| Command | Behavior |
| --- | --- |
| `npm start` | Runs `node server.js`. |
| `npm run dev` | Runs `npx nodemon server.js`. |
| `npm test` | Uses the placeholder npm script and intentionally exits with `Error: no test specified`. |
| `npm install` | Installs dependencies. |
| `npm ci` | Installs the lockfile-resolved dependencies. |

There is currently no automated test suite in this folder. Validate changes with the service integrations, maintenance scripts, and API workflows relevant to the change.

## Operational Notes

- MongoDB and model/user data are persisted, but most pulse state is process-local.
- Image uploads are held in memory before being sent to ImageKit.
- Authentication is cookie-based through the `token` cookie.
- Meilisearch availability is useful but not required for the HTTP service to start.
- `like.model.js` exists as a schema but is not used by the current like controller.
- The current route set supports post deletion but does not expose a post-update endpoint.
- Deleting a post removes its `Post` document and search entry asynchronously, but does not cascade-delete comments or saved-post records.
- `reanalyzeStalePosts` exists in `post.controller.js` for one-time ML backfills, but it is not registered as an HTTP route.

## Project Status

This service is part of the VerbaScope social platform and is under active development. Its asynchronous ML and recommendation outputs should be treated as platform signals and persisted metadata, not as definitive moderation decisions.