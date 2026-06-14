import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  makeValidBackupJSON,
  makeCostumeForBackup,
  makeActorForBackup,
  makeRecordForBackup,
  makeReservationForBackup,
  makeWorkOrderForBackup,
  makeScheduleForBackup,
  makeSyncEventForBackup,
  makeTombstoneForBackup,
  populatedBackupData,
  legacyFormatBackup,
  backupWithMissingTables,
  backupWithInvalidReferences,
  backupWithSoftDeletedCostumes,
  backupWithOldVersion,
  backupForIndexTest
} from './fixtures/backupFixtures.js';

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
  if (!db.tables[TABLES.packingLists]) db.tables[TABLES.packingLists] = [];
  return db;
}
function migrate_v2_to_v3(db) {
  if (!db.tables[TABLES.schedules]) db.tables[TABLES.schedules] = [];
  return db;
}
function migrate_v3_to_v4(db) {
  if (!db.tables[TABLES.inventoryTasks]) db.tables[TABLES.inventoryTasks] = [];
  if (!db.tables[TABLES.inventoryItems]) db.tables[TABLES.inventoryItems] = [];
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
  if (!db.tables[TABLES.riskStatuses]) db.tables[TABLES.riskStatuses] = [];
  return db;
}
function migrate_v6_to_v7(db) {
  if (!db.tables[TABLES.syncEvents]) db.tables[TABLES.syncEvents] = [];
  if (!db._meta) {
    db._meta = { deviceId: generateDeviceId(), syncCounter: 0, schemaVersion: 2, knownDevices: [] };
  } else {
    if (typeof db._meta.syncCounter !== 'number') db._meta.syncCounter = 0;
    if (typeof db._meta.schemaVersion !== 'number') db._meta.schemaVersion = 2;
    if (!Array.isArray(db._meta.knownDevices)) db._meta.knownDevices = [];
  }
  const now = new Date().toISOString();
  for (const table of Object.values(TABLES)) {
    if (table === TABLES.syncEvents || table === TABLES.records) continue;
    if (!Array.isArray(db.tables[table])) continue;
    for (const r of db.tables[table]) {
      if (!r.createdAt) r.createdAt = now;
      if (!r.updatedAt) r.updatedAt = r.createdAt || now;
    }
  }
  return db;
}
function migrate_v7_to_v8(db) {
  if (!db.tables[TABLES.tombstones]) db.tables[TABLES.tombstones] = [];
  for (const table of SOFT_DELETE_TABLES) {
    if (!Array.isArray(db.tables[table])) continue;
    for (const r of db.tables[table]) {
      if (r.deletedAt === undefined) { r.deletedAt = null; r.deletedByDeviceId = null; r.deleteSummary = null; }
    }
  }
  return db;
}
function migrate_v8_to_v9(db) { return db; }
function migrate_v9_to_v10(db) {
  if (!db.tables[TABLES.suggestionStatuses]) db.tables[TABLES.suggestionStatuses] = [];
  return db;
}
const MIGRATIONS = { 1: migrate_v1_to_v2, 2: migrate_v2_to_v3, 3: migrate_v3_to_v4, 4: migrate_v4_to_v5, 5: migrate_v5_to_v6, 6: migrate_v6_to_v7, 7: migrate_v7_to_v8, 8: migrate_v8_to_v9, 9: migrate_v9_to_v10 };

function runMigrations(db) {
  const currentVersion = db.version || 1;
  let migrated = deepClone(db);
  for (let v = currentVersion; v < DB_VERSION; v++) {
    const m = MIGRATIONS[v];
    if (typeof m === 'function') {
      migrated = m(migrated);
      migrated.version = v + 1;
    }
  }
  migrated.version = DB_VERSION;
  return migrated;
}

function readRawDB() {
  const raw = localStorage.getItem(DB_KEY);
  try { return raw ? JSON.parse(raw) : null; } catch (e) { return null; }
}
function writeRawDB(db) {
  try { localStorage.setItem(DB_KEY, JSON.stringify(db)); return true; }
  catch (e) { return false; }
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

export function importFullDatabase(jsonString) {
  const parseResult = parseBackupFile(jsonString);
  if (!parseResult.ok) return parseResult;
  const { db } = parseResult;
  db.migratedAt = new Date().toISOString();
  writeRawDB(db);
  return { ok: true, db };
}

export function exportFullDatabase(options = {}) {
  const raw = readRawDB() || createEmptyDatabase();
  const exportObj = {
    _meta: {
      version: raw.version,
      exportedAt: new Date().toISOString(),
      app: 'zfl-2-costume-lending',
      deviceId: raw._meta?.deviceId || null,
      lastMergeAt: raw._meta?.lastMergeAt || null,
      createdAt: raw._meta?.createdAt || null,
      syncCounter: raw._meta?.syncCounter || 0,
      schemaVersion: raw._meta?.schemaVersion || 1,
      knownDevices: raw._meta?.knownDevices || []
    },
    tables: raw.tables || {}
  };
  return JSON.stringify(exportObj, null, 2);
}

describe('备份解析与导入导出链路验证', () => {
  beforeEach(() => {
    storageMock = {};
    localStorageMock.getItem.mockImplementation((key) => (key in storageMock ? storageMock[key] : null));
    localStorageMock.setItem.mockImplementation((key, value) => { storageMock[key] = String(value); });
    localStorageMock.removeItem.mockImplementation((key) => { delete storageMock[key]; });
    localStorageMock.clear.mockImplementation(() => { storageMock = {}; });
  });

  describe('parseBackupFile 基础解析', () => {
    it('[数据链路: 备份解析] 正确JSON + tables结构应解析成功', () => {
      const backup = makeValidBackupJSON({
        costumes: [makeCostumeForBackup('c-parse-001')]
      });
      const result = parseBackupFile(JSON.stringify(backup));
      expect(result.ok).toBe(true);
      expect(result.db.version).toBe(DB_VERSION);
      expect(result.db.tables.costumes).toHaveLength(1);
    });

    it('[数据链路: 备份解析] 非法JSON应返回明确错误', () => {
      const result = parseBackupFile('{this is not json');
      expect(result.ok).toBe(false);
      expect(result.error).toContain('JSON 解析失败');
    });

    it('[数据链路: 备份解析] 非对象结构应返回格式错误', () => {
      const result = parseBackupFile(JSON.stringify('just a string'));
      expect(result.ok).toBe(false);
      expect(result.error).toContain('数据格式不正确');
    });

    it('[数据链路: 备份解析] 缺少tables应返回错误', () => {
      const result = parseBackupFile(JSON.stringify({ foo: 'bar' }));
      expect(result.ok).toBe(false);
      expect(result.error).toContain('缺少 tables 字段');
    });

    it('[数据链路: 备份解析] 旧版数组格式(仅costumes)应识别为legacy', () => {
      const legacy = legacyFormatBackup();
      const result = parseBackupFile(JSON.stringify(legacy));
      expect(result.ok).toBe(true);
      expect(result.legacyFormat).toBe(true);
      expect(result.db.tables.costumes).toHaveLength(2);
    });
  });

  describe('多版本备份自动迁移', () => {
    it('[数据链路: 备份迁移] v5备份导入后应为v10结构', () => {
      const v5Backup = backupWithOldVersion(5);
      v5Backup._meta.version = 5;
      const json = JSON.stringify(v5Backup);
      const result = parseBackupFile(json);
      expect(result.ok).toBe(true);
      expect(result.db.version).toBe(DB_VERSION);
      expect(result.db.tables.suggestionStatuses).toBeDefined();
    });

    it('[数据链路: 备份迁移] v7备份导入后保留syncEvents并迁移', () => {
      const backup = populatedBackupData();
      backup._meta.version = 7;
      const result = parseBackupFile(JSON.stringify(backup));
      expect(result.ok).toBe(true);
      expect(result.db.tables.syncEvents).toHaveLength(2);
      expect(result.db.tables.tombstones).toBeDefined();
    });
  });

  describe('缺失表与引用容错', () => {
    it('[数据链路: 容错] 备份缺少数值表应补空数组', () => {
      const partial = backupWithMissingTables();
      const result = parseBackupFile(JSON.stringify(partial));
      expect(result.ok).toBe(true);
      expect(Array.isArray(result.db.tables.actors)).toBe(true);
      expect(Array.isArray(result.db.tables.schedules)).toBe(true);
      expect(result.db.tables.actors).toHaveLength(0);
    });

    it('[数据链路: 容错] 无效引用保留原样但不中断解析', () => {
      const badRefs = backupWithInvalidReferences();
      const result = parseBackupFile(JSON.stringify(badRefs));
      expect(result.ok).toBe(true);
      expect(result.db.tables.reservations[0].costumeId).toBe('c-ref-NONEXISTENT');
    });
  });

  describe('软删除与墓碑记录', () => {
    it('[数据链路: 软删除] 含软删除服装的备份正确解析', () => {
      const data = backupWithSoftDeletedCostumes();
      const result = parseBackupFile(JSON.stringify(data));
      expect(result.ok).toBe(true);
      const deleted = result.db.tables.costumes.find((c) => c.id === 'c-del-001');
      expect(deleted).toBeDefined();
      expect(deleted.deletedAt).toBeTruthy();
      expect(result.db.tables.tombstones).toHaveLength(1);
    });
  });

  describe('_meta信息处理', () => {
    it('[数据链路: 元数据] 备份deviceId和syncCounter正确读取', () => {
      const backup = makeValidBackupJSON({
        deviceId: 'dev-custom-999',
        syncCounter: 12345,
        knownDevices: ['dev-a', 'dev-b']
      });
      const result = parseBackupFile(JSON.stringify(backup));
      expect(result.db._meta.deviceId).toBe('dev-custom-999');
      expect(result.db._meta.syncCounter).toBe(12345);
      expect(result.db._meta.knownDevices).toEqual(['dev-a', 'dev-b']);
    });

    it('[数据链路: 元数据] 缺_meta时自动生成默认值', () => {
      const backup = { tables: { costumes: [makeCostumeForBackup('c-nometa-001')] } };
      const result = parseBackupFile(JSON.stringify(backup));
      expect(result.ok).toBe(true);
      expect(result.db._meta.deviceId).toBeTruthy();
      expect(result.db._meta.syncCounter).toBeDefined();
    });
  });

  describe('importFullDatabase持久化', () => {
    it('[数据链路: 导入] 成功导入后localStorage应有新DB', () => {
      const backup = makeValidBackupJSON({
        costumes: [makeCostumeForBackup('c-imp-001', { name: '导入测试服' })]
      });
      const result = importFullDatabase(JSON.stringify(backup));
      expect(result.ok).toBe(true);
      const stored = readRawDB();
      expect(stored.tables.costumes[0].name).toBe('导入测试服');
      expect(stored.migratedAt).toBeTruthy();
    });

    it('[数据链路: 导入] 导入失败应不污染localStorage', () => {
      importFullDatabase('bad json');
      expect(readRawDB()).toBeNull();
    });
  });

  describe('exportFullDatabase导出', () => {
    it('[数据链路: 导出] 先导入再导出应保持数据一致性', () => {
      const original = populatedBackupData();
      importFullDatabase(JSON.stringify(original));

      const exported = exportFullDatabase();
      const parsed = JSON.parse(exported);

      expect(parsed._meta.app).toBe('zfl-2-costume-lending');
      expect(parsed._meta.exportedAt).toBeTruthy();
      expect(parsed.tables.costumes).toHaveLength(3);
      expect(parsed.tables.actors).toHaveLength(2);
      expect(parsed.tables.syncEvents).toHaveLength(2);
    });

    it('[数据链路: 导出] 空库导出后应包含所有表', () => {
      writeRawDB(createEmptyDatabase());
      const exported = exportFullDatabase();
      const parsed = JSON.parse(exported);
      for (const table of Object.values(TABLES)) {
        expect(Array.isArray(parsed.tables[table])).toBe(true);
      }
    });
  });

  describe('完整备份往返验证(Round-trip)', () => {
    it('[数据链路: 往返] 完整数据导入→导出→再导入应完全一致', () => {
      const source = populatedBackupData();
      const firstImport = importFullDatabase(JSON.stringify(source));
      expect(firstImport.ok).toBe(true);

      const exported = exportFullDatabase();
      localStorageMock.clear();

      const secondImport = importFullDatabase(exported);
      expect(secondImport.ok).toBe(true);

      const roundtripCostumeIds = secondImport.db.tables.costumes.map((c) => c.id).sort();
      const originalIds = source.tables.costumes.map((c) => c.id).sort();
      expect(roundtripCostumeIds).toEqual(originalIds);

      expect(secondImport.db.tables.schedules[0].linkedCostumeIds)
        .toEqual(source.tables.schedules[0].linkedCostumeIds);
    });
  });

  describe('索引测试专用数据', () => {
    it('[数据链路: 索引夹具] 索引测试备份可被正确解析', () => {
      const idxData = backupForIndexTest();
      const result = parseBackupFile(JSON.stringify(idxData));
      expect(result.ok).toBe(true);
      expect(result.db.tables.costumes).toHaveLength(5);
      expect(result.db.tables.schedules).toHaveLength(2);

      const mudanting = result.db.tables.costumes.filter((c) => c.play === '牡丹亭');
      expect(mudanting).toHaveLength(2);
    });
  });
});
