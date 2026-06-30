# Post Service - Simple Guide

This is an easy-to-understand explanation of the Post Service. Think of it as the part of VerbaScope (a social media app) that handles everything about posts: making them, showing them in a feed, liking them, sharing them, and commenting on them.

## What does this service do?

In simple terms, this is the "posts brain" of the app. It lets users:

- Write a post with text and up to 4 pictures
- See a scrolling feed of posts (like Instagram or Twitter)
- Look at posts from one specific user
- Like or unlike a post
- Share or unshare a post (and say why they shared it)
- Add, view, or delete comments
- Get recommended people to follow, based on their interests
- See "trending" topics, like what's popular right now

## What tools and technology does it use?

- **Node.js** - the programming language environment
- **Express** - a tool to build the web server and handle requests
- **MongoDB** - the database where posts, comments, and users are stored
- **JWT (JSON Web Token)** - used to check that a user is logged in, stored in a cookie called `token`
- **Socket.IO** - sends live updates (so when someone likes a post, you see it instantly without refreshing)
- **RabbitMQ** - lets this service talk to other services in the background (like sending notifications)
- **ImageKit** - handles uploading and storing images

## How the project is organized

- `server.js` - the starting point; turns everything on (database, messaging, live updates)
- `src/app.js` - sets up the web server and connects all the routes (URLs)
- `src/config/config.js` - holds settings like the port number
- `src/db/db.js` - connects to the MongoDB database
- `src/broker/rabbit.js` - handles sending and receiving messages to other services
- `src/routes/posts.routes.js` - lists all the available URLs (endpoints) for posts
- `src/controllers/` - the actual code that runs when someone calls each URL
- `src/middlewares/` - checks things before a request goes through, like "is this user logged in?"
- `src/models/` - describes what a Post, Comment, or User looks like in the database
- `src/pulse/` - figures out what's trending right now
- `src/utils/` - small helper tools, like detecting what language a post is written in

## Setting it up (Environment Variables)

Before running the service, you need to create a `.env` file with these settings:

```dotenv
MONGO_URI=mongodb://...
JWT_SECRET=your_jwt_secret
RABBITMQ_URI=amqps://...
PORT=3003
CLIENT_URL=http://localhost:3002
IMAGEKIT_PUBLIC_KEY=...
IMAGEKIT_PRIVATE_KEY=...
IMAGEKIT_URL_ENDPOINT=...
```

What each one means:

- `MONGO_URI` - the address of your database (required)
- `JWT_SECRET` - a secret password used to verify logins; must be the same one used by the login service
- `RABBITMQ_URI` - address for the messaging system (if you don't set this, it tries `amqp://localhost:5672`)
- `PORT` - which port the service runs on (defaults to `3003` if not set)
- `CLIENT_URL` - the address of the front-end app (defaults to `http://localhost:3002`)
- The `IMAGEKIT_*` values - needed only if you want image uploads to work

## How to install and run it

First, install all the needed packages:

```bash
npm install
```

To run it while developing (it restarts automatically when you change code):

```bash
npm run dev
```

To run it normally, like in production:

```bash
npm start
```

## Where all the URLs live

Every URL for this service starts with:

```text
/api/posts
```

## List of available actions (Routes)

### Trending info
- `GET /api/posts/pulse/trending` - see what hashtags are trending
- `GET /api/posts/pulse/signal` - see the current activity level

### Posts
- `POST /api/posts` - create a new post
- `GET /api/posts/feed` - get the main feed of posts
- `GET /api/posts/user/:userId` - get posts from one specific user
- `GET /api/posts/:id` - get one specific post
- `DELETE /api/posts/:id` - delete your own post

### Likes
- `POST /api/posts/:id/like` - like a post
- `DELETE /api/posts/:id/unlike` - remove your like

### Shares
- `POST /api/posts/:id/share` - share a post
- `DELETE /api/posts/:id/unshare` - undo a share

### Comments
- `POST /api/posts/:id/comment` - add a comment
- `GET /api/posts/:id/comments` - see all comments on a post
- `DELETE /api/posts/:postId/comments/:commentId` - delete your own comment

### Other features
- `POST /api/posts/dwell` - tells the system how long you looked at a post (used to improve recommendations)
- `GET /api/posts/recommendations/users` - get suggested people to follow

## Rules for uploading images

- Images must be sent as `multipart/form-data` under the field name `images`
- You can upload up to 4 images per post
- Each image must be 5 MB or smaller
- Allowed image types: JPEG, PNG, WEBP, GIF

## How login/authentication works

To use most features, you need to be logged in. The service checks a small file called a "cookie" named `token`, which proves who you are. This cookie must be included automatically when your app makes requests (this is usually called "credentials" mode in code).

## Messages sent to other services (RabbitMQ)

**Messages it listens for:**
- `user_created` - when a new user signs up elsewhere, this service saves a local copy of their info

**Messages it sends out:**
- `post.created` - a new post was made
- `post.liked` - someone liked a post
- `comment.added` - someone added a comment
- `post.shared` - someone shared a post
- `notification_created` - tells the notification system to alert someone

## Live updates (Socket.IO)

These are instant updates sent to users without needing to refresh the page:

- `post:update` - sent when a post gets a like, comment, share, or unlike
- `pulse:trending` - sent when the trending list changes
- `pulse:update` - sent when overall activity changes

## What information is stored (Data Models)

### Post
Stores things like:
- Who wrote it (`author`)
- The text content, plus a cleaned-up version and detected language
- Hashtags and images
- Counts: how many likes, comments, and shares
- Lists of who liked it and who shared it
- Counts of *why* people shared it (e.g. "agree", "funny", "insightful")

### Comment
- Who wrote it
- Which post it belongs to
- The text (up to 500 characters)

### User
A local copy of basic user info (created when someone signs up), including email, full name, role, and interests.

### UserPulse
Keeps track of which hashtags each user seems interested in, used for recommending content and people.

## How it connects to other parts of the system

- It asks the login/auth service for user details (like names) when needed
- If the messaging system (RabbitMQ) isn't working when the service starts, the service still runs — but live updates and notifications won't work properly
- When the service starts up, it looks at existing posts to figure out what's currently trending

## Common errors and what they mean

- `401` - you're not logged in, or your login token is invalid
- `422` - something you submitted didn't pass validation (like missing required info)
- `404` - the post or comment you're looking for doesn't exist
- `409` - you already liked or shared this (can't do it twice)
