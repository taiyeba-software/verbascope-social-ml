import type { Metadata, Viewport } from 'next';
import { Bodoni_Moda, Crimson_Text, DM_Mono, DM_Sans, Inter, Lora, Playfair_Display } from 'next/font/google';
import Script from 'next/script';
import './globals.css';
import { AuthProvider } from '@/components/auth-provider';
import ProtectedRoute from '@/components/ProtectedRoute';
import { ThemeProvider } from '@/components/theme-provider';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
});

const bodoniModa = Bodoni_Moda({
  subsets: ['latin'],
  weight: ['400', '700'],
  variable: '--font-bodoni-moda',
});

const playfairDisplay = Playfair_Display({
  subsets: ['latin'],
  weight: ['400', '700'],
  variable: '--font-playfair-display',
});

const crimsonText = Crimson_Text({
  subsets: ['latin'],
  weight: ['400', '600'],
  variable: '--font-crimson-text',
});

const lora = Lora({
  subsets: ['latin'],
  weight: ['400', '600'],
  variable: '--font-lora',
});

const dmSans = DM_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-dm-sans',
});

const dmMono = DM_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-dm-mono',
});

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

// NOTE: this currently always resolves to 'dark' when there's no saved
// preference, since both branches of the matchMedia ternary return 'dark'.
// That's presumably intentional (dark-by-default), but flagging it in case
// it wasn't — if you want the OS preference respected, the false branch
// should be 'light'.
const themeInitScript = `
  (function() {
    try {
      var saved = localStorage.getItem('vs-theme');
      var theme = saved === 'dark' || saved === 'light'
        ? saved
        : window.matchMedia('(prefers-color-scheme: dark)').matches
          ? 'dark'
          : 'dark';
      document.documentElement.setAttribute('data-theme', theme);
      document.documentElement.style.backgroundColor = theme === 'dark' ? '#0f172a' : '#ddeef8';
      document.documentElement.style.colorScheme = theme;
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
      <body className={`${inter.variable} ${bodoniModa.variable} ${playfairDisplay.variable} ${crimsonText.variable} ${lora.variable} ${dmSans.variable} ${dmMono.variable}`}>
        <ThemeProvider>
          <AuthProvider>
            <ProtectedRoute>{children}</ProtectedRoute>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}