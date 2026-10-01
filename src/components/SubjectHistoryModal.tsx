import React, { useState, useEffect } from 'react';
import { X, Calendar, MapPin, Activity, User, Shield, Star, AlertOctagon, Clock } from 'lucide-react';
import { SubjectHistorySummary } from '../types';
import { api } from '../services/api';

interface SubjectHistoryModalProps {
  subjectName: string | null;
  isOpen: boolean;
  onClose: () => void;
}

export const SubjectHistoryModal: React.FC<SubjectHistoryModalProps> = ({
  subjectName,
  isOpen,
  onClose
}) => {
  const [history, setHistory] = useState<SubjectHistorySummary | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && subjectName) {
      setIsLoading(true);
      setError(null);
      api.getSubjectHistory(subjectName)
        .then((data) => setHistory(data))
        .catch((err) => setError(err.message || 'Failed to load subject history from database'))
        .finally(() => setIsLoading(false));
    } else {
      setHistory(null);
    }
  }, [isOpen, subjectName]);

  if (!isOpen || !subjectName) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
      <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-slate-100">
                Database History: {subjectName}
              </h2>
              {history && (
                <span className="text-xs font-mono text-cyan-400 capitalize">
                  · {history.category}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Historical access audit logs and metadata retrieved from persistent database.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex flex-col gap-5">
          {isLoading && (
            <div className="py-12 text-center text-xs text-slate-400 font-mono animate-pulse">
              Querying persistent database for {subjectName} history...
            </div>
          )}

          {error && (
            <div className="p-3 bg-rose-950/50 border border-rose-800 rounded-lg text-xs text-rose-300">
              {error}
            </div>
          )}

          {history && (
            <>
              {/* Analytics Metric Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl">
                  <div className="text-[11px] font-mono text-slate-400">Total Detections</div>
                  <div className="text-xl font-bold font-mono tabular-nums text-slate-100 mt-1">
                    {history.totalDetections}
                  </div>
                </div>

                <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl">
                  <div className="text-[11px] font-mono text-slate-400">Avg Confidence</div>
                  <div className="text-xl font-bold font-mono tabular-nums text-cyan-400 mt-1">
                    {(history.averageConfidence * 100).toFixed(1)}%
                  </div>
                </div>

                <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl">
                  <div className="text-[11px] font-mono text-slate-400">First Seen (UTC)</div>
                  <div className="text-xs font-mono tabular-nums text-slate-300 mt-1.5 truncate">
                    {history.firstSeen ? new Date(history.firstSeen).toLocaleDateString() : 'N/A'}
                  </div>
                </div>

                <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl">
                  <div className="text-[11px] font-mono text-slate-400">Last Seen (UTC)</div>
                  <div className="text-xs font-mono tabular-nums text-slate-300 mt-1.5 truncate">
                    {history.lastSeen ? new Date(history.lastSeen).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'N/A'}
                  </div>
                </div>
              </div>

              {/* Locations Visited Breakdown */}
              <div className="p-4 bg-slate-950/70 border border-slate-800 rounded-xl">
                <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider font-mono mb-2 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-cyan-400" />
                  Camera Locations Visited
                </h3>
                <div className="flex flex-wrap gap-2">
                  {history.locationsVisited.length === 0 ? (
                    <span className="text-xs text-slate-500">No recorded camera locations.</span>
                  ) : (
                    history.locationsVisited.map((loc) => (
                      <div
                        key={loc.cameraName}
                        className="px-2.5 py-1 rounded-md bg-slate-900 border border-slate-800 text-xs font-mono text-slate-300 flex items-center gap-2"
                      >
                        <span>{loc.cameraName}</span>
                        <span className="text-cyan-400 font-bold tabular-nums">({loc.count}x)</span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Historical Detections Timeline */}
              <div className="flex flex-col gap-2">
                <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider font-mono flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-cyan-400" />
                  Historical Detection Records ({history.recentEvents.length})
                </h3>

                <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950">
                  <div className="max-h-60 overflow-y-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-900 text-slate-400 border-b border-slate-800 font-mono text-[11px]">
                        <tr>
                          <th className="py-2.5 px-3">Timestamp</th>
                          <th className="py-2.5 px-3">Camera</th>
                          <th className="py-2.5 px-3 text-right">Confidence</th>
                          <th className="py-2.5 px-3">Biometrics</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                        {history.recentEvents.length === 0 ? (
                          <tr>
                            <td colSpan={4} className="py-6 text-center text-slate-500">
                              No prior timestamped detections found in database.
                            </td>
                          </tr>
                        ) : (
                          history.recentEvents.map((e, idx) => (
                            <tr key={`${e.id}-${e.timestamp}-${idx}`} className="hover:bg-slate-900/50">
                              <td className="py-2 px-3 text-slate-300 tabular-nums">
                                {new Date(e.timestamp).toLocaleString()}
                              </td>
                              <td className="py-2 px-3 text-slate-400">
                                {e.cameraName}
                              </td>
                              <td className="py-2 px-3 text-right text-cyan-400 tabular-nums font-semibold">
                                {(e.confidence * 100).toFixed(1)}%
                              </td>
                              <td className="py-2 px-3 text-slate-400">
                                {e.age ? `Age ~${e.age.low}` : 'N/A'} · {e.gender || 'Person'}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-3 border-t border-slate-800 bg-slate-950 text-xs font-mono text-slate-500">
          <span>Query Source: Persistent DB Index</span>
          <button
            onClick={onClose}
            className="px-3.5 py-1 text-xs text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-md cursor-pointer transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
