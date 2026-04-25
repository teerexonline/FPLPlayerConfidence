import type { Metadata } from 'next';
import { Fraunces, Geist } from 'next/font/google';
import { Providers } from '@/components/layout/Providers';
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

export const metadata: Metadata = {
  title: 'FPL Confidence',
  description: "Don't pick by points. Pick by confidence.",
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
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
