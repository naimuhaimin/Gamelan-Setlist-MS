import type { IntroUnit } from '@/types';

/** "bar" / "bars" / "beat" / "beats" for a given count. */
export const introUnitWord = (count: number, unit: IntroUnit) =>
  unit === 'beats' ? (count === 1 ? 'beat' : 'beats') : count === 1 ? 'bar' : 'bars';

/** e.g. "4 bars", "2 beats", "1 bar". */
export const formatIntro = (count: number, unit: IntroUnit) => `${count} ${introUnitWord(count, unit)}`;
