'use client';

import React from 'react';
import { useStage } from '@/lib/stageContext';
import {
  SkipForward,
  SkipBack,
  RotateCw,
  Plus,
  Minus,
  Sparkles,
  AlertCircle,
  Play,
  Pause,
  Layers,
  ChevronRight,
  Flame,
  Clock,
  Music2,
} from 'lucide-react';

export const LiveStageScreen: React.FC = () => {
  const {
    currentSession,
    currentPart,
    activeSongDisplay,
    upNextSongs,
    activeRole,
    selectedInstrument,
    isInstrumentCued,
    navigateNext,
    navigatePrev,
    jumpToQueueItem,
    incrementLoop,
    decrementLoop,
    resetLoop,
    togglePause,
    roomState,
  } = useStage();

  const canControl = activeRole === 'controller' || activeRole === 'maestro' || activeRole === 'admin';

  return (
    <div className="flex flex-col min-h-[calc(100vh-5rem)] p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full gap-6">
      
      {/* Dynamic Cue Alert Banner for Player Instrument */}
      {selectedInstrument && (
        <div
          className={`w-full rounded-2xl p-4 sm:p-5 border transition-all duration-500 flex items-center justify-between shadow-lg ${
            isInstrumentCued
              ? 'bg-gradient-to-r from-amber-950/80 via-amber-900/60 to-yellow-950/80 border-amber-400 shadow-glow-gold animate-pulseGlow'
              : 'bg-[#10131f] border-[#22293f] opacity-80'
          }`}
        >
          <div className="flex items-center gap-3 sm:gap-4">
            <div
              className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
                isInstrumentCued
                  ? 'bg-amber-400 text-black shadow-glow-gold'
                  : 'bg-[#1b2135] text-slate-400'
              }`}
            >
              {isInstrumentCued ? (
                <Flame className="w-7 h-7 fill-black animate-bounce" />
              ) : (
                <Sparkles className="w-6 h-6" />
              )}
            </div>
            <div>
              <div className="text-xs font-mono uppercase tracking-wider font-bold">
                {isInstrumentCued ? (
                  <span className="text-amber-300 flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping inline-block" />
                    LIVE CUE WARNING — ATTENTION
                  </span>
                ) : (
                  <span className="text-slate-400">Player Monitor Active</span>
                )}
              </div>
              <div className="text-base sm:text-xl font-black text-white tracking-tight">
                {isInstrumentCued ? (
                  <>
                    YOUR INSTRUMENT (<span className="text-amber-300 underline decoration-amber-400">{selectedInstrument}</span>) CUES THIS SONG!
                  </>
                ) : (
                  <>
                    Instrument Standby: <span className="text-slate-300 font-bold">{selectedInstrument}</span> (Ready for upcoming cues)
                  </>
                )}
              </div>
            </div>
          </div>

          {isInstrumentCued && activeSongDisplay && (
            <div className="hidden md:flex flex-col items-end">
              <span className="text-xs font-mono text-amber-200/90 uppercase font-semibold">Intro Length</span>
              <span className="text-2xl sm:text-3xl font-extrabold text-amber-400 font-mono tracking-tight">
                {activeSongDisplay.introBarCount} BARS
              </span>
            </div>
          )}
        </div>
      )}

      {/* Main Grid: NOW PLAYING (Giant stage focus) + UP NEXT (Drawer/Sidebar) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 items-stretch">
        
        {/* NOW PLAYING MAIN HERO CARD (Col 1-8) */}
        <div className="lg:col-span-8 flex flex-col justify-between bg-[#0e111c] border-2 border-[#242c44] rounded-3xl p-6 sm:p-10 shadow-2xl relative overflow-hidden">
          
          {/* Ambient stage glow behind card */}
          <div className="absolute top-0 right-0 -mr-20 -mt-20 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

          {/* Header Row: Now Playing Tag & Session/Part Badges */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#1f263d] pb-5 relative z-10">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-950/70 border border-red-500/50 text-red-300 text-xs font-mono uppercase tracking-widest font-extrabold animate-pulse">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
                NOW PLAYING
              </div>
              {roomState.is_paused && (
                <div className="px-3 py-1.5 rounded-full bg-amber-950/80 border border-amber-500/60 text-amber-300 text-xs font-mono uppercase tracking-widest font-bold flex items-center gap-1.5">
                  <Pause className="w-3.5 h-3.5" />
                  PAUSED
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
              <span className="px-2.5 py-1 rounded-md bg-[#161b2c] border border-[#27304b] text-slate-300 font-semibold">
                {currentSession?.name || 'Sidang'}
              </span>
              <span className="px-2.5 py-1 rounded-md bg-[#161b2c] border border-[#27304b] text-cyan-300 font-semibold">
                {currentPart?.name || 'Bahagian'}
              </span>
            </div>
          </div>

          {/* Center Stage: Giant Song Title */}
          <div className="my-8 sm:my-12 relative z-10">
            {activeSongDisplay ? (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-slate-400 uppercase tracking-widest">
                    Queue Position #{activeSongDisplay.sortOrder}
                  </span>
                  {activeSongDisplay.isOverride && (
                    <span className="text-[10px] font-mono uppercase tracking-widest font-bold px-2 py-0.5 rounded bg-purple-950/80 text-purple-300 border border-purple-500/50">
                      Maestro Special Override Applied
                    </span>
                  )}
                </div>

                <h2 className="text-3xl sm:text-5xl md:text-6xl font-black text-white tracking-tight leading-[1.08] drop-shadow-md">
                  {activeSongDisplay.title}
                </h2>
              </div>
            ) : (
              <div className="py-16 text-center text-slate-500 space-y-2">
                <Music2 className="w-16 h-16 mx-auto stroke-1 text-slate-600" />
                <p className="text-xl font-bold text-slate-400">No Song Currently Active</p>
                <p className="text-sm">Select a song or setlist item in the Maestro editor to begin queue playback.</p>
              </div>
            )}
          </div>

          {/* Bottom Stage Details: INTRO BARS, INTRO INSTRUMENTS, GIANT LOOP COUNTER */}
          {activeSongDisplay && (
            <div className="grid grid-cols-1 md:grid-cols-12 gap-5 relative z-10 pt-6 border-t border-[#1f263d]">
              
              {/* Intro Bar Count & Instruments (Col 1-7) */}
              <div className="md:col-span-7 flex flex-col justify-between space-y-5">
                
                {/* Intro Bars Indicator */}
                <div className="bg-[#141826] border border-[#27314d] rounded-2xl p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center font-bold">
                      <Clock className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-xs font-mono uppercase text-slate-400 font-bold">Intro Bar Count</div>
                      <div className="text-xs text-slate-500">Bars before ensemble entry</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-3xl sm:text-4xl font-black text-cyan-400 font-mono tracking-tight">
                      {activeSongDisplay.introBarCount}
                    </span>
                    <span className="text-xs font-mono text-cyan-500 ml-1 font-bold">BARS</span>
                  </div>
                </div>

                {/* Intro Cue Instruments Array */}
                <div className="bg-[#141826] border border-[#27314d] rounded-2xl p-4 space-y-2">
                  <div className="text-xs font-mono uppercase tracking-wider text-slate-400 font-bold flex items-center justify-between">
                    <span>Intro Cue Instruments</span>
                    <span className="text-[10px] text-slate-500">{activeSongDisplay.introInstruments.length} Listed</span>
                  </div>

                  <div className="flex flex-wrap gap-2 pt-1">
                    {activeSongDisplay.introInstruments.length > 0 ? (
                      activeSongDisplay.introInstruments.map((inst) => {
                        const isMatch = selectedInstrument === inst;
                        return (
                          <div
                            key={inst}
                            className={`px-3 py-1.5 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 border transition-all ${
                              isMatch
                                ? 'bg-amber-400 text-black border-amber-300 shadow-glow-gold scale-105 animate-pulse'
                                : 'bg-[#1b2135] text-slate-200 border-[#2f3956]'
                            }`}
                          >
                            {isMatch && <Flame className="w-3.5 h-3.5 fill-black" />}
                            <span>{inst}</span>
                          </div>
                        );
                      })
                    ) : (
                      <span className="text-xs text-slate-500 italic">No specific intro instruments assigned</span>
                    )}
                  </div>
                </div>

              </div>

              {/* Giant Loop Counter Focus (Col 8-12) */}
              <div className="md:col-span-5 bg-gradient-to-br from-[#151a2a] to-[#1a2135] border-2 border-amber-500/40 rounded-2xl p-5 sm:p-6 flex flex-col justify-between shadow-glow-gold/10">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono uppercase tracking-widest text-amber-400 font-black flex items-center gap-1.5">
                    <RotateCw className="w-3.5 h-3.5 text-amber-400" />
                    LOOP COUNTER
                  </span>
                  <span className="text-xs font-mono text-slate-400">
                    Target: {activeSongDisplay.loopCount} Loops
                  </span>
                </div>

                {/* Giant Counter */}
                <div className="my-3 text-center py-2">
                  <div className="flex items-baseline justify-center gap-2">
                    <span className="text-6xl sm:text-7xl font-black text-amber-400 font-mono tracking-tight drop-shadow-md">
                      {activeSongDisplay.currentLoop}
                    </span>
                    <span className="text-3xl sm:text-4xl font-extrabold text-slate-500 font-mono">
                      / {activeSongDisplay.loopCount}
                    </span>
                  </div>
                  <div className="text-xs font-mono text-slate-400 font-semibold tracking-wider uppercase mt-1">
                    {activeSongDisplay.currentLoop > activeSongDisplay.loopCount ? (
                      <span className="text-red-400 font-bold">Over Target Iteration!</span>
                    ) : activeSongDisplay.currentLoop === activeSongDisplay.loopCount ? (
                      <span className="text-amber-400 font-bold">Final Loop In Progress</span>
                    ) : (
                      <span>Playing Loop Cycle</span>
                    )}
                  </div>
                </div>

                {/* Controller Quick Loop Adjusters */}
                {canControl ? (
                  <div className="grid grid-cols-3 gap-2 pt-2 border-t border-[#29344f]">
                    <button
                      onClick={decrementLoop}
                      className="px-2 py-2 rounded-xl bg-[#20273d] hover:bg-[#2c3654] text-slate-200 font-mono text-xs font-bold transition-all flex items-center justify-center gap-1"
                      title="Decrease Loop Count"
                    >
                      <Minus className="w-3.5 h-3.5" />
                      <span>-1</span>
                    </button>
                    <button
                      onClick={incrementLoop}
                      className="px-2 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-mono text-xs font-black transition-all flex items-center justify-center gap-1 shadow-glow-gold"
                      title="Advance Loop Count (+1)"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>+1</span>
                    </button>
                    <button
                      onClick={resetLoop}
                      className="px-2 py-2 rounded-xl bg-[#20273d] hover:bg-[#2c3654] text-slate-300 font-mono text-xs font-bold transition-all flex items-center justify-center gap-1"
                      title="Reset Loop to 1"
                    >
                      <RotateCw className="w-3 h-3" />
                      <span>Reset</span>
                    </button>
                  </div>
                ) : (
                  <div className="w-full bg-[#1b2236] rounded-full h-2.5 overflow-hidden">
                    <div
                      className="bg-amber-400 h-2.5 rounded-full transition-all duration-300"
                      style={{
                        width: `${Math.min(
                          100,
                          (activeSongDisplay.currentLoop / activeSongDisplay.loopCount) * 100
                        )}%`,
                      }}
                    />
                  </div>
                )}
              </div>

            </div>
          )}

        </div>

        {/* UP NEXT SIDE PANEL / DRAWER (Col 9-12) */}
        <div className="lg:col-span-4 bg-[#0e111c] border-2 border-[#242c44] rounded-3xl p-5 sm:p-6 flex flex-col justify-between shadow-2xl">
          <div>
            <div className="flex items-center justify-between border-b border-[#1f263d] pb-4 mb-4">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-cyan-400" />
                <h3 className="font-extrabold text-white text-base tracking-tight uppercase">UP NEXT</h3>
              </div>
              <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-[#181f33] text-cyan-400 border border-cyan-500/30">
                {upNextSongs.length} upcoming
              </span>
            </div>

            <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
              {upNextSongs.length > 0 ? (
                upNextSongs.map(({ queueItem, song, effectiveLoop, effectiveBars, effectiveInstruments }, idx) => {
                  const isMatch = selectedInstrument && effectiveInstruments.includes(selectedInstrument);
                  return (
                    <div
                      key={queueItem.id}
                      className={`p-4 rounded-2xl border transition-all ${
                        isMatch
                          ? 'bg-amber-950/30 border-amber-500/50 shadow-sm'
                          : 'bg-[#131726] border-[#222a42] hover:border-slate-600'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] font-mono font-bold text-slate-500">
                              #{queueItem.sort_order}
                            </span>
                            {isMatch && (
                              <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-amber-400 text-black font-extrabold flex items-center gap-1">
                                <Sparkles className="w-2.5 h-2.5" />
                                Your Cue
                              </span>
                            )}
                          </div>
                          <h4 className="text-sm font-bold text-white truncate leading-snug">
                            {song.title}
                          </h4>
                          <div className="flex items-center gap-3 text-xs font-mono text-slate-400 pt-1">
                            <span>Intro: <strong className="text-cyan-400">{effectiveBars} bars</strong></span>
                            <span>•</span>
                            <span>Loops: <strong className="text-amber-400">{effectiveLoop}x</strong></span>
                          </div>
                        </div>

                        {canControl && (
                          <button
                            onClick={() => jumpToQueueItem(queueItem.id)}
                            className="px-2.5 py-1.5 rounded-xl bg-[#1f273d] hover:bg-amber-500 hover:text-black text-slate-300 text-xs font-bold transition-all shrink-0 flex items-center gap-1 border border-[#313c5e]"
                            title="Jump immediately to this song"
                          >
                            <span>Jump</span>
                            <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="text-center py-12 text-slate-500 space-y-1">
                  <p className="text-sm font-medium">End of Bahagian Queue</p>
                  <p className="text-xs text-slate-600">No further songs scheduled in this part.</p>
                </div>
              )}
            </div>
          </div>

          {/* Quick info footer */}
          <div className="mt-4 pt-4 border-t border-[#1f263d] text-xs font-mono text-slate-500 flex items-center justify-between">
            <span>Session: {currentSession?.code}</span>
            <span>Role: <strong className="text-slate-300 uppercase">{activeRole}</strong></span>
          </div>
        </div>

      </div>

      {/* STICKY LIVE CONTROLLER ACTION BAR (Controller / Maestro / Admin) */}
      {canControl && (
        <div className="sticky bottom-4 z-40 bg-[#101422]/95 backdrop-blur-md border-2 border-amber-500/50 rounded-2xl p-3 sm:p-4 shadow-2xl flex flex-wrap items-center justify-between gap-3 animate-fade-in">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse" />
            <span className="text-xs font-mono uppercase font-black tracking-wider text-slate-300">
              Live Controller: <span className="text-amber-400 uppercase">{activeRole}</span>
            </span>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            <button
              onClick={navigatePrev}
              className="px-4 py-2.5 rounded-xl bg-[#1b2238] hover:bg-[#252f4c] text-white font-bold text-xs sm:text-sm border border-[#2e3b5e] transition-all flex items-center gap-2"
              title="Previous Song in Queue"
            >
              <SkipBack className="w-4 h-4 text-cyan-400" />
              <span>PREV SONG</span>
            </button>

            <button
              onClick={togglePause}
              className={`px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm border transition-all flex items-center gap-2 ${
                roomState.is_paused
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-400'
                  : 'bg-amber-600 hover:bg-amber-500 text-white border-amber-400'
              }`}
              title="Pause or Resume Stage Broadcast"
            >
              {roomState.is_paused ? (
                <>
                  <Play className="w-4 h-4 fill-white" />
                  <span>RESUME</span>
                </>
              ) : (
                <>
                  <Pause className="w-4 h-4 fill-white" />
                  <span>PAUSE</span>
                </>
              )}
            </button>

            <button
              onClick={navigateNext}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-black text-xs sm:text-sm shadow-glow-gold transition-all flex items-center gap-2"
              title="Advance to Next Song in Queue"
            >
              <span>NEXT SONG</span>
              <SkipForward className="w-4 h-4 fill-black" />
            </button>
          </div>
        </div>
      )}

    </div>
  );
};
