import type { Metadata, Viewport } from 'next';
import './globals.css';
import { AuthProvider } from '@/components/auth-provider';
import ProtectedRoute from '@/components/ProtectedRoute';
import { ThemeProvider } from '@/components/theme-provider';

export const metadata: Metadata = {
  title: 'Verbascope – Decode Emotions Behind Every Post',
  description: 'AI-powered social media analysis. Understand tone, sarcasm, and sentiment.',
  icons: {
    icon: { url: '/favicon.jpg', type: 'image/svg+xml' },
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        <ThemeProvider>
          <AuthProvider>
            <ProtectedRoute>{children}</ProtectedRoute>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}