const DB_KEY = 'zfl-2-database';
const DB_VERSION = 3;

const TABLES = {
  costumes: 'costumes',
  records: 'records',
  reservations: 'reservations',
  workOrders: 'workOrders',
  actors: 'actors',
  packingLists: 'packingLists',
  schedules: 'schedules'
};

const LEGACY_KEYS = {
  [TABLES.costumes]: 'zfl-2-costumes',
  [TABLES.records]: 'zfl-2-records',
  [TABLES.reservations]: 'zfl-2-reservations',
  [TABLES.workOrders]: 'zfl-2-work-orders',
  [TABLES.actors]: 'zfl-2-actors',
  [TABLES.packingLists]: 'zfl-2-packing-lists'
};

function createEmptyDatabase() {
  return {
    version: DB_VERSION,
    migratedAt: null,
    tables: {
      [TABLES.costumes]: [],
      [TABLES.records]: [],
      [TABLES.reservations]: [],
      [TABLES.workOrders]: [],
      [TABLES.actors]: [],
      [TABLES.packingLists]: [],
      [TABLES.schedules]: []
    }
  };
}

function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function safeReadJSON(key) {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null || raw === undefined) return null;
    return JSON.parse(raw);
  } catch (e) {
    console.warn(`[DB] Failed to parse key "${key}":`, e);
    return null;
  }
}

function safeWriteJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (e) {
    console.error(`[DB] Failed to write key "${key}":`, e);
    return false;
  }
}

function readRawDB() {
  return safeReadJSON(DB_KEY);
}

function writeRawDB(db) {
  return safeWriteJSON(DB_KEY, db);
}

function hasLegacyData() {
  for (const key of Object.values(LEGACY_KEYS)) {
    if (localStorage.getItem(key) !== null) return true;
  }
  return false;
}

function readAllLegacyData() {
  const result = {};
  for (const [table, legacyKey] of Object.entries(LEGACY_KEYS)) {
    const data = safeReadJSON(legacyKey);
    result[table] = Array.isArray(data) ? data : [];
  }
  return result;
}

function migrateFromLegacy() {
  const db = createEmptyDatabase();
  const legacy = readAllLegacyData();
  db.tables = {
    [TABLES.costumes]: legacy[TABLES.costumes] || [],
    [TABLES.records]: legacy[TABLES.records] || [],
    [TABLES.reservations]: legacy[TABLES.reservations] || [],
    [TABLES.workOrders]: legacy[TABLES.workOrders] || [],
    [TABLES.actors]: legacy[TABLES.actors] || [],
    [TABLES.packingLists]: legacy[TABLES.packingLists] || []
  };
  db.migratedAt = new Date().toISOString();
  return db;
}

function migrate_v1_to_v2(db) {
  if (!db.tables[TABLES.packingLists]) {
    db.tables[TABLES.packingLists] = [];
  }
  return db;
}

function migrate_v2_to_v3(db) {
  if (!db.tables[TABLES.schedules]) {
    db.tables[TABLES.schedules] = [];
  }
  return db;
}

const MIGRATIONS = {
  1: migrate_v1_to_v2,
  2: migrate_v2_to_v3
};

function runMigrations(db) {
  const currentVersion = db.version || 1;
  let migrated = deepClone(db);

  for (let v = currentVersion; v < DB_VERSION; v++) {
    const migration = MIGRATIONS[v];
    if (typeof migration === 'function') {
      try {
        migrated = migration(migrated);
        migrated.version = v + 1;
      } catch (e) {
        console.error(`[DB] Migration to v${v + 1} failed:`, e);
        throw e;
      }
    }
  }

  migrated.version = DB_VERSION;
  return migrated;
}

export function initializeDatabase() {
  const existing = readRawDB();

  if (existing && typeof existing === 'object' && existing.tables) {
    try {
      const migrated = runMigrations(existing);
      if (migrated.version !== existing.version || !existing.migratedAt) {
        migrated.migratedAt = new Date().toISOString();
      }
      writeRawDB(migrated);
      return migrated;
    } catch (e) {
      console.error('[DB] Migration failed, preserving existing data:', e);
      return existing;
    }
  }

  if (hasLegacyData()) {
    try {
      const migrated = migrateFromLegacy();
      writeRawDB(migrated);
      return migrated;
    } catch (e) {
      console.error('[DB] Legacy migration failed, preserving legacy data:', e);
    }
  }

  const fresh = createEmptyDatabase();
  writeRawDB(fresh);
  return fresh;
}

export function getDB() {
  const db = readRawDB();
  if (db && typeof db === 'object' && db.tables) {
    return db;
  }
  return initializeDatabase();
}

export function saveDB(db) {
  return writeRawDB(db);
}

export function getAll(table) {
  const db = getDB();
  return deepClone(db.tables[table] || []);
}

export function setAll(table, data) {
  const db = getDB();
  db.tables[table] = Array.isArray(data) ? deepClone(data) : [];
  saveDB(db);
  return db.tables[table];
}

export function insertOne(table, record) {
  const db = getDB();
  if (!Array.isArray(db.tables[table])) {
    db.tables[table] = [];
  }
  const newRecord = deepClone(record);
  if (!newRecord.id) {
    newRecord.id = crypto.randomUUID();
  }
  db.tables[table].unshift(newRecord);
  saveDB(db);
  return newRecord;
}

export function updateOne(table, id, updates) {
  const db = getDB();
  if (!Array.isArray(db.tables[table])) return null;
  const idx = db.tables[table].findIndex((r) => r.id === id);
  if (idx === -1) return null;
  db.tables[table][idx] = { ...db.tables[table][idx], ...deepClone(updates) };
  saveDB(db);
  return db.tables[table][idx];
}

export function deleteOne(table, id) {
  const db = getDB();
  if (!Array.isArray(db.tables[table])) return false;
  const before = db.tables[table].length;
  db.tables[table] = db.tables[table].filter((r) => r.id !== id);
  if (db.tables[table].length !== before) {
    saveDB(db);
    return true;
  }
  return false;
}

export function findOne(table, id) {
  const db = getDB();
  if (!Array.isArray(db.tables[table])) return null;
  const record = db.tables[table].find((r) => r.id === id);
  return record ? deepClone(record) : null;
}

export function exportFullDatabase() {
  const db = getDB();
  const exportObj = {
    _meta: {
      version: db.version,
      exportedAt: new Date().toISOString(),
      app: 'zfl-2-costume-lending'
    },
    tables: db.tables
  };
  return JSON.stringify(exportObj, null, 2);
}

export function importFullDatabase(jsonString) {
  let data;
  try {
    data = JSON.parse(jsonString);
  } catch (e) {
    return { ok: false, error: 'JSON 解析失败，请检查文件格式' };
  }

  if (!data || typeof data !== 'object') {
    return { ok: false, error: '数据格式不正确' };
  }

  if (!data.tables || typeof data.tables !== 'object') {
    return { ok: false, error: '缺少 tables 字段，无法识别的数据格式' };
  }

  const cleaned = createEmptyDatabase();
  for (const table of Object.values(TABLES)) {
    if (Array.isArray(data.tables[table])) {
      cleaned.tables[table] = data.tables[table];
    }
  }

  if (data._meta?.version && typeof data._meta.version === 'number') {
    cleaned.version = data._meta.version;
  }

  try {
    const migrated = runMigrations(cleaned);
    migrated.migratedAt = new Date().toISOString();
    writeRawDB(migrated);
    return { ok: true, db: migrated };
  } catch (e) {
    return { ok: false, error: `数据迁移失败：${e.message}` };
  }
}

export function downloadBackup() {
  const content = exportFullDatabase();
  const blob = new Blob([content], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const date = new Date().toISOString().slice(0, 10);
  const time = new Date().toISOString().slice(11, 19).replace(/:/g, '-');
  a.download = `zfl-2-backup-${date}-${time}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function readBackupFile(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      resolve(event.target?.result || '');
    };
    reader.onerror = () => {
      resolve('');
    };
    reader.readAsText(file);
  });
}

export function getDBStats() {
  const db = getDB();
  const stats = {};
  for (const table of Object.values(TABLES)) {
    stats[table] = (db.tables[table] || []).length;
  }
  return {
    version: db.version,
    migratedAt: db.migratedAt,
    tables: stats
  };
}

export function isLegacyDataPresent() {
  return hasLegacyData();
}

export function removeLegacyKeys() {
  for (const key of Object.values(LEGACY_KEYS)) {
    localStorage.removeItem(key);
  }
}

export { TABLES, DB_VERSION, DB_KEY };
