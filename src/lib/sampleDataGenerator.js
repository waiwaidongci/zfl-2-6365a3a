import {
  PLAY_NAMES,
  COSTUME_NAMES,
  SIZES,
  LOCATIONS,
  ACTOR_NAMES,
  VENUES,
  WORK_ORDER_TYPES,
  COSTUME_STATUS,
  CLEAN_STATUS,
  WORK_ORDER_STATUS,
  RESERVATION_STATUS,
  INVENTORY_STATUS,
  TASK_STATUS
} from './constants.js';
import { setAll, getDB, saveDB, initializeDatabase, TABLES } from './database.js';
import { DataIndex } from './dataIndex.js';

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomPick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomDate(startOffsetDays, endOffsetDays) {
  const now = new Date();
  const start = new Date(now);
  start.setDate(start.getDate() + startOffsetDays);
  const end = new Date(now);
  end.setDate(end.getDate() + endOffsetDays);
  const randomTime = start.getTime() + Math.random() * (end.getTime() - start.getTime());
  return new Date(randomTime).toISOString().slice(0, 10);
}

function randomDateTime(startOffsetDays, endOffsetDays) {
  const now = new Date();
  const start = new Date(now);
  start.setDate(start.getDate() + startOffsetDays);
  const end = new Date(now);
  end.setDate(end.getDate() + endOffsetDays);
  const randomTime = start.getTime() + Math.random() * (end.getTime() - start.getTime());
  return new Date(randomTime).toISOString();
}

export async function generateSampleData(config = {}) {
  const startTime = performance.now();

  const {
    costumeCount = 500,
    scheduleCount = 200,
    recordCount = 2000,
    inventoryItemCount = 5000,
    packingListCount = 100,
    workOrderCount = 300,
    reservationCount = 800
  } = config;

  const costumes = [];
  const costumeIds = [];
  for (let i = 0; i < costumeCount; i++) {
    const play = randomPick(PLAY_NAMES);
    const name = randomPick(COSTUME_NAMES);
    const size = randomPick(SIZES);
    const statusRoll = Math.random();
    let status = COSTUME_STATUS.IN_STOCK;
    let borrower = '';
    let due = '';
    if (statusRoll < 0.2) {
      status = COSTUME_STATUS.BORROWED;
      borrower = randomPick(ACTOR_NAMES);
      due = randomDate(-10, 20);
    }
    const cleanRoll = Math.random();
    let clean = CLEAN_STATUS.CLEAN;
    if (cleanRoll < 0.15) {
      clean = CLEAN_STATUS.DIRTY;
    } else if (cleanRoll < 0.05) {
      clean = CLEAN_STATUS.REPAIR;
    }

    const costume = {
      id: crypto.randomUUID(),
      name: `${name}${i + 1}号`,
      play,
      size,
      location: randomPick(LOCATIONS),
      status,
      clean,
      borrower,
      due,
      note: Math.random() < 0.2 ? `备注信息${i + 1}` : '',
      createdAt: randomDateTime(-365, 0),
      updatedAt: randomDateTime(-30, 0),
      deletedAt: null,
      deletedByDeviceId: null,
      deleteSummary: null
    };
    costumes.push(costume);
    costumeIds.push(costume.id);
  }

  const schedules = [];
  const scheduleIds = [];
  for (let i = 0; i < scheduleCount; i++) {
    const play = randomPick(PLAY_NAMES);
    const date = randomDate(-30, 60);
    const time = `${randomInt(9, 20).toString().padStart(2, '0')}:${randomPick(['00', '15', '30', '45'])}`;
    const linkedCount = randomInt(3, 20);
    const linkedCostumeIds = [];
    const playCostumes = costumes.filter((c) => c.play === play);
    const availableCostumes = playCostumes.length > 0 ? playCostumes : costumes;
    for (let j = 0; j < Math.min(linkedCount, availableCostumes.length); j++) {
      const idx = randomInt(0, availableCostumes.length - 1);
      if (!linkedCostumeIds.includes(availableCostumes[idx].id)) {
        linkedCostumeIds.push(availableCostumes[idx].id);
      }
    }

    const schedule = {
      id: crypto.randomUUID(),
      play,
      date,
      time,
      venue: randomPick(VENUES),
      status: Math.random() < 0.8 ? '已确认' : '待确认',
      note: Math.random() < 0.3 ? `排期备注${i + 1}` : '',
      linkedCostumeIds,
      createdAt: randomDateTime(-90, 0),
      updatedAt: randomDateTime(-30, 0),
      deletedAt: null,
      deletedByDeviceId: null,
      deleteSummary: null
    };
    schedules.push(schedule);
    scheduleIds.push(schedule.id);
  }

  const records = [];
  for (let i = 0; i < recordCount; i++) {
    const costumeId = randomPick(costumeIds);
    const costume = costumes.find((c) => c.id === costumeId);
    const type = randomPick(['借出', '归还']);
    const operator = randomPick(ACTOR_NAMES);
    const date = randomDate(-180, 30);

    const record = {
      id: crypto.randomUUID(),
      costumeId,
      costumeName: costume?.name || '',
      play: costume?.play || '',
      type,
      operator,
      borrower: type === '借出' ? randomPick(ACTOR_NAMES) : '',
      dueDate: type === '借出' ? randomDate(1, 30) : null,
      actualReturnDate: type === '归还' ? date : null,
      summary: `${type}：${costume?.name || '服装'} - ${operator}`,
      note: Math.random() < 0.15 ? `记录备注${i + 1}` : '',
      createdAt: randomDateTime(-180, 30)
    };
    records.push(record);
  }

  const reservations = [];
  for (let i = 0; i < reservationCount; i++) {
    const costumeId = randomPick(costumeIds);
    const costume = costumes.find((c) => c.id === costumeId);
    const date = randomDate(-15, 45);
    const statusRoll = Math.random();
    let status = 'active';
    if (statusRoll > 0.7) {
      status = 'inactive';
    }

    const reservation = {
      id: crypto.randomUUID(),
      costumeId,
      costumeName: costume?.name || '',
      play: costume?.play || '',
      date,
      type: randomPick(['演员', '排练', '演出', '其他']),
      reservedFor: randomPick(ACTOR_NAMES),
      status,
      note: Math.random() < 0.2 ? `预约备注${i + 1}` : '',
      createdAt: randomDateTime(-60, 0),
      updatedAt: randomDateTime(-30, 0),
      deletedAt: null,
      deletedByDeviceId: null,
      deleteSummary: null
    };
    reservations.push(reservation);
  }

  const workOrders = [];
  for (let i = 0; i < workOrderCount; i++) {
    const costumeId = randomPick(costumeIds);
    const costume = costumes.find((c) => c.id === costumeId);
    const type = randomPick(WORK_ORDER_TYPES);
    const statusRoll = Math.random();
    let status = '待清洗';
    if (type === '维修') {
      status = '待维修';
    }
    if (statusRoll > 0.6) {
      status = type === '维修' ? '维修中' : '清洗中';
    } else if (statusRoll > 0.85) {
      status = '已完成';
    }

    const workOrder = {
      id: crypto.randomUUID(),
      costumeId,
      costumeName: costume?.name || '',
      play: costume?.play || '',
      type,
      status,
      assignee: randomPick(ACTOR_NAMES),
      dueDate: randomDate(1, 30),
      completedDate: status === '已完成' ? randomDate(-10, 0) : null,
      priority: randomPick(['普通', '紧急', '一般']),
      note: Math.random() < 0.25 ? `工单备注${i + 1}` : '',
      createdAt: randomDateTime(-60, 0),
      updatedAt: randomDateTime(-30, 0),
      deletedAt: null,
      deletedByDeviceId: null,
      deleteSummary: null
    };
    workOrders.push(workOrder);
  }

  const packingLists = [];
  for (let i = 0; i < packingListCount; i++) {
    const play = randomPick(PLAY_NAMES);
    const performanceDate = randomDate(-15, 45);
    const itemCount = randomInt(5, 30);
    const items = [];
    const playCostumes = costumes.filter((c) => c.play === play);
    const availableCostumes = playCostumes.length > 0 ? playCostumes : costumes;

    for (let j = 0; j < Math.min(itemCount, availableCostumes.length); j++) {
      const costume = availableCostumes[j];
      const statusRoll = Math.random();
      let status = '未标记';
      if (statusRoll > 0.6) {
        status = '已打包';
      } else if (statusRoll > 0.3) {
        status = '需清洗';
      }

      items.push({
        costumeId: costume.id,
        costumeName: costume.name,
        size: costume.size,
        location: costume.location,
        status,
        note: Math.random() < 0.1 ? `物品备注${j + 1}` : ''
      });
    }

    const packingList = {
      id: crypto.randomUUID(),
      name: `${play} - ${performanceDate} 装箱单`,
      play,
      performanceDate,
      status: Math.random() < 0.7 ? '进行中' : '已完成',
      items,
      note: Math.random() < 0.2 ? `装箱单备注${i + 1}` : '',
      createdAt: randomDateTime(-60, 0),
      updatedAt: randomDateTime(-30, 0),
      deletedAt: null,
      deletedByDeviceId: null,
      deleteSummary: null
    };
    packingLists.push(packingList);
  }

  const inventoryTasks = [];
  const inventoryItems = [];
  const taskCount = Math.ceil(inventoryItemCount / 200);
  let itemsCreated = 0;

  for (let i = 0; i < taskCount && itemsCreated < inventoryItemCount; i++) {
    const playFilter = randomPick(['全部剧目', ...PLAY_NAMES.slice(0, 5)]);
    const taskId = crypto.randomUUID();
    const itemsForTask = Math.min(randomInt(100, 300), inventoryItemCount - itemsCreated);

    let taskCostumes = costumes;
    if (playFilter !== '全部剧目') {
      taskCostumes = costumes.filter((c) => c.play === playFilter);
      if (taskCostumes.length === 0) {
        taskCostumes = costumes;
      }
    }

    const taskItems = [];
    for (let j = 0; j < Math.min(itemsForTask, taskCostumes.length); j++) {
      const costume = taskCostumes[j];
      const statusRoll = Math.random();
      let actualStatus = INVENTORY_STATUS.PENDING;
      let actualLocation = '';
      let actualClean = '';

      if (statusRoll > 0.5) {
        actualStatus = INVENTORY_STATUS.NORMAL;
        actualLocation = costume.location;
        actualClean = costume.clean;
      } else if (statusRoll > 0.35) {
        actualStatus = INVENTORY_STATUS.LOCATION_MISMATCH;
        actualLocation = randomPick(LOCATIONS.filter((l) => l !== costume.location));
        actualClean = costume.clean;
      } else if (statusRoll > 0.25) {
        actualStatus = INVENTORY_STATUS.STATUS_MISMATCH;
        actualLocation = costume.location;
        actualClean = costume.clean === '已清洗' ? '待清洗' : '已清洗';
      } else if (statusRoll > 0.15) {
        actualStatus = INVENTORY_STATUS.MISSING;
      }

      const item = {
        id: crypto.randomUUID(),
        taskId,
        costumeId: costume.id,
        costumeName: costume.name,
        costumeSize: costume.size,
        costumePlay: costume.play,
        expectedLocation: costume.location,
        expectedStatus: costume.status,
        expectedClean: costume.clean,
        actualStatus,
        actualLocation,
        actualClean,
        note: Math.random() < 0.1 ? `盘点备注${j + 1}` : '',
        checkedAt: actualStatus !== INVENTORY_STATUS.PENDING ? randomDateTime(-7, 0) : null,
        createdAt: randomDateTime(-30, 0),
        updatedAt: randomDateTime(-7, 0)
      };
      taskItems.push(item);
      itemsCreated++;
    }

    const completedCount = taskItems.filter((item) => item.actualStatus !== INVENTORY_STATUS.PENDING).length;
    const normalCount = taskItems.filter((item) => item.actualStatus === INVENTORY_STATUS.NORMAL).length;
    const missingCount = taskItems.filter((item) => item.actualStatus === INVENTORY_STATUS.MISSING).length;
    const locationMismatchCount = taskItems.filter((item) => item.actualStatus === INVENTORY_STATUS.LOCATION_MISMATCH).length;
    const statusMismatchCount = taskItems.filter((item) => item.actualStatus === INVENTORY_STATUS.STATUS_MISMATCH).length;

    const task = {
      id: taskId,
      name: `盘点任务 - ${playFilter} - 第${i + 1}批`,
      note: Math.random() < 0.2 ? `盘点备注${i + 1}` : '',
      playFilter,
      status: completedCount === taskItems.length ? TASK_STATUS.COMPLETED : TASK_STATUS.IN_PROGRESS,
      totalCount: taskItems.length,
      completedCount,
      normalCount,
      missingCount,
      locationMismatchCount,
      statusMismatchCount,
      createdAt: randomDateTime(-30, 0),
      updatedAt: randomDateTime(-7, 0),
      completedAt: completedCount === taskItems.length ? randomDateTime(-7, 0) : null
    };

    inventoryTasks.push(task);
    inventoryItems.push(...taskItems);
  }

  const actors = [];
  for (let i = 0; i < 30; i++) {
    const name = randomPick(ACTOR_NAMES);
    const plays = [];
    const playCount = randomInt(1, 4);
    for (let j = 0; j < playCount; j++) {
      const play = randomPick(PLAY_NAMES);
      if (!plays.includes(play)) {
        plays.push(play);
      }
    }

    const actor = {
      id: crypto.randomUUID(),
      name: `${name}${i + 1}`,
      size: randomPick(SIZES),
      plays,
      role: randomPick(['主角', '配角', '群舞', '替补']),
      note: Math.random() < 0.2 ? `演员备注${i + 1}` : '',
      createdAt: randomDateTime(-365, 0),
      updatedAt: randomDateTime(-90, 0),
      deletedAt: null,
      deletedByDeviceId: null,
      deleteSummary: null
    };
    actors.push(actor);
  }

  const riskStatuses = [];

  const syncEvents = [];

  const tombstones = [];

  const db = getDB();
  db.tables[TABLES.costumes] = costumes;
  db.tables[TABLES.records] = records;
  db.tables[TABLES.reservations] = reservations;
  db.tables[TABLES.workOrders] = workOrders;
  db.tables[TABLES.actors] = actors;
  db.tables[TABLES.packingLists] = packingLists;
  db.tables[TABLES.schedules] = schedules;
  db.tables[TABLES.inventoryTasks] = inventoryTasks;
  db.tables[TABLES.inventoryItems] = inventoryItems;
  db.tables[TABLES.riskStatuses] = riskStatuses;
  db.tables[TABLES.syncEvents] = syncEvents;
  db.tables[TABLES.tombstones] = tombstones;

  saveDB(db);
  initializeDatabase();

  const totalRecords =
    costumes.length +
    records.length +
    reservations.length +
    workOrders.length +
    actors.length +
    packingLists.length +
    schedules.length +
    inventoryTasks.length +
    inventoryItems.length;

  const endTime = performance.now();

  return {
    time: endTime - startTime,
    totalRecords,
    breakdown: {
      costumes: costumes.length,
      records: records.length,
      reservations: reservations.length,
      workOrders: workOrders.length,
      actors: actors.length,
      packingLists: packingLists.length,
      schedules: schedules.length,
      inventoryTasks: inventoryTasks.length,
      inventoryItems: inventoryItems.length
    }
  };
}

export async function runPerformanceTests() {
  const results = {};

  const sourceDb = getDB();

  const testIndex = new DataIndex();

  const fullBuildStart = performance.now();
  testIndex.build(sourceDb);
  const fullBuildTime = performance.now() - fullBuildStart;

  const searchStart = performance.now();
  let searchResult = testIndex.search(TABLES.costumes, '天鹅裙');
  const searchSingle = performance.now() - searchStart;

  const queries = ['白色', '天鹅', 'M号', 'A区', '李明'];
  let totalSearchTime = 0;
  for (const q of queries) {
    const t0 = performance.now();
    testIndex.search(TABLES.costumes, q);
    totalSearchTime += performance.now() - t0;
  }
  const searchAvg = totalSearchTime / queries.length;

  const bulkSearchStart = performance.now();
  for (let i = 0; i < 100; i++) {
    testIndex.search(TABLES.costumes, `测试${i}`);
  }
  const searchBulk = performance.now() - bulkSearchStart;

  results.search = {
    single: searchSingle,
    bulk: searchBulk,
    average: searchAvg,
    resultCount: searchResult?.length || 0
  };

  const filterByPlayStart = performance.now();
  const byPlay = testIndex.filterCostumes({ play: '天鹅湖' });
  const filterByPlay = performance.now() - filterByPlayStart;

  const filterByStatusStart = performance.now();
  const byStatus = testIndex.filterCostumes({ status: '借出' });
  const filterByStatus = performance.now() - filterByStatusStart;

  const filterCombinedStart = performance.now();
  const combined = testIndex.filterCostumes({
    query: '公主',
    play: '天鹅湖',
    status: '在库'
  });
  const filterCombined = performance.now() - filterCombinedStart;

  results.filter = {
    byPlay: filterByPlay,
    byStatus: filterByStatus,
    combined: filterCombined,
    byPlayCount: byPlay?.length || 0,
    byStatusCount: byStatus?.length || 0,
    combinedCount: combined?.length || 0
  };

  const riskFullStart = performance.now();
  const allRisks = testIndex.computeAllRisks(true);
  const riskFullCompute = performance.now() - riskFullStart;

  const riskDailyStart = performance.now();
  const today = new Date().toISOString().slice(0, 10);
  const dailyRisks = testIndex.getRisksByDate(today);
  const riskDailyCompute = performance.now() - riskDailyStart;

  results.risks = {
    fullCompute: riskFullCompute,
    dailyCompute: riskDailyCompute,
    riskCount: allRisks?.length || 0,
    todayRiskCount: dailyRisks?.length || 0
  };

  const inventoryTaskStart = performance.now();
  const tasks = testIndex.getAllInventoryTasks();
  let firstTaskStats = null;
  if (tasks.length > 0) {
    firstTaskStats = testIndex.getInventoryTaskStatsCached(tasks[0].id);
  }
  const inventorySingleTask = performance.now() - inventoryTaskStart;

  const inventoryDiscStart = performance.now();
  if (tasks.length > 0) {
    testIndex.getInventoryDiscrepancyItems(tasks[0].id);
  }
  const inventoryDiscrepancies = performance.now() - inventoryDiscStart;

  results.inventory = {
    singleTask: inventorySingleTask,
    discrepancies: inventoryDiscrepancies,
    taskCount: tasks?.length || 0
  };

  const allCostumes = testIndex.getActiveCostumes();
  let firstCostumeId = allCostumes.length > 0 ? allCostumes[0].id : null;

  const costumeToSchedulesStart = performance.now();
  const costumeSchedules = firstCostumeId ? testIndex.getSchedulesForCostume(firstCostumeId) : [];
  const costumeToSchedules = performance.now() - costumeToSchedulesStart;

  const costumeToWorkOrdersStart = performance.now();
  const costumeWorkOrders = firstCostumeId ? testIndex.getWorkOrdersForCostume(firstCostumeId) : [];
  const costumeToWorkOrders = performance.now() - costumeToWorkOrdersStart;

  const allSchedules = testIndex.getAllSchedules();
  let firstScheduleId = allSchedules.length > 0 ? allSchedules[0].id : null;

  const scheduleToCostumesStart = performance.now();
  const scheduleCostumes = firstScheduleId ? testIndex.getCostumesForSchedule(firstScheduleId) : [];
  const scheduleToCostumes = performance.now() - scheduleToCostumesStart;

  results.relations = {
    costumeToSchedules,
    costumeToWorkOrders,
    scheduleToCostumes,
    costumeScheduleCount: costumeSchedules?.length || 0,
    costumeWorkOrderCount: costumeWorkOrders?.length || 0,
    scheduleCostumeCount: scheduleCostumes?.length || 0
  };

  const stats = testIndex.getPerformanceStats();
  const singleUpdateStart = performance.now();
  if (allCostumes.length > 0) {
    const costume = allCostumes[0];
    testIndex.invalidateAffectedRisks(TABLES.costumes, costume);
  }
  const incrementalUpdate = performance.now() - singleUpdateStart;

  const rebuildStart = performance.now();
  testIndex.build(sourceDb);
  const fullRebuild = performance.now() - rebuildStart;

  results.incremental = {
    singleUpdate: incrementalUpdate,
    fullRebuild,
    initialBuild: fullBuildTime,
    buildCount: stats?.buildCount || 0,
    incrementalUpdates: stats?.incrementalUpdates || 0
  };

  const totalTime =
    searchSingle +
    filterByPlay +
    riskFullCompute +
    inventorySingleTask +
    costumeToSchedules +
    incrementalUpdate;

  results.summary = `总测试时间：${totalTime.toFixed(2)}ms，风险计算：${riskFullCompute.toFixed(2)}ms，搜索：${searchSingle.toFixed(2)}ms，过滤：${filterCombined.toFixed(2)}ms`;

  results.indexStats = testIndex.getPerformanceStats();

  return results;
}

export default { generateSampleData, runPerformanceTests };
