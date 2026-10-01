import React from 'react';
import { Volume2, VolumeX, Plus, ShieldAlert, Cpu } from 'lucide-react';
import { LookoutStats } from '../types';

interface HeaderProps {
  activeTab: 'monitor' | 'watchlist' | 'logs' | 'compreface' | 'multicam';
  setActiveTab: (tab: 'monitor' | 'watchlist' | 'logs' | 'compreface' | 'multicam') => void;
  onOpenEnroll: () => void;
  stats: LookoutStats | null;
  audioMuted: boolean;
  onToggleAudio: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  onOpenEnroll,
  stats,
  audioMuted,
  onToggleAudio
}) => {
  return (
    <header className="flex items-center justify-between px-6 py-3.5 border-b border-slate-800 bg-slate-950/95 sticky top-0 z-30 backdrop-blur-md">
      {/* Zone 1: Single text element wordmark */}
      <div className="flex items-center gap-3">
        <a
          href="#monitor"
          onClick={(e) => {
            e.preventDefault();
            setActiveTab('monitor');
          }}
          className="text-lg font-bold tracking-tight text-slate-100 hover:text-white transition-colors"
        >
          Lookout Studio
        </a>
        <span className="hidden sm:inline-block text-xs font-mono text-cyan-400/80">
          CompreFace Integrated
        </span>
      </div>

      {/* Zone 2: 4-6 clean text navigation links */}
      <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-400">
        <button
          onClick={() => setActiveTab('monitor')}
          className={`hover:text-slate-100 transition-colors cursor-pointer py-1 ${
            activeTab === 'monitor'
              ? 'text-cyan-400 border-b-2 border-cyan-400 font-semibold'
              : ''
          }`}
        >
          Live Monitor
        </button>
        <button
          onClick={() => setActiveTab('watchlist')}
          className={`hover:text-slate-100 transition-colors cursor-pointer py-1 ${
            activeTab === 'watchlist'
              ? 'text-cyan-400 border-b-2 border-cyan-400 font-semibold'
              : ''
          }`}
        >
          Subject Watchlist
        </button>
        <button
          onClick={() => setActiveTab('logs')}
          className={`hover:text-slate-100 transition-colors cursor-pointer py-1 ${
            activeTab === 'logs'
              ? 'text-cyan-400 border-b-2 border-cyan-400 font-semibold'
              : ''
          }`}
        >
          Security Log
          {stats && stats.boloAlertCount > 0 && (
            <span className="ml-1.5 text-xs font-mono text-rose-400 font-bold tabular-nums">
              ({stats.boloAlertCount})
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('multicam')}
          className={`hover:text-slate-100 transition-colors cursor-pointer py-1 ${
            activeTab === 'multicam'
              ? 'text-cyan-400 border-b-2 border-cyan-400 font-semibold'
              : ''
          }`}
        >
          Multi-Cam Grid
        </button>
        <button
          onClick={() => setActiveTab('compreface')}
          className={`hover:text-slate-100 transition-colors cursor-pointer py-1 flex items-center gap-1.5 ${
            activeTab === 'compreface'
              ? 'text-cyan-400 border-b-2 border-cyan-400 font-semibold'
              : ''
          }`}
        >
          <Cpu className="w-3.5 h-3.5 text-cyan-400" />
          CompreFace Gateway
        </button>
      </nav>

      {/* Zone 3: 1-2 primary actions */}
      <div className="flex items-center gap-3">
        {/* Latency & Status Indicator */}
        <div className="hidden lg:flex items-center gap-2 text-xs font-mono tabular-nums text-slate-400 px-2.5 py-1 bg-slate-900 border border-slate-800 rounded-md">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span>Inference: {stats ? stats.engineLatencyMs.toFixed(1) : '2.4'}ms</span>
          <span className="text-slate-600">·</span>
          <span>Zero Latency</span>
        </div>

        {/* Audio Toggle */}
        <button
          onClick={onToggleAudio}
          title={audioMuted ? 'Unmute BOLO alerts' : 'Mute BOLO alerts'}
          className={`p-1.5 rounded-md border text-xs transition-colors cursor-pointer ${
            audioMuted
              ? 'bg-slate-900 border-slate-800 text-slate-500 hover:text-slate-300'
              : 'bg-rose-950/40 border-rose-800 text-rose-300 hover:bg-rose-900/60'
          }`}
        >
          {audioMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
        </button>

        {/* Enroll Subject CTA */}
        <button
          onClick={onOpenEnroll}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-950 bg-cyan-400 hover:bg-cyan-300 rounded-lg transition-colors cursor-pointer whitespace-nowrap shadow-sm shadow-cyan-950"
        >
          <Plus className="w-3.5 h-3.5" />
          Enroll Subject
        </button>
      </div>
    </header>
  );
};
