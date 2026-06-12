<script>
  import { onMount } from 'svelte';
  import { Archive, CheckCircle2, Clock, Search, Shirt, Undo2, X, Trash2, Save, Download, Upload, AlertTriangle, CheckCircle, List, Plus, RotateCcw, Calendar, User, Users, XCircle, CalendarDays, Wrench, Droplets, Eye, MoreHorizontal, Package, Printer, Box, AlertOctagon, Database, RefreshCw, HardDrive, LayoutGrid, ClipboardList, ArrowRightLeft } from 'lucide-svelte';
  import {
    initializeDatabase,
    getAll,
    setAll,
    insertOne,
    updateOne,
    deleteOne,
    downloadBackup,
    readBackupFile,
    importFullDatabase,
    exportFullDatabase,
    getDBStats,
    isLegacyDataPresent,
    removeLegacyKeys,
    parseBackupFile,
    getFullDB,
    saveFullDB,
    updateLastMergeAt,
    TABLES,
    TABLE_LABELS
  } from '$lib/database.js';
  import ScheduleKanban from '$lib/ScheduleKanban.svelte';
  import { getAllSchedules } from '$lib/scheduleStore.js';
  import InventoryPanel from '$lib/InventoryPanel.svelte';
  import InventoryDetail from '$lib/InventoryDetail.svelte';
  import MergePanel from '$lib/MergePanel.svelte';
  import {
    computeFullDiff,
    createDefaultDecisions,
    applyMerge
  } from '$lib/mergeUtils.js';

  const now = new Date();
  const iso = (offset = 0) => {
    const date = new Date(now);
    date.setDate(date.getDate() + offset);
    return date.toISOString().slice(0, 10);
  };

  const seed = [
    { id: crypto.randomUUID(), name: '湖蓝长袍', size: 'M', play: '海上信笺', location: '二楼A柜', clean: '已清洗', borrower: '许舟', due: iso(-2), status: '借出', note: '领口需复查' },
    { id: crypto.randomUUID(), name: '旧式邮差外套', size: 'L', play: '海上信笺', location: '二楼B柜', clean: '待清洗', borrower: '', due: '', status: '在库', note: '' },
    { id: crypto.randomUUID(), name: '黑色燕尾服', size: 'XL', play: '午夜排练', location: '一楼贵重衣架', clean: '已清洗', borrower: '陈一', due: iso(3), status: '借出', note: '含配套领结' }
  ];

  const seedReservations = [
    { id: crypto.randomUUID(), costumeId: seed[1].id, costumeName: seed[1].name, play: seed[1].play, date: iso(5), type: '演员', reservedFor: '林婉', createdAt: new Date().toISOString(), status: 'active', note: '下午场排练使用' },
    { id: crypto.randomUUID(), costumeId: seed[1].id, costumeName: seed[1].name, play: seed[1].play, date: iso(10), type: '场次', reservedFor: '第三幕联排', createdAt: new Date().toISOString(), status: 'active', note: '' }
  ];

  const seedWorkOrders = [
    { id: crypto.randomUUID(), type: '清洗', costumeId: seed[1].id, costumeName: seed[1].name, play: seed[1].play, status: '待清洗', assignee: '张阿姨', dueDate: iso(2), note: '袖口有明显污渍，需要重点处理', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { id: crypto.randomUUID(), type: '维修', costumeId: seed[0].id, costumeName: seed[0].name, play: seed[0].play, status: '维修中', assignee: '李师傅', dueDate: iso(5), note: '领口脱线，需要缝补', createdAt: new Date(Date.now() - 86400000).toISOString(), updatedAt: new Date().toISOString() }
  ];

  const seedActors = [
    { id: crypto.randomUUID(), name: '许舟', size: 'M', plays: ['海上信笺'], note: '身材匀称，偏好稍宽松版型' },
    { id: crypto.randomUUID(), name: '陈一', size: 'XL', plays: ['午夜排练'], note: '' },
    { id: crypto.randomUUID(), name: '林婉', size: 'S', plays: ['海上信笺', '午夜排练'], note: '身高162，肩膀较窄' }
  ];

  const seedPackingLists = [
    {
      id: crypto.randomUUID(),
      play: '海上信笺',
      performanceDate: iso(3),
      name: '首演装箱单',
      note: '首演全套服装，含配饰',
      createdAt: new Date().toISOString(),
      items: [
        { costumeId: seed[0].id, costumeName: seed[0].name, size: seed[0].size, location: seed[0].location, status: '已打包', note: '' },
        { costumeId: seed[1].id, costumeName: seed[1].name, size: seed[1].size, location: seed[1].location, status: '需清洗', note: '袖口有污渍' }
      ]
    }
  ];

  let costumes = seed;
  let reservations = seedReservations;
  let workOrders = seedWorkOrders;
  let actors = seedActors;
  let packingLists = seedPackingLists;
  let schedules = [];
  let packingListQuery = '';
  let packingListFilter = '全部';
  let showPackingListModal = false;
  let editingPackingListId = null;
  let selectedPackingListId = null;
  let showPackingListDetail = false;
  let isPrintingPackingList = false;
  let creatingPackingList = false;
  let packingListForm = {
    play: '',
    performanceDate: iso(1),
    name: '',
    note: '',
    items: []
  };
  let packingAddCostumeQuery = '';
  let packingAddCostumePlayFilter = '全部剧目';
  let query = '';
  let playFilter = '全部剧目';
  let showOverdue = false;
  let form = { name: '', size: '', play: '', location: '', clean: '已清洗', borrower: '', due: '', status: '在库', note: '' };
  let selectedId = null;
  let editForm = { name: '', size: '', play: '', location: '', clean: '已清洗', note: '' };
  let showDeleteConfirm = false;
  let showImportModal = false;
  let importPreview = [];
  let importSkipped = [];
  let importFile = null;
  let records = [];
  let recordQuery = '';
  let lendingId = null;
  let lendingBorrower = '';
  let reservingId = null;
  let reservationForm = { date: iso(1), type: '演员', reservedFor: '', note: '' };
  let reservationQuery = '';
  let reservationFilter = '全部';
  let workOrderQuery = '';
  let workOrderFilter = '全部';
  let workOrderTypeFilter = '全部';
  let showWorkOrderModal = false;
  let editingWorkOrderId = null;
  let selectedWorkOrderId = null;
  let creatingWorkOrder = false;
  let workOrderCostumeId = null;
  let workOrderForm = {
    type: '清洗',
    costumeId: '',
    costumeName: '',
    play: '',
    status: '待清洗',
    assignee: '',
    dueDate: iso(3),
    note: ''
  };
  let actorForm = { name: '', size: '', plays: '', note: '' };
  let actorQuery = '';
  let selectedActorId = null;
  let editActorForm = { name: '', size: '', plays: '', note: '' };
  let showDeleteActorConfirm = false;
  let lendingActorId = '';

  let inventoryTasks = [];
  let showInventoryDetail = false;
  let selectedInventoryTaskId = null;
  let inventoryPanelRef = null;

  let dbStats = null;
  let showDataManager = false;
  let showScheduleKanban = false;
  let restorePreview = null;
  let restoreFileContent = '';
  let restoreError = '';
  let dbMigrationNotice = '';

  let showMergePanel = false;
  let mergeFileName = '';
  let mergeImportDB = null;
  let mergeDiffResult = null;
  let mergeDecisions = {};
  let mergeError = '';
  let mergeSuccess = '';

  onMount(() => {
    const hadLegacy = isLegacyDataPresent();
    const db = initializeDatabase();
    costumes = db.tables[TABLES.costumes] || [];
    records = db.tables[TABLES.records] || [];
    reservations = db.tables[TABLES.reservations] || [];
    workOrders = db.tables[TABLES.workOrders] || [];
    actors = db.tables[TABLES.actors] || [];
    packingLists = db.tables[TABLES.packingLists] || [];
    schedules = db.tables[TABLES.schedules] || [];
    inventoryTasks = db.tables[TABLES.inventoryTasks] || [];
    dbStats = getDBStats();
    if (hadLegacy && db.migratedAt) {
      dbMigrationNotice = '检测到旧版数据已自动迁移到新版数据层，可在数据管理中查看详情。';
    }

    document.addEventListener('select-task', handleSelectInventoryTask);
    document.addEventListener('inventory-updated', handleInventoryUpdated);
  });

  function handleSelectInventoryTask(e) {
    selectedInventoryTaskId = e.detail;
    showInventoryDetail = true;
  }

  function handleInventoryUpdated() {
    const db = initializeDatabase();
    costumes = db.tables[TABLES.costumes] || [];
    records = db.tables[TABLES.records] || [];
    reservations = db.tables[TABLES.reservations] || [];
    workOrders = db.tables[TABLES.workOrders] || [];
    actors = db.tables[TABLES.actors] || [];
    packingLists = db.tables[TABLES.packingLists] || [];
    schedules = db.tables[TABLES.schedules] || [];
    inventoryTasks = db.tables[TABLES.inventoryTasks] || [];
    refreshDBStats();
    inventoryPanelRef?.refresh?.();
  }

  function closeInventoryDetail() {
    showInventoryDetail = false;
    selectedInventoryTaskId = null;
    const db = initializeDatabase();
    costumes = db.tables[TABLES.costumes] || [];
    records = db.tables[TABLES.records] || [];
    workOrders = db.tables[TABLES.workOrders] || [];
    inventoryTasks = db.tables[TABLES.inventoryTasks] || [];
    refreshDBStats();
  }

  let localStorageAvailable = typeof localStorage !== 'undefined';

  function persist() {
    setAll(TABLES.costumes, costumes);
  }

  function persistRecords() {
    setAll(TABLES.records, records);
  }

  function persistReservations() {
    setAll(TABLES.reservations, reservations);
  }

  function persistWorkOrders() {
    setAll(TABLES.workOrders, workOrders);
  }

  function persistActors() {
    setAll(TABLES.actors, actors);
  }

  function persistPackingLists() {
    setAll(TABLES.packingLists, packingLists);
  }

  function persistSchedules() {
    setAll(TABLES.schedules, schedules);
  }

  function handleScheduleChange() {
    schedules = getAllSchedules();
    refreshDBStats();
  }

  function refreshDBStats() {
    dbStats = getDBStats();
  }

  async function handleRestoreFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    restoreError = '';
    restorePreview = null;
    restoreFileContent = '';
    const content = await readBackupFile(file);
    if (!content) {
      restoreError = '无法读取文件内容';
      e.target.value = '';
      return;
    }
    let data;
    try {
      data = JSON.parse(content);
    } catch (err) {
      restoreError = 'JSON 解析失败，请检查文件格式';
      e.target.value = '';
      return;
    }
    if (!data || !data.tables || typeof data.tables !== 'object') {
      if (Array.isArray(data)) {
        restorePreview = {
          fileName: file.name,
          version: null,
          legacyFormat: true,
          costumeCount: data.length,
          tables: {}
        };
        restoreFileContent = content;
      } else {
        restoreError = '无法识别的备份文件格式';
      }
      e.target.value = '';
      return;
    }
    restoreFileContent = content;
    restorePreview = {
      fileName: file.name,
      version: data._meta?.version || null,
      legacyFormat: false,
      tables: {}
    };
    for (const table of Object.values(TABLES)) {
      restorePreview.tables[table] = Array.isArray(data.tables[table]) ? data.tables[table].length : 0;
    }
    e.target.value = '';
  }

  function confirmRestore() {
    if (!restorePreview || !restoreFileContent) return;
    if (!confirm('恢复将覆盖当前所有数据，确定继续吗？此操作不可撤销。')) return;
    if (restorePreview.legacyFormat) {
      try {
        const arr = JSON.parse(restoreFileContent);
        if (Array.isArray(arr)) {
          const empty = initializeDatabase();
          empty.tables[TABLES.costumes] = arr;
          const result = importFullDatabase(JSON.stringify({ tables: empty.tables }));
          if (!result.ok) {
            restoreError = result.error;
            return;
          }
        }
      } catch (e) {
        restoreError = `恢复失败：${e.message}`;
        return;
      }
    } else {
      const result = importFullDatabase(restoreFileContent);
      if (!result.ok) {
        restoreError = result.error;
        return;
      }
    }
    const db = initializeDatabase();
    costumes = db.tables[TABLES.costumes] || [];
    records = db.tables[TABLES.records] || [];
    reservations = db.tables[TABLES.reservations] || [];
    workOrders = db.tables[TABLES.workOrders] || [];
    actors = db.tables[TABLES.actors] || [];
    packingLists = db.tables[TABLES.packingLists] || [];
    schedules = db.tables[TABLES.schedules] || [];
    inventoryTasks = db.tables[TABLES.inventoryTasks] || [];
    refreshDBStats();
    closeDataManager();
  }

  function clearRestorePreview() {
    restorePreview = null;
    restoreFileContent = '';
    restoreError = '';
  }

  async function handleMergeFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    mergeError = '';
    mergeSuccess = '';
    mergeFileName = file.name;
    const content = await readBackupFile(file);
    if (!content) {
      mergeError = '无法读取文件内容';
      e.target.value = '';
      return;
    }
    const parsed = parseBackupFile(content);
    if (!parsed.ok) {
      mergeError = parsed.error;
      e.target.value = '';
      return;
    }
    if (parsed.legacyFormat) {
      mergeError = '旧版仅服装格式不支持合并导入，请使用「恢复数据（覆盖）」或导出新版完整备份后再合并。';
      e.target.value = '';
      return;
    }
    const currentDB = getFullDB();
    mergeImportDB = parsed.db;
    mergeDiffResult = computeFullDiff(currentDB, parsed.db);
    mergeDecisions = createDefaultDecisions(mergeDiffResult);
    showDataManager = false;
    showMergePanel = true;
    e.target.value = '';
  }

  function closeMergePanel() {
    showMergePanel = false;
    mergeImportDB = null;
    mergeDiffResult = null;
    mergeDecisions = {};
    mergeFileName = '';
    mergeError = '';
  }

  function handleConfirmMerge(finalDecisions) {
    if (!mergeDiffResult || !mergeImportDB) return;
    if (!confirm('确认执行合并？合并将更新当前数据库，建议先导出完整备份。')) return;
    try {
      const currentDB = getFullDB();
      const { db: mergedDB, costumeIdMap } = applyMerge(currentDB, mergeImportDB, mergeDiffResult, finalDecisions);
      saveFullDB(mergedDB);
      updateLastMergeAt();
      const fresh = initializeDatabase();
      costumes = fresh.tables[TABLES.costumes] || [];
      records = fresh.tables[TABLES.records] || [];
      reservations = fresh.tables[TABLES.reservations] || [];
      workOrders = fresh.tables[TABLES.workOrders] || [];
      actors = fresh.tables[TABLES.actors] || [];
      packingLists = fresh.tables[TABLES.packingLists] || [];
      schedules = fresh.tables[TABLES.schedules] || [];
      inventoryTasks = fresh.tables[TABLES.inventoryTasks] || [];
      inventoryItems = fresh.tables[TABLES.inventoryItems] || [];
      refreshDBStats();
      closeMergePanel();
      const idRemapCount = Object.keys(costumeIdMap).length;
      const deletedCostumeCount = (mergeDiffResult.tables[TABLES.costumes]?.deleted_suspect || []).filter(
        (item) => finalDecisions[TABLES.costumes]?.[item.id]?.choice === 'use_import'
      ).length;
      let msg = '合并成功！';
      if (idRemapCount > 0) msg += ` 已同步修正 ${idRemapCount} 个服装ID引用。`;
      if (deletedCostumeCount > 0) msg += ` 已删除 ${deletedCostumeCount} 个服装并清理其悬空引用。`;
      mergeSuccess = msg;
      setTimeout(() => { mergeSuccess = ''; }, 6000);
    } catch (err) {
      mergeError = `合并失败：${err.message}`;
    }
  }

  function openDataManager() {
    refreshDBStats();
    clearRestorePreview();
    showDataManager = true;
  }

  function closeDataManager() {
    showDataManager = false;
    clearRestorePreview();
  }

  function dismissMigrationNotice() {
    dbMigrationNotice = '';
  }

  function cleanLegacyData() {
    if (!confirm('确定要清除旧版 localStorage 数据吗？新版数据层已独立保存，清除后不可恢复。')) return;
    removeLegacyKeys();
    refreshDBStats();
  }

  const packingItemStatuses = ['未标记', '已打包', '缺失', '需清洗', '已归还'];

  function getCostumeAlert(costumeId) {
    const costume = costumes.find((c) => c.id === costumeId);
    if (!costume) return null;
    const alerts = [];
    if (costume.status === '借出') {
      const isOverdue = costume.due && new Date(costume.due) < new Date(iso(0));
      if (isOverdue) {
        alerts.push({ type: 'overdue', label: `逾期未还：${costume.borrower}，应还${costume.due}` });
      } else {
        alerts.push({ type: 'borrowed', label: `已借出：${costume.borrower}，至${costume.due}` });
      }
    }
    const activeWO = getActiveWorkOrder(costumeId);
    if (activeWO) {
      alerts.push({ type: 'workorder', label: `${activeWO.type}中：${activeWO.status}，负责人${activeWO.assignee}` });
    } else if (costume.clean === '维修中') {
      alerts.push({ type: 'workorder', label: '档案状态：维修中' });
    } else if (costume.clean === '待清洗') {
      alerts.push({ type: 'workorder', label: '档案状态：待清洗' });
    }
    return alerts.length > 0 ? alerts : null;
  }

  function openCreatePackingList() {
    creatingPackingList = true;
    editingPackingListId = null;
    packingListForm = {
      play: '',
      performanceDate: iso(1),
      name: '',
      note: '',
      items: []
    };
    packingAddCostumeQuery = '';
    packingAddCostumePlayFilter = '全部剧目';
    showPackingListModal = true;
  }

  function openEditPackingList(id) {
    const list = packingLists.find((pl) => pl.id === id);
    if (!list) return;
    creatingPackingList = false;
    editingPackingListId = id;
    const itemsWithRisks = list.items.map((item) => {
      const alerts = getCostumeAlert(item.costumeId);
      return {
        ...item,
        source: item.source || '手动添加',
        risks: alerts || []
      };
    });
    packingListForm = {
      play: list.play,
      performanceDate: list.performanceDate,
      name: list.name,
      note: list.note,
      items: itemsWithRisks,
      sourceScheduleId: list.sourceScheduleId || null,
      generatedAt: list.generatedAt || null
    };
    packingAddCostumeQuery = '';
    packingAddCostumePlayFilter = list.play || '全部剧目';
    showPackingListModal = true;
  }

  function closePackingListModal() {
    showPackingListModal = false;
    creatingPackingList = false;
    editingPackingListId = null;
  }

  function addCostumeToPackingList(costume) {
    if (packingListForm.items.find((item) => item.costumeId === costume.id)) return;
    const alerts = getCostumeAlert(costume.id);
    packingListForm.items = [
      ...packingListForm.items,
      {
        costumeId: costume.id,
        costumeName: costume.name,
        size: costume.size,
        location: costume.location,
        status: '未标记',
        note: '',
        source: '手动添加',
        risks: alerts || []
      }
    ];
  }

  function removeCostumeFromPackingList(costumeId) {
    packingListForm.items = packingListForm.items.filter((item) => item.costumeId !== costumeId);
  }

  function updatePackingItemStatus(listId, costumeId, status) {
    packingLists = packingLists.map((pl) => {
      if (pl.id !== listId) return pl;
      return {
        ...pl,
        items: pl.items.map((item) => item.costumeId === costumeId ? { ...item, status } : item)
      };
    });
    persistPackingLists();
  }

  function updatePackingItemNote(listId, costumeId, note) {
    packingLists = packingLists.map((pl) => {
      if (pl.id !== listId) return pl;
      return {
        ...pl,
        items: pl.items.map((item) => item.costumeId === costumeId ? { ...item, note } : item)
      };
    });
    persistPackingLists();
  }

  function savePackingList() {
    if (!packingListForm.play.trim() || !packingListForm.performanceDate) return;

    const cleanItems = packingListForm.items.map((item) => ({
      costumeId: item.costumeId,
      costumeName: item.costumeName,
      size: item.size,
      location: item.location,
      status: item.status,
      note: item.note,
      source: item.source || '手动添加'
    }));

    if (creatingPackingList) {
      const newList = {
        id: crypto.randomUUID(),
        play: packingListForm.play.trim(),
        performanceDate: packingListForm.performanceDate,
        name: packingListForm.name.trim() || `${packingListForm.play} - ${packingListForm.performanceDate}`,
        note: packingListForm.note.trim(),
        createdAt: new Date().toISOString(),
        items: cleanItems,
        sourceScheduleId: packingListForm.sourceScheduleId || null,
        generatedAt: packingListForm.generatedAt || null
      };
      packingLists = [newList, ...packingLists];
      persistPackingLists();
      const riskCount = cleanItems.filter(i => i.status === '缺失' || i.status === '需清洗').length;
      let summary = `创建装箱单「${newList.name}」，剧目：${newList.play}，演出日期：${newList.performanceDate}，共${newList.items.length}件服装`;
      if (packingListForm.sourceScheduleId) {
        summary += '（由排期一键生成）';
      }
      if (riskCount > 0) {
        summary += `，其中${riskCount}件存在风险（缺失/需清洗）`;
      }
      addRecord('装箱单创建', { name: newList.name, play: newList.play }, '系统', summary);
    } else if (editingPackingListId) {
      packingLists = packingLists.map((pl) => pl.id === editingPackingListId ? {
        ...pl,
        play: packingListForm.play.trim(),
        performanceDate: packingListForm.performanceDate,
        name: packingListForm.name.trim() || `${packingListForm.play} - ${packingListForm.performanceDate}`,
        note: packingListForm.note.trim(),
        items: cleanItems
      } : pl);
      persistPackingLists();
    }
    closePackingListModal();
  }

  function deletePackingList(id) {
    const list = packingLists.find((pl) => pl.id === id);
    if (!list) return;
    if (!confirm(`确定要删除装箱单「${list.name}」吗？此操作不可撤销。`)) return;
    packingLists = packingLists.filter((pl) => pl.id !== id);
    persistPackingLists();
    if (selectedPackingListId === id) {
      selectedPackingListId = null;
      showPackingListDetail = false;
    }
    addRecord('装箱单删除', { name: list.name, play: list.play }, '系统', `删除装箱单「${list.name}」`);
  }

  function handleGeneratePackingListFromSchedule(e) {
    const draft = e.detail;
    if (!draft) return;

    const existing = packingLists.find(
      (pl) => pl.play === draft.play && pl.performanceDate === draft.performanceDate
    );
    if (existing) {
      if (!confirm(`检测到已存在同剧目同日期的装箱单「${existing.name}」。\n\n是否基于排期数据创建一个新的装箱单？\n\n点击「确定」创建新装箱单，点击「取消」打开已有装箱单进行编辑。`)) {
        openEditPackingList(existing.id);
        return;
      }
    }

    creatingPackingList = true;
    editingPackingListId = null;
    packingListForm = {
      play: draft.play,
      performanceDate: draft.performanceDate,
      name: draft.name,
      note: draft.note,
      items: draft.items.map((item) => ({
        costumeId: item.costumeId,
        costumeName: item.costumeName,
        size: item.size,
        location: item.location,
        status: item.status,
        note: item.note,
        source: item.source,
        risks: item.risks
      })),
      sourceScheduleId: draft.sourceScheduleId,
      generatedAt: draft.generatedAt
    };
    packingAddCostumeQuery = '';
    packingAddCostumePlayFilter = draft.play || '全部剧目';
    showPackingListModal = true;
    showScheduleKanban = false;
  }

  function openPackingListDetail(id) {
    selectedPackingListId = id;
    showPackingListDetail = true;
    isPrintingPackingList = false;
  }

  function closePackingListDetail() {
    showPackingListDetail = false;
    selectedPackingListId = null;
    isPrintingPackingList = false;
  }

  function printPackingList() {
    isPrintingPackingList = true;
    setTimeout(() => {
      window.print();
      isPrintingPackingList = false;
    }, 100);
  }

  function getPackingStatusClass(status) {
    if (status === '已打包') return 'packing-status-packed';
    if (status === '缺失') return 'packing-status-missing';
    if (status === '需清洗') return 'packing-status-clean';
    if (status === '已归还') return 'packing-status-returned';
    return 'packing-status-pending';
  }

  const sizeOrder = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'];

  function parseSize(sizeStr) {
    if (!sizeStr) return null;
    const s = sizeStr.trim().toUpperCase();
    const idx = sizeOrder.indexOf(s);
    if (idx >= 0) return idx;
    const numMatch = s.match(/(\d+)/);
    if (numMatch) {
      const num = parseInt(numMatch[1]);
      if (num >= 150 && num <= 200) return Math.round((num - 150) / 10);
    }
    return null;
  }

  function matchSize(costumeSize, actorSize) {
    const c = parseSize(costumeSize);
    const a = parseSize(actorSize);
    if (c === null || a === null) return { level: 'unknown', label: '尺码信息不全', diff: 0 };
    const diff = c - a;
    if (diff === 0) return { level: 'perfect', label: '尺码完全匹配', diff: 0 };
    if (Math.abs(diff) === 1) return { level: diff > 0 ? 'loose' : 'tight', label: diff > 0 ? '服装稍大' : '服装稍小', diff };
    return { level: 'mismatch', label: diff > 0 ? '服装过大' : '服装过小', diff };
  }

  function getActorById(id) {
    return actors.find((a) => a.id === id);
  }

  function getActorsByPlay(play) {
    return actors.filter((a) => Array.isArray(a.plays) && a.plays.includes(play));
  }

  function getMatchBadgeClass(level) {
    if (level === 'perfect') return 'match-perfect';
    if (level === 'loose' || level === 'tight') return 'match-close';
    if (level === 'mismatch') return 'match-mismatch';
    return 'match-unknown';
  }

  function getActiveWorkOrder(costumeId) {
    return workOrders.find((wo) => wo.costumeId === costumeId && (wo.status === '待清洗' || wo.status === '清洗中' || wo.status === '待维修' || wo.status === '维修中'));
  }

  function canLend(costumeId) {
    const costume = costumes.find((c) => c.id === costumeId);
    if (!costume) return { can: false, reason: '服装不存在' };
    if (costume.status === '借出') return { can: false, reason: '该服装已借出' };
    if (costume.clean === '待清洗') return { can: false, reason: '该服装待清洗，请先完成清洗' };
    if (costume.clean === '维修中') return { can: false, reason: '该服装维修中，请先完成维修' };
    const activeWO = getActiveWorkOrder(costumeId);
    if (activeWO) return { can: false, reason: `该服装${activeWO.type}中，请先完成${activeWO.type}工单` };
    return { can: true, reason: '' };
  }

  function checkConflict(costumeId, date, excludeId = null) {
    const costume = costumes.find((c) => c.id === costumeId);
    const conflicts = [];
    if (costume && costume.status === '借出') {
      const today = new Date(iso(0));
      const targetDate = new Date(date);
      if (costume.due) {
        const borrowDue = new Date(costume.due);
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
    const activeWorkOrder = getActiveWorkOrder(costumeId);
    if (activeWorkOrder) {
      conflicts.push({ type: activeWorkOrder.type, detail: `${activeWorkOrder.type}中，负责人：${activeWorkOrder.assignee || '未分配'}，预计完成：${activeWorkOrder.dueDate}` });
    }
    reservations.forEach((r) => {
      if (r.status !== 'active') return;
      if (excludeId && r.id === excludeId) return;
      if (r.costumeId === costumeId && r.date === date) {
        conflicts.push({ type: '预约', detail: `${r.type}：${r.reservedFor}（${r.date}）` });
      }
    });
    return conflicts;
  }

  function createWorkOrder(type, costume, assignee = '', note = '') {
    const initialStatus = type === '清洗' ? '待清洗' : '待维修';
    const workOrder = {
      id: crypto.randomUUID(),
      type,
      costumeId: costume.id,
      costumeName: costume.name,
      play: costume.play,
      status: initialStatus,
      assignee: assignee || (type === '清洗' ? '张阿姨' : '李师傅'),
      dueDate: iso(type === '清洗' ? 2 : 5),
      note,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    workOrders = [workOrder, ...workOrders];
    persistWorkOrders();
    addRecord('工单创建', costume, '系统', `创建${type}工单「${workOrder.id.slice(0, 8)}」，状态：${initialStatus}，负责人：${workOrder.assignee}`);

    if (type === '清洗') {
      const costumeToUpdate = costumes.find((c) => c.id === costume.id);
      if (costumeToUpdate && costumeToUpdate.clean !== '待清洗') {
        costumes = costumes.map((c) => c.id === costume.id ? { ...c, clean: '待清洗' } : c);
        persist();
        addRecord('清洗', costumeToUpdate, '系统', `「${costumeToUpdate.name}」清洗状态变更为「待清洗」`);
      }
    } else if (type === '维修') {
      const costumeToUpdate = costumes.find((c) => c.id === costume.id);
      if (costumeToUpdate && costumeToUpdate.clean !== '维修中') {
        costumes = costumes.map((c) => c.id === costume.id ? { ...c, clean: '维修中' } : c);
        persist();
        addRecord('清洗', costumeToUpdate, '系统', `「${costumeToUpdate.name}」状态变更为「维修中」`);
      }
    }

    return workOrder;
  }

  function updateWorkOrderStatus(id, newStatus) {
    const workOrder = workOrders.find((wo) => wo.id === id);
    if (!workOrder) return;
    const costume = { name: workOrder.costumeName, play: workOrder.play };
    workOrders = workOrders.map((wo) => wo.id === id ? { ...wo, status: newStatus, updatedAt: new Date().toISOString() } : wo);
    persistWorkOrders();
    addRecord('工单更新', costume, '系统', `工单「${id.slice(0, 8)}」状态从「${workOrder.status}」变更为「${newStatus}」`);

    if (newStatus === '已完成' && workOrder.type === '清洗') {
      const costumeToUpdate = costumes.find((c) => c.id === workOrder.costumeId);
      if (costumeToUpdate && costumeToUpdate.clean === '待清洗') {
        costumes = costumes.map((c) => c.id === workOrder.costumeId ? { ...c, clean: '已清洗' } : c);
        persist();
        addRecord('清洗', costumeToUpdate, '系统', `「${costumeToUpdate.name}」清洗状态从「待清洗」变更为「已清洗」`);
      }
    }

    if (newStatus === '已完成' && workOrder.type === '维修') {
      const costumeToUpdate = costumes.find((c) => c.id === workOrder.costumeId);
      if (costumeToUpdate && costumeToUpdate.clean === '维修中') {
        costumes = costumes.map((c) => c.id === workOrder.costumeId ? { ...c, clean: '已清洗' } : c);
        persist();
        addRecord('清洗', costumeToUpdate, '系统', `「${costumeToUpdate.name}」维修完成，状态变更为「已清洗」`);
      }
    }

    if (newStatus === '已取消') {
      const costumeToUpdate = costumes.find((c) => c.id === workOrder.costumeId);
      if (costumeToUpdate) {
        const otherActiveWO = workOrders.find((wo) => wo.costumeId === workOrder.costumeId && wo.id !== id && (wo.status === '待清洗' || wo.status === '清洗中' || wo.status === '待维修' || wo.status === '维修中'));
        if (!otherActiveWO) {
          let newCleanStatus = '已清洗';
          if (costumeToUpdate.clean === '待清洗' || costumeToUpdate.clean === '维修中') {
            newCleanStatus = '已清洗';
          }
          costumes = costumes.map((c) => c.id === workOrder.costumeId ? { ...c, clean: newCleanStatus } : c);
          persist();
          addRecord('清洗', costumeToUpdate, '系统', `工单取消，「${costumeToUpdate.name}」状态变更为「${newCleanStatus}」`);
        }
      }
    }
  }

  function openCreateWorkOrder(costumeId = null, type = '维修') {
    creatingWorkOrder = true;
    editingWorkOrderId = null;
    const initialStatus = type === '清洗' ? '待清洗' : '待维修';
    if (costumeId) {
      const costume = costumes.find((c) => c.id === costumeId);
      if (costume) {
        workOrderForm = {
          type,
          costumeId: costume.id,
          costumeName: costume.name,
          play: costume.play,
          status: initialStatus,
          assignee: type === '清洗' ? '张阿姨' : '李师傅',
          dueDate: iso(type === '清洗' ? 2 : 5),
          note: ''
        };
      }
    } else {
      workOrderForm = {
        type,
        costumeId: '',
        costumeName: '',
        play: '',
        status: initialStatus,
        assignee: type === '清洗' ? '张阿姨' : '李师傅',
        dueDate: iso(type === '清洗' ? 2 : 5),
        note: ''
      };
    }
    showWorkOrderModal = true;
  }

  function openEditWorkOrder(id) {
    const workOrder = workOrders.find((wo) => wo.id === id);
    if (!workOrder) return;
    creatingWorkOrder = false;
    editingWorkOrderId = id;
    workOrderForm = { ...workOrder };
    showWorkOrderModal = true;
  }

  function closeWorkOrderModal() {
    showWorkOrderModal = false;
    creatingWorkOrder = false;
    editingWorkOrderId = null;
    selectedWorkOrderId = null;
  }

  function saveWorkOrder() {
    if (!workOrderForm.costumeId || !workOrderForm.assignee.trim()) return;

    if (creatingWorkOrder) {
      const costume = costumes.find((c) => c.id === workOrderForm.costumeId);
      if (!costume) return;
      const workOrder = {
        id: crypto.randomUUID(),
        ...workOrderForm,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      workOrders = [workOrder, ...workOrders];
      persistWorkOrders();
      addRecord('工单创建', costume, '系统', `创建${workOrder.type}工单「${workOrder.id.slice(0, 8)}」，状态：${workOrder.status}，负责人：${workOrder.assignee}`);

      if (workOrder.type === '清洗' && (workOrder.status === '待清洗' || workOrder.status === '清洗中')) {
        costumes = costumes.map((c) => c.id === costume.id ? { ...c, clean: '待清洗' } : c);
        persist();
        addRecord('清洗', costume, '系统', `「${costume.name}」清洗状态变更为「待清洗」`);
      } else if (workOrder.type === '维修' && (workOrder.status === '待维修' || workOrder.status === '维修中')) {
        costumes = costumes.map((c) => c.id === costume.id ? { ...c, clean: '维修中' } : c);
        persist();
        addRecord('清洗', costume, '系统', `「${costume.name}」状态变更为「维修中」`);
      }
    } else if (editingWorkOrderId) {
      const oldWorkOrder = workOrders.find((wo) => wo.id === editingWorkOrderId);
      if (oldWorkOrder && oldWorkOrder.status !== workOrderForm.status) {
        const costume = { name: oldWorkOrder.costumeName, play: oldWorkOrder.play };
        addRecord('工单更新', costume, '系统', `工单「${editingWorkOrderId.slice(0, 8)}」状态从「${oldWorkOrder.status}」变更为「${workOrderForm.status}」`);
      }
      workOrders = workOrders.map((wo) => wo.id === editingWorkOrderId ? { ...wo, ...workOrderForm, updatedAt: new Date().toISOString() } : wo);
      persistWorkOrders();

      if (workOrderForm.status === '已完成' && workOrderForm.type === '清洗') {
        const costumeToUpdate = costumes.find((c) => c.id === workOrderForm.costumeId);
        if (costumeToUpdate && costumeToUpdate.clean === '待清洗') {
          costumes = costumes.map((c) => c.id === workOrderForm.costumeId ? { ...c, clean: '已清洗' } : c);
          persist();
          addRecord('清洗', costumeToUpdate, '系统', `「${costumeToUpdate.name}」清洗状态从「待清洗」变更为「已清洗」`);
        }
      }

      if (workOrderForm.status === '已完成' && workOrderForm.type === '维修') {
        const costumeToUpdate = costumes.find((c) => c.id === workOrderForm.costumeId);
        if (costumeToUpdate && costumeToUpdate.clean === '维修中') {
          costumes = costumes.map((c) => c.id === workOrderForm.costumeId ? { ...c, clean: '已清洗' } : c);
          persist();
          addRecord('清洗', costumeToUpdate, '系统', `「${costumeToUpdate.name}」维修完成，状态变更为「已清洗」`);
        }
      }

      if ((workOrderForm.status === '待清洗' || workOrderForm.status === '清洗中') && workOrderForm.type === '清洗') {
        const costumeToUpdate = costumes.find((c) => c.id === workOrderForm.costumeId);
        if (costumeToUpdate && costumeToUpdate.clean !== '待清洗') {
          costumes = costumes.map((c) => c.id === workOrderForm.costumeId ? { ...c, clean: '待清洗' } : c);
          persist();
          addRecord('清洗', costumeToUpdate, '系统', `「${costumeToUpdate.name}」清洗状态变更为「待清洗」`);
        }
      }

      if ((workOrderForm.status === '待维修' || workOrderForm.status === '维修中') && workOrderForm.type === '维修') {
        const costumeToUpdate = costumes.find((c) => c.id === workOrderForm.costumeId);
        if (costumeToUpdate && costumeToUpdate.clean !== '维修中') {
          costumes = costumes.map((c) => c.id === workOrderForm.costumeId ? { ...c, clean: '维修中' } : c);
          persist();
          addRecord('清洗', costumeToUpdate, '系统', `「${costumeToUpdate.name}」状态变更为「维修中」`);
        }
      }

      if (workOrderForm.status === '已取消') {
        const costumeToUpdate = costumes.find((c) => c.id === workOrderForm.costumeId);
        if (costumeToUpdate) {
          const otherActiveWO = workOrders.find((wo) => wo.costumeId === workOrderForm.costumeId && wo.id !== editingWorkOrderId && (wo.status === '待清洗' || wo.status === '清洗中' || wo.status === '待维修' || wo.status === '维修中'));
          if (!otherActiveWO) {
            costumes = costumes.map((c) => c.id === workOrderForm.costumeId ? { ...c, clean: '已清洗' } : c);
            persist();
            addRecord('清洗', costumeToUpdate, '系统', `工单取消，「${costumeToUpdate.name}」状态变更为「已清洗」`);
          }
        }
      }
    }
    closeWorkOrderModal();
  }

  function openWorkOrderDetail(id) {
    selectedWorkOrderId = id;
  }

  function closeWorkOrderDetail() {
    selectedWorkOrderId = null;
  }

  function getAvailableStatuses(workOrder) {
    if (workOrder.type === '清洗') {
      if (workOrder.status === '待清洗') return ['待清洗', '清洗中', '已完成', '已取消'];
      if (workOrder.status === '清洗中') return ['清洗中', '已完成', '已取消'];
    } else {
      if (workOrder.status === '待维修') return ['待维修', '维修中', '已完成', '已取消'];
      if (workOrder.status === '维修中') return ['维修中', '已完成', '已取消'];
    }
    return [workOrder.status];
  }

  function getUpcomingReservations(costumeId) {
    const today = iso(0);
    return reservations
      .filter((r) => r.costumeId === costumeId && r.status === 'active' && r.date >= today)
      .sort((a, b) => new Date(a.date) - new Date(b.date));
  }

  function getLatestReservation(costumeId) {
    const upcoming = getUpcomingReservations(costumeId);
    return upcoming.length > 0 ? upcoming[0] : null;
  }

  function openReserve(id) {
    reservingId = id;
    reservationForm = { date: iso(1), type: '演员', reservedFor: '', note: '' };
  }

  function closeReserve() {
    reservingId = null;
    reservationForm = { date: iso(1), type: '演员', reservedFor: '', note: '' };
  }

  function confirmReserve() {
    if (!reservationForm.reservedFor.trim() || !reservationForm.date) return;
    const costume = costumes.find((c) => c.id === reservingId);
    if (!costume) return;
    const conflicts = checkConflict(reservingId, reservationForm.date);
    if (conflicts.length > 0) return;
    const reservation = {
      id: crypto.randomUUID(),
      costumeId: costume.id,
      costumeName: costume.name,
      play: costume.play,
      date: reservationForm.date,
      type: reservationForm.type,
      reservedFor: reservationForm.reservedFor.trim(),
      createdAt: new Date().toISOString(),
      status: 'active',
      note: reservationForm.note.trim()
    };
    reservations = [reservation, ...reservations];
    persistReservations();
    addRecord('预约', costume, reservationForm.reservedFor.trim(), `预约「${costume.name}」于${reservationForm.date}，${reservationForm.type}：${reservationForm.reservedFor.trim()}`);
    closeReserve();
  }

  function cancelReservation(id) {
    const reservation = reservations.find((r) => r.id === id);
    if (!reservation) return;
    reservations = reservations.map((r) => r.id === id ? { ...r, status: 'cancelled' } : r);
    persistReservations();
    const costume = { name: reservation.costumeName, play: reservation.play };
    addRecord('取消预约', costume, '系统', `取消「${reservation.costumeName}」于${reservation.date}的预约（${reservation.type}：${reservation.reservedFor}）`);
  }

  function addRecord(type, costume, operator, summary) {
    const record = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      type,
      costumeName: costume.name,
      play: costume.play,
      operator,
      summary
    };
    records = [record, ...records];
    persistRecords();
  }

  function parsePlaysString(playsStr) {
    if (!playsStr) return [];
    return playsStr.split(/[,，、\s]+/).map((s) => s.trim()).filter(Boolean);
  }

  function saveActor() {
    if (!actorForm.name.trim()) return;
    const plays = parsePlaysString(actorForm.plays);
    const newActor = {
      id: crypto.randomUUID(),
      name: actorForm.name.trim(),
      size: actorForm.size.trim(),
      plays,
      note: actorForm.note.trim()
    };
    actors = [newActor, ...actors];
    persistActors();
    actorForm = { name: '', size: '', plays: '', note: '' };
  }

  function openActorDetail(actor) {
    selectedActorId = actor.id;
    editActorForm = {
      name: actor.name,
      size: actor.size,
      plays: Array.isArray(actor.plays) ? actor.plays.join('、') : '',
      note: actor.note
    };
    showDeleteActorConfirm = false;
  }

  function closeActorDetail() {
    selectedActorId = null;
    showDeleteActorConfirm = false;
  }

  function saveActorDetail() {
    if (!editActorForm.name.trim()) return;
    const plays = parsePlaysString(editActorForm.plays);
    actors = actors.map((a) => a.id === selectedActorId ? { ...a, name: editActorForm.name.trim(), size: editActorForm.size.trim(), plays, note: editActorForm.note.trim() } : a);
    persistActors();
    closeActorDetail();
  }

  function askDeleteActor() {
    showDeleteActorConfirm = true;
  }

  function cancelDeleteActor() {
    showDeleteActorConfirm = false;
  }

  function confirmDeleteActor() {
    actors = actors.filter((a) => a.id !== selectedActorId);
    persistActors();
    closeActorDetail();
  }

  function formatTime(isoString) {
    const date = new Date(isoString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  }

  $: filteredRecords = records.filter((record) => {
    const text = `${record.costumeName}${record.play}`;
    return text.includes(recordQuery.trim());
  });
  $: plays = ['全部剧目', ...new Set(costumes.map((item) => item.play).filter(Boolean))];
  $: filtered = costumes.filter((item) => {
    const text = `${item.name}${item.size}${item.play}${item.location}${item.borrower}`;
    const overdue = item.status === '借出' && item.due && new Date(item.due) < new Date(iso(0));
    return text.includes(query.trim()) && (playFilter === '全部剧目' || item.play === playFilter) && (!showOverdue || overdue);
  });
  $: overdueCount = costumes.filter((item) => item.status === '借出' && item.due && new Date(item.due) < new Date(iso(0))).length;
  $: borrowedCount = costumes.filter((item) => item.status === '借出').length;
  $: cleanWaitCount = costumes.filter((item) => item.clean === '待清洗').length;
  $: activeReservationCount = reservations.filter((r) => r.status === 'active').length;
  $: pendingWorkOrderCount = workOrders.filter((wo) => wo.status === '待清洗' || wo.status === '待维修').length;
  $: inProgressWorkOrderCount = workOrders.filter((wo) => wo.status === '清洗中' || wo.status === '维修中').length;
  $: completedWorkOrderCount = workOrders.filter((wo) => wo.status === '已完成').length;
  $: overdueWorkOrderCount = workOrders.filter((wo) => (wo.status === '待清洗' || wo.status === '清洗中' || wo.status === '待维修' || wo.status === '维修中') && wo.dueDate && new Date(wo.dueDate) < new Date(iso(0))).length;
  $: scheduleCount = schedules.length;
  $: filteredWorkOrders = workOrders.filter((wo) => {
    const text = `${wo.costumeName}${wo.play}${wo.assignee}`;
    const matchesQuery = text.includes(workOrderQuery.trim());
    let matchesFilter = true;
    if (workOrderFilter === '待处理') matchesFilter = wo.status === '待清洗' || wo.status === '待维修';
    else if (workOrderFilter === '处理中') matchesFilter = wo.status === '清洗中' || wo.status === '维修中';
    else if (workOrderFilter === '已完成') matchesFilter = wo.status === '已完成';
    else if (workOrderFilter === '已取消') matchesFilter = wo.status === '已取消';
    else if (workOrderFilter === '已逾期') matchesFilter = (wo.status === '待清洗' || wo.status === '清洗中' || wo.status === '待维修' || wo.status === '维修中') && wo.dueDate && new Date(wo.dueDate) < new Date(iso(0));
    let matchesTypeFilter = true;
    if (workOrderTypeFilter === '清洗') matchesTypeFilter = wo.type === '清洗';
    else if (workOrderTypeFilter === '维修') matchesTypeFilter = wo.type === '维修';
    return matchesQuery && matchesFilter && matchesTypeFilter;
  }).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  $: availableCostumesForWorkOrder = costumes.filter((c) => {
    const activeWO = getActiveWorkOrder(c.id);
    return !activeWO && c.status === '在库';
  });
  $: selectedWorkOrder = workOrders.find((wo) => wo.id === selectedWorkOrderId);
  $: filteredReservations = reservations.filter((r) => {
    const text = `${r.costumeName}${r.play}${r.reservedFor}`;
    const matchesQuery = text.includes(reservationQuery.trim());
    const today = iso(0);
    let matchesFilter = true;
    if (reservationFilter === '即将到来') matchesFilter = r.status === 'active' && r.date >= today;
    else if (reservationFilter === '已过期') matchesFilter = r.status === 'active' && r.date < today;
    else if (reservationFilter === '已取消') matchesFilter = r.status === 'cancelled';
    else if (reservationFilter === '有效') matchesFilter = r.status === 'active';
    return matchesQuery && matchesFilter;
  }).sort((a, b) => new Date(a.date) - new Date(b.date));
  $: reservingCostume = costumes.find((item) => item.id === reservingId);
  $: currentConflicts = reservingCostume ? checkConflict(reservingCostume.id, reservationForm.date) : [];
  $: filteredActors = actors.filter((a) => {
    const text = `${a.name}${a.size}${(a.plays || []).join('')}${a.note}`;
    return text.includes(actorQuery.trim());
  });
  $: selectedActor = actors.find((a) => a.id === selectedActorId);
  $: lendingActor = actors.find((a) => a.id === lendingActorId);
  $: lendingSizeMatch = lendingCostume && lendingActor ? matchSize(lendingCostume.size, lendingActor.size) : null;
  $: filteredPackingLists = packingLists.filter((pl) => {
    const text = `${pl.name}${pl.play}${pl.performanceDate}`;
    const matchesQuery = text.includes(packingListQuery.trim());
    const today = iso(0);
    let matchesFilter = true;
    if (packingListFilter === '即将演出') matchesFilter = pl.performanceDate >= today;
    else if (packingListFilter === '已过期') matchesFilter = pl.performanceDate < today;
    return matchesQuery && matchesFilter;
  }).sort((a, b) => new Date(a.performanceDate) - new Date(b.performanceDate));
  $: packingAddAvailableCostumes = costumes.filter((c) => {
    if (packingAddCostumePlayFilter !== '全部剧目' && c.play !== packingAddCostumePlayFilter) return false;
    const text = `${c.name}${c.size}${c.play}${c.location}${c.borrower}`;
    if (!text.includes(packingAddCostumeQuery.trim())) return false;
    if (packingListForm.items.find((item) => item.costumeId === c.id)) return false;
    return true;
  });
  $: selectedPackingList = packingLists.find((pl) => pl.id === selectedPackingListId);
  $: packingPlays = ['全部剧目', ...new Set(costumes.map((item) => item.play).filter(Boolean))];
  $: packingSummary = selectedPackingList ? {
    total: selectedPackingList.items.length,
    packed: selectedPackingList.items.filter((item) => item.status === '已打包').length,
    missing: selectedPackingList.items.filter((item) => item.status === '缺失').length,
    clean: selectedPackingList.items.filter((item) => item.status === '需清洗').length,
    returned: selectedPackingList.items.filter((item) => item.status === '已归还').length,
    pending: selectedPackingList.items.filter((item) => item.status === '未标记').length
  } : null;

  function saveCostume() {
    if (!form.name.trim() || !form.play.trim()) return;
    const newCostume = { id: crypto.randomUUID(), ...form };
    costumes = [newCostume, ...costumes];
    persist();
    addRecord('新增', newCostume, '系统', `新增服装「${newCostume.name}」，剧目：${newCostume.play}，尺码：${newCostume.size || '未填'}，位置：${newCostume.location || '未填'}`);
    form = { name: '', size: '', play: '', location: '', clean: '已清洗', borrower: '', due: '', status: '在库', note: '' };
  }

  function openLend(id) {
    const checkResult = canLend(id);
    if (!checkResult.can) {
      alert(checkResult.reason);
      return;
    }
    lendingId = id;
    lendingBorrower = '';
    lendingActorId = '';
  }

  function closeLend() {
    lendingId = null;
    lendingBorrower = '';
    lendingActorId = '';
  }

  function confirmLend() {
    let borrower = lendingBorrower.trim();
    if (!borrower && lendingActor) {
      borrower = lendingActor.name;
    }
    if (!borrower) return;
    const costume = costumes.find((c) => c.id === lendingId);
    if (!costume) return;
    const checkResult = canLend(lendingId);
    if (!checkResult.can) {
      alert(checkResult.reason);
      return;
    }
    const dueDate = iso(7);
    costumes = costumes.map((c) => c.id === lendingId ? { ...c, borrower, due: dueDate, status: '借出' } : c);
    persist();
    let summary = `借出「${costume.name}」给${borrower}，应还日期：${dueDate}`;
    if (lendingActor && lendingSizeMatch) {
      summary += `，尺码匹配：${lendingSizeMatch.label}`;
    }
    addRecord('借出', costume, borrower, summary);
    closeLend();
  }

  function returnBack(id) {
    const costume = costumes.find((c) => c.id === id);
    if (!costume) return;
    const borrower = costume.borrower;
    costumes = costumes.map((c) => c.id === id ? { ...c, borrower: '', due: '', status: '在库', clean: '待清洗' } : c);
    persist();
    addRecord('归还', costume, borrower, `${borrower}归还「${costume.name}」，状态变更为待清洗`);
    createWorkOrder('清洗', costume, '张阿姨', `${borrower}归还后自动生成清洗工单`);
  }

  function updateClean(id, clean) {
    const costume = costumes.find((c) => c.id === id);
    if (!costume) return;
    const oldClean = costume.clean;
    costumes = costumes.map((c) => c.id === id ? { ...c, clean } : c);
    persist();
    addRecord('清洗', costume, '系统', `「${costume.name}」清洗状态从「${oldClean}」变更为「${clean}」`);
  }

  function openDetail(item) {
    selectedId = item.id;
    editForm = {
      name: item.name,
      size: item.size,
      play: item.play,
      location: item.location,
      clean: item.clean,
      note: item.note
    };
    showDeleteConfirm = false;
  }

  function closeDetail() {
    selectedId = null;
    showDeleteConfirm = false;
  }

  function saveDetail() {
    if (!editForm.name.trim() || !editForm.play.trim()) return;
    costumes = costumes.map((item) => item.id === selectedId ? { ...item, ...editForm } : item);
    persist();
    closeDetail();
  }

  function askDelete() {
    showDeleteConfirm = true;
  }

  function cancelDelete() {
    showDeleteConfirm = false;
  }

  function confirmDelete() {
    costumes = costumes.filter((item) => item.id !== selectedId);
    persist();
    closeDetail();
  }

  function exportCostumes() {
    const dataStr = JSON.stringify(costumes, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const date = new Date().toISOString().slice(0, 10);
    a.download = `costumes-${date}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function handleImportFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    importFile = file.name;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result);
        const items = Array.isArray(data) ? data : [data];
        const valid = [];
        const skipped = [];
        items.forEach((item, index) => {
          if (item && typeof item === 'object' && item.name?.trim() && item.play?.trim()) {
            valid.push({
              id: crypto.randomUUID(),
              name: item.name.trim(),
              size: item.size || '',
              play: item.play.trim(),
              location: item.location || '',
              clean: item.clean || '已清洗',
              borrower: item.borrower || '',
              due: item.due || '',
              status: item.status || '在库',
              note: item.note || ''
            });
          } else {
            skipped.push({ index, name: item?.name || '(无名称)', play: item?.play || '(无剧目)' });
          }
        });
        importPreview = valid;
        importSkipped = skipped;
        showImportModal = true;
      } catch (err) {
        alert('文件解析失败，请确保是有效的JSON文件');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  function confirmImport() {
    costumes = [...importPreview, ...costumes];
    persist();
    closeImportModal();
  }

  function closeImportModal() {
    showImportModal = false;
    importPreview = [];
    importSkipped = [];
    importFile = null;
  }

  $: selected = costumes.find((item) => item.id === selectedId);
  $: lendingCostume = costumes.find((item) => item.id === lendingId);

  function handleModalKeydown(e) {
    if (e.key === 'Escape') {
      if (showMergePanel) {
        closeMergePanel();
      } else if (showDataManager) {
        closeDataManager();
      } else if (reservingId) {
        closeReserve();
      } else if (lendingId) {
        closeLend();
      } else if (showImportModal) {
        closeImportModal();
      } else if (showDeleteConfirm) {
        cancelDelete();
      } else if (showWorkOrderModal) {
        closeWorkOrderModal();
      } else if (selectedWorkOrderId) {
        closeWorkOrderDetail();
      } else if (showDeleteActorConfirm) {
        cancelDeleteActor();
      } else if (selectedActorId) {
        closeActorDetail();
      } else if (showPackingListModal) {
        closePackingListModal();
      } else if (showPackingListDetail) {
        closePackingListDetail();
      } else if (showInventoryDetail) {
        closeInventoryDetail();
      } else if (selectedId) {
        closeDetail();
      }
    }
  }
</script>

<main>
  <header class="hero">
    <div>
      <span>剧场服装间</span>
      <h1>借还管理前端</h1>
    </div>
    <div class="stats">
      <b><Shirt size={18} />{costumes.length}件服装</b>
      <b><Clock size={18} />{borrowedCount}件借出</b>
      <b><CalendarDays size={18} />{activeReservationCount}个预约</b>
      <b><Archive size={18} />{cleanWaitCount}件待清洗</b>
      <b><Package size={18} />{packingLists.length}个装箱单</b>
      <b><ClipboardList size={18} />{inventoryTasks.length}次盘点</b>
      <b><LayoutGrid size={18} />{scheduleCount}条排期</b>
      <b class:danger={overdueCount > 0}><AlertTriangle size={18} />{overdueCount}项逾期</b>
      <button type="button" class="hero-data-btn" on:click={openDataManager}>
        <Database size={16} />数据管理
      </button>
      <button type="button" class="hero-data-btn" on:click={() => showScheduleKanban = !showScheduleKanban}>
        <LayoutGrid size={16} />排期看板
      </button>
    </div>
  </header>

  {#if dbMigrationNotice}
    <div class="migration-notice">
      <div class="migration-notice-content">
        <RefreshCw size={18} />
        <span>{dbMigrationNotice}</span>
      </div>
      <button type="button" class="icon-btn" on:click={dismissMigrationNotice} aria-label="关闭提示"><X size={16} /></button>
    </div>
  {/if}

  <section class="workorder-stats">
    <div class="stats-panel">
      <div class="stats-title">工单总览</div>
      <div class="stats-grid">
        <div class="stat-card stat-pending">
          <div class="stat-icon"><Droplets size={24} /></div>
          <div class="stat-content">
            <div class="stat-number">{pendingWorkOrderCount}</div>
            <div class="stat-label">待处理工单</div>
          </div>
        </div>
        <div class="stat-card stat-progress">
          <div class="stat-icon"><Wrench size={24} /></div>
          <div class="stat-content">
            <div class="stat-number">{inProgressWorkOrderCount}</div>
            <div class="stat-label">处理中</div>
          </div>
        </div>
        <div class="stat-card stat-done">
          <div class="stat-icon"><CheckCircle size={24} /></div>
          <div class="stat-content">
            <div class="stat-number">{completedWorkOrderCount}</div>
            <div class="stat-label">已完成</div>
          </div>
        </div>
        <div class="stat-card stat-overdue" class:has-overdue={overdueWorkOrderCount > 0}>
          <div class="stat-icon"><AlertTriangle size={24} /></div>
          <div class="stat-content">
            <div class="stat-number">{overdueWorkOrderCount}</div>
            <div class="stat-label">逾期工单</div>
          </div>
        </div>
      </div>
    </div>
  </section>

  {#if showScheduleKanban}
    <section class="panel">
      <ScheduleKanban
        {schedules}
        {costumes}
        {reservations}
        {workOrders}
        {packingLists}
        on:change={handleScheduleChange}
        on:generate-packing-list={handleGeneratePackingListFromSchedule}
      />
    </section>
  {/if}

  <section class="layout">
    <form class="panel" on:submit|preventDefault={saveCostume}>
      <h2>新增服装</h2>
      <input bind:value={form.name} placeholder="服装名称" />
      <div class="split">
        <input bind:value={form.size} placeholder="尺码" />
        <input bind:value={form.play} placeholder="所属剧目" />
      </div>
      <input bind:value={form.location} placeholder="存放位置" />
      <select bind:value={form.clean}>
        <option>已清洗</option>
        <option>待清洗</option>
        <option>维修中</option>
      </select>
      <input bind:value={form.note} placeholder="备注" />
      <button>保存档案</button>
    </form>

    <section class="panel wide">
      <div class="toolbar">
        <label><Search size={16} /><input bind:value={query} placeholder="搜索服装/剧目/借用人" /></label>
        <select bind:value={playFilter}>
          {#each plays as play}
            <option>{play}</option>
          {/each}
        </select>
        <label class="check"><input type="checkbox" bind:checked={showOverdue} />只看逾期</label>
      </div>

      <div class="cards">
        {#each filtered as item}
          {@const latestRes = getLatestReservation(item.id)}
          {@const activeWO = getActiveWorkOrder(item.id)}
          <article
            class:item-overdue={item.status === '借出' && item.due && new Date(item.due) < new Date(iso(0))}
            class:item-in-workorder={activeWO}
            class="card-clickable"
          >
            <button
              type="button"
              class="card-overlay-btn"
              aria-label={`查看${item.name}详情`}
              on:click={() => openDetail(item)}
            ></button>
            <div>
              <strong>{item.name}</strong>
              <span>{item.play} · {item.size || '未填尺码'}</span>
            </div>
            <p>{item.location} · {item.clean}</p>
            <p>{item.status === '借出' ? `${item.borrower}借用至${item.due}` : '当前在库'}</p>
            {#if activeWO}
              <p class="workorder-info">
                {#if activeWO.type === '清洗'}
                  <Droplets size={13} />
                {:else}
                  <Wrench size={13} />
                {/if}
                {activeWO.type}中：{activeWO.status} · 负责人：{activeWO.assignee}
              </p>
            {/if}
            {#if latestRes}
              <p class="reservation-info">
                <Calendar size={13} />下次预约：{latestRes.date} · {latestRes.type === '演员' ? '演员' : '场次'}：{latestRes.reservedFor}
              </p>
            {/if}
            <div class="actions" role="group" aria-label="服装操作">
              {#if item.status === '借出'}
                <button type="button" on:click={() => returnBack(item.id)}><Undo2 size={16} />归还</button>
              {:else if activeWO || item.clean === '待清洗' || item.clean === '维修中'}
                <button type="button" disabled>
                  <Clock size={16} />
                  {#if activeWO}{activeWO.type}中
                  {:else if item.clean === '维修中'}维修中
                  {:else}待清洗{/if}
                </button>
              {:else}
                <button type="button" on:click={() => openLend(item.id)}><Clock size={16} />借出</button>
              {/if}
              <button type="button" class="secondary" on:click={() => openReserve(item.id)}><Calendar size={16} />预约</button>
              {#if !activeWO && item.status === '在库' && item.clean !== '维修中' && item.clean !== '待清洗'}
                <button type="button" class="secondary" on:click={() => openCreateWorkOrder(item.id, '维修')}><Wrench size={16} />报修</button>
              {/if}
              {#if activeWO}
                <button type="button" class="secondary" on:click={() => openWorkOrderDetail(activeWO.id)}><Eye size={16} />查看工单</button>
              {:else if item.clean === '待清洗' || item.clean === '维修中'}
                <span class="clean-status-tag">
                  {#if item.clean === '维修中'}
                    <Wrench size={12} />
                  {:else}
                    <Droplets size={12} />
                  {/if}
                  {item.clean}
                </span>
              {/if}
            </div>
          </article>
        {/each}
      </div>
    </section>
  </section>

  <section class="panel actor-panel">
    <div class="record-header">
      <h2><Users size={18} />演员尺码档案</h2>
      <span class="record-count">共 {filteredActors.length} 位演员</span>
    </div>
    <div class="actor-layout">
      <form class="actor-form" on:submit|preventDefault={saveActor}>
        <h3 style="margin: 0 0 10px; font-size: 15px;">新增演员</h3>
        <input bind:value={actorForm.name} placeholder="演员姓名" required />
        <div class="split">
          <input bind:value={actorForm.size} placeholder="常用尺码 (如 M/L/XL)" />
          <input bind:value={actorForm.plays} placeholder="参演剧目 (用顿号分隔)" />
        </div>
        <input bind:value={actorForm.note} placeholder="备注" />
        <button type="submit"><Plus size={14} />保存档案</button>
      </form>
      <div class="actor-list-wrapper">
        <div class="record-toolbar" style="margin-bottom: 10px;">
          <label><Search size={16} /><input bind:value={actorQuery} placeholder="搜索演员/尺码/剧目" /></label>
        </div>
        <div class="actor-list">
          {#each filteredActors as actor}
            <article class="actor-card card-clickable">
              <button
                type="button"
                class="card-overlay-btn"
                aria-label={`查看${actor.name}详情`}
                on:click={() => openActorDetail(actor)}
              ></button>
              <div class="actor-card-header">
                <strong class="actor-name">{actor.name}</strong>
                <span class="actor-size-tag">{actor.size || '未填尺码'}</span>
              </div>
              {#if actor.plays && actor.plays.length > 0}
                <div class="actor-plays">
                  {#each actor.plays as play}
                    <span class="record-play-tag">{play}</span>
                  {/each}
                </div>
              {/if}
              {#if actor.note}
                <p class="actor-note">{actor.note}</p>
              {/if}
            </article>
          {/each}
          {#if filteredActors.length === 0}
            <div class="record-empty" style="padding: 20px;">
              <Users size={24} />
              <p>暂无演员档案</p>
            </div>
          {/if}
        </div>
      </div>
    </div>
  </section>

  <section class="panel">
    <h2>按剧目查看</h2>
    <div class="playGrid">
      {#each plays.filter((play) => play !== '全部剧目') as play}
        {@const playActors = getActorsByPlay(play)}
        {@const playCostumes = costumes.filter((c) => c.play === play)}
        <button type="button" class="play-card" on:click={() => playFilter = play}>
          <strong>{play}</strong>
          <div class="play-card-stats">
            <span><Shirt size={12} />{playCostumes.length}件服装</span>
            <span><Users size={12} />{playActors.length}位演员</span>
          </div>
          {#if playActors.length > 0 && playCostumes.length > 0}
            <div class="play-match-summary">
              {#each playActors.slice(0, 3) as pa}
                {@const bestMatch = playCostumes
                  .filter((c) => c.status === '在库' && c.clean === '已清洗')
                  .map((c) => ({ costume: c, match: matchSize(c.size, pa.size) }))
                  .sort((a, b) => Math.abs(a.match.diff) - Math.abs(b.match.diff))[0]}
                {#if bestMatch}
                  <span class="mini-match" class:match-perfect={bestMatch.match.level === 'perfect'} class:match-close={bestMatch.match.level === 'loose' || bestMatch.match.level === 'tight'} class:match-mismatch={bestMatch.match.level === 'mismatch'}>
                    {pa.name}→{bestMatch.costume.name}
                  </span>
                {/if}
              {/each}
            </div>
          {/if}
        </button>
      {/each}
    </div>
  </section>

  <section class="panel">
    <h2><HardDrive size={18} />数据管理</h2>
    <div class="import-export-btns">
      <button type="button" on:click={downloadBackup}>
        <Download size={16} />完整备份
      </button>
      <button type="button" class="secondary" on:click={exportCostumes}>
        <Download size={16} />仅导服装
      </button>
      <button type="button" class="secondary" on:click={openDataManager}>
        <Database size={16} />高级管理
      </button>
    </div>
    <p class="hint">「完整备份」包含服装、借还记录、预约、工单、演员、装箱单、盘点等所有数据；「仅导服装」只导出服装档案，兼容旧版导入格式。</p>
  </section>

  <section class="panel">
    <div class="record-header">
      <h2><Wrench size={18} />清洗与维修工单</h2>
      <div style="display: flex; gap: 10px; align-items: center;">
        <span class="record-count">共 {filteredWorkOrders.length} 条</span>
        <button type="button" class="small-btn" on:click={() => openCreateWorkOrder(null, '维修')}>
          <Plus size={14} />新建工单
        </button>
      </div>
    </div>
    <div class="record-toolbar">
      <label><Search size={16} /><input bind:value={workOrderQuery} placeholder="搜索服装/剧目/负责人" /></label>
      <div style="display: flex; gap: 8px;">
        <select bind:value={workOrderTypeFilter}>
          <option>全部</option>
          <option>清洗</option>
          <option>维修</option>
        </select>
        <select bind:value={workOrderFilter}>
          <option>全部</option>
          <option>待处理</option>
          <option>处理中</option>
          <option>已完成</option>
          <option>已取消</option>
          <option>已逾期</option>
        </select>
      </div>
    </div>
    <div class="record-list">
      {#each filteredWorkOrders as workOrder}
        {@const isOverdue = (workOrder.status === '待清洗' || workOrder.status === '清洗中' || workOrder.status === '待维修' || workOrder.status === '维修中') && workOrder.dueDate && new Date(workOrder.dueDate) < new Date(iso(0))}
        <div class="record-item" class:record-cancelled={workOrder.status === '已取消'} class:record-overdue={isOverdue}>
          <div class="record-type-badge record-type-{workOrder.type}">
            {#if workOrder.type === '清洗'}
              <Droplets size={14} />
            {:else}
              <Wrench size={14} />
            {/if}
            {workOrder.type}
          </div>
          <div class="record-content">
            <div class="record-title-row">
              <strong class="record-name">{workOrder.costumeName}</strong>
              <span class="record-play-tag">{workOrder.play}</span>
              <span class="record-play-tag reservation-date-tag"><Calendar size={12} />截止：{workOrder.dueDate}</span>
              <span class="record-play-tag" style="background: {workOrder.status === '已完成' ? '#e6f0e6' : workOrder.status === '已取消' ? '#f6e6e6' : isOverdue ? '#fff4e6' : '#e6eef6'}; color: {workOrder.status === '已完成' ? '#2d5a2d' : workOrder.status === '已取消' ? '#8a2d2d' : isOverdue ? '#8a5a1a' : '#1a4a8a'};">
                {workOrder.status}
              </span>
            </div>
            <p class="record-summary">
              负责人：{workOrder.assignee || '未分配'}
              {#if workOrder.note} · 备注：{workOrder.note}{/if}
            </p>
            <div class="record-footer">
              <span class="record-operator">创建时间：{formatTime(workOrder.createdAt)}</span>
              <div style="display: flex; gap: 6px;">
                {#if workOrder.status !== '已完成' && workOrder.status !== '已取消'}
                  {#each getAvailableStatuses(workOrder).filter((s) => s !== workOrder.status) as status}
                    <button type="button" class="small-btn" on:click={() => updateWorkOrderStatus(workOrder.id, status)}>
                      {status}
                    </button>
                  {/each}
                {/if}
                <button type="button" class="secondary small-btn" on:click={() => openEditWorkOrder(workOrder.id)}>
                  <Save size={12} />编辑
                </button>
                <button type="button" class="secondary small-btn" on:click={() => openWorkOrderDetail(workOrder.id)}>
                  <Eye size={12} />详情
                </button>
              </div>
            </div>
          </div>
        </div>
      {/each}
      {#if filteredWorkOrders.length === 0}
        <div class="record-empty">
          <Wrench size={32} />
          <p>暂无工单</p>
          <span>服装归还时将自动生成清洗工单，或点击「新建工单」创建维修工单</span>
        </div>
      {/if}
    </div>
  </section>

  <section class="panel">
    <div class="record-header">
      <h2><CalendarDays size={18} />排练预约</h2>
      <span class="record-count">共 {filteredReservations.length} 条</span>
    </div>
    <div class="record-toolbar">
      <label><Search size={16} /><input bind:value={reservationQuery} placeholder="搜索服装/剧目/预约方" /></label>
      <select bind:value={reservationFilter}>
        <option>全部</option>
        <option>有效</option>
        <option>即将到来</option>
        <option>已过期</option>
        <option>已取消</option>
      </select>
    </div>
    <div class="record-list">
      {#each filteredReservations as reservation}
        <div class="record-item" class:record-cancelled={reservation.status === 'cancelled'} class:record-overdue={reservation.status === 'active' && reservation.date < iso(0)}>
          <div class="record-type-badge record-type-{reservation.status === 'cancelled' ? '取消预约' : (reservation.date < iso(0) ? '已过期' : '预约')}">
            {#if reservation.status === 'cancelled'}
              <XCircle size={14} />
              已取消
            {:else if reservation.date < iso(0)}
              <AlertTriangle size={14} />
              已过期
            {:else}
              <Calendar size={14} />
              预约
            {/if}
          </div>
          <div class="record-content">
            <div class="record-title-row">
              <strong class="record-name">{reservation.costumeName}</strong>
              <span class="record-play-tag">{reservation.play}</span>
              <span class="record-play-tag reservation-date-tag"><Calendar size={12} />{reservation.date}</span>
            </div>
            <p class="record-summary">
              {reservation.type === '演员' ? '演员' : '场次'}：{reservation.reservedFor}
              {#if reservation.note} · 备注：{reservation.note}{/if}
            </p>
            <div class="record-footer">
              <span class="record-operator">创建时间：{formatTime(reservation.createdAt)}</span>
              {#if reservation.status === 'active'}
                <button type="button" class="danger-outline small-btn" on:click={() => cancelReservation(reservation.id)}>
                  <XCircle size={12} />取消预约
                </button>
              {/if}
            </div>
          </div>
        </div>
      {/each}
      {#if filteredReservations.length === 0}
        <div class="record-empty">
          <CalendarDays size={32} />
          <p>暂无预约</p>
          <span>点击服装卡片上的「预约」按钮创建新预约</span>
        </div>
      {/if}
    </div>
  </section>

  <section class="panel">
    <div class="record-header">
      <h2><List size={18} />借还记录</h2>
      <span class="record-count">共 {records.length} 条记录</span>
    </div>
    <div class="record-toolbar">
      <label><Search size={16} /><input bind:value={recordQuery} placeholder="搜索服装名称或剧目" /></label>
    </div>
    <div class="record-list">
      {#each filteredRecords as record}
        <div class="record-item">
          <div class="record-type-badge record-type-{record.type}">
            {#if record.type === '新增'}
              <Plus size={14} />
            {:else if record.type === '借出'}
              <Clock size={14} />
            {:else if record.type === '归还'}
              <Undo2 size={14} />
            {:else if record.type === '清洗'}
              <RotateCcw size={14} />
            {:else if record.type === '预约'}
              <Calendar size={14} />
            {:else if record.type === '取消预约'}
              <XCircle size={14} />
            {:else if record.type === '工单创建'}
              <Plus size={14} />
            {:else if record.type === '工单更新'}
              <Wrench size={14} />
            {:else if record.type === '装箱单创建'}
              <Package size={14} />
            {:else if record.type === '装箱单删除'}
              <Trash2 size={14} />
            {/if}
            {record.type}
          </div>
          <div class="record-content">
            <div class="record-title-row">
              <strong class="record-name">{record.costumeName}</strong>
              <span class="record-play-tag">{record.play}</span>
            </div>
            <p class="record-summary">{record.summary}</p>
            <div class="record-footer">
              <span class="record-operator">操作者：{record.operator}</span>
              <span class="record-time">{formatTime(record.timestamp)}</span>
            </div>
          </div>
        </div>
      {/each}
      {#if filteredRecords.length === 0}
        <div class="record-empty">
          <List size={32} />
          <p>暂无记录</p>
          <span>进行操作后记录将显示在这里</span>
        </div>
      {/if}
    </div>
  </section>

  <section class="panel">
    <div class="record-header">
      <h2><Package size={18} />演出装箱清单</h2>
      <div style="display: flex; gap: 10px; align-items: center;">
        <span class="record-count">共 {filteredPackingLists.length} 个装箱单</span>
        <button type="button" class="small-btn" on:click={openCreatePackingList}>
          <Plus size={14} />新建装箱单
        </button>
      </div>
    </div>
    <div class="record-toolbar">
      <label><Search size={16} /><input bind:value={packingListQuery} placeholder="搜索装箱单名称/剧目/日期" /></label>
      <select bind:value={packingListFilter}>
        <option>全部</option>
        <option>即将演出</option>
        <option>已过期</option>
      </select>
    </div>
    <div class="record-list">
      {#each filteredPackingLists as pl}
        {@const isPast = pl.performanceDate < iso(0)}
        {@const packedCount = pl.items.filter((item) => item.status === '已打包').length}
        {@const missingCount = pl.items.filter((item) => item.status === '缺失').length}
        {@const cleanCount = pl.items.filter((item) => item.status === '需清洗').length}
        {@const returnedCount = pl.items.filter((item) => item.status === '已归还').length}
        {@const hasAlerts = pl.items.some((item) => getCostumeAlert(item.costumeId))}
        <div class="record-item packing-list-item" class:record-overdue={isPast}>
          <div class="record-type-badge record-type-预约">
            <Package size={14} />
            {isPast ? '已完成' : '待装箱'}
          </div>
          <div class="record-content">
            <div class="record-title-row">
              <strong class="record-name">{pl.name}</strong>
              <span class="record-play-tag">{pl.play}</span>
              <span class="record-play-tag reservation-date-tag"><Calendar size={12} />演出：{pl.performanceDate}</span>
              {#if hasAlerts}
                <span class="record-play-tag" style="background: #fdecea; color: #8a2d2d;">
                  <AlertOctagon size={12} />有异常
                </span>
              {/if}
            </div>
            <p class="record-summary">
              共 {pl.items.length} 件服装
              {#if pl.items.length > 0}
                · 已打包 {packedCount} 件
                {#if missingCount > 0} · 缺失 {missingCount} 件{/if}
                {#if cleanCount > 0} · 需清洗 {cleanCount} 件{/if}
                {#if returnedCount > 0} · 已归还 {returnedCount} 件{/if}
              {/if}
              {#if pl.note} · 备注：{pl.note}{/if}
            </p>
            <div class="record-footer">
              <span class="record-operator">创建时间：{formatTime(pl.createdAt)}</span>
              <div style="display: flex; gap: 6px;">
                <button type="button" class="small-btn" on:click={() => openPackingListDetail(pl.id)}>
                  <Eye size={12} />查看/打印
                </button>
                <button type="button" class="secondary small-btn" on:click={() => openEditPackingList(pl.id)}>
                  <Save size={12} />编辑
                </button>
                <button type="button" class="danger-outline small-btn" on:click={() => deletePackingList(pl.id)}>
                  <Trash2 size={12} />删除
                </button>
              </div>
            </div>
          </div>
        </div>
      {/each}
      {#if filteredPackingLists.length === 0}
        <div class="record-empty">
          <Package size={32} />
          <p>暂无装箱单</p>
          <span>点击「新建装箱单」为演出准备服装清单</span>
        </div>
      {/if}
    </div>
  </section>

  <section class="panel inventory-section">
    <InventoryPanel
      bind:this={inventoryPanelRef}
      {costumes}
    />
  </section>

  {#if showInventoryDetail && selectedInventoryTaskId}
    <InventoryDetail
      taskId={selectedInventoryTaskId}
      onClose={closeInventoryDetail}
    />
  {/if}

  {#if selected}
    <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
    <div class="modal-overlay" role="presentation" on:click={closeDetail}>
      <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
      <div
        class="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="detail-title"
        on:click|stopPropagation
        on:keydown={handleModalKeydown}
        tabindex="-1"
      >
        <div class="modal-header">
          <h2 id="detail-title">服装详情</h2>
          <button type="button" class="icon-btn" on:click={closeDetail} aria-label="关闭"><X size={20} /></button>
        </div>

        {#if showDeleteConfirm}
          <div class="confirm-box">
            <p>确定要删除「{selected.name}」的档案吗？此操作不可撤销。</p>
            <div class="confirm-actions">
              <button type="button" class="secondary" on:click={cancelDelete}>取消</button>
              <button type="button" class="danger" on:click={confirmDelete}><Trash2 size={16} />确认删除</button>
            </div>
          </div>
        {:else}
          <form class="detail-form" on:submit|preventDefault={saveDetail}>
            <label>
              <span>服装名称</span>
              <input bind:value={editForm.name} placeholder="服装名称" required />
            </label>
            <div class="split">
              <label>
                <span>尺码</span>
                <input bind:value={editForm.size} placeholder="尺码" />
              </label>
              <label>
                <span>所属剧目</span>
                <input bind:value={editForm.play} placeholder="所属剧目" required />
              </label>
            </div>
            <label>
              <span>存放位置</span>
              <input bind:value={editForm.location} placeholder="存放位置" />
            </label>
            <label>
              <span>清洗状态</span>
              <select bind:value={editForm.clean}>
                <option>已清洗</option>
                <option>待清洗</option>
                <option>维修中</option>
              </select>
            </label>
            <label>
              <span>备注</span>
              <input bind:value={editForm.note} placeholder="备注" />
            </label>

            {#if selected.status === '借出'}
              <div class="status-info">
                <p><strong>当前状态：</strong>{selected.status}</p>
                <p><strong>借用人：</strong>{selected.borrower}</p>
                <p><strong>应还日期：</strong>{selected.due}</p>
              </div>
            {:else}
              <div class="status-info">
                <p><strong>当前状态：</strong>在库</p>
              </div>
            {/if}

            <div class="modal-actions">
              <button type="button" class="danger-outline" on:click={askDelete}><Trash2 size={16} />删除档案</button>
              <button type="submit"><Save size={16} />保存修改</button>
            </div>
          </form>
        {/if}
      </div>
    </div>
  {/if}

  {#if selectedActor}
    <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
    <div class="modal-overlay" role="presentation" on:click={closeActorDetail}>
      <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
      <div
        class="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="actor-detail-title"
        on:click|stopPropagation
        on:keydown={handleModalKeydown}
        tabindex="-1"
      >
        <div class="modal-header">
          <h2 id="actor-detail-title">演员档案</h2>
          <button type="button" class="icon-btn" on:click={closeActorDetail} aria-label="关闭"><X size={20} /></button>
        </div>

        {#if showDeleteActorConfirm}
          <div class="confirm-box">
            <p>确定要删除「{selectedActor.name}」的档案吗？此操作不可撤销。</p>
            <div class="confirm-actions">
              <button type="button" class="secondary" on:click={cancelDeleteActor}>取消</button>
              <button type="button" class="danger" on:click={confirmDeleteActor}><Trash2 size={16} />确认删除</button>
            </div>
          </div>
        {:else}
          <form class="detail-form" on:submit|preventDefault={saveActorDetail}>
            <label>
              <span>演员姓名</span>
              <input bind:value={editActorForm.name} placeholder="演员姓名" required />
            </label>
            <div class="split">
              <label>
                <span>常用尺码</span>
                <input bind:value={editActorForm.size} placeholder="常用尺码 (如 M/L/XL)" />
              </label>
              <label>
                <span>参演剧目</span>
                <input bind:value={editActorForm.plays} placeholder="用顿号、逗号或空格分隔" />
              </label>
            </div>
            <label>
              <span>备注</span>
              <input bind:value={editActorForm.note} placeholder="备注" />
            </label>

            {#if selectedActor.plays && selectedActor.plays.length > 0}
              <div class="status-info">
                <p><strong>参演剧目：</strong></p>
                <div style="display: flex; gap: 6px; flex-wrap: wrap; margin-top: 4px;">
                  {#each selectedActor.plays as play}
                    <span class="record-play-tag">{play}</span>
                  {/each}
                </div>
              </div>
            {/if}

            {#if selectedActor.size}
              <div class="status-info">
                <p><strong>尺码匹配建议：</strong></p>
                <div style="margin-top: 8px; display: flex; flex-direction: column; gap: 6px;">
                  {#each costumes.filter((c) => c.status === '在库' && c.clean === '已清洗').slice(0, 5) as costume}
                    {@const m = matchSize(costume.size, selectedActor.size)}
                    <div class="actor-match-row">
                      <span class="actor-match-costume">{costume.name} ({costume.size || '未填'})</span>
                      <span class="match-badge {getMatchBadgeClass(m.level)}">{m.label}</span>
                    </div>
                  {/each}
                  {#if costumes.filter((c) => c.status === '在库' && c.clean === '已清洗').length === 0}
                    <span style="color: #8a7665; font-size: 13px;">暂无可借出的服装</span>
                  {/if}
                </div>
              </div>
            {/if}

            <div class="modal-actions">
              <button type="button" class="danger-outline" on:click={askDeleteActor}><Trash2 size={16} />删除档案</button>
              <button type="submit"><Save size={16} />保存修改</button>
            </div>
          </form>
        {/if}
      </div>
    </div>
  {/if}

  {#if lendingCostume}
    <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
    <div class="modal-overlay" role="presentation" on:click={closeLend}>
      <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
      <div
        class="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="lend-title"
        on:click|stopPropagation
        on:keydown={handleModalKeydown}
        tabindex="-1"
      >
        <div class="modal-header">
          <h2 id="lend-title">借出服装</h2>
          <button type="button" class="icon-btn" on:click={closeLend} aria-label="关闭"><X size={20} /></button>
        </div>
        <form class="lend-form" on:submit|preventDefault={confirmLend}>
          <div class="status-info">
            <p><strong>服装：</strong>{lendingCostume.name}</p>
            <p><strong>剧目：</strong>{lendingCostume.play}</p>
            <p><strong>服装尺码：</strong>{lendingCostume.size || '未填'}</p>
            <p><strong>应还日期：</strong>{iso(7)}</p>
          </div>
          <label>
            <span>选择演员（可选）</span>
            <select bind:value={lendingActorId} on:change={() => {
              if (lendingActorId) {
                const a = getActorById(lendingActorId);
                if (a) lendingBorrower = a.name;
              }
            }}>
              <option value="">不选择演员，手动输入借用人</option>
              {#each actors as actor}
                <option value={actor.id}>{actor.name} ({actor.size || '未填尺码'})</option>
              {/each}
            </select>
          </label>
          {#if lendingActor && lendingSizeMatch}
            <div class="size-match-box" class:match-perfect={lendingSizeMatch.level === 'perfect'} class:match-close={lendingSizeMatch.level === 'loose' || lendingSizeMatch.level === 'tight'} class:match-mismatch={lendingSizeMatch.level === 'mismatch'} class:match-unknown={lendingSizeMatch.level === 'unknown'}>
              <div class="size-match-title">
                {#if lendingSizeMatch.level === 'perfect'}
                  <CheckCircle size={16} />
                {:else if lendingSizeMatch.level === 'loose' || lendingSizeMatch.level === 'tight'}
                  <AlertTriangle size={16} />
                {:else if lendingSizeMatch.level === 'mismatch'}
                  <XCircle size={16} />
                {:else}
                  <AlertTriangle size={16} />
                {/if}
                <strong>尺码匹配：{lendingSizeMatch.label}</strong>
              </div>
              <p class="size-match-detail">服装尺码：{lendingCostume.size || '未填'}，演员尺码：{lendingActor.size || '未填'}</p>
              {#if lendingActor.note}
                <p class="size-match-detail">演员备注：{lendingActor.note}</p>
              {/if}
            </div>
          {/if}
          <label>
            <span>借用人</span>
            <input bind:value={lendingBorrower} placeholder="请输入借用人姓名" required />
          </label>
          <div class="modal-actions">
            <button type="button" class="secondary" on:click={closeLend}>取消</button>
            <button type="submit" disabled={!lendingBorrower.trim()}><Clock size={16} />确认借出</button>
          </div>
        </form>
      </div>
    </div>
  {/if}

  {#if reservingCostume}
    <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
    <div class="modal-overlay" role="presentation" on:click={closeReserve}>
      <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
      <div
        class="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="reserve-title"
        on:click|stopPropagation
        on:keydown={handleModalKeydown}
        tabindex="-1"
      >
        <div class="modal-header">
          <h2 id="reserve-title">预约服装</h2>
          <button type="button" class="icon-btn" on:click={closeReserve} aria-label="关闭"><X size={20} /></button>
        </div>
        <form class="lend-form" on:submit|preventDefault={confirmReserve}>
          <div class="status-info">
            <p><strong>服装：</strong>{reservingCostume.name}</p>
            <p><strong>剧目：</strong>{reservingCostume.play}</p>
            {#if reservingCostume.status === '借出'}
              <p><strong>当前状态：</strong>借出中（{reservingCostume.borrower}借用至{reservingCostume.due}）</p>
            {/if}
          </div>
          <label>
            <span>预约日期</span>
            <input type="date" bind:value={reservationForm.date} min={iso(0)} required />
          </label>
          <label>
            <span>预约类型</span>
            <select bind:value={reservationForm.type}>
              <option value="演员">演员</option>
              <option value="场次">排练场次</option>
            </select>
          </label>
          <label>
            <span>{reservationForm.type === '演员' ? '演员姓名' : '场次名称'}</span>
            <input bind:value={reservationForm.reservedFor} placeholder={reservationForm.type === '演员' ? '请输入演员姓名' : '请输入场次名称'} required />
          </label>
          <label>
            <span>备注</span>
            <input bind:value={reservationForm.note} placeholder="选填" />
          </label>

          {#if currentConflicts.length > 0}
            <div class="conflict-box">
              <div class="conflict-title">
                <AlertTriangle size={16} />
                <strong>该日期存在冲突</strong>
              </div>
              {#each currentConflicts as conflict}
                <p class="conflict-item">· {conflict.type}：{conflict.detail}</p>
              {/each}
            </div>
          {/if}

          <div class="modal-actions">
            <button type="button" class="secondary" on:click={closeReserve}>取消</button>
            <button type="submit" disabled={!reservationForm.reservedFor.trim() || !reservationForm.date || currentConflicts.length > 0}>
              <Calendar size={16} />确认预约
            </button>
          </div>
        </form>
      </div>
    </div>
  {/if}

  {#if showImportModal}
    <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
    <div class="modal-overlay" role="presentation" on:click={closeImportModal}>
      <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
      <div
        class="modal modal-wide"
        role="dialog"
        aria-modal="true"
        aria-labelledby="import-title"
        on:click|stopPropagation
        on:keydown={handleModalKeydown}
        tabindex="-1"
      >
        <div class="modal-header">
          <h2 id="import-title">导入服装档案</h2>
          <button type="button" class="icon-btn" on:click={closeImportModal} aria-label="关闭"><X size={20} /></button>
        </div>

        <div class="import-content">
          <p class="file-info">文件：{importFile}</p>

          {#if importPreview.length > 0}
            <div class="import-summary success">
              <CheckCircle size={18} />
              <span>检测到 <strong>{importPreview.length}</strong> 条有效记录，将被导入</span>
            </div>
          {/if}

          {#if importSkipped.length > 0}
            <div class="import-summary warning">
              <AlertTriangle size={18} />
              <span>跳过 <strong>{importSkipped.length}</strong> 条无效记录（缺少服装名称或所属剧目）</span>
            </div>
          {/if}

          {#if importPreview.length > 0}
            <div class="preview-section">
              <h3>即将导入的服装</h3>
              <div class="preview-list">
                {#each importPreview as item}
                  <div class="preview-item">
                    <strong>{item.name}</strong>
                    <span>{item.play} · {item.size || '未填尺码'}</span>
                  </div>
                {/each}
              </div>
            </div>
          {/if}

          {#if importSkipped.length > 0}
            <div class="preview-section">
              <h3>已跳过的记录</h3>
              <div class="skipped-list">
                {#each importSkipped as item}
                  <div class="skipped-item">
                    <span class="skipped-index">第{item.index + 1}条</span>
                    <span class="skipped-name">{item.name}</span>
                    <span class="skipped-play">{item.play}</span>
                  </div>
                {/each}
              </div>
            </div>
          {/if}

          <div class="modal-actions">
            <button type="button" class="secondary" on:click={closeImportModal}>取消</button>
            <button type="button" on:click={confirmImport} disabled={importPreview.length === 0}>
              <Save size={16} />确认导入 {importPreview.length} 条
            </button>
          </div>
        </div>
      </div>
    </div>
  {/if}

  {#if showWorkOrderModal}
    <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
    <div class="modal-overlay" role="presentation" on:click={closeWorkOrderModal}>
      <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
      <div
        class="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="workorder-title"
        on:click|stopPropagation
        on:keydown={handleModalKeydown}
        tabindex="-1"
      >
        <div class="modal-header">
          <h2 id="workorder-title">
            {creatingWorkOrder ? '新建工单' : '编辑工单'}
          </h2>
          <button type="button" class="icon-btn" on:click={closeWorkOrderModal} aria-label="关闭"><X size={20} /></button>
        </div>
        <form class="lend-form" on:submit|preventDefault={saveWorkOrder}>
          <label>
            <span>工单类型</span>
            <select bind:value={workOrderForm.type} disabled={!creatingWorkOrder} on:change={() => {
              if (workOrderForm.type === '清洗') {
                workOrderForm.status = workOrderForm.status === '维修中' ? '清洗中' : '待清洗';
                if (!workOrderForm.assignee) workOrderForm.assignee = '张阿姨';
              } else {
                workOrderForm.status = workOrderForm.status === '清洗中' ? '维修中' : '待维修';
                if (!workOrderForm.assignee) workOrderForm.assignee = '李师傅';
              }
            }}>
              <option value="清洗">清洗</option>
              <option value="维修">维修</option>
            </select>
          </label>
          <label>
            <span>选择服装</span>
            <select bind:value={workOrderForm.costumeId} disabled={!creatingWorkOrder} on:change={() => {
              const c = costumes.find((cost) => cost.id === workOrderForm.costumeId);
              if (c) {
                workOrderForm.costumeName = c.name;
                workOrderForm.play = c.play;
              }
            }}>
              <option value="">请选择服装</option>
              {#each availableCostumesForWorkOrder as costume}
                <option value={costume.id}>{costume.name} ({costume.play})</option>
              {/each}
            </select>
          </label>
          {#if workOrderForm.costumeId}
            <div class="status-info">
              <p><strong>服装：</strong>{workOrderForm.costumeName}</p>
              <p><strong>剧目：</strong>{workOrderForm.play}</p>
            </div>
          {/if}
          <label>
            <span>当前状态</span>
            <select bind:value={workOrderForm.status}>
              {#each getAvailableStatuses(workOrderForm) as status}
                <option>{status}</option>
              {/each}
            </select>
          </label>
          <label>
            <span>负责人</span>
            <input bind:value={workOrderForm.assignee} placeholder="请输入负责人姓名" required />
          </label>
          <label>
            <span>截止日期</span>
            <input type="date" bind:value={workOrderForm.dueDate} required />
          </label>
          <label>
            <span>备注</span>
            <input bind:value={workOrderForm.note} placeholder="选填，描述问题或特殊要求" />
          </label>
          <div class="modal-actions">
            <button type="button" class="secondary" on:click={closeWorkOrderModal}>取消</button>
            <button type="submit" disabled={!workOrderForm.costumeId || !workOrderForm.assignee.trim()}>
              <Save size={16} />{creatingWorkOrder ? '创建工单' : '保存修改'}
            </button>
          </div>
        </form>
      </div>
    </div>
  {/if}

  {#if selectedWorkOrder}
    <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
    <div class="modal-overlay" role="presentation" on:click={closeWorkOrderDetail}>
      <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
      <div
        class="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="workorder-detail-title"
        on:click|stopPropagation
        on:keydown={handleModalKeydown}
        tabindex="-1"
      >
        <div class="modal-header">
          <h2 id="workorder-detail-title">工单详情</h2>
          <button type="button" class="icon-btn" on:click={closeWorkOrderDetail} aria-label="关闭"><X size={20} /></button>
        </div>
        <div class="detail-form">
          <div class="status-info">
            <p><strong>工单编号：</strong>{selectedWorkOrder.id.slice(0, 8)}</p>
            <p><strong>工单类型：</strong>{selectedWorkOrder.type}</p>
            <p><strong>当前状态：</strong>{selectedWorkOrder.status}</p>
          </div>
          <div class="status-info">
            <p><strong>服装：</strong>{selectedWorkOrder.costumeName}</p>
            <p><strong>剧目：</strong>{selectedWorkOrder.play}</p>
          </div>
          <div class="status-info">
            <p><strong>负责人：</strong>{selectedWorkOrder.assignee || '未分配'}</p>
            <p><strong>截止日期：</strong>{selectedWorkOrder.dueDate}</p>
            <p><strong>创建时间：</strong>{formatTime(selectedWorkOrder.createdAt)}</p>
            <p><strong>更新时间：</strong>{formatTime(selectedWorkOrder.updatedAt)}</p>
          </div>
          {#if selectedWorkOrder.note}
            <div class="status-info">
              <p><strong>备注：</strong>{selectedWorkOrder.note}</p>
            </div>
          {/if}

          {#if selectedWorkOrder.status !== '已完成' && selectedWorkOrder.status !== '已取消'}
            <div class="status-info">
              <p style="margin-bottom: 8px;"><strong>状态流转：</strong></p>
              <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                {#each getAvailableStatuses(selectedWorkOrder).filter((s) => s !== selectedWorkOrder.status) as status}
                  <button type="button" on:click={() => updateWorkOrderStatus(selectedWorkOrder.id, status)}>
                    {status}
                  </button>
                {/each}
              </div>
            </div>
          {/if}

          <div class="modal-actions">
            <button type="button" class="secondary" on:click={() => { closeWorkOrderDetail(); openEditWorkOrder(selectedWorkOrder.id); }}>
              <Save size={16} />编辑工单
            </button>
            <button type="button" on:click={closeWorkOrderDetail}>
              关闭
            </button>
          </div>
        </div>
      </div>
    </div>
  {/if}

  {#if showPackingListModal}
    <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
    <div class="modal-overlay" role="presentation" on:click={closePackingListModal}>
      <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
      <div
        class="modal modal-wide packing-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="packing-modal-title"
        on:click|stopPropagation
        on:keydown={handleModalKeydown}
        tabindex="-1"
      >
        <div class="modal-header">
          <h2 id="packing-modal-title">
            {creatingPackingList ? '新建装箱单' : '编辑装箱单'}
          </h2>
          <button type="button" class="icon-btn" on:click={closePackingListModal} aria-label="关闭"><X size={20} /></button>
        </div>
        <form class="detail-form" on:submit|preventDefault={savePackingList}>
          <div class="split">
            <label>
              <span>所属剧目</span>
              <input bind:value={packingListForm.play} placeholder="请输入剧目名称" required />
            </label>
            <label>
              <span>演出日期</span>
              <input type="date" bind:value={packingListForm.performanceDate} required />
            </label>
          </div>
          <label>
            <span>装箱单名称（可选）</span>
            <input bind:value={packingListForm.name} placeholder="留空将自动生成" />
          </label>
          <label>
            <span>备注</span>
            <input bind:value={packingListForm.note} placeholder="选填，如特殊要求等" />
          </label>

          {#if packingListForm.sourceScheduleId}
            <div class="packing-generated-notice">
              <Package size={16} />
              <span>由排期「{packingListForm.play} {packingListForm.performanceDate}」一键生成，含排期关联、同日预约、剧目预约、剧目服装。您仍可继续手动增删服装。</span>
            </div>
          {/if}

          <div class="packing-section">
            <div class="packing-section-title">
              <strong>已添加服装（{packingListForm.items.length}件）</strong>
              {#if packingListForm.items.length > 0}
                <span class="packing-items-summary">
                  {#if packingListForm.items.filter(i => i.status === '缺失').length > 0}
                    <span class="packing-summary-tag packing-summary-missing">缺失 {packingListForm.items.filter(i => i.status === '缺失').length}</span>
                  {/if}
                  {#if packingListForm.items.filter(i => i.status === '需清洗').length > 0}
                    <span class="packing-summary-tag packing-summary-clean">需清洗 {packingListForm.items.filter(i => i.status === '需清洗').length}</span>
                  {/if}
                  {#if packingListForm.items.filter(i => i.status === '未标记').length > 0}
                    <span class="packing-summary-tag">待确认 {packingListForm.items.filter(i => i.status === '未标记').length}</span>
                  {/if}
                </span>
              {/if}
            </div>
            {#if packingListForm.items.length === 0}
              <div class="record-empty" style="padding: 20px;">
                <Box size={24} />
                <p>还未添加服装</p>
                <span>从下方列表中选择服装加入装箱单</span>
              </div>
            {:else}
              <div class="packing-items-list">
                {#each packingListForm.items as item}
                  {@const alerts = item.risks && item.risks.length > 0 ? item.risks : getCostumeAlert(item.costumeId)}
                  <div class="packing-item-row" class:packing-item-has-alert={alerts && alerts.length > 0}>
                    <div class="packing-item-info">
                      <div class="packing-item-title-row">
                        <strong>{item.costumeName}</strong>
                        <span class="packing-item-status {getPackingStatusClass(item.status)}">{item.status}</span>
                        {#if item.source}
                          <span class="packing-item-source">{item.source}</span>
                        {/if}
                      </div>
                      <span>{item.size || '未填尺码'} · {item.location || '未填位置'}</span>
                      {#if item.note}
                        <span class="packing-item-note">📝 {item.note}</span>
                      {/if}
                      {#if alerts && alerts.length > 0}
                        <div class="packing-item-alerts">
                          {#each alerts as alert}
                            <span class="packing-alert-tag packing-alert-{alert.type}">
                              {#if alert.type === 'overdue'}<AlertOctagon size={11} />
                              {:else if alert.type === 'borrowed'}<Clock size={11} />
                              {:else}<Wrench size={11} />{/if}
                              {alert.label}
                            </span>
                          {/each}
                        </div>
                      {/if}
                    </div>
                    <button type="button" class="danger-outline small-btn" on:click={() => removeCostumeFromPackingList(item.costumeId)}>
                      <X size={12} />移除
                    </button>
                  </div>
                {/each}
              </div>
            {/if}
          </div>

          <div class="packing-section">
            <div class="packing-section-title">
              <strong>从服装档案中选择</strong>
            </div>
            <div class="record-toolbar" style="margin-bottom: 10px;">
              <label><Search size={16} /><input bind:value={packingAddCostumeQuery} placeholder="搜索服装/尺码/位置" /></label>
              <select bind:value={packingAddCostumePlayFilter}>
                {#each packingPlays as play}
                  <option>{play}</option>
                {/each}
              </select>
            </div>
            <div class="packing-costume-list">
              {#each packingAddAvailableCostumes as costume}
                {@const alerts = getCostumeAlert(costume.id)}
                <button
                  type="button"
                  class="packing-costume-card"
                  class:packing-item-has-alert={alerts}
                  on:click={() => addCostumeToPackingList(costume)}
                >
                  <div class="packing-costume-main">
                    <strong>{costume.name}</strong>
                    <span>{costume.play} · {costume.size || '未填尺码'}</span>
                    <span class="packing-costume-loc">{costume.location || '未填位置'}</span>
                  </div>
                  <div class="packing-costume-side">
                    {#if costume.status === '借出'}
                      <span class="record-play-tag" style="background: #fff0e6; color: #8a4a1a;">
                        <Clock size={11} />{costume.status}
                      </span>
                    {/if}
                    {#if alerts}
                      {#each alerts as alert}
                        <span class="packing-alert-tag packing-alert-{alert.type}">
                          {#if alert.type === 'overdue'}<AlertOctagon size={11} />
                          {:else if alert.type === 'borrowed'}<Clock size={11} />
                          {:else}<Wrench size={11} />{/if}
                        </span>
                      {/each}
                    {/if}
                    <Plus size={16} class="packing-add-icon" />
                  </div>
                </button>
              {/each}
              {#if packingAddAvailableCostumes.length === 0}
                <div class="record-empty" style="padding: 20px;">
                  <Shirt size={24} />
                  <p>没有可添加的服装</p>
                  <span>尝试调整搜索条件或剧目筛选</span>
                </div>
              {/if}
            </div>
          </div>

          <div class="modal-actions">
            <button type="button" class="secondary" on:click={closePackingListModal}>取消</button>
            <button type="submit" disabled={!packingListForm.play.trim() || !packingListForm.performanceDate}>
              <Save size={16} />{creatingPackingList ? '创建装箱单' : '保存修改'}
            </button>
          </div>
        </form>
      </div>
    </div>
  {/if}

  {#if showPackingListDetail && selectedPackingList}
    <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
    <div class="modal-overlay packing-detail-overlay" class:printing={isPrintingPackingList} role="presentation" on:click={!isPrintingPackingList && closePackingListDetail}>
      <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
      <div
        class="modal packing-detail-modal"
        class:printing={isPrintingPackingList}
        role="dialog"
        aria-modal="true"
        aria-labelledby="packing-detail-title"
        on:click|stopPropagation
        on:keydown={handleModalKeydown}
        tabindex="-1"
      >
        <div class="packing-detail-header">
          <div>
            <h2 id="packing-detail-title"><Package size={20} />{selectedPackingList.name}</h2>
            <div class="packing-detail-meta">
              <span class="record-play-tag"><Calendar size={12} />剧目：{selectedPackingList.play}</span>
              <span class="record-play-tag reservation-date-tag"><Calendar size={12} />演出日期：{selectedPackingList.performanceDate}</span>
              {#if selectedPackingList.note}
                <span class="record-play-tag">备注：{selectedPackingList.note}</span>
              {/if}
            </div>
          </div>
          {#if !isPrintingPackingList}
            <div class="packing-detail-actions">
              <button type="button" class="secondary" on:click={printPackingList}>
                <Printer size={16} />打印
              </button>
              <button type="button" class="icon-btn" on:click={closePackingListDetail} aria-label="关闭"><X size={20} /></button>
            </div>
          {/if}
        </div>

        <div class="packing-detail-body">
          <div class="packing-detail-summary">
            <div class="packing-summary-card">
              <div class="packing-summary-num">{packingSummary.total}</div>
              <div class="packing-summary-label">总计</div>
            </div>
            <div class="packing-summary-card packing-status-packed">
              <div class="packing-summary-num">{packingSummary.packed}</div>
              <div class="packing-summary-label">已打包</div>
            </div>
            <div class="packing-summary-card packing-status-missing">
              <div class="packing-summary-num">{packingSummary.missing}</div>
              <div class="packing-summary-label">缺失</div>
            </div>
            <div class="packing-summary-card packing-status-clean">
              <div class="packing-summary-num">{packingSummary.clean}</div>
              <div class="packing-summary-label">需清洗</div>
            </div>
            <div class="packing-summary-card packing-status-returned">
              <div class="packing-summary-num">{packingSummary.returned}</div>
              <div class="packing-summary-label">已归还</div>
            </div>
            <div class="packing-summary-card packing-status-pending">
              <div class="packing-summary-num">{packingSummary.pending}</div>
              <div class="packing-summary-label">未标记</div>
            </div>
          </div>

          <div class="packing-detail-table-wrap">
            <table class="packing-detail-table">
              <thead>
                <tr>
                  <th style="width: 40px;">序号</th>
                  <th>服装名称</th>
                  <th>尺码</th>
                  <th>存放位置</th>
                  <th>状态</th>
                  <th>提示</th>
                  {#if !isPrintingPackingList}
                    <th style="width: 200px;">操作</th>
                  {/if}
                </tr>
              </thead>
              <tbody>
                {#each selectedPackingList.items as item, index}
                  {@const alerts = getCostumeAlert(item.costumeId)}
                  <tr class:packing-row-alert={alerts}>
                    <td class="packing-cell-center">{index + 1}</td>
                    <td><strong>{item.costumeName}</strong></td>
                    <td>{item.size || '-'}</td>
                    <td>{item.location || '-'}</td>
                    <td>
                      <span class="packing-status-badge {getPackingStatusClass(item.status)}">
                        {#if item.status === '已打包'}<CheckCircle size={12} />
                        {:else if item.status === '缺失'}<XCircle size={12} />
                        {:else if item.status === '需清洗'}<Droplets size={12} />
                        {:else if item.status === '已归还'}<Undo2 size={12} />
                        {:else}<Clock size={12} />{/if}
                        {item.status}
                      </span>
                    </td>
                    <td>
                      {#if alerts}
                        <div class="packing-alerts-inline">
                          {#each alerts as alert}
                            <span class="packing-alert-tag packing-alert-{alert.type}">
                              {#if alert.type === 'overdue'}<AlertOctagon size={11} />
                              {:else if alert.type === 'borrowed'}<Clock size={11} />
                              {:else}<Wrench size={11} />{/if}
                              {alert.label}
                            </span>
                          {/each}
                        </div>
                      {:else}-{/if}
                    </td>
                    {#if !isPrintingPackingList}
                      <td>
                        <div class="packing-status-actions">
                          <select
                            value={item.status}
                            on:change={(e) => updatePackingItemStatus(selectedPackingList.id, item.costumeId, e.target.value)}
                            class="small-select"
                          >
                            {#each packingItemStatuses as status}
                              <option>{status}</option>
                            {/each}
                          </select>
                        </div>
                      </td>
                    {/if}
                  </tr>
                {/each}
                {#if selectedPackingList.items.length === 0}
                  <tr>
                    <td colspan={isPrintingPackingList ? 6 : 7} style="text-align: center; padding: 30px; color: #8a7665;">
                      <Package size={28} />
                      <p style="margin: 8px 0 0;">装箱单中暂无服装</p>
                    </td>
                  </tr>
                {/if}
              </tbody>
            </table>
          </div>

          {#if !isPrintingPackingList && selectedPackingList.items.length > 0}
            <div class="packing-detail-footer">
              <div class="packing-signature">
                <div class="packing-signature-item">
                  <span>装箱人签字：</span>
                  <span class="packing-signature-line"></span>
                </div>
                <div class="packing-signature-item">
                  <span>日期：</span>
                  <span class="packing-signature-line"></span>
                </div>
              </div>
            </div>
          {/if}
          {#if isPrintingPackingList}
            <div class="packing-detail-footer packing-print-footer">
              <div class="packing-signature">
                <div class="packing-signature-item">
                  <span>装箱人签字：</span>
                  <span class="packing-signature-line"></span>
                </div>
                <div class="packing-signature-item">
                  <span>日期：</span>
                  <span class="packing-signature-line"></span>
                </div>
                <div class="packing-signature-item">
                  <span>接收人签字：</span>
                  <span class="packing-signature-line"></span>
                </div>
              </div>
            </div>
          {/if}
        </div>
      </div>
    </div>
  {/if}

  {#if showDataManager}
    <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
    <div class="modal-overlay" role="presentation" on:click={closeDataManager}>
      <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
      <div
        class="modal modal-wide"
        role="dialog"
        aria-modal="true"
        aria-labelledby="data-manager-title"
        on:click|stopPropagation
        on:keydown={handleModalKeydown}
        tabindex="-1"
      >
        <div class="modal-header">
          <h2 id="data-manager-title"><Database size={20} />数据管理</h2>
          <button type="button" class="icon-btn" on:click={closeDataManager} aria-label="关闭"><X size={20} /></button>
        </div>
        <div class="data-manager-body">
          {#if dbStats}
            <div class="data-manager-section">
              <h3><HardDrive size={16} />当前数据概览</h3>
              <div class="db-info-row">
                <span>数据层版本</span>
                <strong>v{dbStats.version}</strong>
              </div>
              {#if dbStats.migratedAt}
                <div class="db-info-row">
                  <span>最近迁移</span>
                  <strong>{formatTime(dbStats.migratedAt)}</strong>
                </div>
              {/if}
              <div class="db-stats-grid">
                <div class="db-stat-card">
                  <div class="db-stat-num">{dbStats.tables.costumes}</div>
                  <div class="db-stat-label">服装档案</div>
                </div>
                <div class="db-stat-card">
                  <div class="db-stat-num">{dbStats.tables.records}</div>
                  <div class="db-stat-label">借还记录</div>
                </div>
                <div class="db-stat-card">
                  <div class="db-stat-num">{dbStats.tables.reservations}</div>
                  <div class="db-stat-label">预约</div>
                </div>
                <div class="db-stat-card">
                  <div class="db-stat-num">{dbStats.tables.workOrders}</div>
                  <div class="db-stat-label">工单</div>
                </div>
                <div class="db-stat-card">
                  <div class="db-stat-num">{dbStats.tables.actors}</div>
                  <div class="db-stat-label">演员</div>
                </div>
                <div class="db-stat-card">
                  <div class="db-stat-num">{dbStats.tables.packingLists}</div>
                  <div class="db-stat-label">装箱单</div>
                </div>
                <div class="db-stat-card">
                  <div class="db-stat-num">{dbStats.tables.schedules || 0}</div>
                  <div class="db-stat-label">演出排期</div>
                </div>
                <div class="db-stat-card">
                  <div class="db-stat-num">{dbStats.tables.inventoryTasks || 0}</div>
                  <div class="db-stat-label">盘点任务</div>
                </div>
                <div class="db-stat-card">
                  <div class="db-stat-num">{dbStats.tables.inventoryItems || 0}</div>
                  <div class="db-stat-label">盘点明细</div>
                </div>
              </div>
            </div>
          {/if}

          <div class="data-manager-section">
            <h3><Download size={16} />数据备份</h3>
            <p class="hint">建议定期导出完整备份，防止浏览器清理 localStorage 导致数据丢失。</p>
            <div class="data-manager-actions">
              <button type="button" on:click={downloadBackup}>
                <Download size={16} />导出完整备份
              </button>
              <button type="button" class="secondary" on:click={exportCostumes}>
                <Download size={16} />仅导出服装
              </button>
            </div>
          </div>

          <div class="data-manager-section">
            <h3><Upload size={16} />恢复数据</h3>
            <p class="hint">选择之前导出的备份文件进行恢复。恢复将<strong>覆盖</strong>当前所有数据，请先备份现有数据。</p>
            <label class="file-input-label">
              <Upload size={16} />选择备份文件
              <input type="file" accept=".json" on:change={handleRestoreFile} hidden />
            </label>

            {#if restoreError}
              <div class="import-summary warning">
                <AlertTriangle size={16} />
                <span>{restoreError}</span>
              </div>
            {/if}

            {#if restorePreview}
              <div class="restore-preview">
                <div class="import-summary success">
                  <CheckCircle size={16} />
                  <span>文件「{restorePreview.fileName}」解析成功</span>
                </div>
                {#if restorePreview.legacyFormat}
                  <div class="import-summary warning">
                    <AlertTriangle size={16} />
                    <span>检测到<strong>旧版服装数据格式</strong>，将仅导入 {restorePreview.costumeCount} 条服装档案，其他数据表将保持当前内容。</span>
                  </div>
                {:else}
                  <div class="db-info-row">
                    <span>备份版本</span>
                    <strong>{restorePreview.version ? `v${restorePreview.version}` : '未知版本'}</strong>
                  </div>
                  <div class="db-stats-grid db-stats-small">
                    <div class="db-stat-card">
                      <div class="db-stat-num">{restorePreview.tables.costumes || 0}</div>
                      <div class="db-stat-label">服装</div>
                    </div>
                    <div class="db-stat-card">
                      <div class="db-stat-num">{restorePreview.tables.records || 0}</div>
                      <div class="db-stat-label">记录</div>
                    </div>
                    <div class="db-stat-card">
                      <div class="db-stat-num">{restorePreview.tables.reservations || 0}</div>
                      <div class="db-stat-label">预约</div>
                    </div>
                    <div class="db-stat-card">
                      <div class="db-stat-num">{restorePreview.tables.workOrders || 0}</div>
                      <div class="db-stat-label">工单</div>
                    </div>
                    <div class="db-stat-card">
                      <div class="db-stat-num">{restorePreview.tables.actors || 0}</div>
                      <div class="db-stat-label">演员</div>
                    </div>
                    <div class="db-stat-card">
                      <div class="db-stat-num">{restorePreview.tables.packingLists || 0}</div>
                      <div class="db-stat-label">装箱单</div>
                    </div>
                    <div class="db-stat-card">
                      <div class="db-stat-num">{restorePreview.tables.inventoryTasks || 0}</div>
                      <div class="db-stat-label">盘点任务</div>
                    </div>
                    <div class="db-stat-card">
                      <div class="db-stat-num">{restorePreview.tables.inventoryItems || 0}</div>
                      <div class="db-stat-label">盘点明细</div>
                    </div>
                  </div>
                {/if}
                <div class="data-manager-actions">
                  <button type="button" class="secondary" on:click={clearRestorePreview}>取消</button>
                  <button type="button" class="danger" on:click={confirmRestore}>
                    <RefreshCw size={16} />确认恢复（覆盖当前数据）
                  </button>
                </div>
              </div>
            {/if}
          </div>

          <div class="data-manager-section">
            <h3><ArrowRightLeft size={16} />离线多设备合并导入</h3>
            <p class="hint">
              导入另一台电脑的<strong>完整备份</strong>，系统将比对差异，展示按表分类的变更预览（新增、相同、字段冲突、疑似删除、跨表引用风险）。
              逐条确认后合并，不会简单覆盖；服装ID冲突时将自动修正预约、工单、装箱单中的引用。
            </p>
            {#if mergeSuccess}
              <div class="import-summary success">
                <CheckCircle size={16} />
                <span>{mergeSuccess}</span>
              </div>
            {/if}
            {#if mergeError}
              <div class="import-summary warning">
                <AlertTriangle size={16} />
                <span>{mergeError}</span>
              </div>
            {/if}
            {#if dbStats?.meta?.lastMergeAt}
              <p class="hint" style="margin-top: 6px;">上次合并时间：{formatTime(dbStats.meta.lastMergeAt)} · 本设备ID：<code style="background:#f0e6d6;padding:1px 6px;border-radius:3px;font-size:12px;">{dbStats.meta.deviceId}</code></p>
            {:else if dbStats?.meta?.deviceId}
              <p class="hint" style="margin-top: 6px;">本设备ID：<code style="background:#f0e6d6;padding:1px 6px;border-radius:3px;font-size:12px;">{dbStats.meta.deviceId}</code></p>
            {/if}
            <label class="file-input-label">
              <Upload size={16} />选择备份文件进行合并
              <input type="file" accept=".json" on:change={handleMergeFile} hidden />
            </label>
          </div>

          {#if isLegacyDataPresent()}
            <div class="data-manager-section">
              <h3><AlertTriangle size={16} />旧版数据</h3>
              <p class="hint">检测到浏览器中仍有旧版分散的 localStorage 数据（zfl-2-costumes 等）。迁移完成后可安全清理。</p>
              <div class="data-manager-actions">
                <button type="button" class="danger-outline" on:click={cleanLegacyData}>
                  <Trash2 size={16} />清除旧版数据
                </button>
              </div>
            </div>
          {/if}
        </div>
      </div>
    </div>
  {/if}

  {#if showMergePanel && mergeDiffResult}
    <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
    <div class="modal-overlay merge-overlay" role="presentation" on:click={closeMergePanel}>
      <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
      <div
        class="modal merge-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="merge-title"
        on:click|stopPropagation
        on:keydown={handleModalKeydown}
        tabindex="-1"
      >
        <MergePanel
          diffResult={mergeDiffResult}
          bind:decisions={mergeDecisions}
          importFileName={mergeFileName}
          importMeta={mergeImportDB?._meta}
          onClose={closeMergePanel}
          onConfirmMerge={handleConfirmMerge}
        />
      </div>
    </div>
  {/if}
</main>

<style>
  * { box-sizing: border-box; }
  :global(body) { margin: 0; background: #f6f1ea; color: #26211c; font-family: Inter, "PingFang SC", Arial, sans-serif; }
  button, input, select { font: inherit; }
  main { min-height: 100vh; padding: 28px; }
  .hero { display: flex; justify-content: space-between; gap: 20px; align-items: end; padding: 30px; border-radius: 8px; color: #fff; background: linear-gradient(135deg, #332019, #8a5b41); }
  .hero span { opacity: .75; }
  h1 { margin: 8px 0 0; font-size: clamp(32px, 5vw, 54px); letter-spacing: 0; }
  h2 { margin: 0 0 16px; font-size: 18px; }
  .stats { display: flex; flex-wrap: wrap; gap: 10px; }
  .stats b { display: inline-flex; align-items: center; gap: 7px; padding: 10px 12px; border: 1px solid rgb(255 255 255 / .22); border-radius: 8px; background: rgb(255 255 255 / .12); }
  .danger { color: #ffd0c2; }
  .workorder-stats { margin: 16px 0; }
  .stats-panel { background: #fff; border: 1px solid #e4d8cc; border-radius: 8px; padding: 20px; box-shadow: 0 12px 30px rgb(62 42 24 / .08); }
  .stats-title { font-size: 16px; font-weight: 600; color: #3b2f26; margin-bottom: 16px; display: flex; align-items: center; gap: 8px; }
  .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; }
  .stat-card { display: flex; align-items: center; gap: 14px; padding: 16px; border-radius: 10px; border: 1px solid #eadfd4; background: #fffaf5; transition: transform .15s ease, box-shadow .15s ease; }
  .stat-card:hover { transform: translateY(-2px); box-shadow: 0 6px 18px rgb(62 42 24 / .1); }
  .stat-icon { width: 48px; height: 48px; border-radius: 10px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
  .stat-pending .stat-icon { background: #e6eef6; color: #1a4a8a; }
  .stat-progress .stat-icon { background: #fff4e6; color: #8a5a1a; }
  .stat-done .stat-icon { background: #e6f0e6; color: #2d5a2d; }
  .stat-overdue .stat-icon { background: #f6e6e6; color: #8a2d2d; }
  .stat-overdue.has-overdue { border-color: #d98664; background: #fff5ef; }
  .stat-content { flex: 1; }
  .stat-number { font-size: 28px; font-weight: 700; color: #26211c; line-height: 1; }
  .stat-label { font-size: 13px; color: #6b5a4d; margin-top: 4px; }
  .layout { display: grid; grid-template-columns: 340px 1fr; gap: 16px; margin: 16px 0; align-items: start; }
  .panel { background: #fff; border: 1px solid #e4d8cc; border-radius: 8px; padding: 18px; box-shadow: 0 12px 30px rgb(62 42 24 / .08); }
  form.panel { display: flex; flex-direction: column; gap: 10px; }
  input, select { width: 100%; border: 1px solid #d8c8ba; border-radius: 8px; padding: 11px 12px; background: #fff; color: #26211c; }
  button { border: 0; border-radius: 8px; padding: 11px 13px; background: #603d2d; color: #fff; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; gap: 7px; }
  .split { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  .toolbar { display: grid; grid-template-columns: 1fr 190px auto; gap: 10px; align-items: center; margin-bottom: 14px; }
  .toolbar label:first-child { display: flex; align-items: center; gap: 8px; border: 1px solid #d8c8ba; border-radius: 8px; padding: 0 10px; }
  .toolbar label:first-child input { border: 0; padding-left: 0; }
  .check { display: flex; align-items: center; gap: 8px; white-space: nowrap; }
  .check input { width: auto; }
  .cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 12px; }
  article { position: relative; border: 1px solid #eadfd4; border-radius: 8px; padding: 16px; background: #fffaf5; }
  article strong, article span { display: block; }
  article span, article p { color: #6b5a4d; }
  .item-overdue { border-color: #d98664; background: #fff5ef; }
  .card-overlay-btn { position: absolute; inset: 0; background: transparent; border: 0; padding: 0; cursor: pointer; border-radius: 8px; z-index: 1; }
  .card-overlay-btn:focus-visible { outline: 2px solid #603d2d; outline-offset: 2px; }
  .actions { position: relative; z-index: 2; display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
  .secondary { background: #efe4d9; color: #37261d; }
  .playGrid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 10px; }
  .playGrid button { justify-content: space-between; background: #f6efe7; color: #2a211b; border: 1px solid #e3d4c7; }
  .card-clickable { cursor: pointer; transition: transform .15s ease, box-shadow .15s ease; }
  .card-clickable:hover { transform: translateY(-2px); box-shadow: 0 6px 18px rgb(62 42 24 / .12); }
  .modal-overlay { position: fixed; inset: 0; background: rgb(38 33 28 / .55); display: flex; align-items: center; justify-content: center; padding: 16px; z-index: 100; }
  .modal { background: #fff; border-radius: 12px; width: 100%; max-width: 520px; max-height: 90vh; overflow-y: auto; box-shadow: 0 24px 60px rgb(38 33 28 / .25); }
  .modal-header { display: flex; justify-content: space-between; align-items: center; padding: 18px 20px; border-bottom: 1px solid #e4d8cc; position: sticky; top: 0; background: #fff; border-radius: 12px 12px 0 0; }
  .modal-header h2 { margin: 0; }
  .icon-btn { background: transparent; color: #6b5a4d; padding: 6px; border-radius: 6px; }
  .icon-btn:hover { background: #f6efe7; }
  .detail-form, .lend-form { padding: 18px 20px 20px; display: flex; flex-direction: column; gap: 12px; }
  .detail-form label, .lend-form label { display: flex; flex-direction: column; gap: 6px; font-size: 14px; color: #6b5a4d; }
  .detail-form label span, .lend-form label span { font-weight: 500; }
  .status-info { background: #f6efe7; border-radius: 8px; padding: 12px 14px; margin: 4px 0; }
  .status-info p { margin: 4px 0; font-size: 14px; color: #4a3b30; }
  .modal-actions { display: flex; justify-content: space-between; gap: 10px; margin-top: 8px; flex-wrap: wrap; }
  .modal-actions button { flex: 1; min-width: 140px; }
  .danger { background: #b84a3b; }
  .danger:hover { background: #a03e30; }
  .danger-outline { background: transparent; color: #b84a3b; border: 1px solid #d9b5ad; }
  .danger-outline:hover { background: #fdf0ec; }
  .confirm-box { padding: 24px 20px; }
  .confirm-box p { margin: 0 0 18px; font-size: 15px; line-height: 1.6; color: #3b2f26; }
  .confirm-actions { display: flex; gap: 10px; justify-content: flex-end; flex-wrap: wrap; }
  .confirm-actions button { min-width: 100px; }
  .import-export-btns { display: flex; gap: 10px; margin-bottom: 10px; }
  .import-export-btns button { flex: 1; }
  .file-input-label { display: inline-flex; align-items: center; justify-content: center; gap: 7px; padding: 11px 13px; border-radius: 8px; background: #603d2d; color: #fff; cursor: pointer; font: inherit; border: 0; }
  .hint { margin: 0; font-size: 13px; color: #8a7665; line-height: 1.5; }
  .modal-wide { max-width: 640px; }
  .import-content { padding: 18px 20px 20px; display: flex; flex-direction: column; gap: 14px; }
  .file-info { margin: 0; padding: 10px 14px; background: #f6efe7; border-radius: 8px; font-size: 14px; color: #4a3b30; }
  .import-summary { display: flex; align-items: center; gap: 10px; padding: 12px 14px; border-radius: 8px; font-size: 14px; }
  .import-summary.success { background: #eef6ee; color: #2d5a2d; }
  .import-summary.warning { background: #fff4e6; color: #8a5a1a; }
  .import-summary strong { font-weight: 600; }
  .preview-section { display: flex; flex-direction: column; gap: 8px; }
  .preview-section h3 { margin: 0; font-size: 15px; font-weight: 600; color: #3b2f26; }
  .preview-list { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 8px; max-height: 200px; overflow-y: auto; padding: 8px; background: #faf6f2; border-radius: 8px; }
  .preview-item { padding: 10px 12px; background: #fff; border: 1px solid #e4d8cc; border-radius: 6px; }
  .preview-item strong { display: block; font-size: 14px; margin-bottom: 2px; }
  .preview-item span { font-size: 12px; color: #6b5a4d; }
  .skipped-list { display: flex; flex-direction: column; gap: 6px; max-height: 160px; overflow-y: auto; padding: 8px; background: #faf6f2; border-radius: 8px; }
  .skipped-item { display: grid; grid-template-columns: 60px 1fr 1fr; gap: 10px; padding: 8px 12px; background: #fff; border: 1px dashed #e0c9b8; border-radius: 6px; font-size: 13px; align-items: center; }
  .skipped-index { color: #b84a3b; font-weight: 500; }
  .skipped-name, .skipped-play { color: #6b5a4d; }
  button:disabled { opacity: .5; cursor: not-allowed; }
  .record-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
  .record-header h2 { display: flex; align-items: center; gap: 8px; margin: 0; }
  .record-count { font-size: 13px; color: #8a7665; }
  .record-toolbar { margin-bottom: 14px; }
  .record-toolbar label { display: flex; align-items: center; gap: 8px; border: 1px solid #d8c8ba; border-radius: 8px; padding: 0 10px; }
  .record-toolbar label input { border: 0; padding-left: 0; }
  .record-list { display: flex; flex-direction: column; gap: 10px; max-height: 500px; overflow-y: auto; }
  .record-item { display: flex; gap: 12px; padding: 14px; border: 1px solid #eadfd4; border-radius: 8px; background: #fffaf5; }
  .record-type-badge { display: inline-flex; align-items: center; gap: 5px; padding: 4px 10px; border-radius: 6px; font-size: 12px; font-weight: 500; flex-shrink: 0; height: fit-content; }
  .record-type-新增 { background: #e6f0e6; color: #2d5a2d; }
  .record-type-借出 { background: #fff0e6; color: #8a4a1a; }
  .record-type-归还 { background: #e6eef6; color: #1a4a8a; }
  .record-type-清洗 { background: #f0e6f6; color: #5a1a8a; }
  .record-type-预约 { background: #e6eef6; color: #1a4a8a; }
  .record-type-取消预约 { background: #f6e6e6; color: #8a2d2d; }
  .record-type-已过期 { background: #fff4e6; color: #8a5a1a; }
  .record-type-工单创建 { background: #e6f0f6; color: #1a5a8a; }
  .record-type-工单更新 { background: #fff4e6; color: #8a5a1a; }
  .record-type-维修 { background: #f6e6e6; color: #8a1a2d; }
  .record-type-装箱单创建 { background: #e6f0e6; color: #2d5a2d; }
  .record-type-装箱单删除 { background: #f6e6e6; color: #8a2d2d; }
  .item-in-workorder { border-color: #c9a67e; background: #fff8f0; }
  .workorder-info { display: inline-flex; align-items: center; gap: 4px; margin: 4px 0 0; padding: 4px 10px; background: #fff4e6; color: #8a5a1a; border-radius: 6px; font-size: 12px; }
  .record-content { flex: 1; min-width: 0; }
  .record-title-row { display: flex; align-items: center; gap: 10px; margin-bottom: 6px; flex-wrap: wrap; }
  .record-name { font-size: 15px; color: #26211c; }
  .record-play-tag { font-size: 12px; color: #6b5a4d; background: #f0e6dc; padding: 2px 8px; border-radius: 4px; display: inline-flex; align-items: center; gap: 4px; }
  .reservation-date-tag { background: #e6eef6; color: #1a4a8a; }
  .record-summary { margin: 0 0 8px; font-size: 13px; color: #4a3b30; line-height: 1.5; }
  .record-footer { display: flex; justify-content: space-between; align-items: center; gap: 10px; flex-wrap: wrap; }
  .record-operator { font-size: 12px; color: #6b5a4d; }
  .record-time { font-size: 12px; color: #8a7665; font-family: 'SF Mono', Monaco, 'Courier New', monospace; }
  .record-empty { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 40px 20px; color: #8a7665; }
  .record-empty p { margin: 0; font-size: 15px; color: #6b5a4d; }
  .record-empty span { font-size: 13px; }
  .record-toolbar { display: grid; grid-template-columns: 1fr 150px; gap: 10px; align-items: center; }
  .reservation-info { display: inline-flex; align-items: center; gap: 4px; margin: 4px 0 0; padding: 4px 10px; background: #e6eef6; color: #1a4a8a; border-radius: 6px; font-size: 12px; }
  .record-cancelled { opacity: 0.55; background: #faf6f2; }
  .record-overdue { border-color: #e0c9b8; background: #fff8f0; }
  .small-btn { padding: 5px 10px; font-size: 12px; min-height: auto; }
  .clean-status-tag { display: inline-flex; align-items: center; gap: 4px; padding: 5px 10px; border-radius: 6px; font-size: 12px; font-weight: 500; background: #fff4e6; color: #8a5a1a; border: 1px solid #e0c9a8; }
  .conflict-box { background: #fff4e6; border: 1px solid #e0c9a8; border-radius: 8px; padding: 12px 14px; }
  .conflict-title { display: flex; align-items: center; gap: 8px; color: #8a5a1a; margin-bottom: 8px; }
  .conflict-item { margin: 2px 0; font-size: 13px; color: #6b4a2a; }
  .actor-layout { display: grid; grid-template-columns: 280px 1fr; gap: 16px; align-items: start; }
  .actor-form { display: flex; flex-direction: column; gap: 10px; padding: 14px; background: #faf6f2; border-radius: 8px; border: 1px solid #e4d8cc; }
  .actor-list-wrapper { display: flex; flex-direction: column; gap: 10px; }
  .actor-list { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 10px; max-height: 400px; overflow-y: auto; padding-right: 4px; }
  .actor-card { padding: 14px; border: 1px solid #eadfd4; border-radius: 8px; background: #fffaf5; cursor: pointer; transition: transform .15s ease, box-shadow .15s ease; }
  .actor-card:hover { transform: translateY(-2px); box-shadow: 0 6px 18px rgb(62 42 24 / .12); }
  .actor-card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
  .actor-name { font-size: 15px; color: #26211c; }
  .actor-size-tag { font-size: 12px; color: #1a4a8a; background: #e6eef6; padding: 2px 8px; border-radius: 4px; font-weight: 500; }
  .actor-plays { display: flex; flex-wrap: wrap; gap: 4px; margin-bottom: 6px; }
  .actor-note { margin: 0; font-size: 12px; color: #6b5a4d; line-height: 1.4; }
  .play-card { flex-direction: column; align-items: flex-start; padding: 14px; text-align: left; gap: 8px; }
  .play-card strong { font-size: 15px; }
  .play-card-stats { display: flex; gap: 12px; }
  .play-card-stats span { display: inline-flex; align-items: center; gap: 4px; font-size: 12px; color: #6b5a4d; background: transparent; padding: 0; }
  .play-match-summary { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 4px; }
  .mini-match { font-size: 11px; padding: 2px 6px; border-radius: 4px; background: #f0e6dc; color: #6b5a4d; }
  .size-match-box { border-radius: 8px; padding: 12px 14px; border: 1px solid; }
  .size-match-box.match-perfect { background: #eef6ee; border-color: #b8d8b8; color: #2d5a2d; }
  .size-match-box.match-close { background: #fff4e6; border-color: #e0c9a8; color: #8a5a1a; }
  .size-match-box.match-mismatch { background: #fdecea; border-color: #e0b8b0; color: #8a2d2d; }
  .size-match-box.match-unknown { background: #f6efe7; border-color: #e4d8cc; color: #6b5a4d; }
  .size-match-title { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
  .size-match-detail { margin: 2px 0; font-size: 13px; }
  .match-badge { display: inline-flex; align-items: center; padding: 3px 10px; border-radius: 6px; font-size: 12px; font-weight: 500; }
  .match-badge.match-perfect { background: #e6f0e6; color: #2d5a2d; }
  .match-badge.match-close { background: #fff4e6; color: #8a5a1a; }
  .match-badge.match-mismatch { background: #f6e6e6; color: #8a2d2d; }
  .match-badge.match-unknown { background: #f6efe7; color: #6b5a4d; }
  .mini-match.match-perfect { background: #e6f0e6; color: #2d5a2d; }
  .mini-match.match-close { background: #fff4e6; color: #8a5a1a; }
  .mini-match.match-mismatch { background: #f6e6e6; color: #8a2d2d; }
  .actor-match-row { display: flex; justify-content: space-between; align-items: center; padding: 6px 0; border-bottom: 1px dashed #e4d8cc; }
  .actor-match-row:last-child { border-bottom: none; }
  .actor-match-costume { font-size: 13px; color: #3b2f26; }
  @media (max-width: 900px) { main { padding: 16px; } .hero { align-items: start; flex-direction: column; } .layout, .toolbar, .record-toolbar, .actor-layout { grid-template-columns: 1fr; } .split { grid-template-columns: 1fr; } .modal { max-height: 95vh; } .modal-actions button { min-width: 100%; } .skipped-item { grid-template-columns: 50px 1fr; } .skipped-play { grid-column: 2; } .record-item { flex-direction: column; } .record-footer { flex-direction: column; align-items: flex-start; } .stats-grid { grid-template-columns: repeat(2, 1fr); } .stat-number { font-size: 22px; } .stat-card { padding: 12px; gap: 10px; } .stat-icon { width: 40px; height: 40px; } .actor-list { grid-template-columns: 1fr; } .packing-detail-summary { grid-template-columns: repeat(3, 1fr) !important; } .packing-modal { max-width: 100% !important; } .packing-costume-list { grid-template-columns: 1fr !important; } }

  .packing-list-item { align-items: center; }
  .packing-modal { max-width: 780px !important; }
  .packing-section { margin-top: 10px; padding: 14px; background: #faf6f2; border-radius: 8px; border: 1px solid #e4d8cc; display: flex; flex-direction: column; gap: 10px; }
  .packing-section-title { font-size: 14px; color: #3b2f26; font-weight: 600; display: flex; align-items: center; justify-content: space-between; }
  .packing-items-list { display: flex; flex-direction: column; gap: 8px; max-height: 220px; overflow-y: auto; }
  .packing-item-row { display: flex; justify-content: space-between; align-items: center; gap: 10px; padding: 10px 12px; background: #fff; border: 1px solid #e4d8cc; border-radius: 8px; }
  .packing-item-row.packing-item-has-alert { border-color: #e0b8b0; background: #fff8f5; }
  .packing-item-info { display: flex; flex-direction: column; gap: 3px; min-width: 0; flex: 1; }
  .packing-item-info strong { font-size: 14px; color: #26211c; }
  .packing-item-info span { font-size: 12px; color: #6b5a4d; }
  .packing-item-alerts { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 4px; }
  .packing-alert-tag { display: inline-flex; align-items: center; gap: 3px; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 500; }
  .packing-alert-borrowed { background: #fff0e6; color: #8a4a1a; }
  .packing-alert-overdue { background: #fdecea; color: #8a2d2d; }
  .packing-alert-workorder { background: #fff4e6; color: #8a5a1a; }

  .packing-generated-notice {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    padding: 12px 14px;
    background: #eef6ee;
    border: 1px solid #b8d8b8;
    border-radius: 8px;
    font-size: 13px;
    color: #2d5a2d;
    line-height: 1.5;
  }

  .packing-items-summary {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
  }

  .packing-summary-tag {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    padding: 2px 8px;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 500;
    background: #f6efe7;
    color: #6b5a4d;
  }

  .packing-summary-tag.packing-summary-missing {
    background: #fdecea;
    color: #8a2d2d;
  }

  .packing-summary-tag.packing-summary-clean {
    background: #e6eef6;
    color: #1a4a8a;
  }

  .packing-item-title-row {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
    margin-bottom: 2px;
  }

  .packing-item-status {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    padding: 2px 8px;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 500;
  }

  .packing-item-source {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    padding: 2px 8px;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 500;
    background: #f0e6dc;
    color: #6b5a4d;
  }

  .packing-item-note {
    font-size: 12px;
    color: #8a5a2d;
    margin-top: 2px;
  }
  .packing-costume-list { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 8px; max-height: 280px; overflow-y: auto; padding-right: 4px; }
  .packing-costume-card { display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; padding: 10px 12px; background: #fff; border: 1px solid #e4d8cc; border-radius: 8px; cursor: pointer; text-align: left; transition: transform .15s ease, box-shadow .15s ease, border-color .15s ease; }
  .packing-costume-card:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgb(62 42 24 / .1); border-color: #c9a67e; }
  .packing-costume-card.packing-item-has-alert { border-color: #e0b8b0; background: #fff8f5; }
  .packing-costume-main { display: flex; flex-direction: column; gap: 2px; min-width: 0; flex: 1; }
  .packing-costume-main strong { font-size: 13px; color: #26211c; }
  .packing-costume-main span { font-size: 11px; color: #6b5a4d; }
  .packing-costume-loc { color: #8a7665 !important; }
  .packing-costume-side { display: flex; flex-direction: column; align-items: flex-end; gap: 4px; flex-shrink: 0; }
  .packing-add-icon { color: #603d2d; margin-top: 4px; }
  .packing-detail-overlay { z-index: 150; }
  .packing-detail-modal { max-width: 960px !important; max-height: 92vh; }
  .packing-detail-overlay.printing { background: #fff !important; padding: 0; }
  .packing-detail-modal.printing { box-shadow: none !important; border-radius: 0 !important; max-width: 100% !important; max-height: 100% !important; width: 100% !important; height: 100% !important; overflow: visible !important; }
  .packing-detail-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; padding: 18px 24px; border-bottom: 1px solid #e4d8cc; background: #fffaf5; border-radius: 12px 12px 0 0; position: sticky; top: 0; z-index: 5; }
  .packing-detail-modal.printing .packing-detail-header { border-radius: 0; background: #fff; padding: 0 0 16px; }
  .packing-detail-header h2 { display: inline-flex; align-items: center; gap: 8px; margin: 0 0 6px; font-size: 20px; }
  .packing-detail-meta { display: flex; flex-wrap: wrap; gap: 6px; }
  .packing-detail-actions { display: flex; gap: 8px; align-items: center; flex-shrink: 0; }
  .packing-detail-body { padding: 20px 24px 24px; display: flex; flex-direction: column; gap: 16px; }
  .packing-detail-modal.printing .packing-detail-body { padding: 0; }
  .packing-detail-summary { display: grid; grid-template-columns: repeat(6, 1fr); gap: 10px; }
  .packing-summary-card { padding: 12px; border-radius: 8px; background: #faf6f2; border: 1px solid #e4d8cc; text-align: center; }
  .packing-summary-num { font-size: 26px; font-weight: 700; color: #26211c; line-height: 1.1; }
  .packing-summary-label { font-size: 12px; color: #6b5a4d; margin-top: 4px; }
  .packing-summary-card.packing-status-packed { background: #eef6ee; border-color: #b8d8b8; }
  .packing-summary-card.packing-status-packed .packing-summary-num { color: #2d5a2d; }
  .packing-summary-card.packing-status-missing { background: #fdecea; border-color: #e0b8b0; }
  .packing-summary-card.packing-status-missing .packing-summary-num { color: #8a2d2d; }
  .packing-summary-card.packing-status-clean { background: #e6eef6; border-color: #b8c8e0; }
  .packing-summary-card.packing-status-clean .packing-summary-num { color: #1a4a8a; }
  .packing-summary-card.packing-status-returned { background: #f0e6f6; border-color: #d4b8e0; }
  .packing-summary-card.packing-status-returned .packing-summary-num { color: #5a1a8a; }
  .packing-summary-card.packing-status-pending { background: #f6efe7; border-color: #e4d8cc; }
  .packing-summary-card.packing-status-pending .packing-summary-num { color: #6b5a4d; }
  .packing-detail-table-wrap { background: #fff; border: 1px solid #e4d8cc; border-radius: 8px; overflow: hidden; }
  .packing-detail-table { width: 100%; border-collapse: collapse; font-size: 13px; }
  .packing-detail-table th { background: #faf6f2; padding: 10px 12px; text-align: left; font-weight: 600; color: #3b2f26; border-bottom: 1px solid #e4d8cc; font-size: 12px; }
  .packing-detail-table td { padding: 10px 12px; border-bottom: 1px solid #f0e6dc; color: #3b2f26; vertical-align: middle; }
  .packing-detail-table tr:last-child td { border-bottom: none; }
  .packing-detail-table tr.packing-row-alert { background: #fff8f5; }
  .packing-detail-table tr.packing-row-alert td { border-bottom-color: #f5e0d8; }
  .packing-cell-center { text-align: center !important; color: #8a7665 !important; font-size: 12px; }
  .packing-status-badge { display: inline-flex; align-items: center; gap: 5px; padding: 4px 10px; border-radius: 6px; font-size: 12px; font-weight: 500; }
  .packing-status-badge.packing-status-packed { background: #e6f0e6; color: #2d5a2d; }
  .packing-status-badge.packing-status-missing { background: #f6e6e6; color: #8a2d2d; }
  .packing-status-badge.packing-status-clean { background: #e6eef6; color: #1a4a8a; }
  .packing-status-badge.packing-status-returned { background: #f0e6f6; color: #5a1a8a; }
  .packing-status-badge.packing-status-pending { background: #f6efe7; color: #6b5a4d; }
  .packing-alerts-inline { display: flex; flex-direction: column; gap: 3px; }
  .packing-status-actions { display: flex; gap: 6px; }
  .small-select { width: auto; padding: 6px 8px; font-size: 12px; min-height: auto; }
  .packing-detail-footer { padding-top: 16px; border-top: 1px dashed #e4d8cc; }
  .packing-signature { display: flex; gap: 30px; flex-wrap: wrap; justify-content: flex-end; }
  .packing-signature-item { display: flex; align-items: center; gap: 8px; font-size: 13px; color: #6b5a4d; }
  .packing-signature-line { display: inline-block; min-width: 140px; border-bottom: 1px solid #3b2f26; height: 20px; }
  .packing-print-footer { margin-top: 40px; }
  .packing-print-footer .packing-signature { gap: 40px; justify-content: space-between; }

  @media print {
    :global(body) { background: #fff !important; }
    main { padding: 0 !important; }
    .hero, .workorder-stats, .panel, section:not(.packing-detail-overlay), .modal-overlay:not(.printing) { display: none !important; }
    .packing-detail-overlay.printing { position: static !important; background: #fff !important; padding: 20px !important; display: block !important; }
    .packing-detail-modal.printing { position: static !important; max-width: 100% !important; max-height: none !important; box-shadow: none !important; border: none !important; padding: 0 !important; display: block !important; overflow: visible !important; }
    .packing-detail-header, .packing-detail-body, .packing-detail-footer { border: none !important; background: #fff !important; }
    .packing-status-actions, .packing-detail-actions { display: none !important; }
    .packing-detail-table { font-size: 11px; }
    .packing-detail-table th, .packing-detail-table td { padding: 6px 8px; }
    .packing-summary-card { padding: 8px; }
    .packing-summary-num { font-size: 20px; }
  }

  .hero-data-btn {
    background: rgb(255 255 255 / .18) !important;
    border: 1px solid rgb(255 255 255 / .28) !important;
    color: #fff !important;
    padding: 10px 12px !important;
  }
  .hero-data-btn:hover { background: rgb(255 255 255 / .28) !important; }

  .migration-notice {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    margin: 16px 0 0;
    padding: 14px 18px;
    background: #fff8e6;
    border: 1px solid #e0c98a;
    border-radius: 8px;
  }
  .migration-notice-content {
    display: flex;
    align-items: center;
    gap: 10px;
    color: #6b4a1a;
    font-size: 14px;
    flex: 1;
  }
  .migration-notice .icon-btn { color: #6b4a1a; }
  .migration-notice .icon-btn:hover { background: #fff0cc; }

  .data-manager-body {
    padding: 20px;
    display: flex;
    flex-direction: column;
    gap: 22px;
  }
  .data-manager-section {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 16px;
    background: #faf6f2;
    border: 1px solid #e4d8cc;
    border-radius: 8px;
  }
  .data-manager-section h3 {
    margin: 0;
    font-size: 15px;
    font-weight: 600;
    color: #3b2f26;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .data-manager-section .hint {
    margin: 0;
  }
  .data-manager-actions {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
  }
  .data-manager-actions button {
    flex: 1;
    min-width: 160px;
  }

  .db-info-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 0;
    border-bottom: 1px dashed #e4d8cc;
    font-size: 14px;
  }
  .db-info-row:last-child { border-bottom: none; }
  .db-info-row span { color: #6b5a4d; }
  .db-info-row strong { color: #26211c; font-weight: 600; }

  .db-stats-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
    gap: 8px;
    margin-top: 8px;
  }
  .db-stats-grid.db-stats-small .db-stat-card { padding: 10px 8px; }
  .db-stats-grid.db-stats-small .db-stat-num { font-size: 20px; }
  .db-stat-card {
    padding: 12px 10px;
    background: #fff;
    border: 1px solid #e4d8cc;
    border-radius: 8px;
    text-align: center;
  }
  .db-stat-num {
    font-size: 24px;
    font-weight: 700;
    color: #603d2d;
    line-height: 1;
  }
  .db-stat-label {
    font-size: 12px;
    color: #6b5a4d;
    margin-top: 6px;
  }

  .restore-preview {
    display: flex;
    flex-direction: column;
    gap: 12px;
    margin-top: 4px;
  }

  .merge-overlay { z-index: 200; }
  .merge-modal {
    width: min(1100px, 96vw);
    max-height: 92vh;
    padding: 0;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }
</style>
