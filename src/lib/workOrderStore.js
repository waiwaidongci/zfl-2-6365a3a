import { globalIndex } from './dataIndex.js';
import { insertOne, updateOne, TABLES, EVENT_TYPES, updateOneWithEventType, startEventBatch, endEventBatch } from '$lib/database.js';

export function iso(offset = 0) {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return date.toISOString().slice(0, 10);
}

export function getActiveWorkOrder(costumeId) {
  return globalIndex.getActiveWorkOrder(costumeId);
}

export function getWorkOrderById(id) {
  return globalIndex.getWorkOrderById(id);
}

export function filterWorkOrders(options = {}) {
  return globalIndex.filterWorkOrders(options);
}

export function getAvailableStatuses(workOrder) {
  if (workOrder.type === '清洗') {
    if (workOrder.status === '待清洗') return ['待清洗', '清洗中', '已完成', '已取消'];
    if (workOrder.status === '清洗中') return ['清洗中', '已完成', '已取消'];
  } else {
    if (workOrder.status === '待维修') return ['待维修', '维修中', '已完成', '已取消'];
    if (workOrder.status === '维修中') return ['维修中', '已完成', '已取消'];
  }
  return [workOrder.status];
}

export function createWorkOrderInitialForm(type = '维修', costume = null) {
  const initialStatus = type === '清洗' ? '待清洗' : '待维修';
  const base = {
    type,
    costumeId: '',
    costumeName: '',
    play: '',
    status: initialStatus,
    assignee: type === '清洗' ? '张阿姨' : '李师傅',
    dueDate: iso(type === '清洗' ? 2 : 5),
    note: ''
  };
  if (costume) {
    base.costumeId = costume.id;
    base.costumeName = costume.name;
    base.play = costume.play;
  }
  return base;
}

function _updateCostumeCleanAndRecord(costumeId, newCleanStatus, addRecordFn) {
  if (!costumeId || !newCleanStatus) return;
  const costume = globalIndex.getCostumeById(costumeId);
  if (!costume) return;
  if (costume.clean === newCleanStatus) return;
  updateOne(TABLES.costumes, costumeId, { clean: newCleanStatus });
  if (addRecordFn) {
    addRecordFn('清洗', costume, '系统', `「${costume.name}」${newCleanStatus === '已清洗' ? '清洗状态从「' + costume.clean + '」变更为「已清洗」' : (newCleanStatus === '待清洗' ? '清洗状态变更为「待清洗」' : '状态变更为「维修中」')}`);
  }
}

function _addRecordFromData(type, costumeName, play, operator, summary, addRecordFn) {
  if (!addRecordFn) return;
  addRecordFn(type, { name: costumeName, play }, operator, summary);
}

export function createWorkOrder(type, costume, assignee = '', note = '', { addRecordFn } = {}) {
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
  insertOne(TABLES.workOrders, workOrder);
  if (addRecordFn) {
    addRecordFn('工单创建', costume, '系统', `创建${type}工单「${workOrder.id.slice(0, 8)}」，状态：${initialStatus}，负责人：${workOrder.assignee}`);
  }
  if (type === '清洗') {
    _updateCostumeCleanAndRecord(costume.id, '待清洗', addRecordFn);
  } else if (type === '维修') {
    _updateCostumeCleanAndRecord(costume.id, '维修中', addRecordFn);
  }
  return workOrder;
}

export function updateWorkOrderStatus(id, newStatus, { addRecordFn } = {}) {
  const workOrder = globalIndex.getWorkOrderById(id);
  if (!workOrder) return;
  const oldStatus = workOrder.status;
  if (oldStatus === newStatus) return;
  updateOneWithEventType(TABLES.workOrders, id, {
    status: newStatus,
    updatedAt: new Date().toISOString()
  }, EVENT_TYPES.WORK_ORDER_PROCESS, `工单状态变更：${oldStatus} → ${newStatus}`);
  if (addRecordFn) {
    addRecordFn('工单更新', { name: workOrder.costumeName, play: workOrder.play }, '系统', `工单「${id.slice(0, 8)}」状态从「${oldStatus}」变更为「${newStatus}」`);
  }
  if (newStatus === '已完成' && workOrder.type === '清洗') {
    const costumeToUpdate = globalIndex.getCostumeById(workOrder.costumeId);
    if (costumeToUpdate && costumeToUpdate.clean === '待清洗') {
      _updateCostumeCleanAndRecord(workOrder.costumeId, '已清洗', addRecordFn);
    }
  }
  if (newStatus === '已完成' && workOrder.type === '维修') {
    const costumeToUpdate = globalIndex.getCostumeById(workOrder.costumeId);
    if (costumeToUpdate && costumeToUpdate.clean === '维修中') {
      _updateCostumeCleanAndRecord(workOrder.costumeId, '已清洗', addRecordFn);
    }
  }
  if (newStatus === '已取消') {
    const costumeToUpdate = globalIndex.getCostumeById(workOrder.costumeId);
    if (costumeToUpdate) {
      const otherActiveWO = globalIndex.getActiveWorkOrdersByCostumeId(workOrder.costumeId).find(
        (wo) => wo.id !== id && (wo.status === '待清洗' || wo.status === '清洗中' || wo.status === '待维修' || wo.status === '维修中')
      );
      if (!otherActiveWO) {
        let newCleanStatus = '已清洗';
        if (costumeToUpdate.clean === '待清洗' || costumeToUpdate.clean === '维修中') {
          newCleanStatus = '已清洗';
        }
        _updateCostumeCleanAndRecord(workOrder.costumeId, newCleanStatus, addRecordFn);
      }
    }
  }
}

export function saveWorkOrder(formData, { creating, editingId, addRecordFn } = {}) {
  if (!formData.costumeId || !formData.assignee.trim()) return null;

  if (creating) {
    const costume = globalIndex.getCostumeById(formData.costumeId);
    if (!costume) return null;
    const workOrder = {
      id: crypto.randomUUID(),
      ...formData,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    insertOne(TABLES.workOrders, workOrder);
    if (addRecordFn) {
      addRecordFn('工单创建', costume, '系统', `创建${workOrder.type}工单「${workOrder.id.slice(0, 8)}」，状态：${workOrder.status}，负责人：${workOrder.assignee}`);
    }
    if (workOrder.type === '清洗' && (workOrder.status === '待清洗' || workOrder.status === '清洗中')) {
      _updateCostumeCleanAndRecord(costume.id, '待清洗', addRecordFn);
    } else if (workOrder.type === '维修' && (workOrder.status === '待维修' || workOrder.status === '维修中')) {
      _updateCostumeCleanAndRecord(costume.id, '维修中', addRecordFn);
    }
    return workOrder;
  } else if (editingId) {
    const oldWorkOrder = globalIndex.getWorkOrderById(editingId);
    if (!oldWorkOrder) return null;
    if (oldWorkOrder.status !== formData.status) {
      if (addRecordFn) {
        addRecordFn('工单更新', { name: oldWorkOrder.costumeName, play: oldWorkOrder.play }, '系统', `工单「${editingId.slice(0, 8)}」状态从「${oldWorkOrder.status}」变更为「${formData.status}」`);
      }
    }
    updateOneWithEventType(TABLES.workOrders, editingId, {
      ...formData,
      updatedAt: new Date().toISOString()
    }, EVENT_TYPES.WORK_ORDER_PROCESS, oldWorkOrder.status !== formData.status ? `工单状态变更：${oldWorkOrder.status} → ${formData.status}` : null);

    if (formData.status === '已完成' && formData.type === '清洗') {
      const costumeToUpdate = globalIndex.getCostumeById(formData.costumeId);
      if (costumeToUpdate && costumeToUpdate.clean === '待清洗') {
        _updateCostumeCleanAndRecord(formData.costumeId, '已清洗', addRecordFn);
      }
    }
    if (formData.status === '已完成' && formData.type === '维修') {
      const costumeToUpdate = globalIndex.getCostumeById(formData.costumeId);
      if (costumeToUpdate && costumeToUpdate.clean === '维修中') {
        _updateCostumeCleanAndRecord(formData.costumeId, '已清洗', addRecordFn);
      }
    }
    if ((formData.status === '待清洗' || formData.status === '清洗中') && formData.type === '清洗') {
      const costumeToUpdate = globalIndex.getCostumeById(formData.costumeId);
      if (costumeToUpdate && costumeToUpdate.clean !== '待清洗') {
        _updateCostumeCleanAndRecord(formData.costumeId, '待清洗', addRecordFn);
      }
    }
    if ((formData.status === '待维修' || formData.status === '维修中') && formData.type === '维修') {
      const costumeToUpdate = globalIndex.getCostumeById(formData.costumeId);
      if (costumeToUpdate && costumeToUpdate.clean !== '维修中') {
        _updateCostumeCleanAndRecord(formData.costumeId, '维修中', addRecordFn);
      }
    }
    if (formData.status === '已取消') {
      const costumeToUpdate = globalIndex.getCostumeById(formData.costumeId);
      if (costumeToUpdate) {
        const otherActiveWO = globalIndex.getActiveWorkOrdersByCostumeId(formData.costumeId).find(
          (wo) => wo.id !== editingId && (wo.status === '待清洗' || wo.status === '清洗中' || wo.status === '待维修' || wo.status === '维修中')
        );
        if (!otherActiveWO) {
          _updateCostumeCleanAndRecord(formData.costumeId, '已清洗', addRecordFn);
        }
      }
    }
    return { ...oldWorkOrder, ...formData };
  }
  return null;
}
