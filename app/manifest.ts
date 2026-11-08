import type { MetadataRoute } from 'next';
import icon192 from '@/assets/icon-192.png';
import icon512 from '@/assets/icon-512.png';
import iconMaskable from '@/assets/icon-maskable-512.png';

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
      { src: icon192.src, sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: icon512.src, sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: iconMaskable.src, sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
