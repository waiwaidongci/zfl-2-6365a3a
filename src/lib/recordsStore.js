import { globalIndex } from './dataIndex.js';
import { insertOne, updateOne, TABLES } from '$lib/database.js';
import { createWorkOrder } from '$lib/workOrderStore.js';

export function iso(offset = 0) {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return date.toISOString().slice(0, 10);
}

export function formatDateTime(isoString) {
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

export function filterRecords(options = {}) {
  return globalIndex.filterRecords(options);
}

export function addRecord(type, costume, operator, summary) {
  const record = {
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    type,
    costumeName: costume.name,
    play: costume.play,
    operator,
    summary
  };
  insertOne(TABLES.records, record);
  return record;
}

export function canLend(costumeId) {
  return globalIndex.canLend(costumeId);
}

export function getCostumeById(id) {
  return globalIndex.getCostumeById(id);
}

export function lendCostume(costumeId, borrower, { sizeMatchInfo, addRecordFn } = {}) {
  const checkResult = canLend(costumeId);
  if (!checkResult.can) {
    return { ok: false, error: checkResult.reason };
  }
  const costume = getCostumeById(costumeId);
  if (!costume) {
    return { ok: false, error: '服装不存在' };
  }
  if (!borrower) {
    return { ok: false, error: '借用人不能为空' };
  }
  const dueDate = iso(7);
  updateOne(TABLES.costumes, costumeId, {
    borrower,
    due: dueDate,
    status: '借出'
  });
  let summary = `借出「${costume.name}」给${borrower}，应还日期：${dueDate}`;
  if (sizeMatchInfo) {
    summary += `，尺码匹配：${sizeMatchInfo}`;
  }
  const recordFn = addRecordFn || addRecord;
  recordFn('借出', costume, borrower, summary);
  return { ok: true, dueDate };
}

export function returnCostume(costumeId, { addRecordFn, createWorkOrderFn } = {}) {
  const costume = getCostumeById(costumeId);
  if (!costume) {
    return { ok: false, error: '服装不存在' };
  }
  const borrower = costume.borrower;
  updateOne(TABLES.costumes, costumeId, {
    borrower: '',
    due: '',
    status: '在库',
    clean: '待清洗'
  });
  const recordFn = addRecordFn || addRecord;
  recordFn('归还', costume, borrower, `${borrower}归还「${costume.name}」，状态变更为待清洗`);
  const woFn = createWorkOrderFn || createWorkOrder;
  woFn('清洗', costume, '张阿姨', `${borrower}归还后自动生成清洗工单`, { addRecordFn: recordFn });
  return { ok: true };
}

export function updateCostumeClean(costumeId, clean, { addRecordFn } = {}) {
  const costume = getCostumeById(costumeId);
  if (!costume) {
    return { ok: false, error: '服装不存在' };
  }
  const oldClean = costume.clean;
  updateOne(TABLES.costumes, costumeId, { clean });
  const recordFn = addRecordFn || addRecord;
  recordFn('清洗', costume, '系统', `「${costume.name}」清洗状态从「${oldClean}」变更为「${clean}」`);
  return { ok: true };
}

export function saveCostume(formData, { addRecordFn } = {}) {
  if (!formData.name.trim() || !formData.play.trim()) {
    return { ok: false, error: '名称和剧目不能为空' };
  }
  const newCostume = {
    id: crypto.randomUUID(),
    ...formData
  };
  insertOne(TABLES.costumes, newCostume);
  const recordFn = addRecordFn || addRecord;
  recordFn('新增', newCostume, '系统', `新增服装「${newCostume.name}」，剧目：${newCostume.play}，尺码：${newCostume.size || '未填'}，位置：${newCostume.location || '未填'}`);
  return { ok: true, costume: newCostume };
}
