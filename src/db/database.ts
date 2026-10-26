import * as SQLite from 'expo-sqlite';

let db: SQLite.SQLiteDatabase | null = null;

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (db) return db;
  db = await SQLite.openDatabaseAsync('chaengkim.db');
  await initSchema(db);
  return db;
}

async function initSchema(database: SQLite.SQLiteDatabase) {
  await database.execAsync(`
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS items (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      price INTEGER NOT NULL DEFAULT 0,
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

  const count = await database.getFirstAsync<{ c: number }>('SELECT COUNT(*) as c FROM items');
  if (count && count.c === 0) {
    const now = Date.now();
    await database.runAsync(
      'INSERT INTO items (id, name, price, isDefault, createdAt) VALUES (?, ?, ?, ?, ?)',
      ['item-wallet', '지갑', 100000, 1, now]
    );
    await database.runAsync(
      'INSERT INTO items (id, name, price, isDefault, createdAt) VALUES (?, ?, ?, ?, ?)',
      ['item-keys', '열쇠', 50000, 1, now]
    );
    await database.runAsync(
      'INSERT INTO items (id, name, price, isDefault, createdAt) VALUES (?, ?, ?, ?, ?)',
      ['item-airpods', '에어팟', 300000, 1, now]
    );
    await database.runAsync(
      'INSERT INTO items (id, name, price, isDefault, createdAt) VALUES (?, ?, ?, ?, ?)',
      ['item-charger', '충전기', 39000, 0, now]
    );
  }
}
