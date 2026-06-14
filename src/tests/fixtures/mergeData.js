export function makeId(prefix = 'id') {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

export function emptyDB(overrides = {}) {
  return {
    version: 10,
    migratedAt: null,
    _meta: {
      deviceId: 'dev-test-001',
      lastSyncedAt: null,
      lastMergeAt: null,
      createdAt: '2025-01-01T00:00:00.000Z',
      syncCounter: 0,
      schemaVersion: 2,
      knownDevices: [],
      ...overrides._meta
    },
    tables: {
      costumes: [],
      actors: [],
      records: [],
      reservations: [],
      workOrders: [],
      packingLists: [],
      schedules: [],
      inventoryTasks: [],
      inventoryItems: [],
      riskStatuses: [],
      suggestionStatuses: [],
      syncEvents: [],
      tombstones: [],
      ...overrides.tables
    }
  };
}

export function makeCostume(id, fields = {}) {
  return {
    id,
    name: '默认服装',
    play: '默认剧目',
    size: 'M',
    status: '在库',
    clean: '干净',
    location: '仓库A',
    borrower: '',
    note: '',
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
    syncCounter: 0,
    ...fields
  };
}

export function makeActor(id, fields = {}) {
  return {
    id,
    name: '默认演员',
    role: '主演',
    play: '默认剧目',
    size: 'M',
    note: '',
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
    syncCounter: 0,
    ...fields
  };
}

export function makeReservation(id, costumeId, fields = {}) {
  return {
    id,
    costumeId,
    costumeName: '默认服装',
    play: '默认剧目',
    date: '2025-06-01',
    reservedFor: '张三',
    status: 'active',
    note: '',
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
    syncCounter: 0,
    ...fields
  };
}

export function makeWorkOrder(id, costumeId, fields = {}) {
  return {
    id,
    costumeId,
    costumeName: '默认服装',
    type: '清洗',
    status: '待清洗',
    play: '默认剧目',
    assignee: '',
    note: '',
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
    syncCounter: 0,
    ...fields
  };
}

export function makeSchedule(id, fields = {}) {
  return {
    id,
    play: '默认剧目',
    date: '2025-06-01',
    time: '19:00',
    venue: '主舞台',
    status: 'confirmed',
    linkedCostumeIds: [],
    note: '',
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
    syncCounter: 0,
    ...fields
  };
}

export function makeRecord(id, costumeId, fields = {}) {
  return {
    id,
    costumeId,
    costumeName: '默认服装',
    play: '默认剧目',
    type: '借出',
    operator: '管理员',
    summary: '',
    note: '',
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
    syncCounter: 0,
    ...fields
  };
}

export function makePackingList(id, fields = {}) {
  return {
    id,
    name: '默认装箱单',
    play: '默认剧目',
    performanceDate: '2025-06-01',
    items: [],
    note: '',
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
    syncCounter: 0,
    ...fields
  };
}

export function makeSyncEvent(id, table, recordId, eventType, side, fields = {}) {
  return {
    id,
    table,
    recordId,
    eventType,
    deviceId: side === 'current' ? 'dev-test-001' : 'dev-test-002',
    timestamp: '2025-01-01T00:00:00.000Z',
    syncCounter: 0,
    changedFields: [],
    note: '',
    ...fields
  };
}

export function makeTombstone(table, recordId, fields = {}) {
  return {
    id: makeId('ts'),
    table,
    recordId,
    deletedAt: '2025-03-01T00:00:00.000Z',
    deletedByDeviceId: 'dev-test-002',
    summary: '已删除记录',
    recordSnapshot: null,
    ...fields
  };
}
