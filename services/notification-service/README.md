# Notification Service

This service handles email delivery, in-app notification storage, and real-time notification updates for VerbaScope.

## Overview

The notification service is an Express-based backend that connects to MongoDB, RabbitMQ, Socket.IO, and Gmail SMTP. It exposes authenticated notification endpoints for the frontend and listens for events from other services to create notifications and send welcome emails.

## Features

- Authenticated retrieval of notifications for the current user
- Marking all notifications as read
- Test email endpoint for SMTP validation
- RabbitMQ listeners for welcome emails and notification creation
- Socket.IO live updates for newly created notifications
- MongoDB persistence for notification history

## Tech Stack

- Node.js + Express
- MongoDB + Mongoose
- Socket.IO for live updates
- RabbitMQ via amqplib
- Nodemailer for Gmail-based email delivery
- JWT-based cookie authentication
- dotenv and CORS middleware

## Project Structure

- server.js - Starts MongoDB, Socket.IO, RabbitMQ, and the web server
- src/app.js - Express app, protected routes, and notification API
- src/broker/rabbit.js - RabbitMQ connection and queue helpers
- src/broker/listener.js - Queue consumers for user and notification events
- src/config/config.js - Environment configuration
- src/email/email.js - Email transport and sending logic
- src/models/notification.model.js - Notification schema

## Environment Variables

Create a .env file in the service root with:

```env
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret
RABBITMQ_URI=amqp://localhost
EMAIL_USER=your_gmail_address
EMAIL_PASS=your_gmail_app_password
PORT=3001
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

The service runs on port 3001 by default.

## API Endpoints

### GET /api/notifications

Returns the 20 most recent notifications for the logged-in user and the unread count.

Requires a valid token cookie.

### PATCH /api/notifications/read

Marks all unread notifications for the authenticated user as read.

### POST /api/notification/test-email

Sends a test email. This endpoint does not require authentication.

Example body:

```json
{
  "to": "user@example.com",
  "subject": "Test notification"
}
```

## RabbitMQ Events

The service listens for these queues:

- user_created
  - Triggered when a new user registers in the auth service
  - Sends a welcome email to the new user

- notification_created
  - Triggered when another service wants to create a notification
  - Saves the notification in MongoDB
  - Emits a live Socket.IO event to the recipient room

Expected payload for notification_created:

```json
{
  "recipientId": "user-id",
  "actorId": "actor-id",
  "actorName": "Alice",
  "type": "like",
  "postId": "post-id",
  "reason": "optional reason"
}
```

## Socket.IO

The service creates a Socket.IO server on the same HTTP server and lets clients join a room using their user ID. When a notification is created for that user, the service emits a notification:new event to that room.

## Notes

- Protected endpoints require a valid token cookie.
- RabbitMQ reconnection is retried automatically if the broker is unavailable.
- Email delivery depends on Gmail SMTP credentials being configured correctly.