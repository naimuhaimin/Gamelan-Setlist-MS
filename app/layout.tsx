import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { StageProvider } from '@/lib/stageContext';

const inter = Inter({ subsets: ['latin'], variable: '--font-sans', display: 'swap' });

export const metadata: Metadata = {
  title: 'Anjung Live',
  description: 'Live setlist, cue and loop sync for Gamelan Anjung Seni at Konvokesyen. By Naim M.',
  appleWebApp: { capable: true, title: 'Anjung Live', statusBarStyle: 'black-translucent' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#0b0c10',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ms" className={inter.variable}>
      <body>
        <StageProvider>{children}</StageProvider>
      </body>
    </html>
  );
}
