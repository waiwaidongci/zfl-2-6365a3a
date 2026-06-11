import { getAll, setAll, insertOne, updateOne, deleteOne, TABLES } from '$lib/database.js';

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

export function getAllInventoryTasks() {
  return getAll(TABLES.inventoryTasks);
}

export function getInventoryTaskById(id) {
  const tasks = getAll(TABLES.inventoryTasks);
  return tasks.find((t) => t.id === id) || null;
}

export function getInventoryItemsByTaskId(taskId) {
  const items = getAll(TABLES.inventoryItems);
  return items.filter((item) => item.taskId === taskId);
}

export function createInventoryTask(name, note = '', playFilter = '全部剧目') {
  const costumes = getAll(TABLES.costumes);
  const filteredCostumes = playFilter === '全部剧目'
    ? costumes
    : costumes.filter((c) => c.play === playFilter);

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
    completedAt: null
  };

  insertOne(TABLES.inventoryTasks, task);

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
    checkedAt: null
  }));

  const allItems = getAll(TABLES.inventoryItems);
  setAll(TABLES.inventoryItems, [...items, ...allItems]);

  return task;
}

export function updateInventoryItemStatus(itemId, status, actualLocation = '', actualClean = '', note = '') {
  const item = updateOne(TABLES.inventoryItems, itemId, {
    actualStatus: status,
    actualLocation,
    actualClean,
    note,
    checkedAt: new Date().toISOString()
  });

  if (item) {
    recalculateTaskStats(item.taskId);
  }

  return item;
}

export function recalculateTaskStats(taskId) {
  const items = getInventoryItemsByTaskId(taskId);
  const stats = {
    completedCount: 0,
    normalCount: 0,
    missingCount: 0,
    locationMismatchCount: 0,
    statusMismatchCount: 0
  };

  items.forEach((item) => {
    if (item.actualStatus !== INVENTORY_STATUS.PENDING) {
      stats.completedCount++;
    }
    if (item.actualStatus === INVENTORY_STATUS.NORMAL) {
      stats.normalCount++;
    } else if (item.actualStatus === INVENTORY_STATUS.MISSING) {
      stats.missingCount++;
    } else if (item.actualStatus === INVENTORY_STATUS.LOCATION_MISMATCH) {
      stats.locationMismatchCount++;
    } else if (item.actualStatus === INVENTORY_STATUS.STATUS_MISMATCH) {
      stats.statusMismatchCount++;
    }
  });

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
  const items = getAll(TABLES.inventoryItems);
  const remainingItems = items.filter((item) => item.taskId !== taskId);
  setAll(TABLES.inventoryItems, remainingItems);
  return deleteOne(TABLES.inventoryTasks, taskId);
}

export function getDiscrepancyItems(taskId) {
  const items = getInventoryItemsByTaskId(taskId);
  return items.filter(
    (item) =>
      item.actualStatus === INVENTORY_STATUS.MISSING ||
      item.actualStatus === INVENTORY_STATUS.LOCATION_MISMATCH ||
      item.actualStatus === INVENTORY_STATUS.STATUS_MISMATCH
  );
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
