# Verbascope Frontend

This is the Next.js frontend for VerbaScope. It provides the public landing page, authentication screens, a protected social feed, profile pages, and live social interactions for the wider platform.

## Overview

The frontend is a React and TypeScript app built with the Next.js App Router. It talks to the auth, post, notification, and user services over HTTP and uses Socket.IO for real-time updates such as likes, comments, shares, and notifications.

## Features

- Landing page and authentication flows
- Email/password login and registration
- Google OAuth sign-in
- Protected feed experience for authenticated users
- Post creation with image uploads
- Likes, comments, shares, and post deletion
- Profile viewing and editing, including avatar updates and follow/unfollow actions
- Recommendation and trending widgets
- Live notification and feed updates through Socket.IO

## Tech Stack

- Next.js 16
- React 19
- TypeScript
- Axios for API requests
- Socket.IO client for realtime updates
- Lucide React for icons
- CSS variables and custom CSS for styling

## Project Structure

- app/ - App Router pages and route-specific styles
  - app/page.tsx - landing/home page
  - app/auth/login and app/auth/register - auth screens
  - app/feed/page.tsx - main feed experience
  - app/profile/[id]/page.tsx - user profile page
- components/ - reusable UI and app-level providers
  - auth-provider.tsx - authentication context and session handling
  - ProtectedRoute.tsx - route guard for authenticated pages
  - Navbar.tsx, CreatePostBox.tsx, PostCard.tsx, Sidebar.tsx, ShareSheet.tsx
  - components/feed/ - feed-specific UI and socket integration
- hooks/ - reusable client-side hooks such as auth and dwell tracking
- lib/ - API client wrappers for the backend services
- types/ - TypeScript types for auth, posts, comments, and users

## Environment Variables

Create a .env.local file in the frontend root with:

```env
NEXT_PUBLIC_AUTH_API_URL=http://localhost:3000
NEXT_PUBLIC_NOTIFICATION_API_URL=http://localhost:3001
NEXT_PUBLIC_POST_API_URL=http://localhost:3003
NEXT_PUBLIC_AUTH_URL=http://localhost:3000
```

These values are used by the API client in lib/api.ts and by the Google OAuth flow.

## Installation

```bash
cd services/frontend
npm install
```

## Running the App

Development mode:

```bash
npm run dev
```

The app runs on port 3002 by default.

Production build:

```bash
npm run build
npm start
```

## Scripts

- npm run dev - start the development server
- npm run build - create a production build
- npm start - run the production build
- npm run lint - run Next.js linting if available

## Main Pages

- / - landing page
- /auth/login - login screen
- /auth/register - registration screen
- /feed - protected feed with posts and real-time updates
- /profile/[id] - user profile page

## Backend Integrations

The frontend connects to the following services:

- Auth service
  - POST /api/auth/register
  - POST /api/auth/login
  - GET /api/auth/me
  - POST /api/auth/logout
  - GET /api/auth/google

- Post service
  - GET /api/posts/feed
  - POST /api/posts
  - POST /api/posts/:id/like
  - DELETE /api/posts/:id/unlike
  - POST /api/posts/:id/share
  - DELETE /api/posts/:id/unshare
  - GET /api/posts/:id/comments
  - POST /api/posts/:id/comment
  - DELETE /api/posts/:postId/comments/:commentId
  - DELETE /api/posts/:id
  - POST /api/posts/dwell
  - GET /api/posts/recommendations/users

- Notification service
  - GET /api/notifications
  - PATCH /api/notifications/read

- User service
  - GET /api/users/bulk
  - GET /api/users/:id
  - PATCH /api/users/profile
  - PATCH /api/users/avatar
  - POST /api/users/follow/:id
  - POST /api/users/unfollow/:id
  - GET /api/users/me/following

## Notes

- Authentication uses a cookie-based session managed by the backend services.
- The feed is protected by ProtectedRoute and only becomes accessible for logged-in users.
- The app uses Socket.IO to receive live updates without requiring a full page refresh.
- The current Next.js config disables image optimization and ignores TypeScript build errors for local development convenience.
