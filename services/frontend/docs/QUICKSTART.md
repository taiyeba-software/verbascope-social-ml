# Verbascope Frontend — Quick Start Guide ⚡

## 🚀 Getting Started

### 1. **Start the Frontend** (port 3002)
```bash
cd /vercel/share/v0-project
pnpm dev
```
Open: http://localhost:3002

### 2. **Ensure Backend Services Are Running**

**Auth Service** (port 3000):
```bash
cd services/auth-service
npm run dev
```

**Notification Service** (port 3001):
```bash
cd services/notification-service
npm run dev
```

---

## 📍 Key Pages

| Page | URL | Status |
|------|-----|--------|
| Landing (Hero) | `/` | ✅ Ready |
| Register | `/auth/register` | ✅ Ready |
| Login | `/auth/login` | ✅ Ready |
| Feed | `/feed` | ✅ Ready (skeleton) |

---

## 🧪 Test the Flow

### **Option 1: Email/Password Registration**
1. Go to http://localhost:3002/auth/register
2. Fill in: First Name, Last Name, Email, Password
3. Click "Create Account"
4. Redirected to `/feed` on success

### **Option 2: Google OAuth**
1. On login/register page, click "Continue with Google"
2. Google auth flow happens
3. Backend redirects to `http://localhost:3002/feed`

### **Option 3: Email/Password Login**
1. Go to http://localhost:3002/auth/login
2. Fill in: Email, Password
3. Check "Remember me" (optional)
4. Click "Sign In"

---

## 🎨 Design System

**Theme:** Verbascope (Spy x Family aesthetic)

### Colors
- **Primary Teal:** `#5C8F8A` (main background)
- **Dark Navy:** `#1C2B2A` (accent, navbar)
- **Warm Cream:** `#F5F0E8` (text)

### Signal Badges (ML Brain)
- 🟢 **Green:** `#7ECEC4` — Positive sentiment
- 🟡 **Yellow:** `#E8C547` — Sarcasm detected
- 🔴 **Red:** `#E07060` — Negative/Toxic

---

## 📁 File Structure Overview

```
app/
├── page.tsx                 → Landing page
├── globals.css              → Theme & base styles
├── layout.tsx               → Root layout
├── auth/
│   ├── login/page.tsx       → Login form
│   ├── register/page.tsx    → Register form
│   └── auth.css             → Auth styles
└── feed/
    ├── page.tsx             → Feed with skeleton
    └── feed.css             → Feed layout

components/
├── Navbar.tsx               → Top nav bar
├── CreatePostBox.tsx        → Post creation box
└── FeedSkeleton.tsx         → Loading skeleton

hooks/
└── useAuth.ts               → Auth logic hook

lib/
├── api.ts                   → Axios client + services
└── types/index.ts           → TypeScript types
```

---

## 🔌 API Endpoints

### Register
```
POST http://localhost:3000/api/auth/register
{
  "email": "user@example.com",
  "password": "123456",
  "fullname": { "firstName": "John", "lastName": "Doe" }
}
```

### Login
```
POST http://localhost:3000/api/auth/login
{
  "email": "user@example.com",
  "password": "123456"
}
```

### Google OAuth Start
```
GET http://localhost:3000/api/auth/google
```

---

## 🛠️ Common Tasks

### Add a New Page
```typescript
// app/new-page/page.tsx
'use client';
export default function NewPage() {
  return <div>New page content</div>;
}
```

### Use Auth State
```typescript
'use client';
import { useAuth } from '@/hooks/useAuth';

export default function MyComponent() {
  const { user, isLoading, error, login } = useAuth();
  // Use auth state here
}
```

### Call Backend API
```typescript
import { authService } from '@/lib/api';

const response = await authService.register({
  email: 'user@example.com',
  password: '123456',
  fullname: { firstName: 'John', lastName: 'Doe' }
});
```

---

## 🎯 Environment Variables

**Optional** — Defaults work if backends are on standard ports:
```bash
# .env.local
NEXT_PUBLIC_AUTH_API_URL=http://localhost:3000
NEXT_PUBLIC_NOTIFICATION_API_URL=http://localhost:3001
```

---

## 📊 Form Validation

All forms include:
- ✅ Client-side validation (before submit)
- ✅ Error message display
- ✅ Loading state during submission
- ✅ Success/error toast notifications
- ✅ Field-level error highlighting

---

## 🚨 Troubleshooting

### **"Cannot fetch from backend"**
- Ensure auth-service is running on port 3000
- Check CORS headers in backend
- Verify `withCredentials: true` in API calls

### **"Login works but no redirect to /feed"**
- Check Google OAuth callback URL
- Backend must redirect to `http://localhost:3002/feed`

### **"Styles not loading"**
- Clear browser cache
- Restart dev server: `pnpm dev`
- Check `globals.css` is imported in `layout.tsx`

### **"TypeScript errors"**
- Run: `pnpm tsc --noEmit`
- Check `types/index.ts` for type definitions

---

## 📚 Documentation

- **Full frontend guide:** `FRONTEND.md`
- **Backend setup:** `services/auth-service/README.md`
- **Project overview:** `README.md` (root)

---

## ✨ What's Included

✅ Professional frontend structure  
✅ Custom CSS design system (no Tailwind)  
✅ Authentication pages (login + register)  
✅ Google OAuth integration  
✅ Feed skeleton with shimmer loading  
✅ TypeScript strict mode  
✅ Reusable hooks & API client  
✅ Responsive mobile design  
✅ Proper error handling  
✅ Form validation  

---

## 🎬 Next Steps

1. **Test auth flow** (register & login)
2. **Verify backend integration** (check network tab)
3. **Build feed UI** (feed APIs integration)
4. **Add ML signal badges** (sentiment/sarcasm/toxicity)
5. **Implement post submission** (with analysis)

---

**Ready to go! 🚀**  
Visit http://localhost:3002 and start testing!
