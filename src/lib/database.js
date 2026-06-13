import globalIndex from '$lib/dataIndex.js';

const DB_KEY = 'zfl-2-database';
const DB_VERSION = 9;

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
  syncEvents: 'syncEvents',
  tombstones: 'tombstones'
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
  syncEvents: '同步事件日志',
  tombstones: '删除墓碑记录'
};

const SOFT_DELETE_TABLES = new Set([
  TABLES.costumes,
  TABLES.actors,
  TABLES.schedules,
  TABLES.workOrders,
  TABLES.reservations,
  TABLES.packingLists
]);

const TOMBSTONE_SUMMARY_FIELDS = {
  [TABLES.costumes]: ['name', 'play', 'size'],
  [TABLES.actors]: ['name', 'role'],
  [TABLES.schedules]: ['play', 'date', 'venue'],
  [TABLES.workOrders]: ['type', 'costumeName', 'status'],
  [TABLES.reservations]: ['costumeName', 'reservedFor'],
  [TABLES.packingLists]: ['name', 'play']
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
      [TABLES.syncEvents]: [],
      [TABLES.tombstones]: []
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

function migrate_v7_to_v8(db) {
  if (!db.tables[TABLES.tombstones]) {
    db.tables[TABLES.tombstones] = [];
  }
  for (const table of SOFT_DELETE_TABLES) {
    if (!Array.isArray(db.tables[table])) continue;
    for (const record of db.tables[table]) {
      if (record.deletedAt === undefined) {
        record.deletedAt = null;
        record.deletedByDeviceId = null;
        record.deleteSummary = null;
      }
    }
  }
  return db;
}

function migrate_v8_to_v9(db) {
  if (!db.tables[TABLES.tombstones]) {
    db.tables[TABLES.tombstones] = [];
  }
  for (const table of SOFT_DELETE_TABLES) {
    if (!Array.isArray(db.tables[table])) continue;
    for (const record of db.tables[table]) {
      if (record.deletedAt === undefined) record.deletedAt = null;
      if (record.deletedByDeviceId === undefined) record.deletedByDeviceId = null;
      if (record.deleteSummary === undefined) record.deleteSummary = null;
    }
  }
  const tombstoneRecordIds = new Set(
    (db.tables[TABLES.tombstones] || []).map((t) => `${t.table}|${t.recordId}`)
  );
  for (const table of SOFT_DELETE_TABLES) {
    if (!Array.isArray(db.tables[table])) continue;
    for (const record of db.tables[table]) {
      if (record.deletedAt && !tombstoneRecordIds.has(`${table}|${record.id}`)) {
        recordTombstone(db, table, record.id, record);
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
  6: migrate_v6_to_v7,
  7: migrate_v7_to_v8,
  8: migrate_v8_to_v9
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
  let db;
  const existing = readRawDB();

  if (existing && typeof existing === 'object' && existing.tables) {
    try {
      const migrated = runMigrations(existing);
      if (migrated.version !== existing.version || !existing.migratedAt) {
        migrated.migratedAt = new Date().toISOString();
      }
      writeRawDB(migrated);
      db = migrated;
    } catch (e) {
      console.error('[DB] Migration failed, preserving existing data:', e);
      db = existing;
    }
  } else if (hasLegacyData()) {
    try {
      const migrated = migrateFromLegacy();
      writeRawDB(migrated);
      db = migrated;
    } catch (e) {
      console.error('[DB] Legacy migration failed, preserving legacy data:', e);
      const fresh = createEmptyDatabase();
      writeRawDB(fresh);
      db = fresh;
    }
  } else {
    const fresh = createEmptyDatabase();
    writeRawDB(fresh);
    db = fresh;
  }

  try {
    globalIndex.build(db);
  } catch (e) {
    console.error('[DB] Index build failed:', e);
  }
  return db;
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

function buildRecordSummary(table, record) {
  if (!record) return '';
  const fields = TOMBSTONE_SUMMARY_FIELDS[table];
  if (!fields) return record.id || '';
  const parts = [];
  for (const f of fields) {
    const val = record[f];
    if (val !== null && val !== undefined && val !== '') {
      parts.push(String(val));
    }
  }
  return parts.join(' · ') || record.id || '';
}

function recordTombstone(db, table, recordId, record) {
  if (!SOFT_DELETE_TABLES.has(table)) return null;
  if (!db.tables[TABLES.tombstones]) {
    db.tables[TABLES.tombstones] = [];
  }
  const summary = buildRecordSummary(table, record);
  const tombstone = {
    id: crypto.randomUUID(),
    table,
    recordId,
    deletedAt: new Date().toISOString(),
    deletedByDeviceId: db._meta?.deviceId || null,
    summary,
    recordSnapshot: record ? deepClone(record) : null
  };
  db.tables[TABLES.tombstones].unshift(tombstone);
  return tombstone;
}

function removeTombstone(db, table, recordId) {
  if (!db.tables[TABLES.tombstones]) return false;
  const beforeLen = db.tables[TABLES.tombstones].length;
  db.tables[TABLES.tombstones] = db.tables[TABLES.tombstones].filter(
    (t) => !(t.table === table && t.recordId === recordId)
  );
  return db.tables[TABLES.tombstones].length !== beforeLen;
}

export function getTombstones(table = null) {
  const db = getDB();
  const all = db.tables[TABLES.tombstones] || [];
  if (table) {
    return deepClone(all.filter((t) => t.table === table));
  }
  return deepClone(all);
}

export function findTombstone(table, recordId) {
  const db = getDB();
  const all = db.tables[TABLES.tombstones] || [];
  const t = all.find((ts) => ts.table === table && ts.recordId === recordId);
  return t ? deepClone(t) : null;
}

export function hasTombstone(db, table, recordId) {
  if (!db.tables[TABLES.tombstones]) return false;
  return db.tables[TABLES.tombstones].some(
    (t) => t.table === table && t.recordId === recordId
  );
}

function isSoftDeleted(record) {
  return !!(record && record.deletedAt);
}

export function getDeletedRecords(table) {
  const db = getDB();
  if (!Array.isArray(db.tables[table])) return [];
  return deepClone(db.tables[table].filter((r) => isSoftDeleted(r)));
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

export function getAll(table, options = {}) {
  const db = getDB();
  let records = db.tables[table] || [];
  if (SOFT_DELETE_TABLES.has(table) && !options.includeDeleted) {
    records = records.filter((r) => !isSoftDeleted(r));
  }
  return deepClone(records);
}

export function getAllIncludingDeleted(table) {
  return getAll(table, { includeDeleted: true });
}

export function setAll(table, data, options = {}) {
  const db = getDB();
  const oldData = Array.isArray(db.tables[table]) ? deepClone(db.tables[table]) : [];
  const newData = Array.isArray(data) ? deepClone(data) : [];
  const now = new Date().toISOString();
  const isSoftDeleteTable = SOFT_DELETE_TABLES.has(table);
  const newIds = new Set(newData.map((r) => r.id).filter(Boolean));
  const finalRecords = [...newData];

  const toAdd = [];
  const toUpdate = [];
  const toRemove = [];

  for (const rec of finalRecords) {
    if (!rec.id) rec.id = crypto.randomUUID();
    if (!rec.createdAt) rec.createdAt = now;
    rec.updatedAt = now;
    if (isSoftDeleteTable) {
      if (rec.deletedAt === undefined) rec.deletedAt = null;
      if (rec.deletedByDeviceId === undefined) rec.deletedByDeviceId = null;
      if (rec.deleteSummary === undefined) rec.deleteSummary = null;
    }
  }

  if (TRACKED_TABLES.has(table)) {
    const oldMap = new Map(oldData.map((r) => [r.id, r]));
    const newMap = new Map(finalRecords.map((r) => [r.id, r]));
    const allIds = new Set([...oldMap.keys(), ...newMap.keys()]);
    for (const id of allIds) {
      const oldRec = oldMap.get(id);
      const newRec = newMap.get(id);
      if (oldRec && !newRec) {
        if (isSoftDeleteTable && !isSoftDeleted(oldRec)) {
          const summary = buildRecordSummary(table, oldRec);
          const deletedRec = {
            ...oldRec,
            deletedAt: now,
            deletedByDeviceId: db._meta?.deviceId || null,
            deleteSummary: summary,
            updatedAt: now
          };
          finalRecords.push(deletedRec);
          recordTombstone(db, table, id, oldRec);
          recordSyncEvent(db, table, EVENT_TYPES.DELETE, id, {
            before: oldRec,
            after: deletedRec,
            note: 'batch_soft_delete'
          });
          if (!isSoftDeleted(deletedRec)) {
            toRemove.push(deletedRec);
          }
        } else if (!isSoftDeleteTable) {
          removeTombstone(db, table, id);
          recordSyncEvent(db, table, EVENT_TYPES.DELETE, id, {
            before: oldRec,
            after: null,
            note: 'batch_delete'
          });
          toRemove.push(oldRec);
        }
      } else if (!oldRec && newRec) {
        recordSyncEvent(db, table, EVENT_TYPES.CREATE, id, {
          before: null,
          after: newRec,
          note: 'batch_create'
        });
        if (!isSoftDeleted(newRec)) {
          toAdd.push(newRec);
        }
      } else if (oldRec && newRec) {
        const changedFields = getChangedFields(oldRec, newRec);
        if (changedFields) {
          recordSyncEvent(db, table, EVENT_TYPES.UPDATE, id, {
            before: oldRec,
            after: newRec,
            changedFields,
            note: 'batch_update'
          });
          if (!isSoftDeleted(newRec)) {
            if (isSoftDeleted(oldRec)) {
              toAdd.push(newRec);
            } else {
              toUpdate.push({ oldRecord: oldRec, newRecord: newRec });
            }
          } else if (!isSoftDeleted(oldRec)) {
            toRemove.push(oldRec);
          }
        }
      }
    }
  }

  db.tables[table] = finalRecords;
  saveDB(db);

  if (!options.skipIndex) {
    const totalChanges = toAdd.length + toUpdate.length + toRemove.length;
    if (totalChanges === 0) {
    } else if (totalChanges < oldData.length * 0.5 && !options.forceRebuild) {
      startEventBatch();
      try {
        globalIndex.startBatch();
        try {
          if (toAdd.length > 0) {
            globalIndex.bulkAddRecords(table, toAdd);
          }
          if (toUpdate.length > 0) {
            globalIndex.bulkUpdateRecords(table, toUpdate);
          }
          if (toRemove.length > 0) {
            globalIndex.bulkRemoveRecords(table, toRemove);
          }
        } finally {
          globalIndex.endBatch();
        }
      } finally {
        endEventBatch();
      }
    } else {
      try {
        globalIndex.build(db);
      } catch (e) {
        console.error(`[DB] Index rebuild failed after setAll:`, e);
      }
    }
  }

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
  try {
    globalIndex.addRecord(table, newRecord);
  } catch (e) {
    console.error(`[DB] Index add failed for ${table}:`, e);
  }
  return newRecord;
}

export function insertMany(table, records, options = {}) {
  if (!records || records.length === 0) return [];

  const db = getDB();
  if (!Array.isArray(db.tables[table])) {
    db.tables[table] = [];
  }

  const now = new Date().toISOString();
  const isSoftDeleteTable = SOFT_DELETE_TABLES.has(table);
  const savedRecords = [];
  const indexRecords = [];

  startEventBatch();
  try {
    globalIndex.startBatch();
    try {
      for (const record of records) {
        const newRecord = deepClone(record);
        if (!newRecord.id) {
          newRecord.id = crypto.randomUUID();
        }
        if (!newRecord.createdAt) newRecord.createdAt = now;
        if (!newRecord.updatedAt) newRecord.updatedAt = now;
        if (isSoftDeleteTable) {
          if (newRecord.deletedAt === undefined) newRecord.deletedAt = null;
          if (newRecord.deletedByDeviceId === undefined) newRecord.deletedByDeviceId = null;
          if (newRecord.deleteSummary === undefined) newRecord.deleteSummary = null;
        }

        db.tables[table].unshift(newRecord);
        savedRecords.push(newRecord);
        indexRecords.push(newRecord);

        if (TRACKED_TABLES.has(table)) {
          recordSyncEvent(db, table, EVENT_TYPES.CREATE, newRecord.id, {
            before: null,
            after: deepClone(newRecord),
            note: options.batchNote || 'batch_insert'
          });
        }
      }

      saveDB(db);

      if (indexRecords.length > 0) {
        try {
          globalIndex.bulkAddRecords(table, indexRecords);
        } catch (e) {
          console.error(`[DB] Bulk index add failed for ${table}:`, e);
        }
      }
    } finally {
      globalIndex.endBatch();
    }
  } finally {
    endEventBatch();
  }

  return savedRecords;
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
  try {
    if (isSoftDeleted(after) && !isSoftDeleted(before)) {
      globalIndex.removeRecord(table, after);
    } else if (!isSoftDeleted(after) && isSoftDeleted(before)) {
      globalIndex.addRecord(table, after);
    } else if (!isSoftDeleted(after)) {
      globalIndex.updateRecord(table, before, after);
    }
  } catch (e) {
    console.error(`[DB] Index update failed for ${table}:`, e);
  }
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
  try {
    if (isSoftDeleted(after) && !isSoftDeleted(before)) {
      globalIndex.removeRecord(table, after);
    } else if (!isSoftDeleted(after) && isSoftDeleted(before)) {
      globalIndex.addRecord(table, after);
    } else if (!isSoftDeleted(after)) {
      globalIndex.updateRecord(table, before, after);
    }
  } catch (e) {
    console.error(`[DB] Index update failed for ${table}:`, e);
  }
  return db.tables[table][idx];
}

export function updateMany(table, updatesArray, options = {}) {
  if (!updatesArray || updatesArray.length === 0) return [];

  const db = getDB();
  if (!Array.isArray(db.tables[table])) return [];

  const now = new Date().toISOString();
  const results = [];
  const indexUpdates = [];

  startEventBatch();
  try {
    globalIndex.startBatch();
    try {
      for (const { id, updates, eventType, note } of updatesArray) {
        const idx = db.tables[table].findIndex((r) => r.id === id);
        if (idx === -1) continue;

        const before = deepClone(db.tables[table][idx]);
        db.tables[table][idx] = { ...db.tables[table][idx], ...deepClone(updates), updatedAt: now };
        const after = db.tables[table][idx];

        results.push(after);
        indexUpdates.push({ oldRecord: before, newRecord: after });

        if (TRACKED_TABLES.has(table)) {
          const changedFields = getChangedFields(before, after);
          if (changedFields || eventType) {
            recordSyncEvent(db, table, eventType || EVENT_TYPES.UPDATE, id, {
              before,
              after: deepClone(after),
              changedFields,
              note: note || options.batchNote || 'batch_update'
            });
          }
        }
      }

      saveDB(db);

      if (indexUpdates.length > 0) {
        try {
          globalIndex.bulkUpdateRecords(table, indexUpdates);
        } catch (e) {
          console.error(`[DB] Bulk index update failed for ${table}:`, e);
        }
      }
    } finally {
      globalIndex.endBatch();
    }
  } finally {
    endEventBatch();
  }

  return results;
}

export function softDeleteOne(table, id) {
  if (!SOFT_DELETE_TABLES.has(table)) {
    return purgeOne(table, id);
  }
  const db = getDB();
  if (!Array.isArray(db.tables[table])) return false;
  const idx = db.tables[table].findIndex((r) => r.id === id);
  if (idx === -1) return false;
  const before = deepClone(db.tables[table][idx]);
  if (isSoftDeleted(before)) return false;
  const now = new Date().toISOString();
  const summary = buildRecordSummary(table, before);
  db.tables[table][idx] = {
    ...db.tables[table][idx],
    deletedAt: now,
    deletedByDeviceId: db._meta?.deviceId || null,
    deleteSummary: summary,
    updatedAt: now
  };
  const after = deepClone(db.tables[table][idx]);
  recordTombstone(db, table, id, before);
  if (TRACKED_TABLES.has(table)) {
    recordSyncEvent(db, table, EVENT_TYPES.DELETE, id, {
      before,
      after,
      note: 'soft_delete'
    });
  }
  saveDB(db);
  try {
    globalIndex.removeRecord(table, after);
  } catch (e) {
    console.error(`[DB] Index remove failed for ${table}:`, e);
  }
  return true;
}

export function purgeOne(table, id) {
  const db = getDB();
  if (!Array.isArray(db.tables[table])) return false;
  const before = db.tables[table].find((r) => r.id === id);
  const beforeClone = before ? deepClone(before) : null;
  const beforeLen = db.tables[table].length;
  db.tables[table] = db.tables[table].filter((r) => r.id !== id);
  if (db.tables[table].length !== beforeLen) {
    removeTombstone(db, table, id);
    if (TRACKED_TABLES.has(table) && beforeClone) {
      recordSyncEvent(db, table, EVENT_TYPES.DELETE, id, {
        before: beforeClone,
        after: null,
        note: 'purge'
      });
    }
    saveDB(db);
    try {
      if (beforeClone && !isSoftDeleted(beforeClone)) {
        globalIndex.removeRecord(table, beforeClone);
      }
    } catch (e) {
      console.error(`[DB] Index remove failed for ${table}:`, e);
    }
    return true;
  }
  return false;
}

export function restoreOne(table, id) {
  if (!SOFT_DELETE_TABLES.has(table)) return null;
  const db = getDB();
  if (!Array.isArray(db.tables[table])) return null;
  const idx = db.tables[table].findIndex((r) => r.id === id);
  if (idx === -1) return null;
  const record = db.tables[table][idx];
  if (!isSoftDeleted(record)) return null;
  const before = deepClone(record);
  db.tables[table][idx] = {
    ...record,
    deletedAt: null,
    deletedByDeviceId: null,
    deleteSummary: null,
    updatedAt: new Date().toISOString()
  };
  const after = deepClone(db.tables[table][idx]);
  removeTombstone(db, table, id);
  if (TRACKED_TABLES.has(table)) {
    recordSyncEvent(db, table, EVENT_TYPES.CREATE, id, {
      before,
      after,
      note: 'restore'
    });
  }
  saveDB(db);
  try {
    globalIndex.addRecord(table, after);
  } catch (e) {
    console.error(`[DB] Index add failed for ${table}:`, e);
  }
  return after;
}

export function deleteOne(table, id) {
  return softDeleteOne(table, id);
}

export function cleanupReferencesForCostume(costumeId) {
  const db = getDB();
  const now = new Date().toISOString();
  const deviceId = db._meta?.deviceId || null;
  let affectedCount = 0;

  const reservationRefs = [
    { table: TABLES.reservations, field: 'costumeId' },
    { table: TABLES.workOrders, field: 'costumeId' },
    { table: TABLES.records, field: 'costumeId' },
    { table: TABLES.inventoryItems, field: 'costumeId' }
  ];

  for (const ref of reservationRefs) {
    if (!Array.isArray(db.tables[ref.table])) continue;
    for (let i = 0; i < db.tables[ref.table].length; i++) {
      const rec = db.tables[ref.table][i];
      if (rec[ref.field] === costumeId && !isSoftDeleted(rec)) {
        if (SOFT_DELETE_TABLES.has(ref.table)) {
          db.tables[ref.table][i] = {
            ...rec,
            deletedAt: now,
            deletedByDeviceId: deviceId,
            deleteSummary: `关联服装已删除，自动清理`,
            updatedAt: now
          };
          recordTombstone(db, ref.table, rec.id, rec);
          recordSyncEvent(db, ref.table, EVENT_TYPES.DELETE, rec.id, {
            before: deepClone(rec),
            after: deepClone(db.tables[ref.table][i]),
            note: 'cascade_soft_delete'
          });
        } else {
          db.tables[ref.table][i] = {
            ...rec,
            [ref.field + '_dangling_note']: '原引用服装已删除',
            updatedAt: now
          };
          recordSyncEvent(db, ref.table, EVENT_TYPES.UPDATE, rec.id, {
            before: deepClone(rec),
            after: deepClone(db.tables[ref.table][i]),
            changedFields: [ref.field + '_dangling_note'],
            note: 'dangling_ref_cleanup'
          });
        }
        affectedCount++;
      }
    }
  }

  if (Array.isArray(db.tables[TABLES.packingLists])) {
    for (let i = 0; i < db.tables[TABLES.packingLists].length; i++) {
      const pl = db.tables[TABLES.packingLists][i];
      if (!isSoftDeleted(pl) && Array.isArray(pl.items)) {
        let modified = false;
        const newItems = pl.items.map((item) => {
          if (item.costumeId === costumeId) {
            modified = true;
            affectedCount++;
            return { ...item, costumeId: null, _dangling_note: '原引用服装已删除' };
          }
          return item;
        });
        if (modified) {
          const before = deepClone(pl);
          db.tables[TABLES.packingLists][i] = { ...pl, items: newItems, updatedAt: now };
          const after = deepClone(db.tables[TABLES.packingLists][i]);
          recordSyncEvent(db, TABLES.packingLists, EVENT_TYPES.UPDATE, pl.id, {
            before,
            after,
            changedFields: ['items'],
            note: 'dangling_ref_cleanup_packing'
          });
        }
      }
    }
  }

  if (Array.isArray(db.tables[TABLES.schedules])) {
    for (let i = 0; i < db.tables[TABLES.schedules].length; i++) {
      const sched = db.tables[TABLES.schedules][i];
      if (!isSoftDeleted(sched) && Array.isArray(sched.linkedCostumeIds)) {
        const idx = sched.linkedCostumeIds.indexOf(costumeId);
        if (idx !== -1) {
          const before = deepClone(sched);
          const newIds = sched.linkedCostumeIds.filter((id) => id !== costumeId);
          db.tables[TABLES.schedules][i] = { ...sched, linkedCostumeIds: newIds, updatedAt: now };
          const after = deepClone(db.tables[TABLES.schedules][i]);
          recordSyncEvent(db, TABLES.schedules, EVENT_TYPES.UPDATE, sched.id, {
            before,
            after,
            changedFields: ['linkedCostumeIds'],
            note: 'dangling_ref_cleanup_schedule'
          });
          affectedCount++;
        }
      }
    }
  }

  saveDB(db);
  try {
    globalIndex.build(db);
  } catch (e) {
    console.error('[DB] Index rebuild failed after cleanupReferences:', e);
  }
  return affectedCount;
}

export function getReferencesForCostume(costumeId) {
  const db = getDB();
  const refs = [];

  if (Array.isArray(db.tables[TABLES.reservations])) {
    for (const r of db.tables[TABLES.reservations]) {
      if (r.costumeId === costumeId && !isSoftDeleted(r)) {
        refs.push({ table: TABLES.reservations, id: r.id, label: `预约：${r.reservedFor}（${r.date}）` });
      }
    }
  }
  if (Array.isArray(db.tables[TABLES.workOrders])) {
    for (const wo of db.tables[TABLES.workOrders]) {
      if (wo.costumeId === costumeId && !isSoftDeleted(wo)) {
        refs.push({ table: TABLES.workOrders, id: wo.id, label: `工单：${wo.type} - ${wo.assignee}` });
      }
    }
  }
  if (Array.isArray(db.tables[TABLES.packingLists])) {
    for (const pl of db.tables[TABLES.packingLists]) {
      if (!isSoftDeleted(pl) && Array.isArray(pl.items)) {
        for (const item of pl.items) {
          if (item.costumeId === costumeId) {
            refs.push({ table: TABLES.packingLists, id: pl.id, label: `装箱单：${pl.name}` });
            break;
          }
        }
      }
    }
  }
  if (Array.isArray(db.tables[TABLES.schedules])) {
    for (const s of db.tables[TABLES.schedules]) {
      if (!isSoftDeleted(s) && Array.isArray(s.linkedCostumeIds) && s.linkedCostumeIds.includes(costumeId)) {
        refs.push({ table: TABLES.schedules, id: s.id, label: `排期：${s.play}（${s.date}）` });
      }
    }
  }

  return refs;
}

export function findOne(table, id, options = {}) {
  const db = getDB();
  if (!Array.isArray(db.tables[table])) return null;
  const record = db.tables[table].find((r) => r.id === id);
  if (!record) return null;
  if (SOFT_DELETE_TABLES.has(table) && !options.includeDeleted && isSoftDeleted(record)) {
    return null;
  }
  return deepClone(record);
}

export function findOneIncludingDeleted(table, id) {
  return findOne(table, id, { includeDeleted: true });
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
    try {
      globalIndex.build(migrated);
    } catch (idxErr) {
      console.error('[DB] Index build failed after import:', idxErr);
    }
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
  const deletedStats = {};
  for (const table of Object.values(TABLES)) {
    const records = db.tables[table] || [];
    stats[table] = records.length;
    if (SOFT_DELETE_TABLES.has(table)) {
      deletedStats[table] = records.filter((r) => isSoftDeleted(r)).length;
    }
  }

  const tombstones = db.tables[TABLES.tombstones] || [];
  const tombstoneByTable = {};
  for (const t of tombstones) {
    tombstoneByTable[t.table] = (tombstoneByTable[t.table] || 0) + 1;
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
    softDeleted: deletedStats,
    tombstones: {
      total: tombstones.length,
      byTable: tombstoneByTable
    },
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

export { TABLES, TABLE_LABELS, DB_VERSION, DB_KEY, SOFT_DELETE_TABLES };
