# Notification Service

This service handles email notifications for VerbaScope Social ML.

Its current role is to:
- Listen for user registration events from RabbitMQ
- Send a welcome email to newly registered users
- Provide a test endpoint for manual email checks

## Current Runtime Flow

1. The service starts Express on port 3001 by default.
2. On startup, it connects to RabbitMQ.
3. It subscribes to the user_created queue.
4. For each received message, it composes and sends a welcome email using Gmail OAuth2 via Nodemailer.

## Tech Stack

- Node.js (ES modules)
- Express
- Nodemailer (Gmail OAuth2)
- RabbitMQ (amqplib)
- dotenv
- morgan

## Folder Structure

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
    └── email/
        └── email.js
```

## Environment Variables

Defined in src/config/config.js:

Required for current behavior:
- RABBITMQ_URI
- EMAIL_USER
- CLIENT_ID
- CLIENT_SECRET
- REFRESH_TOKEN
- ACCESS_TOKEN

Present in config but not currently used by notification-service runtime logic:
- MONGO_URI
- JWT_SECRET

Example .env template:

```env
RABBITMQ_URI=amqps://username:password@host/vhost
EMAIL_USER=your-email@gmail.com
CLIENT_ID=your-google-oauth-client-id
CLIENT_SECRET=your-google-oauth-client-secret
REFRESH_TOKEN=your-google-oauth-refresh-token
ACCESS_TOKEN=your-google-oauth-access-token

# Declared in config but currently unused by this service:
MONGO_URI=mongodb://localhost:27017/verbascope
JWT_SECRET=replace_me
```

Do not commit real credentials or tokens.

## Installation and Run

From services/notification-service:

```bash
npm install
npm run dev
```

or

```bash
npm start
```

Default URL:
- http://localhost:3001

## API Endpoint

### Test Email

POST /api/notification/test-email

Request body:

```json
{
  "to": "user@example.com",
  "subject": "Test notification"
}
```

Behavior:
- If to is missing, a default recipient configured in code is used.
- If subject is missing, a default subject is used.
- Sends a plain text and HTML test email.

Success response:

```json
{
  "success": true,
  "message": "Email sent successfully"
}
```

Error response:

```json
{
  "success": false,
  "message": "<error message>"
}
```

## Queue Subscription

Queue name:
- user_created

Expected message shape:

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

On each message:
- The service generates a welcome email template.
- Sends the email to the message email value.
- Acknowledges the message in RabbitMQ after callback execution.

## Notes

- This service does not currently expose health check endpoints.
- RabbitMQ connection or channel failures are logged to console.
- Nodemailer transporter verification runs at startup and logs readiness/errors.
