import React from 'react';
import { CameraSource, SubjectProfile } from '../types';
import { Maximize2, Camera, Video, Globe } from 'lucide-react';

interface MultiCamGridProps {
  cameras: CameraSource[];
  subjects: SubjectProfile[];
  onSelectCamera: (cameraId: string) => void;
}

export const MultiCamGrid: React.FC<MultiCamGridProps> = ({
  cameras,
  subjects,
  onSelectCamera
}) => {
  return (
    <div className="p-6 max-w-7xl mx-auto flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-100">
            Active Video Feeds & Stream Matrix
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Real video sources connected to the CompreFace facial recognition engine. Zero simulated inputs.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono text-emerald-400">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>Real Camera Feeds Configured</span>
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {cameras.map((cam) => {
          let CamIcon = Camera;
          if (cam.id === 'cam_video_file') CamIcon = Video;
          if (cam.type === 'rtsp') CamIcon = Globe;

          return (
            <div
              key={cam.id}
              onClick={() => onSelectCamera(cam.id)}
              className="group relative aspect-video bg-slate-950 border border-slate-800 hover:border-cyan-400 rounded-xl overflow-hidden cursor-pointer transition-all duration-200 shadow-lg flex flex-col justify-between p-4"
            >
              {/* Clean feed background */}
              <div className="absolute inset-0 flex items-center justify-center bg-slate-950/80">
                <div className="flex flex-col items-center gap-2 text-slate-600 group-hover:text-cyan-400/80 transition-colors">
                  <CamIcon className="w-10 h-10 stroke-1" />
                  <span className="text-xs font-mono">
                    {cam.active ? 'Feed Live · Click to Inspect' : 'Standby'}
                  </span>
                </div>
              </div>

              {/* Top Camera Information */}
              <div className="relative z-10 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${cam.active ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'}`} />
                  <span className="text-xs font-bold text-slate-100 tracking-wide font-mono">
                    {cam.name.toUpperCase()}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-[11px] font-mono text-slate-400 tabular-nums bg-slate-900/90 px-2 py-0.5 rounded border border-slate-800">
                  <span>{cam.fps} FPS</span>
                  <span className="text-slate-600">·</span>
                  <span>{cam.resolution}</span>
                </div>
              </div>

              {/* Bottom Telemetry Bar */}
              <div className="relative z-10 flex items-center justify-between pt-2 border-t border-slate-800/80 text-[11px] font-mono text-slate-400 bg-slate-950/60 -mx-4 -mb-4 px-4 py-2.5">
                <span className="text-slate-400 truncate max-w-[180px]">{cam.location}</span>

                <div className="flex items-center gap-1.5 text-cyan-400">
                  <span className="text-[10px]">MONITOR FEED</span>
                  <Maximize2 className="w-3.5 h-3.5" />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
