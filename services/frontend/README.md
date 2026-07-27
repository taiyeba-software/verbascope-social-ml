# Verbascope — Frontend (Next.js)

This folder contains the Next.js frontend for Verbascope. It includes the public landing page, authentication flows, the protected social feed, profile pages, and real-time interactions.

## Quick summary

- Framework: Next.js (App Router)
- React: 19.x, TypeScript
- Default dev port: 3002

## Prerequisites

- Node.js 18+ (recommend 18 or 20)
- npm (comes with Node) or pnpm/yarn if you prefer
- Other services running locally for full integration: auth, post, notification services (see Environment Variables)

## Environment variables

Create a `.env.local` file in this folder with the backend endpoints you use for local development. Example:

```env
NEXT_PUBLIC_AUTH_API_URL=http://localhost:3000
NEXT_PUBLIC_NOTIFICATION_API_URL=http://localhost:3001
NEXT_PUBLIC_POST_API_URL=http://localhost:3003
NEXT_PUBLIC_AUTH_URL=http://localhost:3000
```

These values are referenced by `lib/api.ts` and the OAuth flow.

## Install

From the `services/frontend` directory:

```bash
npm install
```

If you use `pnpm` or `yarn`, run the appropriate install command. Both `package-lock.json` and `pnpm-lock.yaml` are present; the repo does not enforce a single package manager.

## Available scripts

Inspect `package.json` for the canonical scripts. Common commands:

```bash
npm run dev    # start dev server (Next.js) on port 3002
npm run build  # create production build
npm start      # start production server on port 3002
npm run lint   # run linter (if configured)
```

The dev server is configured to run on port `3002` by default.

## Development notes

- The app uses Socket.IO client for realtime feed and notifications.
- Authentication is cookie-based and handled by the backend auth service.
- There is a small inline script in `app/layout.tsx` that initializes the UI theme from `localStorage` or a server-provided cookie to avoid flash-of-unstyled-theme.
- If you need to run the frontend alongside other services, start the auth, post, and notification services first (see their respective README files).

## Project layout
   
- `app/` — Next.js App Router pages and route-specific CSS
  - `app/layout.tsx` — root layout that resolves theme from cookies, supplies providers, and wraps protected routes
  - `app/page.tsx` — public landing page hero and feature grid
  - `app/home.css` — landing page styles and hero visuals
  - `app/auth/auth.css` — shared authentication page styling
  - `app/auth/login/page.tsx` — login screen with validation, error handling, and Google OAuth
  - `app/auth/register/page.tsx` — registration screen with form validation and Google OAuth
  - `app/feed/page.tsx` — protected feed page, post loading, likes/comments/shares, and live socket syncing
  - `app/feed/feed.css` — feed page layout and responsive styles
  - `app/feed/MobileTrendingBar.tsx` — mobile trending tag bar
  - `app/feed/WhoToFollowInline.tsx` — inline follow recommendations
  - `app/profile/[id]/page.tsx` — user profile page shell
 
- `components/` — reusable UI pieces and application providers
  - `components/auth-provider.tsx` — authentication context and session hydration
  - `components/ProtectedRoute.tsx` — route guard for authenticated pages
  - `components/theme-provider.tsx` — theme context and cookie/localStorage synchronization
  - `components/ThemeToggle.tsx` — light/dark mode toggle UI
  - `components/Navbar.tsx` — app navigation and user menu
  - `components/CreatePostBox.tsx` — post composer for new content
  - `components/FeedSkeleton.tsx` — feed loading placeholder
  - `components/SidebarSkeleton.tsx` — sidebar loading placeholder
  - `components/feed/PostCard.tsx` — individual post card with actions
  - `components/feed/CommentSection.tsx` — post comment UI and layout
  - `components/feed/CommentThread.tsx` — nested comment replies UI
  - `components/feed/PostMoreMenu.tsx` — additional post actions menu
  - `components/feed/ShareSheet.tsx` — share dialog
  - `components/feed/Sidebar.tsx` — feed sidebar with trending and recommendations
  - `components/feed/useFeedSocket.ts` — socket integration for live feed and trends
  - `components/feed/icons.tsx` — shared feed icon helpers
  - `components/feed/feedHelpers.ts` — feed-specific utility helpers
 
- `hooks/` — reusable client-side hooks
  - `hooks/useAuth.ts` — hook to consume auth context
  - `hooks/useTheme.ts` — hook to consume theme context
  - `hooks/useDwellTracker.ts` — track how long users view posts
  - `hooks/use-toast.ts` — toast notification helper
  - `hooks/use-mobile.ts` — mobile detection helper
 
- `lib/` — API layer and shared utilities
  - `lib/api.ts` — Axios wrapper and shared backend service clients
  - `lib/api/posts.ts` — post service re-export
  - `lib/utils.ts` — client helper functions
 
- `types/` — shared TypeScript data models and API types
- `public/` — static assets and public media
- `styles/` — shared CSS and styling utilities
- Auth service: `/api/auth/*` (register, login, me, logout, google OAuth)
- Post service: `/api/posts/*` (feed, create, like, comment, delete, dwell)
- Notification service: `/api/notifications/*`
- User service: `/api/users/*`

## Troubleshooting

- If pages fail to render in dev, check the terminal for Next.js errors and verify the backend services are running and reachable at the URLs in `.env.local`.
- If images or uploads fail, ensure the post-service and external storage (if configured) are available.

## Contributing

- Follow existing code style in `components/` and `app/`.
- Add TypeScript types to `types/` when expanding API payloads.

---

If you'd like, I can also add a short `Makefile` or `dev` script to start the frontend plus local backend services together.
