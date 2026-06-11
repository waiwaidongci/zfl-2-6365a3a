import { getAll, setAll, TABLES } from '$lib/database.js';

export function getAllSchedules() {
  return getAll(TABLES.schedules);
}

export function saveAllSchedules(schedules) {
  return setAll(TABLES.schedules, schedules);
}

export function addSchedule(schedule) {
  const schedules = getAllSchedules();
  const newSchedule = {
    id: crypto.randomUUID(),
    play: schedule.play || '',
    date: schedule.date || '',
    time: schedule.time || '',
    venue: schedule.venue || '',
    status: schedule.status || '待确认',
    note: schedule.note || '',
    linkedCostumeIds: schedule.linkedCostumeIds || [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...schedule
  };
  if (!newSchedule.id) newSchedule.id = crypto.randomUUID();
  schedules.unshift(newSchedule);
  saveAllSchedules(schedules);
  return newSchedule;
}

export function updateSchedule(id, updates) {
  const schedules = getAllSchedules();
  const idx = schedules.findIndex((s) => s.id === id);
  if (idx === -1) return null;
  schedules[idx] = { ...schedules[idx], ...updates, updatedAt: new Date().toISOString() };
  saveAllSchedules(schedules);
  return schedules[idx];
}

export function deleteSchedule(id) {
  const schedules = getAllSchedules();
  const filtered = schedules.filter((s) => s.id !== id);
  if (filtered.length !== schedules.length) {
    saveAllSchedules(filtered);
    return true;
  }
  return false;
}

export function getScheduleById(id) {
  const schedules = getAllSchedules();
  return schedules.find((s) => s.id === id) || null;
}

export function getSchedulesByDate(date) {
  const schedules = getAllSchedules();
  return schedules.filter((s) => s.date === date);
}

export function getSchedulesByPlay(play) {
  const schedules = getAllSchedules();
  return schedules.filter((s) => s.play === play);
}

export function getUniquePlays() {
  const schedules = getAllSchedules();
  return [...new Set(schedules.map((s) => s.play).filter(Boolean))];
}

export function getUpcomingSchedules(days = 30) {
  const schedules = getAllSchedules();
  const today = new Date();
  const future = new Date(today);
  future.setDate(future.getDate() + days);
  const todayStr = today.toISOString().slice(0, 10);
  const futureStr = future.toISOString().slice(0, 10);
  return schedules
    .filter((s) => s.date >= todayStr && s.date <= futureStr)
    .sort((a, b) => a.date.localeCompare(b.date) || (a.time || '').localeCompare(b.time || ''));
}

export function computeDailyRisk(date, costumes, reservations, workOrders, packingLists) {
  const daySchedules = getSchedulesByDate(date);
  const risks = [];
  const todayStr = new Date().toISOString().slice(0, 10);

  for (const schedule of daySchedules) {
    const scheduleRisks = [];

    const linkedIds = schedule.linkedCostumeIds || [];
    const relatedCostumes = costumes.filter((c) => linkedIds.includes(c.id));

    const playCostumes = costumes.filter((c) => c.play === schedule.play);
    const allRelevantCostumes = [...relatedCostumes];
    for (const pc of playCostumes) {
      if (!allRelevantCostumes.find((c) => c.id === pc.id)) {
        allRelevantCostumes.push(pc);
      }
    }

    for (const costume of allRelevantCostumes) {
      if (costume.status === '借出') {
        const isOverdue = costume.due && costume.due < todayStr;
        if (isOverdue) {
          scheduleRisks.push({
            level: 'high',
            type: 'overdue',
            costumeId: costume.id,
            costumeName: costume.name,
            message: `「${costume.name}」逾期未还：${costume.borrower}，应还${costume.due}`
          });
        } else if (costume.due && costume.due < date) {
          scheduleRisks.push({
            level: 'medium',
            type: 'borrowed',
            costumeId: costume.id,
            costumeName: costume.name,
            message: `「${costume.name}」借出至${costume.due}，演出前可能未归还`
          });
        } else {
          scheduleRisks.push({
            level: 'low',
            type: 'borrowed',
            costumeId: costume.id,
            costumeName: costume.name,
            message: `「${costume.name}」已借出：${costume.borrower}，至${costume.due}`
          });
        }
      }

      if (costume.clean === '待清洗') {
        scheduleRisks.push({
          level: 'medium',
          type: 'cleaning',
          costumeId: costume.id,
          costumeName: costume.name,
          message: `「${costume.name}」待清洗，演出前需完成`
        });
      }
      if (costume.clean === '维修中') {
        scheduleRisks.push({
          level: 'high',
          type: 'repair',
          costumeId: costume.id,
          costumeName: costume.name,
          message: `「${costume.name}」维修中，演出可能受影响`
        });
      }

      const activeWorkOrders = workOrders.filter(
        (wo) => wo.costumeId === costume.id &&
          (wo.status === '待清洗' || wo.status === '清洗中' || wo.status === '待维修' || wo.status === '维修中')
      );
      for (const wo of activeWorkOrders) {
        const isWOOverdue = wo.dueDate && wo.dueDate < todayStr;
        if (isWOOverdue) {
          scheduleRisks.push({
            level: 'high',
            type: 'workorder_overdue',
            costumeId: costume.id,
            costumeName: costume.name,
            message: `「${costume.name}」${wo.type}工单已逾期，负责人：${wo.assignee}`
          });
        } else if (wo.dueDate && wo.dueDate > date) {
          scheduleRisks.push({
            level: 'medium',
            type: 'workorder_late',
            costumeId: costume.id,
            costumeName: costume.name,
            message: `「${costume.name}」${wo.type}工单预计完成${wo.dueDate}，晚于演出日`
          });
        }
      }
    }

    const dayReservations = reservations.filter(
      (r) => r.status === 'active' && r.play === schedule.play && r.date === date
    );
    for (const res of dayReservations) {
      const costume = costumes.find((c) => c.id === res.costumeId);
      if (costume && costume.status === '借出') {
        scheduleRisks.push({
          level: 'high',
          type: 'reservation_conflict',
          costumeId: costume.id,
          costumeName: costume.name,
          message: `预约「${costume.name}」给${res.reservedFor}，但服装已借出`
        });
      }
    }

    const relatedPackingLists = packingLists.filter(
      (pl) => pl.play === schedule.play && pl.performanceDate === date
    );
    for (const pl of relatedPackingLists) {
      const unpacked = pl.items.filter((item) => item.status !== '已打包' && item.status !== '已归还').length;
      if (unpacked > 0) {
        scheduleRisks.push({
          level: 'medium',
          type: 'packing_incomplete',
          costumeId: null,
          costumeName: '',
          message: `装箱单「${pl.name}」有${unpacked}件未打包`
        });
      }
    }

    risks.push({
      schedule,
      risks: scheduleRisks,
      highCount: scheduleRisks.filter((r) => r.level === 'high').length,
      mediumCount: scheduleRisks.filter((r) => r.level === 'medium').length,
      lowCount: scheduleRisks.filter((r) => r.level === 'low').length
    });
  }

  return risks;
}

export function autoLinkCostumes(schedule, costumes, reservations, packingLists) {
  const linkedIds = new Set(schedule.linkedCostumeIds || []);

  const playReservations = reservations.filter(
    (r) => r.status === 'active' && r.play === schedule.play && r.date === schedule.date
  );
  for (const res of playReservations) {
    if (res.costumeId) linkedIds.add(res.costumeId);
  }

  const playPackingLists = packingLists.filter(
    (pl) => pl.play === schedule.play && pl.performanceDate === schedule.date
  );
  for (const pl of playPackingLists) {
    for (const item of pl.items) {
      if (item.costumeId) linkedIds.add(item.costumeId);
    }
  }

  return [...linkedIds];
}
