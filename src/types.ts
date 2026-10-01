export type WatchlistCategory = 'authorized' | 'vip' | 'bolo' | 'guest' | 'unknown';

let eventCounter = 0;
export function generateUniqueEventId(): string {
  eventCounter = (eventCounter + 1) % 1000000;
  const randomPart = Math.random().toString(36).substring(2, 9);
  return `evt_${Date.now()}_${eventCounter}_${randomPart}`;
}

export interface SubjectProfile {
  id: string;
  name: string;
  category: WatchlistCategory;
  enrolledAt: string;
  imagePath?: string;
  imageData?: string;
  descriptor?: number[];
  notes?: string;
  matchThreshold: number;
  detectionCount: number;
}

export interface DetectionEvent {
  id: string;
  timestamp: string;
  cameraId: string;
  cameraName: string;
  subjectName: string;
  category: WatchlistCategory;
  confidence: number;
  box: {
    x_min: number;
    y_min: number;
    x_max: number;
    y_max: number;
  };
  snapshotUrl?: string;
  age?: {
    low: number;
    high: number;
  };
  gender?: string;
  acknowledged?: boolean;
}

export interface CameraSource {
  id: string;
  name: string;
  location: string;
  type: 'webcam' | 'simulated' | 'rtsp';
  streamUrl?: string;
  active: boolean;
  resolution: string;
  fps: number;
}

export interface CompreFaceConfig {
  upstreamUrl: string;
  apiKey: string;
  mode: 'integrated_local' | 'upstream_proxy';
  detProbThreshold: number;
  minSimilarity: number;
  facePlugins: string[];
}

export interface DatabaseInfo {
  type: string;
  connected: boolean;
  tables: string[];
  totalSubjects: number;
  totalEvents: number;
  isPostgres: boolean;
}

export interface LookoutStats {
  activeCameras: number;
  totalSubjects: number;
  boloAlertCount: number;
  authorizedDetections: number;
  unknownDetections: number;
  totalEvents: number;
  engineLatencyMs: number;
  comprefaceMode: 'integrated_local' | 'upstream_proxy';
  fpsAverage: number;
  database?: DatabaseInfo;
}

export interface SubjectHistorySummary {
  subjectName: string;
  category: WatchlistCategory;
  totalDetections: number;
  firstSeen: string | null;
  lastSeen: string | null;
  locationsVisited: { cameraName: string; count: number }[];
  averageConfidence: number;
  recentEvents: DetectionEvent[];
}

export interface CompreFaceRecognitionResponse {
  result: Array<{
    box: {
      probability: number;
      x_min: number;
      y_min: number;
      x_max: number;
      y_max: number;
    };
    subjects: Array<{
      subject: string;
      similarity: number;
      category?: WatchlistCategory;
    }>;
    landmarks?: number[][];
    age?: {
      probability: number;
      low: number;
      high: number;
    };
    gender?: {
      probability: number;
      value: string;
    };
    mask?: {
      probability: number;
      value: string;
    };
    execution_time?: {
      detector?: number;
      calculator?: number;
      upstream?: number;
      total_ms?: number;
      provider?: string;
    };
  }>;
}
