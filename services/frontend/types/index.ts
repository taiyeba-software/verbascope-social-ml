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
   Network Pulse Types
   ───────────────────────────────────────────────────────── */
// Shape returned by GET /api/posts/pulse/trending (post-service
// src/pulse/networkPulse.js). `topic` has NO leading '#' — the UI adds it.
// `mostActive` is null (and `others` is []) when nobody in the user's
// network has posted with a hashtag in the last 30 days.

export interface NetworkPulseTopic {
  topic: string;
  postCount: number;
  contributorCount: number;
}

export interface NetworkPulse {
  period: string;      // "Last 30 Days"
  windowDays: number;  // 30
  mostActive: NetworkPulseTopic | null;
  others: NetworkPulseTopic[];
}

/* ─────────────────────────────────────────────────────────
   ML Brain Signal Types
   ───────────────────────────────────────────────────────── */
// The canonical shape of what post.controller.js's handleMLResult() saves
// and emits lives in components/feed/AISignalCard.tsx as `MLAnalysis` —
// import it from there rather than duplicating it here, so there's only
// one source of truth for the field names (they're camelCase, matching
// the Post schema in post-service, not the snake_case ML Brain payload).

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

  // ── VerbaScope AI Signal feature ──
  // Populated asynchronously by post.controller.js's handleMLResult()
  // once the ML Brain finishes analyzing the post's text. Absent/null
  // until then, and always absent for image-only posts with no content.
  // Typed as `unknown` here to avoid a circular import with AISignalCard;
  // FeedPost in PostCard.tsx narrows it to the real MLAnalysis type.
  mlAnalysis?: unknown;
}

/* ─────────────────────────────────────────────────────────
   API Response Types
   ───────────────────────────────────────────────────────── */

export interface ApiError {
  error: string;
  message?: string;
  status?: number;
}