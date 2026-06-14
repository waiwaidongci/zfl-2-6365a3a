import { describe, it, expect, beforeEach } from 'vitest';
import { DataIndex } from '$lib/dataIndex.js';
import { TABLES } from '$lib/database.js';
import {
  backupForIndexTest,
  makeValidBackupJSON,
  makeCostumeForBackup,
  makeActorForBackup,
  makeReservationForBackup,
  makeWorkOrderForBackup,
  makeScheduleForBackup,
  makeRecordForBackup,
  makeSyncEventForBackup
} from './fixtures/backupFixtures.js';

function deepClone(o) { return JSON.parse(JSON.stringify(o)); }

function buildDBFromBackup() {
  const data = backupForIndexTest();
  return deepClone(data);
}

describe('数据索引构建与查询链路验证', () => {
  let idx;

  beforeEach(() => {
    idx = new DataIndex();
  });

  describe('索引构建基础', () => {
    it('[索引链路: 构建计数] 构建后buildCount应递增', () => {
      const db = buildDBFromBackup();
      idx.build(db);
      expect(idx.getStats().buildCount).toBe(1);
      idx.build(db);
      expect(idx.getStats().buildCount).toBe(2);
    });

    it('[索引链路: 完整性] 5套服装应全部入索引', () => {
      idx.build(buildDBFromBackup());
      expect(idx.getActiveCostumes()).toHaveLength(5);
    });

    it('[索引链路: 完整性] 2个排期应全部入索引', () => {
      idx.build(buildDBFromBackup());
      expect(idx.getAllSchedules()).toHaveLength(2);
    });
  });

  describe('服装维度索引', () => {
    it('[索引链路: 服装维度] 按剧目分组应正确', () => {
      idx.build(buildDBFromBackup());
      const mudanting = idx.getCostumesByPlayFast('牡丹亭');
      expect(mudanting).toHaveLength(2);
      const xixiangji = idx.getCostumesByPlayFast('西厢记');
      expect(xixiangji).toHaveLength(1);
    });

    it('[索引链路: 服装维度] 按状态分组应正确', () => {
      idx.build(buildDBFromBackup());
      const zaiKu = idx.getCostumesByStatus('在库');
      expect(zaiKu).toHaveLength(3);
      const jieChu = idx.getCostumesByStatus('借出');
      expect(jieChu).toHaveLength(1);
    });

    it('[索引链路: 服装维度] 不存在的剧目应返回空', () => {
      idx.build(buildDBFromBackup());
      const none = idx.getCostumesByPlayFast('不存在的剧目');
      expect(none).toHaveLength(0);
    });

    it('[索引链路: 服装维度] byId查询应精确', () => {
      idx.build(buildDBFromBackup());
      const c = idx.getCostumeById('c-idx-001');
      expect(c).not.toBeNull();
      expect(c.name).toBe('牡丹亭戏服');
      expect(idx.getCostumeById('no-such-id')).toBeNull();
    });
  });

  describe('关联索引(服装↔排期)', () => {
    it('[索引链路: 关联] 有服装被排期引用', () => {
      idx.build(buildDBFromBackup());
      const s1 = idx.getSchedulesForCostume('c-idx-001');
      expect(s1).toHaveLength(1);
      expect(s1[0].play).toBe('牡丹亭');
    });

    it('[索引链路: 关联] 排期反向查服装应返回2件', () => {
      idx.build(buildDBFromBackup());
      const costumes = idx.getCostumesForSchedule('s-idx-001');
      expect(costumes).toHaveLength(2);
    });

    it('[索引链路: 关联] 排期按剧目查询', () => {
      idx.build(buildDBFromBackup());
      const s = idx.getSchedulesByPlayFast('西厢记');
      expect(s).toHaveLength(1);
      expect(s[0].venue).toBe('实验剧场');
    });
  });

  describe('关联索引(服装↔工单/预约/记录)', () => {
    it('[索引链路: 关联] 服装工单查询', () => {
      idx.build(buildDBFromBackup());
      const wo = idx.getWorkOrdersForCostume('c-idx-003');
      expect(wo).toHaveLength(1);
      expect(wo[0].status).toBe('清洗中');
    });

    it('[索引链路: 关联] 服装预约查询', () => {
      idx.build(buildDBFromBackup());
      const rv = idx.getReservationsForCostume('c-idx-001');
      expect(rv).toHaveLength(1);
    });

    it('[索引链路: 关联] 服装借还记录查询', () => {
      idx.build(buildDBFromBackup());
      const recs = idx.getRecordsForCostume('c-idx-002');
      expect(recs).toHaveLength(1);
    });
  });

  describe('搜索功能验证', () => {
    it('[索引链路: 搜索] 按服装名称关键字', () => {
      idx.build(buildDBFromBackup());
      const results = idx.search(TABLES.costumes, '牡丹亭');
      expect(results.length).toBeGreaterThanOrEqual(2);
      const names = results.map(r => r.name);
      expect(names.some(n => n.includes('牡丹亭'))).toBe(true);
    });

    it('[索引链路: 搜索] 按场地关键字', () => {
      idx.build(buildDBFromBackup());
      const results = idx.search(TABLES.schedules, '主剧场');
      expect(results.length).toBeGreaterThanOrEqual(1);
      const top = results[0];
      expect(top.venue).toBe('主剧场');
      expect(top.play).toBe('牡丹亭');
    });

    it('[索引链路: 搜索] 空查询返回全部', () => {
      idx.build(buildDBFromBackup());
      const all = idx.search(TABLES.costumes, '');
      expect(all).toHaveLength(5);
    });

    it('[索引链路: 搜索] 无匹配结果', () => {
      idx.build(buildDBFromBackup());
      const none = idx.search(TABLES.costumes, 'zzz不存在的词');
      expect(none).toHaveLength(0);
    });
  });

  describe('软删除过滤', () => {
    it('[索引链路: 软删除] 构建时应过滤软删除服装', () => {
      const db = buildDBFromBackup();
      db.tables.costumes.push(makeCostumeForBackup('c-del-soft', {
        name: '已删除',
        deletedAt: '2025-01-01T00:00:00.000Z'
      }));
      idx.build(db);
      const found = idx.getActiveCostumes().find(c => c.id === 'c-del-soft');
      expect(found).toBeUndefined();
      expect(idx.getActiveCostumes()).toHaveLength(5);
    });
  });

  describe('索引重建与元数据', () => {
    it('[索引链路: 重建] 多次构建结果应一致', () => {
      const db = buildDBFromBackup();
      idx.build(db);
      const firstCount = idx.getActiveCostumes().length;
      idx.build(db);
      const secondCount = idx.getActiveCostumes().length;
      expect(firstCount).toBe(secondCount);
    });

    it('[索引链路: 重建] 新数据加入后重构建应包含', () => {
      const db = buildDBFromBackup();
      idx.build(db);
      const before = idx.getActiveCostumes().length;
      db.tables.costumes.push(makeCostumeForBackup('c-newly-added', { name: '新增服装' }));
      idx.build(db);
      const after = idx.getActiveCostumes().length;
      expect(after).toBe(before + 1);
    });
  });

  describe('按日期维度', () => {
    it('[索引链路: 日期] 排期按日期精确查询', () => {
      idx.build(buildDBFromBackup());
      const d1 = idx.getSchedulesByDateFast('2025-06-20');
      expect(d1).toHaveLength(1);
      expect(d1[0].id).toBe('s-idx-001');
    });
  });

  describe('复杂业务查询', () => {
    it('[索引链路: 统计] 空DB应正常构建', () => {
      const empty = {
        _meta: {}, tables: {
          costumes: [], schedules: [], actors: [],
          records: [], reservations: [], workOrders: [], packingLists: [],
          inventoryTasks: [], inventoryItems: [], riskStatuses: [],
          suggestionStatuses: [], syncEvents: [], tombstones: []
        }
      };
      idx.build(empty);
      expect(idx.getActiveCostumes()).toHaveLength(0);
      expect(idx.getAllSchedules()).toHaveLength(0);
    });

    it('[索引链路: 演员] 演员维度正确', () => {
      idx.build(buildDBFromBackup());
      const actors = idx.getAllActors();
      expect(actors).toHaveLength(1);
      expect(actors[0].name).toBe('演员A');
    });
  });
});
