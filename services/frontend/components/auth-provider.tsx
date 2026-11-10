'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { authService, authApi, tokenStorage, isUnauthorizedError } from '@/lib/api';
import type { AuthResponse, LoginFormData, RegisterFormData, User } from '@/types';

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  error: string | null;
  register: (data: RegisterFormData) => Promise<void>;
  login: (data: LoginFormData) => Promise<void>;
  loginWithGoogle: () => void;
  logout: () => void;
  clearError: () => void;
  updateUser: (user: User) => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

/* ── Last-known-user cache ──
   If /me fails for a temporary reason (cold start, 502/503, offline) we
   keep the user signed in with this cached copy instead of kicking them
   to the login page. It is only used when a token is present, and is
   cleared on logout or a real 401. */
const USER_CACHE_KEY = 'vs_user';

const userCache = {
  get: (): User | null => {
    if (typeof window === 'undefined') return null;
    try {
      const raw = localStorage.getItem(USER_CACHE_KEY);
      return raw ? (JSON.parse(raw) as User) : null;
    } catch {
      return null;
    }
  },
  set: (user: User) => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(USER_CACHE_KEY, JSON.stringify(user));
    } catch {
      // storage full / unavailable - ignore
    }
  },
  clear: () => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.removeItem(USER_CACHE_KEY);
    } catch {
      // ignore
    }
  },
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const hydrateSession = useCallback(async () => {
    try {
      // api.ts already retries 502/503/504/timeouts with backoff, so by the
      // time an error reaches here it is either a definite rejection or the
      // server has stayed unreachable for a long while.
      const response = await authService.getCurrentUser();
      const result = response.data as AuthResponse;

      if (result.success && result.user) {
        setUser(result.user);
        userCache.set(result.user);
      } else {
        // Server answered 200 but says no user - treat as signed out.
        tokenStorage.clear();
        userCache.clear();
        setUser(null);
      }
    } catch (err: unknown) {
      if (isUnauthorizedError(err) || (err as { status?: number })?.status === 404) {
        // The ONLY case where we sign the user out: the server explicitly
        // rejected the credentials (or the account no longer exists).
        tokenStorage.clear();
        userCache.clear();
        setUser(null);
      } else {
        // Temporary failure (502/503/504, timeout, offline): do NOT clear
        // the token. Keep the user signed in from cache if we have one.
        console.warn('[auth] /me unavailable, keeping session:', (err as { message?: string })?.message);
        const cached = tokenStorage.get() ? userCache.get() : null;
        setUser(cached);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void hydrateSession();
  }, [hydrateSession]);

  const register = useCallback(
    async (data: RegisterFormData) => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await authService.register({
          email: data.email,
          password: data.password,
          fullname: {
            firstName: data.firstName,
            lastName: data.lastName,
          },
        });

        const result = response.data as AuthResponse & { token?: string };

        if (result.success && result.user) {
          if (result.token) tokenStorage.set(result.token);
          userCache.set(result.user);
          setUser(result.user);
          router.push('/feed');
        } else {
          setError(result.message || 'Registration failed');
        }
      } catch (err: unknown) {
        const errorMessage =
          (err as any)?.message ||
          (err as Error)?.message ||
          'Registration failed. Please try again.';
        setError(errorMessage);
      } finally {
        setIsLoading(false);
      }
    },
    [router]
  );

  const login = useCallback(
    async (data: LoginFormData) => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await authService.login(data.email, data.password);

        const result = response.data as AuthResponse & { token?: string };

        if (result.success && result.user) {
          if (result.token) tokenStorage.set(result.token);
          userCache.set(result.user);
          setUser(result.user);
          router.push('/feed');
        } else {
          setError(result.message || 'Login failed');
        }
      } catch (err: unknown) {
        const errorMessage =
          (err as any)?.message ||
          (err as Error)?.message ||
          'Login failed. Please check your credentials.';
        setError(errorMessage);
      } finally {
        setIsLoading(false);
      }
    },
    [router]
  );

  const loginWithGoogle = useCallback(() => {
    authService.googleAuthStart();
  }, []);

  const logout = useCallback(async () => {
    try {
      await authApi.post('/api/auth/logout');
    } catch (err) {
      console.error('Logout request failed:', err);
    } finally {
      if (typeof window !== 'undefined' && (window as any).socket) {
        try {
          (window as any).socket.disconnect();
        } catch {
          // ignore socket cleanup errors
        }
      }

      tokenStorage.clear();
      userCache.clear();

      setUser(null);
      setError(null);
      router.replace('/');
    }
  }, [router]);

  const updateUser = useCallback((updated: User) => {
    userCache.set(updated);
    setUser(updated);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        error,
        register,
        login,
        loginWithGoogle,
        logout,
        clearError,
        updateUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuthContext() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuthContext must be used within an AuthProvider');
  }

  return context;
}