/* ─────────────────────────────────────────────────────────
   Auth & User Types
   ───────────────────────────────────────────────────────── */

export interface FullName {
  firstName: string;
  lastName: string;
}

export interface User {
  id: string;
  email: string;
  fullname: FullName;
  role?: string;
  createdAt?: string;
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
  image?: string;
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
