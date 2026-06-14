export function makeValidBackupJSON(options = {}) {
  return {
    _meta: {
      version: 10,
      exportedAt: '2025-06-01T12:00:00.000Z',
      app: 'zfl-2-costume-lending',
      deviceId: options.deviceId || 'dev-backup-test-001',
      lastMergeAt: options.lastMergeAt || null,
      createdAt: '2025-01-01T00:00:00.000Z',
      syncCounter: options.syncCounter || 10,
      schemaVersion: 2,
      knownDevices: options.knownDevices || ['dev-backup-test-001'],
      ...options.extraMeta
    },
    tables: {
      costumes: options.costumes || [],
      actors: options.actors || [],
      records: options.records || [],
      reservations: options.reservations || [],
      workOrders: options.workOrders || [],
      packingLists: options.packingLists || [],
      schedules: options.schedules || [],
      inventoryTasks: options.inventoryTasks || [],
      inventoryItems: options.inventoryItems || [],
      riskStatuses: options.riskStatuses || [],
      suggestionStatuses: options.suggestionStatuses || [],
      syncEvents: options.syncEvents || [],
      tombstones: options.tombstones || []
    }
  };
}

export function makeCostumeForBackup(id, fields = {}) {
  return {
    id,
    name: `服装-${id}`,
    play: '备份测试剧目',
    size: 'M',
    status: '在库',
    clean: '干净',
    location: '仓库A',
    borrower: '',
    note: '',
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-06-01T00:00:00.000Z',
    syncCounter: 1,
    deletedAt: null,
    deletedByDeviceId: null,
    deleteSummary: null,
    ...fields
  };
}

export function makeActorForBackup(id, fields = {}) {
  return {
    id,
    name: `演员-${id}`,
    role: '配角',
    play: '备份测试剧目',
    size: 'L',
    note: '',
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-06-01T00:00:00.000Z',
    syncCounter: 1,
    deletedAt: null,
    deletedByDeviceId: null,
    deleteSummary: null,
    ...fields
  };
}

export function makeRecordForBackup(id, costumeId, fields = {}) {
  return {
    id,
    costumeId,
    costumeName: `服装-${costumeId}`,
    play: '备份测试剧目',
    type: '借出',
    operator: '测试管理员',
    summary: '测试借还',
    note: '',
    createdAt: '2025-02-01T00:00:00.000Z',
    updatedAt: '2025-02-01T00:00:00.000Z',
    syncCounter: 1,
    ...fields
  };
}

export function makeReservationForBackup(id, costumeId, fields = {}) {
  return {
    id,
    costumeId,
    costumeName: `服装-${costumeId}`,
    play: '备份测试剧目',
    date: '2025-07-01',
    reservedFor: '测试演员',
    status: 'active',
    note: '',
    createdAt: '2025-03-01T00:00:00.000Z',
    updatedAt: '2025-03-01T00:00:00.000Z',
    syncCounter: 1,
    deletedAt: null,
    deletedByDeviceId: null,
    deleteSummary: null,
    ...fields
  };
}

export function makeWorkOrderForBackup(id, costumeId, fields = {}) {
  return {
    id,
    costumeId,
    costumeName: `服装-${costumeId}`,
    type: '清洗',
    status: '待清洗',
    play: '备份测试剧目',
    assignee: '张三',
    note: '',
    createdAt: '2025-04-01T00:00:00.000Z',
    updatedAt: '2025-04-01T00:00:00.000Z',
    syncCounter: 1,
    deletedAt: null,
    deletedByDeviceId: null,
    deleteSummary: null,
    ...fields
  };
}

export function makeScheduleForBackup(id, fields = {}) {
  return {
    id,
    play: '备份测试剧目',
    date: '2025-07-15',
    time: '19:30',
    venue: '大剧场',
    status: 'confirmed',
    linkedCostumeIds: fields.linkedCostumeIds || [],
    note: '',
    createdAt: '2025-05-01T00:00:00.000Z',
    updatedAt: '2025-05-01T00:00:00.000Z',
    syncCounter: 1,
    deletedAt: null,
    deletedByDeviceId: null,
    deleteSummary: null,
    ...fields
  };
}

export function makeSyncEventForBackup(id, table, recordId, eventType, fields = {}) {
  return {
    id,
    table,
    recordId,
    eventType,
    deviceId: 'dev-backup-test-001',
    timestamp: '2025-06-01T10:00:00.000Z',
    syncCounter: 1,
    changedFields: [],
    note: '',
    ...fields
  };
}

export function makeTombstoneForBackup(table, recordId, fields = {}) {
  return {
    id: `ts-${table}-${recordId}-backup`,
    table,
    recordId,
    deletedAt: '2025-05-15T00:00:00.000Z',
    deletedByDeviceId: 'dev-backup-test-001',
    summary: '测试删除',
    recordSnapshot: null,
    ...fields
  };
}

export function populatedBackupData() {
  const costumeIds = ['c-bak-001', 'c-bak-002', 'c-bak-003'];
  return makeValidBackupJSON({
    deviceId: 'dev-backup-populated',
    syncCounter: 25,
    costumes: [
      makeCostumeForBackup(costumeIds[0], { name: '红龙袍', size: 'XL' }),
      makeCostumeForBackup(costumeIds[1], { name: '蓝仙子裙', size: 'S', status: '借出' }),
      makeCostumeForBackup(costumeIds[2], { name: '古代书生服', size: 'M' })
    ],
    actors: [
      makeActorForBackup('a-bak-001', { name: '王大伟' }),
      makeActorForBackup('a-bak-002', { name: '刘小花' })
    ],
    records: [
      makeRecordForBackup('r-bak-001', costumeIds[1], { operator: '李主任' })
    ],
    reservations: [
      makeReservationForBackup('rv-bak-001', costumeIds[0])
    ],
    workOrders: [
      makeWorkOrderForBackup('w-bak-001', costumeIds[2])
    ],
    schedules: [
      makeScheduleForBackup('s-bak-001', { linkedCostumeIds: [costumeIds[0], costumeIds[2]] })
    ],
    syncEvents: [
      makeSyncEventForBackup('ev-bak-001', 'costumes', costumeIds[0], 'create'),
      makeSyncEventForBackup('ev-bak-002', 'costumes', costumeIds[1], 'update', {
        changedFields: ['status', 'borrower']
      })
    ],
    tombstones: []
  });
}

export function backupWithOldVersion(version) {
  const data = populatedBackupData();
  data._meta.version = version;
  return data;
}

export function legacyFormatBackup() {
  return [
    { id: 'c-legacy-001', name: '旧式汉服', play: '老剧目', size: 'M', status: '在库' },
    { id: 'c-legacy-002', name: '旧式旗袍', play: '老剧目', size: 'L', status: '借出' }
  ];
}

export function backupWithMissingTables() {
  return {
    _meta: {
      version: 10,
      exportedAt: '2025-06-01T12:00:00.000Z',
      app: 'zfl-2-costume-lending',
      deviceId: 'dev-backup-missing'
    },
    tables: {
      costumes: [makeCostumeForBackup('c-miss-001')]
    }
  };
}

export function backupWithInvalidReferences() {
  return makeValidBackupJSON({
    costumes: [makeCostumeForBackup('c-ref-001')],
    reservations: [
      makeReservationForBackup('rv-ref-001', 'c-ref-NONEXISTENT')
    ],
    workOrders: [
      makeWorkOrderForBackup('w-ref-001', 'c-ref-ANOTHER-BAD')
    ]
  });
}

export function backupWithSoftDeletedCostumes() {
  return makeValidBackupJSON({
    costumes: [
      makeCostumeForBackup('c-del-001', {
        name: '已删除服装',
        deletedAt: '2025-05-01T00:00:00.000Z',
        deletedByDeviceId: 'dev-backup-test-001',
        deleteSummary: '测试软删除'
      }),
      makeCostumeForBackup('c-active-001', { name: '活跃服装' })
    ],
    tombstones: [
      makeTombstoneForBackup('costumes', 'c-del-001')
    ]
  });
}

export function backupForIndexTest() {
  const costumes = [
    makeCostumeForBackup('c-idx-001', { name: '牡丹亭戏服', play: '牡丹亭', size: 'M', status: '在库', location: '1号柜' }),
    makeCostumeForBackup('c-idx-002', { name: '西厢记戏服', play: '西厢记', size: 'L', status: '借出', borrower: '张三', location: '2号柜' }),
    makeCostumeForBackup('c-idx-003', { name: '桃花扇戏服', play: '桃花扇', size: 'S', status: '清洗中', clean: '待洗', location: '3号柜' }),
    makeCostumeForBackup('c-idx-004', { name: '牡丹亭龙套', play: '牡丹亭', size: 'XL', status: '在库', location: '1号柜' }),
    makeCostumeForBackup('c-idx-005', { name: '红楼梦戏服', play: '红楼梦', size: 'M', status: '在库', location: '4号柜' })
  ];

  const schedules = [
    makeScheduleForBackup('s-idx-001', {
      play: '牡丹亭',
      date: '2025-06-20',
      time: '19:00',
      venue: '主剧场',
      linkedCostumeIds: ['c-idx-001', 'c-idx-004']
    }),
    makeScheduleForBackup('s-idx-002', {
      play: '西厢记',
      date: '2025-06-25',
      time: '19:30',
      venue: '实验剧场',
      linkedCostumeIds: ['c-idx-002']
    })
  ];

  return makeValidBackupJSON({
    costumes,
    schedules,
    actors: [makeActorForBackup('a-idx-001', { name: '演员A', play: '牡丹亭' })],
    workOrders: [makeWorkOrderForBackup('w-idx-001', 'c-idx-003', { status: '清洗中' })],
    reservations: [makeReservationForBackup('rv-idx-001', 'c-idx-001', { play: '牡丹亭', date: '2025-06-20' })],
    records: [makeRecordForBackup('r-idx-001', 'c-idx-002')]
  });
}
