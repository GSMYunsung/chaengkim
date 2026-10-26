import { getDatabase } from './database';
import type { Item, Place, DepartureSchedule, Session, Stay, LeaveLog } from '../types';

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

// ── Items ──────────────────────────────────────────────
export async function getItems(): Promise<Item[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<any>('SELECT * FROM items ORDER BY createdAt ASC');
  return rows.map(r => ({ ...r, isDefault: !!r.isDefault }));
}

export async function upsertItem(item: Omit<Item, 'id' | 'createdAt'> & { id?: string }): Promise<Item> {
  const db = await getDatabase();
  const id = item.id ?? generateId();
  const now = Date.now();
  await db.runAsync(
    'INSERT OR REPLACE INTO items (id, name, price, isDefault, createdAt) VALUES (?, ?, ?, ?, ?)',
    [id, item.name, item.price, item.isDefault ? 1 : 0, now]
  );
  return { id, name: item.name, price: item.price, isDefault: item.isDefault, createdAt: now };
}

export async function deleteItem(id: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM items WHERE id = ?', [id]);
}

// ── Places ─────────────────────────────────────────────
export async function getPlaces(): Promise<Place[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<any>('SELECT * FROM places ORDER BY createdAt ASC');
  return rows.map(r => ({ ...r, extraItemIds: JSON.parse(r.extraItemIds) }));
}

export async function getHomePlace(): Promise<Place | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<any>("SELECT * FROM places WHERE kind = 'home' LIMIT 1");
  if (!row) return null;
  return { ...row, extraItemIds: JSON.parse(row.extraItemIds) };
}

export async function upsertPlace(place: Omit<Place, 'id' | 'createdAt'> & { id?: string }): Promise<Place> {
  const db = await getDatabase();
  const id = place.id ?? generateId();
  const now = Date.now();
  await db.runAsync(
    'INSERT OR REPLACE INTO places (id, name, lat, lng, radiusM, kind, extraItemIds, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [id, place.name, place.lat, place.lng, place.radiusM, place.kind, JSON.stringify(place.extraItemIds), now]
  );
  return { ...place, id, createdAt: now };
}

// ── Departure Schedules ────────────────────────────────
export async function getSchedules(): Promise<DepartureSchedule[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<any>('SELECT * FROM departure_schedules ORDER BY weekday ASC, time ASC');
  return rows.map(r => ({ ...r, enabled: !!r.enabled }));
}

export async function upsertSchedule(s: Omit<DepartureSchedule, 'id'> & { id?: string }): Promise<DepartureSchedule> {
  const db = await getDatabase();
  const id = s.id ?? generateId();
  await db.runAsync(
    'INSERT OR REPLACE INTO departure_schedules (id, weekday, time, enabled) VALUES (?, ?, ?, ?)',
    [id, s.weekday, s.time, s.enabled ? 1 : 0]
  );
  return { id, weekday: s.weekday, time: s.time, enabled: s.enabled };
}

export async function deleteSchedule(id: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM departure_schedules WHERE id = ?', [id]);
}

// ── Sessions ───────────────────────────────────────────
export async function getActiveSession(): Promise<Session | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<any>(
    'SELECT * FROM sessions WHERE endedAt IS NULL ORDER BY startedAt DESC LIMIT 1'
  );
  if (!row) return null;
  return { ...row, itemIds: JSON.parse(row.itemIds) };
}

export async function createSession(trigger: Session['trigger'], itemIds: string[]): Promise<Session> {
  const db = await getDatabase();
  const id = generateId();
  const now = Date.now();
  await db.runAsync(
    'INSERT INTO sessions (id, startedAt, trigger, itemIds) VALUES (?, ?, ?, ?)',
    [id, now, trigger, JSON.stringify(itemIds)]
  );
  return { id, startedAt: now, trigger, itemIds };
}

export async function endSession(id: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('UPDATE sessions SET endedAt = ? WHERE id = ?', [Date.now(), id]);
}

export async function getSession(id: string): Promise<Session | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<any>('SELECT * FROM sessions WHERE id = ?', [id]);
  if (!row) return null;
  return { ...row, itemIds: JSON.parse(row.itemIds) };
}

export async function getRecentSessions(limit = 10): Promise<Session[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<any>(
    'SELECT * FROM sessions ORDER BY startedAt DESC LIMIT ?',
    [limit]
  );
  return rows.map(r => ({ ...r, itemIds: JSON.parse(r.itemIds) }));
}

// ── Stays ──────────────────────────────────────────────
export async function createStay(sessionId: string, lat: number, lng: number): Promise<Stay> {
  const db = await getDatabase();
  const id = generateId();
  const now = Date.now();
  await db.runAsync(
    'INSERT INTO stays (id, sessionId, anchorLat, anchorLng, arrivedAt) VALUES (?, ?, ?, ?, ?)',
    [id, sessionId, lat, lng, now]
  );
  return { id, sessionId, anchorLat: lat, anchorLng: lng, arrivedAt: now };
}

export async function updateStayLeft(id: string, placeId?: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    'UPDATE stays SET leftAt = ?, placeId = ? WHERE id = ?',
    [Date.now(), placeId ?? null, id]
  );
}

export async function getActiveStay(sessionId: string): Promise<Stay | null> {
  const db = await getDatabase();
  return db.getFirstAsync<Stay>(
    'SELECT * FROM stays WHERE sessionId = ? AND leftAt IS NULL ORDER BY arrivedAt DESC LIMIT 1',
    [sessionId]
  );
}

export async function getStaysForSession(sessionId: string): Promise<Stay[]> {
  const db = await getDatabase();
  return db.getAllAsync<Stay>(
    'SELECT * FROM stays WHERE sessionId = ? ORDER BY arrivedAt ASC',
    [sessionId]
  );
}

// ── LeaveLogs ──────────────────────────────────────────
export async function createLeaveLog(log: Omit<LeaveLog, 'id'>): Promise<LeaveLog> {
  const db = await getDatabase();
  const id = generateId();
  await db.runAsync(
    `INSERT INTO leave_logs
      (id, stayId, dwellMin, signalAAt, signalBAt, notifiedBy, notifiedAt, distanceFromAnchorM, recoveredItemIds)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id, log.stayId, log.dwellMin,
      log.signalAAt ?? null, log.signalBAt ?? null,
      log.notifiedBy, log.notifiedAt, log.distanceFromAnchorM,
      JSON.stringify(log.recoveredItemIds),
    ]
  );
  return { ...log, id };
}

export async function updateLeaveLogResponse(
  id: string,
  delay: LeaveLog['userReportedDelay'],
  action: LeaveLog['action'],
  recoveredItemIds: string[]
): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    'UPDATE leave_logs SET userReportedDelay = ?, action = ?, recoveredItemIds = ? WHERE id = ?',
    [delay ?? null, action ?? null, JSON.stringify(recoveredItemIds), id]
  );
}

export async function getLeaveLogsForSession(sessionId: string): Promise<LeaveLog[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<any>(
    `SELECT ll.* FROM leave_logs ll
     JOIN stays s ON ll.stayId = s.id
     WHERE s.sessionId = ?
     ORDER BY ll.notifiedAt ASC`,
    [sessionId]
  );
  return rows.map(r => ({ ...r, recoveredItemIds: JSON.parse(r.recoveredItemIds) }));
}

export async function getAllLeaveLogs(): Promise<LeaveLog[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<any>('SELECT * FROM leave_logs ORDER BY notifiedAt ASC');
  return rows.map(r => ({ ...r, recoveredItemIds: JSON.parse(r.recoveredItemIds) }));
}

export async function getLeaveLogByStayId(stayId: string): Promise<LeaveLog | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<any>('SELECT * FROM leave_logs WHERE stayId = ?', [stayId]);
  if (!row) return null;
  return { ...row, recoveredItemIds: JSON.parse(row.recoveredItemIds) };
}

// ── App State ──────────────────────────────────────────
export async function getAppStateValue(key: string): Promise<string | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ value: string }>(
    'SELECT value FROM app_state WHERE key = ?',
    [key]
  );
  return row?.value ?? null;
}

export async function setAppStateValue(key: string, value: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    'INSERT OR REPLACE INTO app_state (key, value) VALUES (?, ?)',
    [key, value]
  );
}

// ── Dwell threshold ────────────────────────────────────
export const DWELL_OPTIONS = [10, 15, 30, 60] as const;

export async function getDwellThresholdMin(): Promise<number> {
  const v = parseInt((await getAppStateValue('dwellMin')) ?? '', 10);
  return DWELL_OPTIONS.includes(v as any) ? v : 15;
}

export async function getStay(id: string): Promise<Stay | null> {
  const db = await getDatabase();
  return db.getFirstAsync<Stay>('SELECT * FROM stays WHERE id = ?', [id]);
}

// Every item of a finished outing that triggered a leave check counts as kept,
// limited to outings started since `since`.
export async function getSavedItemsCountSince(since: number): Promise<number> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{ itemIds: string }>(
    `SELECT s.itemIds FROM sessions s
     WHERE s.endedAt IS NOT NULL
       AND s.startedAt >= ?
       AND EXISTS (
         SELECT 1 FROM stays st
         JOIN leave_logs ll ON ll.stayId = st.id
         WHERE st.sessionId = s.id
       )`,
    [since]
  );
  return rows.reduce((sum, r) => sum + JSON.parse(r.itemIds).length, 0);
}

export async function getStaysSince(since: number): Promise<Stay[]> {
  const db = await getDatabase();
  return db.getAllAsync<Stay>(
    'SELECT * FROM stays WHERE arrivedAt >= ? ORDER BY arrivedAt ASC',
    [since]
  );
}

// Records when the slower of the two leave signals arrived. Only the first arrival is kept,
// so repeated location updates can't push the timestamp later.
export async function recordLateSignal(stayId: string, signal: 'A' | 'B', at: number): Promise<void> {
  const db = await getDatabase();
  const column = signal === 'A' ? 'signalAAt' : 'signalBAt';
  await db.runAsync(`UPDATE leave_logs SET ${column} = ? WHERE stayId = ? AND ${column} IS NULL`, [at, stayId]);
}
