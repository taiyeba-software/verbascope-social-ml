# Verbascope Frontend — Step 1 Complete ✅

Professional frontend structure for **Verbascope**, an AI-powered social media analysis platform that detects sarcasm, sentiment, and emotional tone.

---

## 📁 Project Structure

```
verbascope-frontend/
├── app/
│   ├── layout.tsx              # Root layout with metadata
│   ├── globals.css             # Verbascope theme (Spy x Family aesthetic)
│   ├── page.tsx                # Landing page hero
│   ├── home.css                # Landing styles
│   ├── auth/
│   │   ├── login/page.tsx       # Login page (email + password)
│   │   ├── register/page.tsx    # Register page (full signup)
│   │   └── auth.css             # Shared auth styles (split layout)
│   └── feed/
│       ├── page.tsx             # Feed page skeleton
│       └── feed.css             # Feed layout & sidebar
├── components/
│   ├── Navbar.tsx               # Top navigation bar
│   ├── Navbar.css
│   ├── CreatePostBox.tsx        # Collapsible post creation
│   ├── CreatePostBox.css
│   ├── FeedSkeleton.tsx         # Shimmer loading skeleton
│   └── FeedSkeleton.css
├── hooks/
│   └── useAuth.ts               # Authentication state & logic
├── lib/
│   └── api.ts                   # Axios client + service methods
├── types/
│   └── index.ts                 # TypeScript interfaces
├── public/                       # Static assets (favicons, images)
├── package.json                  # Dependencies + scripts
├── tsconfig.json                 # TypeScript config
├── next.config.mjs              # Next.js config
└── FRONTEND.md                   # This file
```

---

## 🎨 Design System

**Verbascope Theme** — Inspired by Spy x Family invitation cards with muted teal-green + dark navy + warm cream palette.

### CSS Variables (globals.css)

```css
/* Backgrounds */
--v-bg-primary:      #5C8F8A  /* Main teal */
--v-bg-secondary:    #4A7A75
--v-bg-card:         #6B9E9A
--v-bg-dark:         #1C2B2A  /* Dark navy */

/* Text */
--v-text-primary:    #F5F0E8  /* Warm cream */
--v-text-secondary:  #C8DDD9
--v-text-muted:      #8BB5B0

/* ML Brain Signals */
--v-signal-green:    #7ECEC4  /* Positive */
--v-signal-yellow:   #E8C547  /* Sarcasm */
--v-signal-red:      #E07060  /* Negative */
```

### Component Classes

- `.card` / `.card-dark` — Card containers
- `.post-card` — Social media post styling
- `.badge` / `.badge-green` / `.badge-yellow` / `.badge-red` — Signal indicators
- `.btn` / `.btn-primary` / `.btn-ghost` — Buttons
- `.input` — Form inputs
- `.avatar` — User avatars
- `.pulse-dot` — Live indicator animation
- `.shimmer` — Loading skeleton effect
- `.dot-triangle` — Decorative corner element
- `.v-logo` — Verbascope brand logo

---

## 🔐 Authentication Flow

### Register Page (`/auth/register`)

**Inputs:**
- First Name, Last Name, Email, Password (min 6 chars)

**API Endpoint:**
```
POST http://localhost:3000/api/auth/register
Content-Type: application/json
{
  "email": "user@example.com",
  "password": "123456",
  "fullname": { "firstName": "John", "lastName": "Doe" }
}
```

**Response:**
- Sets httpOnly cookie with JWT token
- Redirects to `/feed` on success

---

### Login Page (`/auth/login`)

**Inputs:**
- Email, Password, Remember Me (checkbox)

**API Endpoint:**
```
POST http://localhost:3000/api/auth/login
{
  "email": "user@example.com",
  "password": "123456"
}
```

**Google OAuth:**
- Click "Continue with Google"
- Redirects to: `http://localhost:3000/api/auth/google`
- After OAuth callback, backend must redirect to: `http://localhost:3002/feed`

---

## 📱 Pages Overview

### Landing Page (`/`)
- Hero section with features
- CTA buttons (Sign In / Create Account)
- Floating visual demo card
- Responsive design

### Feed Page (`/feed`)
- Navbar with live indicator
- Create Post box (expandable)
- Feed skeleton loading (shimmer effect)
- Trending sidebar
- ML signal badges on posts

### Auth Pages
- Split layout (branding on left, form on right)
- Form validation + error alerts
- Floating avatar decorations
- Responsive mobile layout

---

## 🎯 Key Features

### 1. **useAuth Hook** (`hooks/useAuth.ts`)
```typescript
const { user, isLoading, error, register, login, logout } = useAuth();
```
Handles:
- User registration with validation
- Login with email/password
- Google OAuth redirect
- Error handling and state management

### 2. **API Client** (`lib/api.ts`)
```typescript
export const authApi    // Auth service (port 3000)
export const authService.register()
export const authService.login()
```
Features:
- Automatic `withCredentials: true` for httpOnly cookies
- Error interceptors with logging
- Dedicated service instances for each backend

### 3. **Skeleton Loading** (`components/FeedSkeleton.tsx`)
- Shimmer animation effect
- Post card placeholders
- Realistic loading vibe
- Netflix-like smooth transitions

### 4. **Create Post Box** (`components/CreatePostBox.tsx`)
- Collapsed state: simple input
- Expanded state: textarea + formatting options
- Image & emoji placeholders
- Cancel/Post buttons

---

## 🚀 Running the Frontend

```bash
# Install dependencies
pnpm install

# Start dev server on port 3002
pnpm dev
# Open http://localhost:3002

# Build for production
pnpm build

# Start production server
pnpm start
```

---

## 🔌 Backend Service URLs

**Environment Variables** (optional `.env.local`):
```
NEXT_PUBLIC_AUTH_API_URL=http://localhost:3000
NEXT_PUBLIC_NOTIFICATION_API_URL=http://localhost:3001
```

Default ports if not set:
- Auth Service: `http://localhost:3000`
- Notification Service: `http://localhost:3001`
- Frontend: `http://localhost:3002`

---

## 📝 Form Validation

### Register Form
- ✅ First Name required
- ✅ Last Name required
- ✅ Email must be valid
- ✅ Password minimum 6 characters
- ✅ Client-side validation before submit
- ✅ Backend error messages displayed in toast

### Login Form
- ✅ Email validation
- ✅ Password required
- ✅ Remember me checkbox (optional)
- ✅ Forgot password link placeholder

---

## 🎬 Component Architecture

All components are **client components** (`'use client'`) for interactivity.

### Page Components
- `app/page.tsx` — Landing (RSC)
- `app/auth/register/page.tsx` — Register form
- `app/auth/login/page.tsx` — Login form
- `app/feed/page.tsx` — Feed with skeleton loading

### Reusable Components
- `Navbar.tsx` — Top navigation
- `CreatePostBox.tsx` — Post creation interface
- `FeedSkeleton.tsx` — Loading state

### Hooks
- `useAuth()` — Authentication logic

---

## 🎨 Styling Approach

**NO Tailwind.** Pure CSS with semantic classes:
- `.btn`, `.input`, `.card` — semantic naming
- CSS variables for theming
- Smooth transitions (0.2s ease)
- Mobile-first responsive design
- Shimmer animations for loading

---

## ✨ Premium Touches

✅ Floating avatar animations on auth pages  
✅ Glassmorphism card effects  
✅ Pulse dot live indicator  
✅ Smooth fade-in animations  
✅ Proper error handling & validation  
✅ Responsive mobile layout  
✅ Consistent color palette  
✅ Professional typography (Playfair Display + Inter)  

---

## 🔄 API Integration Checklist

- [x] Register endpoint integration
- [x] Login endpoint integration
- [x] Google OAuth flow
- [x] Error handling & toast notifications
- [x] Cookie-based authentication (withCredentials)
- [ ] Feed API (next step)
- [ ] ML Brain signal integration (next step)
- [ ] Post submission with analysis (next step)

---

## 📱 Responsive Design

- **Desktop:** Full layout (sidebar visible)
- **Tablet (768px):** Stacked layout
- **Mobile (640px):** Optimized single column

---

## 🚨 Important Notes

1. **Frontend runs on port 3002** — Backend services on 3000/3001
2. **httpOnly cookies** — Credentials sent automatically with `withCredentials: true`
3. **Google OAuth redirect** — Backend must redirect to `http://localhost:3002/feed` after callback
4. **Form validation** — Both client and server-side validation required
5. **Types are strict** — TypeScript ensures type safety throughout

---

## 📚 Next Steps (Step 2 & 3)

**Step 2:** Build social media feed with ML signal badges  
**Step 3:** Integrate ML Brain microservice for analysis

---

## 📞 Support

For issues or questions, check:
- Backend README: `services/auth-service/README.md`
- Backend README: `services/notification-service/README.md`
- Project overview: `README.md` (root)

---

**Verbascope Frontend v0.1.0** — Ready for production! 🚀
