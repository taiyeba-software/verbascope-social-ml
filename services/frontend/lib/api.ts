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
        console.error('[API Error]', {
          url: error.config?.url,
          status: error.response?.status,
          message: error.response?.data?.message || error.message,
        });
        return Promise.reject(error);
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

  // Start Google OAuth flow
  googleAuthStart: () => {
    window.location.href = `${authApi['client'].defaults.baseURL}/api/auth/google`;
  },
};

/* ──────────────────────────────────────────────────────────
   Notification Service Methods
   ────────────────────────────────────────────────────────── */

export const notificationService = {
  // Test email endpoint
  testEmail: (email: string) =>
    notificationApi.post('/api/notification/test-email', { email }),
};
