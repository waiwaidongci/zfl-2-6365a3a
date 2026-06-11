<script>
  import { onMount } from 'svelte';
  import { Archive, CheckCircle2, Clock, Search, Shirt, Undo2, X, Trash2, Save, Download, Upload, AlertTriangle, CheckCircle, List, Plus, RotateCcw, Calendar, User, Users, XCircle, CalendarDays, Wrench, Droplets, Eye, MoreHorizontal } from 'lucide-svelte';

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

  let costumes = seed;
  let reservations = seedReservations;
  let workOrders = seedWorkOrders;
  let actors = seedActors;
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

  onMount(() => {
    const stored = localStorage.getItem('zfl-2-costumes');
    if (stored) costumes = JSON.parse(stored);
    const storedRecords = localStorage.getItem('zfl-2-records');
    if (storedRecords) records = JSON.parse(storedRecords);
    const storedReservations = localStorage.getItem('zfl-2-reservations');
    if (storedReservations) reservations = JSON.parse(storedReservations);
    const storedWorkOrders = localStorage.getItem('zfl-2-work-orders');
    if (storedWorkOrders) workOrders = JSON.parse(storedWorkOrders);
    const storedActors = localStorage.getItem('zfl-2-actors');
    if (storedActors) actors = JSON.parse(storedActors);
  });

  let localStorageAvailable = typeof localStorage !== 'undefined';

  function persist() {
    if (localStorageAvailable) {
      localStorage.setItem('zfl-2-costumes', JSON.stringify(costumes));
    }
  }

  function persistRecords() {
    if (localStorageAvailable) {
      localStorage.setItem('zfl-2-records', JSON.stringify(records));
    }
  }

  function persistReservations() {
    if (localStorageAvailable) {
      localStorage.setItem('zfl-2-reservations', JSON.stringify(reservations));
    }
  }

  function persistWorkOrders() {
    if (localStorageAvailable) {
      localStorage.setItem('zfl-2-work-orders', JSON.stringify(workOrders));
    }
  }

  function persistActors() {
    if (localStorageAvailable) {
      localStorage.setItem('zfl-2-actors', JSON.stringify(actors));
    }
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
      if (reservingId) {
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
      <b class:danger={overdueCount > 0}><AlertTriangle size={18} />{overdueCount}项逾期</b>
    </div>
  </header>

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
            <div class="actor-card" on:click={() => openActorDetail(actor)}>
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
            </div>
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
    <h2>数据导入导出</h2>
    <div class="import-export-btns">
      <button type="button" class="secondary" on:click={exportCostumes}>
        <Download size={16} />导出JSON
      </button>
      <label class="file-input-label">
        <Upload size={16} />导入JSON
        <input type="file" accept=".json" on:change={handleImportFile} hidden />
      </label>
    </div>
    <p class="hint">导出当前所有服装档案为JSON文件，或从JSON文件导入新的服装记录。</p>
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
  .import-export-btns button, .import-export-btns .file-input-label { flex: 1; }
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
  @media (max-width: 900px) { main { padding: 16px; } .hero { align-items: start; flex-direction: column; } .layout, .toolbar, .record-toolbar, .actor-layout { grid-template-columns: 1fr; } .split { grid-template-columns: 1fr; } .modal { max-height: 95vh; } .modal-actions button { min-width: 100%; } .skipped-item { grid-template-columns: 50px 1fr; } .skipped-play { grid-column: 2; } .record-item { flex-direction: column; } .record-footer { flex-direction: column; align-items: flex-start; } .stats-grid { grid-template-columns: repeat(2, 1fr); } .stat-number { font-size: 22px; } .stat-card { padding: 12px; gap: 10px; } .stat-icon { width: 40px; height: 40px; } .actor-list { grid-template-columns: 1fr; } }
</style>
