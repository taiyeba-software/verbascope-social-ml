# Verbascope Social ML

Verbascope Social ML is a microservices-style backend workspace for a social platform with machine learning features planned.

Two services are currently implemented and connected through RabbitMQ:

- auth-service: handles registration and Google OAuth
- notification-service: listens for new-user events and sends welcome emails

## Current State

- auth-service: implemented and runnable
- notification-service: implemented and runnable
- feed-service: scaffolded only
- post-service: scaffolded only
- ml-service: scaffolded only
- gateway: scaffolded only
- shared: scaffolded only
- docs and docsmkdir: documentation folders

## Implemented Architecture

1. A user signs up in auth-service (local registration or Google OAuth).
2. auth-service creates/signs a JWT cookie and publishes a user_created event to RabbitMQ.
3. notification-service consumes user_created and sends a welcome email.

Queue contract currently used:

- queue name: user_created
- payload fields: id, email, fullname, role

## Auth Service Summary

Location: services/auth-service

What it does:

- POST /api/auth/register with validation
- GET /api/auth/google for OAuth start
- GET /api/auth/google/callback for OAuth return
- GET /api/auth/google/failure for failed OAuth flow
- stores users in MongoDB
- sets token cookie (httpOnly, sameSite=lax)
- publishes user_created event after successful registration and Google callback

Auth service default port: 3000

Key environment variables:

- MONGO_URI
- RABBITMQ_URI
- JWT_SECRET (optional default: dev_jwt_secret)
- GOOGLE_CLIENT_ID (or CLIENT_ID)
- GOOGLE_CLIENT_SECRET (or CLIENT_SECRET)
- GOOGLE_CALLBACK_URL (optional default: http://localhost:3000/api/auth/google/callback)

## Notification Service Summary

Location: services/notification-service

What it does:

- connects to RabbitMQ on startup
- subscribes to user_created queue
- sends welcome emails via Nodemailer (Gmail OAuth2)
- exposes POST /api/notification/test-email for manual email testing

Notification service default port: 3001

Key environment variables:

- RABBITMQ_URI
- EMAIL_USER
- CLIENT_ID
- CLIENT_SECRET
- REFRESH_TOKEN
- ACCESS_TOKEN

Variables currently present but not used by notification runtime logic:

- MONGO_URI
- JWT_SECRET

## Local Run Guide

Prerequisites:

- Node.js installed
- MongoDB available for auth-service
- RabbitMQ available for both services
- Google OAuth credentials configured in each service env where needed

Run auth-service:

```bash
cd services/auth-service
npm install
npm run dev
```

Run notification-service in another terminal:

```bash
cd services/notification-service
npm install
npm run dev
```

## Service Endpoints

Auth service:

- POST /api/auth/register
- GET /api/auth/google
- GET /api/auth/google/callback
- GET /api/auth/google/failure

Notification service:

- POST /api/notification/test-email

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
│   ├── notification-service/
│   ├── feed-service/
│   ├── ml-service/
│   └── post-service/
└── shared/
```

## Notes

- Detailed per-service docs:
  - services/auth-service/README.md
  - services/notification-service/README.md
- For broader folder context, see [about.md](about.md).