'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { googleAuthUrl } from '@/lib/api';
import type { RegisterFormData } from '@/types';
import '../auth.css';

export default function RegisterPage() {
  const { register, isLoading, error, clearError } = useAuth();
  const [formData, setFormData] = useState<RegisterFormData>({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
  });
  const [formErrors, setFormErrors] = useState<Partial<RegisterFormData>>({});

  const validateForm = (): boolean => {
    const errors: Partial<RegisterFormData> = {};

    if (!formData.firstName.trim()) {
      errors.firstName = 'true';
    }
    if (!formData.lastName.trim()) {
      errors.lastName = 'true';
    }
    if (!formData.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errors.email = 'true';
    }
    if (!formData.password || formData.password.length < 6) {
      errors.password = 'true';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (formErrors[name as keyof RegisterFormData]) {
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

    await register(formData);
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
        <div className="dot-triangle medium top-right"></div>
        <div className="dot-triangle small bottom-left"></div>
      </div>

      {/* Right Auth Card */}
      <div className="auth-form-side">
        <div className="auth-form-wrapper">
          <div className="auth-header">
            <h1>Create Account</h1>
            <p>Join Verbascope and start decoding social signals</p>
          </div>

          <form onSubmit={handleSubmit} className="auth-form">
            {/* Error Alert */}
            {error && (
              <div className="alert alert-error">
                <span>{error}</span>
              </div>
            )}

            {/* Name Fields Row */}
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="firstName" className="label">First Name</label>
                <input
                  id="firstName"
                  type="text"
                  name="firstName"
                  className={`input ${formErrors.firstName ? 'input-error' : ''}`}
                  placeholder="Taiyeba"
                  value={formData.firstName}
                  onChange={handleChange}
                  disabled={isLoading}
                />
              </div>
              <div className="form-group">
                <label htmlFor="lastName" className="label">Last Name</label>
                <input
                  id="lastName"
                  type="text"
                  name="lastName"
                  className={`input ${formErrors.lastName ? 'input-error' : ''}`}
                  placeholder="Islam"
                  value={formData.lastName}
                  onChange={handleChange}
                  disabled={isLoading}
                />
              </div>
            </div>

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
              <label htmlFor="password" className="label">Password</label>
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
              {formErrors.password && (
                <span className="form-hint">Minimum 6 characters</span>
              )}
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              className="btn btn-primary btn-full"
              disabled={isLoading}
            >
              {isLoading ? 'Creating Account...' : 'Create Account'}
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
              window.location.href = googleAuthUrl;
            }}
            disabled={isLoading}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"></circle>
            </svg>
            Continue with Google
          </button>

          {/* Login Link */}
          <p className="auth-footer">
            Already have an account?{' '}
            <Link href="/auth/login" className="link">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
