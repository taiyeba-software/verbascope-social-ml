# Verbascope Frontend

**AI-powered social media analysis frontend that detects sarcasm, sentiment, and emotional tone.**

> Built with Next.js 16, React 19, and TypeScript.

---

## 🎯 Core Features

- Email/password authentication and Google OAuth
- Protected routes through `AuthProvider` and `ProtectedRoute`
- Real-time feed with likes, comments, shares, bookmarks, and pagination
- Mobile-responsive UI with trending chips and inline recommendations
- Centralized Axios API client for auth, notification, and post services

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 |
| UI Library | React 19 |
| Language | TypeScript 5 |
| HTTP Client | Axios 1.6.2 |
| Icons | Lucide React |
| Styling | CSS Variables + Vanilla CSS |
| Package Manager | npm / pnpm |

---

## 📁 Project Structure

```
frontend/
├── app/
│   ├── layout.tsx           # Root layout with AuthProvider + ProtectedRoute
│   ├── page.tsx             # Landing page
│   ├── globals.css          # Global CSS variables and base styles
│   ├── home.css             # Landing page styles
│   ├── auth/                # Authentication pages
│   │   ├── login/
│   │   └── register/
│   └── feed/                # Feed page and styles
│       ├── page.tsx
│       └── feed.css
│
├── components/
│   ├── Navbar.tsx           # Header navigation
│   ├── Navbar.css
│   ├── auth-provider.tsx    # Auth context provider
│   ├── CreatePostBox.tsx    # Post composer UI
│   ├── FeedSkeleton.tsx     # Loading skeleton component
│   ├── ProtectedRoute.tsx   # Auth route guard
│   ├── theme-provider.tsx   # Theme utilities
│   ├── feed/
│   │   ├── CommentSection.tsx
│   │   ├── PostCard.tsx
│   │   ├── Sidebar.tsx
│   │   ├── ShareSheet.tsx
│   │   ├── MobileTrendingBar.tsx
│   │   ├── WhoToFollowInline.tsx
│   │   └── useFeedSocket.ts
│   └── ui/                  # Shared design system components
│       ├── button.tsx
│       ├── input.tsx
│       ├── card.tsx
│       └── ...
│
├── hooks/
│   ├── useAuth.ts           # Auth hook wrapper
│   ├── use-mobile.ts        # Mobile helper hook
│   └── use-toast.ts
│
├── lib/
│   ├── api.ts               # Axios client + service wrappers
│   └── utils.ts             # Utility helpers
│
├── types/
│   └── index.ts             # Shared TypeScript types
│
├── docs/                    # Project documentation
├── public/                  # Static assets and favicon
├── components.json          # Shadcn UI config
├── next.config.mjs          # Next.js config
├── postcss.config.mjs       # PostCSS config
├── tsconfig.json            # TypeScript config
├── package.json             # Scripts and dependencies
└── pnpm-lock.yaml           # pnpm lockfile
```

---

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- pnpm 8+ or npm
- Backend services available locally:
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

### Run locally

```bash
npm run dev
```

The frontend starts on `http://localhost:3002`.

### Production build

```bash
npm run build
npm start
```

### Lint

```bash
npm run lint
```

---

## 🌐 Environment Variables

The frontend supports these environment variables:

```env
NEXT_PUBLIC_AUTH_API_URL=http://localhost:3000
NEXT_PUBLIC_NOTIFICATION_API_URL=http://localhost:3001
NEXT_PUBLIC_POST_API_URL=http://localhost:3003
NEXT_PUBLIC_AUTH_URL=http://localhost:3000
```

Default values are provided in `lib/api.ts`.

---

## 🧠 Architecture

### Authentication flow

- `app/layout.tsx` wraps the app with `AuthProvider` and `ProtectedRoute`
- `AuthProvider` hydrates session state from `/api/auth/me`
- `useAuth()` exposes `user`, `isLoading`, `error`, `login`, `logout`, and more
- Protected pages redirect unauthenticated users to `/auth/login`

### API client

`lib/api.ts` defines:
- `authApi` and `authService` for authentication
- `userService` for follow/friend actions
- `notificationService` for notification endpoints
- `postApi` and `postService` for feed/post operations

### Feed experience

- `app/feed/page.tsx` manages feed loading, pagination, comments, likes, and shares
- `useFeedSocket` handles trending tags and live pulse updates
- `PostCard`, `CommentSection`, `ShareSheet`, `MobileTrendingBar`, and `WhoToFollowInline` compose the feed UI

---

## 📌 Notes

- The frontend uses cookie-based auth with `withCredentials: true`
- `AuthProvider` handles session persistence via auth service cookies
- The mobile feed uses `.mobile-only` wrappers and mobile-specific UI components
- `components.json` configures the local Shadcn UI component registry

---

## 📚 Documentation

See the `docs/` folder for architecture, design, and implementation notes.


All requests to `http://localhost:3000`:

| Method | Endpoint | Purpose | Auth Required |
|--------|----------|---------|----------------|
| POST | `/api/auth/register` | Create new account | ❌ |
| POST | `/api/auth/login` | Email/password login | ❌ |
| GET | `/api/auth/me` | Get current user | ✅ |
| POST | `/api/auth/logout` | Clear session | ✅ |
| GET | `/api/auth/google` | Start Google OAuth | ❌ |
| GET | `/api/auth/google/callback` | OAuth callback | ❌ |

### Request/Response Format

**Register/Login Request:**
```typescript
{
  email: string;
  password: string;
  fullname?: { firstName: string; lastName: string; }
}
```

**Success Response:**
```typescript
{
  success: true;
  message: string;
  user: {
    id: string;
    email: string;
    fullname: { firstName: string; lastName: string; }
    role?: string;
    createdAt?: string;
  }
  token?: string;
}
```

**Error Response:**
```typescript
{
  status: number;              // 400, 401, 500, etc.
  message: string;             // "Invalid credentials"
  code?: string;               // "ECONNREFUSED", "CORS", etc.
}
```

---

## 🔐 Authentication Details

### Session Management

- **Token Storage**: httpOnly cookie (secure, not accessible to JavaScript)
- **Token Expiry**: 2 days (48 hours)
- **Cookie Name**: `token`
- **SameSite Policy**: `lax`

### Google OAuth Flow

1. User clicks "Sign in with Google"
2. Frontend redirects to `/api/auth/google` (backend endpoint)
3. Backend redirects to Google login
4. User authenticates with Google
5. Backend receives code, exchanges for token
6. Backend creates JWT, sets cookie, redirects to `/feed`

### Error Handling

- **401 Unauthorized**: Normal on first visit (no cookie), silently logged
- **403 Forbidden**: Auth token invalid/expired
- **Network Error**: Auth service unreachable, connection refused
- **Form Validation**: Client-side validation before submission

---

## 📦 Components

### Core Components

**Navbar.tsx**
- Global navigation bar
- Verbascope logo with V-triangle
- Live Feed indicator
- Activity button
- Responsive: collapses on mobile

**AuthProvider.tsx**
- Global auth state context
- Session hydration on app load
- Login/register/logout methods
- Error handling and loading states

**CreatePostBox.tsx**
- Post creation interface
- Textarea for content input
- ML signal badges (sarcasm, tone, sentiment)
- Submit button

**FeedSkeleton.tsx**
- Loading skeleton for posts
- Placeholder animations
- Matches post card layout

### UI Components

30+ shadcn/ui components available:
- Form inputs (text, textarea, checkbox, select)
- Buttons (primary, ghost, outline)
- Cards, dialogs, modals
- Dropdowns, menus, tooltips
- Pagination, badges, alerts

---

## 📝 TypeScript Types

### User & Auth

```typescript
interface User {
  id: string;
  email: string;
  fullname: { firstName: string; lastName: string; };
  role?: string;
  createdAt?: string;
}

interface AuthResponse {
  success: boolean;
  message: string;
  user?: User;
  token?: string;
}
```

### Forms

```typescript
interface RegisterFormData {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
}

interface LoginFormData {
  email: string;
  password: string;
  rememberMe?: boolean;
}
```

### ML Signals

```typescript
interface MLSignal {
  sentiment: 'positive' | 'negative' | 'neutral';
  toxicity_score: number;
  sarcasm: boolean;
  risk_flag: 'green' | 'yellow' | 'red';
}

interface Post {
  id: string;
  author: User;
  content: string;
  signal?: MLSignal;
  createdAt: string;
  likes: number;
  comments: number;
}
```

---

## 🎯 Pages

### `/` (Home/Landing)
- Hero section with V-triangles
- Feature showcase (Sarcasm, Sentiment, ML Intelligence)
- Sign In / Create Account buttons
- Mock post example with ML signal badges

### `/auth/login`
- Email/password login form
- "Remember me" checkbox
- Google OAuth button
- Link to register page

### `/auth/register`
- First/Last name fields
- Email and password inputs
- Password confirmation
- Terms acceptance checkbox
- Link to login page

### `/feed`
- Post feed (authenticated users only)
- Create post box
- Post cards with ML analysis
- Live indicator
- ML signal badges per post

---

## 🐛 Debugging

### Console Logs

Expected logs:
- ✅ `✅ Session hydrated: user@email.com` — User logged in
- ℹ️ `ℹ️ No active session` — Normal on first visit/after logout

Errors to investigate:
- ❌ `[API Error] Network Error` — Backend not running
- ❌ `[API Error] CORS error` — Backend CORS misconfigured
- ❌ `[API Error] 401 Unauthorized` — Session expired

### Common Issues

**"Network Error" on page load**
- Auth service not running on `localhost:3000`
- Check: `npm start` in `services/auth-service/`

**Favicon not showing**
- Hard-refresh: `Ctrl+Shift+R`
- Check: `public/favicon.svg` exists

**Forms not submitting**
- Check browser console for errors
- Verify backend running and CORS configured
- Check network tab for failed requests

**Style glitches**
- CSS variables not applied correctly
- Check: `app/globals.css` loaded
- Browser cache: hard-refresh

---

## 📚 Documentation

Additional documentation in `docs/`:

- **ARCHITECTURE.md** — High-level system design
- **V_TRIANGLE_GUIDE.md** — V-Triangle decoration system
- **DESIGN_QUICK_REFERENCE.md** — Design tokens and patterns
- **IMPLEMENTATION_COMPLETE.md** — Frontend implementation status

---

## 🔄 Environment Setup

### Environment Variables

No `.env` file required. Defaults:
- Backend Auth Service: `http://localhost:3000`
- Frontend Dev Server: `http://localhost:3002`

To override, set in `.env.local`:
```bash
NEXT_PUBLIC_API_URL=http://localhost:3000
NEXT_PUBLIC_CLIENT_URL=http://localhost:3002
```

---

## 🚢 Deployment

### Build for Production

```bash
npm run build
npm start
```

### Vercel (Recommended for Next.js)

```bash
vercel
```

Environment variables on Vercel:
- `NEXT_PUBLIC_API_URL` → Your backend URL
- `NEXT_PUBLIC_CLIENT_URL` → Your frontend URL

---

## 📋 Scripts

```bash
npm run dev       # Start development server (Turbopack)
npm run build     # Build for production
npm start         # Start production server
npm run lint      # Run ESLint
```

---

## 🤝 Contributing

### Code Style

- **Formatting**: Consistent with Prettier defaults
- **Type Safety**: Strict TypeScript enabled
- **Naming**: camelCase for variables/functions, PascalCase for components/types
- **Components**: Functional components with hooks
- **Styling**: CSS Variables for theme, vanilla CSS for components

### Best Practices

- Use `useAuth()` hook to access auth state
- Keep components small and focused
- Extract magic numbers into constants
- Add TypeScript types for all props
- Test responsiveness on mobile

---

## 📄 License

Part of Verbascope final year project.

---

## 👤 Author

Built by the Verbascope team — AI-Powered Social Intelligence Platform.

---

**Happy coding! 🕵️‍♂️**