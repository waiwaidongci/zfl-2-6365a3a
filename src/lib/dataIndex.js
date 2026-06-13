import { TABLES, SOFT_DELETE_TABLES } from '$lib/database.js';
import { readable, derived } from 'svelte/store';

export const RISK_STATUS = {
  PENDING: '待处理',
  CONFIRMED: '已确认',
  DEFERRED: '暂缓',
  RESOLVED: '已解决'
};

export const RISK_TYPE_LABELS = {
  overdue: '逾期未还',
  borrowed: '借出中',
  cleaning: '待清洗',
  repair: '维修中',
  workorder_overdue: '工单逾期',
  workorder_late: '工单晚于演出',
  reservation_conflict: '预约冲突',
  packing_incomplete: '装箱未完成'
};

export const WORK_ORDER_ACTIVE_STATUSES_SET = new Set(['待清洗', '清洗中', '待维修', '维修中']);
export const WORK_ORDER_PENDING_SET = new Set(['待清洗', '待维修']);
export const WORK_ORDER_IN_PROGRESS_SET = new Set(['清洗中', '维修中']);

class DataIndex {
  constructor() {
    this._invalidated = true;
    this._batchMode = false;
    this._batchChanges = {
      added: new Map(),
      updated: new Map(),
      removed: new Map(),
      affectedScheduleIds: new Set()
    };
    this._stats = {
      buildCount: 0,
      lastBuildTime: 0,
      incrementalUpdates: 0,
      bulkOperations: 0,
      bulkRecordsProcessed: 0,
      riskComputationTime: 0,
      searchQueryCount: 0,
      filterQueryCount: 0,
      cacheHits: 0,
      cacheMisses: 0
    };
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
    this._searchTokensCache = new Map();
    this._riskCache = {
      dirty: true,
      byScheduleId: new Map(),
      byDate: new Map(),
      byCostumeId: new Map(),
      byPlay: new Map(),
      byLevel: new Map(),
      byStatus: new Map(),
      byType: new Map(),
      allRisks: [],
      stats: null,
      lastBuildTime: 0,
      computationCount: 0
    };
    this._filterCache = {
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
    this._summaryCache = {
      dirty: true,
      overdueCount: 0,
      borrowedCount: 0,
      cleanWaitCount: 0,
      activeReservationCount: 0,
      pendingWorkOrderCount: 0,
      inProgressWorkOrderCount: 0,
      completedWorkOrderCount: 0,
      overdueWorkOrderCount: 0,
      scheduleCount: 0,
      todayStr: ''
    };
    this._inventoryStatsCache = new Map();
    this._subscribers = new Set();
    this._syncQueue = [];
    this._dirtyScheduleIds = null;
    this._suggestionCache = {
      dirty: true,
      byScheduleId: new Map(),
      byCostumeId: new Map(),
      byPlay: new Map(),
      byStatus: new Map(),
      allSuggestions: [],
      lastBuildTime: 0,
      computationCount: 0,
      appliedSuggestions: new Map()
    };
    this._stats.suggestionComputationTime = 0;
    this._stats.suggestionCount = 0;
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
    this._initIndexes();
    this._initStore();
  }

  _initStore() {
    const self = this;
    this.store = readable(this, function start(set) {
      const unsubscribe = self.subscribe(() => set(self));
      return unsubscribe;
    });

    this.derived = {
      allCostumes: derived(this.store, $index => $index.getActiveCostumes()),
      allActiveCostumes: derived(this.store, $index => $index.getActiveCostumes()),
      allRecords: derived(this.store, $index => $index.getAllRecords()),
      allReservations: derived(this.store, $index => $index.getAllReservations()),
      allWorkOrders: derived(this.store, $index => $index.getAllWorkOrders()),
      allActors: derived(this.store, $index => $index.getAllActors()),
      allPackingLists: derived(this.store, $index => $index.getAllPackingLists()),
      allSchedules: derived(this.store, $index => $index.getAllSchedules()),
      allInventoryTasks: derived(this.store, $index => $index.getAllInventoryTasks()),
      allInventoryItems: derived(this.store, $index => $index.getAllInventoryItems()),
      allRiskStatuses: derived(this.store, $index => $index.getAllRiskStatuses()),

      allRisks: derived(this.store, $index => $index.computeAllRisks()),

      summaryStats: derived(this.store, $index => $index.getSummaryStats()),

      uniquePlays: derived(this.store, $index => $index.getAllPlays()),
      uniqueCostumePlays: derived(this.store, $index => $index.getUniqueCostumePlaysSorted()),
      uniqueSchedulePlays: derived(this.store, $index => $index.getUniqueSchedulePlaysSorted()),

      upcomingSchedules: derived(this.store, $index => $index.getUpcomingSchedules30Days()),

      costumesAvailableForWorkOrder: derived(this.store, $index => $index.getCostumesAvailableForWorkOrder()),

      overdueCount: derived(this.store, $index => $index.getOverdueCount()),
      borrowedCount: derived(this.store, $index => $index.getBorrowedCount()),
      cleanWaitCount: derived(this.store, $index => $index.getCleanWaitCount()),
      activeReservationCount: derived(this.store, $index => $index.getActiveReservationCount()),
      pendingWorkOrderCount: derived(this.store, $index => $index.getPendingWorkOrderCount()),
      inProgressWorkOrderCount: derived(this.store, $index => $index.getInProgressWorkOrderCount()),
      completedWorkOrderCount: derived(this.store, $index => $index.getCompletedWorkOrderCount()),
      overdueWorkOrderCount: derived(this.store, $index => $index.getOverdueWorkOrderCount()),
      scheduleCount: derived(this.store, $index => $index.getScheduleCount())
    };

    this.derived.riskStats = derived(
      [this.store, this.derived.allRisks],
      ([$index, $risks]) => $index.getRiskStats($risks)
    );
  }

  _initIndexes() {
    this._indexes = {
      costumes: {
        byId: new Map(),
        byPlay: new Map(),
        byStatus: new Map(),
        byClean: new Map(),
        byPlayAndStatus: new Map(),
        byBorrower: new Map(),
        allActive: []
      },
      records: {
        byId: new Map(),
        byCostumeId: new Map(),
        byType: new Map(),
        byOperator: new Map()
      },
      reservations: {
        byId: new Map(),
        byCostumeId: new Map(),
        byPlay: new Map(),
        byDate: new Map(),
        byPlayAndDate: new Map(),
        byStatus: new Map(),
        byReservedFor: new Map(),
        activeByPlayAndDate: new Map()
      },
      workOrders: {
        byId: new Map(),
        byCostumeId: new Map(),
        byPlay: new Map(),
        byStatus: new Map(),
        byType: new Map(),
        activeByCostumeId: new Map()
      },
      actors: {
        byId: new Map(),
        byName: new Map(),
        byPlay: new Map()
      },
      packingLists: {
        byId: new Map(),
        byPlay: new Map(),
        byPerformanceDate: new Map(),
        byPlayAndDate: new Map(),
        costumeRefs: new Map()
      },
      schedules: {
        byId: new Map(),
        byPlay: new Map(),
        byDate: new Map(),
        byPlayAndDate: new Map(),
        byStatus: new Map(),
        linkedCostumes: new Map(),
        costumeRefs: new Map(),
        upcoming30Days: []
      },
      inventoryTasks: {
        byId: new Map(),
        byStatus: new Map(),
        byPlayFilter: new Map()
      },
      inventoryItems: {
        byId: new Map(),
        byTaskId: new Map(),
        byCostumeId: new Map(),
        byTaskIdAndStatus: new Map()
      },
      riskStatuses: {
        byId: new Map(),
        byRiskKey: new Map(),
        byStatus: new Map()
      },
      events: {
        byId: new Map(),
        byTable: new Map(),
        byRecordId: new Map(),
        byDeviceId: new Map(),
        all: []
      },
      tombstones: {
        byId: new Map(),
        byTable: new Map(),
        byTableAndRecordId: new Map(),
        all: []
      }
    };
    for (const k of Object.keys(this._searchIndex)) {
      this._searchIndex[k].clear();
    }
  }

  subscribe(fn) {
    if (!this._subscribers) this._subscribers = new Set();
    this._subscribers.add(fn);
    fn(this);
    return () => this._subscribers.delete(fn);
  }

  notify() {
    if (this._subscribers) {
      for (const fn of this._subscribers) {
        try { fn(this); } catch (e) { console.error('[Index] subscriber error:', e); }
      }
    }
  }

  invalidate() {
    this._invalidated = true;
    this._riskCache.dirty = true;
    this._suggestionCache.dirty = true;
    this._dirtyScheduleIds = null;
    this.invalidateFilterCaches();
    this.invalidateSummaryCache();
    this.notify();
  }

  invalidateRisks() {
    this._riskCache.dirty = true;
    this._suggestionCache.dirty = true;
    this._dirtyScheduleIds = null;
    this.invalidateFilterCaches();
    this.notify();
  }

  invalidateSuggestions(scheduleIds = null) {
    this._suggestionCache.dirty = true;
    if (scheduleIds) {
      for (const sid of scheduleIds) {
        this._suggestionCache.byScheduleId.delete(sid);
      }
    } else {
      this._suggestionCache.byScheduleId.clear();
    }
    this.notify();
  }

  invalidateFilterCaches() {
    for (const key of Object.keys(this._filterCache)) {
      this._filterCache[key].clear();
    }
  }

  invalidateSummaryCache() {
    this._summaryCache.dirty = true;
  }

  _cacheKey(params) {
    const keys = Object.keys(params).sort();
    const parts = [];
    for (const k of keys) {
      const v = params[k];
      if (v === undefined || v === null || v === '') {
        parts.push(`${k}:`);
      } else if (Array.isArray(v)) {
        parts.push(`${k}:${v.join(',')}`);
      } else if (typeof v === 'object') {
        parts.push(`${k}:${JSON.stringify(v)}`);
      } else {
        parts.push(`${k}:${v}`);
      }
    }
    return parts.join('|');
  }

  getAllSyncQueue() {
    return Array.isArray(this._syncQueue) ? this._syncQueue : [];
  }

  _isSoftDeleted(record, table) {
    if (!SOFT_DELETE_TABLES.has(table)) return false;
    return !!(record && record.deletedAt);
  }

  getStats() {
    return { ...this._stats };
  }

  _addToMap(map, key, value) {
    if (!map.has(key)) {
      map.set(key, []);
    }
    map.get(key).push(value);
  }

  _addToNestedMap(map, key1, key2, value) {
    if (!map.has(key1)) {
      map.set(key1, new Map());
    }
    const inner = map.get(key1);
    if (!inner.has(key2)) {
      inner.set(key2, []);
    }
    inner.get(key2).push(value);
  }

  _removeFromMap(map, key, valueOrPredicate) {
    if (!map.has(key)) return;
    const arr = map.get(key);
    const predicate = typeof valueOrPredicate === 'function'
      ? valueOrPredicate
      : (v) => v === valueOrPredicate || (v && valueOrPredicate && v.id === valueOrPredicate.id);
    const newArr = arr.filter((v) => !predicate(v));
    if (newArr.length === 0) {
      map.delete(key);
    } else {
      map.set(key, newArr);
    }
  }

  _removeFromNestedMap(map, key1, key2, valueOrPredicate) {
    if (!map.has(key1)) return;
    const inner = map.get(key1);
    if (!inner.has(key2)) return;
    const arr = inner.get(key2);
    const predicate = typeof valueOrPredicate === 'function'
      ? valueOrPredicate
      : (v) => v === valueOrPredicate || (v && valueOrPredicate && v.id === valueOrPredicate.id);
    const newArr = arr.filter((v) => !predicate(v));
    if (newArr.length === 0) {
      inner.delete(key2);
      if (inner.size === 0) {
        map.delete(key1);
      }
    } else {
      inner.set(key2, newArr);
    }
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
      const len = Math.min(w.length, 6);
      for (let i = 0; i < w.length; i++) {
        for (let j = i + 1; j <= Math.min(i + 6, w.length); j++) {
          const sub = w.slice(i, j);
          if (sub.length >= 1) tokens.add(sub);
        }
      }
    }

    const result = [...tokens];
    if (this._searchTokensCache.size > 10000) {
      this._searchTokensCache.clear();
    }
    this._searchTokensCache.set(str, result);
    return result;
  }

  _addToSearchIndex(table, record, fields) {
    const idx = this._searchIndex[table];
    if (!idx) return;
    const texts = fields.map((f) => record[f] || '').join(' ');
    const tokens = this._tokenize(texts);
    for (const t of tokens) {
      this._addToMap(idx, t, record);
    }
  }

  _removeFromSearchIndex(table, record, fields) {
    const idx = this._searchIndex[table];
    if (!idx) return;
    const texts = fields.map((f) => record[f] || '').join(' ');
    const tokens = this._tokenize(texts);
    const id = record.id;
    for (const t of tokens) {
      this._removeFromMap(idx, t, (v) => v.id === id);
    }
  }

  search(table, query) {
    this._stats.searchQueryCount++;
    const idx = this._searchIndex[table];
    if (!idx || !query || !query.trim()) {
      return this._indexes[table]?.allActive || this._indexes[table]?.byId ? [...(this._indexes[table]?.byId?.values() || [])] : [];
    }
    const tokens = this._tokenize(query);
    if (tokens.length === 0) {
      return [...(this._indexes[table]?.byId?.values() || [])];
    }
    const results = new Map();
    for (const t of tokens) {
      const matches = idx.get(t);
      if (!matches) continue;
      for (const r of matches) {
        results.set(r.id, (results.get(r.id) || 0) + 1);
      }
    }
    return [...results.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([id]) => this._indexes[table]?.byId?.get(id))
      .filter(Boolean);
  }

  build(db) {
    this.invalidateFilterCaches();
    const startTime = performance.now();
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
    this._buildEventIndex(tables[TABLES.events] || []);
    this._buildTombstoneIndex(tables[TABLES.tombstones] || []);

    this._buildRelationIndexes();

    this._invalidated = false;
    this._riskCache.dirty = true;
    this._dirtyScheduleIds = null;
    this.invalidateSummaryCache();
    this._stats.buildCount++;
    this._stats.lastBuildTime = performance.now() - startTime;
    this._stats.recordCounts = {
      costumes: this._indexes.costumes.byId.size,
      records: this._indexes.records.byId.size,
      reservations: this._indexes.reservations.byId.size,
      workOrders: this._indexes.workOrders.byId.size,
      actors: this._indexes.actors.byId.size,
      packingLists: this._indexes.packingLists.byId.size,
      schedules: this._indexes.schedules.byId.size,
      inventoryTasks: this._indexes.inventoryTasks.byId.size,
      inventoryItems: this._indexes.inventoryItems.byId.size,
      riskStatuses: this._indexes.riskStatuses.byId.size,
      events: this._indexes.events.byId.size,
      tombstones: this._indexes.tombstones.byId.size
    };
    this.notify();
  }

  _buildCostumeIndex(records) {
    const idx = this._indexes.costumes;
    for (const r of records) {
      if (!r || !r.id) continue;
      if (this._isSoftDeleted(r, TABLES.costumes)) continue;

      idx.byId.set(r.id, r);
      idx.allActive.push(r);
      this._addToMap(idx.byPlay, r.play || '', r);
      this._addToMap(idx.byStatus, r.status || '', r);
      this._addToMap(idx.byClean, r.clean || '', r);
      this._addToMap(idx.byPlayAndStatus, (r.play || '') + '|' + (r.status || ''), r);
      if (r.borrower) {
        this._addToMap(idx.byBorrower, r.borrower, r);
      }
      this._addToSearchIndex(TABLES.costumes, r, ['name', 'play', 'size', 'location', 'borrower', 'note']);
    }
  }

  _buildRecordIndex(records) {
    const idx = this._indexes.records;
    for (const r of records) {
      if (!r || !r.id) continue;

      idx.byId.set(r.id, r);
      if (r.costumeId) {
        this._addToMap(idx.byCostumeId, r.costumeId, r);
      }
      if (r.type) {
        this._addToMap(idx.byType, r.type, r);
      }
      if (r.operator) {
        this._addToMap(idx.byOperator, r.operator, r);
      }
      this._addToSearchIndex(TABLES.records, r, ['costumeName', 'play', 'operator', 'summary', 'type']);
    }
  }

  _buildReservationIndex(records) {
    const idx = this._indexes.reservations;
    for (const r of records) {
      if (!r || !r.id) continue;
      if (this._isSoftDeleted(r, TABLES.reservations)) continue;

      idx.byId.set(r.id, r);
      if (r.costumeId) {
        this._addToMap(idx.byCostumeId, r.costumeId, r);
      }
      const play = r.play || '';
      const date = r.date || '';
      this._addToMap(idx.byPlay, play, r);
      this._addToMap(idx.byDate, date, r);
      this._addToMap(idx.byPlayAndDate, play + '|' + date, r);
      this._addToMap(idx.byStatus, r.status || '', r);
      if (r.status === 'active') {
        this._addToNestedMap(idx.activeByPlayAndDate, play, date, r);
      }
      this._addToSearchIndex(TABLES.reservations, r, ['costumeName', 'play', 'reservedFor', 'note']);
    }
  }

  _buildWorkOrderIndex(records) {
    const idx = this._indexes.workOrders;
    const ACTIVE_STATUSES = WORK_ORDER_ACTIVE_STATUSES_SET;
    for (const r of records) {
      if (!r || !r.id) continue;
      if (this._isSoftDeleted(r, TABLES.workOrders)) continue;

      idx.byId.set(r.id, r);
      if (r.costumeId) {
        this._addToMap(idx.byCostumeId, r.costumeId, r);
        if (ACTIVE_STATUSES.has(r.status)) {
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
      if (this._isSoftDeleted(r, TABLES.actors)) continue;

      idx.byId.set(r.id, r);
      this._addToMap(idx.byName, r.name || '', r);
      const plays = Array.isArray(r.plays) ? r.plays : [r.play || ''];
      for (const p of plays) {
        if (p) this._addToMap(idx.byPlay, p, r);
      }
      this._addToSearchIndex(TABLES.actors, r, ['name', 'size', 'role', 'note']);
    }
  }

  _buildPackingListIndex(records) {
    const idx = this._indexes.packingLists;
    for (const r of records) {
      if (!r || !r.id) continue;
      if (this._isSoftDeleted(r, TABLES.packingLists)) continue;

      idx.byId.set(r.id, r);
      const play = r.play || '';
      const date = r.performanceDate || '';
      this._addToMap(idx.byPlay, play, r);
      this._addToMap(idx.byPerformanceDate, date, r);
      this._addToMap(idx.byPlayAndDate, play + '|' + date, r);
      if (Array.isArray(r.items)) {
        for (const item of r.items) {
          if (item.costumeId) {
            this._addToMap(idx.costumeRefs, item.costumeId, r);
          }
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
      if (this._isSoftDeleted(r, TABLES.schedules)) continue;

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
        for (const cid of linkedIds) {
          this._addToMap(idx.costumeRefs, cid, r);
        }
      }

      if (date >= todayStr && date <= futureStr) {
        upcoming.push(r);
      }
      this._addToSearchIndex(TABLES.schedules, r, ['play', 'venue', 'note', 'status']);
    }

    idx.upcoming30Days = upcoming.sort((a, b) =>
      a.date.localeCompare(b.date) || (a.time || '').localeCompare(b.time || '')
    );
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
      if (r.costumeId) {
        this._addToMap(idx.byCostumeId, r.costumeId, r);
      }
      this._addToSearchIndex(TABLES.inventoryItems, r, ['costumeName', 'costumePlay', 'note', 'expectedLocation']);
    }
  }

  _buildRiskStatusIndex(records) {
    const idx = this._indexes.riskStatuses;
    for (const r of records) {
      if (!r || !r.id) continue;
      idx.byId.set(r.id, r);
      if (r.riskKey) {
        idx.byRiskKey.set(r.riskKey, r);
      }
      this._addToMap(idx.byStatus, r.status || '', r);
    }
  }

  _buildEventIndex(records) {
    const idx = this._indexes.events;
    for (const r of records) {
      if (!r || !r.id) continue;
      idx.byId.set(r.id, r);
      idx.all.push(r);
      if (r.table) {
        this._addToMap(idx.byTable, r.table, r);
      }
      if (r.table && r.recordId) {
        this._addToMap(idx.byRecordId, `${r.table}|${r.recordId}`, r);
      }
      if (r.deviceId) {
        this._addToMap(idx.byDeviceId, r.deviceId, r);
      }
    }
    idx.all.sort((a, b) => (a.timestamp || '').localeCompare(b.timestamp || ''));
  }

  _buildTombstoneIndex(records) {
    const idx = this._indexes.tombstones;
    for (const r of records) {
      if (!r || !r.id) continue;
      idx.byId.set(r.id, r);
      idx.all.push(r);
      if (r.table) {
        this._addToMap(idx.byTable, r.table, r);
      }
      if (r.table && r.recordId) {
        idx.byTableAndRecordId.set(`${r.table}|${r.recordId}`, r);
      }
    }
  }

  _buildRelationIndexes() {
    const rel = this._relationIndex;

    for (const key of Object.keys(rel)) {
      rel[key].clear();
    }

    for (const c of this._indexes.costumes.allActive) {
      this._addToMap(rel.playToCostumes, c.play || '', c);
      this._addToMap(rel.costumeStatusToCount, c.status || '', 1);
    }

    for (const s of this._indexes.schedules.byId.values()) {
      this._addToMap(rel.playToSchedules, s.play || '', s);
      this._addToMap(rel.dateToSchedules, s.date || '', s);

      const linkedIds = s.linkedCostumeIds || [];
      rel.scheduleToCostumes.set(s.id, linkedIds);
      for (const cid of linkedIds) {
        this._addToMap(rel.costumeToSchedules, cid, s);
      }

      const dayReservations = this.getActiveReservationsByPlayAndDate(s.play, s.date);
      rel.scheduleToReservations.set(s.id, dayReservations.map(r => r.id));
      for (const r of dayReservations) {
        this._addToMap(rel.costumeToReservations, r.costumeId, r);
      }

      const dayPackingLists = this.getPackingListsByPlayAndDate(s.play, s.date);
      rel.scheduleToPackingLists.set(s.id, dayPackingLists.map(pl => pl.id));
      for (const pl of dayPackingLists) {
        if (Array.isArray(pl.items)) {
          for (const item of pl.items) {
            if (item.costumeId) {
              this._addToMap(rel.costumeToPackingLists, item.costumeId, pl);
            }
          }
        }
      }
    }

    for (const wo of this._indexes.workOrders.byId.values()) {
      if (wo.costumeId) {
        this._addToMap(rel.costumeToWorkOrders, wo.costumeId, wo);
      }
      this._addToMap(rel.workOrderStatusToCount, wo.status || '', 1);
    }

    for (const r of this._indexes.records.byId.values()) {
      if (r.costumeId) {
        this._addToMap(rel.costumeToRecords, r.costumeId, r);
      }
    }

    for (const ii of this._indexes.inventoryItems.byId.values()) {
      if (ii.costumeId) {
        this._addToMap(rel.costumeToInventoryItems, ii.costumeId, ii);
      }
    }
  }

  _updateRelationIndexForRecord(table, record, operation = 'add') {
    const rel = this._relationIndex;

    if (table === TABLES.costumes) {
      if (operation === 'add' || operation === 'update') {
        this._addToMap(rel.playToCostumes, record.play || '', record);
      } else if (operation === 'remove') {
        this._removeFromMap(rel.playToCostumes, record.play || '', (v) => v.id === record.id);
      }
    }

    if (table === TABLES.schedules) {
      if (operation === 'add' || operation === 'update') {
        this._addToMap(rel.playToSchedules, record.play || '', record);
        this._addToMap(rel.dateToSchedules, record.date || '', record);

        const linkedIds = record.linkedCostumeIds || [];
        rel.scheduleToCostumes.set(record.id, linkedIds);
        for (const cid of linkedIds) {
          this._addToMap(rel.costumeToSchedules, cid, record);
        }
      } else if (operation === 'remove') {
        this._removeFromMap(rel.playToSchedules, record.play || '', (v) => v.id === record.id);
        this._removeFromMap(rel.dateToSchedules, record.date || '', (v) => v.id === record.id);
        const linkedIds = record.linkedCostumeIds || [];
        for (const cid of linkedIds) {
          this._removeFromMap(rel.costumeToSchedules, cid, (v) => v.id === record.id);
        }
        rel.scheduleToCostumes.delete(record.id);
      }
    }

    if (table === TABLES.workOrders) {
      if (record.costumeId) {
        if (operation === 'add' || operation === 'update') {
          this._addToMap(rel.costumeToWorkOrders, record.costumeId, record);
        } else if (operation === 'remove') {
          this._removeFromMap(rel.costumeToWorkOrders, record.costumeId, (v) => v.id === record.id);
        }
      }
    }

    if (table === TABLES.reservations && record.status === 'active') {
      if (record.costumeId) {
        if (operation === 'add' || operation === 'update') {
          this._addToMap(rel.costumeToReservations, record.costumeId, record);
        } else if (operation === 'remove') {
          this._removeFromMap(rel.costumeToReservations, record.costumeId, (v) => v.id === record.id);
        }
      }
    }

    if (table === TABLES.records && record.costumeId) {
      if (operation === 'add' || operation === 'update') {
        this._addToMap(rel.costumeToRecords, record.costumeId, record);
      } else if (operation === 'remove') {
        this._removeFromMap(rel.costumeToRecords, record.costumeId, (v) => v.id === record.id);
      }
    }

    if (table === TABLES.inventoryItems && record.costumeId) {
      if (operation === 'add' || operation === 'update') {
        this._addToMap(rel.costumeToInventoryItems, record.costumeId, record);
      } else if (operation === 'remove') {
        this._removeFromMap(rel.costumeToInventoryItems, record.costumeId, (v) => v.id === record.id);
      }
    }

    if (table === TABLES.packingLists) {
      if (Array.isArray(record.items)) {
        for (const item of record.items) {
          if (item.costumeId) {
            if (operation === 'add' || operation === 'update') {
              this._addToMap(rel.costumeToPackingLists, item.costumeId, record);
            } else if (operation === 'remove') {
              this._removeFromMap(rel.costumeToPackingLists, item.costumeId, (v) => v.id === record.id);
            }
          }
        }
      }
    }
  }

  getSchedulesForCostume(costumeId) {
    return this._relationIndex.costumeToSchedules.get(costumeId) || [];
  }

  getReservationsForCostume(costumeId) {
    return this._relationIndex.costumeToReservations.get(costumeId) || [];
  }

  getWorkOrdersForCostume(costumeId) {
    return this._relationIndex.costumeToWorkOrders.get(costumeId) || [];
  }

  getPackingListsForCostume(costumeId) {
    return this._relationIndex.costumeToPackingLists.get(costumeId) || [];
  }

  getRecordsForCostume(costumeId) {
    return this._relationIndex.costumeToRecords.get(costumeId) || [];
  }

  getInventoryItemsForCostume(costumeId) {
    return this._relationIndex.costumeToInventoryItems.get(costumeId) || [];
  }

  getCostumesForSchedule(scheduleId) {
    const ids = this._relationIndex.scheduleToCostumes.get(scheduleId) || [];
    return ids.map(id => this.getCostumeById(id)).filter(Boolean);
  }

  getReservationsForSchedule(scheduleId) {
    const ids = this._relationIndex.scheduleToReservations.get(scheduleId) || [];
    return ids.map(id => this._indexes.reservations.byId.get(id)).filter(Boolean);
  }

  getPackingListsForSchedule(scheduleId) {
    const ids = this._relationIndex.scheduleToPackingLists.get(scheduleId) || [];
    return ids.map(id => this._indexes.packingLists.byId.get(id)).filter(Boolean);
  }

  getCostumesByPlayFast(play) {
    return this._indexes.costumes.byPlay.get(play) || [];
  }

  getActiveCostumes() {
    return this._indexes.costumes.allActive.filter(c => !c.deletedAt);
  }

  getSchedulesByPlayFast(play) {
    return this._indexes.schedules.byPlay.get(play) || [];
  }

  getSchedulesByDateFast(date) {
    return this._indexes.schedules.byDate.get(date) || [];
  }

  startBatch() {
    this._batchMode = true;
    this._batchChanges = {
      added: new Map(),
      updated: new Map(),
      removed: new Map(),
      affectedScheduleIds: new Set()
    };
  }

  endBatch() {
    if (!this._batchMode) return;
    this._batchMode = false;

    const hasChanges = this._batchChanges.added.size > 0 ||
                       this._batchChanges.updated.size > 0 ||
                       this._batchChanges.removed.size > 0;

    if (hasChanges) {
      this._stats.bulkOperations++;
      this._stats.bulkRecordsProcessed += this._batchChanges.added.size +
                                           this._batchChanges.updated.size +
                                           this._batchChanges.removed.size;
      this._riskCache.dirty = true;
      this._suggestionCache.dirty = true;
      this._summaryCache.dirty = true;
      this.invalidateFilterCaches();
      this.invalidateSummaryCache();

      if (this._batchChanges.affectedScheduleIds.size > 0) {
        if (!this._dirtyScheduleIds) this._dirtyScheduleIds = new Set();
        for (const sid of this._batchChanges.affectedScheduleIds) {
          this._dirtyScheduleIds.add(sid);
          this._riskCache.byScheduleId.delete(sid);
          this._suggestionCache.byScheduleId.delete(sid);
        }
      } else {
        this._dirtyScheduleIds = null;
      }

      this.notify();
    }

    this._batchChanges = {
      added: new Map(),
      updated: new Map(),
      removed: new Map(),
      affectedScheduleIds: new Set()
    };
  }

  _collectAffectedScheduleIds(table, record) {
    const upcoming = this.getUpcomingSchedules30Days();
    const affected = new Set();

    switch (table) {
      case TABLES.costumes: {
        const costumeSchedules = this.getSchedulesReferencingCostume(record.id);
        for (const s of costumeSchedules) affected.add(s.id);
        for (const s of upcoming) {
          if (s.play === record.play) affected.add(s.id);
        }
        break;
      }
      case TABLES.reservations: {
        for (const s of upcoming) {
          if (s.play === record.play && s.date === record.date) {
            affected.add(s.id);
          }
        }
        break;
      }
      case TABLES.workOrders: {
        if (record.costumeId) {
          const costumeSchedules = this.getSchedulesReferencingCostume(record.costumeId);
          for (const s of costumeSchedules) affected.add(s.id);
          const costume = this.getCostumeById(record.costumeId);
          if (costume) {
            for (const s of upcoming) {
              if (s.play === costume.play) affected.add(s.id);
            }
          }
        }
        break;
      }
      case TABLES.packingLists: {
        for (const s of upcoming) {
          if (s.play === record.play && s.date === record.performanceDate) {
            affected.add(s.id);
          }
        }
        break;
      }
      case TABLES.schedules: {
        affected.add(record.id);
        break;
      }
    }

    return affected;
  }

  bulkAddRecords(table, records) {
    if (!records || records.length === 0) return;

    const wasBatchMode = this._batchMode;
    if (!wasBatchMode) this.startBatch();

    const handlers = this._getTableHandlers(table);
    for (const record of records) {
      if (!record || !record.id) continue;
      if (this._isSoftDeleted(record, table)) continue;

      if (handlers?.add) {
        handlers.add(record);
      }
      this._updateRelationIndexForRecord(table, record, 'add');
      this._stats.incrementalUpdates++;

      const affected = this._collectAffectedScheduleIds(table, record);
      for (const sid of affected) {
        this._batchChanges.affectedScheduleIds.add(sid);
      }

      this._batchChanges.added.set(`${table}|${record.id}`, { table, record });
    }

    if (table === TABLES.inventoryItems) {
      const taskIds = new Set(records.map(r => r.taskId).filter(Boolean));
      for (const taskId of taskIds) {
        this.invalidateInventoryTaskStats(taskId);
      }
    } else if (table === TABLES.inventoryTasks) {
      this.invalidateInventoryTaskStats(null);
    }

    if (!wasBatchMode) this.endBatch();
  }

  bulkUpdateRecords(table, updates) {
    if (!updates || updates.length === 0) return;

    const wasBatchMode = this._batchMode;
    if (!wasBatchMode) this.startBatch();

    const handlers = this._getTableHandlers(table);
    for (const update of updates) {
      let oldRecord, newRecord;
      if (Array.isArray(update)) {
        [oldRecord, newRecord] = update;
      } else {
        oldRecord = update.oldRecord;
        newRecord = update.newRecord;
      }
      if (!newRecord || !newRecord.id) continue;

      if (handlers?.update) {
        handlers.update(oldRecord, newRecord);
      }
      if (oldRecord) {
        this._updateRelationIndexForRecord(table, oldRecord, 'remove');
      }
      this._updateRelationIndexForRecord(table, newRecord, 'update');
      this._stats.incrementalUpdates++;

      const affected = this._collectAffectedScheduleIds(table, newRecord);
      for (const sid of affected) {
        this._batchChanges.affectedScheduleIds.add(sid);
      }

      this._batchChanges.updated.set(`${table}|${newRecord.id}`, { table, oldRecord, newRecord });
    }

    if (table === TABLES.inventoryItems) {
      const taskIds = new Set(updates.map(u => u.newRecord?.taskId || u.oldRecord?.taskId).filter(Boolean));
      for (const taskId of taskIds) {
        this.invalidateInventoryTaskStats(taskId);
      }
    } else if (table === TABLES.inventoryTasks) {
      this.invalidateInventoryTaskStats(null);
    }

    if (!wasBatchMode) this.endBatch();
  }

  bulkRemoveRecords(table, records) {
    if (!records || records.length === 0) return;

    const wasBatchMode = this._batchMode;
    if (!wasBatchMode) this.startBatch();

    const handlers = this._getTableHandlers(table);
    for (const record of records) {
      if (!record || !record.id) continue;

      if (handlers?.remove) {
        handlers.remove(record);
      }
      this._updateRelationIndexForRecord(table, record, 'remove');
      this._stats.incrementalUpdates++;

      const affected = this._collectAffectedScheduleIds(table, record);
      for (const sid of affected) {
        this._batchChanges.affectedScheduleIds.add(sid);
      }

      this._batchChanges.removed.set(`${table}|${record.id}`, { table, record });
    }

    if (table === TABLES.inventoryItems) {
      const taskIds = new Set(records.map(r => r.taskId).filter(Boolean));
      for (const taskId of taskIds) {
        this.invalidateInventoryTaskStats(taskId);
      }
    } else if (table === TABLES.inventoryTasks) {
      this.invalidateInventoryTaskStats(null);
    }

    if (!wasBatchMode) this.endBatch();
  }

  addRecord(table, record) {
    if (!record || !record.id) return;
    if (this._isSoftDeleted(record, table)) return;

    const handlers = this._getTableHandlers(table);
    if (handlers?.add) {
      handlers.add(record);
    }
    this._updateRelationIndexForRecord(table, record, 'add');
    this._stats.incrementalUpdates++;

    if (this._batchMode) {
      const affected = this._collectAffectedScheduleIds(table, record);
      for (const sid of affected) {
        this._batchChanges.affectedScheduleIds.add(sid);
      }
      this._batchChanges.added.set(`${table}|${record.id}`, { table, record });
      if (table === TABLES.inventoryItems && record.taskId) {
        this.invalidateInventoryTaskStats(record.taskId);
      } else if (table === TABLES.inventoryTasks) {
        this.invalidateInventoryTaskStats(null);
      }
    } else {
      this._riskCache.dirty = true;
      this.invalidateFilterCaches();
      this.invalidateSummaryCache();
      this.invalidateAffectedRisks(table, record);
      this.notify();
    }
  }

  updateRecord(table, oldRecord, newRecord) {
    if (!newRecord || !newRecord.id) return;
    const handlers = this._getTableHandlers(table);
    if (handlers?.update) {
      handlers.update(oldRecord, newRecord);
    }
    if (oldRecord) {
      this._updateRelationIndexForRecord(table, oldRecord, 'remove');
    }
    this._updateRelationIndexForRecord(table, newRecord, 'update');
    this._stats.incrementalUpdates++;

    if (this._batchMode) {
      const affected = this._collectAffectedScheduleIds(table, newRecord);
      for (const sid of affected) {
        this._batchChanges.affectedScheduleIds.add(sid);
      }
      this._batchChanges.updated.set(`${table}|${newRecord.id}`, { table, oldRecord, newRecord });
      if (table === TABLES.inventoryItems && newRecord.taskId) {
        this.invalidateInventoryTaskStats(newRecord.taskId);
      } else if (table === TABLES.inventoryTasks) {
        this.invalidateInventoryTaskStats(null);
      }
    } else {
      this._riskCache.dirty = true;
      this.invalidateFilterCaches();
      this.invalidateSummaryCache();
      this.invalidateAffectedRisks(table, newRecord);
      this.notify();
    }
  }

  removeRecord(table, record) {
    if (!record || !record.id) return;
    const handlers = this._getTableHandlers(table);
    if (handlers?.remove) {
      handlers.remove(record);
    }
    this._updateRelationIndexForRecord(table, record, 'remove');
    this._stats.incrementalUpdates++;

    if (this._batchMode) {
      const affected = this._collectAffectedScheduleIds(table, record);
      for (const sid of affected) {
        this._batchChanges.affectedScheduleIds.add(sid);
      }
      this._batchChanges.removed.set(`${table}|${record.id}`, { table, record });
      if (table === TABLES.inventoryItems && record.taskId) {
        this.invalidateInventoryTaskStats(record.taskId);
      } else if (table === TABLES.inventoryTasks) {
        this.invalidateInventoryTaskStats(null);
      }
    } else {
      this._riskCache.dirty = true;
      this.invalidateFilterCaches();
      this.invalidateSummaryCache();
      this.invalidateAffectedRisks(table, record);
      this.notify();
    }
  }

  _getTableHandlers(table) {
    switch (table) {
      case TABLES.costumes: return this._costumeHandlers();
      case TABLES.records: return this._recordHandlers();
      case TABLES.reservations: return this._reservationHandlers();
      case TABLES.workOrders: return this._workOrderHandlers();
      case TABLES.actors: return this._actorHandlers();
      case TABLES.packingLists: return this._packingListHandlers();
      case TABLES.schedules: return this._scheduleHandlers();
      case TABLES.inventoryTasks: return this._inventoryTaskHandlers();
      case TABLES.inventoryItems: return this._inventoryItemHandlers();
      case TABLES.riskStatuses: return this._riskStatusHandlers();
      case TABLES.events: return this._eventHandlers();
      case TABLES.tombstones: return this._tombstoneHandlers();
      default: return null;
    }
  }

  _costumeHandlers() {
    const self = this;
    const idx = this._indexes.costumes;
    return {
      add: (r) => {
        idx.byId.set(r.id, r);
        idx.allActive.push(r);
        self._addToMap(idx.byPlay, r.play || '', r);
        self._addToMap(idx.byStatus, r.status || '', r);
        self._addToMap(idx.byClean, r.clean || '', r);
        self._addToMap(idx.byPlayAndStatus, (r.play || '') + '|' + (r.status || ''), r);
        if (r.borrower) self._addToMap(idx.byBorrower, r.borrower, r);
        self._addToSearchIndex(TABLES.costumes, r, ['name', 'play', 'size', 'location', 'borrower', 'note']);
      },
      update: (oldR, newR) => {
        if (oldR) {
          self._removeFromSearchIndex(TABLES.costumes, oldR, ['name', 'play', 'size', 'location', 'borrower', 'note']);
          self._removeFromMap(idx.byPlay, oldR.play || '', (v) => v.id === oldR.id);
          self._removeFromMap(idx.byStatus, oldR.status || '', (v) => v.id === oldR.id);
          self._removeFromMap(idx.byClean, oldR.clean || '', (v) => v.id === oldR.id);
          self._removeFromMap(idx.byPlayAndStatus, (oldR.play || '') + '|' + (oldR.status || ''), (v) => v.id === oldR.id);
          if (oldR.borrower) self._removeFromMap(idx.byBorrower, oldR.borrower, (v) => v.id === oldR.id);
          const allIdx = idx.allActive.findIndex((v) => v.id === oldR.id);
          if (allIdx !== -1) idx.allActive.splice(allIdx, 1);
        }
        idx.byId.set(newR.id, newR);
        idx.allActive.push(newR);
        self._addToMap(idx.byPlay, newR.play || '', newR);
        self._addToMap(idx.byStatus, newR.status || '', newR);
        self._addToMap(idx.byClean, newR.clean || '', newR);
        self._addToMap(idx.byPlayAndStatus, (newR.play || '') + '|' + (newR.status || ''), newR);
        if (newR.borrower) self._addToMap(idx.byBorrower, newR.borrower, newR);
        self._addToSearchIndex(TABLES.costumes, newR, ['name', 'play', 'size', 'location', 'borrower', 'note']);
      },
      remove: (r) => {
        idx.byId.delete(r.id);
        self._removeFromMap(idx.byPlay, r.play || '', (v) => v.id === r.id);
        self._removeFromMap(idx.byStatus, r.status || '', (v) => v.id === r.id);
        self._removeFromMap(idx.byClean, r.clean || '', (v) => v.id === r.id);
        self._removeFromMap(idx.byPlayAndStatus, (r.play || '') + '|' + (r.status || ''), (v) => v.id === r.id);
        if (r.borrower) self._removeFromMap(idx.byBorrower, r.borrower, (v) => v.id === r.id);
        const allIdx = idx.allActive.findIndex((v) => v.id === r.id);
        if (allIdx !== -1) idx.allActive.splice(allIdx, 1);
        self._removeFromSearchIndex(TABLES.costumes, r, ['name', 'play', 'size', 'location', 'borrower', 'note']);
      }
    };
  }

  _recordHandlers() {
    const self = this;
    const idx = this._indexes.records;
    return {
      add: (r) => {
        idx.byId.set(r.id, r);
        if (r.costumeId) self._addToMap(idx.byCostumeId, r.costumeId, r);
        if (r.type) self._addToMap(idx.byType, r.type, r);
        if (r.operator) self._addToMap(idx.byOperator, r.operator, r);
        self._addToSearchIndex(TABLES.records, r, ['costumeName', 'play', 'operator', 'summary', 'type']);
      },
      update: (oldR, newR) => {
        if (oldR) {
          self._removeFromSearchIndex(TABLES.records, oldR, ['costumeName', 'play', 'operator', 'summary', 'type']);
          if (oldR.costumeId) self._removeFromMap(idx.byCostumeId, oldR.costumeId, (v) => v.id === oldR.id);
          if (oldR.type) self._removeFromMap(idx.byType, oldR.type, (v) => v.id === oldR.id);
          if (oldR.operator) self._removeFromMap(idx.byOperator, oldR.operator, (v) => v.id === oldR.id);
        }
        idx.byId.set(newR.id, newR);
        if (newR.costumeId) self._addToMap(idx.byCostumeId, newR.costumeId, newR);
        if (newR.type) self._addToMap(idx.byType, newR.type, newR);
        if (newR.operator) self._addToMap(idx.byOperator, newR.operator, newR);
        self._addToSearchIndex(TABLES.records, newR, ['costumeName', 'play', 'operator', 'summary', 'type']);
      },
      remove: (r) => {
        idx.byId.delete(r.id);
        if (r.costumeId) self._removeFromMap(idx.byCostumeId, r.costumeId, (v) => v.id === r.id);
        if (r.type) self._removeFromMap(idx.byType, r.type, (v) => v.id === r.id);
        if (r.operator) self._removeFromMap(idx.byOperator, r.operator, (v) => v.id === r.id);
        self._removeFromSearchIndex(TABLES.records, r, ['costumeName', 'play', 'operator', 'summary', 'type']);
      }
    };
  }

  _reservationHandlers() {
    const self = this;
    const idx = this._indexes.reservations;
    return {
      add: (r) => {
        idx.byId.set(r.id, r);
        if (r.costumeId) self._addToMap(idx.byCostumeId, r.costumeId, r);
        const play = r.play || '';
        const date = r.date || '';
        self._addToMap(idx.byPlay, play, r);
        self._addToMap(idx.byDate, date, r);
        self._addToMap(idx.byPlayAndDate, play + '|' + date, r);
        self._addToMap(idx.byStatus, r.status || '', r);
        if (r.reservedFor) self._addToMap(idx.byReservedFor, r.reservedFor, r);
        if (r.status === 'active') self._addToNestedMap(idx.activeByPlayAndDate, play, date, r);
        self._addToSearchIndex(TABLES.reservations, r, ['costumeName', 'play', 'reservedFor', 'note']);
      },
      update: (oldR, newR) => {
        if (oldR) {
          self._removeFromSearchIndex(TABLES.reservations, oldR, ['costumeName', 'play', 'reservedFor', 'note']);
          if (oldR.costumeId) self._removeFromMap(idx.byCostumeId, oldR.costumeId, (v) => v.id === oldR.id);
          const oldPlay = oldR.play || '';
          const oldDate = oldR.date || '';
          self._removeFromMap(idx.byPlay, oldPlay, (v) => v.id === oldR.id);
          self._removeFromMap(idx.byDate, oldDate, (v) => v.id === oldR.id);
          self._removeFromMap(idx.byPlayAndDate, oldPlay + '|' + oldDate, (v) => v.id === oldR.id);
          self._removeFromMap(idx.byStatus, oldR.status || '', (v) => v.id === oldR.id);
          if (oldR.reservedFor) self._removeFromMap(idx.byReservedFor, oldR.reservedFor, (v) => v.id === oldR.id);
          if (oldR.status === 'active') self._removeFromNestedMap(idx.activeByPlayAndDate, oldPlay, oldDate, (v) => v.id === oldR.id);
        }
        idx.byId.set(newR.id, newR);
        if (newR.costumeId) self._addToMap(idx.byCostumeId, newR.costumeId, newR);
        const play = newR.play || '';
        const date = newR.date || '';
        self._addToMap(idx.byPlay, play, newR);
        self._addToMap(idx.byDate, date, newR);
        self._addToMap(idx.byPlayAndDate, play + '|' + date, newR);
        self._addToMap(idx.byStatus, newR.status || '', newR);
        if (newR.reservedFor) self._addToMap(idx.byReservedFor, newR.reservedFor, newR);
        if (newR.status === 'active') self._addToNestedMap(idx.activeByPlayAndDate, play, date, newR);
        self._addToSearchIndex(TABLES.reservations, newR, ['costumeName', 'play', 'reservedFor', 'note']);
      },
      remove: (r) => {
        idx.byId.delete(r.id);
        if (r.costumeId) self._removeFromMap(idx.byCostumeId, r.costumeId, (v) => v.id === r.id);
        const play = r.play || '';
        const date = r.date || '';
        self._removeFromMap(idx.byPlay, play, (v) => v.id === r.id);
        self._removeFromMap(idx.byDate, date, (v) => v.id === r.id);
        self._removeFromMap(idx.byPlayAndDate, play + '|' + date, (v) => v.id === r.id);
        self._removeFromMap(idx.byStatus, r.status || '', (v) => v.id === r.id);
        if (r.reservedFor) self._removeFromMap(idx.byReservedFor, r.reservedFor, (v) => v.id === r.id);
        if (r.status === 'active') self._removeFromNestedMap(idx.activeByPlayAndDate, play, date, (v) => v.id === r.id);
        self._removeFromSearchIndex(TABLES.reservations, r, ['costumeName', 'play', 'reservedFor', 'note']);
      }
    };
  }

  _workOrderHandlers() {
    const self = this;
    const idx = this._indexes.workOrders;
    const ACTIVE_STATUSES = WORK_ORDER_ACTIVE_STATUSES_SET;
    return {
      add: (r) => {
        idx.byId.set(r.id, r);
        if (r.costumeId) {
          self._addToMap(idx.byCostumeId, r.costumeId, r);
          if (ACTIVE_STATUSES.has(r.status)) self._addToMap(idx.activeByCostumeId, r.costumeId, r);
        }
        self._addToMap(idx.byPlay, r.play || '', r);
        self._addToMap(idx.byStatus, r.status || '', r);
        self._addToMap(idx.byType, r.type || '', r);
        self._addToSearchIndex(TABLES.workOrders, r, ['costumeName', 'play', 'assignee', 'note', 'type', 'status']);
      },
      update: (oldR, newR) => {
        if (oldR) {
          self._removeFromSearchIndex(TABLES.workOrders, oldR, ['costumeName', 'play', 'assignee', 'note', 'type', 'status']);
          if (oldR.costumeId) {
            self._removeFromMap(idx.byCostumeId, oldR.costumeId, (v) => v.id === oldR.id);
            if (ACTIVE_STATUSES.has(oldR.status)) self._removeFromMap(idx.activeByCostumeId, oldR.costumeId, (v) => v.id === oldR.id);
          }
          self._removeFromMap(idx.byPlay, oldR.play || '', (v) => v.id === oldR.id);
          self._removeFromMap(idx.byStatus, oldR.status || '', (v) => v.id === oldR.id);
          self._removeFromMap(idx.byType, oldR.type || '', (v) => v.id === oldR.id);
        }
        idx.byId.set(newR.id, newR);
        if (newR.costumeId) {
          self._addToMap(idx.byCostumeId, newR.costumeId, newR);
          if (ACTIVE_STATUSES.has(newR.status)) self._addToMap(idx.activeByCostumeId, newR.costumeId, newR);
        }
        self._addToMap(idx.byPlay, newR.play || '', newR);
        self._addToMap(idx.byStatus, newR.status || '', newR);
        self._addToMap(idx.byType, newR.type || '', newR);
        self._addToSearchIndex(TABLES.workOrders, newR, ['costumeName', 'play', 'assignee', 'note', 'type', 'status']);
      },
      remove: (r) => {
        idx.byId.delete(r.id);
        if (r.costumeId) {
          self._removeFromMap(idx.byCostumeId, r.costumeId, (v) => v.id === r.id);
          if (ACTIVE_STATUSES.has(r.status)) self._removeFromMap(idx.activeByCostumeId, r.costumeId, (v) => v.id === r.id);
        }
        self._removeFromMap(idx.byPlay, r.play || '', (v) => v.id === r.id);
        self._removeFromMap(idx.byStatus, r.status || '', (v) => v.id === r.id);
        self._removeFromMap(idx.byType, r.type || '', (v) => v.id === r.id);
        self._removeFromSearchIndex(TABLES.workOrders, r, ['costumeName', 'play', 'assignee', 'note', 'type', 'status']);
      }
    };
  }

  _actorHandlers() {
    const self = this;
    const idx = this._indexes.actors;
    return {
      add: (r) => {
        idx.byId.set(r.id, r);
        self._addToMap(idx.byName, r.name || '', r);
        const plays = Array.isArray(r.plays) ? r.plays : [r.play || ''];
        for (const p of plays) if (p) self._addToMap(idx.byPlay, p, r);
        self._addToSearchIndex(TABLES.actors, r, ['name', 'size', 'role', 'note']);
      },
      update: (oldR, newR) => {
        if (oldR) {
          self._removeFromSearchIndex(TABLES.actors, oldR, ['name', 'size', 'role', 'note']);
          self._removeFromMap(idx.byName, oldR.name || '', (v) => v.id === oldR.id);
          const oldPlays = Array.isArray(oldR.plays) ? oldR.plays : [oldR.play || ''];
          for (const p of oldPlays) if (p) self._removeFromMap(idx.byPlay, p, (v) => v.id === oldR.id);
        }
        idx.byId.set(newR.id, newR);
        self._addToMap(idx.byName, newR.name || '', newR);
        const plays = Array.isArray(newR.plays) ? newR.plays : [newR.play || ''];
        for (const p of plays) if (p) self._addToMap(idx.byPlay, p, newR);
        self._addToSearchIndex(TABLES.actors, newR, ['name', 'size', 'role', 'note']);
      },
      remove: (r) => {
        idx.byId.delete(r.id);
        self._removeFromSearchIndex(TABLES.actors, r, ['name', 'size', 'role', 'note']);
        self._removeFromMap(idx.byName, r.name || '', (v) => v.id === r.id);
        const plays = Array.isArray(r.plays) ? r.plays : [r.play || ''];
        for (const p of plays) if (p) self._removeFromMap(idx.byPlay, p, (v) => v.id === r.id);
      }
    };
  }

  _packingListHandlers() {
    const self = this;
    const idx = this._indexes.packingLists;
    return {
      add: (r) => {
        idx.byId.set(r.id, r);
        const play = r.play || '';
        const date = r.performanceDate || '';
        self._addToMap(idx.byPlay, play, r);
        self._addToMap(idx.byPerformanceDate, date, r);
        self._addToMap(idx.byPlayAndDate, play + '|' + date, r);
        if (Array.isArray(r.items)) {
          for (const item of r.items) {
            if (item.costumeId) self._addToMap(idx.costumeRefs, item.costumeId, r);
          }
        }
        self._addToSearchIndex(TABLES.packingLists, r, ['name', 'play', 'note']);
      },
      update: (oldR, newR) => {
        if (oldR) {
          self._removeFromSearchIndex(TABLES.packingLists, oldR, ['name', 'play', 'note']);
          const oldPlay = oldR.play || '';
          const oldDate = oldR.performanceDate || '';
          self._removeFromMap(idx.byPlay, oldPlay, (v) => v.id === oldR.id);
          self._removeFromMap(idx.byPerformanceDate, oldDate, (v) => v.id === oldR.id);
          self._removeFromMap(idx.byPlayAndDate, oldPlay + '|' + oldDate, (v) => v.id === oldR.id);
          if (Array.isArray(oldR.items)) {
            for (const item of oldR.items) {
              if (item.costumeId) self._removeFromMap(idx.costumeRefs, item.costumeId, (v) => v.id === oldR.id);
            }
          }
        }
        idx.byId.set(newR.id, newR);
        const play = newR.play || '';
        const date = newR.performanceDate || '';
        self._addToMap(idx.byPlay, play, newR);
        self._addToMap(idx.byPerformanceDate, date, newR);
        self._addToMap(idx.byPlayAndDate, play + '|' + date, newR);
        if (Array.isArray(newR.items)) {
          for (const item of newR.items) {
            if (item.costumeId) self._addToMap(idx.costumeRefs, item.costumeId, newR);
          }
        }
        self._addToSearchIndex(TABLES.packingLists, newR, ['name', 'play', 'note']);
      },
      remove: (r) => {
        idx.byId.delete(r.id);
        const play = r.play || '';
        const date = r.performanceDate || '';
        self._removeFromMap(idx.byPlay, play, (v) => v.id === r.id);
        self._removeFromMap(idx.byPerformanceDate, date, (v) => v.id === r.id);
        self._removeFromMap(idx.byPlayAndDate, play + '|' + date, (v) => v.id === r.id);
        if (Array.isArray(r.items)) {
          for (const item of r.items) {
            if (item.costumeId) self._removeFromMap(idx.costumeRefs, item.costumeId, (v) => v.id === r.id);
          }
        }
        self._removeFromSearchIndex(TABLES.packingLists, r, ['name', 'play', 'note']);
      }
    };
  }

  _scheduleHandlers() {
    const self = this;
    const idx = this._indexes.schedules;
    return {
      add: (r) => {
        idx.byId.set(r.id, r);
        const play = r.play || '';
        const date = r.date || '';
        self._addToMap(idx.byPlay, play, r);
        self._addToMap(idx.byDate, date, r);
        self._addToMap(idx.byPlayAndDate, play + '|' + date, r);
        self._addToMap(idx.byStatus, r.status || '', r);
        const linkedIds = r.linkedCostumeIds || [];
        if (linkedIds.length > 0) {
          idx.linkedCostumes.set(r.id, linkedIds);
          for (const cid of linkedIds) self._addToMap(idx.costumeRefs, cid, r);
        }
        const today = new Date().toISOString().slice(0, 10);
        const future = new Date();
        future.setDate(future.getDate() + 30);
        const futureStr = future.toISOString().slice(0, 10);
        if (date >= today && date <= futureStr) {
          idx.upcoming30Days.push(r);
          idx.upcoming30Days.sort((a, b) =>
            a.date.localeCompare(b.date) || (a.time || '').localeCompare(b.time || '')
          );
        }
        self._addToSearchIndex(TABLES.schedules, r, ['play', 'venue', 'note', 'status']);
      },
      update: (oldR, newR) => {
        if (oldR) {
          self._removeFromSearchIndex(TABLES.schedules, oldR, ['play', 'venue', 'note', 'status']);
          const oldPlay = oldR.play || '';
          const oldDate = oldR.date || '';
          self._removeFromMap(idx.byPlay, oldPlay, (v) => v.id === oldR.id);
          self._removeFromMap(idx.byDate, oldDate, (v) => v.id === oldR.id);
          self._removeFromMap(idx.byPlayAndDate, oldPlay + '|' + oldDate, (v) => v.id === oldR.id);
          self._removeFromMap(idx.byStatus, oldR.status || '', (v) => v.id === oldR.id);
          const oldLinked = oldR.linkedCostumeIds || [];
          for (const cid of oldLinked) self._removeFromMap(idx.costumeRefs, cid, (v) => v.id === oldR.id);
          idx.linkedCostumes.delete(oldR.id);
          const upIdx = idx.upcoming30Days.findIndex((v) => v.id === oldR.id);
          if (upIdx !== -1) idx.upcoming30Days.splice(upIdx, 1);
        }
        idx.byId.set(newR.id, newR);
        const play = newR.play || '';
        const date = newR.date || '';
        self._addToMap(idx.byPlay, play, newR);
        self._addToMap(idx.byDate, date, newR);
        self._addToMap(idx.byPlayAndDate, play + '|' + date, newR);
        self._addToMap(idx.byStatus, newR.status || '', newR);
        const linkedIds = newR.linkedCostumeIds || [];
        if (linkedIds.length > 0) {
          idx.linkedCostumes.set(newR.id, linkedIds);
          for (const cid of linkedIds) self._addToMap(idx.costumeRefs, cid, newR);
        }
        const today = new Date().toISOString().slice(0, 10);
        const future = new Date();
        future.setDate(future.getDate() + 30);
        const futureStr = future.toISOString().slice(0, 10);
        if (date >= today && date <= futureStr) {
          idx.upcoming30Days.push(newR);
          idx.upcoming30Days.sort((a, b) =>
            a.date.localeCompare(b.date) || (a.time || '').localeCompare(b.time || '')
          );
        }
        self._addToSearchIndex(TABLES.schedules, newR, ['play', 'venue', 'note', 'status']);
      },
      remove: (r) => {
        idx.byId.delete(r.id);
        const play = r.play || '';
        const date = r.date || '';
        self._removeFromMap(idx.byPlay, play, (v) => v.id === r.id);
        self._removeFromMap(idx.byDate, date, (v) => v.id === r.id);
        self._removeFromMap(idx.byPlayAndDate, play + '|' + date, (v) => v.id === r.id);
        self._removeFromMap(idx.byStatus, r.status || '', (v) => v.id === r.id);
        const linkedIds = r.linkedCostumeIds || [];
        for (const cid of linkedIds) self._removeFromMap(idx.costumeRefs, cid, (v) => v.id === r.id);
        idx.linkedCostumes.delete(r.id);
        const upIdx = idx.upcoming30Days.findIndex((v) => v.id === r.id);
        if (upIdx !== -1) idx.upcoming30Days.splice(upIdx, 1);
        self._removeFromSearchIndex(TABLES.schedules, r, ['play', 'venue', 'note', 'status']);
      }
    };
  }

  _inventoryTaskHandlers() {
    const self = this;
    const idx = this._indexes.inventoryTasks;
    return {
      add: (r) => {
        idx.byId.set(r.id, r);
        self._addToMap(idx.byStatus, r.status || '', r);
        self._addToMap(idx.byPlayFilter, r.playFilter || '全部剧目', r);
        self._addToSearchIndex(TABLES.inventoryTasks, r, ['name', 'playFilter', 'note']);
      },
      update: (oldR, newR) => {
        if (oldR) {
          self._removeFromSearchIndex(TABLES.inventoryTasks, oldR, ['name', 'playFilter', 'note']);
          self._removeFromMap(idx.byStatus, oldR.status || '', (v) => v.id === oldR.id);
          self._removeFromMap(idx.byPlayFilter, oldR.playFilter || '全部剧目', (v) => v.id === oldR.id);
        }
        idx.byId.set(newR.id, newR);
        self._addToMap(idx.byStatus, newR.status || '', newR);
        self._addToMap(idx.byPlayFilter, newR.playFilter || '全部剧目', newR);
        self._addToSearchIndex(TABLES.inventoryTasks, newR, ['name', 'playFilter', 'note']);
      },
      remove: (r) => {
        idx.byId.delete(r.id);
        self._removeFromSearchIndex(TABLES.inventoryTasks, r, ['name', 'playFilter', 'note']);
        self._removeFromMap(idx.byStatus, r.status || '', (v) => v.id === r.id);
        self._removeFromMap(idx.byPlayFilter, r.playFilter || '全部剧目', (v) => v.id === r.id);
      }
    };
  }

  _inventoryItemHandlers() {
    const self = this;
    const idx = this._indexes.inventoryItems;
    return {
      add: (r) => {
        idx.byId.set(r.id, r);
        if (r.taskId) {
          self._addToMap(idx.byTaskId, r.taskId, r);
          self._addToNestedMap(idx.byTaskIdAndStatus, r.taskId, r.actualStatus || '待盘点', r);
        }
        if (r.costumeId) self._addToMap(idx.byCostumeId, r.costumeId, r);
        self._addToSearchIndex(TABLES.inventoryItems, r, ['costumeName', 'costumePlay', 'note', 'expectedLocation']);
      },
      update: (oldR, newR) => {
        if (oldR) {
          self._removeFromSearchIndex(TABLES.inventoryItems, oldR, ['costumeName', 'costumePlay', 'note', 'expectedLocation']);
          if (oldR.taskId) {
            self._removeFromMap(idx.byTaskId, oldR.taskId, (v) => v.id === oldR.id);
            self._removeFromNestedMap(idx.byTaskIdAndStatus, oldR.taskId, oldR.actualStatus || '待盘点', (v) => v.id === oldR.id);
          }
          if (oldR.costumeId) self._removeFromMap(idx.byCostumeId, oldR.costumeId, (v) => v.id === oldR.id);
        }
        idx.byId.set(newR.id, newR);
        if (newR.taskId) {
          self._addToMap(idx.byTaskId, newR.taskId, newR);
          self._addToNestedMap(idx.byTaskIdAndStatus, newR.taskId, newR.actualStatus || '待盘点', newR);
        }
        if (newR.costumeId) self._addToMap(idx.byCostumeId, newR.costumeId, newR);
        self._addToSearchIndex(TABLES.inventoryItems, newR, ['costumeName', 'costumePlay', 'note', 'expectedLocation']);
      },
      remove: (r) => {
        idx.byId.delete(r.id);
        if (r.taskId) {
          self._removeFromMap(idx.byTaskId, r.taskId, (v) => v.id === r.id);
          self._removeFromNestedMap(idx.byTaskIdAndStatus, r.taskId, r.actualStatus || '待盘点', (v) => v.id === r.id);
        }
        if (r.costumeId) self._removeFromMap(idx.byCostumeId, r.costumeId, (v) => v.id === r.id);
        self._removeFromSearchIndex(TABLES.inventoryItems, r, ['costumeName', 'costumePlay', 'note', 'expectedLocation']);
      }
    };
  }

  _riskStatusHandlers() {
    const self = this;
    const idx = this._indexes.riskStatuses;
    return {
      add: (r) => {
        idx.byId.set(r.id, r);
        if (r.riskKey) idx.byRiskKey.set(r.riskKey, r);
        self._addToMap(idx.byStatus, r.status || '', r);
      },
      update: (oldR, newR) => {
        if (oldR) {
          if (oldR.riskKey) idx.byRiskKey.delete(oldR.riskKey);
          self._removeFromMap(idx.byStatus, oldR.status || '', (v) => v.id === oldR.id);
        }
        idx.byId.set(newR.id, newR);
        if (newR.riskKey) idx.byRiskKey.set(newR.riskKey, newR);
        self._addToMap(idx.byStatus, newR.status || '', newR);
      },
      remove: (r) => {
        idx.byId.delete(r.id);
        if (r.riskKey) idx.byRiskKey.delete(r.riskKey);
        self._removeFromMap(idx.byStatus, r.status || '', (v) => v.id === r.id);
      }
    };
  }

  _eventHandlers() {
    const self = this;
    const idx = this._indexes.events;
    return {
      add: (r) => {
        idx.byId.set(r.id, r);
        idx.all.push(r);
        if (r.table) self._addToMap(idx.byTable, r.table, r);
        if (r.table && r.recordId) self._addToMap(idx.byRecordId, `${r.table}|${r.recordId}`, r);
        if (r.deviceId) self._addToMap(idx.byDeviceId, r.deviceId, r);
        idx.all.sort((a, b) => (a.timestamp || '').localeCompare(b.timestamp || ''));
      },
      update: (oldR, newR) => {
        if (oldR) {
          idx.byId.delete(oldR.id);
          if (oldR.table) self._removeFromMap(idx.byTable, oldR.table, (v) => v.id === oldR.id);
          if (oldR.table && oldR.recordId) self._removeFromMap(idx.byRecordId, `${oldR.table}|${oldR.recordId}`, (v) => v.id === oldR.id);
          if (oldR.deviceId) self._removeFromMap(idx.byDeviceId, oldR.deviceId, (v) => v.id === oldR.id);
          const ai = idx.all.findIndex((v) => v.id === oldR.id);
          if (ai !== -1) idx.all.splice(ai, 1);
        }
        idx.byId.set(newR.id, newR);
        idx.all.push(newR);
        if (newR.table) self._addToMap(idx.byTable, newR.table, newR);
        if (newR.table && newR.recordId) self._addToMap(idx.byRecordId, `${newR.table}|${newR.recordId}`, newR);
        if (newR.deviceId) self._addToMap(idx.byDeviceId, newR.deviceId, newR);
        idx.all.sort((a, b) => (a.timestamp || '').localeCompare(b.timestamp || ''));
      },
      remove: (r) => {
        idx.byId.delete(r.id);
        if (r.table) self._removeFromMap(idx.byTable, r.table, (v) => v.id === r.id);
        if (r.table && r.recordId) self._removeFromMap(idx.byRecordId, `${r.table}|${r.recordId}`, (v) => v.id === r.id);
        if (r.deviceId) self._removeFromMap(idx.byDeviceId, r.deviceId, (v) => v.id === r.id);
        const ai = idx.all.findIndex((v) => v.id === r.id);
        if (ai !== -1) idx.all.splice(ai, 1);
      }
    };
  }

  _tombstoneHandlers() {
    const self = this;
    const idx = this._indexes.tombstones;
    return {
      add: (r) => {
        idx.byId.set(r.id, r);
        idx.all.push(r);
        if (r.table) self._addToMap(idx.byTable, r.table, r);
        if (r.table && r.recordId) idx.byTableAndRecordId.set(`${r.table}|${r.recordId}`, r);
      },
      update: (oldR, newR) => {
        if (oldR) {
          idx.byId.delete(oldR.id);
          if (oldR.table) self._removeFromMap(idx.byTable, oldR.table, (v) => v.id === oldR.id);
          if (oldR.table && oldR.recordId) idx.byTableAndRecordId.delete(`${oldR.table}|${oldR.recordId}`);
          const ai = idx.all.findIndex((v) => v.id === oldR.id);
          if (ai !== -1) idx.all.splice(ai, 1);
        }
        idx.byId.set(newR.id, newR);
        idx.all.push(newR);
        if (newR.table) self._addToMap(idx.byTable, newR.table, newR);
        if (newR.table && newR.recordId) idx.byTableAndRecordId.set(`${newR.table}|${newR.recordId}`, newR);
      },
      remove: (r) => {
        idx.byId.delete(r.id);
        if (r.table) self._removeFromMap(idx.byTable, r.table, (v) => v.id === r.id);
        if (r.table && r.recordId) idx.byTableAndRecordId.delete(`${r.table}|${r.recordId}`);
        const ai = idx.all.findIndex((v) => v.id === r.id);
        if (ai !== -1) idx.all.splice(ai, 1);
      }
    };
  }

  getCostumeById(id) {
    return this._indexes.costumes.byId.get(id) || null;
  }

  getRecordById(id) {
    return this._indexes.records.byId.get(id) || null;
  }

  getReservationById(id) {
    return this._indexes.reservations.byId.get(id) || null;
  }

  getWorkOrderById(id) {
    return this._indexes.workOrders.byId.get(id) || null;
  }

  getActorById(id) {
    return this._indexes.actors.byId.get(id) || null;
  }

  getPackingListById(id) {
    return this._indexes.packingLists.byId.get(id) || null;
  }

  getScheduleById(id) {
    return this._indexes.schedules.byId.get(id) || null;
  }

  getInventoryTaskById(id) {
    return this._indexes.inventoryTasks.byId.get(id) || null;
  }

  getInventoryItemById(id) {
    return this._indexes.inventoryItems.byId.get(id) || null;
  }

  getRiskStatusById(id) {
    return this._indexes.riskStatuses.byId.get(id) || null;
  }

  getCostumesByPlay(play) {
    return this._indexes.costumes.byPlay.get(play) || [];
  }

  getCostumesByStatus(status) {
    return this._indexes.costumes.byStatus.get(status) || [];
  }

  getRecordsByCostumeId(costumeId) {
    return this._indexes.records.byCostumeId.get(costumeId) || [];
  }

  getActiveReservationsByPlayAndDate(play, date) {
    return this._indexes.reservations.activeByPlayAndDate.get(play)?.get(date) || [];
  }

  getReservationsByPlayAndDate(play, date) {
    return this._indexes.reservations.byPlayAndDate.get(play + '|' + date) || [];
  }

  getActiveWorkOrdersByCostumeId(costumeId) {
    return this._indexes.workOrders.activeByCostumeId.get(costumeId) || [];
  }

  getWorkOrdersByCostumeId(costumeId) {
    return this._indexes.workOrders.byCostumeId.get(costumeId) || [];
  }

  getPackingListsByPlayAndDate(play, date) {
    return this._indexes.packingLists.byPlayAndDate.get(play + '|' + date) || [];
  }

  getPackingListsReferencingCostume(costumeId) {
    return this._indexes.packingLists.costumeRefs.get(costumeId) || [];
  }

  getScheduleById(id) {
    return this._indexes.schedules.byId.get(id) || null;
  }

  getSchedulesByDate(date) {
    return this._indexes.schedules.byDate.get(date) || [];
  }

  getSchedulesByPlay(play) {
    return this._indexes.schedules.byPlay.get(play) || [];
  }

  getUpcomingSchedules30Days() {
    return this._indexes.schedules.upcoming30Days;
  }

  getSchedulesReferencingCostume(costumeId) {
    return this._indexes.schedules.costumeRefs.get(costumeId) || [];
  }

  getLinkedCostumeIds(scheduleId) {
    return this._indexes.schedules.linkedCostumes.get(scheduleId) || [];
  }

  getInventoryTaskById(id) {
    return this._indexes.inventoryTasks.byId.get(id) || null;
  }

  getInventoryItemsByTaskId(taskId) {
    return this._indexes.inventoryItems.byTaskId.get(taskId) || [];
  }

  getInventoryItemsByTaskIdAndStatus(taskId, status) {
    return this._indexes.inventoryItems.byTaskIdAndStatus.get(taskId)?.get(status) || [];
  }

  getInventoryItemsByCostumeId(costumeId) {
    return this._indexes.inventoryItems.byCostumeId.get(costumeId) || [];
  }

  getRiskStatusByKey(riskKey) {
    return this._indexes.riskStatuses.byRiskKey.get(riskKey) || null;
  }

  getRiskStatusesByStatus(status) {
    return this._indexes.riskStatuses.byStatus.get(status) || [];
  }

  getAllCostumes() {
    return [...this._indexes.costumes.byId.values()];
  }

  getAllRecords() {
    return [...this._indexes.records.byId.values()];
  }

  getAllReservations() {
    return [...this._indexes.reservations.byId.values()];
  }

  getAllWorkOrders() {
    return [...this._indexes.workOrders.byId.values()];
  }

  getAllActors() {
    return [...this._indexes.actors.byId.values()];
  }

  getAllPackingLists() {
    return [...this._indexes.packingLists.byId.values()];
  }

  getAllSchedules() {
    return [...this._indexes.schedules.byId.values()];
  }

  getAllInventoryTasks() {
    return [...this._indexes.inventoryTasks.byId.values()];
  }

  getAllInventoryItems() {
    return [...this._indexes.inventoryItems.byId.values()];
  }

  getAllRiskStatuses() {
    return [...this._indexes.riskStatuses.byId.values()];
  }

  getAllEvents() {
    return [...this._indexes.events.all.slice()];
  }

  getAllTombstones() {
    return [...this._indexes.tombstones.all.slice()];
  }

  getEventById(id) {
    return this._indexes.events.byId.get(id) || null;
  }

  getTombstoneById(id) {
    return this._indexes.tombstones.byId.get(id) || null;
  }

  getEventsByTable(table) {
    return this._indexes.events.byTable.get(table) || [];
  }

  getEventsByRecordId(table, recordId) {
    return this._indexes.events.byRecordId.get(`${table}|${recordId}`) || [];
  }

  getTombstonesByTable(table) {
    return this._indexes.tombstones.byTable.get(table) || [];
  }

  isRecordTombstoned(table, recordId) {
    return this._indexes.tombstones.byTableAndRecordId.has(`${table}|${recordId}`);
  }

  getUniquePlays() {
    return [...this._indexes.schedules.byPlay.keys()].filter(Boolean);
  }

  getUniqueCostumePlays() {
    return [...this._indexes.costumes.byPlay.keys()].filter(Boolean);
  }

  getActivePackingListsByScheduleId(scheduleId) {
    const schedule = this.getScheduleById(scheduleId);
    if (!schedule) return [];
    return this.getPackingListsByPlayAndDate(schedule.play, schedule.date)
      .filter((pl) => !pl.deletedAt);
  }

  getActiveSchedulesByPlayAndDate(play, date) {
    return (this._indexes.schedules.byPlayAndDate.get(play + '|' + date) || [])
      .filter((s) => !s.deletedAt);
  }

  getCostumesWithRisks() {
    const allRisks = this.computeAllRisks();
    const costumeRiskMap = new Map();
    for (const risk of allRisks) {
      if (!risk.costumeId) continue;
      if (!costumeRiskMap.has(risk.costumeId)) {
        costumeRiskMap.set(risk.costumeId, []);
      }
      costumeRiskMap.get(risk.costumeId).push(risk);
    }
    const result = [];
    for (const [costumeId, risks] of costumeRiskMap) {
      const costume = this.getCostumeById(costumeId);
      if (costume) {
        result.push({ costume, risks });
      }
    }
    return result;
  }

  getReferencesForCostume(costumeId) {
    const refs = [];
    for (const r of this.getActiveWorkOrdersByCostumeId(costumeId)) {
      refs.push({ table: TABLES.workOrders, id: r.id, label: `工单：${r.type} - ${r.assignee}` });
    }
    for (const r of this._indexes.reservations.byCostumeId.get(costumeId) || []) {
      if (!r.deletedAt) {
        refs.push({ table: TABLES.reservations, id: r.id, label: `预约：${r.reservedFor}（${r.date}）` });
      }
    }
    for (const pl of this.getPackingListsReferencingCostume(costumeId)) {
      refs.push({ table: TABLES.packingLists, id: pl.id, label: `装箱单：${pl.name}` });
    }
    for (const s of this.getSchedulesReferencingCostume(costumeId)) {
      refs.push({ table: TABLES.schedules, id: s.id, label: `排期：${s.play}（${s.date}）` });
    }
    return refs;
  }

  generateRiskKey(scheduleId, type, costumeId) {
    return `${scheduleId || 'global'}-${type}-${costumeId || 'none'}`;
  }

  computeRiskLevel(risk) {
    if (risk.status === RISK_STATUS.RESOLVED) return 'resolved';
    if (risk.status === RISK_STATUS.DEFERRED) return 'deferred';
    if (risk.status === RISK_STATUS.CONFIRMED) return risk.level;
    return risk.level;
  }

  _getTodayStr() {
    return new Date().toISOString().slice(0, 10);
  }

  _computeCostumeRisksForSchedule(costume, schedule, todayStr, riskStatusMap) {
    const risks = [];
    const date = schedule.date;

    if (costume.status === '借出') {
      const isOverdue = costume.due && costume.due < todayStr;
      if (isOverdue) {
        const type = 'overdue';
        const riskKey = this.generateRiskKey(schedule.id, type, costume.id);
        const statusRecord = riskStatusMap.get(riskKey);
        risks.push({
          level: 'high',
          type,
          costumeId: costume.id,
          costumeName: costume.name,
          message: `「${costume.name}」逾期未还：${costume.borrower}，应还${costume.due}`,
          riskKey,
          processingStatus: statusRecord?.status || RISK_STATUS.PENDING
        });
      } else if (costume.due && costume.due < date) {
        const type = 'borrowed';
        const riskKey = this.generateRiskKey(schedule.id, type, costume.id);
        const statusRecord = riskStatusMap.get(riskKey);
        risks.push({
          level: 'medium',
          type,
          costumeId: costume.id,
          costumeName: costume.name,
          message: `「${costume.name}」借出至${costume.due}，演出前可能未归还`,
          riskKey,
          processingStatus: statusRecord?.status || RISK_STATUS.PENDING
        });
      } else {
        const type = 'borrowed';
        const riskKey = this.generateRiskKey(schedule.id, type, costume.id);
        const statusRecord = riskStatusMap.get(riskKey);
        risks.push({
          level: 'low',
          type,
          costumeId: costume.id,
          costumeName: costume.name,
          message: `「${costume.name}」已借出：${costume.borrower}，至${costume.due}`,
          riskKey,
          processingStatus: statusRecord?.status || RISK_STATUS.PENDING
        });
      }
    }

    if (costume.clean === '待清洗') {
      const type = 'cleaning';
      const riskKey = this.generateRiskKey(schedule.id, type, costume.id);
      const statusRecord = riskStatusMap.get(riskKey);
      risks.push({
        level: 'medium',
        type,
        costumeId: costume.id,
        costumeName: costume.name,
        message: `「${costume.name}」待清洗，演出前需完成`,
        riskKey,
        processingStatus: statusRecord?.status || RISK_STATUS.PENDING
      });
    }
    if (costume.clean === '维修中') {
      const type = 'repair';
      const riskKey = this.generateRiskKey(schedule.id, type, costume.id);
      const statusRecord = riskStatusMap.get(riskKey);
      risks.push({
        level: 'high',
        type,
        costumeId: costume.id,
        costumeName: costume.name,
        message: `「${costume.name}」维修中，演出可能受影响`,
        riskKey,
        processingStatus: statusRecord?.status || RISK_STATUS.PENDING
      });
    }

    const activeWOs = this.getActiveWorkOrdersByCostumeId(costume.id);
    for (const wo of activeWOs) {
      const isWOOverdue = wo.dueDate && wo.dueDate < todayStr;
      if (isWOOverdue) {
        const type = 'workorder_overdue';
        const riskKey = this.generateRiskKey(schedule.id, type, costume.id);
        const statusRecord = riskStatusMap.get(riskKey);
        risks.push({
          level: 'high',
          type,
          costumeId: costume.id,
          costumeName: costume.name,
          message: `「${costume.name}」${wo.type}工单已逾期，负责人：${wo.assignee}`,
          riskKey,
          processingStatus: statusRecord?.status || RISK_STATUS.PENDING
        });
      } else if (wo.dueDate && wo.dueDate > date) {
        const type = 'workorder_late';
        const riskKey = this.generateRiskKey(schedule.id, type, costume.id);
        const statusRecord = riskStatusMap.get(riskKey);
        risks.push({
          level: 'medium',
          type,
          costumeId: costume.id,
          costumeName: costume.name,
          message: `「${costume.name}」${wo.type}工单预计完成${wo.dueDate}，晚于演出日`,
          riskKey,
          processingStatus: statusRecord?.status || RISK_STATUS.PENDING
        });
      }
    }

    return risks;
  }

  _computeReservationRisksForSchedule(schedule, todayStr, riskStatusMap) {
    const risks = [];
    const dayReservations = this.getActiveReservationsByPlayAndDate(schedule.play, schedule.date);

    for (const res of dayReservations) {
      const costume = this.getCostumeById(res.costumeId);
      if (costume && costume.status === '借出') {
        const type = 'reservation_conflict';
        const riskKey = this.generateRiskKey(schedule.id, type, costume.id);
        const statusRecord = riskStatusMap.get(riskKey);
        risks.push({
          level: 'high',
          type,
          costumeId: costume.id,
          costumeName: costume.name,
          message: `预约「${costume.name}」给${res.reservedFor}，但服装已借出`,
          riskKey,
          processingStatus: statusRecord?.status || RISK_STATUS.PENDING
        });
      }
    }

    return risks;
  }

  _computePackingRisksForSchedule(schedule, riskStatusMap) {
    const risks = [];
    const relatedPackingLists = this.getPackingListsByPlayAndDate(schedule.play, schedule.date);

    for (const pl of relatedPackingLists) {
      const unpacked = pl.items.filter((item) => item.status !== '已打包' && item.status !== '已归还').length;
      if (unpacked > 0) {
        const type = 'packing_incomplete';
        const riskKey = this.generateRiskKey(schedule.id, type, pl.id);
        const statusRecord = riskStatusMap.get(riskKey);
        risks.push({
          level: 'medium',
          type,
          costumeId: null,
          costumeName: '',
          message: `装箱单「${pl.name}」有${unpacked}件未打包`,
          riskKey,
          processingStatus: statusRecord?.status || RISK_STATUS.PENDING
        });
      }
    }

    return risks;
  }

  _getRelevantCostumesForSchedule(schedule) {
    const linkedIds = schedule.linkedCostumeIds || [];
    const result = new Map();

    for (const cid of linkedIds) {
      const c = this.getCostumeById(cid);
      if (c) result.set(c.id, c);
    }

    const playCostumes = this.getCostumesByPlay(schedule.play);
    for (const c of playCostumes) {
      if (!result.has(c.id)) result.set(c.id, c);
    }

    return [...result.values()];
  }

  computeRisksForSchedule(scheduleId) {
    const schedule = this.getScheduleById(scheduleId);
    if (!schedule) return { schedule, risks: [], activeRisks: [] };

    const todayStr = this._getTodayStr();
    const riskStatusMap = this._indexes.riskStatuses.byRiskKey;
    const relevantCostumes = this._getRelevantCostumesForSchedule(schedule);

    let allRisks = [];

    for (const costume of relevantCostumes) {
      const costumeRisks = this._computeCostumeRisksForSchedule(costume, schedule, todayStr, riskStatusMap);
      allRisks = allRisks.concat(costumeRisks);
    }

    const reservationRisks = this._computeReservationRisksForSchedule(schedule, todayStr, riskStatusMap);
    allRisks = allRisks.concat(reservationRisks);

    const packingRisks = this._computePackingRisksForSchedule(schedule, riskStatusMap);
    allRisks = allRisks.concat(packingRisks);

    const fullRisks = allRisks.map((risk) => ({
      ...risk,
      scheduleId: schedule.id,
      schedulePlay: schedule.play,
      scheduleDate: schedule.date,
      scheduleTime: schedule.time,
      scheduleVenue: schedule.venue,
      scheduleStatus: schedule.status,
      handler: riskStatusMap.get(risk.riskKey)?.handler || '',
      note: riskStatusMap.get(risk.riskKey)?.note || '',
      updatedAt: riskStatusMap.get(risk.riskKey)?.updatedAt || null
    }));

    const activeRisks = fullRisks.filter((r) => r.processingStatus !== RISK_STATUS.RESOLVED);

    return {
      schedule,
      risks: fullRisks,
      activeRisks,
      highCount: activeRisks.filter((r) => r.level === 'high').length,
      mediumCount: activeRisks.filter((r) => r.level === 'medium').length,
      lowCount: activeRisks.filter((r) => r.level === 'low').length,
      resolvedCount: fullRisks.filter((r) => r.processingStatus === RISK_STATUS.RESOLVED).length,
      deferredCount: fullRisks.filter((r) => r.processingStatus === RISK_STATUS.DEFERRED).length,
      confirmedCount: fullRisks.filter((r) => r.processingStatus === RISK_STATUS.CONFIRMED).length
    };
  }

  computeAllRisks(force = false) {
    if (!force && !this._riskCache.dirty && this._riskCache.allRisks.length > 0) {
      return this._riskCache.allRisks;
    }

    const startTime = performance.now();
    const upcoming = this.getUpcomingSchedules30Days();

    if (force || this._riskCache.allRisks.length === 0 || this._dirtyScheduleIds) {
      const allRisks = [];
      const dirtySet = this._dirtyScheduleIds;
      for (const schedule of upcoming) {
        if (!force && dirtySet && !dirtySet.has(schedule.id)) {
          const cached = this._riskCache.byScheduleId.get(schedule.id);
          if (cached) {
            allRisks.push(...cached.risks);
            continue;
          }
        }
        const result = this.computeRisksForSchedule(schedule.id);
        allRisks.push(...result.risks);
        this._riskCache.byScheduleId.set(schedule.id, result);
      }

      allRisks.sort((a, b) => {
        const levelOrder = { high: 0, medium: 1, low: 2 };
        const statusOrder = { [RISK_STATUS.PENDING]: 0, [RISK_STATUS.CONFIRMED]: 1, [RISK_STATUS.DEFERRED]: 2, [RISK_STATUS.RESOLVED]: 3 };
        const aLevel = a.processingStatus === RISK_STATUS.PENDING ? levelOrder[a.level] : 4;
        const bLevel = b.processingStatus === RISK_STATUS.PENDING ? levelOrder[b.level] : 4;
        if (aLevel !== bLevel) return aLevel - bLevel;
        if (a.scheduleDate !== b.scheduleDate) return a.scheduleDate.localeCompare(b.scheduleDate);
        return statusOrder[a.processingStatus] - statusOrder[b.processingStatus];
      });

      this._riskCache.allRisks = allRisks;
      this._dirtyScheduleIds = null;
    } else {
      let changed = false;
      for (const schedule of upcoming) {
        if (!this._riskCache.byScheduleId.has(schedule.id)) {
          const result = this.computeRisksForSchedule(schedule.id);
          this._riskCache.byScheduleId.set(schedule.id, result);
          changed = true;
        }
      }
      if (changed) {
        const allRisks = [];
        for (const schedule of upcoming) {
          const cached = this._riskCache.byScheduleId.get(schedule.id);
          if (cached) allRisks.push(...cached.risks);
        }
        allRisks.sort((a, b) => {
          const levelOrder = { high: 0, medium: 1, low: 2 };
          const statusOrder = { [RISK_STATUS.PENDING]: 0, [RISK_STATUS.CONFIRMED]: 1, [RISK_STATUS.DEFERRED]: 2, [RISK_STATUS.RESOLVED]: 3 };
          const aLevel = a.processingStatus === RISK_STATUS.PENDING ? levelOrder[a.level] : 4;
          const bLevel = b.processingStatus === RISK_STATUS.PENDING ? levelOrder[b.level] : 4;
          if (aLevel !== bLevel) return aLevel - bLevel;
          if (a.scheduleDate !== b.scheduleDate) return a.scheduleDate.localeCompare(b.scheduleDate);
          return statusOrder[a.processingStatus] - statusOrder[b.processingStatus];
        });
        this._riskCache.allRisks = allRisks;
      }
    }

    this._riskCache.dirty = false;
    this._riskCache.lastBuildTime = performance.now() - startTime;
    this._riskCache.computationCount++;
    this._stats.riskComputationTime = this._riskCache.lastBuildTime;

    this._rebuildRiskSecondaryIndexes(this._riskCache.allRisks);

    return this._riskCache.allRisks;
  }

  _rebuildRiskSecondaryIndexes(allRisks) {
    this._riskCache.byDate.clear();
    this._riskCache.byCostumeId.clear();
    this._riskCache.byPlay.clear();
    this._riskCache.byLevel.clear();
    this._riskCache.byStatus.clear();
    this._riskCache.byType.clear();
    this._searchIndex.risks.clear();
    this._filterCache.risks.clear();

    for (const risk of allRisks) {
      this._addToMap(this._riskCache.byDate, risk.scheduleDate, risk);
      if (risk.costumeId) {
        this._addToMap(this._riskCache.byCostumeId, risk.costumeId, risk);
      }
      this._addToMap(this._riskCache.byPlay, risk.schedulePlay || '', risk);
      this._addToMap(this._riskCache.byLevel, risk.level || '', risk);
      this._addToMap(this._riskCache.byStatus, risk.processingStatus || '', risk);
      this._addToMap(this._riskCache.byType, risk.type || '', risk);

      const searchText = `${risk.schedulePlay || ''} ${risk.costumeName || ''} ${risk.message || ''} ${risk.scheduleDate || ''} ${risk.handler || ''}`;
      const tokens = this._tokenize(searchText);
      const idx = this._searchIndex.risks;
      for (const t of tokens) {
        this._addToMap(idx, t, risk);
      }
    }
  }

  getRiskStats(risks) {
    const data = risks || this.computeAllRisks();
    const stats = {
      total: data.length,
      pending: 0,
      confirmed: 0,
      deferred: 0,
      resolved: 0,
      high: 0,
      medium: 0,
      low: 0,
      byType: {},
      byPlay: {}
    };

    for (const risk of data) {
      stats[risk.processingStatus === RISK_STATUS.PENDING ? 'pending' :
             risk.processingStatus === RISK_STATUS.CONFIRMED ? 'confirmed' :
             risk.processingStatus === RISK_STATUS.DEFERRED ? 'deferred' : 'resolved']++;
      stats[risk.level]++;

      if (!stats.byType[risk.type]) stats.byType[risk.type] = 0;
      stats.byType[risk.type]++;

      if (!stats.byPlay[risk.schedulePlay]) stats.byPlay[risk.schedulePlay] = 0;
      stats.byPlay[risk.schedulePlay]++;
    }

    return stats;
  }

  getRisksByDate(date) {
    this.computeAllRisks();
    return this._riskCache.byDate.get(date) || [];
  }

  getRisksByCostumeId(costumeId) {
    this.computeAllRisks();
    return this._riskCache.byCostumeId.get(costumeId) || [];
  }

  getRisksByScheduleId(scheduleId) {
    this.computeAllRisks();
    const cached = this._riskCache.byScheduleId.get(scheduleId);
    return cached ? cached.risks : [];
  }

  getRisksByPlay(play) {
    this.computeAllRisks();
    return this._riskCache.byPlay.get(play || '') || [];
  }

  getRisksByLevel(level) {
    this.computeAllRisks();
    return this._riskCache.byLevel.get(level || '') || [];
  }

  getRisksByStatus(status) {
    this.computeAllRisks();
    return this._riskCache.byStatus.get(status || '') || [];
  }

  getRisksByType(type) {
    this.computeAllRisks();
    return this._riskCache.byType.get(type || '') || [];
  }

  searchRisks(query) {
    this._stats.searchQueryCount++;
    this.computeAllRisks();
    const idx = this._searchIndex.risks;
    if (!query || !query.trim()) {
      return this._riskCache.allRisks.slice();
    }
    const tokens = this._tokenize(query);
    if (tokens.length === 0) {
      return this._riskCache.allRisks.slice();
    }
    const results = new Map();
    for (const t of tokens) {
      const matches = idx.get(t);
      if (!matches) continue;
      for (const r of matches) {
        results.set(r.riskKey, (results.get(r.riskKey) || 0) + 1);
      }
    }
    const tokenCount = tokens.length;
    const riskByKey = new Map(this._riskCache.allRisks.map(r => [r.riskKey, r]));
    return [...results.entries()]
      .filter(([, score]) => score === tokenCount)
      .sort((a, b) => b[1] - a[1])
      .map(([riskKey]) => riskByKey.get(riskKey))
      .filter(Boolean);
  }

  filterRisks({ play, level, status, type, query } = {}) {
    this._stats.filterQueryCount++;
    this.computeAllRisks();

    const cacheKey = `${play || ''}|${level || ''}|${status || ''}|${type || ''}|${query || ''}`;
    const cached = this._filterCache.risks.get(cacheKey);
    if (cached) {
      this._stats.cacheHits++;
      return cached;
    }
    this._stats.cacheMisses++;

    let candidates = null;
    let smallestSet = null;
    let smallestSize = Infinity;

    if (play && play !== '全部剧目') {
      const s = this._riskCache.byPlay.get(play) || [];
      if (s.length < smallestSize) {
        smallestSize = s.length;
        smallestSet = s;
      }
    }
    if (level && level !== '全部级别') {
      const s = this._riskCache.byLevel.get(level) || [];
      if (s.length < smallestSize) {
        smallestSize = s.length;
        smallestSet = s;
      }
    }
    if (status && status !== '全部状态') {
      const s = this._riskCache.byStatus.get(status) || [];
      if (s.length < smallestSize) {
        smallestSize = s.length;
        smallestSet = s;
      }
    }
    if (type && type !== '全部类型') {
      const s = this._riskCache.byType.get(type) || [];
      if (s.length < smallestSize) {
        smallestSize = s.length;
        smallestSet = s;
      }
    }

    if (query && query.trim()) {
      const queryResults = this.searchRisks(query);
      if (queryResults.length < smallestSize) {
        smallestSize = queryResults.length;
        smallestSet = queryResults;
      }
    }

    candidates = smallestSet || this._riskCache.allRisks;

    const result = candidates.filter((r) => {
      if (play && play !== '全部剧目' && r.schedulePlay !== play) return false;
      if (level && level !== '全部级别' && r.level !== level) return false;
      if (status && status !== '全部状态' && r.processingStatus !== status) return false;
      if (type && type !== '全部类型' && r.type !== type) return false;
      return true;
    });

    this._filterCache.risks.set(cacheKey, result);
    return result;
  }

  invalidateAffectedRisks(changedTable, record) {
    if (!this._dirtyScheduleIds) this._dirtyScheduleIds = new Set();
    const affectedScheduleIds = this._dirtyScheduleIds;
    const upcoming = this.getUpcomingSchedules30Days();

    switch (changedTable) {
      case TABLES.costumes: {
        const costumeSchedules = this.getSchedulesReferencingCostume(record.id);
        for (const s of costumeSchedules) affectedScheduleIds.add(s.id);
        for (const s of upcoming) {
          if (s.play === record.play) affectedScheduleIds.add(s.id);
        }
        break;
      }
      case TABLES.reservations: {
        for (const s of upcoming) {
          if (s.play === record.play && s.date === record.date) {
            affectedScheduleIds.add(s.id);
          }
        }
        break;
      }
      case TABLES.workOrders: {
        const costumeSchedules = this.getSchedulesReferencingCostume(record.costumeId);
        for (const s of costumeSchedules) affectedScheduleIds.add(s.id);
        const costume = this.getCostumeById(record.costumeId);
        if (costume) {
          for (const s of upcoming) {
            if (s.play === costume.play) affectedScheduleIds.add(s.id);
          }
        }
        break;
      }
      case TABLES.packingLists: {
        for (const s of upcoming) {
          if (s.play === record.play && s.date === record.performanceDate) {
            affectedScheduleIds.add(s.id);
          }
        }
        break;
      }
      case TABLES.schedules: {
        affectedScheduleIds.add(record.id);
        break;
      }
      case TABLES.riskStatuses: {
        this._riskCache.dirty = true;
        this._dirtyScheduleIds = null;
        return;
      }
      case TABLES.inventoryItems: {
        if (record.taskId) {
          this.invalidateInventoryTaskStats(record.taskId);
        }
        break;
      }
      case TABLES.inventoryTasks: {
        this.invalidateInventoryTaskStats(null);
        break;
      }
    }

    for (const sid of affectedScheduleIds) {
      this._riskCache.byScheduleId.delete(sid);
      this._suggestionCache.byScheduleId.delete(sid);
    }

    this._riskCache.dirty = true;
    this._suggestionCache.dirty = true;
  }

  filterCostumes(options = {}) {
    this._stats.filterQueryCount++;
    const { query = '', status, clean, play } = options;
    const showOverdue = options.showOverdue || options.onlyOverdue || false;
    const playFilter = options.playFilter || (play === '全部剧目' ? '全部剧目' : play);

    const cacheKey = this._cacheKey({ query, status, clean, play, showOverdue, playFilter });
    const cached = this._filterCache.costumes.get(cacheKey);
    if (cached) {
      this._stats.cacheHits++;
      return cached;
    }
    this._stats.cacheMisses++;

    let candidates;
    let smallestSize = Infinity;

    if (query && query.trim()) {
      const s = this.search(TABLES.costumes, query);
      if (s.length < smallestSize) {
        smallestSize = s.length;
        candidates = s;
      }
    }

    if (play && play !== '全部剧目') {
      const s = this._indexes.costumes.byPlay.get(play) || [];
      if (s.length < smallestSize) {
        smallestSize = s.length;
        candidates = s;
      }
    }

    if (status) {
      if (play && play !== '全部剧目') {
        const s = this._indexes.costumes.byPlayAndStatus.get((play || '') + '|' + (status || '')) || [];
        if (s.length < smallestSize) {
          smallestSize = s.length;
          candidates = s;
        }
      } else {
        const s = this._indexes.costumes.byStatus.get(status) || [];
        if (s.length < smallestSize) {
          smallestSize = s.length;
          candidates = s;
        }
      }
    }

    if (playFilter && playFilter !== '全部剧目' && smallestSize === Infinity) {
      const s = this._indexes.costumes.byPlay.get(playFilter) || [];
      if (s.length < smallestSize) {
        smallestSize = s.length;
        candidates = s;
      }
    }

    if (!candidates) {
      candidates = this._indexes.costumes.allActive;
    }

    const result = candidates.filter((c) => {
      if (status && c.status !== status) return false;
      if (clean && c.clean !== clean) return false;
      if (play && play !== '全部剧目' && c.play !== play) return false;
      if (playFilter && playFilter !== '全部剧目' && c.play !== playFilter) return false;
      if (showOverdue) {
        const todayStr = this._getTodayStr();
        if (!(c.status === '借出' && c.due && c.due < todayStr)) return false;
      }
      if (query && query.trim()) {
        const q = query.toLowerCase();
        const haystack = [c.name, c.play, c.size, c.location, c.borrower].join(' ').toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });

    this._filterCache.costumes.set(cacheKey, result);
    return result;
  }

  filterRecords(options = {}) {
    this._stats.filterQueryCount++;
    const { query = '', type, costumeId, operator } = options;

    const cacheKey = this._cacheKey({ query, type, costumeId, operator });
    const cached = this._filterCache.records.get(cacheKey);
    if (cached) {
      this._stats.cacheHits++;
      return cached;
    }
    this._stats.cacheMisses++;

    let candidates;
    let smallestSize = Infinity;

    if (type) {
      const s = this._indexes.records.byType.get(type) || [];
      if (s.length < smallestSize) {
        smallestSize = s.length;
        candidates = s;
      }
    }

    if (costumeId) {
      const s = this._indexes.records.byCostumeId.get(costumeId) || [];
      if (s.length < smallestSize) {
        smallestSize = s.length;
        candidates = s;
      }
    }

    if (operator) {
      const s = this._indexes.records.byOperator.get(operator) || [];
      if (s.length < smallestSize) {
        smallestSize = s.length;
        candidates = s;
      }
    }

    if (query && query.trim()) {
      const s = this.search(TABLES.records, query);
      if (s.length < smallestSize) {
        smallestSize = s.length;
        candidates = s;
      }
    }

    if (!candidates) {
      candidates = [...this._indexes.records.byId.values()];
    }

    const result = candidates.filter((r) => {
      if (type && r.type !== type) return false;
      if (costumeId && r.costumeId !== costumeId) return false;
      if (operator && r.operator !== operator) return false;
      if (query && query.trim()) {
        const q = query.toLowerCase();
        const haystack = [r.costumeName, r.name, r.operator, r.note, r.summary].join(' ').toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });

    this._filterCache.records.set(cacheKey, result);
    return result;
  }

  filterReservations(options = {}) {
    this._stats.filterQueryCount++;
    const { query = '', status, costumeId, play, reservedFor, dateFrom, dateTo } = options;
    const filter = options.filter || (status === '全部' ? '全部' : status) || '全部';
    const sortBy = options.sortBy || 'date';
    const sortOrder = options.sortOrder || 'asc';

    const cacheKey = this._cacheKey({ query, status, costumeId, play, reservedFor, dateFrom, dateTo, filter, sortBy, sortOrder });
    const cached = this._filterCache.reservations.get(cacheKey);
    if (cached) {
      this._stats.cacheHits++;
      return cached;
    }
    this._stats.cacheMisses++;

    let candidates;
    let smallestSize = Infinity;

    if (costumeId) {
      const s = this._indexes.reservations.byCostumeId.get(costumeId) || [];
      if (s.length < smallestSize) {
        smallestSize = s.length;
        candidates = s;
      }
    }

    if (play) {
      const s = this._indexes.reservations.byPlay.get(play) || [];
      if (s.length < smallestSize) {
        smallestSize = s.length;
        candidates = s;
      }
    }

    if (reservedFor) {
      const s = this._indexes.reservations.byReservedFor.get(reservedFor) || [];
      if (s.length < smallestSize) {
        smallestSize = s.length;
        candidates = s;
      }
    }

    if (status && status !== '全部') {
      const s = this._indexes.reservations.byStatus.get(status) || [];
      if (s.length < smallestSize) {
        smallestSize = s.length;
        candidates = s;
      }
    }

    if (query && query.trim()) {
      const s = this.search(TABLES.reservations, query);
      if (s.length < smallestSize) {
        smallestSize = s.length;
        candidates = s;
      }
    }

    if (!candidates) {
      candidates = [...this._indexes.reservations.byId.values()];
    }

    let result = candidates.filter((r) => {
      if (status && status !== '全部' && r.status !== status) return false;
      if (costumeId && r.costumeId !== costumeId) return false;
      if (play && r.play !== play) return false;
      if (reservedFor && r.reservedFor !== reservedFor) return false;
      if (dateFrom && r.date < dateFrom) return false;
      if (dateTo && r.date > dateTo) return false;
      if (query && query.trim()) {
        const q = query.toLowerCase();
        const haystack = [r.costumeName, r.reservedFor, r.note, r.play].join(' ').toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });

    const todayStr = this._getTodayStr();
    if (filter === 'active' || filter === '有效') {
      result = result.filter((r) => r.status === 'active');
    } else if (filter === 'inactive' || filter === '已取消') {
      result = result.filter((r) => r.status !== 'active');
    } else if (filter === '即将到来') {
      result = result.filter((r) => r.status === 'active' && r.date >= todayStr);
    } else if (filter === '已过期') {
      result = result.filter((r) => r.status === 'active' && r.date < todayStr);
    }

    if (sortBy === 'date') {
      result.sort((a, b) => {
        const comp = a.date.localeCompare(b.date);
        return sortOrder === 'desc' ? -comp : comp;
      });
    }

    this._filterCache.reservations.set(cacheKey, result);
    return result;
  }

  filterWorkOrders(options = {}) {
    this._stats.filterQueryCount++;
    const { query = '', status, costumeId, play, responsiblePerson, priority, type } = options;
    const statusFilter = options.statusFilter || (status === '全部' ? '全部' : status) || '全部';
    const typeFilter = options.typeFilter || (type === '全部' ? '全部' : type) || '全部';
    const sortBy = options.sortBy || 'createdAt';
    const sortOrder = options.sortOrder || 'desc';

    const cacheKey = this._cacheKey({ query, status, costumeId, play, responsiblePerson, priority, type, statusFilter, typeFilter, sortBy, sortOrder });
    const cached = this._filterCache.workOrders.get(cacheKey);
    if (cached) {
      this._stats.cacheHits++;
      return cached;
    }
    this._stats.cacheMisses++;

    let candidates;
    let smallestSize = Infinity;

    if (statusFilter !== '全部') {
      let s;
      if (statusFilter === '待处理') {
        const s1 = this.getWorkOrdersByStatus('待清洗');
        const s2 = this.getWorkOrdersByStatus('待维修');
        s = [...s1, ...s2];
      } else if (statusFilter === '处理中') {
        const s1 = this.getWorkOrdersByStatus('清洗中');
        const s2 = this.getWorkOrdersByStatus('维修中');
        s = [...s1, ...s2];
      } else if (statusFilter === '已逾期') {
        const todayStr = this._getTodayStr();
        const active = [...WORK_ORDER_ACTIVE_STATUSES_SET];
        s = [];
        for (const st of active) {
          const items = this.getWorkOrdersByStatus(st);
          for (const wo of items) {
            if (wo.dueDate && wo.dueDate < todayStr) {
              s.push(wo);
            }
          }
        }
      } else {
        s = this.getWorkOrdersByStatus(statusFilter);
      }
      if (s.length < smallestSize) {
        smallestSize = s.length;
        candidates = s;
      }
    } else if (status && status !== '全部') {
      const s = this._indexes.workOrders.byStatus.get(status) || [];
      if (s.length < smallestSize) {
        smallestSize = s.length;
        candidates = s;
      }
    }

    if (costumeId) {
      const s = this._indexes.workOrders.byCostumeId.get(costumeId) || [];
      if (s.length < smallestSize) {
        smallestSize = s.length;
        candidates = s;
      }
    }

    if (play) {
      const s = this._indexes.workOrders.byPlay.get(play) || [];
      if (s.length < smallestSize) {
        smallestSize = s.length;
        candidates = s;
      }
    }

    if (typeFilter !== '全部') {
      const s = this.getWorkOrdersByType(typeFilter);
      if (s.length < smallestSize) {
        smallestSize = s.length;
        candidates = s;
      }
    } else if (type && type !== '全部') {
      const s = this._indexes.workOrders.byType.get(type) || [];
      if (s.length < smallestSize) {
        smallestSize = s.length;
        candidates = s;
      }
    }

    if (query && query.trim()) {
      const s = this.search(TABLES.workOrders, query);
      if (s.length < smallestSize) {
        smallestSize = s.length;
        candidates = s;
      }
    }

    if (!candidates) {
      candidates = [...this._indexes.workOrders.byId.values()];
    }

    let result = candidates.filter((wo) => {
      if (status && status !== '全部' && wo.status !== status) return false;
      if (statusFilter !== '全部') {
        if (statusFilter === '待处理') {
          if (wo.status !== '待清洗' && wo.status !== '待维修') return false;
        } else if (statusFilter === '处理中') {
          if (wo.status !== '清洗中' && wo.status !== '维修中') return false;
        } else if (statusFilter === '已逾期') {
          const todayStr = this._getTodayStr();
          if (!WORK_ORDER_ACTIVE_STATUSES_SET.has(wo.status) || !wo.dueDate || wo.dueDate >= todayStr) return false;
        } else {
          if (wo.status !== statusFilter) return false;
        }
      }
      if (costumeId && wo.costumeId !== costumeId) return false;
      if (play && wo.play !== play) return false;
      if (type && type !== '全部' && wo.type !== type) return false;
      if (typeFilter !== '全部' && wo.type !== typeFilter) return false;
      if (responsiblePerson) {
        const rp = responsiblePerson.toLowerCase();
        if (!(wo.assignee || '').toLowerCase().includes(rp)) return false;
      }
      if (query && query.trim()) {
        const q = query.toLowerCase();
        const haystack = [wo.costumeName, wo.play, wo.assignee, wo.note, wo.type].join(' ').toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });

    if (sortBy === 'createdAt') {
      result.sort((a, b) => {
        const timeA = new Date(a.createdAt || 0).getTime();
        const timeB = new Date(b.createdAt || 0).getTime();
        return sortOrder === 'desc' ? timeB - timeA : timeA - timeB;
      });
    }

    this._filterCache.workOrders.set(cacheKey, result);
    return result;
  }

  filterSchedules(options = {}) {
    this._stats.filterQueryCount++;
    const { query = '', play, date, status, linkedCostumeId, reservedForActor } = options;
    const playFilter = options.playFilter || (play === '全部剧目' ? '全部剧目' : play) || '全部剧目';
    const statusFilter = options.statusFilter || (status === '全部' ? '全部' : status) || '全部';
    const dateFrom = options.dateFrom || null;
    const dateTo = options.dateTo || null;

    const cacheKey = this._cacheKey({ query, play, date, status, linkedCostumeId, reservedForActor, playFilter, statusFilter, dateFrom, dateTo });
    const cached = this._filterCache.schedules.get(cacheKey);
    if (cached) {
      this._stats.cacheHits++;
      return cached;
    }
    this._stats.cacheMisses++;

    let candidates;
    let smallestSize = Infinity;

    if (play && play !== '全部剧目') {
      const s = this._indexes.schedules.byPlay.get(play) || [];
      if (s.length < smallestSize) {
        smallestSize = s.length;
        candidates = s;
      }
    }
    if (playFilter && playFilter !== '全部剧目' && smallestSize === Infinity) {
      const s = this._indexes.schedules.byPlay.get(playFilter) || [];
      if (s.length < smallestSize) {
        smallestSize = s.length;
        candidates = s;
      }
    }

    if (date) {
      const s = this._indexes.schedules.byDate.get(date) || [];
      if (s.length < smallestSize) {
        smallestSize = s.length;
        candidates = s;
      }
    }

    if (play && play !== '全部剧目' && date) {
      const s = this._indexes.schedules.byPlayAndDate.get(play + '|' + date) || [];
      if (s.length < smallestSize) {
        smallestSize = s.length;
        candidates = s;
      }
    } else if (playFilter && playFilter !== '全部剧目' && date) {
      const s = this._indexes.schedules.byPlayAndDate.get(playFilter + '|' + date) || [];
      if (s.length < smallestSize) {
        smallestSize = s.length;
        candidates = s;
      }
    }

    if (status && status !== '全部') {
      const s = this._indexes.schedules.byStatus.get(status) || [];
      if (s.length < smallestSize) {
        smallestSize = s.length;
        candidates = s;
      }
    }
    if (statusFilter !== '全部' && smallestSize === Infinity) {
      const s = this._indexes.schedules.byStatus.get(statusFilter) || [];
      if (s.length < smallestSize) {
        smallestSize = s.length;
        candidates = s;
      }
    }

    if (linkedCostumeId) {
      const s = this._indexes.schedules.costumeRefs.get(linkedCostumeId) || [];
      if (s.length < smallestSize) {
        smallestSize = s.length;
        candidates = s;
      }
    }

    if (query && query.trim()) {
      const s = this.search(TABLES.schedules, query);
      if (s.length < smallestSize) {
        smallestSize = s.length;
        candidates = s;
      }
    }

    if (!candidates) {
      candidates = [...this._indexes.schedules.byId.values()];
    }

    let result = candidates.filter((s) => {
      if (play && play !== '全部剧目' && s.play !== play) return false;
      if (playFilter && playFilter !== '全部剧目' && s.play !== playFilter) return false;
      if (date && s.date !== date) return false;
      if (status && status !== '全部' && s.status !== status) return false;
      if (statusFilter !== '全部' && s.status !== statusFilter) return false;
      if (linkedCostumeId) {
        const linked = s.linkedCostumeIds || [];
        if (!linked.includes(linkedCostumeId)) return false;
      }
      if (reservedForActor) {
        const dayRes = this.getActiveReservationsByPlayAndDate(s.play, s.date);
        const hasActor = dayRes.some(r => (r.reservedFor || '').includes(reservedForActor) && r.type === '演员');
        if (!hasActor) return false;
      }
      if (dateFrom && s.date < dateFrom) return false;
      if (dateTo && s.date > dateTo) return false;
      if (query && query.trim()) {
        const q = query.toLowerCase();
        const haystack = [s.title, s.play, s.scene, s.note, s.venue].join(' ').toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });

    result.sort((a, b) => a.date.localeCompare(b.date) || (a.time || '').localeCompare(b.time || ''));

    this._filterCache.schedules.set(cacheKey, result);
    return result;
  }

  filterPackingLists(options = {}) {
    this._stats.filterQueryCount++;
    const { query = '', status, play, performanceDate } = options;
    const filter = options.filter || '全部';
    const costumeId = options.costumeId || null;
    const date = options.date || performanceDate || null;

    const cacheKey = this._cacheKey({ query, status, play, performanceDate, filter, costumeId, date });
    const cached = this._filterCache.packingLists.get(cacheKey);
    if (cached) {
      this._stats.cacheHits++;
      return cached;
    }
    this._stats.cacheMisses++;

    let candidates;
    let smallestSize = Infinity;

    if (play) {
      const s = this._indexes.packingLists.byPlay.get(play) || [];
      if (s.length < smallestSize) {
        smallestSize = s.length;
        candidates = s;
      }
    }

    if (performanceDate) {
      const s = this._indexes.packingLists.byPerformanceDate.get(performanceDate) || [];
      if (s.length < smallestSize) {
        smallestSize = s.length;
        candidates = s;
      }
    }

    if (play && (performanceDate || date)) {
      const s = this._indexes.packingLists.byPlayAndDate.get(play + '|' + (performanceDate || date)) || [];
      if (s.length < smallestSize) {
        smallestSize = s.length;
        candidates = s;
      }
    }

    if (status && status !== '全部') {
      const s = this._indexes.packingLists.byStatus?.get?.(status) || [];
      if (s.length < smallestSize) {
        smallestSize = s.length;
        candidates = s;
      }
    }

    if (query && query.trim()) {
      const s = this.search(TABLES.packingLists, query);
      if (s.length < smallestSize) {
        smallestSize = s.length;
        candidates = s;
      }
    }

    if (!candidates) {
      candidates = [...this._indexes.packingLists.byId.values()];
    }

    let result = candidates.filter((pl) => {
      if (status && status !== '全部' && pl.status !== status) return false;
      if (play && pl.play !== play) return false;
      if (performanceDate && pl.performanceDate !== performanceDate) return false;
      if (date && pl.performanceDate !== date) return false;
      if (query && query.trim()) {
        const q = query.toLowerCase();
        const haystack = [pl.name, pl.play, pl.note].join(' ').toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });

    const todayStr = this._getTodayStr();
    if (filter === '即将演出') {
      result = result.filter((pl) => pl.performanceDate >= todayStr);
    } else if (filter === '已过期') {
      result = result.filter((pl) => pl.performanceDate < todayStr);
    }

    if (costumeId) {
      result = result.filter(pl => {
        return Array.isArray(pl.items) && pl.items.some(item => item.costumeId === costumeId);
      });
    }

    result.sort((a, b) => a.performanceDate.localeCompare(b.performanceDate));

    this._filterCache.packingLists.set(cacheKey, result);
    return result;
  }

  filterInventoryItems(options = {}) {
    this._stats.filterQueryCount++;
    const { query = '', taskId, costumeId, status, expectedLocation } = options;
    const statusFilter = options.statusFilter || (status === '全部' ? '全部' : status) || '全部';

    const cacheKey = this._cacheKey({ query, taskId, costumeId, status, expectedLocation, statusFilter });
    const cached = this._filterCache.inventoryItems.get(cacheKey);
    if (cached) {
      this._stats.cacheHits++;
      return cached;
    }
    this._stats.cacheMisses++;

    let candidates;
    let smallestSize = Infinity;

    if (taskId) {
      const s = this._indexes.inventoryItems.byTaskId.get(taskId) || [];
      if (s.length < smallestSize) {
        smallestSize = s.length;
        candidates = s;
      }
    }

    if (costumeId) {
      const s = this._indexes.inventoryItems.byCostumeId.get(costumeId) || [];
      if (s.length < smallestSize) {
        smallestSize = s.length;
        candidates = s;
      }
    }

    if (taskId && status && status !== '全部') {
      const s = this._indexes.inventoryItems.byTaskIdAndStatus.get(taskId)?.get?.(status) || [];
      if (s.length < smallestSize) {
        smallestSize = s.length;
        candidates = s;
      }
    } else if (taskId && statusFilter !== '全部') {
      const s = this._indexes.inventoryItems.byTaskIdAndStatus.get(taskId)?.get?.(statusFilter) || [];
      if (s.length < smallestSize) {
        smallestSize = s.length;
        candidates = s;
      }
    }

    if (query && query.trim()) {
      const s = this.search(TABLES.inventoryItems, query);
      if (s.length < smallestSize) {
        smallestSize = s.length;
        candidates = s;
      }
    }

    if (!candidates) {
      candidates = [...this._indexes.inventoryItems.byId.values()];
    }

    const result = candidates.filter((i) => {
      if (taskId && i.taskId !== taskId) return false;
      if (costumeId && i.costumeId !== costumeId) return false;
      if (status && status !== '全部' && i.actualStatus !== status) return false;
      if (statusFilter !== '全部' && i.actualStatus !== statusFilter) return false;
      if (expectedLocation) {
        const el = expectedLocation.toLowerCase();
        if (!(i.expectedLocation || '').toLowerCase().includes(el)) return false;
      }
      if (query && query.trim()) {
        const q = query.toLowerCase();
        const haystack = [i.costumeName, i.costumePlay, i.note, i.expectedLocation].join(' ').toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });

    this._filterCache.inventoryItems.set(cacheKey, result);
    return result;
  }

  filterInventoryTasks(options = {}) {
    this._stats.filterQueryCount++;
    const { query = '', status, playFilter } = options;
    const statusFilter = options.statusFilter || (status === '全部' ? '全部' : status) || '全部';

    const cacheKey = this._cacheKey({ query, status, playFilter, statusFilter });
    const cached = this._filterCache.inventoryTasks.get(cacheKey);
    if (cached) {
      this._stats.cacheHits++;
      return cached;
    }
    this._stats.cacheMisses++;

    let candidates;
    let smallestSize = Infinity;

    if (statusFilter !== '全部') {
      const s = this.getInventoryTasksByStatus(statusFilter);
      if (s.length < smallestSize) {
        smallestSize = s.length;
        candidates = s;
      }
    } else if (status && status !== '全部') {
      const s = this._indexes.inventoryTasks.byStatus.get(status) || [];
      if (s.length < smallestSize) {
        smallestSize = s.length;
        candidates = s;
      }
    }

    if (playFilter) {
      const s = this.getInventoryTasksByPlayFilter(playFilter);
      if (s.length < smallestSize) {
        smallestSize = s.length;
        candidates = s;
      }
    }

    if (query && query.trim()) {
      const s = this._searchInventoryTasks(query);
      if (s.length < smallestSize) {
        smallestSize = s.length;
        candidates = s;
      }
    }

    if (!candidates) {
      candidates = [...this._indexes.inventoryTasks.byId.values()];
    }

    const result = candidates.filter((t) => {
      if (status && status !== '全部' && t.status !== status) return false;
      if (statusFilter !== '全部' && t.status !== statusFilter) return false;
      if (playFilter && t.playFilter !== playFilter) return false;
      if (query && query.trim()) {
        const q = query.toLowerCase();
        const haystack = [t.name, t.playFilter, t.creator, t.note].join(' ').toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });

    result.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    this._filterCache.inventoryTasks.set(cacheKey, result);
    return result;
  }

  _searchInventoryTasks(query) {
    const tokens = this._tokenize(query);
    if (tokens.length === 0) return [...this._indexes.inventoryTasks.byId.values()];
    const scoreMap = new Map();
    const idx = this._searchIndex.inventoryTasks;
    for (const t of tokens) {
      const matches = idx.get(t);
      if (!matches) continue;
      for (const r of matches) scoreMap.set(r.id, (scoreMap.get(r.id) || 0) + 1);
    }
    return [...scoreMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([id]) => this._indexes.inventoryTasks.byId.get(id))
      .filter(Boolean);
  }

  getPerformanceStats() {
    const recordCounts = this._stats.recordCounts || {
      costumes: this._indexes.costumes.byId.size,
      records: this._indexes.records.byId.size,
      reservations: this._indexes.reservations.byId.size,
      workOrders: this._indexes.workOrders.byId.size,
      actors: this._indexes.actors.byId.size,
      packingLists: this._indexes.packingLists.byId.size,
      schedules: this._indexes.schedules.byId.size,
      inventoryTasks: this._indexes.inventoryTasks.byId.size,
      inventoryItems: this._indexes.inventoryItems.byId.size,
      riskStatuses: this._indexes.riskStatuses.byId.size,
      events: this._indexes.events.byId.size,
      tombstones: this._indexes.tombstones.byId.size
    };
    const cacheQueries = this._stats.cacheHits + this._stats.cacheMisses;

    return {
      ...this._stats,
      recordCounts,
      totalRecords: Object.values(recordCounts).reduce((sum, count) => sum + count, 0),
      searchQueries: this._stats.searchQueryCount,
      filterQueries: this._stats.filterQueryCount,
      cacheHitRate: cacheQueries > 0 ? (this._stats.cacheHits / cacheQueries) * 100 : 0,
      batchMode: this._batchMode,
      pendingBatchChanges: {
        added: this._batchChanges.added.size,
        updated: this._batchChanges.updated.size,
        removed: this._batchChanges.removed.size,
        affectedSchedules: this._batchChanges.affectedScheduleIds.size
      },
      riskCache: {
        dirty: this._riskCache.dirty,
        allRisksCount: this._riskCache.allRisks.length,
        byScheduleCount: this._riskCache.byScheduleId.size,
        byDateCount: this._riskCache.byDate.size,
        byCostumeCount: this._riskCache.byCostumeId.size,
        lastBuildTime: this._riskCache.lastBuildTime,
        computationCount: this._riskCache.computationCount
      },
      filterCacheSizes: {
        costumes: this._filterCache.costumes.size,
        records: this._filterCache.records.size,
        reservations: this._filterCache.reservations.size,
        workOrders: this._filterCache.workOrders.size,
        schedules: this._filterCache.schedules.size,
        packingLists: this._filterCache.packingLists.size,
        inventoryItems: this._filterCache.inventoryItems.size,
        actors: this._filterCache.actors.size,
        inventoryTasks: this._filterCache.inventoryTasks.size
      },
      searchTokensCacheSize: this._searchTokensCache.size,
      inventoryStatsCacheSize: this._inventoryStatsCache.size,
      relationIndexSizes: {
        costumeToSchedules: this._relationIndex.costumeToSchedules.size,
        costumeToReservations: this._relationIndex.costumeToReservations.size,
        costumeToWorkOrders: this._relationIndex.costumeToWorkOrders.size,
        costumeToPackingLists: this._relationIndex.costumeToPackingLists.size,
        costumeToInventoryItems: this._relationIndex.costumeToInventoryItems.size,
        costumeToRecords: this._relationIndex.costumeToRecords.size,
        scheduleToCostumes: this._relationIndex.scheduleToCostumes.size,
        playToCostumes: this._relationIndex.playToCostumes.size,
        playToSchedules: this._relationIndex.playToSchedules.size
      }
    };
  }

  clearAllCaches() {
    this._searchTokensCache.clear();
    this.invalidateFilterCaches();
    this._inventoryStatsCache.clear();
    this.invalidateSummaryCache();
    this._riskCache.dirty = true;
    this._summaryCache.dirty = true;
    this._invalidated = true;
    this._riskCache.byScheduleId.clear();
    this._riskCache.byDate.clear();
    this._riskCache.byCostumeId.clear();
    this._riskCache.byPlay.clear();
    this._riskCache.byLevel.clear();
    this._riskCache.byStatus.clear();
    this._riskCache.byType.clear();
    this._riskCache.allRisks = [];
    this._searchIndex.risks.clear();
    this._dirtyScheduleIds = null;
    this.notify();
  }

  getIndexSummary() {
    return {
      costumes: {
        total: this._indexes.costumes.byId.size,
        active: this._indexes.costumes.allActive.length,
        byPlay: this._indexes.costumes.byPlay.size,
        byStatus: this._indexes.costumes.byStatus.size
      },
      schedules: {
        total: this._indexes.schedules.byId.size,
        upcoming30Days: this._indexes.schedules.upcoming30Days.length,
        byPlay: this._indexes.schedules.byPlay.size,
        byDate: this._indexes.schedules.byDate.size
      },
      inventoryItems: {
        total: this._indexes.inventoryItems.byId.size,
        byTaskId: this._indexes.inventoryItems.byTaskId.size,
        byCostumeId: this._indexes.inventoryItems.byCostumeId.size
      },
      workOrders: {
        total: this._indexes.workOrders.byId.size,
        activeByCostumeId: this._indexes.workOrders.activeByCostumeId.size
      },
      records: {
        total: this._indexes.records.byId.size,
        byCostumeId: this._indexes.records.byCostumeId.size
      },
      reservations: {
        total: this._indexes.reservations.byId.size
      },
      packingLists: {
        total: this._indexes.packingLists.byId.size
      }
    };
  }

  _normalizeDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    return d.toISOString().slice(0, 10);
  }

  autoLinkCostumes(scheduleId) {
    const schedule = this.getScheduleById(scheduleId);
    if (!schedule) return [];
    const linkedIds = new Set(schedule.linkedCostumeIds || []);
    const playReservations = this.getActiveReservationsByPlayAndDate(schedule.play, schedule.date);
    for (const res of playReservations) {
      if (res.costumeId) linkedIds.add(res.costumeId);
    }
    const playPackingLists = this.getPackingListsByPlayAndDate(schedule.play, schedule.date);
    for (const pl of playPackingLists) {
      if (Array.isArray(pl.items)) {
        for (const item of pl.items) {
          if (item.costumeId) linkedIds.add(item.costumeId);
        }
      }
    }
    return [...linkedIds];
  }

  generatePackingListFromSchedule(scheduleId) {
    const schedule = this.getScheduleById(scheduleId);
    if (!schedule) return null;
    const collected = new Map();
    const schedDateNorm = this._normalizeDate(schedule.date);
    if (!schedDateNorm) {
      return {
        play: schedule.play,
        performanceDate: schedule.date,
        name: `${schedule.play} - ${schedule.date} 装箱单`,
        note: '排期日期无效，无法生成装箱单',
        items: [],
        sourceScheduleId: schedule.id,
        generatedAt: new Date().toISOString()
      };
    }
    const linkedIds = schedule.linkedCostumeIds || [];
    for (const cid of linkedIds) {
      const c = this.getCostumeById(cid);
      if (c && !collected.has(c.id)) {
        collected.set(c.id, { costume: c, source: '排期关联' });
      }
    }
    const schedDate = new Date(schedDateNorm);
    const rangeStart = new Date(schedDate);
    rangeStart.setDate(rangeStart.getDate() - 30);
    const rangeStartStr = rangeStart.toISOString().slice(0, 10);
    const rangeEnd = new Date(schedDate);
    rangeEnd.setDate(rangeEnd.getDate() + 7);
    const rangeEndStr = rangeEnd.toISOString().slice(0, 10);
    const dayReservations = this.getActiveReservationsByPlayAndDate(schedule.play, schedule.date);
    for (const r of dayReservations) {
      const c = this.getCostumeById(r.costumeId);
      if (c && !collected.has(c.id)) {
        collected.set(c.id, { costume: c, source: '同日预约' });
      }
    }
    const allReservations = this.getAllReservations();
    for (const r of allReservations) {
      if (r.status !== 'active') continue;
      if (r.play !== schedule.play) continue;
      const rDate = this._normalizeDate(r.date);
      if (rDate === schedDateNorm) continue;
      if (rDate >= rangeStartStr && rDate < schedDateNorm) {
        const c = this.getCostumeById(r.costumeId);
        if (c && !collected.has(c.id)) {
          collected.set(c.id, { costume: c, source: '剧目预约' });
        }
      }
    }
    const playCostumes = this.getCostumesByPlay(schedule.play);
    for (const c of playCostumes) {
      if (!collected.has(c.id)) {
        collected.set(c.id, { costume: c, source: '剧目服装' });
      }
    }
    const todayStr = this._getTodayStr();
    const items = [];
    for (const { costume, source } of collected.values()) {
      const risks = [];
      let initialStatus = '未标记';
      let note = '';
      if (costume.status === '借出') {
        const isOverdue = costume.due && costume.due < todayStr;
        if (isOverdue) {
          risks.push({ type: 'overdue', label: `逾期未还：${costume.borrower}，应还${costume.due}` });
          initialStatus = '缺失';
          note = `逾期未还：${costume.borrower}`;
        } else {
          risks.push({ type: 'borrowed', label: `已借出：${costume.borrower}，至${costume.due}` });
          if (costume.due && costume.due < schedule.date) {
            initialStatus = '缺失';
            note = `借出至${costume.due}，演出前可能未归还`;
          } else {
            note = `已借出：${costume.borrower}`;
          }
        }
      }
      if (costume.clean === '待清洗') {
        risks.push({ type: 'workorder', label: '档案状态：待清洗' });
        if (initialStatus === '未标记') {
          initialStatus = '需清洗';
          note = '待清洗';
        } else {
          note = note ? note + '；待清洗' : '待清洗';
        }
      } else if (costume.clean === '维修中') {
        risks.push({ type: 'workorder', label: '档案状态：维修中' });
        initialStatus = '缺失';
        note = note ? note + '；维修中' : '维修中';
      }
      const activeWOs = this.getActiveWorkOrdersByCostumeId(costume.id);
      if (activeWOs.length > 0) {
        const activeWO = activeWOs[0];
        const isWOOverdue = activeWO.dueDate && activeWO.dueDate < todayStr;
        if (isWOOverdue) {
          risks.push({ type: 'workorder', label: `${activeWO.type}工单已逾期，负责人：${activeWO.assignee}` });
          initialStatus = '缺失';
          note = note ? note + `；${activeWO.type}工单逾期` : `${activeWO.type}工单逾期`;
        } else if (activeWO.dueDate && activeWO.dueDate > schedule.date) {
          risks.push({ type: 'workorder', label: `${activeWO.type}中：${activeWO.status}，预计完成${activeWO.dueDate}，晚于演出日` });
          initialStatus = '缺失';
          note = note ? note + `；${activeWO.type}工单完成晚于演出日` : `${activeWO.type}工单完成晚于演出日`;
        } else {
          risks.push({ type: 'workorder', label: `${activeWO.type}中：${activeWO.status}，负责人${activeWO.assignee}` });
          if (activeWO.type === '清洗' && initialStatus === '未标记') {
            initialStatus = '需清洗';
          } else if (activeWO.type === '维修' && (initialStatus === '未标记' || initialStatus === '需清洗')) {
            initialStatus = '缺失';
          }
          note = note ? note + `；${activeWO.type}工单进行中` : `${activeWO.type}工单进行中`;
        }
      }
      items.push({
        costumeId: costume.id,
        costumeName: costume.name,
        size: costume.size,
        location: costume.location,
        status: initialStatus,
        note: note,
        risks: risks,
        source: source
      });
    }
    items.sort((a, b) => {
      const getRank = (s) => {
        if (s === '缺失') return 0;
        if (s === '需清洗') return 1;
        return 2;
      };
      const rankDiff = getRank(a.status) - getRank(b.status);
      if (rankDiff !== 0) return rankDiff;
      return a.costumeName.localeCompare(b.costumeName);
    });
    let suggestedName = `${schedule.play} - ${schedule.date} 装箱单`;
    if (schedule.time) {
      suggestedName = `${schedule.play} ${schedule.time} - ${schedule.date} 装箱单`;
    }
    return {
      play: schedule.play,
      performanceDate: schedule.date,
      name: suggestedName,
      note: `由排期「${schedule.play} ${schedule.date}${schedule.time ? ' ' + schedule.time : ''}」一键生成，来源包含：排期关联、同日预约、剧目预约、剧目服装。${schedule.venue ? ' 演出场地：' + schedule.venue : ''}${schedule.note ? ' 排期备注：' + schedule.note : ''}`,
      items: items,
      sourceScheduleId: schedule.id,
      generatedAt: new Date().toISOString()
    };
  }

  computeInventoryTaskStats(taskId) {
    const items = this.getInventoryItemsByTaskId(taskId);
    const stats = {
      completedCount: 0,
      normalCount: 0,
      missingCount: 0,
      locationMismatchCount: 0,
      statusMismatchCount: 0
    };
    const PENDING = '待盘点';
    const NORMAL = '正常';
    const MISSING = '缺失';
    const LOCATION_MISMATCH = '位置不符';
    const STATUS_MISMATCH = '状态不符';
    items.forEach((item) => {
      if (item.actualStatus !== PENDING) {
        stats.completedCount++;
      }
      if (item.actualStatus === NORMAL) {
        stats.normalCount++;
      } else if (item.actualStatus === MISSING) {
        stats.missingCount++;
      } else if (item.actualStatus === LOCATION_MISMATCH) {
        stats.locationMismatchCount++;
      } else if (item.actualStatus === STATUS_MISMATCH) {
        stats.statusMismatchCount++;
      }
    });
    return stats;
  }

  updateInventoryItemStats(taskId) {
    this.invalidateInventoryTaskStats(taskId);
    const items = this.getInventoryItemsByTaskId(taskId);
    const PENDING = '待盘点';
    const NORMAL = '正常';
    const MISSING = '缺失';
    const LOCATION_MISMATCH = '位置不符';
    const STATUS_MISMATCH = '状态不符';
    const EXTRA = '多余';

    const stats = {
      total: items.length,
      completed: 0,
      pending: 0,
      normal: 0,
      missing: 0,
      extra: 0,
      locationMismatch: 0,
      statusMismatch: 0,
      discrepancy: 0,
      expectedCount: 0,
      found: 0
    };

    items.forEach((item) => {
      if (item.actualStatus !== PENDING) {
        stats.completed++;
        stats.found++;
      } else {
        stats.pending++;
      }
      stats.expectedCount++;

      switch (item.actualStatus) {
        case NORMAL:
          stats.normal++;
          break;
        case MISSING:
          stats.missing++;
          stats.discrepancy++;
          break;
        case EXTRA:
          stats.extra++;
          stats.discrepancy++;
          break;
        case LOCATION_MISMATCH:
          stats.locationMismatch++;
          stats.discrepancy++;
          break;
        case STATUS_MISMATCH:
          stats.statusMismatch++;
          stats.discrepancy++;
          break;
      }
    });

    this._inventoryStatsCache.set(taskId, stats);
    return { ...stats };
  }

  getInventoryDiscrepancyItems(taskId) {
    const items = this.getInventoryItemsByTaskId(taskId);
    return items.filter(
      (item) =>
        item.actualStatus === '缺失' ||
        item.actualStatus === '多余' ||
        (item.expectedCount !== undefined && item.found !== undefined && item.found !== item.expectedCount) ||
        item.actualStatus === '位置不符' ||
        item.actualStatus === '状态不符'
    );
  }

  _rebuildSummaryCache() {
    const todayStr = this._getTodayStr();
    const s = {
      dirty: false,
      todayStr,
      overdueCount: 0,
      borrowedCount: 0,
      cleanWaitCount: 0,
      activeReservationCount: 0,
      pendingWorkOrderCount: 0,
      inProgressWorkOrderCount: 0,
      completedWorkOrderCount: 0,
      overdueWorkOrderCount: 0,
      scheduleCount: 0
    };
    for (const c of this._indexes.costumes.allActive) {
      if (c.status === '借出') {
        s.borrowedCount++;
        if (c.due && c.due < todayStr) s.overdueCount++;
      }
      if (c.clean === '待清洗') s.cleanWaitCount++;
    }
    for (const r of this._indexes.reservations.byId.values()) {
      if (r.status === 'active' && !r.deletedAt) s.activeReservationCount++;
    }
    for (const wo of this._indexes.workOrders.byId.values()) {
      if (WORK_ORDER_PENDING_SET.has(wo.status)) s.pendingWorkOrderCount++;
      else if (WORK_ORDER_IN_PROGRESS_SET.has(wo.status)) s.inProgressWorkOrderCount++;
      else if (wo.status === '已完成') s.completedWorkOrderCount++;
      if (WORK_ORDER_ACTIVE_STATUSES_SET.has(wo.status) && wo.dueDate && wo.dueDate < todayStr) s.overdueWorkOrderCount++;
    }
    s.scheduleCount = this._indexes.schedules.byId.size;
    this._summaryCache = s;
  }

  getSummaryStats() {
    if (this._summaryCache.dirty || this._summaryCache.todayStr !== this._getTodayStr()) {
      this._rebuildSummaryCache();
    }
    return { ...this._summaryCache };
  }

  getOverdueCount() {
    return this.getSummaryStats().overdueCount;
  }
  getBorrowedCount() {
    return this.getSummaryStats().borrowedCount;
  }
  getCleanWaitCount() {
    return this.getSummaryStats().cleanWaitCount;
  }
  getActiveReservationCount() {
    return this.getSummaryStats().activeReservationCount;
  }
  getPendingWorkOrderCount() {
    return this.getSummaryStats().pendingWorkOrderCount;
  }
  getInProgressWorkOrderCount() {
    return this.getSummaryStats().inProgressWorkOrderCount;
  }
  getCompletedWorkOrderCount() {
    return this.getSummaryStats().completedWorkOrderCount;
  }
  getOverdueWorkOrderCount() {
    return this.getSummaryStats().overdueWorkOrderCount;
  }
  getScheduleCount() {
    return this.getSummaryStats().scheduleCount;
  }

  filterActors(options = {}) {
    const { query = '', play } = options;

    const cacheKey = this._cacheKey({ query, play });
    const cached = this._filterCache.actors.get(cacheKey);
    if (cached) {
      this._stats.cacheHits++;
      return cached;
    }
    this._stats.cacheMisses++;

    let candidates;
    let smallestSize = Infinity;

    if (play) {
      const s = this._indexes.actors.byPlay.get(play) || [];
      if (s.length < smallestSize) {
        smallestSize = s.length;
        candidates = s;
      }
    }

    if (query && query.trim()) {
      const tokens = this._tokenize(query);
      let s;
      if (tokens.length > 0) {
        const scoreMap = new Map();
        for (const t of tokens) {
          const matches = this._searchIndex.actors.get(t);
          if (!matches) continue;
          for (const r of matches) {
            scoreMap.set(r.id, (scoreMap.get(r.id) || 0) + 1);
          }
        }
        s = [...scoreMap.entries()]
          .sort((a, b) => b[1] - a[1])
          .map(([id]) => this._indexes.actors.byId.get(id))
          .filter(Boolean);
      } else {
        s = [...this._indexes.actors.byId.values()];
      }
      if (s.length < smallestSize) {
        smallestSize = s.length;
        candidates = s;
      }
    }

    if (!candidates) {
      candidates = [...this._indexes.actors.byId.values()];
    }

    const result = candidates.filter((a) => {
      if (play) {
        const plays = Array.isArray(a.plays) ? a.plays : [a.play];
        if (!plays.includes(play)) return false;
      }
      if (query && query.trim()) {
        const q = query.toLowerCase();
        const haystack = [a.name, a.contact, a.note, a.role].join(' ').toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });

    this._filterCache.actors.set(cacheKey, result);
    return result;
  }

  checkScheduleConflict(costumeId, dateStr, excludeId = null) {
    return this.checkConflict(costumeId, dateStr, excludeId);
  }

  getPackingListSummary(packingListId) {
    const pl = this.getPackingListById(packingListId);
    if (!pl || !Array.isArray(pl.items)) {
      return {
        total: 0,
        inStock: 0,
        borrowed: 0,
        reserved: 0,
        workOrder: 0
      };
    }
    const summary = {
      total: pl.items.length,
      inStock: 0,
      borrowed: 0,
      reserved: 0,
      workOrder: 0
    };
    for (const item of pl.items) {
      const c = this.getCostumeById(item.costumeId);
      if (!c) continue;
      if (c.status === '借出') {
        summary.borrowed++;
      } else {
        summary.inStock++;
      }
      if (this.hasActiveWorkOrder(c.id)) {
        summary.workOrder++;
      }
      const reservations = this.getUpcomingReservations(c.id);
      if (reservations.length > 0) {
        summary.reserved++;
      }
    }
    return summary;
  }

  filterCostumesForPackingList({ play, status, excludePackingListId, query }) {
    const excludedIds = new Set();
    if (excludePackingListId) {
      const excludePl = this.getPackingListById(excludePackingListId);
      if (excludePl && Array.isArray(excludePl.items)) {
        for (const item of excludePl.items) {
          if (item.costumeId) excludedIds.add(item.costumeId);
        }
      }
    }

    const options = { play, status, query };
    const filtered = this.filterCostumes(options);
    return filtered.filter((c) => !excludedIds.has(c.id));
  }

  getActorsByPlay(play) {
    if (!play) return [];
    return this._indexes.actors.byPlay.get(play) || [];
  }

  getActorsByName(name) {
    if (!name) return [];
    const key = name.trim().toLowerCase();
    const byName = this._indexes.actors.byName;
    if (byName.has(name.trim())) {
      return byName.get(name.trim());
    }
    const all = [...this._indexes.actors.byId.values()];
    return all.filter((a) => {
      const n = (a.name || '').trim().toLowerCase();
      return n.includes(key) || key.includes(n);
    });
  }

  findActorByName(name) {
    if (!name) return null;
    const trimmed = name.trim();
    const byName = this._indexes.actors.byName;
    if (byName.has(trimmed)) {
      const list = byName.get(trimmed);
      if (list.length > 0) return list[0];
    }
    const key = trimmed.toLowerCase();
    for (const a of this._indexes.actors.byId.values()) {
      if ((a.name || '').trim().toLowerCase() === key) return a;
    }
    return null;
  }

  searchActorsByName(query) {
    return this.filterActors({ query });
  }

  getReservationsByReservedFor(reservedFor) {
    if (!reservedFor) return [];
    return this._indexes.reservations.byReservedFor.get(reservedFor) || [];
  }

  getActorBorrowHistory(actorName) {
    if (!actorName) return [];
    const byOperator = this._indexes.records.byOperator;
    const typed = byOperator.has(actorName) ? byOperator.get(actorName) : [];
    const results = typed.length > 0
      ? typed.filter((r) => r.type === '借出')
      : this.getAllRecords().filter((r) => r.type === '借出' && r.operator === actorName);
    return results.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  }

  getActorReservationHistory(actorName) {
    if (!actorName) return [];
    const byReserved = this.getReservationsByReservedFor(actorName);
    return byReserved.length > 0
      ? byReserved.filter((r) => r.type === '演员')
      : this.getAllReservations().filter((r) => r.type === '演员' && r.reservedFor === actorName);
  }

  getActorCostumeHistory(actorName) {
    if (!actorName) return [];
    const borrowed = this.getActorBorrowHistory(actorName);
    const reserved = this.getActorReservationHistory(actorName);
    const costumeMap = new Map();
    for (const r of borrowed) {
      if (!costumeMap.has(r.costumeName)) {
        costumeMap.set(r.costumeName, { name: r.costumeName, play: r.play, lastUsed: r.timestamp, type: '借出' });
      }
    }
    for (const r of reserved) {
      if (!costumeMap.has(r.costumeName)) {
        costumeMap.set(r.costumeName, { name: r.costumeName, play: r.play, lastUsed: r.date, type: '预约' });
      }
    }
    return [...costumeMap.values()].sort((a, b) => new Date(b.lastUsed) - new Date(a.lastUsed));
  }

  getActiveWorkOrder(costumeId) {
    const list = this.getActiveWorkOrdersByCostumeId(costumeId);
    return list.length > 0 ? list[0] : null;
  }

  hasActiveWorkOrder(costumeId) {
    return this.getActiveWorkOrdersByCostumeId(costumeId).length > 0;
  }

  canLend(costumeId) {
    const costume = this.getCostumeById(costumeId);
    if (!costume) return { can: false, reason: '服装不存在' };
    if (costume.status === '借出') return { can: false, reason: '该服装已借出' };
    if (costume.clean === '待清洗') return { can: false, reason: '该服装待清洗，请先完成清洗' };
    if (costume.clean === '维修中') return { can: false, reason: '该服装维修中，请先完成维修' };
    const activeWO = this.getActiveWorkOrder(costumeId);
    if (activeWO) return { can: false, reason: `该服装${activeWO.type}中，请先完成${activeWO.type}工单` };
    return { can: true, reason: '' };
  }

  getUpcomingReservations(costumeId) {
    if (!costumeId) return [];
    const todayStr = this._getTodayStr();
    const list = this._indexes.reservations.byCostumeId.get(costumeId) || [];
    return list
      .filter((r) => r.status === 'active' && r.date >= todayStr && !r.deletedAt)
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  getLatestReservation(costumeId) {
    const upcoming = this.getUpcomingReservations(costumeId);
    return upcoming.length > 0 ? upcoming[0] : null;
  }

  checkConflict(costumeId, dateStr, excludeId = null) {
    if (!costumeId || !dateStr) return [];
    const costume = this.getCostumeById(costumeId);
    const conflicts = [];
    if (costume && costume.status === '借出') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const targetDate = new Date(dateStr);
      targetDate.setHours(0, 0, 0, 0);
      if (costume.due) {
        const borrowDue = new Date(costume.due);
        borrowDue.setHours(0, 0, 0, 0);
        const isOverdue = borrowDue < today;
        if (isOverdue) {
          conflicts.push({ type: '借出', detail: `逾期未还：${costume.borrower}，应还${costume.due}，归还时间不确定` });
        } else if (targetDate >= today && targetDate <= borrowDue) {
          conflicts.push({ type: '借出', detail: `${costume.borrower}借用至${costume.due}` });
        }
      } else {
        conflicts.push({ type: '借出', detail: `${costume.borrower}借用中，归还时间不确定` });
      }
    }
    const activeWorkOrder = this.getActiveWorkOrder(costumeId);
    if (activeWorkOrder) {
      conflicts.push({ type: activeWorkOrder.type, detail: `${activeWorkOrder.type}中，负责人：${activeWorkOrder.assignee || '未分配'}，预计完成：${activeWorkOrder.dueDate}` });
    }
    const list = this._indexes.reservations.byCostumeId.get(costumeId) || [];
    for (const r of list) {
      if (r.status !== 'active' || r.deletedAt) continue;
      if (excludeId && r.id === excludeId) continue;
      if (r.date === dateStr) {
        conflicts.push({ type: '预约', detail: `${r.type}：${r.reservedFor}（${r.date}）` });
      }
    }
    return conflicts;
  }

  matchSize(costumeSize, actorSize) {
    if (!costumeSize || !actorSize) return null;
    const same = costumeSize === actorSize;
    if (same) return { match: true, level: 'exact', label: '完全匹配' };
    const sizeOrder = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
    const ci = sizeOrder.indexOf(costumeSize);
    const ai = sizeOrder.indexOf(actorSize);
    if (ci === -1 || ai === -1) return { match: false, level: 'unknown', label: '未知' };
    const diff = ci - ai;
    if (Math.abs(diff) <= 1) {
      return { match: diff === 0, level: diff > 0 ? 'loose' : 'tight', label: diff > 0 ? '偏宽松可穿' : '偏紧凑可穿' };
    }
    return { match: false, level: 'mismatch', label: '尺码差距较大' };
  }

  checkPlayMatch(costumePlay, actorPlays) {
    if (!costumePlay) return { match: true, label: '无剧目限制' };
    const plays = Array.isArray(actorPlays) ? actorPlays : (actorPlays ? [actorPlays] : []);
    if (plays.length === 0) return { match: false, label: '演员无剧目记录' };
    const has = plays.some((p) => p === costumePlay);
    return { match: has, label: has ? '参演对应剧目' : '非对应剧目演员' };
  }

  getUniqueCostumePlaysSorted() {
    return [...this.getUniqueCostumePlays()].sort();
  }

  getUniqueSchedulePlaysSorted() {
    return [...this.getUniquePlays()].sort();
  }

  getAllPlays() {
    const set = new Set([...this.getUniqueCostumePlays(), ...this.getUniquePlays()]);
    return [...set].filter(Boolean).sort();
  }

  getWorkOrdersByStatus(status) {
    return this._indexes.workOrders.byStatus.get(status) || [];
  }

  getWorkOrdersByType(type) {
    return this._indexes.workOrders.byType.get(type) || [];
  }

  getReservationsByStatus(status) {
    return this._indexes.reservations.byStatus.get(status) || [];
  }

  getInventoryTasksByStatus(status) {
    return this._indexes.inventoryTasks.byStatus.get(status) || [];
  }

  getInventoryTasksByPlayFilter(playFilter) {
    return this._indexes.inventoryTasks.byPlayFilter.get(playFilter) || [];
  }

  getInventoryTaskStatsCached(taskId) {
    const cached = this._inventoryStatsCache.get(taskId);
    if (cached) return { ...cached };
    const stats = this.computeInventoryTaskStats(taskId);
    this._inventoryStatsCache.set(taskId, stats);
    return { ...stats };
  }

  invalidateInventoryTaskStats(taskId) {
    if (taskId) {
      this._inventoryStatsCache.delete(taskId);
    } else {
      this._inventoryStatsCache.clear();
    }
  }

  buildQuickMergeIndex(dbOrTables) {
    const tables = dbOrTables.tables || dbOrTables;
    const result = {};
    for (const tableName of Object.keys(tables)) {
      const records = tables[tableName] || [];
      const byId = new Map();
      for (const r of records) {
        if (r && r.id) byId.set(r.id, r);
      }
      result[tableName] = { byId, records };
    }
    return result;
  }

  getCostumesAvailableForWorkOrder() {
    const result = [];
    for (const c of this._indexes.costumes.allActive) {
      if (c.status === '在库' && !this.hasActiveWorkOrder(c.id)) {
        result.push(c);
      }
    }
    return result;
  }

  getPackingSummary(packingList) {
    if (!packingList || !Array.isArray(packingList.items)) return null;
    const s = { total: 0, packed: 0, missing: 0, clean: 0, returned: 0, pending: 0 };
    for (const item of packingList.items) {
      s.total++;
      switch (item.status) {
        case '已打包': s.packed++; break;
        case '缺失': s.missing++; break;
        case '需清洗': s.clean++; break;
        case '已归还': s.returned++; break;
        default: s.pending++;
      }
    }
    return s;
  }


  _parseSizeForSuggestion(sizeStr) {
    if (!sizeStr) return null;
    const s = sizeStr.trim().toUpperCase();
    const sizeOrder = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'];
    const idx = sizeOrder.indexOf(s);
    if (idx >= 0) return { type: 'letter', value: idx, raw: s };
    const numMatch = s.match(/(\d+)/);
    if (numMatch) {
      const num = parseInt(numMatch[1]);
      if (num >= 150 && num <= 200) return { type: 'number', value: Math.round((num - 150) / 10), raw: s };
      if (num >= 34 && num <= 52) return { type: 'number', value: Math.round((num - 34) / 3), raw: s };
    }
    return null;
  }

  _matchSizeLevelForSuggestion(sizeA, sizeB) {
    const a = this._parseSizeForSuggestion(sizeA);
    const b = this._parseSizeForSuggestion(sizeB);
    if (!a || !b) return { level: 'unknown', score: 0, diff: 0 };
    const diff = a.value - b.value;
    if (diff === 0) return { level: 'perfect', score: 100, diff: 0 };
    if (Math.abs(diff) === 1) return { level: 'close', score: 70, diff };
    if (Math.abs(diff) === 2) return { level: 'fair', score: 40, diff };
    return { level: 'mismatch', score: 0, diff };
  }

  _getCostumeBorrowFrequency(costumeId, days = 90) {
    const records = this.getRecordsForCostume(costumeId);
    const now = new Date();
    const threshold = new Date(now);
    threshold.setDate(threshold.getDate() - days);
    const thresholdStr = threshold.toISOString();
    let borrowCount = 0;
    let lastBorrowAt = null;
    for (const r of records) {
      if (r.type === '借出' || r.type === '预约') {
        if (r.timestamp >= thresholdStr) borrowCount++;
        if (!lastBorrowAt || r.timestamp > lastBorrowAt) lastBorrowAt = r.timestamp;
      }
    }
    return { borrowCount, lastBorrowAt };
  }

  _isCostumeAvailableForDate(costumeId, dateStr, excludeScheduleId = null) {
    const todayStr = this._getTodayStr();
    const costume = this.getCostumeById(costumeId);
    if (!costume) return { available: false, reasons: ['服装不存在'] };
    const reasons = [];
    if (costume.status === '借出') {
      const isOverdue = costume.due && costume.due < todayStr;
      if (isOverdue) {
        reasons.push(`逾期未还：${costume.borrower}，应还${costume.due}`);
      } else if (costume.due && costume.due < dateStr) {
        reasons.push(`借出中：${costume.borrower}，至${costume.due}，演出前可能未归还`);
      }
    }
    const activeWO = this.getActiveWorkOrdersByCostumeId(costumeId);
    if (activeWO.length > 0) {
      const wo = activeWO[0];
      const isWOOverdue = wo.dueDate && wo.dueDate < todayStr;
      if (isWOOverdue) {
        reasons.push(`${wo.type}工单逾期，负责人：${wo.assignee}`);
      } else if (wo.dueDate && wo.dueDate > dateStr) {
        reasons.push(`${wo.type}中，预计${wo.dueDate}完成，晚于演出日`);
      } else {
        reasons.push(`${wo.type}中：${wo.status}，负责人${wo.assignee}`);
      }
    }
    if (costume.clean === '待清洗' && activeWO.length === 0) {
      reasons.push('档案状态：待清洗');
    }
    if (costume.clean === '维修中' && activeWO.length === 0) {
      reasons.push('档案状态：维修中');
    }
    const costumeSchedules = this.getSchedulesForCostume(costumeId);
    for (const s of costumeSchedules) {
      if (s.id === excludeScheduleId) continue;
      if (s.date === dateStr) {
        reasons.push(`同日被排期「${s.play} ${s.time || ''}」占用`);
      }
    }
    const dayReservations = this.getActiveReservationsByPlayAndDate(costume.play, dateStr);
    for (const r of dayReservations) {
      if (r.costumeId === costumeId) {
        reasons.push(`同日被${r.type}「${r.reservedFor}」预约占用`);
      }
    }
    return {
      available: reasons.length === 0,
      reasons,
      status: costume.status,
      clean: costume.clean,
      location: costume.location,
      hasActiveWO: activeWO.length > 0,
      activeWODetail: activeWO[0] || null,
      borrower: costume.borrower,
      dueDate: costume.due
    };
  }

  _getCostumeAvailabilityScore(availability) {
    if (availability.available) return 100;
    let score = 100;
    const now = new Date();
    const todayStr = this._getTodayStr();
    for (const reason of availability.reasons) {
      if (reason.includes('逾期未还')) score -= 80;
      else if (reason.includes('工单逾期')) score -= 75;
      else if (reason.includes('晚于演出日')) score -= 70;
      else if (reason.includes('维修')) score -= 60;
      else if (reason.includes('演出前可能未归还')) score -= 50;
      else if (reason.includes('同日被排期')) score -= 55;
      else if (reason.includes('同日被') && reason.includes('预约')) score -= 55;
      else if (reason.includes('工单')) score -= 25;
      else if (reason.includes('借出中')) score -= 20;
      else if (reason.includes('待清洗')) score -= 15;
    }
    return Math.max(0, score);
  }

  _computeCostumeOverallScore(costume, originalCostume, schedule, actorContext = null) {
    const availability = this._isCostumeAvailableForDate(costume.id, schedule.date, schedule.id);
    const availabilityScore = this._getCostumeAvailabilityScore(availability);
    if (availabilityScore <= 0) return null;
    let playMatchScore = 0;
    if (costume.play === originalCostume.play) playMatchScore = 100;
    else if (costume.play && originalCostume.play && costume.play.split(/[、,，]/)[0] === originalCostume.play.split(/[、,，]/)[0]) playMatchScore = 50;
    else playMatchScore = 10;
    const sizeMatch = this._matchSizeLevelForSuggestion(costume.size, originalCostume.size);
    let sizeScore = sizeMatch.score;
    if (actorContext?.actorSize) {
      const actorSizeMatch = this._matchSizeLevelForSuggestion(costume.size, actorContext.actorSize);
      sizeScore = Math.max(sizeScore, actorSizeMatch.score) * 0.5 + sizeScore * 0.5;
    }
    const { borrowCount, lastBorrowAt } = this._getCostumeBorrowFrequency(costume.id);
    let historyScore = 100;
    if (borrowCount > 20) historyScore = 40;
    else if (borrowCount > 15) historyScore = 55;
    else if (borrowCount > 10) historyScore = 70;
    else if (borrowCount > 5) historyScore = 85;
    if (lastBorrowAt) {
      const lastDate = new Date(lastBorrowAt);
      const daysSince = Math.floor((Date.now() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
      if (daysSince < 7) historyScore = Math.min(historyScore, 50);
      else if (daysSince < 14) historyScore = Math.min(historyScore, 70);
    }
    const isSameId = costume.id === originalCostume.id;
    const idPenalty = isSameId ? 0 : -5;
    const overallScore = Math.round(
      availabilityScore * 0.45 +
      playMatchScore * 0.25 +
      sizeScore * 0.20 +
      historyScore * 0.10 +
      idPenalty
    );
    return {
      costume,
      availability,
      availabilityScore,
      playMatchScore,
      sizeMatch,
      sizeScore,
      historyScore,
      borrowCount,
      lastBorrowAt,
      overallScore
    };
  }

  _findAlternativeCostumes(originalCostume, schedule, limit = 5) {
    if (!originalCostume) return [];
    const candidates = [];
    const samePlayCostumes = this.getCostumesByPlay(originalCostume.play);
    for (const c of samePlayCostumes) {
      if (c.id === originalCostume.id) continue;
      const scored = this._computeCostumeOverallScore(c, originalCostume, schedule);
      if (scored && scored.overallScore > 30) candidates.push(scored);
    }
    const allPlayCostumes = this.getActiveCostumes();
    for (const c of allPlayCostumes) {
      if (c.play === originalCostume.play) continue;
      const scored = this._computeCostumeOverallScore(c, originalCostume, schedule);
      if (scored && scored.overallScore > 50) candidates.push(scored);
    }
    candidates.sort((a, b) => b.overallScore - a.overallScore);
    return candidates.slice(0, limit);
  }

  _generateActionSuggestion(riskType, costume, schedule) {
    const actions = [];
    const now = new Date();
    const todayStr = this._getTodayStr();
    const scheduleDate = new Date(schedule.date);
    const daysUntil = Math.ceil((scheduleDate - now) / (1000 * 60 * 60 * 24));
    switch (riskType) {
      case 'overdue':
        actions.push({
          type: 'urge_return',
          label: `催促归还：${costume.borrower || '借用人'}`,
          priority: daysUntil <= 3 ? 'urgent' : 'high',
          detail: `服装已逾期未还，应于${costume.due}归还。建议立即联系${costume.borrower || '借用人'}催还。`
        });
        break;
      case 'borrowed':
        if (costume.due && costume.due < schedule.date) {
          actions.push({
            type: 'coordinate_return',
            label: '协调提前归还',
            priority: daysUntil <= 7 ? 'high' : 'medium',
            detail: `预计归还日${costume.due}早于演出日，建议与${costume.borrower || '借用人'}确认可按时归还。`
          });
        }
        break;
      case 'repair':
        actions.push({
          type: 'escalate_workorder',
          label: '加急维修工单',
          priority: daysUntil <= 5 ? 'urgent' : 'high',
          detail: '维修状态影响演出，建议联系维修负责人加急处理，或启用备用服装。'
        });
        break;
      case 'cleaning':
        actions.push({
          type: 'expedite_cleaning',
          label: '优先安排清洗',
          priority: daysUntil <= 3 ? 'urgent' : (daysUntil <= 7 ? 'high' : 'medium'),
          detail: '服装待清洗，建议提前安排清洗工单，确保演出前完成。'
        });
        break;
      case 'workorder_overdue':
        actions.push({
          type: 'escalate_workorder',
          label: '跟进逾期工单',
          priority: 'urgent',
          detail: '工单已逾期，建议立即联系工单负责人确认状态并评估影响。'
        });
        break;
      case 'workorder_late':
        actions.push({
          type: 'escalate_workorder',
          label: '协调工单进度',
          priority: daysUntil <= 3 ? 'urgent' : 'high',
          detail: '工单预计完成晚于演出日，建议：1)联系负责人加急；2)同时准备备用服装。'
        });
        break;
      case 'reservation_conflict':
        actions.push({
          type: 'negotiate_reservation',
          label: '协商预约调整',
          priority: daysUntil <= 5 ? 'high' : 'medium',
          detail: '存在预约冲突，建议联系相关方协商调整预约时间或服装。'
        });
        break;
      case 'packing_incomplete':
        actions.push({
          type: 'complete_packing',
          label: '完成装箱核验',
          priority: daysUntil <= 2 ? 'urgent' : (daysUntil <= 5 ? 'high' : 'medium'),
          detail: '装箱单未完成，建议尽快逐项核验服装状态并标记完成。'
        });
        break;
    }
    return actions;
  }

  _computeSuggestionsForSchedule(scheduleId) {
    const schedule = this.getScheduleById(scheduleId);
    if (!schedule) return null;
    const riskResult = this._riskCache.byScheduleId.get(scheduleId) || this.computeRisksForSchedule(scheduleId);
    const highRiskCostumes = new Map();
    const otherRisks = [];
    for (const risk of riskResult.risks) {
      if (risk.costumeId && risk.level === 'high') {
        if (!highRiskCostumes.has(risk.costumeId)) {
          highRiskCostumes.set(risk.costumeId, {
            costume: this.getCostumeById(risk.costumeId),
            risks: [],
            riskTypes: new Set()
          });
        }
        const entry = highRiskCostumes.get(risk.costumeId);
        entry.risks.push(risk);
        entry.riskTypes.add(risk.type);
      } else if (risk.level === 'high' || risk.level === 'medium') {
        otherRisks.push(risk);
      }
    }
    const suggestions = [];
    for (const [costumeId, entry] of highRiskCostumes) {
      if (!entry.costume) continue;
      const alternatives = this._findAlternativeCostumes(entry.costume, schedule, 5);
      const allActions = [];
      for (const riskType of entry.riskTypes) {
        const actions = this._generateActionSuggestion(riskType, entry.costume, schedule);
        allActions.push(...actions);
      }
      if (alternatives.length === 0) {
        allActions.push({
          type: 'manual_check',
          label: '人工核查库存',
          priority: 'high',
          detail: '未找到合适的自动替代服装，建议人工核查库存或启动临时采购。'
        });
      }
      suggestions.push({
        id: `sugg-${scheduleId}-${costumeId}-${Date.now()}`,
        suggestionId: `sugg-${scheduleId}-${costumeId}-${Date.now()}`,
        scheduleId: schedule.id,
        play: schedule.play,
        scheduleDate: schedule.date,
        scheduleTime: schedule.time,
        scheduleVenue: schedule.venue,
        costumeId,
        costumeName: entry.costume.name,
        costumeSize: entry.costume.size,
        costumeLocation: entry.costume.location,
        originalCostume: entry.costume,
        actorName: entry.risks[0]?.actorName || '',
        risks: entry.risks,
        riskTypes: [...entry.riskTypes],
        aggregatedTypes: [...entry.riskTypes].map(t => RISK_TYPE_LABELS[t] || t),
        riskLevel: (() => {
          const max = Math.max(...entry.risks.map(r => r.level === 'high' ? 3 : r.level === 'medium' ? 2 : 1));
          return max === 3 ? 'high' : max === 2 ? 'medium' : 'low';
        })(),
        description: entry.risks[0]?.message || '服装占用风险',
        alternatives: alternatives.map(a => ({
          costumeId: a.costume.id,
          name: a.costume.name,
          size: a.costume.size,
          location: a.costume.location,
          play: a.costume.play,
          role: a.costume.role || '',
          score: a.overallScore,
          availabilityScore: a.availabilityScore,
          playMatchScore: a.playMatchScore,
          sizeScore: a.sizeScore,
          sizeMatchLevel: a.sizeMatch?.label || '',
          borrowFrequency: a.borrowCount,
          lastBorrowAt: a.lastBorrowAt,
          crossPlay: a.costume.play !== originalCostume.play,
          availabilityReasons: a.availability?.reasons || [],
          isRecommended: a === alternatives[0],
          costume: a.costume
        })),
        actions: allActions,
        primaryAction: allActions[0] ? {
          type: allActions[0].type,
          title: allActions[0].label,
          description: allActions[0].detail,
          priority: allActions[0].priority
        } : null,
        recommendedAction: allActions[0] || null,
        handler: '',
        note: '',
        createdAt: new Date().toISOString(),
        status: this._suggestionCache.appliedSuggestions.get(`${scheduleId}|${costumeId}`) || 'pending',
        appliedAt: null,
        appliedBy: null,
        appliedNote: null,
        appliedAlternativeName: null
      });
    }
    for (const risk of otherRisks) {
      if (risk.costumeId && highRiskCostumes.has(risk.costumeId)) continue;
      const actions = this._generateActionSuggestion(risk.type, risk.costumeId ? this.getCostumeById(risk.costumeId) || {} : {}, schedule);
      if (actions.length === 0) continue;
      const sugId = `sugg-${scheduleId}-${risk.riskKey || risk.type}-${Date.now()}`;
      suggestions.push({
        id: sugId,
        suggestionId: sugId,
        scheduleId: schedule.id,
        play: schedule.play,
        scheduleDate: schedule.date,
        scheduleTime: schedule.time,
        scheduleVenue: schedule.venue,
        costumeId: risk.costumeId || null,
        costumeName: risk.costumeName || null,
        originalCostume: risk.costumeId ? this.getCostumeById(risk.costumeId) : null,
        actorName: risk.actorName || '',
        risks: [risk],
        riskTypes: [risk.type],
        aggregatedTypes: [RISK_TYPE_LABELS[risk.type] || risk.type],
        riskLevel: risk.level || 'medium',
        description: risk.message || '服装风险',
        alternatives: [],
        actions,
        primaryAction: actions[0] ? {
          type: actions[0].type,
          title: actions[0].label,
          description: actions[0].detail,
          priority: actions[0].priority
        } : null,
        recommendedAction: actions[0],
        handler: '',
        note: '',
        createdAt: new Date().toISOString(),
        status: risk.costumeId ? (this._suggestionCache.appliedSuggestions.get(`${scheduleId}|${risk.costumeId}`) || 'pending') : 'pending',
        appliedAt: null,
        appliedBy: null,
        appliedNote: null,
        appliedAlternativeName: null
      });
    }
    const packingLists = this.getPackingListsForSchedule(schedule.id);
    for (const pl of packingLists) {
      const incompleteItems = (pl.items || []).filter(i => i.status === '未标记' || i.status === '缺失' || i.status === '需清洗');
      if (incompleteItems.length > 0) {
        const riskLevel = incompleteItems.filter(i => i.status === '缺失').length > 0 ? 'high' :
                         (incompleteItems.filter(i => i.status === '需清洗').length > 0 ? 'medium' : 'low');
        if (riskLevel === 'high' || riskLevel === 'medium') {
          const actions = this._generateActionSuggestion('packing_incomplete', {}, schedule);
          const sugId = `sugg-${scheduleId}-packing-${pl.id}`;
          suggestions.push({
            id: sugId,
            suggestionId: sugId,
            scheduleId: schedule.id,
            play: schedule.play,
            scheduleDate: schedule.date,
            scheduleTime: schedule.time,
            scheduleVenue: schedule.venue,
            costumeId: null,
            costumeName: null,
            originalCostume: null,
            actorName: '',
            risks: [{ type: 'packing_incomplete', level: riskLevel, message: `装箱单「${pl.name}」有${incompleteItems.length}项未完成` }],
            riskTypes: ['packing_incomplete'],
            aggregatedTypes: [RISK_TYPE_LABELS['packing_incomplete'] || '装箱未完成'],
            riskLevel,
            description: `装箱单「${pl.name}」有${incompleteItems.length}项未完成`,
            packingListId: pl.id,
            packingListName: pl.name,
            incompleteItemCount: incompleteItems.length,
            alternatives: [],
            actions,
            primaryAction: actions[0] ? {
              type: actions[0].type,
              title: actions[0].label,
              description: actions[0].detail,
              priority: actions[0].priority
            } : null,
            recommendedAction: actions[0],
            handler: '',
            note: '',
            createdAt: new Date().toISOString(),
            status: 'pending',
            appliedAt: null,
            appliedBy: null,
            appliedNote: null,
            appliedAlternativeName: null
          });
        }
      }
    }
    suggestions.sort((a, b) => {
      const priorityScore = (s) => {
        const riskLevelScore = Math.max(...s.risks.map(r => r.level === 'high' ? 3 : r.level === 'medium' ? 2 : 1));
        const hasAltScore = s.alternatives.length > 0 ? 1 : 0;
        return riskLevelScore * 10 + hasAltScore;
      };
      return priorityScore(b) - priorityScore(a);
    });
    const activeCount = suggestions.filter(s => s.status !== 'applied').length;
    const appliedCount = suggestions.filter(s => s.status === 'applied').length;
    return {
      scheduleId: schedule.id,
      schedule,
      suggestions,
      totalCount: suggestions.length,
      activeCount,
      appliedCount,
      hasHighPriorityAlternatives: suggestions.some(s => s.alternatives.length > 0 && s.status !== 'applied')
    };
  }

  computeAllSuggestions(force = false) {
    if (!force && !this._suggestionCache.dirty && this._suggestionCache.allSuggestions.length > 0) {
      return this._suggestionCache.allSuggestions;
    }
    const startTime = performance.now();
    const upcoming = this.getUpcomingSchedules30Days();
    this.computeAllRisks();
    const allSuggestions = [];
    for (const schedule of upcoming) {
      let result = this._suggestionCache.byScheduleId.get(schedule.id);
      if (!result || force || (this._dirtyScheduleIds && this._dirtyScheduleIds.has(schedule.id))) {
        result = this._computeSuggestionsForSchedule(schedule.id);
        if (result) {
          this._suggestionCache.byScheduleId.set(schedule.id, result);
        }
      }
      if (result) {
        allSuggestions.push(...result.suggestions);
      }
    }
    allSuggestions.sort((a, b) => {
      const levelOrder = { high: 0, medium: 1, low: 2 };
      const aLevel = Math.max(...a.risks.map(r => levelOrder[r.level] ?? 2));
      const bLevel = Math.max(...b.risks.map(r => levelOrder[r.level] ?? 2));
      if (aLevel !== bLevel) return aLevel - bLevel;
      const statusOrder = { pending: 0, confirmed: 1, deferred: 2, applied: 3 };
      const aStatus = statusOrder[a.status] ?? 0;
      const bStatus = statusOrder[b.status] ?? 0;
      if (aStatus !== bStatus) return aStatus - bStatus;
      return (a.scheduleDate || '').localeCompare(b.scheduleDate || '');
    });
    this._suggestionCache.allSuggestions = allSuggestions;
    this._suggestionCache.dirty = false;
    this._suggestionCache.lastBuildTime = performance.now() - startTime;
    this._suggestionCache.computationCount++;
    this._stats.suggestionComputationTime = this._suggestionCache.lastBuildTime;
    this._stats.suggestionCount = allSuggestions.length;
    this._rebuildSuggestionSecondaryIndexes(allSuggestions);
    return allSuggestions;
  }

  _rebuildSuggestionSecondaryIndexes(allSuggestions) {
    this._suggestionCache.byCostumeId.clear();
    this._suggestionCache.byPlay.clear();
    this._suggestionCache.byStatus.clear();
    for (const s of allSuggestions) {
      if (s.costumeId) {
        this._addToMap(this._suggestionCache.byCostumeId, s.costumeId, s);
      }
      const schedule = this.getScheduleById(s.scheduleId);
      if (schedule?.play) {
        this._addToMap(this._suggestionCache.byPlay, schedule.play, s);
      }
      this._addToMap(this._suggestionCache.byStatus, s.status || 'pending', s);
    }
  }

  getSuggestionsByScheduleId(scheduleId) {
    this.computeAllSuggestions();
    const cached = this._suggestionCache.byScheduleId.get(scheduleId);
    return cached || null;
  }

  getSuggestionsByCostumeId(costumeId) {
    this.computeAllSuggestions();
    return this._suggestionCache.byCostumeId.get(costumeId) || [];
  }

  getAllSuggestions() {
    return this.computeAllSuggestions();
  }

  filterSuggestions({ play, status, scheduleId, hasAlternatives, query } = {}) {
    this.computeAllSuggestions();
    let results = this._suggestionCache.allSuggestions;
    if (scheduleId) {
      results = results.filter(s => s.scheduleId === scheduleId);
    }
    if (play && play !== '全部剧目') {
      const sched = this.getScheduleById;
      results = results.filter(s => {
        const sch = this.getScheduleById(s.scheduleId);
        return sch?.play === play;
      });
    }
    if (status && status !== '全部状态') {
      results = results.filter(s => s.status === status);
    }
    if (hasAlternatives !== undefined && hasAlternatives !== null) {
      results = results.filter(s => s.alternatives.length > 0 === hasAlternatives);
    }
    if (query && query.trim()) {
      const q = query.trim().toLowerCase();
      results = results.filter(s => {
        const sch = this.getScheduleById(s.scheduleId);
        const text = `${s.costumeName || ''} ${sch?.play || ''} ${sch?.date || ''} ${sch?.venue || ''} ${s.risks.map(r => r.message || '').join(' ')}`;
        return text.toLowerCase().includes(q);
      });
    }
    return results;
  }

  applyScheduleSuggestion(suggestionId, {
    applyAlternative = null,
    applyAction = null,
    handler = '',
    note = '',
    updatePackingList = true
  } = {}) {
    const allSuggs = this.computeAllSuggestions();
    const suggestion = allSuggs.find(s => s.id === suggestionId || s.suggestionId === suggestionId);
    if (!suggestion) return { ok: false, error: '建议不存在' };
    const schedule = this.getScheduleById(suggestion.scheduleId);
    if (!schedule) return { ok: false, error: '排期不存在' };
    const result = { ok: true, updates: [], warnings: [], scheduleUpdates: null, packingUpdates: [] };
    let appliedAltName = null;
    if (applyAlternative) {
      const alt = suggestion.alternatives.find(a => a.costumeId === applyAlternative || (a.costume && a.costume.id === applyAlternative));
      if (!alt) return { ok: false, error: '替代服装不存在' };
      const oldCostumeId = suggestion.costumeId;
      const newCostumeId = alt.costumeId || (alt.costume && alt.costume.id);
      appliedAltName = alt.name || (alt.costume && alt.costume.name);
      if (oldCostumeId && newCostumeId && schedule.linkedCostumeIds?.includes(oldCostumeId)) {
        const newLinked = [...schedule.linkedCostumeIds];
        const idx = newLinked.indexOf(oldCostumeId);
        if (idx !== -1) {
          newLinked[idx] = newCostumeId;
        } else {
          newLinked.push(newCostumeId);
        }
        result.scheduleUpdates = {
          id: schedule.id,
          linkedCostumeIds: newLinked,
          _patch: { linkedCostumeIds: newLinked }
        };
        result.updates.push({
          type: 'schedule_link',
          scheduleId: schedule.id,
          oldCostumeId,
          newCostumeId,
          from: suggestion.costumeName,
          to: appliedAltName || newCostumeId
        });
      }
      if (updatePackingList) {
        const packingLists = this.getPackingListsForSchedule(schedule.id);
        for (const pl of packingLists) {
          const items = pl.items || [];
          const targetItem = items.find(i => i.costumeId === oldCostumeId);
          if (targetItem) {
            const newItem = {
              ...targetItem,
              costumeId: newCostumeId,
              costumeName: appliedAltName || newCostumeId,
              size: alt.size || (alt.costume && alt.costume.size) || targetItem.size,
              location: alt.location || (alt.costume && alt.costume.location) || targetItem.location,
              note: `由调配建议替换：原「${suggestion.costumeName}」→「${appliedAltName || newCostumeId}」${targetItem.note ? ' | ' + targetItem.note : ''}`,
              source: '调配建议替换',
              replacedFrom: suggestion.costumeName
            };
            const plItems = items.map(i => i.costumeId === oldCostumeId ? newItem : i);
            result.packingUpdates.push({
              id: pl.id,
              items: plItems
            });
            result.updates.push({
              type: 'packing_item',
              packingListId: pl.id,
              packingListName: pl.name,
              oldCostumeId,
              newCostumeId,
              from: suggestion.costumeName,
              to: appliedAltName || newCostumeId
            });
          }
        }
      }
    }
    suggestion.status = 'applied';
    suggestion.appliedAt = new Date().toISOString();
    suggestion.appliedBy = handler || '系统';
    suggestion.note = note || suggestion.note || '';
    suggestion.handler = handler || suggestion.handler || '';
    suggestion.appliedNote = note || (applyAction?.label || '') + (applyAlternative ? `；替换为「${appliedAltName || applyAlternative}」` : '');
    suggestion.appliedAlternativeName = appliedAltName || null;
    if (suggestion.costumeId) {
      this._suggestionCache.appliedSuggestions.set(`${schedule.id}|${suggestion.costumeId}`, 'applied');
    }
    this._suggestionCache.dirty = true;
    this.invalidateRisks();
    this.invalidateSuggestions([schedule.id]);
    return {
      ok: true,
      ...result,
      suggestion,
      schedule
    };
  }

  confirmSuggestionOnly(suggestionId, { handler = '', note = '' } = {}) {
    const allSuggs = this.computeAllSuggestions();
    const suggestion = allSuggs.find(s => s.id === suggestionId || s.suggestionId === suggestionId);
    if (!suggestion) return { ok: false, error: '建议不存在' };
    suggestion.status = 'confirmed';
    suggestion.appliedAt = new Date().toISOString();
    suggestion.appliedBy = handler || '系统';
    suggestion.appliedNote = note || '已确认建议并人工处理';
    suggestion.handler = handler || suggestion.handler || '';
    suggestion.note = note || suggestion.note || '';
    this._suggestionCache.dirty = true;
    this.invalidateSuggestions([suggestion.scheduleId]);
    return { ok: true, suggestion };
  }

  deferSuggestion(suggestionId, { handler = '', note = '' } = {}) {
    const allSuggs = this.computeAllSuggestions();
    const suggestion = allSuggs.find(s => s.id === suggestionId || s.suggestionId === suggestionId);
    if (!suggestion) return { ok: false, error: '建议不存在' };
    suggestion.status = 'deferred';
    suggestion.appliedAt = new Date().toISOString();
    suggestion.appliedBy = handler || '系统';
    suggestion.appliedNote = note || '暂缓处理';
    suggestion.handler = handler || suggestion.handler || '';
    suggestion.note = note || suggestion.note || '';
    this._suggestionCache.dirty = true;
    this.invalidateSuggestions([suggestion.scheduleId]);
    return { ok: true, suggestion };
  }

  getSuggestionStats() {
    const all = this.computeAllSuggestions();
    const stats = {
      total: all.length,
      pending: 0,
      confirmed: 0,
      deferred: 0,
      applied: 0,
      withAlternatives: 0,
      highRisk: 0,
      mediumRisk: 0,
      byPlay: {},
      urgentCount: 0
    };
    for (const s of all) {
      const key = s.status === 'confirmed' ? 'confirmed' : s.status === 'deferred' ? 'deferred' : s.status === 'applied' ? 'applied' : 'pending';
      stats[key] = (stats[key] || 0) + 1;
      if (s.alternatives && s.alternatives.length > 0) stats.withAlternatives++;
      const lvl = s.riskLevel || (s.risks && s.risks.length > 0
        ? (Math.max(...s.risks.map(r => r.level === 'high' ? 3 : r.level === 'medium' ? 2 : 1)) === 3 ? 'high' : Math.max(...s.risks.map(r => r.level === 'high' ? 3 : r.level === 'medium' ? 2 : 1)) === 2 ? 'medium' : 'low')
        : 'low');
      if (lvl === 'high') stats.highRisk++;
      else if (lvl === 'medium') stats.mediumRisk++;
      if (s.actions && s.actions.some(a => a.priority === 'urgent')) stats.urgentCount++;
      if (s.play) {
        if (!stats.byPlay[s.play]) stats.byPlay[s.play] = 0;
        stats.byPlay[s.play]++;
      } else {
        const sch = this.getScheduleById(s.scheduleId);
        if (sch?.play) {
          if (!stats.byPlay[sch.play]) stats.byPlay[sch.play] = 0;
          stats.byPlay[sch.play]++;
        }
      }
    }
    return stats;
  }

  computeDailyRisk(dateStr) {
    this.computeAllRisks();
    const risks = this.getRisksByDate(dateStr);
    return {
      date: dateStr,
      risks,
      activeRisks: risks.filter((r) => r.processingStatus !== RISK_STATUS.RESOLVED),
      highCount: risks.filter((r) => r.level === 'high' && r.processingStatus !== RISK_STATUS.RESOLVED).length,
      mediumCount: risks.filter((r) => r.level === 'medium' && r.processingStatus !== RISK_STATUS.RESOLVED).length,
      lowCount: risks.filter((r) => r.level === 'low' && r.processingStatus !== RISK_STATUS.RESOLVED).length
    };
  }
}

const globalIndex = new DataIndex();

export default globalIndex;
export { DataIndex, globalIndex };
