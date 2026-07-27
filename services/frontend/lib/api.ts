import axios, { AxiosInstance } from 'axios';

/* ──────────────────────────────────────────────────────────
   API Client Configuration
   ────────────────────────────────────────────────────────── */

const API_TIMEOUT = 10000; // 10 seconds

interface ApiConfig {
  baseURL: string;
  timeout?: number;
  withCredentials?: boolean;
}

class ApiClient {
  private client: AxiosInstance;

  constructor(config: ApiConfig) {
    this.client = axios.create({
      baseURL: config.baseURL,
      timeout: config.timeout || API_TIMEOUT,
      withCredentials: config.withCredentials !== false, // true by default for auth cookies
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Add response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        // Create a clean, readable error object instead of throwing raw axios error
        const cleanError = {
          status: error.response?.status,
          statusText: error.response?.statusText,
          message: error.response?.data?.message || error.message,
          code: error.code, // CORS, ECONNABORTED, etc.
          data: error.response?.data,
        };

        // Only log actual server errors (not 401, not network errors)
        if (error.response?.status && error.response.status !== 401) {
          console.error('[API Error]', cleanError);
        }

        // Throw the clean object, not the raw axios error
        return Promise.reject(cleanError);
      }
    );
  }

  // GET request
  async get<T>(url: string, config = {}) {
    return this.client.get<T>(url, config);
  }

  // POST request
  async post<T>(url: string, data?: unknown, config = {}) {
    return this.client.post<T>(url, data, config);
  }

  // PUT request
  async put<T>(url: string, data?: unknown, config = {}) {
    return this.client.put<T>(url, data, config);
  }

  // PATCH request
  async patch(url: string, data?: unknown, config = {}) {
    return this.client.patch(url, data, config);
  }

  // DELETE request
  async delete<T>(url: string, config = {}) {
    return this.client.delete<T>(url, config);
  }
}

/* ──────────────────────────────────────────────────────────
   Service Instances
   ────────────────────────────────────────────────────────── */

// Auth Service - runs on port 3000
export const authApi = new ApiClient({
  baseURL: process.env.NEXT_PUBLIC_AUTH_API_URL || 'http://localhost:3000',
  withCredentials: true, // Important: support httpOnly cookies
});

// Notification Service - runs on port 3001
export const notificationApi = new ApiClient({
  baseURL: process.env.NEXT_PUBLIC_NOTIFICATION_API_URL || 'http://localhost:3001',
  withCredentials: true,
});

/* ──────────────────────────────────────────────────────────
   Auth Service Methods
   ────────────────────────────────────────────────────────── */

export const authService = {
  // Register new user
  register: (data: {
    email: string;
    password: string;
    fullname: { firstName: string; lastName: string };
  }) => authApi.post('/api/auth/register', data),

  // Login user
  login: (email: string, password: string) =>
    authApi.post('/api/auth/login', { email, password }),

  // Get the currently authenticated user
  getCurrentUser: () => authApi.get('/api/auth/me'),

  // Start Google OAuth flow
  googleAuthStart: () => {
    window.location.href = googleAuthUrl;
  },
};

// Auth Service — user social graph
export const userService = {
  getUsersBulk: (ids: string[]) =>
    authApi.get(`/api/users/bulk?ids=${ids.join(',')}`),

  follow: (userId: string) =>
    authApi.post(`/api/users/follow/${userId}`),

  unfollow: (userId: string) =>
    authApi.post(`/api/users/unfollow/${userId}`),

  getMyFollowing: () =>
    authApi.get('/api/users/me/following'),

  // ── Profile (Phase 2 / 4) ──
  // id can be a real ObjectId string or the literal "me".
  getUserProfile: (id: string) =>
    authApi.get(`/api/users/${id}`),

  updateProfile: (data: { bio?: string; headline?: string }) =>
    authApi.patch('/api/users/profile', data),

  // FormData must contain a single file under the field name "avatar".
  updateAvatar: (formData: FormData) =>
    authApi.patch('/api/users/avatar', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
};

export const googleAuthUrl = `${process.env.NEXT_PUBLIC_AUTH_URL || 'http://localhost:3000'}/api/auth/google`;

/* ──────────────────────────────────────────────────────────
   Notification Service Methods
   ────────────────────────────────────────────────────────── */

export const notificationService = {
  // Test email endpoint
  testEmail: (email: string) =>
    notificationApi.post('/api/notification/test-email', { email }),

  // Get all notifications for the current user
  getNotifications: () => notificationApi.get('/api/notifications'),

  // Mark all notifications as read
  markAllRead: () => notificationApi.patch('/api/notifications/read'),
};

/* ──────────────────────────────────────────────────────────
   Post Service
   ────────────────────────────────────────────────────────── */

// Post Service - runs on port 3003
export const postApi = new ApiClient({
  baseURL: process.env.NEXT_PUBLIC_POST_API_URL || 'http://localhost:3003',
  withCredentials: true,
  timeout: 30000, // Increased from 10s to 30s for image uploads to ImageKit
});

export const postService = {
  getFeed: (page = 1, limit = 10) =>
    postApi.get(`/api/posts/feed?page=${page}&limit=${limit}`),

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

  // NEW: fetch direct replies to a single comment (one level, not the whole subtree)
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

  // ── Saved / bookmarked posts ──────────────────────────────────────
  // Matches: POST /:id/save, DELETE /:id/unsave, GET /saved on posts.routes.js
  bookmarkPost: (id: string) =>
    postApi.post(`/api/posts/${id}/save`),

  unbookmarkPost: (id: string) =>
    postApi.delete(`/api/posts/${id}/unsave`),

  getBookmarkedPosts: (page = 1, limit = 10) =>
    postApi.get(`/api/posts/saved?page=${page}&limit=${limit}`),

  recordDwell: (postId: string, duration: number) =>
    postApi.post('/api/posts/dwell', { postId, duration }),

  // Post Service — recommendations
  getRecommendedUsers: () =>
    postApi.get('/api/posts/recommendations/users'),
};