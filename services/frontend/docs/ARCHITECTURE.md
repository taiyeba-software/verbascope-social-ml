# Verbascope Frontend — Architecture & Design

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    FRONTEND (Port 3002)                     │
│                   Next.js 16 + TypeScript                   │
├──────────────────────────────────┬──────────────────────────┤
│          Pages (App Router)      │    Components & Logic    │
├──────────────────────────────────┼──────────────────────────┤
│ • Landing (/)                    │ • useAuth Hook           │
│ • Register (/auth/register)      │ • Navbar Component       │
│ • Login (/auth/login)            │ • CreatePostBox          │
│ • Feed (/feed)                   │ • FeedSkeleton           │
├──────────────────────────────────┼──────────────────────────┤
│      API Client (axios)          │    Styling (Pure CSS)    │
├──────────────────────────────────┼──────────────────────────┤
│ • authApi (port 3000)            │ • globals.css (theme)    │
│ • notificationApi (port 3001)    │ • Component CSS files    │
│ • Automatic withCredentials      │ • Shimmer animations     │
└──────────────────────────────────┴──────────────────────────┘
         │                                    │
         ▼                                    ▼
┌──────────────────────────────┐  ┌─────────────────────────┐
│   Auth Service (Port 3000)   │  │ Styling Framework       │
├──────────────────────────────┤  ├─────────────────────────┤
│ • POST /api/auth/register    │  │ NO Tailwind CSS         │
│ • POST /api/auth/login       │  │ Pure CSS custom classes │
│ • GET /api/auth/google       │  │ CSS Variables for theme │
│ • POST /api/auth/callback    │  │ Responsive grid/flexbox │
│ • MongoDB (user storage)     │  │ Smooth animations       │
│ • JWT cookies (httpOnly)     │  │ Mobile-first approach   │
└──────────────────────────────┘  └─────────────────────────┘
         │
         └──► RabbitMQ Event
              (user_created)
                    │
                    ▼
         ┌──────────────────────────┐
         │ Notification Service     │
         │ (Port 3001)              │
         ├──────────────────────────┤
         │ • Welcome emails         │
         │ • Nodemailer + OAuth2    │
         └──────────────────────────┘
```

---

## 🎯 Page Flow Architecture

### 1. **Landing Page** (`/`)
```
Hero Section
├── Branding (V logo, tagline)
├── Features Grid (3 items)
├── Floating Visual Card
│   └── Mock post with ML badges
├── CTA Buttons
│   ├── Sign In → /auth/login
│   └── Create Account → /auth/register
└── Floating Orb Decorations
```

### 2. **Register Page** (`/auth/register`)
```
Split Layout (50-50 desktop, stacked mobile)
├── LEFT: Branding
│   ├── V Logo
│   ├── "Decode emotions..." tagline
│   ├── Floating avatars (animated)
│   └── Dot triangle decoration
└── RIGHT: Form
    ├── Header (title + subtitle)
    ├── Form inputs
    │   ├── First Name
    │   ├── Last Name
    │   ├── Email
    │   └── Password
    ├── Validation + Errors
    ├── Create Account Button
    ├── Divider "or"
    ├── Continue with Google
    └── Link to Login
```

### 3. **Login Page** (`/auth/login`)
```
Split Layout (same structure)
├── LEFT: Branding (same as register)
└── RIGHT: Form
    ├── Email
    ├── Password
    ├── Remember Me checkbox
    ├── Forgot Password link
    ├── Sign In Button
    ├── Continue with Google
    └── Link to Register
```

### 4. **Feed Page** (`/feed`)
```
Grid Layout (1fr 400px desktop)
├── HEADER: Navbar
│   ├── Logo (compact)
│   ├── Live Indicator (pulse dot)
│   └── Settings button
├── MAIN: Feed Content
│   ├── Create Post Box
│   │   ├── Avatar + Input (collapsed)
│   │   ├── Textarea + Tools (expanded)
│   │   └── Cancel/Post buttons
│   └── Feed Items
│       ├── FeedSkeleton (loading state)
│       │   ├── 4x Post Card Skeletons
│       │   ├── Shimmer animation
│       │   └── Avatar + text placeholders
│       └── OR Real Posts (once data arrives)
└── SIDEBAR: Trending (sticky)
    ├── "Trending Now" header
    ├── 3x Trending items
    │   ├── Pulse dot (live)
    │   ├── Tag name
    │   └── Post count
```

---

## 🔐 Authentication State Management

### Hook: `useAuth()`

```typescript
interface UseAuthReturn {
  user: User | null;           // Current authenticated user
  isLoading: boolean;          // During API calls
  error: string | null;        // Error messages
  register(data: RegisterFormData): Promise<void>;
  login(data: LoginFormData): Promise<void>;
  loginWithGoogle(): void;
  logout(): void;
  clearError(): void;
}
```

### Flow
```
User Input
    ↓
Form Validation (client-side)
    ↓
useAuth.register() / useAuth.login()
    ↓
API Call (axios + withCredentials)
    ↓
Backend Sets httpOnly Cookie
    ↓
Success: user state updated + redirect
Error: error message displayed in toast
```

---

## 🎨 Styling Architecture

### Base Layer (`globals.css`)
```css
:root {
  /* 20+ CSS variables for colors, spacing, fonts */
  --v-bg-primary, --v-text-primary, etc.
}

/* Reset & Base */
*, body, h1-h6, p, a

/* Component Utility Classes */
.btn, .input, .card, .badge, .avatar, etc.

/* Animations */
@keyframes pulse-glow
@keyframes shimmer
@keyframes float
```

### Component CSS Files
- `auth.css` — Login/Register split layout
- `feed.css` — Feed grid + sidebar
- `Navbar.css` — Navigation bar
- `CreatePostBox.css` — Post creation
- `FeedSkeleton.css` — Shimmer loading
- `home.css` — Landing page

### **NO Tailwind** Approach Benefits
✅ Smaller CSS bundle  
✅ Custom design system consistency  
✅ Faster component styling  
✅ Easy to modify theme colors  
✅ No utility class conflicts  

---

## 🔌 API Client Architecture

### Structure (`lib/api.ts`)

```typescript
class ApiClient {
  constructor(config: ApiConfig)
  async get<T>(url, config?)
  async post<T>(url, data?, config?)
  async put<T>(url, data?, config?)
  async delete<T>(url, config?)
}

// Service instances
export const authApi = new ApiClient({
  baseURL: process.env.NEXT_PUBLIC_AUTH_API_URL || 'http://localhost:3000',
  withCredentials: true  // 🔑 Important for cookies
})

// Service methods
export const authService = {
  register: (data) => authApi.post('/api/auth/register', data),
  login: (email, password) => authApi.post('/api/auth/login', {...}),
  googleAuthStart: () => { window.location.href = ... }
}
```

### Key Features
- Automatic `withCredentials: true` for all requests
- Response error interceptor with logging
- Structured service-specific methods
- TypeScript generics for type safety

---

## 📝 Type System (`types/index.ts`)

```typescript
/* Auth & User */
interface FullName { firstName, lastName }
interface User { id, email, fullname, role, createdAt }
interface AuthResponse { success, message, user?, token? }

/* Forms */
interface RegisterFormData
interface LoginFormData

/* ML Brain */
interface MLSignal {
  sentiment: 'positive' | 'negative' | 'neutral'
  toxicity_score: number
  sarcasm: boolean
  risk_flag: 'green' | 'yellow' | 'red'
}

interface Post {
  id, author, content, signal, createdAt, likes, comments
}

/* Errors */
interface ApiError { error, message?, status? }
```

---

## 🎬 Component Hierarchy

```
RootLayout
├── Landing Page
│   ├── Hero Section
│   ├── Features Grid
│   ├── Visual Demo
│   └── Footer
├── Auth Layout
│   ├── Register Page
│   │   ├── Branding Side
│   │   └── Form Side
│   └── Login Page
│       ├── Branding Side
│       └── Form Side
└── Feed Layout
    ├── Navbar
    │   ├── Logo
    │   ├── Live Indicator
    │   └── Settings
    ├── Main Content
    │   ├── CreatePostBox
    │   └── FeedSkeleton (or Posts)
    └── Sidebar
        └── TrendingCard
```

---

## 🔄 Data Flow Example: Registration

```
User fills form
    ↓
<form onSubmit={handleSubmit}>
    ↓
validateForm() → check fields
    ↓
register(formData)
    ↓
authService.register({ email, password, fullname })
    ↓
POST /api/auth/register (with axios)
    ↓
Backend validates + creates user
    ↓
Sets httpOnly cookie + publishes event
    ↓
Returns { success: true, user: {...} }
    ↓
setUser(result.user) in state
    ↓
router.push('/feed')
    ↓
Redirect to feed page
```

---

## 🧪 Form Validation

### Client-Side (Before Submit)
```typescript
const validateForm = (): boolean => {
  const errors = {};
  if (!formData.email.trim() || !/regex/.test(...)) {
    errors.email = 'true';
  }
  // ... check other fields
  return Object.keys(errors).length === 0;
}
```

### Feedback Loop
1. User types → error cleared on change
2. Submit → show all field errors
3. Backend returns error → display in toast
4. Success → redirect to next page

---

## 🎭 Loading & Error States

### Loading States
- Form buttons: disabled + "Creating Account..." text
- Inputs: disabled while submitting
- Loading skeleton: shimmer animation

### Error Handling
- Client validation: inline error messages
- API errors: toast notifications + alert display
- Network errors: user-friendly error message
- Auto-clear errors: when user types

---

## 📱 Responsive Strategy

### Breakpoints
- **Desktop:** `1024px+` (2-column layouts)
- **Tablet:** `768px-1024px` (stacked layouts)
- **Mobile:** `<768px` (single column, optimized touch)

### Key Responsive Changes
- Auth pages: split layout → stacked
- Feed: sidebar hidden on mobile
- Trending: full width on mobile
- Buttons: 100% width on mobile
- Grid layouts: 2+ columns → 1 column

---

## 🚀 Performance Optimizations

✅ **No Tailwind** = Smaller CSS bundle  
✅ **Client components where needed** (interactive forms)  
✅ **Lazy shimmer animations** (don't block rendering)  
✅ **Optimized imports** (tree-shakeable)  
✅ **Minimal dependencies** (axios only)  
✅ **Next.js image optimization** (when added)  

---

## 🔐 Security Considerations

✅ **httpOnly cookies** — No JS access to tokens  
✅ **CORS with credentials** — withCredentials: true  
✅ **No password storage** — Server-side hashing  
✅ **Form validation** — Client + server  
✅ **Error sanitization** — No sensitive data leaked  

---

## 🎯 Design Principles

1. **Semantic CSS** — Meaningful class names (`.btn`, `.card`)
2. **Component Modularity** — Self-contained, reusable
3. **Type Safety** — TypeScript strict mode
4. **Accessibility** — Proper labels, error messages
5. **Performance** — Minimal re-renders, efficient selectors
6. **Consistency** — Color palette + spacing system
7. **Responsiveness** — Mobile-first approach
8. **Aesthetics** — Spy x Family inspired, premium feel

---

## 📚 File Reference

| File | Purpose | Lines |
|------|---------|-------|
| `app/globals.css` | Theme + base styles | 365 |
| `app/layout.tsx` | Root layout + metadata | 20 |
| `app/page.tsx` | Landing hero | 94 |
| `app/home.css` | Landing styles | 272 |
| `app/auth/register/page.tsx` | Register form | 215 |
| `app/auth/login/page.tsx` | Login form | 194 |
| `app/auth/auth.css` | Auth shared styles | 293 |
| `app/feed/page.tsx` | Feed page | 52 |
| `app/feed/feed.css` | Feed layout | 129 |
| `components/Navbar.tsx` | Navigation component | 36 |
| `components/Navbar.css` | Navbar styles | 100 |
| `components/CreatePostBox.tsx` | Post creation | 86 |
| `components/CreatePostBox.css` | Post creation styles | 136 |
| `components/FeedSkeleton.tsx` | Loading skeleton | 47 |
| `components/FeedSkeleton.css` | Skeleton styles | 137 |
| `hooks/useAuth.ts` | Auth state hook | 115 |
| `lib/api.ts` | API client | 110 |
| `types/index.ts` | TypeScript types | 72 |

---

## 🎬 State Diagram

```
┌─────────────────────────────────────────────────┐
│          Application State                      │
├─────────────────────────────────────────────────┤
│ useAuth() Hook                                  │
│ ├── user: User | null                          │
│ ├── isLoading: boolean                         │
│ ├── error: string | null                       │
│ └── actions: register, login, logout           │
├─────────────────────────────────────────────────┤
│ Form State (per component)                      │
│ ├── formData: { email, password, ... }         │
│ ├── formErrors: { [field]: string }            │
│ └── actions: handleChange, handleSubmit        │
├─────────────────────────────────────────────────┤
│ Navigation State (Next.js Router)               │
│ └── routes: /, /auth/login, /feed, etc.       │
└─────────────────────────────────────────────────┘
```

---

## ✨ Premium Features Implemented

✅ Custom Spy x Family design system  
✅ Professional split-layout auth pages  
✅ Smooth fade-in animations  
✅ Floating avatar decorations  
✅ Live pulse indicator on feed  
✅ Shimmer skeleton loading  
✅ Proper error handling & validation  
✅ Mobile-responsive design  
✅ TypeScript strict mode  
✅ Axios with credential support  
✅ Reusable hook architecture  
✅ Semantic CSS classes  

---

**Verbascope Frontend Architecture v1.0** ✨
