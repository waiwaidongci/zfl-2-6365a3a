import { globalIndex } from './dataIndex.js';
import { insertOne, updateOne, TABLES } from '$lib/database.js';
import { addRecord } from '$lib/recordsStore.js';

export function iso(offset = 0) {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return date.toISOString().slice(0, 10);
}

export function getReservationById(id) {
  return globalIndex.getReservationById(id);
}

export function filterReservations(options = {}) {
  return globalIndex.filterReservations(options);
}

export function getUpcomingReservations(costumeId) {
  return globalIndex.getUpcomingReservations(costumeId);
}

export function getLatestReservation(costumeId) {
  return globalIndex.getLatestReservation(costumeId);
}

export function checkConflict(costumeId, date, excludeId = null) {
  return globalIndex.checkConflict(costumeId, date, excludeId);
}

export function checkScheduleConflict(costumeId, date) {
  return globalIndex.checkScheduleConflict(costumeId, date);
}

export function createReservationInitialForm() {
  return {
    date: iso(1),
    type: '演员',
    reservedFor: '',
    note: ''
  };
}

export function createReservation(costumeId, formData, { extraSummary, addRecordFn } = {}) {
  if (!formData.reservedFor.trim() || !formData.date) {
    return { ok: false, error: '预约方和日期不能为空' };
  }
  const costume = globalIndex.getCostumeById(costumeId);
  if (!costume) {
    return { ok: false, error: '服装不存在' };
  }
  const conflicts = checkConflict(costumeId, formData.date);
  if (conflicts.length > 0) {
    return { ok: false, error: '该日期存在冲突' };
  }
  const reservation = {
    id: crypto.randomUUID(),
    costumeId: costume.id,
    costumeName: costume.name,
    play: costume.play,
    date: formData.date,
    type: formData.type,
    reservedFor: formData.reservedFor.trim(),
    createdAt: new Date().toISOString(),
    status: 'active',
    note: formData.note.trim()
  };
  insertOne(TABLES.reservations, reservation);
  let recordSummary = `预约「${costume.name}」于${formData.date}，${formData.type}：${formData.reservedFor.trim()}`;
  if (extraSummary) {
    recordSummary += `，${extraSummary}`;
  }
  const recordFn = addRecordFn || addRecord;
  recordFn('预约', costume, formData.reservedFor.trim(), recordSummary);
  return { ok: true, reservation };
}

export function cancelReservation(id, { addRecordFn } = {}) {
  const reservation = getReservationById(id);
  if (!reservation) {
    return { ok: false, error: '预约不存在' };
  }
  updateOne(TABLES.reservations, id, { status: 'cancelled' });
  const recordFn = addRecordFn || addRecord;
  recordFn(
    '取消预约',
    { name: reservation.costumeName, play: reservation.play },
    '系统',
    `取消「${reservation.costumeName}」于${reservation.date}的预约（${reservation.type}：${reservation.reservedFor}）`
  );
  return { ok: true };
}
