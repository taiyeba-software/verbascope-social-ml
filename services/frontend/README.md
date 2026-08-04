# Verbascope Frontend

This folder contains the Next.js frontend for Verbascope, a social media-style application with authentication, a personalized feed, user profiles, bookmarks, search, and post interactions.

## Overview

The frontend is built with Next.js and TypeScript and provides the user-facing experience for the Verbascope platform. It includes:

- a public landing page
- login and registration flows
- protected pages for the social feed and user activity
- post detail and profile views
- bookmarks and search experience
- light/dark theme support and responsive layouts

## Tech stack

- Next.js 16
- React 19
- TypeScript
- Axios for API requests
- Socket.IO client for real-time updates
- CSS and component-based UI styling

## Project structure

- app/ — route-level pages and route-specific styles
  - app/page.tsx — landing page
  - app/auth/login/page.tsx — login page
  - app/auth/register/page.tsx — registration page
  - app/feed/page.tsx — main feed experience
  - app/post/[id]/page.tsx — post detail page
  - app/profile/[id]/page.tsx — user profile page
  - app/search/page.tsx — search experience
  - app/bookmarks/page.tsx — bookmarked posts page
- components/ — reusable UI components, providers, and feature blocks
- hooks/ — custom React hooks for auth, theme, tracking, and notifications
- lib/ — shared API client and utility helpers
- types/ — TypeScript interfaces and shared data models
- public/ — static assets
- styles/ — shared styling resources

## Prerequisites

- Node.js 18 or newer
- npm, pnpm, or yarn

## Setup

From this folder, install dependencies:

```bash
npm install
```

Create a .env.local file with the backend endpoints you want the frontend to use:

```env
NEXT_PUBLIC_AUTH_API_URL=http://localhost:3000
NEXT_PUBLIC_NOTIFICATION_API_URL=http://localhost:3001
NEXT_PUBLIC_POST_API_URL=http://localhost:3003
NEXT_PUBLIC_AUTH_URL=http://localhost:3000
```

Start the development server:

```bash
npm run dev
```

The app will be available at http://localhost:3002.

## Available scripts

- npm run dev — start the development server
- npm run build — create a production build
- npm start — run the production build
- npm run lint — run the linter if configured

## Backend integration

The frontend expects the following backend services to be available during development:

- Auth service for login, registration, session handling, and OAuth
- Post service for feed, posts, likes, comments, and shares
- Notification service for live notifications
- User service for profile-related requests

## Notes

- Authentication is handled through backend services and session-based flows.
- The app uses Socket.IO for live feed and notification updates.
- Theme initialization is handled to reduce flash of unstyled content.
- The Next.js configuration keeps builds flexible by ignoring some TypeScript build errors and using unoptimized images.

## Contribution guidance

- Keep components organized under the components folder.
- Add shared types to the types folder when expanding API payloads.
- Follow the existing app routing conventions under the app directory.
