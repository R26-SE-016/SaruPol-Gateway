import { Firestore } from '@google-cloud/firestore';
import sqlite3 from 'sqlite3';
import path from 'path';

// ── Google Cloud Firestore Initialization ─────────────────────────────
const PROJECT_ID = process.env.GCP_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT || 'saru-pol';
let firestore: Firestore | null = null;

try {
  firestore = new Firestore({
    projectId: PROJECT_ID,
    ignoreUndefinedProperties: true,
  });
  console.log(`[Firestore] Connected to Google Cloud Firestore (Project: ${PROJECT_ID})`);
} catch (e: any) {
  console.warn(`[Firestore] Initialisation warning: ${e.message}. Using SQLite fallback.`);
}

// ── SQLite Fallback Datastore ──────────────────────────────────────────
const dbPath = path.resolve(__dirname, '../../database.sqlite');
const sqliteDb = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error connecting to SQLite database:', err.message);
  } else {
    initializeSqlite();
  }
});

function initializeSqlite() {
  sqliteDb.serialize(() => {
    sqliteDb.run(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        role TEXT DEFAULT 'user',
        estate_id TEXT,
        phone TEXT,
        district TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    sqliteDb.run(`
      CREATE TABLE IF NOT EXISTS user_telemetry (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        feature TEXT NOT NULL,
        record_id TEXT NOT NULL,
        payload TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, feature, record_id) ON CONFLICT REPLACE
      )
    `);
  });
}

// ── User Management Abstractions (Firestore with SQLite Fallback) ───────

export interface UserRecord {
  id: string;
  name: string;
  email: string;
  password?: string;
  role: string;
  estate_id?: string;
  phone?: string;
  district?: string;
  created_at: string;
}

export async function findUserByEmail(email: string): Promise<UserRecord | null> {
  const cleanEmail = email.trim().toLowerCase();

  // 1. Try Firestore
  if (firestore) {
    try {
      const snapshot = await firestore
        .collection('users')
        .where('email', '==', cleanEmail)
        .limit(1)
        .get();

      if (!snapshot.empty) {
        const doc = snapshot.docs[0];
        const data = doc.data();
        return {
          id: doc.id,
          name: data.name,
          email: data.email,
          password: data.password,
          role: data.role || 'user',
          estate_id: data.estate_id,
          phone: data.phone,
          district: data.district,
          created_at: data.created_at || new Date().toISOString(),
        };
      }
    } catch (e: any) {
      console.warn(`[Firestore] findUserByEmail failed (${e.message}), querying SQLite.`);
    }
  }

  // 2. Fallback to SQLite
  return new Promise((resolve) => {
    sqliteDb.get(
      `SELECT * FROM users WHERE LOWER(email) = ?`,
      [cleanEmail],
      (err, row: any) => {
        if (err || !row) return resolve(null);
        resolve({
          id: String(row.id),
          name: row.name,
          email: row.email,
          password: row.password,
          role: row.role || 'user',
          estate_id: row.estate_id,
          phone: row.phone,
          district: row.district,
          created_at: row.created_at,
        });
      }
    );
  });
}

export async function findUserById(id: string): Promise<UserRecord | null> {
  const cleanId = String(id);

  // 1. Try Firestore
  if (firestore) {
    try {
      const doc = await firestore.collection('users').doc(cleanId).get();
      if (doc.exists) {
        const data = doc.data()!;
        return {
          id: doc.id,
          name: data.name,
          email: data.email,
          role: data.role || 'user',
          estate_id: data.estate_id,
          phone: data.phone,
          district: data.district,
          created_at: data.created_at || new Date().toISOString(),
        };
      }
    } catch (e: any) {
      console.warn(`[Firestore] findUserById failed (${e.message}), querying SQLite.`);
    }
  }

  // 2. Fallback to SQLite
  return new Promise((resolve) => {
    sqliteDb.get(
      `SELECT id, name, email, role, estate_id, phone, district, created_at FROM users WHERE id = ?`,
      [cleanId],
      (err, row: any) => {
        if (err || !row) return resolve(null);
        resolve({
          id: String(row.id),
          name: row.name,
          email: row.email,
          role: row.role || 'user',
          estate_id: row.estate_id,
          phone: row.phone,
          district: row.district,
          created_at: row.created_at,
        });
      }
    );
  });
}

export async function createUser(data: {
  name: string;
  email: string;
  password: string;
  role?: string;
  estate_id?: string;
  phone?: string;
  district?: string;
}): Promise<UserRecord> {
  const cleanEmail = data.email.trim().toLowerCase();
  const id = `usr_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`;
  const now = new Date().toISOString();

  const userRecord: UserRecord = {
    id,
    name: data.name.trim(),
    email: cleanEmail,
    password: data.password,
    role: data.role || 'user',
    estate_id: data.estate_id,
    phone: data.phone,
    district: data.district,
    created_at: now,
  };

  // 1. Persist to Firestore
  if (firestore) {
    try {
      await firestore.collection('users').doc(id).set({
        id,
        name: userRecord.name,
        email: userRecord.email,
        password: userRecord.password,
        role: userRecord.role,
        estate_id: userRecord.estate_id || null,
        phone: userRecord.phone || null,
        district: userRecord.district || null,
        created_at: now,
      });
      console.log(`[Firestore] User created successfully: ${userRecord.email} (${id})`);
    } catch (e: any) {
      console.warn(`[Firestore] createUser failed (${e.message}), persisting to SQLite.`);
    }
  }

  // 2. Also persist to SQLite (for local caching & fallback)
  sqliteDb.run(
    `INSERT OR REPLACE INTO users (id, name, email, password, role, estate_id, phone, district, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      userRecord.name,
      userRecord.email,
      userRecord.password,
      userRecord.role,
      userRecord.estate_id || null,
      userRecord.phone || null,
      userRecord.district || null,
      now,
    ]
  );

  return userRecord;
}

// ── Telemetry & Multi-Device Sync Abstractions ─────────────────────────

export async function saveTelemetryRecord(
  userId: string,
  feature: 'pathology' | 'advisory' | 'soil',
  recordId: string,
  payload: any
): Promise<void> {
  const cleanUserId = String(userId);
  const now = new Date().toISOString();
  const docId = `${feature}_${cleanUserId}_${recordId}`.replace(/[\/\s#?]/g, '_');

  // 1. Persist to Firestore
  if (firestore) {
    try {
      await firestore.collection('user_telemetry').doc(docId).set({
        user_id: cleanUserId,
        feature,
        record_id: recordId,
        payload: payload,
        created_at: now,
      });
    } catch (e: any) {
      console.warn(`[Firestore] saveTelemetryRecord failed: ${e.message}`);
    }
  }

  // 2. Also persist to SQLite
  sqliteDb.run(
    `INSERT OR REPLACE INTO user_telemetry (user_id, feature, record_id, payload) VALUES (?, ?, ?, ?)`,
    [cleanUserId, feature, recordId, JSON.stringify(payload)],
    (err) => {
      if (err) console.error('[SQLite Telemetry] Insert error:', err.message);
    }
  );
}

export async function getTelemetryRecords(
  userId: string,
  feature: 'pathology' | 'advisory' | 'soil',
  limit: number = 50
): Promise<any[]> {
  const cleanUserId = String(userId);

  // 1. Try Firestore
  if (firestore) {
    try {
      const snapshot = await firestore
        .collection('user_telemetry')
        .where('user_id', '==', cleanUserId)
        .where('feature', '==', feature)
        .limit(limit)
        .get();

      if (!snapshot.empty) {
        const records = snapshot.docs.map((d) => d.data().payload).filter(Boolean);
        if (records.length > 0) return records;
      }
    } catch (e: any) {
      console.warn(`[Firestore] getTelemetryRecords failed (${e.message}), querying SQLite.`);
    }
  }

  // 2. Fallback to SQLite
  return new Promise((resolve) => {
    sqliteDb.all(
      `SELECT payload FROM user_telemetry WHERE user_id = ? AND feature = ? ORDER BY created_at DESC LIMIT ?`,
      [cleanUserId, feature, limit],
      (err, rows) => {
        if (err || !rows) return resolve([]);
        const records = rows
          .map((r: any) => {
            try {
              return JSON.parse(r.payload);
            } catch {
              return null;
            }
          })
          .filter(Boolean);
        resolve(records);
      }
    );
  });
}

export default sqliteDb;
