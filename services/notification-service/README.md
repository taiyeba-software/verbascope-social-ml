# Notification Service

**Handles sending emails, saving in-app notifications, and delivering live notification updates for VerbaScope.**

> Built with Node.js, Express 5, and Socket.IO.

---

## 🎯 What This Service Does

- Starts a web server (API) on port `3001`
- Connects to MongoDB (database) and RabbitMQ (messaging system) when it starts up
- Provides notification-related endpoints for the frontend to use
- Sends test emails using Gmail
- Listens for new-user events and sends a welcome email automatically
- Listens for notification events, saves them to the database, and sends live updates to users through Socket.IO

---

## 🛠️ Tech Stack

| Layer | Technology | What it's for |
|-------|-------------|----------------|
| Runtime | Node.js (ES modules) | Runs the JavaScript code |
| Framework | Express 5 | Builds the web server and API |
| Database tool | Mongoose | Talks to MongoDB |
| Real-time updates | Socket.IO | Sends live updates to users instantly |
| Messaging | RabbitMQ (via `amqplib`) | Lets this service talk to other services |
| Email | Nodemailer | Sends emails through Gmail |
| Config | dotenv | Loads settings from a `.env` file |
| Logging | morgan | Logs incoming requests for debugging |

---

## 📁 Folder Structure

```text
services/notification-service/
├── server.js
├── package.json
├── .env
└── src/
    ├── app.js
    ├── broker/
    │   ├── rabbit.js
    │   └── listener.js
    ├── config/
    │   └── config.js
    ├── email/
    │   └── email.js
    └── models/
        └── notification.model.js
```

**Quick explanation of the folders:**

- `server.js` — the starting point of the service
- `src/app.js` — sets up the web server itself
- `src/broker/` — code that connects to and listens to RabbitMQ
- `src/config/` — holds app settings
- `src/email/` — code that sends emails
- `src/models/` — describes what a "notification" looks like in the database

---

## 🚀 How the Service Starts Up (Runtime Flow)

When you run this service, here's what happens in order:

1. `server.js` loads the settings from your `.env` file and connects to MongoDB
2. The Express web server is created in `src/app.js`
3. Socket.IO is attached to the server, allowing users to "join a room" using their user ID, so they only receive their own notifications
4. The service connects to RabbitMQ and starts listening for two types of messages: `user_created` and `notification_created`
5. The server starts listening on the chosen `PORT` (defaults to `3001`)

---

## 🌐 Environment Variables

Create a `.env` file with the following values:

- `MONGO_URI` — the address of your MongoDB database
- `JWT_SECRET` — a secret key used to verify that a user is logged in
- `RABBITMQ_URI` — the address of your RabbitMQ messaging service
- `EMAIL_USER` — the Gmail address used to send emails
- `EMAIL_PASS` — the Gmail account password or app password used for sending emails

Example `.env` file:

```env
MONGO_URI=mongodb://localhost:27017/verbascope
JWT_SECRET=replace_me
RABBITMQ_URI=amqps://username:password@host/vhost
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-email-password-or-app-password
```

> **Note:** This service currently sends emails through Gmail, using the `EMAIL_USER` and `EMAIL_PASS` values above.

---

## 📡 API Endpoints

### `GET /api/notifications`

Gets the 20 most recent notifications for the logged-in user, plus how many are unread.

**Requires login** — the request must include a `token` cookie, which is checked using `JWT_SECRET`.

Example success response:

```json
{
  "success": true,
  "notifications": [/* notification list */],
  "unreadCount": 3
}
```

### `PATCH /api/notifications/read`

Marks all of the logged-in user's unread notifications as read.

Example success response:

```json
{
  "success": true,
  "message": "All notifications marked as read."
}
```

### `POST /api/notification/test-email`

Sends a test email. This endpoint does **not** require login.

Example request body:

```json
{
  "to": "user@example.com",
  "subject": "Test notification"
}
```

If you don't include `to` or `subject`, the service will use built-in default values instead.

Example success response:

```json
{
  "success": true,
  "message": "Email sent successfully"
}
```

---

## 📬 RabbitMQ Subscriptions

This service listens for messages on two queues:

- `user_created`
- `notification_created`

### `user_created`

This message is sent when a new user signs up elsewhere in the system.

Expected message format:

```json
{
  "email": "user@example.com",
  "role": "user",
  "fullname": {
    "firstName": "First",
    "lastName": "Last"
  }
}
```

**What the service does with it:**
- Sends a welcome email to the new user
- Confirms to RabbitMQ that the message was handled successfully

### `notification_created`

This message is sent whenever something happens that should notify a user (like getting a new like or comment).

Expected message format:

```json
{
  "recipientId": "<userId>",
  "actorId": "<actorUserId>",
  "actorName": "Alice",
  "type": "like" | "comment" | "share",
  "postId": "<postId>",
  "reason": "optional pass-forward reason"
}
```

**What the service does with it:**
- Skips the notification if the person who triggered it is the same as the person who would receive it (you don't get notified about your own actions)
- Builds a readable message based on the type of action (like, comment, or share)
- Saves the notification to the database
- Sends a live update (`notification:new`) to the recipient through Socket.IO

---

## 🗄️ Notification Model (What Gets Stored)

Each saved notification includes:

- `recipientId` — who the notification is for
- `actorId` — who triggered the notification
- `actorName` — the display name of that person
- `type` — what kind of action happened (`like`, `comment`, `share`)
- `postId` — which post the notification relates to
- `reason` — an optional extra note passed along with the notification
- `message` — the final, readable notification text shown to the user
- `isRead` — whether the user has seen it yet
- timestamps — when it was created/updated

---

## 🔌 Socket.IO (Live Updates)

- Clients connect to the Socket.IO server on port `3001`
- Only requests from `http://localhost:3002` are allowed (CORS restriction)
- When a user connects, their app sends a `join` event with their user ID, placing them into their own private "room"
- The service sends a `notification:new` event into that room whenever a new notification is created for that user

---

## ⚠️ Notes

- This service doesn't currently have a dedicated health-check endpoint (a simple "is it running?" check)
- If the RabbitMQ connection fails, the service automatically tries again every 5 seconds
- The email system is tested/verified once, when the service starts up
- All protected notification endpoints require a valid `token` cookie to work