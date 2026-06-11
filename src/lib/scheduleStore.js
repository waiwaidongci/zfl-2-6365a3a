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

export function generatePackingListFromSchedule(schedule, costumes, reservations, workOrders) {
  const collected = new Map();

  const linkedIds = schedule.linkedCostumeIds || [];
  for (const cid of linkedIds) {
    const c = costumes.find((x) => x.id === cid);
    if (c && !collected.has(c.id)) {
      collected.set(c.id, { costume: c, source: '排期关联' });
    }
  }

  const dayReservations = reservations.filter(
    (r) => r.status === 'active' && r.date === schedule.date
  );
  for (const r of dayReservations) {
    const c = costumes.find((x) => x.id === r.costumeId);
    if (c) {
      if (!collected.has(c.id)) {
        collected.set(c.id, { costume: c, source: '同日预约' });
      }
    }
  }

  const playReservations = reservations.filter(
    (r) => r.status === 'active' && r.play === schedule.play
  );
  for (const r of playReservations) {
    const c = costumes.find((x) => x.id === r.costumeId);
    if (c) {
      if (!collected.has(c.id)) {
        collected.set(c.id, { costume: c, source: '剧目预约' });
      }
    }
  }

  const playCostumes = costumes.filter((c) => c.play === schedule.play);
  for (const c of playCostumes) {
    if (!collected.has(c.id)) {
      collected.set(c.id, { costume: c, source: '剧目服装' });
    }
  }

  const todayStr = new Date().toISOString().slice(0, 10);
  const items = [];

  for (const { costume, source } of collected.values()) {
    const risks = [];
    let initialStatus = '未标记';
    let note = '';

    if (costume.status === '借出') {
      const isOverdue = costume.due && costume.due < todayStr;
      if (isOverdue) {
        risks.push({ type: 'overdue', label: `逾期未还：${costume.borrower}，应还${costume.due}` });
        initialStatus = '缺失';
        note = `逾期未还：${costume.borrower}`;
      } else {
        risks.push({ type: 'borrowed', label: `已借出：${costume.borrower}，至${costume.due}` });
        if (costume.due && costume.due < schedule.date) {
          initialStatus = '缺失';
          note = `借出至${costume.due}，演出前可能未归还`;
        } else {
          note = `已借出：${costume.borrower}`;
        }
      }
    }

    if (costume.clean === '待清洗') {
      risks.push({ type: 'workorder', label: '档案状态：待清洗' });
      if (initialStatus === '未标记') {
        initialStatus = '需清洗';
        note = '待清洗';
      } else {
        note = note ? note + '；待清洗' : '待清洗';
      }
    } else if (costume.clean === '维修中') {
      risks.push({ type: 'workorder', label: '档案状态：维修中' });
      initialStatus = '缺失';
      note = note ? note + '；维修中' : '维修中';
    }

    const activeWO = workOrders.find(
      (wo) => wo.costumeId === costume.id &&
        (wo.status === '待清洗' || wo.status === '清洗中' || wo.status === '待维修' || wo.status === '维修中')
    );
    if (activeWO) {
      const isWOOverdue = activeWO.dueDate && activeWO.dueDate < todayStr;
      if (isWOOverdue) {
        risks.push({ type: 'workorder', label: `${activeWO.type}工单已逾期，负责人：${activeWO.assignee}` });
        initialStatus = '缺失';
        note = note ? note + `；${activeWO.type}工单逾期` : `${activeWO.type}工单逾期`;
      } else if (activeWO.dueDate && activeWO.dueDate > schedule.date) {
        risks.push({ type: 'workorder', label: `${activeWO.type}中：${activeWO.status}，预计完成${activeWO.dueDate}，晚于演出日` });
        initialStatus = '缺失';
        note = note ? note + `；${activeWO.type}工单完成晚于演出日` : `${activeWO.type}工单完成晚于演出日`;
      } else {
        risks.push({ type: 'workorder', label: `${activeWO.type}中：${activeWO.status}，负责人${activeWO.assignee}` });
        if (activeWO.type === '清洗' && initialStatus === '未标记') {
          initialStatus = '需清洗';
        } else if (activeWO.type === '维修' && (initialStatus === '未标记' || initialStatus === '需清洗')) {
          initialStatus = '缺失';
        }
        note = note ? note + `；${activeWO.type}工单进行中` : `${activeWO.type}工单进行中`;
      }
    }

    items.push({
      costumeId: costume.id,
      costumeName: costume.name,
      size: costume.size,
      location: costume.location,
      status: initialStatus,
      note: note,
      risks: risks,
      source: source
    });
  }

  items.sort((a, b) => {
    const riskOrder = { missing: 0, clean: 1, pending: 2 };
    const getRank = (s) => {
      if (s === '缺失') return 0;
      if (s === '需清洗') return 1;
      return 2;
    };
    const rankDiff = getRank(a.status) - getRank(b.status);
    if (rankDiff !== 0) return rankDiff;
    return a.costumeName.localeCompare(b.costumeName);
  });

  const nameCandidates = [
    `${schedule.play} - ${schedule.date} 装箱单`,
    `${schedule.play}${schedule.venue ? ' @' + schedule.venue : ''} - ${schedule.date}`,
    `${schedule.play} ${schedule.date} 演出装箱单`
  ];
  let suggestedName = nameCandidates[0];
  if (schedule.time) {
    suggestedName = `${schedule.play} ${schedule.time} - ${schedule.date} 装箱单`;
  }

  return {
    play: schedule.play,
    performanceDate: schedule.date,
    name: suggestedName,
    note: `由排期「${schedule.play} ${schedule.date}${schedule.time ? ' ' + schedule.time : ''}」一键生成，来源包含：排期关联、同日预约、剧目预约、剧目服装。${schedule.venue ? ' 演出场地：' + schedule.venue : ''}${schedule.note ? ' 排期备注：' + schedule.note : ''}`,
    items: items,
    sourceScheduleId: schedule.id,
    generatedAt: new Date().toISOString()
  };
}
