import type { Metadata, Viewport } from 'next';
import { Alex_Brush, Inter, Playfair_Display } from 'next/font/google';
import './globals.css';
import { StageProvider } from '@/lib/stageContext';
import { LanguageProvider } from '@/lib/i18n';
import { AppShell } from '@/components/AppShell';
import { themeBootScript } from '@/lib/useTheme';

const inter = Inter({ subsets: ['latin'], variable: '--font-sans', display: 'swap' });
// Serif for titles (like "SENI" in the logo) and a script for the wordmark (like "Anjung")
const display = Playfair_Display({ subsets: ['latin'], variable: '--font-display', weight: ['600', '700', '800'], display: 'swap' });
const script = Alex_Brush({ subsets: ['latin'], variable: '--font-script', weight: '400', display: 'swap' });

export const metadata: Metadata = {
  title: 'Anjung Live',
  description: 'Live setlist, cue and loop sync for Gamelan Anjung Seni at Konvokesyen and other events. By Naim M.',
  appleWebApp: { capable: true, title: 'Anjung Live', statusBarStyle: 'black-translucent' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#0d0b09',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${display.variable} ${script.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
      </head>
      <body>
        <LanguageProvider>
          <StageProvider>
            <AppShell>{children}</AppShell>
          </StageProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
