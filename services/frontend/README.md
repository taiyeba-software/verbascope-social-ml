# Verbascope Frontend

**AI-powered social media analysis platform that detects sarcasm, sentiment, and emotional tone.**

> Built with Next.js 16, React 19, and TypeScript. Inspired by Spy x Family's aesthetic with sophisticated "Loid Forger" theme.

---

## 🎯 Features

- **Sarcasm Detection** — Understand when people aren't saying what they mean
- **Sentiment Analysis** — Decode emotional tone in real-time
- **ML Intelligence** — Powered by advanced machine learning models
- **Authentication** — Email/password and Google OAuth integration
- **Live Feed** — Real-time social media post analysis
- **Responsive Design** — Works seamlessly on desktop and mobile

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| **Framework** | Next.js 16.2.4 (Turbopack) |
| **UI Library** | React 19 |
| **Language** | TypeScript 5 |
| **HTTP Client** | Axios 1.6.2 |
| **Icons** | Lucide React |
| **Styling** | CSS Variables + Vanilla CSS |
| **Package Manager** | pnpm (with npm lock compatibility) |

---

## 📁 Project Structure

```
frontend/
├── app/                    # Next.js App Router (main application)
│   ├── layout.tsx         # Root layout with global metadata
│   ├── page.tsx           # Home/landing page
│   ├── globals.css        # Global theme, CSS variables, animations
│   ├── home.css           # Landing page specific styles
│   ├── auth/              # Authentication pages
│   │   ├── login/
│   │   └── register/
│   └── feed/              # Feed page with post analysis
│
├── components/            # Reusable React components
│   ├── Navbar.tsx         # Main navigation bar
│   ├── Navbar.css
│   ├── auth-provider.tsx  # Global auth state & session management
│   ├── CreatePostBox.tsx  # Post creation form
│   ├── FeedSkeleton.tsx   # Loading skeleton
│   ├── theme-provider.tsx # Theme context provider
│   └── ui/                # Shadcn/UI components
│       ├── button.tsx
│       ├── input.tsx
│       ├── card.tsx
│       └── ... (30+ UI components)
│
├── hooks/                 # Custom React hooks
│   ├── useAuth.ts         # Hook to access auth context
│   ├── use-mobile.ts      # Mobile detection hook
│   └── use-toast.ts       # Toast notification hook
│
├── lib/                   # Utilities and helpers
│   ├── api.ts            # Axios API client with auth service
│   └── utils.ts          # General utility functions
│
├── types/                 # TypeScript type definitions
│   └── index.ts          # User, Auth, Post, MLSignal types
│
├── styles/               # Global styles
│   └── globals.css       # Additional global styles
│
├── public/               # Static assets
│   └── favicon.svg       # Verbascope V logo favicon
│
├── docs/                 # Documentation
│   ├── ARCHITECTURE.md
│   ├── V_TRIANGLE_GUIDE.md
│   └── ... (design & implementation docs)
│
└── Config Files
    ├── package.json       # Dependencies and scripts
    ├── tsconfig.json      # TypeScript configuration
    ├── next.config.mjs    # Next.js configuration
    ├── components.json    # Shadcn/UI component config
    └── postcss.config.mjs # PostCSS configuration
```

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** 18+ or **pnpm** 8+
- **Backend Services** running:
  - Auth Service: `http://localhost:3000`
  - Notification Service: `http://localhost:3001`

### Installation

```bash
# Navigate to frontend directory
cd services/frontend

# Install dependencies
npm install
# or with pnpm
pnpm install
```

### Development

```bash
# Start development server (runs on http://localhost:3002)
npm run dev

# Open browser and navigate to http://localhost:3002
```

The app will:
1. Load with hot-reload enabled (Turbopack)
2. Hydrate user session from auth service
3. Display loading state if auth service unreachable

### Production Build

```bash
# Build for production
npm run build

# Start production server
npm start

# Run linter
npm run lint
```

---

## 🏗️ Architecture

### Authentication Flow

```
User Registration/Login
    ↓
Frontend Form Input → axios POST to /api/auth/register | /api/auth/login
    ↓
Backend validates → creates JWT → sets httpOnly cookie
    ↓
Frontend receives response → AuthProvider updates global state
    ↓
User redirected to /feed
```

### Session Hydration

On every page load:
1. **AuthProvider** runs `hydrateSession()` in useEffect
2. Makes GET request to `/api/auth/me`
3. If 401 (no cookie) → silently log as info (expected on first visit)
4. If authenticated → store user in context
5. All child components can access user via `useAuth()` hook

### Global State Management

**AuthProvider** (`components/auth-provider.tsx`):
- Manages user auth state globally
- Handles register, login, Google OAuth, logout
- Session persistence via httpOnly cookies
- Provides `useAuth()` hook for components

```tsx
const { user, isLoading, error, login, logout } = useAuth();
```

### API Client

**Axios Instance** (`lib/api.ts`):
- Automatic error handling with clean error objects
- 401 responses: silently handled (session loss)
- Other errors: logged for debugging
- Credentials: enabled by default (for cookie-based auth)
- Timeout: 10 seconds
- Base URL: `http://localhost:3000`

---

## 🎨 Design System

### Theme Variables

All colors, spacing, fonts, and transitions defined in `app/globals.css`:

```css
:root {
  /* Backgrounds */
  --v-bg-primary: #6BA59E;      /* Soft sage teal */
  --v-bg-dark: #1A2A28;         /* Deep navy */
  --v-bg-light: #E8E3DB;        /* Warm cream */

  /* Text */
  --v-text-primary: #F5F0E8;    /* Paper cream */
  --v-text-secondary: #D0D9D6;  /* Soft gray */

  /* ML Signals */
  --v-signal-green: #6FBDB3;    /* Sarcasm/positive */
  --v-signal-yellow: #D4A574;   /* Caution */
  --v-signal-red: #C17B6D;      /* Risk/emotion */

  /* Typography */
  --v-font-serif-display: 'Bodoni Moda', Georgia, serif;
  --v-font-sans: 'Inter', system-ui, sans-serif;

  /* Transitions */
  --v-transition: 0.2s cubic-bezier(0.19, 1, 0.22, 1);
}
```

### V-Triangle Decoration System

Dotted right-angled triangles used as playful tactical decorations:

- **Sizes**: Small (60px), Medium (100px), Large (160px)
- **Animation**: `radar-sweep` 4s (clip-path reveal) or `triangle-pulse` 8s (subtle translation)
- **Clip-path**: `polygon(100% 0, 0 0, 100% 100%)` (right-angle at bottom-left)
- **Placement**: Landing page hero, auth pages

```css
.dot-triangle {
  clip-path: polygon(100% 0, 0 0, 100% 100%);
  background-image: radial-gradient(circle, var(--v-accent) var(--v-dot-size), transparent var(--v-dot-size));
  background-size: var(--v-gap) var(--v-gap);
}

.dot-triangle.landing-hero {
  animation: radar-sweep 4s cubic-bezier(0.19, 1, 0.22, 1) infinite;
}
```

### Colors

| Name | Hex | Usage |
|------|-----|-------|
| **Navy** | `#1A2A28` | Accent, text on light, borders |
| **Sage Teal** | `#6BA59E` | Primary background, navbar |
| **Cream** | `#E8E3DB` | Light backgrounds, light text |
| **Gold** | `#D4A574` | Sarcasm signals, highlights |
| **Terracotta** | `#C17B6D` | Emotion/risk alerts |
| **Sage Green** | `#6FBDB3` | Positive signals, success |

---

## 📡 API Integration

### Auth Service Endpoints

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