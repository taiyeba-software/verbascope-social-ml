import type { Metadata, Viewport } from 'next';
import Script from 'next/script';
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

const themeInitScript = `
  (function() {
    try {
      var saved = localStorage.getItem('vs-theme');
      var theme = (saved === 'dark' || saved === 'light') ? saved : 'light';
      document.documentElement.setAttribute('data-theme', theme);
    } catch (e) {}
  })();
`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning data-scroll-behavior="smooth">
      <head>
        <Script
          id="theme-init"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: themeInitScript }}
        />
      </head>
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
