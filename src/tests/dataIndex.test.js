import { describe, it, expect, beforeEach } from 'vitest';
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
  TABLES.costumes, TABLES.actors, TABLES.schedules, TABLES.workOrders,
  TABLES.reservations, TABLES.packingLists
]);

const WORK_ORDER_ACTIVE_STATUSES_SET = new Set(['待清洗', '清洗中', '待维修', '维修中']);

function deepClone(o) { return JSON.parse(JSON.stringify(o)); }

function _isSoftDeleted(record, table) {
  if (!SOFT_DELETE_TABLES.has(table)) return false;
  return !!(record && record.deletedAt);
}

class MiniDataIndex {
  constructor() {
    this._stats = { buildCount: 0, lastBuildTime: 0 };
    this._indexes = {};
    this._searchIndex = {
      costumes: new Map(),
      records: new Map(),
      reservations: new Map(),
      workOrders: new Map(),
      schedules: new Map(),
      packingLists: new Map(),
      inventoryItems: new Map(),
      actors: new Map(),
      inventoryTasks: new Map(),
      risks: new Map()
    };
    this._relationIndex = {
      costumeToSchedules: new Map(),
      costumeToReservations: new Map(),
      costumeToWorkOrders: new Map(),
      costumeToPackingLists: new Map(),
      costumeToInventoryItems: new Map(),
      costumeToRecords: new Map(),
      scheduleToCostumes: new Map(),
      scheduleToReservations: new Map(),
      scheduleToPackingLists: new Map(),
      playToCostumes: new Map(),
      playToSchedules: new Map(),
      dateToSchedules: new Map(),
      workOrderStatusToCount: new Map(),
      costumeStatusToCount: new Map()
    };
    this._searchTokensCache = new Map();
    this._initIndexes();
  }

  _initIndexes() {
    this._indexes = {
      costumes: { byId: new Map(), byPlay: new Map(), byStatus: new Map(), byClean: new Map(), byPlayAndStatus: new Map(), byBorrower: new Map(), allActive: [] },
      records: { byId: new Map(), byCostumeId: new Map(), byType: new Map(), byOperator: new Map() },
      reservations: { byId: new Map(), byCostumeId: new Map(), byPlay: new Map(), byDate: new Map(), byPlayAndDate: new Map(), byStatus: new Map(), byReservedFor: new Map(), activeByPlayAndDate: new Map() },
      workOrders: { byId: new Map(), byCostumeId: new Map(), byPlay: new Map(), byStatus: new Map(), byType: new Map(), activeByCostumeId: new Map() },
      actors: { byId: new Map(), byName: new Map(), byPlay: new Map() },
      packingLists: { byId: new Map(), byPlay: new Map(), byPerformanceDate: new Map(), byPlayAndDate: new Map(), costumeRefs: new Map() },
      schedules: { byId: new Map(), byPlay: new Map(), byDate: new Map(), byPlayAndDate: new Map(), byStatus: new Map(), linkedCostumes: new Map(), costumeRefs: new Map(), upcoming30Days: [] },
      inventoryTasks: { byId: new Map(), byStatus: new Map(), byPlayFilter: new Map() },
      inventoryItems: { byId: new Map(), byTaskId: new Map(), byCostumeId: new Map(), byTaskIdAndStatus: new Map() },
      riskStatuses: { byId: new Map(), byRiskKey: new Map(), byStatus: new Map() },
      suggestionStatuses: { byId: new Map(), bySuggestionKey: new Map(), byScheduleId: new Map(), byScheduleAndCostume: new Map(), byStatus: new Map() },
      events: { byId: new Map(), byTable: new Map(), byRecordId: new Map(), byDeviceId: new Map(), all: [] },
      tombstones: { byId: new Map(), byTable: new Map(), byTableAndRecordId: new Map(), all: [] }
    };
    for (const k of Object.keys(this._searchIndex)) this._searchIndex[k].clear();
  }

  _addToMap(map, key, value) {
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(value);
  }

  _addToNestedMap(map, key1, key2, value) {
    if (!map.has(key1)) map.set(key1, new Map());
    const inner = map.get(key1);
    if (!inner.has(key2)) inner.set(key2, []);
    inner.get(key2).push(value);
  }

  _tokenize(text) {
    if (!text) return [];
    const str = String(text).toLowerCase().trim();
    if (!str) return [];
    const cached = this._searchTokensCache.get(str);
    if (cached) return cached;
    const tokens = new Set();
    const words = str.split(/[\s,，。、；;：:（）()【】\[\]"'「」\/\\\-_.]+/).filter(Boolean);
    for (const w of words) {
      if (w.length >= 1) tokens.add(w);
      for (let i = 0; i < w.length; i++) {
        for (let j = i + 1; j <= Math.min(i + 6, w.length); j++) {
          const sub = w.slice(i, j);
          if (sub.length >= 1) tokens.add(sub);
        }
      }
    }
    const result = [...tokens];
    this._searchTokensCache.set(str, result);
    return result;
  }

  _addToSearchIndex(table, record, fields) {
    const idx = this._searchIndex[table];
    if (!idx) return;
    const texts = fields.map((f) => record[f] || '').join(' ');
    const tokens = this._tokenize(texts);
    for (const t of tokens) this._addToMap(idx, t, record);
  }

  build(db) {
    this._initIndexes();
    const tables = db.tables || {};
    this._buildCostumeIndex(tables[TABLES.costumes] || []);
    this._buildRecordIndex(tables[TABLES.records] || []);
    this._buildReservationIndex(tables[TABLES.reservations] || []);
    this._buildWorkOrderIndex(tables[TABLES.workOrders] || []);
    this._buildActorIndex(tables[TABLES.actors] || []);
    this._buildPackingListIndex(tables[TABLES.packingLists] || []);
    this._buildScheduleIndex(tables[TABLES.schedules] || []);
    this._buildInventoryTaskIndex(tables[TABLES.inventoryTasks] || []);
    this._buildInventoryItemIndex(tables[TABLES.inventoryItems] || []);
    this._buildRiskStatusIndex(tables[TABLES.riskStatuses] || []);
    this._buildSuggestionStatusIndex(tables[TABLES.suggestionStatuses] || []);
    this._buildEventIndex(tables[TABLES.syncEvents] || []);
    this._buildTombstoneIndex(tables[TABLES.tombstones] || []);
    this._buildRelationIndexes();
    this._stats.buildCount++;
  }

  _buildCostumeIndex(records) {
    const idx = this._indexes.costumes;
    for (const r of records) {
      if (!r || !r.id) continue;
      if (_isSoftDeleted(r, TABLES.costumes)) continue;
      idx.byId.set(r.id, r);
      idx.allActive.push(r);
      this._addToMap(idx.byPlay, r.play || '', r);
      this._addToMap(idx.byStatus, r.status || '', r);
      this._addToMap(idx.byClean, r.clean || '', r);
      this._addToMap(idx.byPlayAndStatus, (r.play || '') + '|' + (r.status || ''), r);
      if (r.borrower) this._addToMap(idx.byBorrower, r.borrower, r);
      this._addToSearchIndex(TABLES.costumes, r, ['name', 'play', 'size', 'location', 'borrower', 'note']);
    }
  }

  _buildRecordIndex(records) {
    const idx = this._indexes.records;
    for (const r of records) {
      if (!r || !r.id) continue;
      idx.byId.set(r.id, r);
      if (r.costumeId) this._addToMap(idx.byCostumeId, r.costumeId, r);
      if (r.type) this._addToMap(idx.byType, r.type, r);
      if (r.operator) this._addToMap(idx.byOperator, r.operator, r);
      this._addToSearchIndex(TABLES.records, r, ['costumeName', 'play', 'operator', 'summary', 'type']);
    }
  }

  _buildReservationIndex(records) {
    const idx = this._indexes.reservations;
    for (const r of records) {
      if (!r || !r.id) continue;
      if (_isSoftDeleted(r, TABLES.reservations)) continue;
      idx.byId.set(r.id, r);
      if (r.costumeId) this._addToMap(idx.byCostumeId, r.costumeId, r);
      const play = r.play || '';
      const date = r.date || '';
      this._addToMap(idx.byPlay, play, r);
      this._addToMap(idx.byDate, date, r);
      this._addToMap(idx.byPlayAndDate, play + '|' + date, r);
      this._addToMap(idx.byStatus, r.status || '', r);
      if (r.reservedFor) this._addToMap(idx.byReservedFor, r.reservedFor, r);
      if (r.status === 'active') this._addToNestedMap(idx.activeByPlayAndDate, play, date, r);
      this._addToSearchIndex(TABLES.reservations, r, ['costumeName', 'play', 'reservedFor', 'note']);
    }
  }

  _buildWorkOrderIndex(records) {
    const idx = this._indexes.workOrders;
    for (const r of records) {
      if (!r || !r.id) continue;
      if (_isSoftDeleted(r, TABLES.workOrders)) continue;
      idx.byId.set(r.id, r);
      if (r.costumeId) {
        this._addToMap(idx.byCostumeId, r.costumeId, r);
        if (WORK_ORDER_ACTIVE_STATUSES_SET.has(r.status)) {
          this._addToMap(idx.activeByCostumeId, r.costumeId, r);
        }
      }
      this._addToMap(idx.byPlay, r.play || '', r);
      this._addToMap(idx.byStatus, r.status || '', r);
      this._addToMap(idx.byType, r.type || '', r);
      this._addToSearchIndex(TABLES.workOrders, r, ['costumeName', 'play', 'assignee', 'note', 'type', 'status']);
    }
  }

  _buildActorIndex(records) {
    const idx = this._indexes.actors;
    for (const r of records) {
      if (!r || !r.id) continue;
      if (_isSoftDeleted(r, TABLES.actors)) continue;
      idx.byId.set(r.id, r);
      this._addToMap(idx.byName, r.name || '', r);
      const plays = Array.isArray(r.plays) ? r.plays : [r.play || ''];
      for (const p of plays) if (p) this._addToMap(idx.byPlay, p, r);
      this._addToSearchIndex(TABLES.actors, r, ['name', 'size', 'role', 'note']);
    }
  }

  _buildPackingListIndex(records) {
    const idx = this._indexes.packingLists;
    for (const r of records) {
      if (!r || !r.id) continue;
      if (_isSoftDeleted(r, TABLES.packingLists)) continue;
      idx.byId.set(r.id, r);
      const play = r.play || '';
      const date = r.performanceDate || '';
      this._addToMap(idx.byPlay, play, r);
      this._addToMap(idx.byPerformanceDate, date, r);
      this._addToMap(idx.byPlayAndDate, play + '|' + date, r);
      if (Array.isArray(r.items)) {
        for (const item of r.items) {
          if (item.costumeId) this._addToMap(idx.costumeRefs, item.costumeId, r);
        }
      }
      this._addToSearchIndex(TABLES.packingLists, r, ['name', 'play', 'note']);
    }
  }

  _buildScheduleIndex(records) {
    const idx = this._indexes.schedules;
    const today = new Date();
    const future = new Date(today);
    future.setDate(future.getDate() + 30);
    const todayStr = today.toISOString().slice(0, 10);
    const futureStr = future.toISOString().slice(0, 10);
    const upcoming = [];
    for (const r of records) {
      if (!r || !r.id) continue;
      if (_isSoftDeleted(r, TABLES.schedules)) continue;
      idx.byId.set(r.id, r);
      const play = r.play || '';
      const date = r.date || '';
      this._addToMap(idx.byPlay, play, r);
      this._addToMap(idx.byDate, date, r);
      this._addToMap(idx.byPlayAndDate, play + '|' + date, r);
      this._addToMap(idx.byStatus, r.status || '', r);
      const linkedIds = r.linkedCostumeIds || [];
      if (linkedIds.length > 0) {
        idx.linkedCostumes.set(r.id, linkedIds);
        for (const cid of linkedIds) this._addToMap(idx.costumeRefs, cid, r);
      }
      if (date >= todayStr && date <= futureStr) upcoming.push(r);
      this._addToSearchIndex(TABLES.schedules, r, ['play', 'venue', 'note', 'status']);
    }
    idx.upcoming30Days = upcoming.sort((a, b) => a.date.localeCompare(b.date) || (a.time || '').localeCompare(b.time || ''));
  }

  _buildInventoryTaskIndex(records) {
    const idx = this._indexes.inventoryTasks;
    for (const r of records) {
      if (!r || !r.id) continue;
      idx.byId.set(r.id, r);
      this._addToMap(idx.byStatus, r.status || '', r);
      this._addToMap(idx.byPlayFilter, r.playFilter || '全部剧目', r);
      this._addToSearchIndex(TABLES.inventoryTasks, r, ['name', 'playFilter', 'note']);
    }
  }

  _buildInventoryItemIndex(records) {
    const idx = this._indexes.inventoryItems;
    for (const r of records) {
      if (!r || !r.id) continue;
      idx.byId.set(r.id, r);
      if (r.taskId) {
        this._addToMap(idx.byTaskId, r.taskId, r);
        this._addToNestedMap(idx.byTaskIdAndStatus, r.taskId, r.actualStatus || '待盘点', r);
      }
      if (r.costumeId) this._addToMap(idx.byCostumeId, r.costumeId, r);
      this._addToSearchIndex(TABLES.inventoryItems, r, ['costumeName', 'costumePlay', 'note', 'expectedLocation']);
    }
  }

  _buildRiskStatusIndex(records) {
    const idx = this._indexes.riskStatuses;
    for (const r of records) {
      if (!r || !r.id) continue;
      idx.byId.set(r.id, r);
      if (r.riskKey) idx.byRiskKey.set(r.riskKey, r);
      this._addToMap(idx.byStatus, r.status || '', r);
    }
  }

  _buildSuggestionStatusIndex(records) {
    const idx = this._indexes.suggestionStatuses;
    for (const r of records) {
      if (!r || !r.id) continue;
      idx.byId.set(r.id, r);
      if (r.suggestionKey) idx.bySuggestionKey.set(r.suggestionKey, r);
      if (r.scheduleId) this._addToMap(idx.byScheduleId, r.scheduleId, r);
      if (r.scheduleId && r.costumeId) idx.byScheduleAndCostume.set(`${r.scheduleId}|${r.costumeId}`, r);
      this._addToMap(idx.byStatus, r.status || '', r);
    }
  }

  _buildEventIndex(records) {
    const idx = this._indexes.events;
    for (const r of records) {
      if (!r || !r.id) continue;
      idx.byId.set(r.id, r);
      idx.all.push(r);
      if (r.table) this._addToMap(idx.byTable, r.table, r);
      if (r.table && r.recordId) this._addToMap(idx.byRecordId, `${r.table}|${r.recordId}`, r);
      if (r.deviceId) this._addToMap(idx.byDeviceId, r.deviceId, r);
    }
    idx.all.sort((a, b) => (a.timestamp || '').localeCompare(b.timestamp || ''));
  }

  _buildTombstoneIndex(records) {
    const idx = this._indexes.tombstones;
    for (const r of records) {
      if (!r || !r.id) continue;
      idx.byId.set(r.id, r);
      idx.all.push(r);
      if (r.table) this._addToMap(idx.byTable, r.table, r);
      if (r.table && r.recordId) idx.byTableAndRecordId.set(`${r.table}|${r.recordId}`, r);
    }
  }

  _buildRelationIndexes() {
    const rel = this._relationIndex;
    for (const key of Object.keys(rel)) rel[key].clear();
    for (const c of this._indexes.costumes.allActive) {
      this._addToMap(rel.playToCostumes, c.play || '', c);
      this._addToMap(rel.costumeStatusToCount, c.status || '', 1);
    }
    for (const s of this._indexes.schedules.byId.values()) {
      this._addToMap(rel.playToSchedules, s.play || '', s);
      this._addToMap(rel.dateToSchedules, s.date || '', s);
      const linkedIds = s.linkedCostumeIds || [];
      rel.scheduleToCostumes.set(s.id, linkedIds);
      for (const cid of linkedIds) this._addToMap(rel.costumeToSchedules, cid, s);
    }
    for (const wo of this._indexes.workOrders.byId.values()) {
      if (wo.costumeId) this._addToMap(rel.costumeToWorkOrders, wo.costumeId, wo);
      this._addToMap(rel.workOrderStatusToCount, wo.status || '', 1);
    }
    for (const rv of this._indexes.reservations.byId.values()) {
      if (rv.costumeId) this._addToMap(rel.costumeToReservations, rv.costumeId, rv);
    }
    for (const r of this._indexes.records.byId.values()) {
      if (r.costumeId) this._addToMap(rel.costumeToRecords, r.costumeId, r);
    }
    for (const ii of this._indexes.inventoryItems.byId.values()) {
      if (ii.costumeId) this._addToMap(rel.costumeToInventoryItems, ii.costumeId, ii);
    }
  }

  getActiveCostumes() { return [...this._indexes.costumes.allActive].filter(c => !c.deletedAt); }
  getCostumeById(id) { return this._indexes.costumes.byId.get(id) || null; }
  getCostumesByPlayFast(play) { return this._indexes.costumes.byPlay.get(play) || []; }
  getCostumesByStatusFast(status) { return this._indexes.costumes.byStatus.get(status) || []; }
  getSchedulesForCostume(costumeId) { return this._relationIndex.costumeToSchedules.get(costumeId) || []; }
  getWorkOrdersForCostume(costumeId) { return this._relationIndex.costumeToWorkOrders.get(costumeId) || []; }
  getReservationsForCostume(costumeId) { return this._relationIndex.costumeToReservations.get(costumeId) || []; }
  getRecordsForCostume(costumeId) { return this._relationIndex.costumeToRecords.get(costumeId) || []; }
  getCostumesForSchedule(scheduleId) {
    const ids = this._relationIndex.scheduleToCostumes.get(scheduleId) || [];
    return ids.map(id => this.getCostumeById(id)).filter(Boolean);
  }
  getSchedulesByPlayFast(play) { return this._indexes.schedules.byPlay.get(play) || []; }
  getSchedulesByDateFast(date) { return this._indexes.schedules.byDate.get(date) || []; }
  getUpcomingSchedules30Days() { return [...this._indexes.schedules.upcoming30Days]; }
  getAllRecords() { return [...this._indexes.records.byId.values()]; }
  getAllWorkOrders() { return [...this._indexes.workOrders.byId.values()]; }
  getAllReservations() { return [...this._indexes.reservations.byId.values()]; }
  getAllActors() { return [...this._indexes.actors.byId.values()]; }
  getAllPackingLists() { return [...this._indexes.packingLists.byId.values()]; }
  getAllSchedules() { return [...this._indexes.schedules.byId.values()]; }
  getScheduleById(id) { return this._indexes.schedules.byId.get(id) || null; }

  search(table, query) {
    const idx = this._searchIndex[table];
    if (!idx || !query || !query.trim()) {
      return [...(this._indexes[table]?.byId?.values() || [])];
    }
    const tokens = this._tokenize(query);
    if (tokens.length === 0) return [...(this._indexes[table]?.byId?.values() || [])];
    const results = new Map();
    for (const t of tokens) {
      const matches = idx.get(t);
      if (!matches) continue;
      for (const r of matches) results.set(r.id, (results.get(r.id) || 0) + 1);
    }
    return [...results.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => this._indexes[table]?.byId?.get(id)).filter(Boolean);
  }

  getStats() { return { ...this._stats }; }
}

function buildDBFromBackup() {
  const data = backupForIndexTest();
  return deepClone(data);
}

describe('数据索引构建与查询链路验证', () => {
  let idx;

  beforeEach(() => {
    idx = new MiniDataIndex();
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
      const zaiKu = idx.getCostumesByStatusFast('在库');
      expect(zaiKu).toHaveLength(3);
      const jieChu = idx.getCostumesByStatusFast('借出');
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
