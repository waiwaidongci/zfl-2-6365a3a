export function makeV1DB(overrides = {}) {
  return {
    version: 1,
    migratedAt: null,
    tables: {
      costumes: overrides.costumes || [],
      records: overrides.records || [],
      reservations: overrides.reservations || [],
      workOrders: overrides.workOrders || [],
      actors: overrides.actors || []
    }
  };
}

export function makeV2DB(overrides = {}) {
  const base = makeV1DB(overrides);
  base.version = 2;
  base.tables.packingLists = overrides.packingLists || [];
  return base;
}

export function makeV3DB(overrides = {}) {
  const base = makeV2DB(overrides);
  base.version = 3;
  base.tables.schedules = overrides.schedules || [];
  return base;
}

export function makeV4DB(overrides = {}) {
  const base = makeV3DB(overrides);
  base.version = 4;
  base.tables.inventoryTasks = overrides.inventoryTasks || [];
  base.tables.inventoryItems = overrides.inventoryItems || [];
  return base;
}

export function makeV5DB(overrides = {}) {
  const base = makeV4DB(overrides);
  base.version = 5;
  base._meta = overrides._meta || {
    deviceId: 'dev-migrate-test-001',
    lastSyncedAt: null,
    lastMergeAt: null,
    createdAt: '2025-01-15T00:00:00.000Z'
  };
  return base;
}

export function makeV6DB(overrides = {}) {
  const base = makeV5DB(overrides);
  base.version = 6;
  base.tables.riskStatuses = overrides.riskStatuses || [];
  return base;
}

export function makeV7DB(overrides = {}) {
  const base = makeV6DB(overrides);
  base.version = 7;
  base.tables.syncEvents = overrides.syncEvents || [];
  if (!base._meta) base._meta = {};
  base._meta.syncCounter = overrides._meta?.syncCounter ?? 0;
  base._meta.schemaVersion = overrides._meta?.schemaVersion ?? 2;
  base._meta.knownDevices = overrides._meta?.knownDevices ?? [];
  return base;
}

export function makeV8DB(overrides = {}) {
  const base = makeV7DB(overrides);
  base.version = 8;
  base.tables.tombstones = overrides.tombstones || [];
  const softTables = ['costumes', 'actors', 'schedules', 'workOrders', 'reservations', 'packingLists'];
  for (const t of softTables) {
    if (Array.isArray(base.tables[t])) {
      base.tables[t] = base.tables[t].map((r) => ({
        ...r,
        deletedAt: r.deletedAt ?? null,
        deletedByDeviceId: r.deletedByDeviceId ?? null,
        deleteSummary: r.deleteSummary ?? null
      }));
    }
  }
  return base;
}

export function makeV9DB(overrides = {}) {
  const base = makeV8DB(overrides);
  base.version = 9;
  return base;
}

export function sampleCostumeV1(id, fields = {}) {
  return {
    id,
    name: '测试服装',
    play: '测试剧目',
    size: 'M',
    status: '在库',
    clean: '干净',
    location: '仓库A',
    borrower: '',
    note: '',
    ...fields
  };
}

export function sampleActorV1(id, fields = {}) {
  return {
    id,
    name: '测试演员',
    role: '主演',
    play: '测试剧目',
    size: 'M',
    note: '',
    ...fields
  };
}

export function sampleRecordV1(id, costumeId, fields = {}) {
  return {
    id,
    costumeId,
    costumeName: '测试服装',
    play: '测试剧目',
    type: '借出',
    operator: '管理员',
    summary: '',
    note: '',
    ...fields
  };
}

export function sampleReservationV1(id, costumeId, fields = {}) {
  return {
    id,
    costumeId,
    costumeName: '测试服装',
    play: '测试剧目',
    date: '2025-06-01',
    reservedFor: '张三',
    status: 'active',
    note: '',
    ...fields
  };
}

export function sampleWorkOrderV1(id, costumeId, fields = {}) {
  return {
    id,
    costumeId,
    costumeName: '测试服装',
    type: '清洗',
    status: '待清洗',
    play: '测试剧目',
    assignee: '',
    note: '',
    ...fields
  };
}

export function samplePackingListV2(id, fields = {}) {
  return {
    id,
    name: '测试装箱单',
    play: '测试剧目',
    performanceDate: '2025-06-01',
    items: [],
    note: '',
    ...fields
  };
}

export function sampleScheduleV3(id, fields = {}) {
  return {
    id,
    play: '测试剧目',
    date: '2025-06-01',
    time: '19:00',
    venue: '主舞台',
    status: 'confirmed',
    linkedCostumeIds: [],
    note: '',
    ...fields
  };
}

export function sampleInventoryTaskV4(id, fields = {}) {
  return {
    id,
    name: '测试盘点任务',
    status: '进行中',
    ...fields
  };
}

export function sampleInventoryItemV4(id, taskId, costumeId, fields = {}) {
  return {
    id,
    taskId,
    costumeId,
    costumeName: '测试服装',
    expectedLocation: '仓库A',
    actualStatus: '待盘点',
    ...fields
  };
}

export function sampleRiskStatusV6(id, fields = {}) {
  return {
    id,
    riskKey: 'overdue|c-001',
    status: '待处理',
    ...fields
  };
}

export function sampleSyncEventV7(id, table, recordId, eventType, fields = {}) {
  return {
    id,
    table,
    recordId,
    eventType,
    deviceId: 'dev-migrate-test-001',
    timestamp: '2025-03-01T10:00:00.000Z',
    syncCounter: 1,
    changedFields: [],
    note: '',
    ...fields
  };
}

export function sampleTombstoneV8(table, recordId, fields = {}) {
  return {
    id: `ts-${table}-${recordId}`,
    table,
    recordId,
    deletedAt: '2025-04-01T00:00:00.000Z',
    deletedByDeviceId: 'dev-migrate-test-001',
    summary: '已删除',
    recordSnapshot: null,
    ...fields
  };
}

export function sampleSuggestionStatusV10(id, fields = {}) {
  return {
    id,
    suggestionKey: 'schedule|s-001|c-001',
    scheduleId: 's-001',
    costumeId: 'c-001',
    status: '待确认',
    ...fields
  };
}

export function populatedV1DB() {
  return makeV1DB({
    costumes: [
      sampleCostumeV1('c-v1-001', { name: '汉服上衣', size: 'L' }),
      sampleCostumeV1('c-v1-002', { name: '旗袍', size: 'M', status: '借出' })
    ],
    actors: [
      sampleActorV1('a-v1-001', { name: '李小明' })
    ],
    records: [
      sampleRecordV1('r-v1-001', 'c-v1-002')
    ],
    reservations: [
      sampleReservationV1('rv-v1-001', 'c-v1-001')
    ],
    workOrders: [
      sampleWorkOrderV1('w-v1-001', 'c-v1-001')
    ]
  });
}

export function populatedV3DB() {
  const v3 = makeV3DB({
    costumes: [
      sampleCostumeV1('c-v3-001', { name: '戏服1号' }),
      sampleCostumeV1('c-v3-002', { name: '戏服2号' })
    ],
    actors: [sampleActorV1('a-v3-001')],
    records: [sampleRecordV1('r-v3-001', 'c-v3-001')],
    reservations: [sampleReservationV1('rv-v3-001', 'c-v3-001')],
    workOrders: [sampleWorkOrderV1('w-v3-001', 'c-v3-001')],
    packingLists: [
      samplePackingListV2('p-v3-001', { name: '首演装箱单' })
    ],
    schedules: [
      sampleScheduleV3('s-v3-001', { play: '雷雨' })
    ]
  });
  return v3;
}

export function populatedV7DB() {
  const db = makeV7DB({
    costumes: [
      sampleCostumeV1('c-v7-001', {
        name: '测试服装v7',
        createdAt: '2025-02-01T00:00:00.000Z',
        updatedAt: '2025-02-15T00:00:00.000Z'
      })
    ],
    actors: [sampleActorV1('a-v7-001')],
    records: [sampleRecordV1('r-v7-001', 'c-v7-001')],
    reservations: [sampleReservationV1('rv-v7-001', 'c-v7-001')],
    workOrders: [sampleWorkOrderV1('w-v7-001', 'c-v7-001')],
    packingLists: [samplePackingListV2('p-v7-001')],
    schedules: [sampleScheduleV3('s-v7-001')],
    inventoryTasks: [sampleInventoryTaskV4('it-v7-001')],
    inventoryItems: [sampleInventoryItemV4('ii-v7-001', 'it-v7-001', 'c-v7-001')],
    riskStatuses: [sampleRiskStatusV6('rs-v7-001')],
    syncEvents: [
      sampleSyncEventV7('ev-v7-001', 'costumes', 'c-v7-001', 'create', {
        timestamp: '2025-02-01T00:00:00.000Z'
      })
    ],
    _meta: {
      deviceId: 'dev-migrate-test-001',
      lastSyncedAt: null,
      lastMergeAt: null,
      createdAt: '2025-01-01T00:00:00.000Z',
      syncCounter: 5,
      schemaVersion: 2,
      knownDevices: ['dev-migrate-test-001']
    }
  });
  return db;
}
