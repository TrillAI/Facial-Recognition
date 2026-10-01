import React, { useState } from 'react';
import { Search, Download, Trash2, ShieldAlert, CheckCircle, Clock, User, Filter, History } from 'lucide-react';
import { DetectionEvent, WatchlistCategory } from '../types';

interface SecurityLogProps {
  events: DetectionEvent[];
  onClearLogs: () => Promise<void>;
  onViewHistory?: (subjectName: string) => void;
  onDeleteEvent?: (id: string) => Promise<void>;
}

export const SecurityLog: React.FC<SecurityLogProps> = ({ events, onClearLogs, onViewHistory, onDeleteEvent }) => {
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState<'all' | 'alerts' | WatchlistCategory>('all');
  const [isClearing, setIsClearing] = useState(false);

  const filteredEvents = events.filter((e) => {
    const matchesSearch =
      e.subjectName.toLowerCase().includes(search.toLowerCase()) ||
      e.cameraName.toLowerCase().includes(search.toLowerCase());

    if (!matchesSearch) return false;

    if (filterCategory === 'all') return true;
    if (filterCategory === 'alerts') return e.category === 'bolo' || e.category === 'unknown';
    return e.category === filterCategory;
  });

  const handleExportCSV = () => {
    if (events.length === 0) return;
    const headers = ['Timestamp', 'Camera', 'Subject', 'Category', 'Confidence', 'Estimated Age', 'Gender'];
    const rows = events.map((e) => [
      e.timestamp,
      `"${e.cameraName}"`,
      `"${e.subjectName}"`,
      e.category,
      `${(e.confidence * 100).toFixed(1)}%`,
      e.age ? `${e.age.low}-${e.age.high}` : 'N/A',
      e.gender || 'N/A'
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `lookout-security-audit-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleClear = async () => {
    if (!window.confirm('Are you sure you want to clear the detection audit history?')) return;
    setIsClearing(true);
    try {
      await onClearLogs();
    } finally {
      setIsClearing(false);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto flex flex-col gap-6">
      {/* Title & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-100">
            Security Incident & Detection Audit Trail
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Real-time chronological log of all face recognitions, BOLO triggers, and access verifications from persistent database.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={handleExportCSV}
            disabled={events.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-200 bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5 text-cyan-400" />
            Export CSV
          </button>
          <button
            onClick={handleClear}
            disabled={events.length === 0 || isClearing}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-400 hover:text-rose-400 bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Clear Log
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 p-3 bg-slate-900 border border-slate-800 rounded-xl">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by subject or camera feed..."
            className="w-full pl-9 pr-4 py-1.5 text-xs bg-slate-950 border border-slate-800 rounded-lg text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-cyan-400"
          />
        </div>

        {/* Filter buttons */}
        <div className="flex items-center gap-1 p-1 bg-slate-950 border border-slate-800 rounded-lg overflow-x-auto w-full md:w-auto">
          {[
            { id: 'all', label: 'All Detections' },
            { id: 'alerts', label: 'Alerts & BOLOs' },
            { id: 'authorized', label: 'Authorized' },
            { id: 'vip', label: 'VIPs' },
            { id: 'unknown', label: 'Unregistered' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilterCategory(tab.id as any)}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                filterCategory === tab.id
                  ? 'bg-slate-800 text-slate-100 font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Events Table */}
      <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-900/60">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950 text-slate-400 border-b border-slate-800 font-mono text-[11px] uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">Timestamp (UTC)</th>
                <th className="py-3 px-4">Subject</th>
                <th className="py-3 px-4">Watchlist Status</th>
                <th className="py-3 px-4">Camera Source</th>
                <th className="py-3 px-4 text-right">Confidence</th>
                <th className="py-3 px-4">Biometrics</th>
                <th className="py-3 px-4 text-center">History</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredEvents.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500">
                    No matching detection events found in audit log.
                  </td>
                </tr>
              ) : (
                filteredEvents.map((evt, idx) => {
                  let badgeText = 'Authorized Staff';
                  let badgeClass = 'text-emerald-400';
                  if (evt.category === 'vip') {
                    badgeText = 'VIP Resident';
                    badgeClass = 'text-sky-400';
                  } else if (evt.category === 'bolo') {
                    badgeText = 'BOLO ALERT (ESCORT)';
                    badgeClass = 'text-rose-400 font-bold';
                  } else if (evt.category === 'unknown') {
                    badgeText = 'Unregistered Person';
                    badgeClass = 'text-amber-400';
                  }

                  return (
                    <tr
                      key={`${evt.id}-${evt.timestamp}-${idx}`}
                      className={`hover:bg-slate-800/40 transition-colors ${
                        evt.category === 'bolo' ? 'bg-rose-950/20' : ''
                      }`}
                    >
                      {/* Timestamp */}
                      <td className="py-3 px-4 font-mono text-slate-400 tabular-nums whitespace-nowrap">
                        {new Date(evt.timestamp).toLocaleString()}
                      </td>

                      {/* Subject + Snapshot */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          {evt.snapshotUrl ? (
                            <img
                              src={evt.snapshotUrl}
                              alt={evt.subjectName}
                              referrerPolicy="no-referrer"
                              className="w-7 h-7 rounded object-cover border border-slate-700 shrink-0"
                            />
                          ) : (
                            <div className="w-7 h-7 rounded bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400 font-bold shrink-0">
                              <User className="w-3.5 h-3.5" />
                            </div>
                          )}
                          <span className="font-semibold text-slate-100">
                            {evt.subjectName}
                          </span>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4 font-mono">
                        <span className={badgeClass}>{badgeText}</span>
                      </td>

                      {/* Camera */}
                      <td className="py-3 px-4 text-slate-300">
                        {evt.cameraName}
                      </td>

                      {/* Confidence */}
                      <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-200">
                        {(evt.confidence * 100).toFixed(1)}%
                      </td>

                      {/* Biometrics */}
                      <td className="py-3 px-4 text-slate-400 font-mono text-[11px]">
                        {evt.age ? `Age ~${evt.age.low}` : 'Age ~30'} · {evt.gender || 'Person'}
                      </td>

                      {/* Query User History & Delete Action */}
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1">
                          {onViewHistory && (
                            <button
                              onClick={() => onViewHistory(evt.subjectName)}
                              className="p-1 rounded text-slate-400 hover:text-cyan-400 hover:bg-slate-800 transition-colors cursor-pointer"
                              title={`Query history for ${evt.subjectName}`}
                            >
                              <History className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {onDeleteEvent && (
                            <button
                              onClick={() => onDeleteEvent(evt.id)}
                              className="p-1 rounded text-slate-500 hover:text-rose-400 hover:bg-slate-800 transition-colors cursor-pointer"
                              title="Delete this event record"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
