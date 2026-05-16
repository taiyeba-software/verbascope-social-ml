# VerbaScope Social ML

VerbaScope Social ML is a distributed social intelligence platform that combines a Next.js frontend with backend services for authentication, posts, notifications, and machine learning analysis.

The project now has a real working backend workflow with protected routes, CRUD operations, pagination, likes, comments, validation, authorization, atomic counters, MongoDB indexes, duplicate prevention, and tested edge cases.

## What Works Today

- Protected API routes for authenticated users
- Full post CRUD workflow
- Paginated feed retrieval
- Like and unlike system with duplicate protection
- Comment create, list, and delete flow
- Request validation and authorization checks
- Atomic counters for likes and comments
- MongoDB indexing for feed and lookup performance
- Tested edge cases, including invalid IDs and duplicate like attempts

## Current Architecture

Frontend (Next.js)
  ↓
Auth Service
  ↓
Post Service
  ↓
Notification Service
  ↓
ML Service (future)

This is already a distributed-system style architecture, with each service responsible for a specific part of the product.

## Services

### Frontend

The Next.js frontend handles the user experience, authentication flows, and feed UI.

- Location: `frontend/`
- Main docs: [frontend/README.md](frontend/README.md)

### Auth Service

Handles registration, login, Google OAuth, JWT cookie issuance, and user session lookup.

- Location: `auth-service/`
- Main docs: [auth-service/README.md](auth-service/README.md)

### Post Service

Handles post creation, feed retrieval, likes, comments, and post deletion.

- Location: `post-service/`
- Main docs: [post-service/README.md](post-service/README.md)

### Notification Service

Handles event-driven notification behavior through RabbitMQ.

- Location: `notification-service/`
- Main docs: [notification-service/README.md](notification-service/README.md)

### ML Service

Reserved for future machine learning workloads such as sarcasm, sentiment, and tone analysis.

- Location: `ml-service/`

## Project Status

The backend is no longer just scaffolded CRUD. It now shows real service-level engineering concerns:

- route protection
- concurrency-safe counters
- duplicate prevention at the database layer
- validation and error handling
- service separation and event-driven communication

## Recommended Next Steps

- Connect the frontend to the verified post-service endpoints
- Expand the ML service for sarcasm and sentiment scoring
- Add more end-to-end tests across service boundaries
- Document deployment and environment setup for the full stack

## Service Notes

Each service keeps its own README for setup and API details. Start with the service-specific documentation if you want to run or debug one service in isolation.
