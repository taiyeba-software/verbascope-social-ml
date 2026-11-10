import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios';
import type { SearchResponse } from '@/types/search';
import type { WeeklyPulse } from '@/components/feed/useFeedSocket';

/* ──────────────────────────────────────────────────────────
   Google OAuth token capture
   ──────────────────────────────────────────────────────────
   auth-service redirects to /feed?token=... after Google login.
   This runs when the module is first imported in the browser - i.e.
   BEFORE AuthProvider's first GET /api/auth/me - so that call already
   carries the Bearer token. (Previously the token was only stored by
   the feed page, which isn't mounted until /me has finished, so /me
   went out without a token, failed, and bounced the user to login.)
   The feed page's own effect still strips ?token= from the URL.
   ────────────────────────────────────────────────────────── */

if (typeof window !== 'undefined') {
  try {
    const params = new URLSearchParams(window.location.search);
    const urlToken = params.get('token');
    if (urlToken && window.location.pathname.startsWith('/feed')) {
      localStorage.setItem('vs_token', urlToken);
    }
  } catch {
    // storage unavailable - ignore
  }
}

/* ──────────────────────────────────────────────────────────
   API Client Configuration
   ────────────────────────────────────────────────────────── */

// Render free instances can take 30-60s to wake up, so be generous.
const API_TIMEOUT = 20000;

// Retried only for GET requests, and only for "server not ready" failures
// (502/503/504 or no response at all) - never for 401/4xx.
const RETRY_DELAYS_MS = [2000, 5000, 10000];
const RETRYABLE_STATUSES = [502, 503, 504];
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

type RetryableConfig = InternalAxiosRequestConfig & { __retryCount?: number };

interface ApiConfig {
  baseURL: string;
  timeout?: number;
  withCredentials?: boolean;
}

export interface CleanApiError {
  status: number | null;
  statusText: string;
  message: string;
  code: string | null;
  data: unknown;
}

/** True only when the server explicitly rejected the credentials. */
export const isUnauthorizedError = (err: unknown): boolean =>
  (err as CleanApiError | undefined)?.status === 401;

class ApiClient {
  private client: AxiosInstance;

  constructor(config: ApiConfig) {
    this.client = axios.create({
      baseURL: config.baseURL,
      timeout: config.timeout || API_TIMEOUT,
      withCredentials: config.withCredentials !== false,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.client.interceptors.request.use((requestConfig) => {
      if (typeof window !== 'undefined') {
        const token = localStorage.getItem('vs_token');
        if (token) {
          requestConfig.headers = requestConfig.headers || {};
          requestConfig.headers.Authorization = `Bearer ${token}`;
        }
      }
      return requestConfig;
    });

    this.client.interceptors.response.use(
      (response) => response,
      async (error: AxiosError) => {
        const cfg = error.config as RetryableConfig | undefined;
        const status = error.response?.status ?? null;

        // ── Retry transient failures (cold start / gateway errors) ──
        const method = (cfg?.method || 'get').toLowerCase();
        const noResponse = !error.response && error.code !== 'ERR_CANCELED';
        const transient = noResponse || (status !== null && RETRYABLE_STATUSES.includes(status));
        const attempt = cfg?.__retryCount ?? 0;

        if (cfg && method === 'get' && transient && attempt < RETRY_DELAYS_MS.length) {
          cfg.__retryCount = attempt + 1;
          await sleep(RETRY_DELAYS_MS[attempt]);
          return this.client.request(cfg);
        }

        const statusText = error.response?.statusText ?? '';
        const responseData = error.response?.data as { message?: string } | undefined;
        const message =
          responseData?.message ||
          error.message ||
          'An unexpected network or API error occurred.';
        const code = error.code ?? null;
        const data = error.response?.data ?? null;

        const cleanError: CleanApiError = {
          status,
          statusText,
          message,
          code,
          data,
        };

        const EXPECTED_VALIDATION_STATUSES = [400, 401, 422];

        if (
          !(status !== null && EXPECTED_VALIDATION_STATUSES.includes(status)) &&
          process.env.NODE_ENV === 'development'
        ) {
          console.error('[API Error]', message, cleanError);
        }

        return Promise.reject(cleanError);
      }
    );
  }

  async get<T>(url: string, config = {}) {
    return this.client.get<T>(url, config);
  }

  async post<T>(url: string, data?: unknown, config = {}) {
    return this.client.post<T>(url, data, config);
  }

  async put<T>(url: string, data?: unknown, config = {}) {
    return this.client.put<T>(url, data, config);
  }

  async patch(url: string, data?: unknown, config = {}) {
    return this.client.patch(url, data, config);
  }

  async delete<T>(url: string, config = {}) {
    return this.client.delete<T>(url, config);
  }
}

/* ──────────────────────────────────────────────────────────
   Token Storage
   ────────────────────────────────────────────────────────── */

export const tokenStorage = {
  set: (token: string) => {
    if (typeof window !== 'undefined') localStorage.setItem('vs_token', token);
  },
  get: () => (typeof window !== 'undefined' ? localStorage.getItem('vs_token') : null),
  clear: () => {
    if (typeof window !== 'undefined') localStorage.removeItem('vs_token');
  },
};

/* ──────────────────────────────────────────────────────────
   Service Instances
   ────────────────────────────────────────────────────────── */

export const authApi = new ApiClient({
  baseURL: process.env.NEXT_PUBLIC_AUTH_API_URL || 'http://localhost:3000',
  withCredentials: true,
});

export const notificationApi = new ApiClient({
  baseURL: process.env.NEXT_PUBLIC_NOTIFICATION_API_URL || 'http://localhost:3001',
  withCredentials: true,
});

/* ──────────────────────────────────────────────────────────
   Auth Service Methods
   ────────────────────────────────────────────────────────── */

export const authService = {
  register: (data: {
    email: string;
    password: string;
    fullname: { firstName: string; lastName: string };
  }) => authApi.post('/api/auth/register', data),

  login: (email: string, password: string) =>
    authApi.post('/api/auth/login', { email, password }),

  getCurrentUser: () => authApi.get('/api/auth/me'),

  googleAuthStart: () => {
    window.location.href = googleAuthUrl;
  },
};

export const userService = {
  getUsersBulk: (ids: string[]) =>
    authApi.get(`/api/users/bulk?ids=${ids.join(',')}`),

  follow: (userId: string) =>
    authApi.post(`/api/users/follow/${userId}`),

  unfollow: (userId: string) =>
    authApi.post(`/api/users/unfollow/${userId}`),

  getMyFollowing: () =>
    authApi.get('/api/users/me/following'),

  getUserProfile: (id: string) =>
    authApi.get(`/api/users/${id}`),

  updateProfile: (data: { bio?: string; headline?: string }) =>
    authApi.patch('/api/users/profile', data),

  updateAvatar: (formData: FormData) =>
    authApi.patch('/api/users/avatar', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
};

// NOTE: this uses NEXT_PUBLIC_AUTH_URL while authApi uses
// NEXT_PUBLIC_AUTH_API_URL. If only one of them is set on Vercel, the other
// silently falls back to localhost:3000. Set BOTH to the auth-service URL.
export const googleAuthUrl = `${
  process.env.NEXT_PUBLIC_AUTH_URL || process.env.NEXT_PUBLIC_AUTH_API_URL || 'http://localhost:3000'
}/api/auth/google`;

/* ──────────────────────────────────────────────────────────
   Notification Service Methods
   ────────────────────────────────────────────────────────── */

export const notificationService = {
  testEmail: (email: string) =>
    notificationApi.post('/api/notification/test-email', { email }),

  getNotifications: () => notificationApi.get('/api/notifications'),

  markAllRead: () => notificationApi.patch('/api/notifications/read'),

  markRead: (id: string) => notificationApi.patch(`/api/notifications/${id}/read`),
};

/* ──────────────────────────────────────────────────────────
   Post Service
   ────────────────────────────────────────────────────────── */

export const postApi = new ApiClient({
  baseURL: process.env.NEXT_PUBLIC_POST_API_URL || 'http://localhost:3003',
  withCredentials: true,
  timeout: 30000,
});

export type WeeklyPulseResponse = { success: boolean } & WeeklyPulse;

export type CommunityInsightsSummaryResponse = {
  success: boolean;
  summary: Record<string, number>;
};

// ── RENAMED: Community Signals — "who marked it" ──
export type CommunityEndorsement = {
  userId: string;
  displayName: string;
  avatar: string | null;
  reason: string | null;
  sharedAt: string | null;
};

export type CommunityEndorsementsResponse = {
  success: boolean;
  endorsements: CommunityEndorsement[];
  total: number;
};

export const postService = {
  getFeed: (page = 1, limit = 10, signal?: string, risk?: string) =>
    postApi.get('/api/posts/feed', {
      params: {
        page,
        limit,
        ...(signal ? { signal } : {}),
        ...(risk ? { risk } : {}),
      },
    }),

  getPost: (id: string) =>
    postApi.get(`/api/posts/${id}`),

  createPost: (body: FormData | { content: string }) =>
    postApi.post('/api/posts', body, {
      headers: body instanceof FormData ? { 'Content-Type': 'multipart/form-data' } : {},
    }),

  likePost: (id: string) =>
    postApi.post(`/api/posts/${id}/like`),

  unlikePost: (id: string) =>
    postApi.delete(`/api/posts/${id}/unlike`),

  getComments: (id: string) =>
    postApi.get(`/api/posts/${id}/comments`),

  getReplies: (commentId: string) =>
    postApi.get(`/api/posts/comments/${commentId}/replies`),

  addComment: (id: string, content: string, parentComment?: string) =>
    postApi.post(`/api/posts/${id}/comment`, { content, parentComment }),

  deleteComment: (postId: string, commentId: string) =>
    postApi.delete(`/api/posts/${postId}/comments/${commentId}`),

  deletePost: (id: string) =>
    postApi.delete(`/api/posts/${id}`),

  sharePost: (id: string, reason?: string) =>
    postApi.post(`/api/posts/${id}/share`, { reason }),

  unsharePost: (id: string) =>
    postApi.delete(`/api/posts/${id}/unshare`),

  getCommunityEndorsements: (id: string) =>
    postApi.get<CommunityEndorsementsResponse>(`/api/posts/${id}/community-endorsements`),

  bookmarkPost: (id: string) =>
    postApi.post(`/api/posts/${id}/save`),

  unbookmarkPost: (id: string) =>
    postApi.delete(`/api/posts/${id}/unsave`),

  getBookmarkedPosts: (page = 1, limit = 10) =>
    postApi.get(`/api/posts/saved?page=${page}&limit=${limit}`),

  getUserPosts: (userId: string) =>
    postApi.get(`/api/posts/user/${userId}`),

  getSavedPosts: () =>
    postApi.get('/api/posts/saved'),

  recordDwell: (postId: string, duration: number) =>
    postApi.post('/api/posts/dwell', { postId, duration }),

  getRecommendedUsers: () =>
    postApi.get('/api/posts/recommendations/users'),

  getWeeklyPulse: () =>
    postApi.get<WeeklyPulseResponse>('/api/posts/pulse/trending'),

  getCommunitySignalsSummary: () =>
    postApi.get<CommunityInsightsSummaryResponse>('/api/posts/community-signals/summary'),

  search: (
    query: string,
    opts: { limit?: number; offset?: number; signal?: AbortSignal } = {}
  ) =>
    postApi.get<SearchResponse>('/api/posts/search', {
      params: { q: query, limit: opts.limit ?? 6, offset: opts.offset ?? 0 },
      signal: opts.signal,
    }),
};