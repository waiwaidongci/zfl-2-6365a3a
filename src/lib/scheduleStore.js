import { globalIndex } from './dataIndex.js';
import { insertOne, updateOne, deleteOne, TABLES } from '$lib/database.js';

export { globalIndex as scheduleIndex };

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

function filterActive(items) {
  return (items || []).filter((r) => !r?.deletedAt);
}

export function getAllRiskStatuses() {
  return globalIndex.getAllRiskStatuses();
}

export function getRiskStatusByKey(riskKey) {
  return globalIndex.getRiskStatusByKey(riskKey);
}

export function updateRiskProcessingStatus(riskKey, status, handler = '', note = '') {
  const existing = globalIndex.getRiskStatusByKey(riskKey);
  const now = new Date().toISOString();

  if (existing) {
    return updateOne(TABLES.riskStatuses, existing.id, {
      status,
      handler,
      note,
      updatedAt: now
    });
  } else {
    return insertOne(TABLES.riskStatuses, {
      id: crypto.randomUUID(),
      riskKey,
      status,
      handler,
      note,
      createdAt: now,
      updatedAt: now
    });
  }
}

export function getCostumesWithRisks() {
  return globalIndex.getCostumesWithRisks();
}

export function computeAllRisks() {
  return globalIndex.computeAllRisks();
}

export function compute30DayRisks(_costumesInput, _reservationsInput, _workOrdersInput, _packingListsInput) {
  return globalIndex.computeAllRisks();
}

export function computeDailyRisk(dateStr, _reservationsInput, _workOrdersInput, _packingListsInput) {
  return globalIndex.computeDailyRisk(dateStr);
}

export function getRiskStats(risks) {
  return globalIndex.getRiskStats(risks);
}

export function getRisksByScheduleId(scheduleId) {
  return globalIndex.getRisksByScheduleId(scheduleId);
}

export function getRisksByDate(date) {
  return globalIndex.getRisksByDate(date);
}

export function getRisksByCostumeId(costumeId) {
  return globalIndex.getRisksByCostumeId(costumeId);
}

export function autoLinkCostumes(schedule) {
  if (!schedule || !schedule.id) return [];
  return globalIndex.autoLinkCostumes(schedule.id);
}

export function generatePackingListFromSchedule(scheduleId) {
  return globalIndex.generatePackingListFromSchedule(scheduleId);
}

export function getCostumesForSchedule(schedule) {
  if (!schedule) return [];
  return globalIndex.getCostumesForSchedule(schedule.id);
}

export function getReservationsForSchedule(schedule) {
  if (!schedule) return [];
  return globalIndex.getReservationsForSchedule(schedule.id);
}

export function getWorkOrdersForSchedule(schedule) {
  if (!schedule) return [];
  const costumes = getCostumesForSchedule(schedule);
  const results = [];
  for (const costume of costumes) {
    const orders = globalIndex.getActiveWorkOrdersByCostumeId(costume.id);
    results.push(...orders);
  }
  return results;
}

export function getPackingListsForSchedule(schedule) {
  if (!schedule) return [];
  return globalIndex.getPackingListsForSchedule(schedule.id);
}

export function getSchedulesForCostume(costumeId) {
  return globalIndex.getSchedulesForCostume(costumeId);
}

export function getReservationsForCostume(costumeId) {
  return globalIndex.getReservationsForCostume(costumeId);
}

export function getAllSchedules(options = {}) {
  return globalIndex.filterSchedules(options);
}

export function getSchedulesByPlayAndDate(playId, dateStr) {
  return globalIndex.getActiveSchedulesByPlayAndDate(playId, dateStr);
}

export function getSchedulesByPlay(play) {
  return globalIndex.getSchedulesByPlayFast(play);
}

export function getSchedulesByDate(date) {
  return globalIndex.getSchedulesByDateFast(date);
}

export function getUpcomingSchedules() {
  return globalIndex.getUpcomingSchedules30Days();
}

export function getScheduleById(id) {
  return globalIndex.getScheduleById(id);
}

export function getUniquePlays() {
  return globalIndex.getAllPlays();
}

export function addSchedule(scheduleData) {
  const linkedIds = scheduleData.linkedCostumeIds || [];
  if (linkedIds.length === 0 && scheduleData.play && scheduleData.date) {
    scheduleData.linkedCostumeIds = autoLinkCostumes({
      id: 'temp',
      play: scheduleData.play,
      date: scheduleData.date,
      linkedCostumeIds: []
    });
  }
  return insertOne(TABLES.schedules, scheduleData);
}

export function updateSchedule(id, updates) {
  return updateOne(TABLES.schedules, id, updates);
}

export function deleteSchedule(id) {
  return deleteOne(TABLES.schedules, id);
}

export function refreshRisks() {
  globalIndex.invalidateRisks();
}

export function getIndexStats() {
  return globalIndex.getPerformanceStats();
}

export const { subscribe } = globalIndex.store;

export const derived = globalIndex.derived;

export const allRisks = globalIndex.derived.allRisks;
export const riskStats = globalIndex.derived.riskStats;
export const summaryStats = globalIndex.derived.summaryStats;
export const uniquePlays = globalIndex.derived.uniquePlays;
export const upcomingSchedules = globalIndex.derived.upcomingSchedules;

export const allCostumes = globalIndex.derived.allCostumes;
export const allActiveCostumes = globalIndex.derived.allActiveCostumes;
export const allRecords = globalIndex.derived.allRecords;
export const allReservations = globalIndex.derived.allReservations;
export const allWorkOrders = globalIndex.derived.allWorkOrders;
export const allActors = globalIndex.derived.allActors;
export const allPackingLists = globalIndex.derived.allPackingLists;
export const allSchedules = globalIndex.derived.allSchedules;
export const allInventoryTasks = globalIndex.derived.allInventoryTasks;
export const allInventoryItems = globalIndex.derived.allInventoryItems;

export const overdueCount = globalIndex.derived.overdueCount;
export const borrowedCount = globalIndex.derived.borrowedCount;
export const cleanWaitCount = globalIndex.derived.cleanWaitCount;
export const activeReservationCount = globalIndex.derived.activeReservationCount;
export const pendingWorkOrderCount = globalIndex.derived.pendingWorkOrderCount;
export const inProgressWorkOrderCount = globalIndex.derived.inProgressWorkOrderCount;
export const completedWorkOrderCount = globalIndex.derived.completedWorkOrderCount;
export const overdueWorkOrderCount = globalIndex.derived.overdueWorkOrderCount;
export const scheduleCount = globalIndex.derived.scheduleCount;
export const costumesAvailableForWorkOrder = globalIndex.derived.costumesAvailableForWorkOrder;

export function startBatch() {
  globalIndex.startBatch();
}

export function endBatch() {
  globalIndex.endBatch();
}

export function getPerformanceStats() {
  return globalIndex.getPerformanceStats();
}

export function getIndexSummary() {
  return globalIndex.getIndexSummary();
}

export function clearAllCaches() {
  return globalIndex.clearAllCaches();
}

export const SUGGESTION_STATUS = {
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  DEFERRED: 'deferred',
  APPLIED: 'applied'
};

export const SUGGESTION_STATUS_LABELS = {
  pending: '待处理',
  confirmed: '已确认',
  deferred: '暂缓',
  applied: '已执行'
};

export const ACTION_PRIORITY_LABELS = {
  urgent: '紧急',
  high: '高优先',
  medium: '中优先',
  low: '低优先'
};

export function computeAllSuggestions(force = false) {
  return globalIndex.computeAllSuggestions(force);
}

export function getSuggestionsByScheduleId(scheduleId) {
  return globalIndex.getSuggestionsByScheduleId(scheduleId);
}

export function getSuggestionsByCostumeId(costumeId) {
  return globalIndex.getSuggestionsByCostumeId(costumeId);
}

export function getAllSuggestions() {
  return globalIndex.getAllSuggestions();
}

export function filterSuggestions(options) {
  return globalIndex.filterSuggestions(options);
}

export function getSuggestionStats() {
  return globalIndex.getSuggestionStats();
}

export function applyScheduleSuggestion(suggestionId, options) {
  return executeSuggestionFull(suggestionId, {
    alternativeCostumeId: options?.applyAlternative || null,
    handler: options?.handler || '',
    note: options?.note || '',
    updatePackingList: options?.updatePackingList !== false
  });
}

export function confirmSuggestionOnly(suggestionId, options) {
  return globalIndex.confirmSuggestionOnly(suggestionId, options);
}

export function deferSuggestion(suggestionId, options) {
  return globalIndex.deferSuggestion(suggestionId, options);
}

export function refreshSuggestions(scheduleIds) {
  return globalIndex.invalidateSuggestions(scheduleIds);
}

export function refreshRisksAndSuggestions() {
  globalIndex.invalidateRisks();
  globalIndex.invalidateSuggestions();
}

export function executeSuggestionFull(suggestionId, {
  alternativeCostumeId = null,
  handler = '',
  note = '',
  updatePackingList = true
} = {}) {
  const result = globalIndex.applyScheduleSuggestion(suggestionId, {
    applyAlternative: alternativeCostumeId,
    handler,
    note,
    updatePackingList
  });

  if (!result.ok) {
    return result;
  }

  const dbResults = [];

  if (result.scheduleUpdates) {
    const { id, ...patchFields } = result.scheduleUpdates;
    const patch = {};
    if (patchFields.linkedCostumeIds) patch.linkedCostumeIds = patchFields.linkedCostumeIds;
    if (patchFields._patch) Object.assign(patch, patchFields._patch);
    if (Object.keys(patch).length > 0) {
      const r = updateOne(TABLES.schedules, id, patch);
      dbResults.push({ type: 'schedule', id, result: r });
    }
  }

  if (result.packingUpdates && result.packingUpdates.length > 0) {
    for (const pu of result.packingUpdates) {
      const r = updateOne(TABLES.packingLists, pu.id, { items: pu.items });
      dbResults.push({ type: 'packingList', id: pu.id, result: r });
    }
  }

  return {
    ...result,
    dbResults,
    executed: true
  };
}
