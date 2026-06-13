const DB_KEY = 'zfl-2-database';
const DB_VERSION = 7;

const TABLES = {
  costumes: 'costumes',
  records: 'records',
  reservations: 'reservations',
  workOrders: 'workOrders',
  actors: 'actors',
  packingLists: 'packingLists',
  schedules: 'schedules',
  inventoryTasks: 'inventoryTasks',
  inventoryItems: 'inventoryItems',
  riskStatuses: 'riskStatuses',
  syncEvents: 'syncEvents'
};

const TABLE_LABELS = {
  costumes: '服装档案',
  records: '借还记录',
  reservations: '排练预约',
  workOrders: '清洗/维修工单',
  actors: '演员尺码',
  packingLists: '演出装箱单',
  schedules: '演出排期',
  inventoryTasks: '盘点任务',
  inventoryItems: '盘点明细',
  riskStatuses: '风险处理状态',
  syncEvents: '同步事件日志'
};

export const EVENT_TYPES = {
  CREATE: 'create',
  UPDATE: 'update',
  DELETE: 'delete',
  INVENTORY_CHECK: 'inventory_check',
  WORK_ORDER_PROCESS: 'workorder_process',
  PACKING_STATUS: 'packing_status',
  SCHEDULE_CHANGE: 'schedule_change'
};

export const EVENT_TYPE_LABELS = {
  [EVENT_TYPES.CREATE]: '新增',
  [EVENT_TYPES.UPDATE]: '编辑',
  [EVENT_TYPES.DELETE]: '删除',
  [EVENT_TYPES.INVENTORY_CHECK]: '盘点处理',
  [EVENT_TYPES.WORK_ORDER_PROCESS]: '工单处理',
  [EVENT_TYPES.PACKING_STATUS]: '装箱状态更新',
  [EVENT_TYPES.SCHEDULE_CHANGE]: '排期修改'
};

const TRACKED_TABLES = new Set([
  TABLES.costumes,
  TABLES.records,
  TABLES.reservations,
  TABLES.workOrders,
  TABLES.actors,
  TABLES.packingLists,
  TABLES.schedules,
  TABLES.inventoryTasks,
  TABLES.inventoryItems,
  TABLES.riskStatuses
]);

const LEGACY_KEYS = {
  [TABLES.costumes]: 'zfl-2-costumes',
  [TABLES.records]: 'zfl-2-records',
  [TABLES.reservations]: 'zfl-2-reservations',
  [TABLES.workOrders]: 'zfl-2-work-orders',
  [TABLES.actors]: 'zfl-2-actors',
  [TABLES.packingLists]: 'zfl-2-packing-lists'
};

function canUseLocalStorage() {
  return typeof localStorage !== 'undefined';
}

function generateDeviceId() {
  return 'dev-' + crypto.randomUUID().slice(0, 8);
}

function createEmptyDatabase() {
  return {
    version: DB_VERSION,
    migratedAt: null,
    _meta: {
      deviceId: generateDeviceId(),
      lastSyncedAt: null,
      lastMergeAt: null,
      createdAt: new Date().toISOString(),
      syncCounter: 0,
      schemaVersion: 2,
      knownDevices: []
    },
    tables: {
      [TABLES.costumes]: [],
      [TABLES.records]: [],
      [TABLES.reservations]: [],
      [TABLES.workOrders]: [],
      [TABLES.actors]: [],
      [TABLES.packingLists]: [],
      [TABLES.schedules]: [],
      [TABLES.inventoryTasks]: [],
      [TABLES.inventoryItems]: [],
      [TABLES.riskStatuses]: [],
      [TABLES.syncEvents]: []
    }
  };
}

function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function safeReadJSON(key) {
  if (!canUseLocalStorage()) return null;
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
  if (!canUseLocalStorage()) return false;
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
  if (!canUseLocalStorage()) return false;
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

function migrate_v3_to_v4(db) {
  if (!db.tables[TABLES.inventoryTasks]) {
    db.tables[TABLES.inventoryTasks] = [];
  }
  if (!db.tables[TABLES.inventoryItems]) {
    db.tables[TABLES.inventoryItems] = [];
  }
  return db;
}

function migrate_v4_to_v5(db) {
  if (!db._meta) {
    db._meta = {
      deviceId: generateDeviceId(),
      lastSyncedAt: null,
      lastMergeAt: null,
      createdAt: db.migratedAt || new Date().toISOString()
    };
  }
  return db;
}

function migrate_v5_to_v6(db) {
  if (!db.tables[TABLES.riskStatuses]) {
    db.tables[TABLES.riskStatuses] = [];
  }
  return db;
}

function migrate_v6_to_v7(db) {
  if (!db.tables[TABLES.syncEvents]) {
    db.tables[TABLES.syncEvents] = [];
  }
  if (!db._meta) {
    db._meta = {
      deviceId: generateDeviceId(),
      lastSyncedAt: null,
      lastMergeAt: null,
      createdAt: db.migratedAt || new Date().toISOString(),
      syncCounter: 0,
      schemaVersion: 2,
      knownDevices: []
    };
  } else {
    if (typeof db._meta.syncCounter !== 'number') {
      db._meta.syncCounter = 0;
    }
    if (typeof db._meta.schemaVersion !== 'number') {
      db._meta.schemaVersion = 2;
    }
    if (!Array.isArray(db._meta.knownDevices)) {
      db._meta.knownDevices = [];
    }
  }
  const now = new Date().toISOString();
  for (const table of Object.values(TABLES)) {
    if (table === TABLES.syncEvents || table === TABLES.records) continue;
    if (!Array.isArray(db.tables[table])) continue;
    for (const record of db.tables[table]) {
      if (!record.createdAt) {
        record.createdAt = now;
      }
      if (!record.updatedAt) {
        record.updatedAt = record.createdAt || now;
      }
    }
  }
  return db;
}

const MIGRATIONS = {
  1: migrate_v1_to_v2,
  2: migrate_v2_to_v3,
  3: migrate_v3_to_v4,
  4: migrate_v4_to_v5,
  5: migrate_v5_to_v6,
  6: migrate_v6_to_v7
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

let _eventBatching = 0;
let _batchedEvents = [];

export function startEventBatch() {
  _eventBatching++;
}

export function endEventBatch() {
  if (_eventBatching > 0) {
    _eventBatching--;
  }
  if (_eventBatching === 0 && _batchedEvents.length > 0) {
    const db = getDB();
    if (!db.tables[TABLES.syncEvents]) {
      db.tables[TABLES.syncEvents] = [];
    }
    db.tables[TABLES.syncEvents] = [..._batchedEvents, ...db.tables[TABLES.syncEvents]];
    saveDB(db);
    _batchedEvents = [];
  }
}

function getChangedFields(before, after) {
  if (!before || !after) return null;
  const changes = [];
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  for (const k of keys) {
    if (k === 'updatedAt' || k === 'createdAt') continue;
    if (!deepEqual(before[k], after[k])) {
      changes.push(k);
    }
  }
  return changes.length > 0 ? changes : null;
}

function deepEqual(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function recordSyncEvent(db, table, eventType, recordId, options = {}) {
  if (!TRACKED_TABLES.has(table)) return null;
  if (!db._meta) {
    db._meta = createEmptyDatabase()._meta;
  }
  db._meta.syncCounter = (db._meta.syncCounter || 0) + 1;
  const event = {
    id: crypto.randomUUID(),
    deviceId: db._meta.deviceId,
    table,
    eventType,
    recordId,
    timestamp: new Date().toISOString(),
    syncCounter: db._meta.syncCounter,
    before: options.before !== undefined ? (options.before !== null ? deepClone(options.before) : null) : undefined,
    after: options.after !== undefined ? (options.after !== null ? deepClone(options.after) : null) : undefined,
    changedFields: options.changedFields || null,
    note: options.note || null
  };
  if (!db.tables[TABLES.syncEvents]) {
    db.tables[TABLES.syncEvents] = [];
  }
  if (_eventBatching > 0) {
    _batchedEvents.push(event);
  } else {
    db.tables[TABLES.syncEvents].unshift(event);
  }
  if (db._meta.knownDevices && !db._meta.knownDevices.includes(db._meta.deviceId)) {
    db._meta.knownDevices.push(db._meta.deviceId);
  }
  return event;
}

export function getEventsForRecord(table, recordId, db = null) {
  const database = db || getDB();
  const events = database.tables[TABLES.syncEvents] || [];
  return events.filter((e) => e.table === table && e.recordId === recordId)
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp) || (b.syncCounter || 0) - (a.syncCounter || 0));
}

export function getDeviceEventTimelines(currentDB, importDB) {
  const currentEvents = currentDB.tables[TABLES.syncEvents] || [];
  const importEvents = importDB.tables[TABLES.syncEvents] || [];
  const allEvents = [...currentEvents.map((e) => ({ ...e, side: 'current' })), ...importEvents.map((e) => ({ ...e, side: 'import' }))];
  allEvents.sort((a, b) => {
    const ta = new Date(a.timestamp).getTime();
    const tb = new Date(b.timestamp).getTime();
    if (ta !== tb) return ta - tb;
    return (a.syncCounter || 0) - (b.syncCounter || 0);
  });
  const byRecord = new Map();
  for (const e of allEvents) {
    const key = `${e.table}|${e.recordId}`;
    if (!byRecord.has(key)) {
      byRecord.set(key, []);
    }
    byRecord.get(key).push(e);
  }
  return { allEvents, byRecord };
}

export function trimOldEvents(db, maxAgeDays = 90, maxPerRecord = 50) {
  const now = Date.now();
  const cutoff = now - maxAgeDays * 86400000;
  const events = db.tables[TABLES.syncEvents] || [];
  const byRecord = new Map();
  const kept = [];
  for (const e of events) {
    const ts = new Date(e.timestamp).getTime();
    if (ts < cutoff) continue;
    const key = `${e.table}|${e.recordId}`;
    if (!byRecord.has(key)) byRecord.set(key, []);
    byRecord.get(key).push(e);
  }
  for (const list of byRecord.values()) {
    list.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    kept.push(...list.slice(0, maxPerRecord));
  }
  kept.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  db.tables[TABLES.syncEvents] = kept;
  return kept.length;
}

export function registerKnownDevice(db, deviceId) {
  if (!db._meta) {
    db._meta = createEmptyDatabase()._meta;
  }
  if (!Array.isArray(db._meta.knownDevices)) {
    db._meta.knownDevices = [];
  }
  if (deviceId && !db._meta.knownDevices.includes(deviceId)) {
    db._meta.knownDevices.push(deviceId);
  }
  return db._meta.knownDevices;
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
  const oldData = Array.isArray(db.tables[table]) ? deepClone(db.tables[table]) : [];
  const newData = Array.isArray(data) ? deepClone(data) : [];
  const now = new Date().toISOString();
  for (const rec of newData) {
    if (!rec.id) rec.id = crypto.randomUUID();
    if (!rec.createdAt) rec.createdAt = now;
    rec.updatedAt = now;
  }
  db.tables[table] = newData;
  if (TRACKED_TABLES.has(table)) {
    const oldMap = new Map(oldData.map((r) => [r.id, r]));
    const newMap = new Map(newData.map((r) => [r.id, r]));
    const allIds = new Set([...oldMap.keys(), ...newMap.keys()]);
    for (const id of allIds) {
      const oldRec = oldMap.get(id);
      const newRec = newMap.get(id);
      if (oldRec && !newRec) {
        recordSyncEvent(db, table, EVENT_TYPES.DELETE, id, {
          before: oldRec,
          after: null,
          note: 'batch_delete'
        });
      } else if (!oldRec && newRec) {
        recordSyncEvent(db, table, EVENT_TYPES.CREATE, id, {
          before: null,
          after: newRec,
          note: 'batch_create'
        });
      } else if (oldRec && newRec) {
        const changedFields = getChangedFields(oldRec, newRec);
        if (changedFields) {
          recordSyncEvent(db, table, EVENT_TYPES.UPDATE, id, {
            before: oldRec,
            after: newRec,
            changedFields,
            note: 'batch_update'
          });
        }
      }
    }
  }
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
  const now = new Date().toISOString();
  if (!newRecord.createdAt) newRecord.createdAt = now;
  if (!newRecord.updatedAt) newRecord.updatedAt = now;
  db.tables[table].unshift(newRecord);
  if (TRACKED_TABLES.has(table)) {
    recordSyncEvent(db, table, EVENT_TYPES.CREATE, newRecord.id, {
      before: null,
      after: deepClone(newRecord)
    });
  }
  saveDB(db);
  return newRecord;
}

export function updateOne(table, id, updates) {
  const db = getDB();
  if (!Array.isArray(db.tables[table])) return null;
  const idx = db.tables[table].findIndex((r) => r.id === id);
  if (idx === -1) return null;
  const before = deepClone(db.tables[table][idx]);
  db.tables[table][idx] = { ...db.tables[table][idx], ...deepClone(updates), updatedAt: new Date().toISOString() };
  const after = db.tables[table][idx];
  if (TRACKED_TABLES.has(table)) {
    const changedFields = getChangedFields(before, after);
    if (changedFields) {
      recordSyncEvent(db, table, EVENT_TYPES.UPDATE, id, {
        before,
        after: deepClone(after),
        changedFields
      });
    }
  }
  saveDB(db);
  return db.tables[table][idx];
}

export function updateOneWithEventType(table, id, updates, eventType, note = null) {
  const db = getDB();
  if (!Array.isArray(db.tables[table])) return null;
  const idx = db.tables[table].findIndex((r) => r.id === id);
  if (idx === -1) return null;
  const before = deepClone(db.tables[table][idx]);
  db.tables[table][idx] = { ...db.tables[table][idx], ...deepClone(updates), updatedAt: new Date().toISOString() };
  const after = db.tables[table][idx];
  if (TRACKED_TABLES.has(table)) {
    const changedFields = getChangedFields(before, after);
    if (changedFields || eventType) {
      recordSyncEvent(db, table, eventType || EVENT_TYPES.UPDATE, id, {
        before,
        after: deepClone(after),
        changedFields,
        note
      });
    }
  }
  saveDB(db);
  return db.tables[table][idx];
}

export function deleteOne(table, id) {
  const db = getDB();
  if (!Array.isArray(db.tables[table])) return false;
  const before = db.tables[table].find((r) => r.id === id);
  const beforeClone = before ? deepClone(before) : null;
  const beforeLen = db.tables[table].length;
  db.tables[table] = db.tables[table].filter((r) => r.id !== id);
  if (db.tables[table].length !== beforeLen) {
    if (TRACKED_TABLES.has(table) && beforeClone) {
      recordSyncEvent(db, table, EVENT_TYPES.DELETE, id, {
        before: beforeClone,
        after: null
      });
    }
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

export function exportFullDatabase(options = {}) {
  const db = getDB();
  let syncEvents = db.tables[TABLES.syncEvents] || [];
  if (options.trimEvents) {
    const trimmed = deepClone(db);
    trimOldEvents(trimmed, options.maxEventAgeDays || 90, options.maxEventsPerRecord || 50);
    syncEvents = trimmed.tables[TABLES.syncEvents] || [];
  }
  const exportObj = {
    _meta: {
      version: db.version,
      exportedAt: new Date().toISOString(),
      app: 'zfl-2-costume-lending',
      deviceId: db._meta?.deviceId || null,
      lastMergeAt: db._meta?.lastMergeAt || null,
      createdAt: db._meta?.createdAt || null,
      syncCounter: db._meta?.syncCounter || 0,
      schemaVersion: db._meta?.schemaVersion || 1,
      knownDevices: db._meta?.knownDevices || []
    },
    tables: {
      ...db.tables,
      [TABLES.syncEvents]: syncEvents
    }
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

  if (data._meta) {
    cleaned._meta = {
      ...cleaned._meta,
      deviceId: data._meta.deviceId || cleaned._meta.deviceId,
      exportedAt: data._meta.exportedAt || null,
      lastMergeAt: data._meta.lastMergeAt || null,
      createdAt: data._meta.createdAt || cleaned._meta.createdAt,
      syncCounter: data._meta.syncCounter || 0,
      schemaVersion: data._meta.schemaVersion || 1,
      knownDevices: Array.isArray(data._meta.knownDevices) ? data._meta.knownDevices : [],
      sourceApp: data._meta.app || null
    };
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

  const riskStatuses = db.tables[TABLES.riskStatuses] || [];
  const riskStatusBreakdown = {};
  for (const rs of riskStatuses) {
    const status = rs.status || '待处理';
    riskStatusBreakdown[status] = (riskStatusBreakdown[status] || 0) + 1;
  }

  const syncEvents = db.tables[TABLES.syncEvents] || [];
  const deviceEventBreakdown = {};
  const eventTypeBreakdown = {};
  for (const e of syncEvents) {
    const dev = e.deviceId || 'unknown';
    deviceEventBreakdown[dev] = (deviceEventBreakdown[dev] || 0) + 1;
    const et = e.eventType || 'unknown';
    eventTypeBreakdown[et] = (eventTypeBreakdown[et] || 0) + 1;
  }

  return {
    version: db.version,
    migratedAt: db.migratedAt,
    meta: db._meta || null,
    tables: stats,
    riskStatuses: {
      total: riskStatuses.length,
      byStatus: riskStatusBreakdown
    },
    syncEvents: {
      total: syncEvents.length,
      byDevice: deviceEventBreakdown,
      byType: eventTypeBreakdown
    }
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

export function getFullDB() {
  return deepClone(getDB());
}

export function saveFullDB(db) {
  const toSave = deepClone(db);
  if (!toSave._meta) {
    toSave._meta = createEmptyDatabase()._meta;
  }
  if (!toSave.tables[TABLES.syncEvents]) {
    toSave.tables[TABLES.syncEvents] = [];
  }
  return writeRawDB(toSave);
}

export function updateLastMergeAt(importMeta = null) {
  const db = getDB();
  if (!db._meta) {
    db._meta = createEmptyDatabase()._meta;
  }
  db._meta.lastMergeAt = new Date().toISOString();
  if (importMeta?.deviceId) {
    registerKnownDevice(db, importMeta.deviceId);
  }
  writeRawDB(db);
  return db._meta.lastMergeAt;
}

export function parseBackupFile(jsonString) {
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
    if (Array.isArray(data)) {
      const legacy = createEmptyDatabase();
      legacy.tables[TABLES.costumes] = data;
      return { ok: true, db: legacy, legacyFormat: true };
    }
    return { ok: false, error: '缺少 tables 字段，无法识别的数据格式' };
  }

  const cleaned = createEmptyDatabase();
  for (const table of Object.values(TABLES)) {
    if (Array.isArray(data.tables[table])) {
      cleaned.tables[table] = data.tables[table];
    }
  }

  if (data._meta) {
    cleaned._meta = {
      ...cleaned._meta,
      deviceId: data._meta.deviceId || cleaned._meta.deviceId,
      exportedAt: data._meta.exportedAt || null,
      lastMergeAt: data._meta.lastMergeAt || null,
      createdAt: data._meta.createdAt || cleaned._meta.createdAt,
      syncCounter: data._meta.syncCounter || 0,
      schemaVersion: data._meta.schemaVersion || 1,
      knownDevices: Array.isArray(data._meta.knownDevices) ? data._meta.knownDevices : [],
      sourceApp: data._meta.app || null
    };
  }

  if (data._meta?.version && typeof data._meta.version === 'number') {
    cleaned.version = data._meta.version;
  }

  try {
    const migrated = runMigrations(cleaned);
    return { ok: true, db: migrated, legacyFormat: false };
  } catch (e) {
    return { ok: false, error: `数据迁移失败：${e.message}` };
  }
}

export { TABLES, TABLE_LABELS, DB_VERSION, DB_KEY };
