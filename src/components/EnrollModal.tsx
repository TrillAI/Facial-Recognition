import React, { useState, useRef } from 'react';
import { X, Upload, Camera, Check } from 'lucide-react';
import { WatchlistCategory } from '../types';

interface EnrollModalProps {
  isOpen: boolean;
  onClose: () => void;
  onEnroll: (data: {
    subject: string;
    category: WatchlistCategory;
    notes?: string;
    imageData?: string;
    descriptor?: number[];
  }) => Promise<void>;
  prefilledImage?: string;
  prefilledName?: string;
  prefilledDescriptor?: number[];
}

export const EnrollModal: React.FC<EnrollModalProps> = ({
  isOpen,
  onClose,
  onEnroll,
  prefilledImage,
  prefilledName,
  prefilledDescriptor
}) => {
  const [name, setName] = useState(prefilledName || '');
  const [category, setCategory] = useState<WatchlistCategory>('authorized');
  const [notes, setNotes] = useState('');
  const [imagePreview, setImagePreview] = useState<string>(prefilledImage || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Sync if prefilled changes
  React.useEffect(() => {
    if (prefilledImage) setImagePreview(prefilledImage);
    if (prefilledName) setName(prefilledName);
  }, [prefilledImage, prefilledName]);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setImagePreview(event.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Please provide a subject name');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await onEnroll({
        subject: name.trim(),
        category,
        notes: notes.trim(),
        imageData: imagePreview,
        descriptor: prefilledDescriptor
      });
      setName('');
      setNotes('');
      setImagePreview('');
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to enroll subject to CompreFace');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <div>
            <h2 className="text-base font-bold text-slate-100">
              Enroll New Subject to CompreFace
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Add facial biometrics and watchlist classification into the recognition engine.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-4">
          {error && (
            <div className="p-3 bg-rose-950/50 border border-rose-800 rounded-lg text-xs text-rose-300">
              {error}
            </div>
          )}

          {/* Photo Section */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-2">
              Reference Facial Image
            </label>
            <div className="flex items-center gap-4">
              {imagePreview ? (
                <div className="relative w-24 h-24 rounded-xl overflow-hidden border border-cyan-500/50 shrink-0 bg-slate-950">
                  <img
                    src={imagePreview}
                    alt="Subject Reference"
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => setImagePreview('')}
                    className="absolute top-1 right-1 p-1 bg-slate-900/80 hover:bg-rose-900 text-rose-300 rounded-full cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ) : (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="w-24 h-24 rounded-xl border-2 border-dashed border-slate-700 hover:border-cyan-400/80 flex flex-col items-center justify-center text-slate-500 hover:text-cyan-300 transition-colors cursor-pointer shrink-0 bg-slate-950/50"
                >
                  <Upload className="w-6 h-6 mb-1" />
                  <span className="text-[10px] font-medium">Upload</span>
                </div>
              )}

              <div className="flex flex-col gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="text-xs px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg border border-slate-700 transition-colors cursor-pointer text-left flex items-center gap-2"
                >
                  <Upload className="w-3.5 h-3.5 text-cyan-400" />
                  Choose File from Disk
                </button>
                <p className="text-[11px] text-slate-500 leading-tight">
                  JPG or PNG, minimum 200x200px recommended for optimal embedding calculation.
                </p>
              </div>
            </div>
          </div>

          {/* Subject Full Name */}
          <div>
            <label htmlFor="sub-name" className="block text-xs font-medium text-slate-300 mb-1">
              Full Name or Identification <span className="text-cyan-400">*</span>
            </label>
            <input
              id="sub-name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Sarah Jenkins"
              className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-800 rounded-lg text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-cyan-400"
            />
          </div>

          {/* Watchlist Category */}
          <div>
            <label htmlFor="sub-cat" className="block text-xs font-medium text-slate-300 mb-1">
              Watchlist Security Classification
            </label>
            <select
              id="sub-cat"
              value={category}
              onChange={(e) => setCategory(e.target.value as WatchlistCategory)}
              className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-800 rounded-lg text-slate-100 focus:outline-none focus:border-cyan-400"
            >
              <option value="authorized">Authorized Staff (Nominal Access)</option>
              <option value="vip">VIP Resident / Executive</option>
              <option value="bolo">BOLO Alert (Be On The Lookout - Security Escort)</option>
              <option value="guest">Guest / Temporary Visitor</option>
            </select>
          </div>

          {/* Notes */}
          <div>
            <label htmlFor="sub-notes" className="block text-xs font-medium text-slate-300 mb-1">
              Clearance Notes & Instructions
            </label>
            <textarea
              id="sub-notes"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Department, badge number, special instructions, or threat report..."
              className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-800 rounded-lg text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-cyan-400"
            />
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-slate-950 bg-cyan-400 hover:bg-cyan-300 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? (
                'Synchronizing with CompreFace...'
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  Enroll into Database
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
