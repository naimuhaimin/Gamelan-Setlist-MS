'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { RefreshCw, WifiOff } from 'lucide-react';
import { useStage } from '@/lib/stageContext';
import { useLockScreen, type LockScreenControls, type LockScreenInfo } from '@/lib/useLockScreen';
import { useChime } from '@/lib/useChime';
import { useTheme } from '@/lib/useTheme';
import { formatIntro } from '@/lib/format';
import { tr, useT } from '@/lib/i18n';
import { TopBar, BottomNav } from './TopBar';
import { InstrumentPicker, LoginModal, ShareModal } from './AccountDialogs';
import { AccessModal, InstrumentsModal } from './AdminDialogs';
import { Button, Toaster } from './ui';

/**
 * App-wide frame: navbar, phone bottom tabs, dialogs, and the device features
 * (lock-screen display, song-change chime) that must keep running on every page.
 */

const LOCK_PREF_KEY = 'anjung_lockscreen';

type Dialog = 'login' | 'instrument' | 'share' | 'instruments' | 'access' | null;

interface ShellContextType {
  lockScreen: ReturnType<typeof useLockScreen>;
  chime: ReturnType<typeof useChime>;
  theme: ReturnType<typeof useTheme>;
  /** Lock-screen display preference (on by default); it starts on the next tap when on. */
  lockPref: boolean;
  setLockPref: (on: boolean) => void;
  openLogin: () => void;
  openInstrumentPicker: () => void;
  openShare: (target?: { url: string; title: string }) => void;
  openInstruments: () => void;
  openAccess: () => void;
}

const ShellContext = createContext<ShellContextType | undefined>(undefined);

export function useShell() {
  const ctx = useContext(ShellContext);
  if (!ctx) throw new Error('useShell must be used inside AppShell');
  return ctx;
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const {
    loaded,
    loadError,
    reload,
    connection,
    role,
    instrumentChosen,
    instruments,
    liveSession,
    livePart,
    liveQueue,
    activeIndex,
    activeItem,
    nextPart,
    roomState,
    isCued,
    canControl,
    isFinished,
    liveInterlude,
    interludeDone,
    resolveQueue,
    goNext,
    goPrev,
    goLive,
    interludeTracking,
    setInterludeDone,
  } = useStage();
  const [dialog, setDialog] = useState<Dialog>(null);
  const { t, lang } = useT();
  const [shareTarget, setShareTarget] = useState<{ url: string; title: string } | undefined>(undefined);

  // ---- Lock screen: the NEXT item is the headline, the current one the small line ----
  const lockInfo = useMemo<LockScreenInfo>(() => {
    const blank: Pick<LockScreenInfo, 'stats' | 'highlight'> = { stats: [], highlight: false };
    const waiting: LockScreenInfo = {
      ...blank,
      title: tr('Waiting for the stage'),
      line1: tr('Nothing is live yet'),
      line2: 'Anjung Live',
      top: 'ANJUNG LIVE',
      kicker: tr('WAITING'),
      heading: tr('Nothing is live yet'),
      detail: '',
      onHold: false,
    };
    // ended with no intermission: the lock screen shows "nothing live"
    if (!liveSession || !livePart || (isFinished && !liveInterlude)) return waiting;
    const location = `${liveSession.name} · ${livePart.name}`;
    const onHold = roomState.is_paused;
    if (isFinished && liveInterlude && nextPart) {
      const first = resolveQueue(nextPart.id)[0];
      const ready = interludeDone >= liveInterlude.songs;
      const progress = ready
        ? tr('{label} done · get ready', { label: liveInterlude.label })
        : tr('{label} · song {n} of {total}', { label: liveInterlude.label, n: interludeDone + 1, total: liveInterlude.songs });
      return {
        ...blank,
        title: tr('Next: {title}', { title: first ? first.song.title : nextPart.name }),
        line1: `☕ ${tr('Intermission')} · ${progress}`,
        line2: tr('{sidang} · then {part}', { sidang: liveSession.name, part: nextPart.name }),
        top: `${tr('INTERMISSION')} · ${liveSession.name}`.toUpperCase(),
        kicker: ready ? tr('GET READY') : tr('INTERMISSION'),
        heading: first ? first.song.title : nextPart.name,
        detail: tr('{part} opens with this · {progress}', { part: nextPart.name, progress }),
        highlight: ready,
        onHold: false,
      };
    }
    if (!activeItem)
      return {
        ...blank,
        title: tr('{part}: no songs yet', { part: livePart.name }),
        line1: tr('Waiting for the Maestro'),
        line2: location,
        top: location.toUpperCase(),
        kicker: tr('WAITING'),
        heading: tr('{part} has no songs yet', { part: livePart.name }),
        detail: '',
        onHold,
      };

    const loopText = `${roomState.current_loop_iteration || 1}/${activeItem.loopCount}`;
    const nowLine = activeItem.isBreak
      ? tr('Now: {title}', { title: activeItem.song.title })
      : tr('Now: {title} · Loop {loop}', { title: activeItem.song.title, loop: loopText });
    const nowTop = activeItem.isBreak
      ? `${tr('NOW')} · ${activeItem.song.title.toUpperCase()}`
      : `${tr('NOW')} · ${activeItem.song.title} · ${tr('loop')} ${loopText}`;
    const next = liveQueue[activeIndex + 1];
    const after = liveQueue[activeIndex + 2];
    const holdTag = onHold ? `⏸ ${tr('ON HOLD')}` : null;

    if (!next)
      return {
        ...blank,
        title: nextPart ? tr('Last item · then {part}', { part: nextPart.name }) : tr('Last item'),
        line1: [holdTag, nowLine].filter(Boolean).join(' · '),
        line2: location,
        top: nowTop,
        kicker: tr('LAST ITEM'),
        heading: nextPart ? tr('Then {part}', { part: nextPart.name }) : tr('End of {part}', { part: livePart.name }),
        detail: location,
        onHold,
      };

    if (next.isBreak)
      return {
        ...blank,
        title: tr('Next: {title}', { title: next.song.title }),
        line1: [holdTag, next.breakMinutes ? tr('{n} min break', { n: next.breakMinutes }) : tr('Break'), nowLine].filter(Boolean).join(' · '),
        line2: `${location} · ${after ? tr('Then: {title}', { title: after.song.title }) : tr('Then: end')}`,
        top: nowTop,
        kicker: tr('NEXT · BREAK'),
        heading: next.song.title,
        detail: next.breakMinutes ? tr('About {n} minutes', { n: next.breakMinutes }) : tr('Rest until the signal'),
        onHold,
      };

    const cuedNext = isCued(next.introInstruments);
    const intro = formatIntro(next.introBarCount, next.introUnit);
    const rhythm = next.song.rhythms.join(' → ');
    return {
      title: tr('Next: {title}', { title: next.song.title }),
      line1: [holdTag ?? (cuedNext ? `★ ${tr('YOUR CUE NEXT')}` : null), tr('Intro {intro}', { intro }), next.introInstruments.join(', ') || null, rhythm || null, nowLine]
        .filter(Boolean)
        .join(' · '),
      line2: `${location} · ${after ? tr('Then: {title}', { title: after.song.title }) : tr('Then: last item')}`,
      top: nowTop,
      kicker: cuedNext ? tr('YOUR CUE NEXT') : tr('NEXT'),
      heading: next.song.title,
      detail: [next.introInstruments.join(', '), rhythm].filter(Boolean).join(' · '),
      stats: [
        { label: tr('Intro'), value: intro },
        { label: tr('Loops'), value: `${next.loopCount}×` },
      ],
      highlight: cuedNext,
      onHold,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveSession, livePart, nextPart, activeItem, liveQueue, activeIndex, roomState.current_loop_iteration, roomState.is_paused, isCued, isFinished, liveInterlude, interludeDone, resolveQueue, lang]);
  // Controllers (and Maestro/Admin) get ⏮ / ⏭ on the lock screen to run the stage without opening the app
  const lockControls = useMemo<LockScreenControls | null>(() => {
    if (!canControl || !liveSession || !livePart) return null;
    if (isFinished && liveInterlude && nextPart) {
      // Intermission: ⏭ marks a guest song done, then starts the next Bahagian; ⏮ undoes
      const ready = !interludeTracking || interludeDone >= liveInterlude.songs;
      return {
        next: ready ? () => goLive(nextPart.id) : () => setInterludeDone(interludeDone + 1),
        prev: interludeTracking && interludeDone > 0 ? () => setInterludeDone(interludeDone - 1) : goPrev,
      };
    }
    if (isFinished) return { prev: goPrev, next: nextPart ? () => goLive(nextPart.id) : undefined };
    if (!activeItem) return null;
    return { prev: activeIndex > 0 ? goPrev : undefined, next: goNext };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canControl, liveSession, livePart, isFinished, liveInterlude, nextPart, interludeTracking, interludeDone, activeItem, activeIndex, liveQueue, roomState]);
  const lockScreen = useLockScreen(lockInfo, lockControls);

  // On by default. Browsers only allow the silent audio after a tap, so whenever the
  // preference is on and it isn't running (first load, or another app took the audio),
  // the next tap anywhere starts it.
  const [lockPref, setLockPrefState] = useState(true);
  useEffect(() => {
    try {
      setLockPrefState(localStorage.getItem(LOCK_PREF_KEY) !== 'off');
    } catch {
      // storage blocked: keep default
    }
  }, []);
  const setLockPref = useCallback((on: boolean) => {
    setLockPrefState(on);
    try {
      localStorage.setItem(LOCK_PREF_KEY, on ? 'on' : 'off');
    } catch {
      // ignore
    }
  }, []);
  const startLock = lockScreen.start;
  useEffect(() => {
    if (!lockPref || lockScreen.active || !lockScreen.supported) return;
    const go = () => {
      startLock();
    };
    const opts = { capture: true } as const;
    document.addEventListener('pointerdown', go, opts);
    document.addEventListener('keydown', go, opts);
    return () => {
      document.removeEventListener('pointerdown', go, opts);
      document.removeEventListener('keydown', go, opts);
    };
  }, [lockPref, lockScreen.active, lockScreen.supported, startLock]);

  // ---- Chime on song / Bahagian change (not on the controlling device) ----
  const chime = useChime();
  // Intermission over (all guest songs done) also chimes, so musicians get ready
  const interludeReady = !!liveInterlude && interludeDone >= liveInterlude.songs;
  const songKey = `${livePart?.id ?? ''}|${activeItem?.queueItem.id ?? ''}|${isFinished ? 'end' : ''}|${interludeReady ? 'ready' : ''}`;
  const lastSongKey = useRef<string | null>(null);
  useEffect(() => {
    if (!loaded) return;
    const prev = lastSongKey.current;
    lastSongKey.current = songKey;
    if (prev === null || prev === songKey || !activeItem || canControl) return;
    chime.play(
      interludeReady || (!isFinished && !activeItem.isBreak && isCued(activeItem.introInstruments)) ? 'cue' : 'change'
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [songKey, loaded]);

  // First visit on a device: ask the musician for their instrument
  useEffect(() => {
    if (loaded && !loadError && !instrumentChosen && role === 'player' && instruments.length) setDialog('instrument');
  }, [loaded, loadError, instrumentChosen, role, instruments.length]);

  const theme = useTheme();
  const close = useCallback(() => setDialog(null), []);
  const shell: ShellContextType = {
    lockScreen,
    chime,
    theme,
    lockPref,
    setLockPref,
    openLogin: () => setDialog('login'),
    openInstrumentPicker: () => setDialog('instrument'),
    openShare: (target) => {
      setShareTarget(target);
      setDialog('share');
    },
    openInstruments: () => setDialog('instruments'),
    openAccess: () => setDialog('access'),
  };

  if (!loaded) {
    return (
      <div className="min-h-dvh grid place-items-center">
        <div className="flex flex-col items-center gap-3 text-muted">
          <div className="w-8 h-8 rounded-full border-2 border-line border-t-brass animate-spin" />
          <span className="text-sm">{t('Connecting to the stage…')}</span>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="min-h-dvh grid place-items-center px-6">
        <div className="max-w-md text-center space-y-3">
          <WifiOff className="w-10 h-10 mx-auto text-faint" />
          <h1 className="text-xl font-semibold">{t('Can’t reach the database')}</h1>
          <p className="text-sm text-muted break-words">{loadError}</p>
          <Button variant="primary" onClick={() => reload()}>
            <RefreshCw className="w-4 h-4" /> {t('Try again')}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <ShellContext.Provider value={shell}>
      <div className="min-h-dvh flex flex-col">
        <TopBar />

        {connection === 'offline' && (
          <div className="bg-songket-soft border-b border-songket/40 text-songket-light text-sm">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2 flex items-center gap-2">
              <WifiOff className="w-4 h-4 shrink-0" />
              {t('Connection lost. Reconnecting… the screen may be out of date.')}
              <button onClick={() => reload()} className="ml-auto underline underline-offset-2">
                {t('Refresh now')}
              </button>
            </div>
          </div>
        )}

        <main className="flex-1">{children}</main>

        <footer className="text-center text-[11px] text-faint pt-4 pb-24 md:pb-4">Anjung Live · {t('by Naim M.')}</footer>

        <BottomNav />
      </div>

      <LoginModal open={dialog === 'login'} onClose={close} />
      <InstrumentPicker open={dialog === 'instrument'} onClose={close} />
      <ShareModal open={dialog === 'share'} onClose={close} target={shareTarget} />
      {role === 'admin' && (
        <>
          <InstrumentsModal open={dialog === 'instruments'} onClose={close} />
          <AccessModal open={dialog === 'access'} onClose={close} />
        </>
      )}
      <Toaster />
    </ShellContext.Provider>
  );
}
