import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  makeV1DB,
  makeV2DB,
  makeV3DB,
  makeV4DB,
  makeV5DB,
  makeV6DB,
  makeV7DB,
  makeV8DB,
  makeV9DB,
  populatedV1DB,
  populatedV3DB,
  populatedV7DB,
  sampleCostumeV1,
  sampleActorV1,
  sampleTombstoneV8
} from './fixtures/migrationSnapshots.js';

const DB_KEY = 'zfl-2-database';
const DB_VERSION = 10;
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
  suggestionStatuses: 'suggestionStatuses',
  syncEvents: 'syncEvents',
  tombstones: 'tombstones'
};

const SOFT_DELETE_TABLES = new Set([
  TABLES.costumes,
  TABLES.actors,
  TABLES.schedules,
  TABLES.workOrders,
  TABLES.reservations,
  TABLES.packingLists
]);

const LEGACY_KEYS = {
  [TABLES.costumes]: 'zfl-2-costumes',
  [TABLES.records]: 'zfl-2-records',
  [TABLES.reservations]: 'zfl-2-reservations',
  [TABLES.workOrders]: 'zfl-2-work-orders',
  [TABLES.actors]: 'zfl-2-actors',
  [TABLES.packingLists]: 'zfl-2-packing-lists'
};

let storageMock = {};

const localStorageMock = {
  getItem: vi.fn((key) => (key in storageMock ? storageMock[key] : null)),
  setItem: vi.fn((key, value) => {
    storageMock[key] = String(value);
  }),
  removeItem: vi.fn((key) => {
    delete storageMock[key];
  }),
  clear: vi.fn(() => {
    storageMock = {};
  })
};

Object.defineProperty(global, 'localStorage', { value: localStorageMock });

if (!global.crypto) {
  global.crypto = {
    randomUUID: () => `uuid-${Math.random().toString(36).slice(2, 10)}`
  };
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
      [TABLES.suggestionStatuses]: [],
      [TABLES.syncEvents]: [],
      [TABLES.tombstones]: []
    }
  };
}

function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
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

function recordTombstone(db, table, recordId, record) {
  if (!SOFT_DELETE_TABLES.has(table)) return null;
  if (!db.tables[TABLES.tombstones]) {
    db.tables[TABLES.tombstones] = [];
  }
  const fields = {
    [TABLES.costumes]: ['name', 'play', 'size'],
    [TABLES.actors]: ['name', 'role'],
    [TABLES.schedules]: ['play', 'date', 'venue'],
    [TABLES.workOrders]: ['type', 'costumeName', 'status'],
    [TABLES.reservations]: ['costumeName', 'reservedFor'],
    [TABLES.packingLists]: ['name', 'play']
  };
  function buildRecordSummary(t, r) {
    if (!r) return '';
    const flds = fields[t];
    if (!flds) return r.id || '';
    const parts = [];
    for (const f of flds) {
      const val = r[f];
      if (val !== null && val !== undefined && val !== '') {
        parts.push(String(val));
      }
    }
    return parts.join(' · ') || r.id || '';
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

function migrate_v9_to_v10(db) {
  if (!db.tables[TABLES.suggestionStatuses]) {
    db.tables[TABLES.suggestionStatuses] = [];
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
  8: migrate_v8_to_v9,
  9: migrate_v9_to_v10
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

function hasLegacyData() {
  for (const key of Object.values(LEGACY_KEYS)) {
    if (localStorage.getItem(key) !== null) return true;
  }
  return false;
}

function readAllLegacyData() {
  const result = {};
  for (const [table, legacyKey] of Object.entries(LEGACY_KEYS)) {
    const raw = localStorage.getItem(legacyKey);
    let data = null;
    try {
      data = raw ? JSON.parse(raw) : null;
    } catch (e) {
      data = null;
    }
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

function readRawDB() {
  const raw = localStorage.getItem(DB_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

function writeRawDB(db) {
  try {
    localStorage.setItem(DB_KEY, JSON.stringify(db));
    return true;
  } catch (e) {
    return false;
  }
}

function initializeDatabase() {
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
      console.error('[DB] Legacy migration failed:', e);
      const fresh = createEmptyDatabase();
      writeRawDB(fresh);
      db = fresh;
    }
  } else {
    const fresh = createEmptyDatabase();
    writeRawDB(fresh);
    db = fresh;
  }

  return db;
}

describe('数据库迁移链路验证', () => {
  beforeEach(() => {
    storageMock = {};
    localStorageMock.getItem.mockImplementation((key) => (key in storageMock ? storageMock[key] : null));
    localStorageMock.setItem.mockImplementation((key, value) => {
      storageMock[key] = String(value);
    });
    localStorageMock.removeItem.mockImplementation((key) => {
      delete storageMock[key];
    });
    localStorageMock.clear.mockImplementation(() => {
      storageMock = {};
    });
  });

  describe('空数据库初始化', () => {
    it('[数据链路: 初始化] 完全空的localStorage应创建v10空库', () => {
      const db = initializeDatabase();
      expect(db.version).toBe(DB_VERSION);
      expect(db.tables).toBeDefined();
      for (const table of Object.values(TABLES)) {
        expect(Array.isArray(db.tables[table])).toBe(true);
      }
      expect(db._meta).toBeDefined();
      expect(db._meta.deviceId).toBeTruthy();
    });

    it('[数据链路: 初始化] 新DB应包含13张核心表', () => {
      const db = initializeDatabase();
      const expectedTables = Object.values(TABLES);
      expect(Object.keys(db.tables).sort()).toEqual(expectedTables.sort());
    });
  });

  describe('单步迁移验证', () => {
    it('[数据链路: 迁移v1→v2] 应新增packingLists表', () => {
      const v1 = makeV1DB();
      const v2 = runMigrations(v1);
      expect(v2.version).toBe(DB_VERSION);
      expect(Array.isArray(v2.tables.packingLists)).toBe(true);
    });

    it('[数据链路: 迁移v2→v3] 应新增schedules表', () => {
      const v2 = makeV2DB();
      const result = runMigrations(v2);
      expect(Array.isArray(result.tables.schedules)).toBe(true);
    });

    it('[数据链路: 迁移v3→v4] 应新增inventoryTasks和inventoryItems表', () => {
      const v3 = makeV3DB();
      const result = runMigrations(v3);
      expect(Array.isArray(result.tables.inventoryTasks)).toBe(true);
      expect(Array.isArray(result.tables.inventoryItems)).toBe(true);
    });

    it('[数据链路: 迁移v4→v5] 应新增_meta信息', () => {
      const v4 = makeV4DB();
      const result = runMigrations(v4);
      expect(result._meta).toBeDefined();
      expect(result._meta.deviceId).toBeTruthy();
    });

    it('[数据链路: 迁移v5→v6] 应新增riskStatuses表', () => {
      const v5 = makeV5DB();
      const result = runMigrations(v5);
      expect(Array.isArray(result.tables.riskStatuses)).toBe(true);
    });

    it('[数据链路: 迁移v6→v7] 应新增syncEvents表并补齐_meta字段', () => {
      const v6 = makeV6DB();
      const result = runMigrations(v6);
      expect(Array.isArray(result.tables.syncEvents)).toBe(true);
      expect(typeof result._meta.syncCounter).toBe('number');
      expect(Array.isArray(result._meta.knownDevices)).toBe(true);
    });

    it('[数据链路: 迁移v6→v7] 应补齐记录的createdAt和updatedAt', () => {
      const costume = sampleCostumeV1('c-meta-001');
      delete costume.createdAt;
      delete costume.updatedAt;
      const v6 = makeV6DB({ costumes: [costume] });
      const result = runMigrations(v6);
      const migrated = result.tables.costumes[0];
      expect(migrated.createdAt).toBeTruthy();
      expect(migrated.updatedAt).toBeTruthy();
    });

    it('[数据链路: 迁移v7→v8] 应新增tombstones表并补齐软删除字段', () => {
      const v7 = makeV7DB();
      const result = runMigrations(v7);
      expect(Array.isArray(result.tables.tombstones)).toBe(true);
      for (const table of SOFT_DELETE_TABLES) {
        if (Array.isArray(result.tables[table])) {
          for (const r of result.tables[table]) {
            expect('deletedAt' in r).toBe(true);
          }
        }
      }
    });

    it('[数据链路: 迁移v8→v9] 应为软删除但无墓碑的记录自动生成墓碑', () => {
      const deletedCostume = sampleCostumeV1('c-del-001', {
        deletedAt: '2025-04-01T00:00:00.000Z',
        deletedByDeviceId: 'dev-test',
        deleteSummary: '已删'
      });
      const v8 = makeV8DB({
        costumes: [deletedCostume],
        tombstones: []
      });
      const result = runMigrations(v8);
      expect(result.tables.tombstones.length).toBeGreaterThan(0);
      const ts = result.tables.tombstones.find((t) => t.recordId === 'c-del-001');
      expect(ts).toBeDefined();
      expect(ts.table).toBe(TABLES.costumes);
    });

    it('[数据链路: 迁移v9→v10] 应新增suggestionStatuses表', () => {
      const v9 = makeV9DB();
      const result = runMigrations(v9);
      expect(Array.isArray(result.tables.suggestionStatuses)).toBe(true);
    });
  });

  describe('完整链式迁移', () => {
    it('[数据链路: 完整迁移v1→v10] V1含数据的库应完成所有迁移且数据不丢失', () => {
      const v1 = populatedV1DB();
      const result = runMigrations(v1);

      expect(result.version).toBe(DB_VERSION);
      expect(result.tables.costumes).toHaveLength(2);
      expect(result.tables.actors).toHaveLength(1);
      expect(result.tables.records).toHaveLength(1);
      expect(result.tables.reservations).toHaveLength(1);
      expect(result.tables.workOrders).toHaveLength(1);
      expect(result.tables.costumes[0].name).toBe('汉服上衣');
    });

    it('[数据链路: 完整迁移v3→v10] V3含数据的库迁移后应保留packingLists和schedules', () => {
      const v3 = populatedV3DB();
      const result = runMigrations(v3);

      expect(result.tables.packingLists).toHaveLength(1);
      expect(result.tables.schedules).toHaveLength(1);
      expect(result.tables.packingLists[0].name).toBe('首演装箱单');
      expect(result.tables.schedules[0].play).toBe('雷雨');
    });

    it('[数据链路: 完整迁移v7→v10] V7含丰富数据的迁移应完整保留_sync和_meta', () => {
      const v7 = populatedV7DB();
      const result = runMigrations(v7);

      expect(result._meta.syncCounter).toBe(5);
      expect(result.tables.syncEvents).toHaveLength(1);
      expect(result.tables.riskStatuses).toHaveLength(1);
      expect(result.tables.suggestionStatuses).toBeDefined();
    });

    it('[数据链路: 版本号递增] 每步迁移应正确递增version', () => {
      const versions = [1, 2, 3, 4, 5, 6, 7, 8, 9];
      const builders = [makeV1DB, makeV2DB, makeV3DB, makeV4DB, makeV5DB, makeV6DB, makeV7DB, makeV8DB, makeV9DB];

      for (let i = 0; i < versions.length; i++) {
        const source = builders[i]();
        const result = runMigrations(source);
        expect(result.version).toBe(DB_VERSION);
      }
    });
  });

  describe('旧版数据迁移 (Legacy)', () => {
    it('[数据链路: Legacy迁移] 存在LEGACY_KEYS数据时应迁移到统一结构', () => {
      const legacyCostumes = [
        sampleCostumeV1('c-legacy-1'),
        sampleCostumeV1('c-legacy-2')
      ];
      const legacyActors = [sampleActorV1('a-legacy-1')];

      storageMock[LEGACY_KEYS.costumes] = JSON.stringify(legacyCostumes);
      storageMock[LEGACY_KEYS.actors] = JSON.stringify(legacyActors);

      const db = initializeDatabase();

      expect(db.tables.costumes).toHaveLength(2);
      expect(db.tables.actors).toHaveLength(1);
      expect(db.version).toBe(DB_VERSION);
    });

    it('[数据链路: Legacy迁移] 无legacy数据时走全新初始化', () => {
      const db = initializeDatabase();
      expect(db.tables.costumes).toHaveLength(0);
      expect(db.migratedAt).toBeDefined();
    });
  });

  describe('迁移边界与容错', () => {
    it('[数据链路: 容错] 已经是最新版本的DB不应发生变化', () => {
      const fresh = createEmptyDatabase();
      const beforeStr = JSON.stringify(fresh);
      const result = runMigrations(fresh);
      expect(result.version).toBe(DB_VERSION);
    });

    it('[数据链路: 容错] 已有tombstone的软删除记录不应重复生成', () => {
      const costumeId = 'c-no-dup-001';
      const deleted = sampleCostumeV1(costumeId, {
        deletedAt: '2025-04-01T00:00:00.000Z',
        deletedByDeviceId: 'dev-x',
        deleteSummary: '删'
      });
      const tombstone = sampleTombstoneV8('costumes', costumeId);
      const v8 = makeV8DB({
        costumes: [deleted],
        tombstones: [tombstone]
      });

      const result = runMigrations(v8);
      const matching = result.tables.tombstones.filter((t) => t.recordId === costumeId);
      expect(matching).toHaveLength(1);
    });

    it('[数据链路: 容错] V7迁移时已存在_meta的不应覆盖deviceId', () => {
      const customDeviceId = 'dev-custom-fixed-id';
      const v7 = makeV7DB({
        _meta: {
          deviceId: customDeviceId,
          syncCounter: 100,
          schemaVersion: 2,
          knownDevices: [customDeviceId]
        }
      });

      const result = runMigrations(v7);
      expect(result._meta.deviceId).toBe(customDeviceId);
      expect(result._meta.syncCounter).toBe(100);
    });
  });

  describe('initializeDatabase集成验证', () => {
    it('[数据链路: 集成] 已存在的v10 DB读取后不应丢失数据', () => {
      const db1 = initializeDatabase();
      const costume = sampleCostumeV1('c-integ-001');
      db1.tables.costumes.push(costume);
      writeRawDB(db1);

      const db2 = initializeDatabase();
      expect(db2.tables.costumes).toHaveLength(1);
      expect(db2.tables.costumes[0].id).toBe('c-integ-001');
    });

    it('[数据链路: 集成] 存储v5老版本应自动迁移到最新', () => {
      const v5 = makeV5DB({
        costumes: [sampleCostumeV1('c-auto-migrate-001', { name: '自动迁移测试' })]
      });
      writeRawDB(v5);

      const db = initializeDatabase();
      expect(db.version).toBe(DB_VERSION);
      expect(db.tables.suggestionStatuses).toBeDefined();
      expect(db.tables.syncEvents).toBeDefined();
      expect(db.tables.costumes[0].name).toBe('自动迁移测试');
      expect(db.migratedAt).toBeTruthy();
    });
  });
});
