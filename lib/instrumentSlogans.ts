/**
 * Just-for-fun catchphrases shown under each instrument in the instrument picker (only there).
 * English text; the Malay versions live in lib/i18n-ms.ts like every other phrase.
 */
const SLOGANS: Record<string, string> = {
  bonang: 'The coolest',
  denggang: 'Leads the tune, steals the show',
  gambang: 'Wooden keys, golden vibes',
  'saron pekin': 'Small but fiery',
  'saron baron': 'The steady backbone',
  'saron demung': 'Deep and dependable',
  gong: 'One hit. Everyone listens.',
  gendang: 'The heartbeat of the ensemble',
  kenong: 'Keeps everyone in line',
  kempul: 'The friendly boom',
};

/** For instruments added later by the Admin. */
const FALLBACK = ['A star of the ensemble', 'Born to play', 'Small part, big sound'];

export function instrumentSlogan(name: string): string {
  const key = name.trim().toLowerCase();
  if (SLOGANS[key]) return SLOGANS[key];
  let h = 0;
  for (const ch of key) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return FALLBACK[h % FALLBACK.length];
}
