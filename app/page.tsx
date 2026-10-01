'use client';

import React, { useState } from 'react';
import { useStage } from '@/lib/stageContext';
import { Navbar } from '@/components/Navbar';
import { LiveStageScreen } from '@/components/LiveStageScreen';
import { MaestroSetlistEditor } from '@/components/MaestroSetlistEditor';
import { RoleLoginModal } from '@/components/RoleLoginModal';
import { LibraryModal } from '@/components/LibraryModal';

export default function HomePage() {
  const { activeRole } = useStage();

  const [activeTab, setActiveTab] = useState<'stage' | 'editor'>('stage');
  const [roleModalOpen, setRoleModalOpen] = useState(false);
  const [libraryModalOpen, setLibraryModalOpen] = useState(false);

  // If a player tries to open editor, we can prompt role modal
  const handleOpenEditor = () => {
    if (activeRole === 'maestro' || activeRole === 'admin') {
      setActiveTab('editor');
    } else {
      setRoleModalOpen(true);
    }
  };

  return (
    <div className="min-h-screen bg-[#090a0f] text-white flex flex-col font-sans">
      
      {/* Universal Real-Time Stage Navbar */}
      <Navbar
        onOpenRoleModal={() => setRoleModalOpen(true)}
        onOpenLibraryModal={() => setLibraryModalOpen(true)}
        activeTab={activeTab}
        setActiveTab={(tab) => {
          if (tab === 'editor') handleOpenEditor();
          else setActiveTab('stage');
        }}
      />

      {/* Main View Area */}
      <main className="flex-1 flex flex-col">
        {activeTab === 'stage' ? (
          <LiveStageScreen />
        ) : (
          <MaestroSetlistEditor
            onOpenLibrary={() => setLibraryModalOpen(true)}
            onJumpToStage={() => setActiveTab('stage')}
          />
        )}
      </main>

      {/* Role Passkey Switcher Modal */}
      <RoleLoginModal
        isOpen={roleModalOpen}
        onClose={() => setRoleModalOpen(false)}
      />

      {/* Song Library Repertoire Modal */}
      <LibraryModal
        isOpen={libraryModalOpen}
        onClose={() => setLibraryModalOpen(false)}
      />

    </div>
  );
}
