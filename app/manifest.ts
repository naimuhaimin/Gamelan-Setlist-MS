import type { MetadataRoute } from 'next';

/** Home-screen install info (Android "Add to Home screen" / "Install app"). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Anjung Live',
    short_name: 'Anjung Live',
    description: 'Live setlist, cue and loop sync for Gamelan Anjung Seni at Konvokesyen. By Naim M.',
    start_url: '/',
    display: 'standalone',
    background_color: '#0b0c10',
    theme_color: '#0b0c10',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
