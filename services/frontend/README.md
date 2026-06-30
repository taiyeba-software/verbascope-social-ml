# Verbascope Frontend

**The web app for Verbascope — an AI tool that reads social media posts and detects sarcasm, sentiment, and emotional tone.**

> Built with Next.js 16, React 19, and TypeScript.

---

## 🎯 What This App Does

This is the part of Verbascope that people actually see and use in their browser. It lets users:

- Sign up, log in, or sign in with Google
- View their feed after logging in
- See live updates (new likes, comments, etc.) without refreshing the page
- Create posts with text and images
- Like, comment on, and share posts
- Get post and people recommendations based on what they read
- See trending hashtags
- Connect to the other Verbascope backend services (login, notifications, posts)

---

## 🛠️ Tech Stack

| Layer | Technology | What it's for |
|-------|-------------|----------------|
| Framework | Next.js 16 | Builds and serves the website |
| UI Library | React 19 | Builds the interface users interact with |
| Language | TypeScript 5 | JavaScript with extra error-checking |
| HTTP Client | Axios | Sends requests to backend services |
| Icons | Lucide React | Provides icon graphics |
| Styling | CSS Variables + Vanilla CSS | Controls colors, spacing, and layout |
| Package Manager | npm / pnpm | Installs and manages code libraries |

---

## 📁 Project Structure

```
frontend/
├── app/
│   ├── layout.tsx
│   ├── page.tsx
│   ├── globals.css
│   ├── home.css
│   ├── auth/
│   │   ├── login/
│   │   └── register/
│   ├── feed/
│   │   ├── page.tsx
│   │   ├── feed.css
│   │   ├── MobileTrendingBar.tsx
│   │   └── WhoToFollowInline.tsx
│   └── profile/
│       └── [id]/page.tsx
├── components/
│   ├── Navbar.tsx
│   ├── auth-provider.tsx
│   ├── CreatePostBox.tsx
│   ├── FeedSkeleton.tsx
│   ├── ProtectedRoute.tsx
│   ├── theme-provider.tsx
│   ├── feed/
│   │   ├── CommentSection.tsx
│   │   ├── PostCard.tsx
│   │   ├── Sidebar.tsx
│   │   ├── ShareSheet.tsx
│   │   └── useFeedSocket.ts
│   └── ui/
├── hooks/
│   ├── useAuth.ts
│   ├── use-mobile.ts
│   ├── use-toast.ts
│   └── useDwellTracker.ts
├── lib/
│   ├── api.ts
│   └── utils.ts
├── types/
│   └── index.ts
├── docs/
├── public/
├── components.json
├── next.config.mjs
├── postcss.config.mjs
├── tsconfig.json
├── package.json
└── pnpm-lock.yaml
```

**Quick explanation of the folders:**

- `app/` — the actual pages of the site (login, register, feed, profile)
- `components/` — reusable pieces of UI, like the navbar and post cards
- `hooks/` — small reusable bits of logic (e.g. checking login state)
- `lib/` — shared helper code, including the file that talks to the backend
- `types/` — definitions describing the shape of the app's data

---

## 🚀 Getting Started

### Prerequisites

Before you begin, make sure you have:

- Node.js version 18 or newer
- npm or pnpm installed
- These backend services running locally:
  - Auth Service: `http://localhost:3000`
  - Notification Service: `http://localhost:3001`
  - Posts Service: `http://localhost:3003`

### Install dependencies

```bash
cd services/frontend
npm install
# or
pnpm install
```

### Run locally (development mode)

```bash
npm run dev
```

Then open `http://localhost:3002` in your browser.

### Production build

```bash
npm run build
npm start
```

### Lint (check your code for issues)

```bash
npm run lint
```

---

## 🌐 Environment Variables

Create a `.env` file with these values so the app knows where to find the backend services:

```env
NEXT_PUBLIC_AUTH_API_URL=http://localhost:3000
NEXT_PUBLIC_NOTIFICATION_API_URL=http://localhost:3001
NEXT_PUBLIC_POST_API_URL=http://localhost:3003
NEXT_PUBLIC_AUTH_URL=http://localhost:3000
```

These same addresses are also used as default values inside `lib/api.ts`, so the app can still run even if you don't set them yourself.

---

## 🧠 Architecture

### App shell

- `app/layout.tsx` wraps every page with the color theme, login state, and route protection
- `ProtectedRoute.tsx` makes sure only logged-in users can open the `/feed` page (currently the only page it protects)
- `AuthProvider` checks if the user is logged in by calling `/api/auth/me`

### API layer

- `lib/api.ts` sets up the connections to each backend service and makes sure login cookies are sent with every request
- It provides separate connections for auth, notifications, posts, and users
- The connection used for posts (`postApi`) is given more time to finish, since image uploads can take longer

### Real-time updates

- `components/feed/useFeedSocket.ts` connects to the Posts Service at `http://localhost:3003` to receive live updates
- `Navbar.tsx` connects to the Notification Service at `http://localhost:3001` for live alerts
- These live connections use **Socket.IO**, a technology that keeps an open line so updates appear instantly, without refreshing the page

---

## 🔧 Frontend Features

- Email and password login and registration
- "Sign in with Google" option
- Staying logged in through a secure cookie (not local browser storage)
- Creating posts with optional image uploads
- Liking, commenting, and sharing posts, with the screen updating right away
- Tracking which posts a user actually spends time looking at (used for recommendations)
- Recommended users and trending hashtags
- A profile page with follow/unfollow buttons and the ability to edit your own profile

---

## 📦 Key Components

### `Navbar.tsx`
Top navigation bar showing the user's avatar, a theme switch, and notifications. Works on both mobile and desktop, and updates live.

### `AuthProvider.tsx`
Keeps track of login state across the whole app. Handles logging in, logging out, registering, and restoring a saved session.

### `CreatePostBox.tsx`
The box where users write a new post and attach images. Shows a preview of selected photos before the post is submitted.

### `PostCard.tsx`
Displays a single post: author, timestamp, text, and images, along with like/comment/share/save buttons. Also tracks how long a user views it, using `useDwellTracker`.

### `CommentSection.tsx`
Shows comments under a post. Lets users add a comment (by pressing Enter or a button) and delete their own comments.

### `ShareSheet.tsx`
A small popup that appears when sharing a post, letting the user pick a reason (e.g. "funny," "insightful").

### `Sidebar.tsx`
Shows trending hashtags and a list of recommended people to follow, pulled from the Posts Service.

---

## 📜 Pages

- `/` — landing (home) page
- `/auth/login` — login form, including Google sign-in
- `/auth/register` — registration form
- `/feed` — main feed (visible only when logged in)
- `/profile/[id]` — a user's profile page

---

## 🔗 Backend Integration

### Auth Service

- `POST /api/auth/register` — create a new account
- `POST /api/auth/login` — log in
- `GET /api/auth/me` — check who is currently logged in
- `POST /api/auth/logout` — log out
- `GET /api/auth/google` — sign in with Google

### Post Service

- `GET /api/posts/feed` — get the main feed
- `POST /api/posts` — create a post
- `POST /api/posts/:id/like` — like a post
- `DELETE /api/posts/:id/unlike` — remove a like
- `POST /api/posts/:id/share` — share a post
- `DELETE /api/posts/:id/unshare` — undo a share
- `GET /api/posts/:id/comments` — get comments on a post
- `POST /api/posts/:id/comment` — add a comment
- `DELETE /api/posts/:postId/comments/:commentId` — delete your own comment
- `DELETE /api/posts/:id` — delete your own post
- `POST /api/posts/dwell` — record how long a post was viewed
- `GET /api/posts/recommendations/users` — get recommended people to follow

### Notification Service

- `GET /api/notifications` — get your notifications
- `PATCH /api/notifications/read` — mark notifications as read

### User Service

- `GET /api/users/bulk?ids=...` — get details for multiple users at once
- `POST /api/users/follow/:id` — follow a user
- `POST /api/users/unfollow/:id` — unfollow a user
- `GET /api/users/me/following` — see who you follow
- `GET /api/users/:id` — get one user's profile
- `PATCH /api/users/profile` — update your profile
- `PATCH /api/users/avatar` — update your profile picture

---

## ⚠️ Notes

- The app stays logged in using a secure backend cookie, not local browser storage
- `NEXT_PUBLIC_AUTH_URL` must be set correctly for Google sign-in to work
- `next.config.mjs` currently turns off image optimization and ignores TypeScript build errors
- Right now, `ProtectedRoute` only guards the `/feed` page — other pages aren't locked behind login yet

---

## 🐛 Debugging

- **"Network Error"** — usually means one of the backend services isn't running
- **"401 Unauthorized"** — the login cookie is missing or has expired
- **Google sign-in not working** — check that `NEXT_PUBLIC_AUTH_URL` is set correctly
- **Page looks outdated or broken** — try a hard refresh to clear cached files

---

## 📄 License

Part of the Verbascope final year project.

---

## 👤 Author

Verbascope frontend team.

---

**Happy coding! 🕵️‍♂️**