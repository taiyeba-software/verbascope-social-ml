'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { authService, authApi } from '@/lib/api';
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
      const response = await authService.getCurrentUser();
      const result = response.data as AuthResponse;

      if (result.success && result.user) {
        console.log('✅ Session hydrated:', result.user.email);
        setUser(result.user);
      } else {
        console.log('ℹ️ No active session (expected on first visit)');
        setUser(null);
      }
    } catch (err: unknown) {
      const status = (err as any)?.status;
      const message = (err as any)?.message || 'Unknown error';

      if (status === 401 || status === 404) {
        console.log('ℹ️ No active session or user no longer exists');
      } else {
        console.error('[API Error]', message);
      }

      setUser(null);
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

        const result = response.data as AuthResponse;

        if (result.success && result.user) {
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
        const result = response.data as AuthResponse;

        if (result.success && result.user) {
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
      // Safely disconnect global socket if attached to window
      if (typeof window !== 'undefined' && (window as any).socket) {
        try {
          (window as any).socket.disconnect();
        } catch {
          // ignore socket cleanup errors
        }
      }

      setUser(null);
      setError(null);
      router.replace('/');
    }
  }, [router]);

  const updateUser = useCallback((updated: User) => {
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