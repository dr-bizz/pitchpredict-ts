import './global.css';
import type { Metadata, Viewport } from 'next';
import { Roboto } from 'next/font/google';
import type { ReactNode } from 'react';
import { Providers } from '../src/providers';

// Roboto (Material's typeface) exposed as a CSS variable the MUI theme reads.
// next/font always defines the variable, so the theme's font-family is never an
// undefined `var()` (which would invalidate the rule and fall back to serif).
const roboto = Roboto({
  subsets: ['latin'],
  weight: ['300', '400', '500', '700'],
  display: 'swap',
  variable: '--font-roboto',
});

export const metadata: Metadata = {
  title: 'PitchPredict',
  description: 'World Cup 2026 score-prediction game.',
  manifest: '/manifest.webmanifest',
  applicationName: 'PitchPredict',
  appleWebApp: {
    capable: true,
    title: 'PitchPredict',
    statusBarStyle: 'default',
  },
  icons: {
    icon: [
      { url: '/icon.svg', type: 'image/svg+xml' },
      { url: '/icon.png', type: 'image/png', sizes: '512x512' },
    ],
    apple: [{ url: '/icon.png', sizes: '512x512', type: 'image/png' }],
  },
};

export const viewport: Viewport = {
  themeColor: '#0A7B4B',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={roboto.variable}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
