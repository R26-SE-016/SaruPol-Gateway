import { Firestore } from '@google-cloud/firestore';

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
  console.warn(`[Firestore] Initialisation warning: ${e.message}. Using in-memory fallback.`);
}

// ── In-Memory Datastore Fallback (Zero Native Dependencies) ─────────────
// Used for local offline development when Google Cloud credentials are unavailable
const inMemoryUsers = new Map<string, UserRecord>();
const inMemoryTelemetry: Array<{
  userId: string;
  feature: 'pathology' | 'advisory' | 'soil';
  recordId: string;
  payload: any;
  createdAt: string;
}> = [];

// ── User Management Abstractions (Firestore with In-Memory Fallback) ───

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
      return null;
    } catch (e: any) {
      console.warn(`[Firestore] findUserByEmail failed (${e.message}), querying local cache.`);
    }
  }

  // 2. Fallback to In-Memory Store
  for (const user of inMemoryUsers.values()) {
    if (user.email.toLowerCase() === cleanEmail) {
      return { ...user };
    }
  }
  return null;
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
      return null;
    } catch (e: any) {
      console.warn(`[Firestore] findUserById failed (${e.message}), querying local cache.`);
    }
  }

  // 2. Fallback to In-Memory Store
  const user = inMemoryUsers.get(cleanId);
  return user ? { ...user } : null;
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
      console.warn(`[Firestore] createUser failed (${e.message}), retaining in local memory.`);
    }
  }

  // 2. Cache in In-Memory Store
  inMemoryUsers.set(id, userRecord);

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

  // 2. Cache in In-Memory Store
  const existingIdx = inMemoryTelemetry.findIndex(
    (t) => t.userId === cleanUserId && t.feature === feature && t.recordId === recordId
  );
  if (existingIdx >= 0) {
    inMemoryTelemetry[existingIdx] = { userId: cleanUserId, feature, recordId, payload, createdAt: now };
  } else {
    inMemoryTelemetry.push({ userId: cleanUserId, feature, recordId, payload, createdAt: now });
  }
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
      console.warn(`[Firestore] getTelemetryRecords failed (${e.message}), querying local cache.`);
    }
  }

  // 2. Fallback to In-Memory Store
  return inMemoryTelemetry
    .filter((t) => t.userId === cleanUserId && t.feature === feature)
    .slice(-limit)
    .reverse()
    .map((t) => t.payload);
}

export default {
  firestore,
  findUserByEmail,
  findUserById,
  createUser,
  saveTelemetryRecord,
  getTelemetryRecords,
};
