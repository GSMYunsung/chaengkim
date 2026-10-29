import * as SQLite from 'expo-sqlite';

// One shared open+migrate. The UI and background location tasks can ask at the same moment;
// sharing the promise keeps the schema setup (and its ALTER TABLEs) from running twice.
let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

export function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = (async () => {
      const db = await SQLite.openDatabaseAsync('chaengkim.db');
      await initSchema(db);
      return db;
    })();
    // A failed setup shouldn't stick; the next caller retries.
    dbPromise.catch(() => { dbPromise = null; });
  }
  return dbPromise;
}

async function initSchema(database: SQLite.SQLiteDatabase) {
  await database.execAsync(`
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS items (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      isDefault INTEGER NOT NULL DEFAULT 0,
      createdAt INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS places (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      lat REAL NOT NULL,
      lng REAL NOT NULL,
      radiusM INTEGER NOT NULL DEFAULT 150,
      kind TEXT NOT NULL DEFAULT 'saved',
      extraItemIds TEXT NOT NULL DEFAULT '[]',
      createdAt INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS departure_schedules (
      id TEXT PRIMARY KEY,
      weekday INTEGER NOT NULL,
      time TEXT NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      startedAt INTEGER NOT NULL,
      endedAt INTEGER,
      trigger TEXT NOT NULL DEFAULT 'manual',
      itemIds TEXT NOT NULL DEFAULT '[]'
    );

    CREATE TABLE IF NOT EXISTS stays (
      id TEXT PRIMARY KEY,
      sessionId TEXT NOT NULL,
      anchorLat REAL NOT NULL,
      anchorLng REAL NOT NULL,
      arrivedAt INTEGER NOT NULL,
      leftAt INTEGER,
      placeId TEXT
    );

    CREATE TABLE IF NOT EXISTS leave_logs (
      id TEXT PRIMARY KEY,
      stayId TEXT NOT NULL,
      dwellMin REAL NOT NULL,
      signalAAt INTEGER,
      signalBAt INTEGER,
      notifiedBy TEXT NOT NULL,
      notifiedAt INTEGER NOT NULL,
      distanceFromAnchorM REAL NOT NULL,
      userReportedDelay TEXT,
      action TEXT,
      recoveredItemIds TEXT NOT NULL DEFAULT '[]'
    );

    CREATE TABLE IF NOT EXISTS app_state (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  // Removed after release: items had a price the app never used. Drop it from older databases.
  const itemCols = await database.getAllAsync<{ name: string }>('PRAGMA table_info(items)');
  if (itemCols.some(c => c.name === 'price')) {
    await database.execAsync('ALTER TABLE items DROP COLUMN price');
  }
  // Added after release: a name the user typed for one stay. Older databases get the column here.
  const stayCols = await database.getAllAsync<{ name: string }>('PRAGMA table_info(stays)');
  if (!stayCols.some(c => c.name === 'customName')) {
    await database.execAsync('ALTER TABLE stays ADD COLUMN customName TEXT');
  }
  // Added after release: items confirmed at the return check (JSON). Null on older outings.
  const sessionCols = await database.getAllAsync<{ name: string }>('PRAGMA table_info(sessions)');
  if (!sessionCols.some(c => c.name === 'returnedItemIds')) {
    await database.execAsync('ALTER TABLE sessions ADD COLUMN returnedItemIds TEXT');
  }

  // Kakao Local results may not be stored, so drop shop names cached by earlier versions.
  // Entries starting with "~" are Apple-address "no shop here" markers and stay.
  await database.runAsync("DELETE FROM app_state WHERE key LIKE 'poi:%' AND substr(value, 1, 1) <> '~'");

  // No starter items: onboarding asks for the user's own items, so the bag starts empty.
}
