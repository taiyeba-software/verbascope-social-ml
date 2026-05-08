'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import type { LoginFormData } from '@/types';
import '../auth.css';

export default function LoginPage() {
  const { login, isLoading, error, clearError } = useAuth();
  const [formData, setFormData] = useState<LoginFormData>({
    email: '',
    password: '',
    rememberMe: false,
  });
  const [formErrors, setFormErrors] = useState<Partial<LoginFormData>>({});

  const validateForm = (): boolean => {
    const errors: Partial<LoginFormData> = {};

    if (!formData.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errors.email = 'true';
    }
    if (!formData.password) {
      errors.password = 'true';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, type, value, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
    if (formErrors[name as keyof LoginFormData]) {
      setFormErrors((prev) => ({ ...prev, [name]: '' }));
    }
    if (error) {
      clearError();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    await login(formData);
  };

  return (
    <div className="auth-container">
      {/* Left Branding Side */}
      <div className="auth-branding">
        <div className="branding-content">
          <div className="v-logo">
            <svg className="v-mark" viewBox="0 0 42 42" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="4,6 21,36 38,6 32,6 21,26 10,6" />
            </svg>
            <div>
              <span className="v-logo-name">Verbascope</span>
              <span className="v-logo-sub">Social · Intelligence</span>
            </div>
          </div>

          <div className="branding-message">
            <h2>Decode emotions behind every post.</h2>
            <p>Understand tone, sarcasm, and sentiment with AI-powered social intelligence.</p>
          </div>


        </div>
        {/* V-triangle decorations */}
        <div className="dot-triangle large top-right"></div>
        <div className="dot-triangle small bottom-left"></div>
      </div>

      {/* Right Auth Card */}
      <div className="auth-form-side">
        <div className="auth-form-wrapper">
          <div className="auth-header">
            <h1>Welcome Back</h1>
            <p>Sign in to your Verbascope account</p>
          </div>

          <form onSubmit={handleSubmit} className="auth-form">
            {/* Error Alert */}
            {error && (
              <div className="alert alert-error">
                <span>{error}</span>
              </div>
            )}

            {/* Email Field */}
            <div className="form-group">
              <label htmlFor="email" className="label">Email Address</label>
              <input
                id="email"
                type="email"
                name="email"
                className={`input ${formErrors.email ? 'input-error' : ''}`}
                placeholder="you@example.com"
                value={formData.email}
                onChange={handleChange}
                disabled={isLoading}
              />
            </div>

            {/* Password Field */}
            <div className="form-group">
              <div className="form-label-with-link">
                <label htmlFor="password" className="label">Password</label>
                <Link href="#" className="link-small">Forgot?</Link>
              </div>
              <input
                id="password"
                type="password"
                name="password"
                className={`input ${formErrors.password ? 'input-error' : ''}`}
                placeholder="••••••"
                value={formData.password}
                onChange={handleChange}
                disabled={isLoading}
              />
            </div>

            {/* Remember Me */}
            <div className="form-checkbox">
              <input
                id="rememberMe"
                type="checkbox"
                name="rememberMe"
                checked={formData.rememberMe || false}
                onChange={handleChange}
                disabled={isLoading}
              />
              <label htmlFor="rememberMe">Remember me</label>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              className="btn btn-primary btn-full"
              disabled={isLoading}
            >
              {isLoading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          {/* Divider */}
          <div className="divider-with-text">
            <span>or</span>
          </div>

          {/* Google Button */}
          <button
            type="button"
            className="btn btn-google"
            onClick={() => {
              window.location.href = 'http://localhost:3000/api/auth/google';
            }}
            disabled={isLoading}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"></circle>
            </svg>
            Continue with Google
          </button>

          {/* Register Link */}
          <p className="auth-footer">
            Don&apos;t have an account?{' '}
            <Link href="/auth/register" className="link">
              Create one
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
