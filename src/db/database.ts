import fs from 'fs';
import path from 'path';
import pg from 'pg';
import { SubjectProfile, DetectionEvent, WatchlistCategory } from '../types';

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

export class DatabaseManager {
  private pool: pg.Pool | null = null;
  private isPostgresConnected = false;
  private jsonDbPath: string;

  // In-memory cache for ultra-fast zero-latency queries
  private subjects: SubjectProfile[] = [];
  private events: DetectionEvent[] = [];

  constructor() {
    const dataDir = path.resolve(process.cwd(), 'data');
    if (!fs.existsSync(dataDir)) {
      try {
        fs.mkdirSync(dataDir, { recursive: true });
      } catch (err) {
        // ignore
      }
    }
    this.jsonDbPath = path.join(dataDir, 'lookout_db.json');
  }

  public async initialize(): Promise<void> {
    // 1. Load initial JSON database or seed defaults
    this.loadFromDisk();

    // 2. If DATABASE_URL is configured (e.g. In docker-compose with postgres service), attempt connection
    const dbUrl = process.env.DATABASE_URL;
    if (dbUrl) {
      try {
        this.pool = new pg.Pool({
          connectionString: dbUrl,
          connectionTimeoutMillis: 3000
        });

        // Test connection
        const client = await this.pool.connect();
        await this.initPostgresSchema(client);
        client.release();
        this.isPostgresConnected = true;
        console.log('[Lookout DB] Successfully connected to persistent PostgreSQL database at', dbUrl.split('@')[1] || dbUrl);
        await this.syncFromPostgres();
      } catch (err: any) {
        console.warn('[Lookout DB] PostgreSQL connection skipped/unavailable, falling back to persistent disk storage:', err.message);
        this.isPostgresConnected = false;
      }
    } else {
      console.log('[Lookout DB] Using persistent file-backed database storage at', this.jsonDbPath);
    }
  }

  private async initPostgresSchema(client: pg.PoolClient) {
    await client.query(`
      CREATE TABLE IF NOT EXISTS subjects (
        id VARCHAR(64) PRIMARY KEY,
        name VARCHAR(255) UNIQUE NOT NULL,
        category VARCHAR(32) NOT NULL,
        enrolled_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        image_path TEXT,
        image_data TEXT,
        notes TEXT,
        match_threshold REAL DEFAULT 0.8,
        detection_count INT DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS detection_events (
        id VARCHAR(64) PRIMARY KEY,
        timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        camera_id VARCHAR(64) NOT NULL,
        camera_name VARCHAR(255) NOT NULL,
        subject_name VARCHAR(255) NOT NULL,
        category VARCHAR(32) NOT NULL,
        confidence REAL NOT NULL,
        box_json TEXT,
        snapshot_url TEXT,
        age_low INT,
        age_high INT,
        gender VARCHAR(32)
      );

      CREATE INDEX IF NOT EXISTS idx_detection_subject ON detection_events(subject_name);
      CREATE INDEX IF NOT EXISTS idx_detection_timestamp ON detection_events(timestamp DESC);
    `);
  }

  private loadFromDisk() {
    if (fs.existsSync(this.jsonDbPath)) {
      try {
        const raw = fs.readFileSync(this.jsonDbPath, 'utf-8');
        const data = JSON.parse(raw);
        if (Array.isArray(data.subjects) && data.subjects.length > 0) {
          this.subjects = data.subjects;
        }
        if (Array.isArray(data.events)) {
          this.events = data.events;
        }
        return;
      } catch (e) {
        console.warn('[Lookout DB] Failed to parse existing lookout_db.json, re-seeding defaults.');
      }
    }

    // Default Seed Data
    this.subjects = [
      {
        id: 'sub_1',
        name: 'Marcus Vance',
        category: 'authorized',
        enrolledAt: '2026-09-15T08:30:00Z',
        imagePath: '/src/assets/images/subject_marcus_security_1790879352789.jpg',
        notes: 'Chief of Security Operations. Level 4 Access.',
        matchThreshold: 0.82,
        detectionCount: 142
      },
      {
        id: 'sub_2',
        name: 'Elena Rostova',
        category: 'vip',
        enrolledAt: '2026-09-18T14:15:00Z',
        imagePath: '/src/assets/images/subject_elena_director_1790879363394.jpg',
        notes: 'VP of Infrastructure & Facilities. VIP Escort Protocol.',
        matchThreshold: 0.85,
        detectionCount: 89
      },
      {
        id: 'sub_3',
        name: 'Dr. David Chen',
        category: 'authorized',
        enrolledAt: '2026-09-20T10:00:00Z',
        imagePath: '/src/assets/images/subject_chen_engineer_1790879373031.jpg',
        notes: 'Staff AI Hardware Architect. Clean Room Level 2 Access.',
        matchThreshold: 0.80,
        detectionCount: 64
      },
      {
        id: 'sub_4',
        name: 'Viktor Kane (BOLO)',
        category: 'bolo',
        enrolledAt: '2026-09-28T19:40:00Z',
        imagePath: '',
        notes: 'BE ON THE LOOKOUT: Revoked badge access. Immediate security escort required.',
        matchThreshold: 0.78,
        detectionCount: 3
      }
    ];

    this.events = [
      {
        id: 'evt_1',
        timestamp: new Date(Date.now() - 1000 * 60 * 4).toISOString(),
        cameraId: 'cam_1',
        cameraName: 'Gate Alpha - Main Entrance',
        subjectName: 'Marcus Vance',
        category: 'authorized',
        confidence: 0.95,
        box: { x_min: 180, y_min: 120, x_max: 420, y_max: 450 },
        snapshotUrl: '/src/assets/images/subject_marcus_security_1790879352789.jpg',
        age: { low: 34, high: 42 },
        gender: 'male'
      },
      {
        id: 'evt_2',
        timestamp: new Date(Date.now() - 1000 * 60 * 12).toISOString(),
        cameraId: 'cam_2',
        cameraName: 'Executive Lobby North',
        subjectName: 'Elena Rostova',
        category: 'vip',
        confidence: 0.97,
        box: { x_min: 140, y_min: 90, x_max: 390, y_max: 420 },
        snapshotUrl: '/src/assets/images/subject_elena_director_1790879363394.jpg',
        age: { low: 36, high: 44 },
        gender: 'female'
      },
      {
        id: 'evt_3',
        timestamp: new Date(Date.now() - 1000 * 60 * 25).toISOString(),
        cameraId: 'cam_3',
        cameraName: 'R&D Cleanroom Corridor',
        subjectName: 'Dr. David Chen',
        category: 'authorized',
        confidence: 0.93,
        box: { x_min: 200, y_min: 110, x_max: 450, y_max: 430 },
        snapshotUrl: '/src/assets/images/subject_chen_engineer_1790879373031.jpg',
        age: { low: 30, high: 38 },
        gender: 'male'
      },
      {
        id: 'evt_4',
        timestamp: new Date(Date.now() - 1000 * 60 * 48).toISOString(),
        cameraId: 'cam_1',
        cameraName: 'Gate Alpha - Main Entrance',
        subjectName: 'Unregistered Visitor',
        category: 'unknown',
        confidence: 0.62,
        box: { x_min: 150, y_min: 100, x_max: 380, y_max: 400 },
        age: { low: 25, high: 32 },
        gender: 'male'
      }
    ];

    this.saveToDisk();
  }

  private saveToDisk() {
    try {
      const payload = {
        updatedAt: new Date().toISOString(),
        subjects: this.subjects,
        events: this.events
      };
      fs.writeFileSync(this.jsonDbPath, JSON.stringify(payload, null, 2), 'utf-8');
    } catch (err: any) {
      console.error('[Lookout DB] Error saving to disk:', err.message);
    }
  }

  private async syncFromPostgres() {
    if (!this.pool) return;
    try {
      const resSubs = await this.pool.query('SELECT * FROM subjects ORDER BY enrolled_at DESC');
      if (resSubs.rows.length > 0) {
        this.subjects = resSubs.rows.map(r => ({
          id: r.id,
          name: r.name,
          category: r.category as WatchlistCategory,
          enrolledAt: r.enrolled_at.toISOString(),
          imagePath: r.image_path,
          imageData: r.image_data,
          notes: r.notes,
          matchThreshold: r.match_threshold,
          detectionCount: r.detection_count
        }));
      } else {
        // Seed Postgres from in-memory
        for (const s of this.subjects) {
          await this.pool.query(
            `INSERT INTO subjects (id, name, category, enrolled_at, image_path, image_data, notes, match_threshold, detection_count)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
             ON CONFLICT (name) DO NOTHING`,
            [s.id, s.name, s.category, s.enrolledAt, s.imagePath || '', s.imageData || '', s.notes || '', s.matchThreshold, s.detectionCount]
          );
        }
      }

      const resEvts = await this.pool.query('SELECT * FROM detection_events ORDER BY timestamp DESC LIMIT 200');
      if (resEvts.rows.length > 0) {
        this.events = resEvts.rows.map(r => ({
          id: r.id,
          timestamp: r.timestamp.toISOString(),
          cameraId: r.camera_id,
          cameraName: r.camera_name,
          subjectName: r.subject_name,
          category: r.category as WatchlistCategory,
          confidence: r.confidence,
          box: r.box_json ? JSON.parse(r.box_json) : { x_min: 0, y_min: 0, x_max: 0, y_max: 0 },
          snapshotUrl: r.snapshot_url,
          age: r.age_low ? { low: r.age_low, high: r.age_high } : undefined,
          gender: r.gender
        }));
      }
    } catch (e: any) {
      console.warn('[Lookout DB] Error syncing with Postgres:', e.message);
    }
  }

  // Database Access Methods
  public getSubjects(): SubjectProfile[] {
    return this.subjects;
  }

  public async createSubject(sub: SubjectProfile): Promise<void> {
    this.subjects.unshift(sub);
    this.saveToDisk();

    if (this.pool && this.isPostgresConnected) {
      try {
        await this.pool.query(
          `INSERT INTO subjects (id, name, category, enrolled_at, image_path, image_data, notes, match_threshold, detection_count)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [sub.id, sub.name, sub.category, sub.enrolledAt, sub.imagePath || '', sub.imageData || '', sub.notes || '', sub.matchThreshold, sub.detectionCount]
        );
      } catch (err: any) {
        console.error('[Lookout DB] Postgres insert error:', err.message);
      }
    }
  }

  public async updateSubject(name: string, data: { name?: string; category?: WatchlistCategory; notes?: string }): Promise<void> {
    const target = this.subjects.find(s => s.name === name || s.id === name);
    if (!target) return;

    if (data.name) target.name = data.name;
    if (data.category) target.category = data.category;
    if (data.notes !== undefined) target.notes = data.notes;

    this.saveToDisk();

    if (this.pool && this.isPostgresConnected) {
      try {
        await this.pool.query(
          `UPDATE subjects SET category = COALESCE($1, category), notes = COALESCE($2, notes), name = COALESCE($3, name) WHERE name = $4`,
          [data.category || null, data.notes !== undefined ? data.notes : null, data.name || null, name]
        );
      } catch (err: any) {
        console.error('[Lookout DB] Postgres update error:', err.message);
      }
    }
  }

  public async deleteSubject(name: string): Promise<void> {
    const targetName = name.trim().toLowerCase();
    this.subjects = this.subjects.filter(s => s.name.trim().toLowerCase() !== targetName && s.id !== name);
    this.saveToDisk();

    if (this.pool && this.isPostgresConnected) {
      try {
        await this.pool.query(`DELETE FROM subjects WHERE LOWER(name) = $1 OR id = $2`, [targetName, name]);
      } catch (err: any) {
        console.error('[Lookout DB] Postgres delete error:', err.message);
      }
    }
  }

  public async deleteSubjectFace(name: string): Promise<void> {
    const target = this.subjects.find(s => s.name.toLowerCase() === name.toLowerCase() || s.id === name);
    if (!target) return;
    target.imagePath = '';
    target.imageData = '';
    target.descriptor = undefined;
    this.saveToDisk();

    if (this.pool && this.isPostgresConnected) {
      try {
        await this.pool.query(
          `UPDATE subjects SET image_path = '', image_data = '' WHERE LOWER(name) = LOWER($1) OR id = $1`,
          [name]
        );
      } catch (err: any) {
        console.error('[Lookout DB] Postgres deleteSubjectFace error:', err.message);
      }
    }
  }

  public async deleteEvent(id: string): Promise<void> {
    this.events = this.events.filter(e => e.id !== id);
    this.saveToDisk();

    if (this.pool && this.isPostgresConnected) {
      try {
        await this.pool.query(`DELETE FROM detection_events WHERE id = $1`, [id]);
      } catch (err: any) {
        console.error('[Lookout DB] Postgres deleteEvent error:', err.message);
      }
    }
  }

  public getEvents(limit = 100): DetectionEvent[] {
    return this.events.slice(0, limit);
  }

  public async addEvent(evt: DetectionEvent): Promise<void> {
    // Ensure no duplicate IDs in memory
    this.events = this.events.filter(e => e.id !== evt.id);
    this.events.unshift(evt);
    if (this.events.length > 500) {
      this.events.pop();
    }
    this.saveToDisk();

    // Increment subject detection count
    const targetSub = this.subjects.find(s => s.name.toLowerCase() === evt.subjectName.toLowerCase());
    if (targetSub) {
      targetSub.detectionCount += 1;
    }

    if (this.pool && this.isPostgresConnected) {
      try {
        await this.pool.query(
          `INSERT INTO detection_events (id, timestamp, camera_id, camera_name, subject_name, category, confidence, box_json, snapshot_url, age_low, age_high, gender)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
          [
            evt.id,
            evt.timestamp,
            evt.cameraId,
            evt.cameraName,
            evt.subjectName,
            evt.category,
            evt.confidence,
            JSON.stringify(evt.box),
            evt.snapshotUrl || '',
            evt.age?.low || null,
            evt.age?.high || null,
            evt.gender || null
          ]
        );

        if (targetSub) {
          await this.pool.query(
            `UPDATE subjects SET detection_count = detection_count + 1 WHERE name = $1`,
            [targetSub.name]
          );
        }
      } catch (err: any) {
        console.error('[Lookout DB] Postgres addEvent error:', err.message);
      }
    }
  }

  public async clearEvents(): Promise<void> {
    this.events = [];
    this.saveToDisk();

    if (this.pool && this.isPostgresConnected) {
      try {
        await this.pool.query(`TRUNCATE TABLE detection_events`);
      } catch (err: any) {
        console.error('[Lookout DB] Postgres truncate error:', err.message);
      }
    }
  }

  // Query User History (Core requirement: "Ensure the Lookout app can query this database for user history.")
  public async getSubjectHistory(subjectName: string): Promise<SubjectHistorySummary | null> {
    const sub = this.subjects.find(s => s.name.toLowerCase() === subjectName.toLowerCase());
    const historyEvents = this.events.filter(e => e.subjectName.toLowerCase() === subjectName.toLowerCase());

    const totalDetections = historyEvents.length || sub?.detectionCount || 0;
    const firstSeen = historyEvents.length > 0 ? historyEvents[historyEvents.length - 1].timestamp : sub?.enrolledAt || null;
    const lastSeen = historyEvents.length > 0 ? historyEvents[0].timestamp : sub?.enrolledAt || null;

    // Location breakdown
    const locMap: Record<string, number> = {};
    let totalConf = 0;
    historyEvents.forEach(e => {
      locMap[e.cameraName] = (locMap[e.cameraName] || 0) + 1;
      totalConf += e.confidence;
    });

    const locationsVisited = Object.entries(locMap)
      .map(([cameraName, count]) => ({ cameraName, count }))
      .sort((a, b) => b.count - a.count);

    const averageConfidence = historyEvents.length > 0 ? totalConf / historyEvents.length : sub?.matchThreshold || 0.85;

    return {
      subjectName,
      category: sub?.category || 'unknown',
      totalDetections,
      firstSeen,
      lastSeen,
      locationsVisited,
      averageConfidence,
      recentEvents: historyEvents.slice(0, 50)
    };
  }

  public getDatabaseInfo() {
    return {
      type: this.isPostgresConnected ? 'PostgreSQL 15 (Docker / Remote)' : 'Persistent Disk Store (lookout_db.json)',
      connected: true,
      tables: ['subjects', 'detection_events'],
      totalSubjects: this.subjects.length,
      totalEvents: this.events.length,
      isPostgres: this.isPostgresConnected
    };
  }
}

export const db = new DatabaseManager();
