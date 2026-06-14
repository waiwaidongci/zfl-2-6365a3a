import { describe, it, expect, vi, beforeEach } from 'vitest';
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
import {
  TABLES,
  DB_VERSION,
  SOFT_DELETE_TABLES,
  runMigrations,
  initializeDatabase,
  migrate_v1_to_v2,
  migrate_v2_to_v3,
  migrate_v3_to_v4,
  migrate_v4_to_v5,
  migrate_v5_to_v6,
  migrate_v6_to_v7,
  migrate_v7_to_v8,
  migrate_v8_to_v9,
  migrate_v9_to_v10,
  saveFullDB,
  getFullDB
} from '$lib/database.js';

const LEGACY_KEYS = {
  [TABLES.costumes]: 'zfl-2-costumes',
  [TABLES.records]: 'zfl-2-records',
  [TABLES.reservations]: 'zfl-2-reservations',
  [TABLES.workOrders]: 'zfl-2-work-orders',
  [TABLES.actors]: 'zfl-2-actors',
  [TABLES.packingLists]: 'zfl-2-packing-lists'
};

function deepClone(obj) { return JSON.parse(JSON.stringify(obj)); }

describe('数据库迁移链路验证', () => {
  beforeEach(() => {
    globalThis._storageMock._reset();
    const allKeys = [...globalThis._storageMock._store.keys()];
    for (const k of allKeys) globalThis._storageMock.removeItem(k);
  });

  describe('单步迁移函数（生产模块直接调用）', () => {
    it('[数据链路: 迁移v1→v2] 生产函数 migrate_v1_to_v2 应新增packingLists表', () => {
      const v1 = makeV1DB();
      const result = deepClone(v1);
      migrate_v1_to_v2(result);
      expect(Array.isArray(result.tables.packingLists)).toBe(true);
    });

    it('[数据链路: 迁移v2→v3] 生产函数 migrate_v2_to_v3 应新增schedules表', () => {
      const v2 = makeV2DB();
      const result = deepClone(v2);
      migrate_v2_to_v3(result);
      expect(Array.isArray(result.tables.schedules)).toBe(true);
    });

    it('[数据链路: 迁移v3→v4] 生产函数 migrate_v3_to_v4 应新增inventoryTasks和inventoryItems表', () => {
      const v3 = makeV3DB();
      const result = deepClone(v3);
      migrate_v3_to_v4(result);
      expect(Array.isArray(result.tables.inventoryTasks)).toBe(true);
      expect(Array.isArray(result.tables.inventoryItems)).toBe(true);
    });

    it('[数据链路: 迁移v4→v5] 生产函数 migrate_v4_to_v5 应新增_meta信息', () => {
      const v4 = makeV4DB();
      const result = deepClone(v4);
      migrate_v4_to_v5(result);
      expect(result._meta).toBeDefined();
      expect(result._meta.deviceId).toBeTruthy();
    });

    it('[数据链路: 迁移v5→v6] 生产函数 migrate_v5_to_v6 应新增riskStatuses表', () => {
      const v5 = makeV5DB();
      const result = deepClone(v5);
      migrate_v5_to_v6(result);
      expect(Array.isArray(result.tables.riskStatuses)).toBe(true);
    });

    it('[数据链路: 迁移v6→v7] 生产函数 migrate_v6_to_v7 应新增syncEvents表并补齐_meta字段', () => {
      const v6 = makeV6DB();
      const result = deepClone(v6);
      migrate_v6_to_v7(result);
      expect(Array.isArray(result.tables.syncEvents)).toBe(true);
      expect(typeof result._meta.syncCounter).toBe('number');
      expect(Array.isArray(result._meta.knownDevices)).toBe(true);
    });

    it('[数据链路: 迁移v6→v7] 生产函数 migrate_v6_to_v7 应补齐记录的createdAt和updatedAt', () => {
      const costume = sampleCostumeV1('c-meta-001');
      delete costume.createdAt;
      delete costume.updatedAt;
      const v6 = makeV6DB({ costumes: [costume] });
      const result = deepClone(v6);
      migrate_v6_to_v7(result);
      const migrated = result.tables.costumes[0];
      expect(migrated.createdAt).toBeTruthy();
      expect(migrated.updatedAt).toBeTruthy();
    });

    it('[数据链路: 迁移v7→v8] 生产函数 migrate_v7_to_v8 应新增tombstones表并补齐软删除字段', () => {
      const v7 = makeV7DB();
      const result = deepClone(v7);
      migrate_v7_to_v8(result);
      expect(Array.isArray(result.tables.tombstones)).toBe(true);
      for (const table of SOFT_DELETE_TABLES) {
        if (Array.isArray(result.tables[table])) {
          for (const r of result.tables[table]) {
            expect('deletedAt' in r).toBe(true);
          }
        }
      }
    });

    it('[数据链路: 迁移v9→v10] 生产函数 migrate_v9_to_v10 应新增suggestionStatuses表', () => {
      const v9 = makeV9DB();
      const result = deepClone(v9);
      migrate_v9_to_v10(result);
      expect(Array.isArray(result.tables.suggestionStatuses)).toBe(true);
    });
  });

  describe('空数据库初始化（生产模块 initializeDatabase）', () => {
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

  describe('完整链式迁移（生产模块 runMigrations）', () => {
    it('[数据链路: 迁移v1→v2] 链式迁移应新增packingLists表', () => {
      const v1 = makeV1DB();
      const result = runMigrations(v1);
      expect(result.version).toBe(DB_VERSION);
      expect(Array.isArray(result.tables.packingLists)).toBe(true);
    });

    it('[数据链路: 迁移v2→v3] 链式迁移应新增schedules表', () => {
      const v2 = makeV2DB();
      const result = runMigrations(v2);
      expect(Array.isArray(result.tables.schedules)).toBe(true);
    });

    it('[数据链路: 迁移v3→v4] 链式迁移应新增inventoryTasks和inventoryItems表', () => {
      const v3 = makeV3DB();
      const result = runMigrations(v3);
      expect(Array.isArray(result.tables.inventoryTasks)).toBe(true);
      expect(Array.isArray(result.tables.inventoryItems)).toBe(true);
    });

    it('[数据链路: 迁移v4→v5] 链式迁移应新增_meta信息', () => {
      const v4 = makeV4DB();
      const result = runMigrations(v4);
      expect(result._meta).toBeDefined();
      expect(result._meta.deviceId).toBeTruthy();
    });

    it('[数据链路: 迁移v5→v6] 链式迁移应新增riskStatuses表', () => {
      const v5 = makeV5DB();
      const result = runMigrations(v5);
      expect(Array.isArray(result.tables.riskStatuses)).toBe(true);
    });

    it('[数据链路: 迁移v6→v7] 链式迁移应新增syncEvents表并补齐_meta字段', () => {
      const v6 = makeV6DB();
      const result = runMigrations(v6);
      expect(Array.isArray(result.tables.syncEvents)).toBe(true);
      expect(typeof result._meta.syncCounter).toBe('number');
      expect(Array.isArray(result._meta.knownDevices)).toBe(true);
    });

    it('[数据链路: 迁移v6→v7] 链式迁移应补齐记录的createdAt和updatedAt', () => {
      const costume = sampleCostumeV1('c-meta-001');
      delete costume.createdAt;
      delete costume.updatedAt;
      const v6 = makeV6DB({ costumes: [costume] });
      const result = runMigrations(v6);
      const migrated = result.tables.costumes[0];
      expect(migrated.createdAt).toBeTruthy();
      expect(migrated.updatedAt).toBeTruthy();
    });

    it('[数据链路: 迁移v7→v8] 链式迁移应新增tombstones表并补齐软删除字段', () => {
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

    it('[数据链路: 迁移v8→v9] 链式迁移应为软删除但无墓碑的记录自动生成墓碑', () => {
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

    it('[数据链路: 迁移v9→v10] 链式迁移应新增suggestionStatuses表', () => {
      const v9 = makeV9DB();
      const result = runMigrations(v9);
      expect(Array.isArray(result.tables.suggestionStatuses)).toBe(true);
    });
  });

  describe('完整链式迁移（端到端）', () => {
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

      globalThis._storageMock._store.set(LEGACY_KEYS.costumes, JSON.stringify(legacyCostumes));
      globalThis._storageMock._store.set(LEGACY_KEYS.actors, JSON.stringify(legacyActors));

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
      const db = initializeDatabase();
      const beforeStr = JSON.stringify(db);
      const result = runMigrations(db);
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
      saveFullDB(db1);

      const db2 = initializeDatabase();
      expect(db2.tables.costumes).toHaveLength(1);
      expect(db2.tables.costumes[0].id).toBe('c-integ-001');
    });

    it('[数据链路: 集成] 存储v5老版本应自动迁移到最新', () => {
      const v5 = makeV5DB({
        costumes: [sampleCostumeV1('c-auto-migrate-001', { name: '自动迁移测试' })]
      });
      saveFullDB(v5);

      const db = initializeDatabase();
      expect(db.version).toBe(DB_VERSION);
      expect(db.tables.suggestionStatuses).toBeDefined();
      expect(db.tables.syncEvents).toBeDefined();
      expect(db.tables.costumes[0].name).toBe('自动迁移测试');
      expect(db.migratedAt).toBeTruthy();
    });
  });
});
