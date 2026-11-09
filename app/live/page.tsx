'use client';

import { StageView } from '@/components/StageView';
import { ChatLauncher } from '@/components/SidangChat';
import { useStage } from '@/lib/stageContext';

export default function LivePage() {
  const { liveSession, stageLive, isFinished, canControl, role } = useStage();
  return (
    <>
      <StageView />
      {liveSession && (
        <ChatLauncher
          key={liveSession.id}
          sessionId={liveSession.id}
          sessionName={liveSession.name}
          raised={stageLive && !isFinished && (canControl || role === 'controller')}
        />
      )}
    </>
  );
}
