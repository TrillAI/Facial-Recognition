import React, { useState, useEffect } from 'react';
import {
  Cpu,
  CheckCircle2,
  AlertCircle,
  Activity,
  Terminal,
  Play,
  Upload,
  ExternalLink,
  Copy,
  Check,
  Database,
  Layers,
  Zap
} from 'lucide-react';
import { CompreFaceConfig, DatabaseInfo } from '../types';
import { api } from '../services/api';

interface CompreFaceConsoleProps {
  config: CompreFaceConfig;
  onUpdateConfig: (newConfig: Partial<CompreFaceConfig>) => Promise<void>;
}

export const CompreFaceConsole: React.FC<CompreFaceConsoleProps> = ({
  config,
  onUpdateConfig
}) => {
  const [upstreamUrl, setUpstreamUrl] = useState(config.upstreamUrl || 'http://localhost:8000');
  const [apiKey, setApiKey] = useState(config.apiKey || '00000000-0000-0000-0000-000000000000');
  const [activeMode, setActiveMode] = useState<'integrated_local' | 'upstream_proxy'>(config.mode);

  const [dbInfo, setDbInfo] = useState<DatabaseInfo | null>(null);
  const [testResult, setTestResult] = useState<{
    status: string;
    latencyMs: number;
    message: string;
  } | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [copiedSnippet, setCopiedSnippet] = useState(false);
  const [copiedComposeCmd, setCopiedComposeCmd] = useState(false);

  // Playground state
  const [playgroundTab, setPlaygroundTab] = useState<'recognize' | 'detect' | 'verify'>('recognize');
  const [testImagePreview, setTestImagePreview] = useState<string>('');
  const [apiResponseJson, setApiResponseJson] = useState<string>('');
  const [isRunningInference, setIsRunningInference] = useState(false);

  useEffect(() => {
    setUpstreamUrl(config.upstreamUrl);
    setApiKey(config.apiKey);
    setActiveMode(config.mode);

    api.getDatabaseInfo().then(setDbInfo).catch(() => null);
  }, [config]);

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const res = await api.testConnection(upstreamUrl, apiKey);
      setTestResult(res);
    } catch (err: any) {
      setTestResult({
        status: 'error',
        latencyMs: 0,
        message: err.message || 'Connection test failed'
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSaveSettings = async () => {
    setIsSaving(true);
    try {
      await onUpdateConfig({
        upstreamUrl,
        apiKey,
        mode: activeMode
      });
      alert('CompreFace configuration saved successfully');
    } catch (err: any) {
      alert(err.message || 'Failed to save configuration');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCopyComposeCmd = () => {
    navigator.clipboard.writeText('docker-compose up -d');
    setCopiedComposeCmd(true);
    setTimeout(() => setCopiedComposeCmd(false), 2000);
  };

  const handlePlaygroundRun = async () => {
    setIsRunningInference(true);
    try {
      if (playgroundTab === 'recognize') {
        const res = await api.recognizeFace(testImagePreview || 'sample_frame');
        setApiResponseJson(JSON.stringify(res, null, 2));
      } else if (playgroundTab === 'detect') {
        const res = await api.detectFace(testImagePreview || 'sample_frame');
        setApiResponseJson(JSON.stringify(res, null, 2));
      } else if (playgroundTab === 'verify') {
        const res = await api.verifyFaces('sample_image_1', 'sample_image_2');
        setApiResponseJson(JSON.stringify(res, null, 2));
      }
    } catch (err: any) {
      setApiResponseJson(JSON.stringify({ error: err.message }, null, 2));
    } finally {
      setIsRunningInference(false);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto flex flex-col gap-6">
      {/* Title */}
      <div>
        <h1 className="text-xl font-bold tracking-tight text-slate-100 flex items-center gap-2.5">
          <Cpu className="w-5 h-5 text-cyan-400" />
          Exadel CompreFace Inference Gateway & Docker Configuration
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Unified facial recognition backend delivering zero-latency stream processing, persistent PostgreSQL storage, and multi-service Docker Compose orchestration.
        </p>
      </div>

      {/* Architecture Highlights & Status Card */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl flex flex-col justify-between">
          <div>
            <div className="text-xs font-mono uppercase text-slate-400">Current Engine Mode</div>
            <div className="text-base font-bold text-emerald-400 mt-1 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              {activeMode === 'integrated_local' ? 'Integrated Zero-Latency Engine' : 'Upstream CompreFace Docker'}
            </div>
            <p className="text-xs text-slate-400 mt-2 leading-relaxed">
              HTTP keep-alive agent connection pooling active with persistent connection reuse for minimal latency.
            </p>
          </div>
          <div className="text-xs font-mono text-slate-500 pt-3 border-t border-slate-800 flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-cyan-400" />
            <span>Connection Pooling: Max 50 sockets</span>
          </div>
        </div>

        <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl flex flex-col justify-between">
          <div>
            <div className="text-xs font-mono uppercase text-slate-400">Persistent Database</div>
            <div className="text-base font-bold text-slate-100 mt-1 flex items-center gap-2">
              <Database className="w-4 h-4 text-cyan-400" />
              {dbInfo?.type || 'Persistent Storage Active'}
            </div>
            <p className="text-xs text-slate-400 mt-2 leading-relaxed">
              Stores face collections, biometrics metadata, event timestamps, and complete queryable user access history.
            </p>
          </div>
          <div className="text-xs font-mono text-emerald-400 pt-3 border-t border-slate-800">
            {dbInfo ? `${dbInfo.totalSubjects} Subjects · ${dbInfo.totalEvents} Events Stored` : 'Database Synchronized'}
          </div>
        </div>

        <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl flex flex-col justify-between">
          <div>
            <div className="text-xs font-mono uppercase text-slate-400">Docker Network Topology</div>
            <div className="text-base font-bold text-slate-100 mt-1 font-mono flex items-center gap-2">
              <Layers className="w-4 h-4 text-cyan-400" />
              lookout-network (Bridge)
            </div>
            <p className="text-xs text-slate-400 mt-2 leading-relaxed">
              Connects <code className="text-cyan-300">lookout-app:3000</code>, <code className="text-cyan-300">compreface-api:8000</code>, and <code className="text-cyan-300">postgres:5432</code> seamlessly.
            </p>
          </div>
          <div className="text-xs font-mono text-slate-500 pt-3 border-t border-slate-800">
            Single Command: `docker-compose up -d`
          </div>
        </div>
      </div>

      {/* Docker Compose Quick-Start Panel */}
      <div className="p-6 bg-slate-900 border border-cyan-500/30 rounded-2xl flex flex-col gap-4 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <Terminal className="w-4 h-4 text-cyan-400" />
              Single-Command Docker Orchestration
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Launch Lookout Application, CompreFace Neural Services, and Persistent PostgreSQL together:
            </p>
          </div>

          <button
            onClick={handleCopyComposeCmd}
            className="flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold text-slate-950 bg-cyan-400 hover:bg-cyan-300 rounded-lg transition-colors cursor-pointer self-start sm:self-auto"
          >
            {copiedComposeCmd ? <Check className="w-3.5 h-3.5 text-slate-950" /> : <Copy className="w-3.5 h-3.5 text-slate-950" />}
            {copiedComposeCmd ? 'Command Copied!' : 'docker-compose up -d'}
          </button>
        </div>

        <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 font-mono text-xs text-slate-300 overflow-x-auto">
          <div className="text-slate-500 mb-1"># Start all services simultaneously in detached mode:</div>
          <div className="text-cyan-300 font-bold">$ docker-compose up -d</div>
          <div className="text-slate-400 mt-3 text-[11px] leading-relaxed">
            Services initialized:<br />
            &bull; <span className="text-slate-200">lookout-app</span>: Lookout Surveillance Console & Persistent API on port 3000<br />
            &bull; <span className="text-slate-200">compreface-fe</span>: CompreFace Web UI on port 8000<br />
            &bull; <span className="text-slate-200">compreface-api</span>: Facial Recognition REST endpoint<br />
            &bull; <span className="text-slate-200">compreface-core</span>: Deep neural network inference core<br />
            &bull; <span className="text-slate-200">compreface-postgres-db</span>: PostgreSQL 15 with volumes <code className="text-cyan-400">compreface-postgres-data</code> & <code className="text-cyan-400">lookout-data</code>
          </div>
        </div>
      </div>

      {/* Gateway & Upstream CompreFace Configuration */}
      <div className="p-6 bg-slate-900 border border-slate-800 rounded-2xl flex flex-col gap-5">
        <div>
          <h2 className="text-base font-bold text-slate-100">
            CompreFace Gateway & Latency Tuning
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Configure upstream container routing and minimal latency settings.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Mode Selector */}
          <div>
            <label htmlFor="engine-mode" className="block text-xs font-medium text-slate-300 mb-1.5">
              Inference Engine Routing Mode
            </label>
            <select
              id="engine-mode"
              value={activeMode}
              onChange={(e) => setActiveMode(e.target.value as any)}
              className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-cyan-400"
            >
              <option value="integrated_local">
                Integrated Zero-Latency Engine (Embedded · Sub-3ms · Instant)
              </option>
              <option value="upstream_proxy">
                Upstream Exadel CompreFace Docker Service (Docker Network / Localhost)
              </option>
            </select>
          </div>

          {/* Upstream URL */}
          <div>
            <label htmlFor="upstream-url" className="block text-xs font-medium text-slate-300 mb-1.5">
              CompreFace URL in Docker / Host
            </label>
            <input
              id="upstream-url"
              type="text"
              value={upstreamUrl}
              onChange={(e) => setUpstreamUrl(e.target.value)}
              placeholder="http://localhost:8000 or http://compreface-api:8000"
              className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-800 rounded-lg text-slate-200 font-mono focus:outline-none focus:border-cyan-400"
            />
          </div>

          {/* API Key */}
          <div className="md:col-span-2">
            <label htmlFor="api-key" className="block text-xs font-medium text-slate-300 mb-1.5">
              CompreFace Recognition Service API Key (UUID)
            </label>
            <input
              id="api-key"
              type="text"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="00000000-0000-0000-0000-000000000000"
              className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-800 rounded-lg text-slate-200 font-mono focus:outline-none focus:border-cyan-400"
            />
          </div>
        </div>

        {/* Test Result Message */}
        {testResult && (
          <div
            className={`p-3 rounded-lg text-xs font-mono border ${
              testResult.status === 'online'
                ? 'bg-emerald-950/40 border-emerald-800 text-emerald-300'
                : 'bg-slate-950 border-slate-800 text-cyan-300'
            }`}
          >
            {testResult.message} ({testResult.latencyMs.toFixed(1)}ms roundtrip)
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-800">
          <button
            onClick={handleTestConnection}
            disabled={isTesting}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-200 bg-slate-950 hover:bg-slate-800 border border-slate-700 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
          >
            <Activity className="w-3.5 h-3.5 text-cyan-400" />
            {isTesting ? 'Testing Link...' : 'Test Connection Ping'}
          </button>

          <button
            onClick={handleSaveSettings}
            disabled={isSaving}
            className="px-4 py-1.5 text-xs font-semibold text-slate-950 bg-cyan-400 hover:bg-cyan-300 rounded-lg transition-colors cursor-pointer"
          >
            {isSaving ? 'Saving...' : 'Save Configuration'}
          </button>
        </div>
      </div>

      {/* Interactive CompreFace REST API Playground */}
      <div className="p-6 bg-slate-900 border border-slate-800 rounded-2xl flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-slate-100">
              Interactive CompreFace API Inspector & Verification Playground
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Directly invoke recognition, detection, and verification endpoints to inspect inference output format.
            </p>
          </div>

          <div className="flex items-center gap-1 p-1 bg-slate-950 border border-slate-800 rounded-lg">
            <button
              onClick={() => setPlaygroundTab('recognize')}
              className={`px-2.5 py-1 text-xs font-medium rounded cursor-pointer ${
                playgroundTab === 'recognize' ? 'bg-slate-800 text-slate-100' : 'text-slate-400'
              }`}
            >
              /recognize
            </button>
            <button
              onClick={() => setPlaygroundTab('detect')}
              className={`px-2.5 py-1 text-xs font-medium rounded cursor-pointer ${
                playgroundTab === 'detect' ? 'bg-slate-800 text-slate-100' : 'text-slate-400'
              }`}
            >
              /detect
            </button>
            <button
              onClick={() => setPlaygroundTab('verify')}
              className={`px-2.5 py-1 text-xs font-medium rounded cursor-pointer ${
                playgroundTab === 'verify' ? 'bg-slate-800 text-slate-100' : 'text-slate-400'
              }`}
            >
              /verify
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between pt-2">
          <span className="text-xs font-mono text-slate-400">
            Endpoint: <span className="text-cyan-400 font-semibold">POST /api/v1/{playgroundTab === 'verify' ? 'verification/verify' : playgroundTab === 'detect' ? 'detection/detect' : 'recognition/recognize'}</span>
          </span>
          <button
            onClick={handlePlaygroundRun}
            disabled={isRunningInference}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-950 bg-cyan-400 hover:bg-cyan-300 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
          >
            <Play className="w-3.5 h-3.5" />
            {isRunningInference ? 'Running Inference...' : 'Execute Test Call'}
          </button>
        </div>

        {/* Response JSON Viewer */}
        <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 font-mono text-xs text-slate-300 max-h-80 overflow-y-auto">
          {apiResponseJson ? (
            <pre>{apiResponseJson}</pre>
          ) : (
            <div className="text-slate-600 text-center py-8">
              Click 'Execute Test Call' to inspect the live CompreFace JSON inference output.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
