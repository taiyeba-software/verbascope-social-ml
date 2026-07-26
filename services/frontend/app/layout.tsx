import type { Metadata, Viewport } from 'next';
import { Bodoni_Moda, Crimson_Text, DM_Mono, DM_Sans, Inter, Lora, Playfair_Display } from 'next/font/google';
import { cookies } from 'next/headers';
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

const THEME_COOKIE = 'vs-theme';

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Theme is resolved here, on the server, from the cookie the person's
  // browser already sent with this request — so `data-theme` (and the
  // matching background/color-scheme) is present in the very first byte
  // of HTML we send back. There's no "unthemed" moment for the browser
  // to paint before JS runs, which is what caused the light/dark flash.
  //
  // No saved cookie yet (first-ever visit) → default to 'dark', matching
  // the previous client-side script's default.
  const cookieStore = await cookies();
  const savedTheme = cookieStore.get(THEME_COOKIE)?.value;
  const theme: 'light' | 'dark' = savedTheme === 'light' ? 'light' : 'dark';

  return (
    <html
      lang="en"
      suppressHydrationWarning
      data-scroll-behavior="smooth"
      data-theme={theme}
      style={{
        backgroundColor: theme === 'dark' ? '#0f172a' : '#ddeef8',
        colorScheme: theme,
      }}
    >
      <body className={`${inter.variable} ${bodoniModa.variable} ${playfairDisplay.variable} ${crimsonText.variable} ${lora.variable} ${dmSans.variable} ${dmMono.variable}`}>
        <ThemeProvider initialTheme={theme}>
          <AuthProvider>
            <ProtectedRoute>{children}</ProtectedRoute>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}