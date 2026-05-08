# Setting Up Verbascope in Your Project

## Quick Start - Clone & Run

### Step 1: Download the Project
Click the **"Download ZIP"** button in v0, or use GitHub if connected.

### Step 2: Install Dependencies
```bash
cd verbascope-frontend
pnpm install
# or: npm install / yarn install
```

### Step 3: Run Development Server
```bash
pnpm dev
# or: npm run dev / yarn dev
```
Open http://localhost:3002 in your browser.

---

## File Structure Overview

```
verbascope-frontend/
├── app/
│   ├── globals.css          # Global theme & design system
│   ├── layout.tsx           # Root layout
│   ├── page.tsx             # Home page (/)
│   ├── auth/
│   │   ├── register/        # Registration page
│   │   ├── login/           # Login page
│   │   └── auth.css         # Auth styling
│   └── feed/
│       ├── page.tsx         # Social feed
│       └── feed.css         # Feed styling
├── components/
│   ├── Navbar.tsx           # Navigation bar
│   ├── Navbar.css           # Navbar styling
│   ├── CreatePostBox.tsx    # Post creation
│   ├── CreatePostBox.css    # Post box styling
│   ├── FeedSkeleton.tsx     # Loading skeleton
│   └── FeedSkeleton.css     # Skeleton styling
├── lib/
│   └── api.ts               # API utilities & HTTP client
├── hooks/
│   └── useAuth.ts           # Authentication hook
├── types/
│   └── index.ts             # TypeScript types
└── package.json             # Dependencies
```

---

## Key Features Already Implemented

✓ **Authentication System**
- Email/Password registration & login
- Google OAuth 2.0 ready
- Form validation (client-side)
- Auto-redirect on success

✓ **Design System**
- Premium colors (sage teal, navy, cream)
- Breathing animations
- Glass morphism effects
- Lucide React icons

✓ **Components**
- Responsive Navbar
- Create post box
- Loading skeletons
- Feed display

---

## Connecting to Backend

The API client is ready in `lib/api.ts`:

```typescript
import { apiClient } from '@/lib/api';

// Register
const response = await apiClient.post('/auth/register', {
  email: 'user@example.com',
  password: 'password123',
  firstName: 'John',
  lastName: 'Doe'
});

// Login
const login = await apiClient.post('/auth/login', {
  email: 'user@example.com',
  password: 'password123'
});

// Fetch feed
const feed = await apiClient.get('/feed');
```

**Backend API Requirements:**
- Base URL: `http://localhost:5000` (configurable in `lib/api.ts`)
- Supports credentials (cookies)
- JSON request/response format

---

## Environment Variables

Create a `.env.local` file:

```env
NEXT_PUBLIC_API_URL=http://localhost:5000
```

---

## Customization Guide

### Change Colors
Edit `app/globals.css` (lines 12-48):
```css
--v-bg-primary: #6BA59E;    /* Main background */
--v-text-primary: #F5F0E8;  /* Main text */
--v-accent: #1A2A28;        /* Buttons, links */
```

### Change Fonts
Update import in `app/globals.css` (line 8):
```css
@import url('https://fonts.googleapis.com/css2?family=...');
```

### Modify Animations
Edit `app/globals.css` (search for `@keyframes`) to adjust:
- `breathing-pulse` (3s) — Live indicator
- `floating-glow` (8s) — Background gradient
- `scan-line` (6s) — Data processing effect

---

## Deployment

### To Vercel (Recommended)
```bash
npm install -g vercel
vercel
```
Follow prompts. Your site will be live in seconds.

### To Netlify
```bash
npm run build
# Drag & drop 'out' folder to Netlify
```

### To Docker
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
```

---

## Troubleshooting

**Q: Getting ChunkLoadError?**
A: Restart dev server: `pnpm dev`

**Q: Icons not showing?**
A: Ensure lucide-react is installed: `pnpm add lucide-react`

**Q: Styles look wrong?**
A: Clear cache: Stop server → Delete `.next` folder → `pnpm dev`

**Q: Can't connect to backend?**
A: Check `NEXT_PUBLIC_API_URL` in `.env.local` points to correct server

---

## Next Steps

1. Connect your backend API
2. Implement ML sentiment analysis
3. Add real-time notifications
4. Deploy to production
5. Monitor user feedback

For questions, refer to **REFINED_DESIGN.md** and **ARCHITECTURE.md**.
