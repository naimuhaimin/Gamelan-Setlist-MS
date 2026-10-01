import type { Metadata, Viewport } from 'next';
import './globals.css';
import { StageProvider } from '@/lib/stageContext';

export const metadata: Metadata = {
  title: 'Gamelan Konvokesyen Queue & Stage Sync MS',
  description:
    'Real-time stage setlist and queue synchronization management system for live Gamelan ensemble graduation performances.',
  keywords: ['Gamelan', 'Konvokesyen', 'Setlist Queue', 'Realtime Sync', 'Stage Monitor'],
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#090a0f',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ms" className="dark">
      <body className="bg-[#090a0f] text-slate-100 antialiased selection:bg-amber-500 selection:text-black">
        <StageProvider>
          {children}
        </StageProvider>
      </body>
    </html>
  );
}
