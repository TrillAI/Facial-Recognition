import React, { useState, useRef } from 'react';
import {
  Search,
  UserPlus,
  Trash2,
  Edit3,
  Shield,
  Star,
  AlertOctagon,
  User,
  History,
  ImageOff,
  Upload,
  Check,
  AlertCircle
} from 'lucide-react';
import { SubjectProfile, WatchlistCategory } from '../types';
import { api } from '../services/api';

interface SubjectWatchlistProps {
  subjects: SubjectProfile[];
  onOpenEnroll: () => void;
  onDeleteSubject: (name: string) => Promise<void>;
  onUpdateSubject: (name: string, data: { category?: WatchlistCategory; notes?: string }) => Promise<void>;
  onViewHistory: (subjectName: string) => void;
  onRefreshSubjects?: () => Promise<void>;
}

export const SubjectWatchlist: React.FC<SubjectWatchlistProps> = ({
  subjects,
  onOpenEnroll,
  onDeleteSubject,
  onUpdateSubject,
  onViewHistory,
  onRefreshSubjects
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<'all' | WatchlistCategory>('all');
  const [editingSubject, setEditingSubject] = useState<SubjectProfile | null>(null);
  const [editNotes, setEditNotes] = useState('');
  const [editCategory, setEditCategory] = useState<WatchlistCategory>('authorized');

  const [isDeletingSubject, setIsDeletingSubject] = useState<string | null>(null);
  const [isDeletingFace, setIsDeletingFace] = useState<string | null>(null);
  const [confirmDeleteSubject, setConfirmDeleteSubject] = useState<string | null>(null);
  const [confirmDeleteFace, setConfirmDeleteFace] = useState<string | null>(null);
  const [statusNotification, setStatusNotification] = useState<string | null>(null);
  const [activePhotoSubject, setActivePhotoSubject] = useState<SubjectProfile | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploadingForSubject, setUploadingForSubject] = useState<string | null>(null);

  const showNotification = (msg: string) => {
    setStatusNotification(msg);
    setTimeout(() => setStatusNotification(null), 4000);
  };

  const filteredSubjects = subjects.filter((s) => {
    const matchesSearch =
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.notes && s.notes.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesCategory = selectedFilter === 'all' || s.category === selectedFilter;
    return matchesSearch && matchesCategory;
  });

  const handleStartEdit = (subject: SubjectProfile) => {
    setEditingSubject(subject);
    setEditNotes(subject.notes || '');
    setEditCategory(subject.category);
  };

  const handleSaveEdit = async () => {
    if (!editingSubject) return;
    try {
      await onUpdateSubject(editingSubject.name, {
        category: editCategory,
        notes: editNotes
      });
      setEditingSubject(null);
      showNotification(`Subject '${editingSubject.name}' updated.`);
    } catch (err: any) {
      showNotification(err.message || 'Failed to update subject');
    }
  };

  // Robust Subject Deletion (Without blocking window.confirm)
  const handleDeleteSubject = async (name: string) => {
    if (confirmDeleteSubject !== name) {
      setConfirmDeleteSubject(name);
      setTimeout(() => {
        setConfirmDeleteSubject((cur) => (cur === name ? null : cur));
      }, 5000);
      return;
    }

    setConfirmDeleteSubject(null);
    setIsDeletingSubject(name);
    try {
      await onDeleteSubject(name);
      showNotification(`Subject '${name}' deleted successfully.`);
    } catch (err: any) {
      showNotification(`Error deleting subject: ${err.message || 'Server error'}`);
    } finally {
      setIsDeletingSubject(null);
    }
  };

  // Robust Face Photo Deletion (Without blocking window.confirm)
  const handleDeleteFace = async (subject: SubjectProfile) => {
    if (confirmDeleteFace !== subject.name) {
      setConfirmDeleteFace(subject.name);
      setTimeout(() => {
        setConfirmDeleteFace((cur) => (cur === subject.name ? null : cur));
      }, 5000);
      return;
    }

    setConfirmDeleteFace(null);
    setIsDeletingFace(subject.name);
    try {
      await api.deleteSubjectFace(subject.name);
      subject.imagePath = '';
      subject.imageData = '';
      subject.descriptor = undefined;
      if (onRefreshSubjects) {
        await onRefreshSubjects();
      }
      showNotification(`Face photo removed for '${subject.name}'.`);
    } catch (err: any) {
      showNotification(`Error removing face photo: ${err.message || 'Server error'}`);
    } finally {
      setIsDeletingFace(null);
    }
  };

  // Replace / Upload new face image for existing subject
  const handleUploadNewFace = (subjectName: string) => {
    setUploadingForSubject(subjectName);
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && uploadingForSubject) {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const base64 = event.target?.result as string;
        try {
          await fetch(`/api/v1/recognition/faces?subject=${encodeURIComponent(uploadingForSubject)}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ imageData: base64 })
          });
          if (onRefreshSubjects) {
            await onRefreshSubjects();
          }
        } catch (err: any) {
          alert('Failed to upload face image: ' + err.message);
        } finally {
          setUploadingForSubject(null);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto flex flex-col gap-6">
      {/* Hidden file input for uploading new face image */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-100">
            CompreFace Enrolled Subjects Watchlist
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Registered identities and facial biometric images in the persistent database. Real faces only.
          </p>
        </div>

        <button
          onClick={onOpenEnroll}
          className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-950 bg-cyan-400 hover:bg-cyan-300 rounded-lg transition-colors cursor-pointer self-start sm:self-auto shadow-sm"
        >
          <UserPlus className="w-4 h-4" />
          Enroll New Subject
        </button>
      </div>

      {/* Status Notification Toast */}
      {statusNotification && (
        <div className="p-3 rounded-xl bg-cyan-950/80 border border-cyan-500/50 text-xs font-mono text-cyan-200 flex items-center gap-2 animate-fadeIn">
          <Check className="w-4 h-4 text-cyan-400 shrink-0" />
          <span>{statusNotification}</span>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 p-3 bg-slate-900 border border-slate-800 rounded-xl">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name, clearance, or notes..."
            className="w-full pl-9 pr-4 py-1.5 text-xs bg-slate-950 border border-slate-800 rounded-lg text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-cyan-400"
          />
        </div>

        <div className="flex items-center gap-1 p-1 bg-slate-950 border border-slate-800 rounded-lg w-full md:w-auto overflow-x-auto">
          {(['all', 'authorized', 'vip', 'bolo', 'guest'] as const).map((cat) => {
            const isActive = selectedFilter === cat;
            return (
              <button
                key={cat}
                onClick={() => setSelectedFilter(cat)}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                  isActive
                    ? 'bg-slate-800 text-slate-100 font-semibold shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {cat === 'all' ? 'All Subjects' : cat.toUpperCase()}
              </button>
            );
          })}
        </div>
      </div>

      {/* Subjects Grid */}
      {filteredSubjects.length === 0 ? (
        <div className="p-12 text-center border border-slate-800 rounded-2xl bg-slate-900/40">
          <p className="text-sm font-medium text-slate-300">No subjects found</p>
          <p className="text-xs text-slate-500 mt-1">
            Try adjusting your search query or enroll a new identity to CompreFace.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredSubjects.map((sub) => {
            let categoryLabel = 'Authorized Staff';
            let categoryColor = 'text-emerald-400';
            let CategoryIcon = Shield;

            if (sub.category === 'vip') {
              categoryLabel = 'VIP Resident';
              categoryColor = 'text-sky-400';
              CategoryIcon = Star;
            } else if (sub.category === 'bolo') {
              categoryLabel = 'BOLO (Be On The Lookout)';
              categoryColor = 'text-rose-400 font-bold';
              CategoryIcon = AlertOctagon;
            } else if (sub.category === 'guest') {
              categoryLabel = 'Visitor / Guest';
              categoryColor = 'text-slate-300';
              CategoryIcon = User;
            }

            const hasPhoto = Boolean(sub.imagePath || sub.imageData);

            return (
              <div
                key={sub.id}
                className="p-4 bg-slate-900 border border-slate-800 rounded-xl flex flex-col justify-between hover:border-slate-700 transition-colors"
              >
                <div>
                  {/* Top Profile Lockup */}
                  <div className="flex items-start gap-3.5 mb-3">
                    <div className="relative group">
                      {hasPhoto ? (
                        <img
                          src={sub.imagePath || sub.imageData}
                          alt={sub.name}
                          referrerPolicy="no-referrer"
                          className="w-16 h-16 rounded-xl object-cover border border-slate-700 shrink-0 bg-slate-950"
                        />
                      ) : (
                        <div className="w-16 h-16 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-center shrink-0 text-slate-400">
                          <User className="w-8 h-8 text-slate-600" />
                        </div>
                      )}

                      {/* Photo Actions Overlay */}
                      <div className="absolute inset-0 bg-slate-950/80 rounded-xl opacity-0 group-hover:opacity-100 flex items-center justify-center gap-1 transition-opacity">
                        <button
                          onClick={() => handleUploadNewFace(sub.name)}
                          className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-cyan-400"
                          title="Upload new face photo"
                        >
                          <Upload className="w-3.5 h-3.5" />
                        </button>
                        {hasPhoto && (
                          <button
                            onClick={() => handleDeleteFace(sub)}
                            disabled={isDeletingFace === sub.name}
                            className="p-1 rounded bg-slate-800 hover:bg-rose-900 text-rose-400"
                            title="Delete face photo"
                          >
                            <ImageOff className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="flex-1 overflow-hidden">
                      <div className="flex items-center justify-between gap-1">
                        <h2 className="text-sm font-bold text-slate-100 truncate">
                          {sub.name}
                        </h2>
                        <CategoryIcon className={`w-4 h-4 ${categoryColor} shrink-0`} />
                      </div>

                      <div className="text-xs text-slate-400 mt-1 flex items-center gap-1.5 font-mono">
                        <span className={categoryColor}>{categoryLabel}</span>
                      </div>

                      <div className="text-xs text-slate-500 mt-0.5 font-mono tabular-nums">
                        Enrolled: {new Date(sub.enrolledAt).toLocaleDateString()}
                      </div>
                    </div>
                  </div>

                  {/* Notes / Access Details */}
                  {sub.notes && (
                    <div className="p-2.5 rounded-lg bg-slate-950/70 border border-slate-800 text-xs text-slate-300 leading-relaxed mb-3">
                      {sub.notes}
                    </div>
                  )}

                  {/* Face status & Metrics */}
                  <div className="flex items-center justify-between text-xs text-slate-400 border-t border-slate-800/80 pt-2.5 font-mono tabular-nums">
                    <span>
                      {hasPhoto ? (
                        <span className="text-emerald-400 flex items-center gap-1">
                          <Check className="w-3 h-3" /> Face Enrolled
                        </span>
                      ) : (
                        <span className="text-amber-400 flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" /> No Face Image
                        </span>
                      )}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>Detections: {sub.detectionCount}</span>
                  </div>
                </div>

                {/* Card Actions */}
                <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-800">
                  <button
                    onClick={() => onViewHistory(sub.name)}
                    className="p-1.5 rounded-md text-cyan-400 hover:text-cyan-300 hover:bg-slate-800 transition-colors cursor-pointer text-xs flex items-center gap-1.5 font-mono"
                    title="Query History from Database"
                  >
                    <History className="w-3.5 h-3.5" />
                    <span>User History</span>
                  </button>

                  <div className="flex items-center gap-1">
                    {/* Delete Face Photo Button */}
                    {hasPhoto && (
                      <button
                        onClick={() => handleDeleteFace(sub)}
                        disabled={isDeletingFace === sub.name}
                        className={`p-1.5 rounded-md transition-colors cursor-pointer text-xs flex items-center gap-1 font-mono ${
                          confirmDeleteFace === sub.name
                            ? 'bg-amber-950 border border-amber-500 text-amber-200 font-bold animate-pulse'
                            : 'text-slate-400 hover:text-amber-400 hover:bg-slate-800'
                        }`}
                        title={confirmDeleteFace === sub.name ? 'Click again to confirm removing face photo' : 'Delete Face Image Only'}
                      >
                        <ImageOff className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">
                          {isDeletingFace === sub.name
                            ? 'Removing...'
                            : confirmDeleteFace === sub.name
                            ? 'Confirm Remove?'
                            : 'Delete Face'}
                        </span>
                      </button>
                    )}

                    <button
                      onClick={() => handleStartEdit(sub)}
                      className="p-1.5 rounded-md text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors cursor-pointer text-xs flex items-center gap-1"
                      title="Edit Details"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>Edit</span>
                    </button>

                    {/* Delete Subject Button */}
                    <button
                      onClick={() => handleDeleteSubject(sub.name)}
                      disabled={isDeletingSubject === sub.name}
                      className={`p-1.5 rounded-md transition-colors cursor-pointer text-xs flex items-center gap-1 font-mono ${
                        confirmDeleteSubject === sub.name
                          ? 'bg-rose-950 border border-rose-500 text-rose-200 font-bold animate-pulse'
                          : 'text-slate-500 hover:text-rose-400 hover:bg-slate-800'
                      }`}
                      title={confirmDeleteSubject === sub.name ? 'Click again to confirm permanent deletion' : 'Delete Subject Completely'}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>
                        {isDeletingSubject === sub.name
                          ? 'Deleting...'
                          : confirmDeleteSubject === sub.name
                          ? 'Confirm Delete?'
                          : 'Delete'}
                      </span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Edit Subject Modal */}
      {editingSubject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="w-full max-w-md p-6 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl flex flex-col gap-4">
            <h2 className="text-base font-bold text-slate-100">
              Edit Subject: {editingSubject.name}
            </h2>

            <div>
              <label htmlFor="edit-cat" className="block text-xs font-medium text-slate-400 mb-1">
                Watchlist Category
              </label>
              <select
                id="edit-cat"
                value={editCategory}
                onChange={(e) => setEditCategory(e.target.value as WatchlistCategory)}
                className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-cyan-400"
              >
                <option value="authorized">Authorized Staff</option>
                <option value="vip">VIP Resident</option>
                <option value="bolo">BOLO (Be On The Lookout Alert)</option>
                <option value="guest">Guest / Visitor</option>
              </select>
            </div>

            <div>
              <label htmlFor="edit-notes" className="block text-xs font-medium text-slate-400 mb-1">
                Access Clearance Notes
              </label>
              <textarea
                id="edit-notes"
                rows={3}
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                placeholder="Access level, badge number, special instructions..."
                className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-cyan-400"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setEditingSubject(null)}
                className="px-3.5 py-1.5 text-xs text-slate-400 hover:text-slate-200 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                className="px-4 py-1.5 text-xs font-semibold text-slate-950 bg-cyan-400 hover:bg-cyan-300 rounded-lg cursor-pointer"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
