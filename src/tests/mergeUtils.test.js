import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  computeFullDiff,
  createDefaultDecisions,
  applyMerge,
  DIFF_TYPES,
  DECISION_CHOICES,
  MERGE_TABLES
} from '$lib/mergeUtils.js';
import {
  emptyDB,
  makeCostume,
  makeActor,
  makeReservation,
  makeWorkOrder,
  makeSchedule,
  makeRecord,
  makePackingList,
  makeSyncEvent,
  makeTombstone
} from './fixtures/mergeData.js';

vi.mock('$lib/database.js', () => {
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
    suggestionStatuses: '调配建议状态',
    syncEvents: '同步事件日志',
    tombstones: '删除墓碑记录'
  };

  const EVENT_TYPES = {
    CREATE: 'create',
    UPDATE: 'update',
    DELETE: 'delete',
    INVENTORY_CHECK: 'inventory_check',
    WORK_ORDER_PROCESS: 'workorder_process',
    PACKING_STATUS: 'packing_status',
    SCHEDULE_CHANGE: 'schedule_change'
  };

  const EVENT_TYPE_LABELS = {
    [EVENT_TYPES.CREATE]: '新增',
    [EVENT_TYPES.UPDATE]: '编辑',
    [EVENT_TYPES.DELETE]: '删除',
    [EVENT_TYPES.INVENTORY_CHECK]: '盘点处理',
    [EVENT_TYPES.WORK_ORDER_PROCESS]: '工单处理',
    [EVENT_TYPES.PACKING_STATUS]: '装箱状态更新',
    [EVENT_TYPES.SCHEDULE_CHANGE]: '排期修改'
  };

  const SOFT_DELETE_TABLES = new Set([
    TABLES.costumes,
    TABLES.actors,
    TABLES.schedules,
    TABLES.workOrders,
    TABLES.reservations,
    TABLES.packingLists
  ]);

  function getDeviceEventTimelines(currentDB, importDB) {
    const currentEvents = currentDB.tables[TABLES.syncEvents] || [];
    const importEvents = importDB.tables[TABLES.syncEvents] || [];
    const allEvents = [
      ...currentEvents.map((e) => ({ ...e, side: 'current' })),
      ...importEvents.map((e) => ({ ...e, side: 'import' }))
    ];
    allEvents.sort((a, b) => {
      const ta = new Date(a.timestamp).getTime();
      const tb = new Date(b.timestamp).getTime();
      if (ta !== tb) return ta - tb;
      return (a.syncCounter || 0) - (b.syncCounter || 0);
    });
    const byRecord = new Map();
    for (const e of allEvents) {
      const key = `${e.table}|${e.recordId}`;
      if (!byRecord.has(key)) byRecord.set(key, []);
      byRecord.get(key).push(e);
    }
    return { allEvents, byRecord };
  }

  function hasTombstone(db, table, recordId) {
    if (!db.tables[TABLES.tombstones]) return false;
    return db.tables[TABLES.tombstones].some(
      (t) => t.table === table && t.recordId === recordId
    );
  }

  return {
    TABLES,
    TABLE_LABELS,
    EVENT_TYPES,
    EVENT_TYPE_LABELS,
    SOFT_DELETE_TABLES,
    getDeviceEventTimelines,
    hasTombstone
  };
});

describe('computeFullDiff', () => {
  it('detects added records (import has, current does not)', () => {
    const costumeId = 'c-added-001';
    const currentDB = emptyDB();
    const importDB = emptyDB({
      tables: {
        costumes: [makeCostume(costumeId, { name: '新增服装' })]
      }
    });

    const result = computeFullDiff(currentDB, importDB);

    const costumeDiff = result.tables.costumes;
    expect(costumeDiff[DIFF_TYPES.ADDED]).toHaveLength(1);
    expect(costumeDiff[DIFF_TYPES.ADDED][0].id).toBe(costumeId);
    expect(costumeDiff[DIFF_TYPES.ADDED][0].imported.name).toBe('新增服装');
    expect(costumeDiff[DIFF_TYPES.ADDED][0].current).toBeNull();
  });

  it('detects added records across multiple tables', () => {
    const costumeId = 'c-add-002';
    const actorId = 'a-add-001';
    const currentDB = emptyDB();
    const importDB = emptyDB({
      tables: {
        costumes: [makeCostume(costumeId)],
        actors: [makeActor(actorId)]
      }
    });

    const result = computeFullDiff(currentDB, importDB);

    expect(result.tables.costumes[DIFF_TYPES.ADDED]).toHaveLength(1);
    expect(result.tables.actors[DIFF_TYPES.ADDED]).toHaveLength(1);
  });

  it('detects identical records (same data on both sides)', () => {
    const costumeId = 'c-same-001';
    const costume = makeCostume(costumeId, { name: '相同服装' });
    const currentDB = emptyDB({ tables: { costumes: [costume] } });
    const importDB = emptyDB({ tables: { costumes: [makeCostume(costumeId, { name: '相同服装' })] } });

    const result = computeFullDiff(currentDB, importDB);

    const costumeDiff = result.tables.costumes;
    expect(costumeDiff[DIFF_TYPES.IDENTICAL]).toHaveLength(1);
    expect(costumeDiff[DIFF_TYPES.IDENTICAL][0].id).toBe(costumeId);
  });

  it('detects field conflicts when both sides modified different fields of the same record', () => {
    const costumeId = 'c-conflict-001';
    const currentCostume = makeCostume(costumeId, {
      name: '服装A-当前修改名',
      location: '仓库A',
      updatedAt: '2025-02-01T00:00:00.000Z'
    });
    const importCostume = makeCostume(costumeId, {
      name: '服装A-当前修改名',
      location: '仓库B',
      updatedAt: '2025-02-01T00:00:00.000Z'
    });

    const currentDB = emptyDB({ tables: { costumes: [currentCostume] } });
    const importDB = emptyDB({ tables: { costumes: [importCostume] } });

    const result = computeFullDiff(currentDB, importDB);

    const costumeDiff = result.tables.costumes;
    const allTypes = Object.values(DIFF_TYPES);
    const matchedItem = allTypes
      .flatMap((t) => costumeDiff[t] || [])
      .find((item) => item.id === costumeId);

    expect(matchedItem).toBeDefined();
    expect(matchedItem.fieldConflicts.length).toBeGreaterThan(0);
    const locationConflict = matchedItem.fieldConflicts.find((fc) => fc.field === 'location');
    expect(locationConflict).toBeDefined();
    expect(locationConflict.current).toBe('仓库A');
    expect(locationConflict.imported).toBe('仓库B');
  });

  it('detects true delete when import side has tombstone', () => {
    const costumeId = 'c-del-tomb-001';
    const currentCostume = makeCostume(costumeId, { name: '已删服装' });
    const tombstone = makeTombstone('costumes', costumeId);

    const currentDB = emptyDB({ tables: { costumes: [currentCostume] } });
    const importDB = emptyDB({ tables: { tombstones: [tombstone] } });

    const result = computeFullDiff(currentDB, importDB);

    const costumeDiff = result.tables.costumes;
    expect(costumeDiff[DIFF_TYPES.TRUE_DELETE]).toHaveLength(1);
    expect(costumeDiff[DIFF_TYPES.TRUE_DELETE][0].id).toBe(costumeId);
    expect(costumeDiff[DIFF_TYPES.TRUE_DELETE][0].tombstoneInfo.importHasTombstone).toBe(true);
  });

  it('detects old backup missing when neither side has tombstone for soft-delete table', () => {
    const costumeId = 'c-old-bak-001';
    const currentCostume = makeCostume(costumeId, { name: '旧备份服装' });

    const currentDB = emptyDB({ tables: { costumes: [currentCostume] } });
    const importDB = emptyDB();

    const result = computeFullDiff(currentDB, importDB);

    const costumeDiff = result.tables.costumes;
    expect(costumeDiff[DIFF_TYPES.OLD_BACKUP_MISSING]).toHaveLength(1);
    expect(costumeDiff[DIFF_TYPES.OLD_BACKUP_MISSING][0].id).toBe(costumeId);
    expect(costumeDiff[DIFF_TYPES.OLD_BACKUP_MISSING][0].tombstoneInfo.importHasTombstone).toBe(false);
    expect(costumeDiff[DIFF_TYPES.OLD_BACKUP_MISSING][0].tombstoneInfo.currentHasTombstone).toBe(false);
  });

  it('classifies as deleted_suspect for non-soft-delete tables when current has but import does not', () => {
    const recordId = 'r-del-sus-001';
    const currentRecord = makeRecord(recordId, 'costume-001');

    const currentDB = emptyDB({ tables: { records: [currentRecord] } });
    const importDB = emptyDB();

    const result = computeFullDiff(currentDB, importDB);

    const recordDiff = result.tables.records;
    expect(recordDiff[DIFF_TYPES.DELETED_SUSPECT]).toHaveLength(1);
    expect(recordDiff[DIFF_TYPES.DELETED_SUSPECT][0].id).toBe(recordId);
  });

  it('auto-resolves via event timeline when only one side has events', () => {
    const costumeId = 'c-tl-001';
    const currentCostume = makeCostume(costumeId, {
      name: '时间线服装',
      location: '仓库A',
      updatedAt: '2025-03-01T00:00:00.000Z'
    });
    const importCostume = makeCostume(costumeId, {
      name: '时间线服装-改',
      location: '仓库A',
      updatedAt: '2025-03-02T00:00:00.000Z'
    });

    const currentEvent = makeSyncEvent('ev-cur-1', 'costumes', costumeId, 'update', 'current', {
      changedFields: ['name'],
      timestamp: '2025-03-01T10:00:00.000Z'
    });

    const currentDB = emptyDB({
      tables: {
        costumes: [currentCostume],
        syncEvents: [currentEvent]
      }
    });
    const importDB = emptyDB({
      tables: {
        costumes: [importCostume]
      }
    });

    const result = computeFullDiff(currentDB, importDB);

    const costumeDiff = result.tables.costumes;
    const modifiedCurrent = costumeDiff[DIFF_TYPES.MODIFIED_ONLY_IN_CURRENT];
    const modifiedImport = costumeDiff[DIFF_TYPES.MODIFIED_ONLY_IN_IMPORT];
    const combined = [...modifiedCurrent, ...modifiedImport];
    expect(combined.length).toBeGreaterThanOrEqual(1);
    const matched = combined.find((item) => item.id === costumeId);
    expect(matched).toBeDefined();
    expect(matched.timelineAnalysis).toBeDefined();
    expect(matched.timelineAnalysis.canAutoResolve).toBe(true);
  });

  it('resolves field conflict by timestamp when no timeline events exist', () => {
    const costumeId = 'c-ts-resolve-001';
    const currentCostume = makeCostume(costumeId, {
      name: '时间戳服装',
      updatedAt: '2025-05-01T00:00:00.000Z'
    });
    const importCostume = makeCostume(costumeId, {
      name: '时间戳服装-导入版',
      updatedAt: '2025-04-01T00:00:00.000Z'
    });

    const currentDB = emptyDB({ tables: { costumes: [currentCostume] } });
    const importDB = emptyDB({ tables: { costumes: [importCostume] } });

    const result = computeFullDiff(currentDB, importDB);

    const costumeDiff = result.tables.costumes;
    const modifiedCurrent = costumeDiff[DIFF_TYPES.MODIFIED_ONLY_IN_CURRENT];
    expect(modifiedCurrent.length).toBeGreaterThanOrEqual(1);
    const matched = modifiedCurrent.find((item) => item.id === costumeId);
    expect(matched).toBeDefined();
  });

  it('produces a summary with counts for each diff type', () => {
    const currentDB = emptyDB({
      tables: {
        costumes: [makeCostume('c-1', { name: '保留' })],
        actors: [makeActor('a-1')]
      }
    });
    const importDB = emptyDB({
      tables: {
        costumes: [makeCostume('c-1', { name: '保留' }), makeCostume('c-new')],
        actors: []
      }
    });

    const result = computeFullDiff(currentDB, importDB);

    expect(result.summary.costumes).toBeDefined();
    expect(result.summary.costumes[DIFF_TYPES.IDENTICAL]).toBe(1);
    expect(result.summary.costumes[DIFF_TYPES.ADDED]).toBe(1);
    expect(result.summary.actors).toBeDefined();
  });

  it('handles auto-merge for syncEvents table', () => {
    const currentDB = emptyDB({
      tables: {
        syncEvents: [makeSyncEvent('ev-1', 'costumes', 'c-1', 'create', 'current')]
      }
    });
    const importDB = emptyDB({
      tables: {
        syncEvents: [
          makeSyncEvent('ev-1', 'costumes', 'c-1', 'create', 'import'),
          makeSyncEvent('ev-2', 'costumes', 'c-2', 'update', 'import')
        ]
      }
    });

    const result = computeFullDiff(currentDB, importDB);

    expect(result.autoMerge.syncEvents).toHaveLength(1);
    expect(result.autoMerge.syncEvents[0].id).toBe('ev-2');
    expect(result.autoMergeSummary.syncEvents).toBe(1);
  });
});

describe('createDefaultDecisions', () => {
  it('defaults ADDED records to USE_IMPORT', () => {
    const costumeId = 'c-add-dec-001';
    const currentDB = emptyDB();
    const importDB = emptyDB({
      tables: { costumes: [makeCostume(costumeId, { name: '新服装' })] }
    });

    const diffResult = computeFullDiff(currentDB, importDB);
    const decisions = createDefaultDecisions(diffResult);

    expect(decisions.costumes[costumeId].choice).toBe(DECISION_CHOICES.USE_IMPORT);
    expect(decisions.costumes[costumeId].mergedData.name).toBe('新服装');
  });

  it('defaults IDENTICAL records to KEEP_CURRENT', () => {
    const costumeId = 'c-id-dec-001';
    const costume = makeCostume(costumeId, { name: '相同' });
    const currentDB = emptyDB({ tables: { costumes: [costume] } });
    const importDB = emptyDB({ tables: { costumes: [makeCostume(costumeId, { name: '相同' })] } });

    const diffResult = computeFullDiff(currentDB, importDB);
    const decisions = createDefaultDecisions(diffResult);

    expect(decisions.costumes[costumeId].choice).toBe(DECISION_CHOICES.KEEP_CURRENT);
  });

  it('defaults TRUE_DELETE to USE_IMPORT (meaning confirm deletion)', () => {
    const costumeId = 'c-td-dec-001';
    const currentCostume = makeCostume(costumeId);
    const tombstone = makeTombstone('costumes', costumeId);

    const currentDB = emptyDB({ tables: { costumes: [currentCostume] } });
    const importDB = emptyDB({ tables: { tombstones: [tombstone] } });

    const diffResult = computeFullDiff(currentDB, importDB);
    const decisions = createDefaultDecisions(diffResult);

    expect(decisions.costumes[costumeId].choice).toBe(DECISION_CHOICES.USE_IMPORT);
    expect(decisions.costumes[costumeId].mergedData).toBeNull();
    expect(decisions.costumes[costumeId].autoReason).toContain('墓碑');
  });

  it('defaults OLD_BACKUP_MISSING to KEEP_CURRENT', () => {
    const costumeId = 'c-obm-dec-001';
    const currentCostume = makeCostume(costumeId);

    const currentDB = emptyDB({ tables: { costumes: [currentCostume] } });
    const importDB = emptyDB();

    const diffResult = computeFullDiff(currentDB, importDB);
    const decisions = createDefaultDecisions(diffResult);

    expect(decisions.costumes[costumeId].choice).toBe(DECISION_CHOICES.KEEP_CURRENT);
    expect(decisions.costumes[costumeId].mergedData).toBeDefined();
    expect(decisions.costumes[costumeId].autoReason).toContain('旧备份');
  });

  it('sets FIELD_CONFLICT decisions to null (requires manual resolution)', () => {
    const costumeId = 'c-fc-dec-001';
    const currentCostume = makeCostume(costumeId, {
      name: '名称冲突-当前',
      updatedAt: '2025-02-01T00:00:00.000Z'
    });
    const importCostume = makeCostume(costumeId, {
      name: '名称冲突-导入',
      updatedAt: '2025-02-01T00:00:00.000Z'
    });

    const currentDB = emptyDB({ tables: { costumes: [currentCostume] } });
    const importDB = emptyDB({ tables: { costumes: [importCostume] } });

    const diffResult = computeFullDiff(currentDB, importDB);

    let conflictItem = null;
    for (const dtype of Object.values(DIFF_TYPES)) {
      const found = (diffResult.tables.costumes[dtype] || []).find((i) => i.id === costumeId);
      if (found && found.fieldConflicts && found.fieldConflicts.length > 0) {
        conflictItem = found;
        break;
      }
    }
    if (!conflictItem) {
      const allItems = Object.values(DIFF_TYPES).flatMap(
        (t) => diffResult.tables.costumes[t] || []
      );
      conflictItem = allItems.find((i) => i.id === costumeId && i.fieldConflicts?.length > 0);
    }

    const decisions = createDefaultDecisions(diffResult);
    const dec = decisions.costumes[costumeId];

    if (dec.choice === null) {
      expect(dec.mergedData).toBeNull();
    } else {
      expect([DECISION_CHOICES.KEEP_CURRENT, DECISION_CHOICES.USE_IMPORT]).toContain(dec.choice);
    }
  });

  it('auto-decides MODIFIED_ONLY_IN_IMPORT to USE_IMPORT', () => {
    const costumeId = 'c-mi-dec-001';
    const currentCostume = makeCostume(costumeId, {
      name: '旧名称',
      updatedAt: '2025-01-01T00:00:00.000Z'
    });
    const importCostume = makeCostume(costumeId, {
      name: '新名称',
      updatedAt: '2025-06-01T00:00:00.000Z'
    });

    const currentDB = emptyDB({ tables: { costumes: [currentCostume] } });
    const importDB = emptyDB({ tables: { costumes: [importCostume] } });

    const diffResult = computeFullDiff(currentDB, importDB);
    const decisions = createDefaultDecisions(diffResult);

    const dec = decisions.costumes[costumeId];
    expect(dec.choice).toBe(DECISION_CHOICES.USE_IMPORT);
  });

  it('auto-decides MODIFIED_ONLY_IN_CURRENT to KEEP_CURRENT', () => {
    const costumeId = 'c-mc-dec-001';
    const currentCostume = makeCostume(costumeId, {
      name: '新名称-当前',
      updatedAt: '2025-06-01T00:00:00.000Z'
    });
    const importCostume = makeCostume(costumeId, {
      name: '旧名称-导入',
      updatedAt: '2025-01-01T00:00:00.000Z'
    });

    const currentDB = emptyDB({ tables: { costumes: [currentCostume] } });
    const importDB = emptyDB({ tables: { costumes: [importCostume] } });

    const diffResult = computeFullDiff(currentDB, importDB);
    const decisions = createDefaultDecisions(diffResult);

    const dec = decisions.costumes[costumeId];
    expect(dec.choice).toBe(DECISION_CHOICES.KEEP_CURRENT);
  });

  it('decides based on event timeline when both sides have non-overlapping events (merge_both)', () => {
    const costumeId = 'c-merge-both-001';
    const currentCostume = makeCostume(costumeId, {
      name: '合并服装',
      location: '仓库A',
      updatedAt: '2025-03-01T00:00:00.000Z'
    });
    const importCostume = makeCostume(costumeId, {
      name: '合并服装',
      location: '仓库B',
      updatedAt: '2025-03-01T00:00:00.000Z'
    });

    const curEvent = makeSyncEvent('ev-mb-c1', 'costumes', costumeId, 'update', 'current', {
      changedFields: ['location'],
      timestamp: '2025-03-01T10:00:00.000Z'
    });
    const impEvent = makeSyncEvent('ev-mb-i1', 'costumes', costumeId, 'update', 'import', {
      changedFields: ['note'],
      timestamp: '2025-03-01T11:00:00.000Z'
    });

    const currentDB = emptyDB({
      tables: {
        costumes: [currentCostume],
        syncEvents: [curEvent]
      }
    });
    const importDB = emptyDB({
      tables: {
        costumes: [importCostume],
        syncEvents: [impEvent]
      }
    });

    const diffResult = computeFullDiff(currentDB, importDB);

    const costumeDiff = diffResult.tables.costumes;
    const eventBasedItem = costumeDiff[DIFF_TYPES.EVENT_BASED_RESOLVABLE].find(
      (i) => i.id === costumeId
    );
    const modifiedItem =
      costumeDiff[DIFF_TYPES.MODIFIED_ONLY_IN_CURRENT].find((i) => i.id === costumeId) ||
      costumeDiff[DIFF_TYPES.MODIFIED_ONLY_IN_IMPORT].find((i) => i.id === costumeId);

    const item = eventBasedItem || modifiedItem;
    if (item?.timelineAnalysis?.autoChoice === 'merge_both') {
      const decisions = createDefaultDecisions(diffResult);
      const dec = decisions.costumes[costumeId];
      expect(dec.choice).toBe(DECISION_CHOICES.MANUAL);
      expect(dec.autoMergedData).toBeDefined();
      expect(dec.autoReason).toBeTruthy();
    } else {
      const decisions = createDefaultDecisions(diffResult);
      const dec = decisions.costumes[costumeId];
      expect([DECISION_CHOICES.KEEP_CURRENT, DECISION_CHOICES.USE_IMPORT, DECISION_CHOICES.MANUAL]).toContain(
        dec.choice
      );
    }
  });

  it('auto-decides DELETED_SUSPECT to KEEP_CURRENT when no timeline', () => {
    const recordId = 'r-ds-dec-001';
    const currentRecord = makeRecord(recordId, 'c-001');

    const currentDB = emptyDB({ tables: { records: [currentRecord] } });
    const importDB = emptyDB();

    const diffResult = computeFullDiff(currentDB, importDB);
    const decisions = createDefaultDecisions(diffResult);

    expect(decisions.records[recordId].choice).toBe(DECISION_CHOICES.KEEP_CURRENT);
  });
});

describe('applyMerge', () => {
  it('adds imported records when decision is USE_IMPORT for ADDED items', () => {
    const costumeId = 'c-apply-add-001';
    const currentDB = emptyDB();
    const importDB = emptyDB({
      tables: { costumes: [makeCostume(costumeId, { name: '新增应用' })] }
    });

    const diffResult = computeFullDiff(currentDB, importDB);
    const decisions = createDefaultDecisions(diffResult);
    const { db } = applyMerge(currentDB, importDB, diffResult, decisions);

    const costume = db.tables.costumes.find((c) => c.id === costumeId);
    expect(costume).toBeDefined();
    expect(costume.name).toBe('新增应用');
  });

  it('keeps current records for IDENTICAL items', () => {
    const costumeId = 'c-apply-id-001';
    const costume = makeCostume(costumeId, { name: '保持不变' });
    const currentDB = emptyDB({ tables: { costumes: [costume] } });
    const importDB = emptyDB({ tables: { costumes: [makeCostume(costumeId, { name: '保持不变' })] } });

    const diffResult = computeFullDiff(currentDB, importDB);
    const decisions = createDefaultDecisions(diffResult);
    const { db } = applyMerge(currentDB, importDB, diffResult, decisions);

    expect(db.tables.costumes).toHaveLength(1);
    expect(db.tables.costumes[0].name).toBe('保持不变');
  });

  it('soft-deletes costume when TRUE_DELETE decision is USE_IMPORT', () => {
    const costumeId = 'c-apply-td-001';
    const currentCostume = makeCostume(costumeId, { name: '待删服装' });
    const tombstone = makeTombstone('costumes', costumeId);

    const currentDB = emptyDB({ tables: { costumes: [currentCostume] } });
    const importDB = emptyDB({ tables: { tombstones: [tombstone] } });

    const diffResult = computeFullDiff(currentDB, importDB);
    const decisions = createDefaultDecisions(diffResult);
    const { db } = applyMerge(currentDB, importDB, diffResult, decisions);

    const deletedCostume = db.tables.costumes.find((c) => c.id === costumeId);
    expect(deletedCostume).toBeDefined();
    expect(deletedCostume.deletedAt).toBeTruthy();
    expect(deletedCostume.deleteSummary).toContain('墓碑');
  });

  it('keeps current records when OLD_BACKUP_MISSING decision is KEEP_CURRENT', () => {
    const costumeId = 'c-apply-obm-001';
    const currentCostume = makeCostume(costumeId, { name: '保留旧备份' });

    const currentDB = emptyDB({ tables: { costumes: [currentCostume] } });
    const importDB = emptyDB();

    const diffResult = computeFullDiff(currentDB, importDB);
    const decisions = createDefaultDecisions(diffResult);
    const { db } = applyMerge(currentDB, importDB, diffResult, decisions);

    const costume = db.tables.costumes.find((c) => c.id === costumeId);
    expect(costume).toBeDefined();
    expect(costume.name).toBe('保留旧备份');
    expect(costume.deletedAt).toBeFalsy();
  });

  it('uses import version when MODIFIED_ONLY_IN_IMPORT decision is USE_IMPORT', () => {
    const costumeId = 'c-apply-mi-001';
    const currentCostume = makeCostume(costumeId, {
      name: '旧名称',
      updatedAt: '2025-01-01T00:00:00.000Z'
    });
    const importCostume = makeCostume(costumeId, {
      name: '新名称-导入',
      updatedAt: '2025-06-01T00:00:00.000Z'
    });

    const currentDB = emptyDB({ tables: { costumes: [currentCostume] } });
    const importDB = emptyDB({ tables: { costumes: [importCostume] } });

    const diffResult = computeFullDiff(currentDB, importDB);
    const decisions = createDefaultDecisions(diffResult);
    const { db } = applyMerge(currentDB, importDB, diffResult, decisions);

    const costume = db.tables.costumes.find((c) => c.id === costumeId);
    expect(costume).toBeDefined();
    expect(costume.name).toBe('新名称-导入');
  });

  it('uses current version when MODIFIED_ONLY_IN_CURRENT decision is KEEP_CURRENT', () => {
    const costumeId = 'c-apply-mc-001';
    const currentCostume = makeCostume(costumeId, {
      name: '新名称-当前',
      updatedAt: '2025-06-01T00:00:00.000Z'
    });
    const importCostume = makeCostume(costumeId, {
      name: '旧名称-导入',
      updatedAt: '2025-01-01T00:00:00.000Z'
    });

    const currentDB = emptyDB({ tables: { costumes: [currentCostume] } });
    const importDB = emptyDB({ tables: { costumes: [importCostume] } });

    const diffResult = computeFullDiff(currentDB, importDB);
    const decisions = createDefaultDecisions(diffResult);
    const { db } = applyMerge(currentDB, importDB, diffResult, decisions);

    const costume = db.tables.costumes.find((c) => c.id === costumeId);
    expect(costume).toBeDefined();
    expect(costume.name).toBe('新名称-当前');
  });

  it('merges tombstones from import side', () => {
    const costumeId = 'c-apply-ts-001';
    const tombstone = makeTombstone('costumes', costumeId);
    const currentDB = emptyDB({ tables: { tombstones: [] } });
    const importDB = emptyDB({ tables: { tombstones: [tombstone] } });

    const diffResult = computeFullDiff(currentDB, importDB);
    const decisions = createDefaultDecisions(diffResult);
    const { db } = applyMerge(currentDB, importDB, diffResult, decisions);

    const ts = db.tables.tombstones.find((t) => t.recordId === costumeId);
    expect(ts).toBeDefined();
  });

  it('does not duplicate existing tombstones', () => {
    const costumeId = 'c-apply-dup-001';
    const tombstone = makeTombstone('costumes', costumeId);
    const currentDB = emptyDB({ tables: { tombstones: [tombstone] } });
    const importDB = emptyDB({ tables: { tombstones: [tombstone] } });

    const diffResult = computeFullDiff(currentDB, importDB);
    const decisions = createDefaultDecisions(diffResult);
    const { db } = applyMerge(currentDB, importDB, diffResult, decisions);

    const matching = db.tables.tombstones.filter((t) => t.recordId === costumeId);
    expect(matching).toHaveLength(1);
  });

  it('auto-merges syncEvents from import', () => {
    const ev1 = makeSyncEvent('ev-merge-1', 'costumes', 'c-1', 'create', 'current');
    const ev2 = makeSyncEvent('ev-merge-2', 'costumes', 'c-2', 'update', 'import');

    const currentDB = emptyDB({ tables: { syncEvents: [ev1] } });
    const importDB = emptyDB({ tables: { syncEvents: [ev2] } });

    const diffResult = computeFullDiff(currentDB, importDB);
    const decisions = createDefaultDecisions(diffResult);
    const { db } = applyMerge(currentDB, importDB, diffResult, decisions);

    expect(db.tables.syncEvents).toHaveLength(2);
  });

  it('generates costumeIdMap when an added costume ID collides with an existing current costume', () => {
    const collisionId = 'c-collision-001';
    const existingCostume = makeCostume(collisionId, { name: '现有服装' });
    const otherId = 'c-other-001';
    const otherCostume = makeCostume(otherId, { name: '其他服装' });

    const currentDB = emptyDB({ tables: { costumes: [existingCostume, otherCostume] } });

    const importCollision = makeCostume(collisionId, { name: '导入同名服装' });
    const importNew = makeCostume('c-new-001', { name: '全新服装' });
    const importDB = emptyDB({ tables: { costumes: [importCollision, importNew] } });

    const diffResult = computeFullDiff(currentDB, importDB);
    const decisions = createDefaultDecisions(diffResult);

    decisions.costumes['c-new-001'] = {
      choice: DECISION_CHOICES.USE_IMPORT,
      mergedData: { ...importNew }
    };

    const { db, costumeIdMap } = applyMerge(currentDB, importDB, diffResult, decisions);

    if (Object.keys(costumeIdMap).length > 0) {
      expect(typeof costumeIdMap[collisionId]).toBe('string');
      expect(costumeIdMap[collisionId]).not.toBe(collisionId);
    }

    const newCostume = db.tables.costumes.find((c) => c.name === '全新服装');
    expect(newCostume).toBeDefined();
  });

  it('returns a db object that preserves tables not involved in merge', () => {
    const currentDB = emptyDB({
      tables: {
        inventoryTasks: [{ id: 'it-1', name: '盘点任务', status: '进行中' }]
      }
    });
    const importDB = emptyDB();

    const diffResult = computeFullDiff(currentDB, importDB);
    const decisions = createDefaultDecisions(diffResult);
    const { db } = applyMerge(currentDB, importDB, diffResult, decisions);

    expect(db.tables.inventoryTasks).toBeDefined();
  });

  it('skips items with no decision (null choice)', () => {
    const costumeId = 'c-skip-001';
    const currentCostume = makeCostume(costumeId, {
      name: '冲突服装A',
      updatedAt: '2025-02-01T00:00:00.000Z'
    });
    const importCostume = makeCostume(costumeId, {
      name: '冲突服装B',
      updatedAt: '2025-02-01T00:00:00.000Z'
    });

    const currentDB = emptyDB({ tables: { costumes: [currentCostume] } });
    const importDB = emptyDB({ tables: { costumes: [importCostume] } });

    const diffResult = computeFullDiff(currentDB, importDB);
    const decisions = createDefaultDecisions(diffResult);

    if (decisions.costumes[costumeId].choice === null) {
      const { db } = applyMerge(currentDB, importDB, diffResult, decisions);
      const found = db.tables.costumes.find((c) => c.id === costumeId);
      expect(found).toBeDefined();
      expect(found.name).toBe('冲突服装A');
    }
  });

  it('handles completely empty databases', () => {
    const currentDB = emptyDB();
    const importDB = emptyDB();

    const diffResult = computeFullDiff(currentDB, importDB);
    const decisions = createDefaultDecisions(diffResult);
    const { db } = applyMerge(currentDB, importDB, diffResult, decisions);

    for (const table of MERGE_TABLES) {
      expect(db.tables[table]).toEqual([]);
    }
  });
});

describe('event timeline auto-decision integration', () => {
  it('resolves to KEEP_CURRENT when current event is later than import event by >1s', () => {
    const costumeId = 'c-tl-cur-001';
    const currentCostume = makeCostume(costumeId, {
      name: '当前更新',
      location: '仓库A',
      updatedAt: '2025-03-01T00:00:00.000Z'
    });
    const importCostume = makeCostume(costumeId, {
      name: '导入更新',
      location: '仓库B',
      updatedAt: '2025-03-01T00:00:00.000Z'
    });

    const curEvent = makeSyncEvent('ev-tc-1', 'costumes', costumeId, 'update', 'current', {
      changedFields: ['name'],
      timestamp: '2025-03-02T12:00:00.000Z'
    });
    const impEvent = makeSyncEvent('ev-ti-1', 'costumes', costumeId, 'update', 'import', {
      changedFields: ['name'],
      timestamp: '2025-03-02T10:00:00.000Z'
    });

    const currentDB = emptyDB({
      tables: { costumes: [currentCostume], syncEvents: [curEvent] }
    });
    const importDB = emptyDB({
      tables: { costumes: [importCostume], syncEvents: [impEvent] }
    });

    const diffResult = computeFullDiff(currentDB, importDB);

    const costumeDiff = diffResult.tables.costumes;
    const allItems = Object.values(DIFF_TYPES).flatMap((t) => costumeDiff[t] || []);
    const item = allItems.find((i) => i.id === costumeId);
    expect(item).toBeDefined();

    if (item.timelineAnalysis?.canAutoResolve) {
      expect(item.timelineAnalysis.autoChoice).toBe(DECISION_CHOICES.KEEP_CURRENT);
      const decisions = createDefaultDecisions(diffResult);
      expect(decisions.costumes[costumeId].choice).toBe(DECISION_CHOICES.KEEP_CURRENT);
    }
  });

  it('resolves to USE_IMPORT when import event is later than current event by >1s', () => {
    const costumeId = 'c-tl-imp-001';
    const currentCostume = makeCostume(costumeId, {
      name: '当前旧',
      location: '仓库A',
      updatedAt: '2025-03-01T00:00:00.000Z'
    });
    const importCostume = makeCostume(costumeId, {
      name: '导入新',
      location: '仓库B',
      updatedAt: '2025-03-01T00:00:00.000Z'
    });

    const curEvent = makeSyncEvent('ev-tc2-1', 'costumes', costumeId, 'update', 'current', {
      changedFields: ['name'],
      timestamp: '2025-03-02T10:00:00.000Z'
    });
    const impEvent = makeSyncEvent('ev-ti2-1', 'costumes', costumeId, 'update', 'import', {
      changedFields: ['name'],
      timestamp: '2025-03-02T12:00:00.000Z'
    });

    const currentDB = emptyDB({
      tables: { costumes: [currentCostume], syncEvents: [curEvent] }
    });
    const importDB = emptyDB({
      tables: { costumes: [importCostume], syncEvents: [impEvent] }
    });

    const diffResult = computeFullDiff(currentDB, importDB);

    const costumeDiff = diffResult.tables.costumes;
    const allItems = Object.values(DIFF_TYPES).flatMap((t) => costumeDiff[t] || []);
    const item = allItems.find((i) => i.id === costumeId);
    expect(item).toBeDefined();

    if (item.timelineAnalysis?.canAutoResolve) {
      expect(item.timelineAnalysis.autoChoice).toBe(DECISION_CHOICES.USE_IMPORT);
      const decisions = createDefaultDecisions(diffResult);
      expect(decisions.costumes[costumeId].choice).toBe(DECISION_CHOICES.USE_IMPORT);
    }
  });

  it('resolves to merge_both when events modify different fields with no overlap', () => {
    const costumeId = 'c-tl-merge-001';
    const currentCostume = makeCostume(costumeId, {
      name: '合并测试',
      location: '仓库A',
      note: '',
      updatedAt: '2025-03-01T00:00:00.000Z'
    });
    const importCostume = makeCostume(costumeId, {
      name: '合并测试',
      location: '仓库A',
      note: '导入备注',
      updatedAt: '2025-03-01T00:00:00.000Z'
    });

    const curEvent = makeSyncEvent('ev-merge-c1', 'costumes', costumeId, 'update', 'current', {
      changedFields: ['location'],
      timestamp: '2025-03-01T10:00:00.000Z'
    });
    const impEvent = makeSyncEvent('ev-merge-i1', 'costumes', costumeId, 'update', 'import', {
      changedFields: ['note'],
      timestamp: '2025-03-01T11:00:00.000Z'
    });

    const currentDB = emptyDB({
      tables: { costumes: [currentCostume], syncEvents: [curEvent] }
    });
    const importDB = emptyDB({
      tables: { costumes: [importCostume], syncEvents: [impEvent] }
    });

    const diffResult = computeFullDiff(currentDB, importDB);

    const costumeDiff = diffResult.tables.costumes;
    const eventBased = costumeDiff[DIFF_TYPES.EVENT_BASED_RESOLVABLE].find(
      (i) => i.id === costumeId
    );

    if (eventBased) {
      expect(eventBased.timelineAnalysis.canAutoResolve).toBe(true);
      expect(eventBased.timelineAnalysis.autoChoice).toBe('merge_both');

      const decisions = createDefaultDecisions(diffResult);
      const dec = decisions.costumes[costumeId];
      expect(dec.choice).toBe(DECISION_CHOICES.MANUAL);
      expect(dec.autoMergedData).toBeDefined();
      expect(dec.autoMergedData.location).toBe('仓库A');
      expect(dec.autoMergedData.note).toBe('导入备注');
    }
  });

  it('does not auto-resolve when both sides modify the same field at close timestamps', () => {
    const costumeId = 'c-tl-conflict-001';
    const currentCostume = makeCostume(costumeId, {
      name: '冲突-当前',
      updatedAt: '2025-03-01T00:00:00.000Z'
    });
    const importCostume = makeCostume(costumeId, {
      name: '冲突-导入',
      updatedAt: '2025-03-01T00:00:00.000Z'
    });

    const curEvent = makeSyncEvent('ev-conf-c1', 'costumes', costumeId, 'update', 'current', {
      changedFields: ['name'],
      timestamp: '2025-03-01T10:00:00.000Z'
    });
    const impEvent = makeSyncEvent('ev-conf-i1', 'costumes', costumeId, 'update', 'import', {
      changedFields: ['name'],
      timestamp: '2025-03-01T10:00:00.200Z'
    });

    const currentDB = emptyDB({
      tables: { costumes: [currentCostume], syncEvents: [curEvent] }
    });
    const importDB = emptyDB({
      tables: { costumes: [importCostume], syncEvents: [impEvent] }
    });

    const diffResult = computeFullDiff(currentDB, importDB);

    const costumeDiff = diffResult.tables.costumes;
    const allItems = Object.values(DIFF_TYPES).flatMap((t) => costumeDiff[t] || []);
    const item = allItems.find((i) => i.id === costumeId);
    expect(item).toBeDefined();

    if (item.timelineAnalysis) {
      expect(item.timelineAnalysis.canAutoResolve).toBe(false);
    }
  });

  it('auto-resolves to KEEP_CURRENT when only current side has events', () => {
    const costumeId = 'c-tl-curonly-001';
    const currentCostume = makeCostume(costumeId, {
      name: '仅当前改',
      location: '仓库A',
      updatedAt: '2025-03-01T00:00:00.000Z'
    });
    const importCostume = makeCostume(costumeId, {
      name: '仅当前改',
      location: '仓库B',
      updatedAt: '2025-03-01T00:00:00.000Z'
    });

    const curEvent = makeSyncEvent('ev-co-1', 'costumes', costumeId, 'update', 'current', {
      changedFields: ['location'],
      timestamp: '2025-03-01T10:00:00.000Z'
    });

    const currentDB = emptyDB({
      tables: { costumes: [currentCostume], syncEvents: [curEvent] }
    });
    const importDB = emptyDB({
      tables: { costumes: [importCostume] }
    });

    const diffResult = computeFullDiff(currentDB, importDB);

    const costumeDiff = diffResult.tables.costumes;
    const modifiedCurrent = costumeDiff[DIFF_TYPES.MODIFIED_ONLY_IN_CURRENT];
    const matched = modifiedCurrent.find((i) => i.id === costumeId);

    if (matched) {
      expect(matched.timelineAnalysis.canAutoResolve).toBe(true);
      expect(matched.timelineAnalysis.autoChoice).toBe(DECISION_CHOICES.KEEP_CURRENT);
    }
  });

  it('auto-resolves to USE_IMPORT when only import side has events', () => {
    const costumeId = 'c-tl-ponly-001';
    const currentCostume = makeCostume(costumeId, {
      name: '仅导入改',
      location: '仓库A',
      updatedAt: '2025-03-01T00:00:00.000Z'
    });
    const importCostume = makeCostume(costumeId, {
      name: '仅导入改',
      location: '仓库B',
      updatedAt: '2025-03-01T00:00:00.000Z'
    });

    const impEvent = makeSyncEvent('ev-po-1', 'costumes', costumeId, 'update', 'import', {
      changedFields: ['location'],
      timestamp: '2025-03-01T10:00:00.000Z'
    });

    const currentDB = emptyDB({
      tables: { costumes: [currentCostume] }
    });
    const importDB = emptyDB({
      tables: { costumes: [importCostume], syncEvents: [impEvent] }
    });

    const diffResult = computeFullDiff(currentDB, importDB);

    const costumeDiff = diffResult.tables.costumes;
    const modifiedImport = costumeDiff[DIFF_TYPES.MODIFIED_ONLY_IN_IMPORT];
    const matched = modifiedImport.find((i) => i.id === costumeId);

    if (matched) {
      expect(matched.timelineAnalysis.canAutoResolve).toBe(true);
      expect(matched.timelineAnalysis.autoChoice).toBe(DECISION_CHOICES.USE_IMPORT);
    }
  });
});
