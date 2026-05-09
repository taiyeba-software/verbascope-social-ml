'use client';

import { useAuthContext } from '@/components/auth-provider';
import type { LoginFormData, RegisterFormData } from '@/types';

interface UseAuthReturn {
  user: import('@/types').User | null;
  isLoading: boolean;
  error: string | null;
  register: (data: RegisterFormData) => Promise<void>;
  login: (data: LoginFormData) => Promise<void>;
  loginWithGoogle: () => void;
  logout: () => void;
  clearError: () => void;
}

export const useAuth = (): UseAuthReturn => {
  const { user, isLoading, error, register, login, loginWithGoogle, logout, clearError } = useAuthContext();

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
