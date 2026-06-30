# VerbaScope Social ML

VerbaScope Social ML is a distributed social intelligence platform that combines a Next.js frontend with backend services for authentication, posts, notifications, and machine learning analysis.

The project now has a real, working backend workflow — including protected routes, full CRUD operations, pagination, likes, comments, validation, authorization, atomic counters, MongoDB indexes, duplicate prevention, and tested edge cases.

---

## ✅ What Works Today

- Protected API routes that require a logged-in user
- A complete post creation, retrieval, and deletion workflow
- Paginated feed retrieval (loads posts in pages, not all at once)
- Like and unlike system, with protection against duplicate likes
- Comment creation, listing, and deletion
- Request validation and authorization checks on every protected route
- Atomic counters for likes and comments (so counts stay accurate even with many users acting at once)
- MongoDB indexing for faster feed loading and lookups
- Tested edge cases, including invalid IDs and repeated like attempts

---

## 🛠️ Tech Stack

VerbaScope is a polyglot, multi-service project. Here's everything used across the stack:

| Category | Technology | Used In |
|---|---|---|
| Frontend Framework | Next.js 16 | Frontend |
| UI Library | React 19 | Frontend |
| Language | TypeScript 5 | Frontend |
| Language | Node.js (ES Modules) | Auth, Post, Notification services |
| Backend Framework | Express 5 | Auth, Post, Notification services |
| Database | MongoDB | Auth, Post, Notification services |
| Database ODM | Mongoose | Auth, Post, Notification services |
| Messaging / Events | RabbitMQ (`amqplib`) | All backend services |
| Real-Time Updates | Socket.IO | Post, Notification services, Frontend |
| Authentication | JWT (JSON Web Tokens) + httpOnly cookies | Auth Service, all protected routes |
| OAuth | Passport.js + Google OAuth 2.0 | Auth Service |
| Password Security | bcrypt | Auth Service |
| Image Hosting | ImageKit | Post Service |
| Email Delivery | Nodemailer (Gmail SMTP) | Notification Service |
| HTTP Client | Axios | Frontend |
| Validation | Express Validator | Auth, Post services |
| Logging | Morgan | Auth, Post, Notification services |
| Icons | Lucide React | Frontend |
| Styling | CSS Variables + Vanilla CSS | Frontend |
| Package Managers | npm / pnpm | All services |

---

## 🧩 Architecture Overview

VerbaScope is built as a set of small, independent backend services (a microservice-style architecture) sitting behind a single Next.js frontend. Each service owns its own database collections and exposes its own REST API, and services talk to each other indirectly through RabbitMQ events rather than calling each other directly. This keeps services loosely coupled — for example, the Notification Service doesn't need to know how the Post Service works internally; it just reacts to events like `post.liked` or `comment.added`.

```
                     ┌────────────────────┐
                     │  Frontend (Next.js)  │
                     │   localhost:3002      │
                     └──────────┬─────────┘
                                │  REST + cookies + Socket.IO
        ┌───────────────────────┼───────────────────────┐
        │                       │                       │
┌───────▼────────┐     ┌────────▼────────┐     ┌────────▼─────────────┐
│  Auth Service   │     │  Post Service    │     │ Notification Service │
│  localhost:3000 │     │  localhost:3003  │     │  localhost:3001       │
└───────┬─────────┘     └────────┬────────┘     └────────┬─────────────┘
        │                        │                        │
        └───────────► RabbitMQ (event bus) ◄───────────────┘
                                │
                       (future) ML Service
                       sarcasm / sentiment / tone
```

**How it fits together:**

- The **Frontend** is the only thing end users interact with directly. It calls each backend service's REST API and listens for live updates through Socket.IO.
- The **Auth Service** is the source of truth for user identity. It issues a `token` cookie that the other services trust to identify who's making a request.
- The **Post Service** owns posts, likes, comments, shares, and trending data, and is the main thing users interact with after logging in.
- The **Notification Service** doesn't talk to the Post or Auth services directly — instead, it listens for events on RabbitMQ (like `user_created` or `notification_created`) and reacts by sending emails or saving/pushing notifications.
- **RabbitMQ** acts as the messenger between services, so they can stay independent and don't break if one of them is temporarily down.
- The **ML Service** is planned for later, and will plug into this same event-driven setup to analyze posts for sarcasm, sentiment, and tone.

---

## 🗂️ Services

### Frontend

The Next.js website that users interact with — handles login screens, the feed, and the overall user experience.

- Location: `frontend/`
- Full docs: [frontend/README.md](frontend/README.md)

### Auth Service

Handles account registration, email/password login, "Sign in with Google," issuing secure login tokens, and looking up the current logged-in user.

- Location: `auth-service/`
- Full docs: [auth-service/README.md](auth-service/README.md)

### Post Service

Handles creating posts, loading the feed, likes, comments, and deleting posts.

- Location: `post-service/`
- Full docs: [post-service/README.md](post-service/README.md)

### Notification Service

Listens for events happening elsewhere in the system (like a new comment or like) and turns them into emails or in-app notifications, delivered through RabbitMQ.

- Location: `notification-service/`
- Full docs: [notification-service/README.md](notification-service/README.md)

### ML Service

Reserved for upcoming machine learning features, such as detecting sarcasm, sentiment, and emotional tone in posts.

- Location: `ml-service/`
- *(Documentation coming once this service is built out)*

---

## 📌 Project Status

The backend has moved well past basic scaffolding and now reflects real, service-level engineering concerns:

- Route protection (only logged-in users can access certain endpoints)
- Concurrency-safe counters (likes/comments stay accurate under heavy use)
- Duplicate prevention enforced at the database level
- Proper validation and error handling
- Clear separation between services, communicating through events rather than being tightly connected

---

## 🛣️ Recommended Next Steps

- Connect the frontend to the verified Post Service endpoints
- Expand the ML Service to add sarcasm and sentiment scoring
- Add more end-to-end tests that check the full path across multiple services
- Document how to deploy and configure the entire stack for production

---

## 📚 Service Documentation

Each service keeps its own README with setup instructions and full API details. If you want to run or debug a single service on its own, start with that service's documentation:

- [Frontend README](frontend/README.md)
- [Auth Service README](auth-service/README.md)
- [Post Service README](post-service/README.md)
- [Notification Service README](notification-service/README.md)