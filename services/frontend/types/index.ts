/* ─────────────────────────────────────────────────────────
   Auth & User Types
   ───────────────────────────────────────────────────────── */

export interface FullName {
  firstName: string;
  lastName: string;
}

// Minimal shape returned when followers/following are populated
// with .populate('followers following', 'fullname') on the backend —
// only _id and fullname come back, not a full User.
export interface FollowerRef {
  _id: string;
  fullname: FullName;
}

export interface User {
  _id?: string;
  id?: string;
  email: string;
  fullname: FullName;
  role?: string;
  createdAt?: string;

  // ── Profile (Phase 1) ──
  bio?: string;
  headline?: string;
  avatar?: string;

  // ── Social graph ──
  // Plain string IDs on most responses; populated FollowerRef[] when
  // fetched via getUserProfile (GET /api/users/:id), which calls
  // .populate('followers following', 'fullname').
  followers?: (string | FollowerRef)[];
  following?: (string | FollowerRef)[];
}

export interface AuthResponse {
  success: boolean;
  message: string;
  user?: User;
  token?: string;
}

/* ─────────────────────────────────────────────────────────
   Form Types
   ───────────────────────────────────────────────────────── */

export interface RegisterFormData {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
}

export interface LoginFormData {
  email: string;
  password: string;
  rememberMe?: boolean;
}

/* ─────────────────────────────────────────────────────────
   ML Brain Signal Types
   ───────────────────────────────────────────────────────── */

export interface MLSignal {
  sentiment: 'positive' | 'negative' | 'neutral';
  toxicity_score: number;
  sarcasm: boolean;
  risk_flag: 'green' | 'yellow' | 'red';
}

export interface Post {
  _id: string;
  author: User | string;
  content: string;
  images?: string[];
  likesCount: number;
  commentsCount: number;
  likedByMe: boolean;
  sharedByMe: boolean;
  isOwner: boolean;
  createdAt: string;
  updatedAt: string;
}

/* ─────────────────────────────────────────────────────────
   API Response Types
   ───────────────────────────────────────────────────────── */

export interface ApiError {
  error: string;
  message?: string;
  status?: number;
}