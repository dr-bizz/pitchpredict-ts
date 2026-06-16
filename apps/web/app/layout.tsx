import './global.css';
import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { Providers } from '../src/providers';

export const metadata: Metadata = {
  title: 'PitchPredict',
  description: 'World Cup 2026 score-prediction game.',
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
