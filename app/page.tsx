'use client';

import React, { useEffect, useState } from 'react';
import { RefreshCw, WifiOff } from 'lucide-react';
import { useStage } from '@/lib/stageContext';
import { TopBar, type Tab } from '@/components/TopBar';
import { StageView } from '@/components/StageView';
import { SetlistEditor } from '@/components/SetlistEditor';
import { LibraryView } from '@/components/LibraryView';
import { InstrumentPicker, LoginModal, ShareModal } from '@/components/AccountDialogs';
import { AccessModal, InstrumentsModal } from '@/components/AdminDialogs';
import { Button, Toaster } from '@/components/ui';

type Dialog = 'login' | 'instrument' | 'share' | 'instruments' | 'access' | null;

export default function HomePage() {
  const { loaded, loadError, reload, connection, isManager, role, instrumentChosen, instruments } = useStage();
  const [tab, setTab] = useState<Tab>('stage');
  const [dialog, setDialog] = useState<Dialog>(null);

  // Leave the Setlist tab if the role no longer allows it
  useEffect(() => {
    if (tab === 'setlist' && !isManager) setTab('stage');
  }, [tab, isManager]);

  // First visit on a device: ask the musician for their instrument
  useEffect(() => {
    if (loaded && !loadError && !instrumentChosen && role === 'player' && instruments.length) setDialog('instrument');
  }, [loaded, loadError, instrumentChosen, role, instruments.length]);

  if (!loaded) {
    return (
      <div className="min-h-dvh grid place-items-center">
        <div className="flex flex-col items-center gap-3 text-muted">
          <div className="w-8 h-8 rounded-full border-2 border-line border-t-brass animate-spin" />
          <span className="text-sm">Connecting to the stage…</span>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="min-h-dvh grid place-items-center px-6">
        <div className="max-w-md text-center space-y-3">
          <WifiOff className="w-10 h-10 mx-auto text-faint" />
          <h1 className="text-xl font-semibold">Can’t reach the database</h1>
          <p className="text-sm text-muted break-words">{loadError}</p>
          <Button variant="primary" onClick={() => reload()}>
            <RefreshCw className="w-4 h-4" /> Try again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh flex flex-col">
      <TopBar
        tab={tab}
        onTab={setTab}
        onLogin={() => setDialog('login')}
        onPickInstrument={() => setDialog('instrument')}
        onShare={() => setDialog('share')}
        onInstruments={() => setDialog('instruments')}
        onAccess={() => setDialog('access')}
      />

      {connection === 'offline' && (
        <div className="bg-red-500/10 border-b border-red-500/30 text-red-200 text-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2 flex items-center gap-2">
            <WifiOff className="w-4 h-4 shrink-0" />
            Connection lost. Reconnecting… the screen may be out of date.
            <button onClick={() => reload()} className="ml-auto underline underline-offset-2">
              Refresh now
            </button>
          </div>
        </div>
      )}

      <main className="flex-1">
        {tab === 'stage' && <StageView onOpenSetlist={() => setTab('setlist')} />}
        {tab === 'setlist' && isManager && <SetlistEditor onShowStage={() => setTab('stage')} />}
        {tab === 'library' && <LibraryView />}
      </main>

      <LoginModal open={dialog === 'login'} onClose={() => setDialog(null)} />
      <InstrumentPicker open={dialog === 'instrument'} onClose={() => setDialog(null)} />
      <ShareModal open={dialog === 'share'} onClose={() => setDialog(null)} />
      {role === 'admin' && (
        <>
          <InstrumentsModal open={dialog === 'instruments'} onClose={() => setDialog(null)} />
          <AccessModal open={dialog === 'access'} onClose={() => setDialog(null)} />
        </>
      )}
      <Toaster />
    </div>
  );
}
