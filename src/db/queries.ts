import { getDatabase } from './database';
import { startOfMonth } from '../utils/format';
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
  return toSession(row);
}

function toSession(row: any): Session {
  return {
    ...row,
    itemIds: JSON.parse(row.itemIds),
    returnedItemIds: row.returnedItemIds ? JSON.parse(row.returnedItemIds) : null,
  };
}

export async function setSessionReturnedItems(id: string, itemIds: string[]): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('UPDATE sessions SET returnedItemIds = ? WHERE id = ?', [JSON.stringify(itemIds), id]);
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
  return toSession(row);
}

/** Every outing that started at or after `since` (the history keeps the current month), newest first. */
export async function getSessionsSince(since: number): Promise<Session[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<any>(
    'SELECT * FROM sessions WHERE startedAt >= ? ORDER BY startedAt DESC',
    [since]
  );
  return rows.map(toSession);
}

/**
 * Deletes finished outings that started before `before` (start of the current month by default),
 * along with their stays, leave logs and return-notification markers. The outing in progress is
 * never touched.
 */
export async function pruneOldRecords(before = startOfMonth()): Promise<void> {
  const db = await getDatabase();
  const old = 'SELECT id FROM sessions WHERE endedAt IS NOT NULL AND startedAt < ?';
  let outings = 0;
  let names = 0;
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `DELETE FROM leave_logs WHERE stayId IN (SELECT id FROM stays WHERE sessionId IN (${old}))`, [before]);
    await db.runAsync(`DELETE FROM stays WHERE sessionId IN (${old})`, [before]);
    await db.runAsync(
      `DELETE FROM app_state WHERE key LIKE 'returnNotified_%' AND substr(key, 16) IN (${old})`, [before]);
    outings = (await db.runAsync(`DELETE FROM sessions WHERE id IN (${old})`, [before])).changes;
    // Looked-up place names are keyed by visited coordinates, so they are location history too:
    // keep only those the remaining stays still use. Key format matches placeLookup (4 decimals).
    names = (await db.runAsync(
      `DELETE FROM app_state WHERE key LIKE 'poi:%'
         AND key NOT IN (SELECT printf('poi:%.4f,%.4f', anchorLat, anchorLng) FROM stays)`,
    )).changes;
  });
  if (__DEV__ && (outings || names)) console.log(`[기록 정리] 외출 ${outings}건, 장소 이름 캐시 ${names}개 삭제`);
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

export async function setStayCustomName(id: string, name: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('UPDATE stays SET customName = ? WHERE id = ?', [name, id]);
}

export async function setStayPlace(id: string, placeId: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('UPDATE stays SET placeId = ? WHERE id = ?', [placeId, id]);
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

/** Test-lab only: forgets looked-up place names (`poi:` cache) so the next lookups hit the network. */
export async function clearPlaceNameCache(): Promise<number> {
  const db = await getDatabase();
  const res = await db.runAsync("DELETE FROM app_state WHERE key LIKE 'poi:%'");
  return res.changes;
}

// ── Streak ─────────────────────────────────────────────
// Outings in a row that ended with every item home. Kept as a counter so pruning history
// never changes it.
export async function getReturnStreak(): Promise<number> {
  return Number(await getAppStateValue('returnStreak')) || 0;
}

/** Bumps the streak when everything came home, otherwise resets it. Returns the new value. */
export async function recordReturnStreak(allHome: boolean): Promise<number> {
  const next = allHome ? (await getReturnStreak()) + 1 : 0;
  await setAppStateValue('returnStreak', String(next));
  return next;
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
