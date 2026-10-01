import {
  SubjectProfile,
  DetectionEvent,
  CameraSource,
  CompreFaceConfig,
  LookoutStats,
  SubjectHistorySummary,
  DatabaseInfo,
  CompreFaceRecognitionResponse
} from '../types';

export const api = {
  // Lookout Subjects
  async getSubjects(): Promise<SubjectProfile[]> {
    const res = await fetch('/api/lookout/subjects');
    if (!res.ok) throw new Error('Failed to fetch subjects');
    return res.json();
  },

  async createSubject(data: {
    subject: string;
    category: string;
    notes?: string;
    imagePath?: string;
    imageData?: string;
    descriptor?: number[];
  }): Promise<{ subject: string; id: string }> {
    const res = await fetch('/api/v1/recognition/subjects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Failed to create subject');
    }
    return res.json();
  },

  async deleteSubject(name: string): Promise<void> {
    const res = await fetch(`/api/v1/recognition/subjects/${encodeURIComponent(name)}`, {
      method: 'DELETE'
    });
    if (!res.ok) throw new Error('Failed to delete subject');
  },

  async deleteSubjectFace(name: string): Promise<void> {
    const res = await fetch(`/api/lookout/subjects/${encodeURIComponent(name)}/face`, {
      method: 'DELETE'
    });
    if (!res.ok) throw new Error('Failed to delete face image');
  },

  async updateSubject(name: string, data: { subject?: string; category?: string; notes?: string }): Promise<void> {
    const res = await fetch(`/api/v1/recognition/subjects/${encodeURIComponent(name)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error('Failed to update subject');
  },

  // Query User History from Persistent Database
  async getSubjectHistory(subjectName: string): Promise<SubjectHistorySummary> {
    const res = await fetch(`/api/lookout/history/${encodeURIComponent(subjectName)}`);
    if (!res.ok) throw new Error(`Failed to query history for ${subjectName}`);
    return res.json();
  },

  // Persistent Database Info
  async getDatabaseInfo(): Promise<DatabaseInfo> {
    const res = await fetch('/api/lookout/database');
    if (!res.ok) throw new Error('Failed to fetch database info');
    return res.json();
  },

  // CompreFace Face Recognition Inference
  async recognizeFace(imageData: string, expectedSubject?: string): Promise<CompreFaceRecognitionResponse> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (expectedSubject) {
      headers['x-mock-subject'] = expectedSubject;
    }
    const res = await fetch('/api/v1/recognition/recognize?limit=1&det_prob_threshold=0.75', {
      method: 'POST',
      headers,
      body: JSON.stringify({ imageData, expectedSubject })
    });
    if (!res.ok) throw new Error('Face recognition inference failed');
    return res.json();
  },

  // CompreFace Face Detection
  async detectFace(imageData: string) {
    const res = await fetch('/api/v1/detection/detect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageData })
    });
    if (!res.ok) throw new Error('Face detection failed');
    return res.json();
  },

  // CompreFace Face Verification
  async verifyFaces(sourceImage: string, targetImage: string) {
    const res = await fetch('/api/v1/verification/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source_image: sourceImage, target_image: targetImage })
    });
    if (!res.ok) throw new Error('Face verification failed');
    return res.json();
  },

  // Lookout Detection Events
  async getEvents(limit = 100): Promise<DetectionEvent[]> {
    const res = await fetch(`/api/lookout/events?limit=${limit}`);
    if (!res.ok) throw new Error('Failed to fetch events');
    return res.json();
  },

  async logEvent(event: Partial<DetectionEvent>): Promise<DetectionEvent> {
    const res = await fetch('/api/lookout/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(event)
    });
    if (!res.ok) throw new Error('Failed to log event');
    return res.json();
  },

  async deleteEvent(id: string): Promise<void> {
    const res = await fetch(`/api/lookout/events/${encodeURIComponent(id)}`, {
      method: 'DELETE'
    });
    if (!res.ok) throw new Error('Failed to delete event');
  },

  async clearEvents(): Promise<void> {
    const res = await fetch('/api/lookout/events', { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to clear events');
  },

  // Cameras
  async getCameras(): Promise<CameraSource[]> {
    const res = await fetch('/api/lookout/cameras');
    if (!res.ok) throw new Error('Failed to fetch cameras');
    return res.json();
  },

  async addCamera(camera: Partial<CameraSource>): Promise<CameraSource> {
    const res = await fetch('/api/lookout/cameras', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(camera)
    });
    if (!res.ok) throw new Error('Failed to add camera');
    return res.json();
  },

  // Stats
  async getStats(): Promise<LookoutStats> {
    const res = await fetch('/api/lookout/stats');
    if (!res.ok) throw new Error('Failed to fetch stats');
    return res.json();
  },

  // CompreFace Gateway Config
  async getConfig(): Promise<CompreFaceConfig> {
    const res = await fetch('/api/compreface/config');
    if (!res.ok) throw new Error('Failed to fetch config');
    return res.json();
  },

  async updateConfig(config: Partial<CompreFaceConfig>): Promise<CompreFaceConfig> {
    const res = await fetch('/api/compreface/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config)
    });
    if (!res.ok) throw new Error('Failed to update config');
    return res.json();
  },

  async testConnection(upstreamUrl: string, apiKey: string): Promise<{ status: string; latencyMs: number; message: string }> {
    const res = await fetch('/api/compreface/test-connection', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ upstreamUrl, apiKey })
    });
    if (!res.ok) throw new Error('Connection test failed');
    return res.json();
  }
};
