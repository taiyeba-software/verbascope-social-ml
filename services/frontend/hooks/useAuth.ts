'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { authService } from '@/lib/api';
import type { User, RegisterFormData, LoginFormData, AuthResponse } from '@/types';

interface UseAuthReturn {
  user: User | null;
  isLoading: boolean;
  error: string | null;
  register: (data: RegisterFormData) => Promise<void>;
  login: (data: LoginFormData) => Promise<void>;
  loginWithGoogle: () => void;
  logout: () => void;
  clearError: () => void;
}

export const useAuth = (): UseAuthReturn => {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

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
          // Redirect to feed on success
          router.push('/feed');
        } else {
          setError(result.message || 'Registration failed');
        }
      } catch (err: unknown) {
        const errorMessage =
          (err as any)?.response?.data?.message ||
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
          (err as any)?.response?.data?.message ||
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

  const logout = useCallback(() => {
    setUser(null);
    setError(null);
    router.push('/');
  }, [router]);

  return {
    user,
    isLoading,
    error,
    register,
    login,
    loginWithGoogle,
    logout,
    clearError,
  };
};
