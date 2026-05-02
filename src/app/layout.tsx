import type { Metadata, Viewport } from 'next';
import { Fraunces, Geist } from 'next/font/google';
import { Providers } from '@/components/layout/Providers';
import { Topbar } from '@/components/layout/Topbar';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

// Variable font — single file covers all weights. opsz axis enables the
// "optical size" feature used for the 44px display treatment (UI_GUIDELINES §3).
const fraunces = Fraunces({
  variable: '--font-fraunces',
  subsets: ['latin'],
  axes: ['opsz'],
});

// Resolved from globals.css: Topbar uses bg-bg → --bg token.
// Light: --bg: #fafaf9  |  Dark: --bg: #0a0a0a
export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#fafaf9' },
    { media: '(prefers-color-scheme: dark)', color: '#0a0a0a' },
  ],
};

export const metadata: Metadata = {
  title: 'FPL Confidence',
  description: "Don't pick by points. Pick by confidence.",
  applicationName: 'FPL Confidence',
  appleWebApp: {
    capable: true,
    title: 'FPL Conf',
    statusBarStyle: 'default',
  },
  formatDetection: {
    telephone: false,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${fraunces.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="flex min-h-full flex-col">
        <Providers>
          <Topbar />
          {children}
        </Providers>
      </body>
    </html>
  );
}
