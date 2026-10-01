import React, { useState, useEffect, useCallback } from 'react';
import { Header } from './components/Header';
import { LiveMonitor } from './components/LiveMonitor';
import { SubjectWatchlist } from './components/SubjectWatchlist';
import { SecurityLog } from './components/SecurityLog';
import { MultiCamGrid } from './components/MultiCamGrid';
import { CompreFaceConsole } from './components/CompreFaceConsole';
import { EnrollModal } from './components/EnrollModal';
import { SubjectHistoryModal } from './components/SubjectHistoryModal';
import {
  SubjectProfile,
  DetectionEvent,
  CameraSource,
  LookoutStats,
  CompreFaceConfig,
  WatchlistCategory
} from './types';
import { api } from './services/api';
import { audioAlerts } from './services/audio';

export default function App() {
  const [activeTab, setActiveTab] = useState<'monitor' | 'watchlist' | 'logs' | 'compreface' | 'multicam'>('monitor');
  const [subjects, setSubjects] = useState<SubjectProfile[]>([]);
  const [events, setEvents] = useState<DetectionEvent[]>([]);
  const [cameras, setCameras] = useState<CameraSource[]>([]);
  const [stats, setStats] = useState<LookoutStats | null>(null);
  const [config, setConfig] = useState<CompreFaceConfig>({
    upstreamUrl: 'http://localhost:8000',
    apiKey: '00000000-0000-0000-0000-000000000000',
    mode: 'integrated_local',
    detProbThreshold: 0.75,
    minSimilarity: 0.80,
    facePlugins: ['landmarks', 'gender', 'age', 'mask']
  });

  const [audioMuted, setAudioMuted] = useState(false);
  const [isEnrollModalOpen, setIsEnrollModalOpen] = useState(false);
  const [prefilledImage, setPrefilledImage] = useState<string>('');
  const [prefilledName, setPrefilledName] = useState<string>('');
  const [prefilledDescriptor, setPrefilledDescriptor] = useState<number[] | undefined>(undefined);

  // User History Modal State
  const [historySubjectName, setHistorySubjectName] = useState<string | null>(null);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);

  // Initial Data Fetch
  const loadData = useCallback(async () => {
    try {
      const [loadedSubjects, loadedEvents, loadedCameras, loadedStats, loadedConfig] = await Promise.all([
        api.getSubjects().catch(() => []),
        api.getEvents().catch(() => []),
        api.getCameras().catch(() => []),
        api.getStats().catch(() => null),
        api.getConfig().catch(() => null)
      ]);

      if (loadedSubjects.length > 0) setSubjects(loadedSubjects);
      if (loadedEvents.length > 0) {
        const seen = new Set<string>();
        const unique = loadedEvents.filter(e => {
          if (!e.id || seen.has(e.id)) return false;
          seen.add(e.id);
          return true;
        });
        setEvents(unique);
      }
      if (loadedCameras.length > 0) setCameras(loadedCameras);
      if (loadedStats) setStats(loadedStats);
      if (loadedConfig) setConfig(loadedConfig);
    } catch (err) {
      console.warn('Initial data load warning:', err);
    }
  }, []);

  useEffect(() => {
    loadData();
    const interval = setInterval(async () => {
      try {
        const updatedStats = await api.getStats();
        setStats(updatedStats);
      } catch {
        // Ignore background polling errors
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [loadData]);

  // Audio mute toggle
  const handleToggleAudio = () => {
    const nextMuted = !audioMuted;
    setAudioMuted(nextMuted);
    audioAlerts.setMuted(nextMuted);
  };

  // Open enroll modal
  const handleOpenEnroll = (image?: string, name?: string, descriptor?: number[]) => {
    setPrefilledImage(image || '');
    setPrefilledName(name || '');
    setPrefilledDescriptor(descriptor);
    setIsEnrollModalOpen(true);
  };

  // Open user history modal
  const handleOpenHistory = (subjectName: string) => {
    setHistorySubjectName(subjectName);
    setIsHistoryModalOpen(true);
  };

  // Enroll new subject handler
  const handleEnroll = async (data: {
    subject: string;
    category: WatchlistCategory;
    notes?: string;
    imageData?: string;
    descriptor?: number[];
  }) => {
    await api.createSubject({
      subject: data.subject,
      category: data.category,
      notes: data.notes,
      imageData: data.imageData,
      descriptor: data.descriptor
    });

    // Refresh subjects
    const updated = await api.getSubjects();
    setSubjects(updated);
    const updatedStats = await api.getStats();
    setStats(updatedStats);
  };

  // Delete subject
  const handleDeleteSubject = async (name: string) => {
    await api.deleteSubject(name);
    const updated = await api.getSubjects();
    setSubjects(updated);
    const updatedStats = await api.getStats();
    setStats(updatedStats);
  };

  // Update subject
  const handleUpdateSubject = async (name: string, data: { category?: WatchlistCategory; notes?: string }) => {
    await api.updateSubject(name, data);
    const updated = await api.getSubjects();
    setSubjects(updated);
  };

  // Clear logs
  const handleClearLogs = async () => {
    await api.clearEvents();
    setEvents([]);
    const updatedStats = await api.getStats();
    setStats(updatedStats);
  };

  // Delete individual event
  const handleDeleteEvent = async (id: string) => {
    await api.deleteEvent(id);
    setEvents(prev => prev.filter(e => e.id !== id));
    const updatedStats = await api.getStats();
    setStats(updatedStats);
  };

  // Refresh subjects
  const handleRefreshSubjects = async () => {
    const updated = await api.getSubjects();
    setSubjects(updated);
    const updatedStats = await api.getStats();
    setStats(updatedStats);
  };

  // Update CompreFace config
  const handleUpdateConfig = async (newConfig: Partial<CompreFaceConfig>) => {
    const updated = await api.updateConfig(newConfig);
    setConfig(updated);
    const updatedStats = await api.getStats();
    setStats(updatedStats);
  };

  // On new live detection event from LiveMonitor
  const handleNewDetection = useCallback(async (event: DetectionEvent) => {
    setEvents((prev) => {
      const filtered = prev.filter((e) => e.id !== event.id);
      return [event, ...filtered.slice(0, 99)];
    });
    try {
      await api.logEvent(event);
    } catch {
      // Ignore background log error
    }
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* 3-Zone Top Bar Navigation */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenEnroll={() => handleOpenEnroll()}
        stats={stats}
        audioMuted={audioMuted}
        onToggleAudio={handleToggleAudio}
      />

      {/* Main Workspace Body */}
      <main className="flex-1">
        {activeTab === 'monitor' && (
          <LiveMonitor
            subjects={subjects}
            onEnrollFace={(img, name, desc) => handleOpenEnroll(img, name, desc)}
            onNewDetection={handleNewDetection}
            cameras={cameras}
            onDeleteSubject={handleDeleteSubject}
          />
        )}

        {activeTab === 'watchlist' && (
          <SubjectWatchlist
            subjects={subjects}
            onOpenEnroll={() => handleOpenEnroll()}
            onDeleteSubject={handleDeleteSubject}
            onUpdateSubject={handleUpdateSubject}
            onViewHistory={handleOpenHistory}
            onRefreshSubjects={handleRefreshSubjects}
          />
        )}

        {activeTab === 'logs' && (
          <SecurityLog
            events={events}
            onClearLogs={handleClearLogs}
            onViewHistory={handleOpenHistory}
            onDeleteEvent={handleDeleteEvent}
          />
        )}

        {activeTab === 'multicam' && (
          <MultiCamGrid
            cameras={cameras}
            subjects={subjects}
            onSelectCamera={(camId) => {
              setActiveTab('monitor');
            }}
          />
        )}

        {activeTab === 'compreface' && (
          <CompreFaceConsole
            config={config}
            onUpdateConfig={handleUpdateConfig}
          />
        )}
      </main>

      {/* Instant Face Enrollment Modal */}
      <EnrollModal
        isOpen={isEnrollModalOpen}
        onClose={() => {
          setIsEnrollModalOpen(false);
          setPrefilledDescriptor(undefined);
        }}
        onEnroll={handleEnroll}
        prefilledImage={prefilledImage}
        prefilledName={prefilledName}
        prefilledDescriptor={prefilledDescriptor}
      />

      {/* User History Query Modal from Persistent Database */}
      <SubjectHistoryModal
        subjectName={historySubjectName}
        isOpen={isHistoryModalOpen}
        onClose={() => {
          setIsHistoryModalOpen(false);
          setHistorySubjectName(null);
        }}
      />
    </div>
  );
}
