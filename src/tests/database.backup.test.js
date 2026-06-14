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
import {
  TABLES,
  DB_VERSION,
  SOFT_DELETE_TABLES,
  parseBackupFile,
  importFullDatabase,
  exportFullDatabase,
  saveFullDB,
  getFullDB
} from '$lib/database.js';

function deepClone(obj) { return JSON.parse(JSON.stringify(obj)); }

describe('备份解析与导入导出链路验证', () => {
  beforeEach(() => {
    globalThis._storageMock._reset();
    const allKeys = [...globalThis._storageMock._store.keys()];
    for (const k of allKeys) globalThis._storageMock.removeItem(k);
  });

  describe('parseBackupFile 基础解析（生产模块直接调用）', () => {
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

  describe('多版本备份自动迁移（生产模块 runMigrations）', () => {
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

  describe('importFullDatabase持久化（生产模块）', () => {
    it('[数据链路: 导入] 成功导入后localStorage应有新DB', () => {
      const backup = makeValidBackupJSON({
        costumes: [makeCostumeForBackup('c-imp-001', { name: '导入测试服' })]
      });
      const result = importFullDatabase(JSON.stringify(backup));
      expect(result.ok).toBe(true);
      const stored = getFullDB();
      expect(stored.tables.costumes[0].name).toBe('导入测试服');
      expect(stored.migratedAt).toBeTruthy();
    });

    it('[数据链路: 导入] 导入失败应不污染localStorage', () => {
      importFullDatabase('bad json');
      const raw = globalThis._storageMock.getItem('zfl-2-database');
      expect(raw).toBeNull();
    });
  });

  describe('exportFullDatabase导出（生产模块）', () => {
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
      const empty = makeValidBackupJSON();
      saveFullDB(empty);
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
      globalThis._storageMock._reset();

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
