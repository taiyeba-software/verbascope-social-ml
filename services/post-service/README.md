# Post Service

This service handles post creation, interaction, search, and recommendation flows for the social platform. It exposes the core API for posts, comments, likes, saves, shares, and dwell-based engagement tracking.

## Overview

The post-service is a Node.js/Express application built with MongoDB, RabbitMQ messaging, and Meilisearch integration. It is responsible for:

- creating and managing posts
- handling comments, likes, saves, and shares
- recording user engagement signals such as dwell time
- indexing posts for search and recommendations
- publishing or consuming events through the broker layer

## Project structure

- `server.js` — starts the Express server and initializes the application.
- `package.json` — defines scripts and dependencies for the service.
- `package-lock.json` — lockfile for reproducible dependency installation.
- `.env` — environment configuration variables for database, broker, auth, and search services.
- `backfillSentiment.js` — one-off script used to populate or update sentiment-related data for posts.
- `fix.mjs` — maintenance/helper script for small fixes or data repair tasks.

### src/

- `src/app.js` — main Express app setup, middleware registration, and route mounting.
- `src/broker/` — broker integration for RabbitMQ communication.
  - `src/broker/rabbit.js` — RabbitMQ connection and event publishing/consuming helpers.
- `src/config/` — service configuration files.
  - `src/config/config.js` — core configuration values such as ports, URLs, and feature toggles.
- `src/controllers/` — request handlers for each feature area.
  - `src/controllers/post.controller.js` — creates, updates, fetches, and deletes posts.
  - `src/controllers/comment.controller.js` — handles comment creation and related actions.
  - `src/controllers/like.controller.js` — manages likes and unlike operations.
  - `src/controllers/savedPost.controller.js` — handles saved-post functionality.
  - `src/controllers/share.controller.js` — manages share actions and related logic.
  - `src/controllers/dwell.controller.js` — records dwell-time engagement events.
  - `src/controllers/recommendations.controller.js` — builds and returns post recommendations.
  - `src/controllers/search.controller.js` — search-related request logic.
- `src/db/` — database connection utilities.
  - `src/db/db.js` — MongoDB connection setup and database initialization.
- `src/middlewares/` — request validation and auth middleware.
  - `src/middlewares/auth.middleware.js` — validates JWT-based user authentication.
  - `src/middlewares/upload.middleware.js` — handles file upload processing for media attachments.
  - `src/middlewares/validation.middleware.js` — validates incoming request payloads.
- `src/models/` — Mongoose schemas and models.
  - `src/models/post.model.js` — post schema and data model.
  - `src/models/comment.model.js` — comment schema.
  - `src/models/like.model.js` — like interaction model.
  - `src/models/savedPost.model.js` — saved post model.
  - `src/models/user.model.js` — user reference model used by posts.
  - `src/models/userPulse.model.js` — user engagement pulse model.
- `src/pulse/` — pulse and engagement tracking utilities.
  - `src/pulse/pulse.js` — pulse calculation logic.
  - `src/pulse/updateUserPulse.js` — updates user pulse values based on activity.
- `src/routes/` — API route definitions.
  - `src/routes/posts.routes.js` — routes for post-related endpoints.
- `src/scripts/` — maintenance and data-management scripts.
  - `src/scripts/reindexPosts.js` — reindexes posts in the search engine.
- `src/search/` — search integration with Meilisearch.
  - `src/search/meiliClient.js` — Meilisearch client setup.
  - `src/search/postIndex.js` — post indexing configuration and schema.
  - `src/search/searchHealth.js` — health checks for the search service.
- `src/services/` — supporting business logic services.
  - `src/services/commentSentiment.js` — analyzes comment sentiment.
- `src/utils/` — utility helpers.
  - `src/utils/authClient.js` — auth-service client helper.
  - `src/utils/detectLanguage.js` — language detection helper.
  - `src/utils/imagekit.js` — image upload helper integration.
  - `src/utils/normalizeText.js` — text normalization utility.

## Runtime notes

- Start the service with `npm start`.
- Run in development mode with `npm run dev`.
- The service expects environment variables for database access, auth validation, message broker, and search indexing.

## Summary

The post-service is the main backend component for social feed interactions. It combines REST routes, database models, search indexing, event-driven messaging, and engagement analytics into one cohesive service.
