import './global.css';
import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { Providers } from '../src/providers';

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
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
