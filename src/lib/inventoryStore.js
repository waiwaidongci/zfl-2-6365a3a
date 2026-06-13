import { globalIndex } from './dataIndex.js';
import { insertOne, insertMany, updateOne, updateMany, updateOneWithEventType, deleteOne, TABLES, EVENT_TYPES, startEventBatch, endEventBatch } from '$lib/database.js';

export const INVENTORY_STATUS = {
  PENDING: '待盘点',
  NORMAL: '正常',
  MISSING: '缺失',
  LOCATION_MISMATCH: '位置不符',
  STATUS_MISMATCH: '状态不符'
};

export const TASK_STATUS = {
  IN_PROGRESS: '进行中',
  COMPLETED: '已完成'
};

export function getAllInventoryTasks(options = {}) {
  return globalIndex.filterInventoryTasks(options);
}

export function getInventoryTaskById(id) {
  return globalIndex.getInventoryTaskById(id);
}

export function getInventoryItemsByTaskId(taskId, options = {}) {
  return globalIndex.filterInventoryItems({ taskId, ...options });
}

export function getInventoryItemsByTaskIdAndStatus(taskId, status) {
  return globalIndex.getInventoryItemsByTaskIdAndStatus(taskId, status);
}

export function getInventoryTaskStats(taskId) {
  return globalIndex.getInventoryTaskStatsCached(taskId);
}

export function getDiscrepancyItems(taskId) {
  return globalIndex.getInventoryDiscrepancyItems(taskId);
}

export function createInventoryTask(name, note = '', playFilter = '全部剧目') {
  const filteredCostumes = playFilter === '全部剧目'
    ? globalIndex.getActiveCostumes()
    : globalIndex.getCostumesByPlayFast(playFilter);

  const taskId = crypto.randomUUID();
  const now = new Date().toISOString();

  const task = {
    id: taskId,
    name: name.trim() || `盘点任务 - ${new Date().toLocaleDateString()}`,
    note: note.trim(),
    playFilter,
    status: TASK_STATUS.IN_PROGRESS,
    totalCount: filteredCostumes.length,
    completedCount: 0,
    normalCount: 0,
    missingCount: 0,
    locationMismatchCount: 0,
    statusMismatchCount: 0,
    createdAt: now,
    updatedAt: now,
    completedAt: null
  };

  const savedTask = insertOne(TABLES.inventoryTasks, task);

  const items = filteredCostumes.map((costume) => ({
    id: crypto.randomUUID(),
    taskId,
    costumeId: costume.id,
    costumeName: costume.name,
    costumeSize: costume.size || '',
    costumePlay: costume.play,
    expectedLocation: costume.location || '',
    expectedStatus: costume.status || '在库',
    expectedClean: costume.clean || '已清洗',
    actualStatus: INVENTORY_STATUS.PENDING,
    actualLocation: '',
    actualClean: '',
    note: '',
    checkedAt: null,
    createdAt: now,
    updatedAt: now
  }));

  insertMany(TABLES.inventoryItems, items, { batchNote: 'inventory_task_creation' });

  globalIndex.invalidateInventoryTaskStats(null);

  return savedTask;
}

export function updateInventoryItemStatus(itemId, status, actualLocation = '', actualClean = '', note = '') {
  const item = updateOneWithEventType(TABLES.inventoryItems, itemId, {
    actualStatus: status,
    actualLocation,
    actualClean,
    note,
    checkedAt: new Date().toISOString()
  }, EVENT_TYPES.INVENTORY_CHECK, `盘点结果：${status}`);

  if (item) {
    recalculateTaskStats(item.taskId);
  }

  return item;
}

export function recalculateTaskStats(taskId) {
  const stats = globalIndex.updateInventoryItemStats(taskId);
  return updateOne(TABLES.inventoryTasks, taskId, stats);
}

export function completeInventoryTask(taskId) {
  const task = getInventoryTaskById(taskId);
  if (!task) return null;

  return updateOne(TABLES.inventoryTasks, taskId, {
    status: TASK_STATUS.COMPLETED,
    completedAt: new Date().toISOString()
  });
}

export function reopenInventoryTask(taskId) {
  return updateOne(TABLES.inventoryTasks, taskId, {
    status: TASK_STATUS.IN_PROGRESS,
    completedAt: null
  });
}

export function deleteInventoryTask(taskId) {
  const items = globalIndex.filterInventoryItems({ taskId });
  for (const item of items) {
    deleteOne(TABLES.inventoryItems, item.id);
  }
  globalIndex.invalidateInventoryTaskStats(taskId);
  return deleteOne(TABLES.inventoryTasks, taskId);
}

export function batchUpdateInventoryItems(itemIds, updates) {
  const now = new Date().toISOString();
  const taskIds = new Set();

  const items = globalIndex.filterInventoryItems({});
  const itemMap = new Map(items.map(i => [i.id, i]));

  const updatesArray = itemIds
    .map(id => {
      const oldItem = itemMap.get(id);
      if (!oldItem) return null;
      taskIds.add(oldItem.taskId);
      return {
        id,
        updates: {
          ...updates,
          checkedAt: now
        },
        eventType: EVENT_TYPES.INVENTORY_CHECK,
        note: '批量更新'
      };
    })
    .filter(Boolean);

  const results = updateMany(TABLES.inventoryItems, updatesArray, { batchNote: 'batch_inventory_update' });

  for (const taskId of taskIds) {
    recalculateTaskStats(taskId);
  }

  return results;
}

export function filterInventoryItems(options = {}) {
  return globalIndex.filterInventoryItems(options);
}

export function filterInventoryTasks(options = {}) {
  return globalIndex.filterInventoryTasks(options);
}

export function formatTime(isoString) {
  if (!isoString) return '';
  const date = new Date(isoString);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}
