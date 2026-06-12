import { getAll, setAll, insertOne, updateOne, deleteOne, TABLES } from '$lib/database.js';

export const RISK_STATUS = {
  PENDING: '待处理',
  CONFIRMED: '已确认',
  DEFERRED: '暂缓',
  RESOLVED: '已解决'
};

export const RISK_TYPE_LABELS = {
  overdue: '逾期未还',
  borrowed: '借出中',
  cleaning: '待清洗',
  repair: '维修中',
  workorder_overdue: '工单逾期',
  workorder_late: '工单晚于演出',
  reservation_conflict: '预约冲突',
  packing_incomplete: '装箱未完成'
};

export function getAllSchedules() {
  return getAll(TABLES.schedules);
}

export function saveAllSchedules(schedules) {
  return setAll(TABLES.schedules, schedules);
}

export function getAllRiskStatuses() {
  return getAll(TABLES.riskStatuses);
}

export function saveRiskStatus(riskStatus) {
  const existing = getAllRiskStatuses();
  const idx = existing.findIndex((r) => r.riskKey === riskStatus.riskKey);
  if (idx >= 0) {
    return updateOne(TABLES.riskStatuses, existing[idx].id, {
      ...riskStatus,
      updatedAt: new Date().toISOString()
    });
  } else {
    return insertOne(TABLES.riskStatuses, {
      ...riskStatus,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
  }
}

export function deleteRiskStatus(id) {
  return deleteOne(TABLES.riskStatuses, id);
}

export function getRiskStatusByKey(riskKey) {
  const statuses = getAllRiskStatuses();
  return statuses.find((r) => r.riskKey === riskKey) || null;
}

export function generateRiskKey(scheduleId, type, costumeId) {
  return `${scheduleId || 'global'}-${type}-${costumeId || 'none'}`;
}

export function computeRiskLevel(risk) {
  if (risk.status === RISK_STATUS.RESOLVED) return 'resolved';
  if (risk.status === RISK_STATUS.DEFERRED) return 'deferred';
  if (risk.status === RISK_STATUS.CONFIRMED) return risk.level;
  return risk.level;
}

export function compute30DayRisks(costumes, reservations, workOrders, packingLists) {
  const upcoming = getUpcomingSchedules(30);
  const riskStatuses = getAllRiskStatuses();
  const statusMap = new Map(riskStatuses.map((r) => [r.riskKey, r]));

  const allRisks = [];
  const todayStr = new Date().toISOString().slice(0, 10);

  for (const schedule of upcoming) {
    const date = schedule.date;
    const scheduleRisks = computeDailyRisk(date, costumes, reservations, workOrders, packingLists);

    for (const scheduleRisk of scheduleRisks) {
      for (const risk of scheduleRisk.risks) {
        const riskKey = generateRiskKey(schedule.id, risk.type, risk.costumeId);
        const statusRecord = statusMap.get(riskKey);

        allRisks.push({
          ...risk,
          riskKey,
          scheduleId: schedule.id,
          schedulePlay: schedule.play,
          scheduleDate: schedule.date,
          scheduleTime: schedule.time,
          scheduleVenue: schedule.venue,
          scheduleStatus: schedule.status,
          processingStatus: statusRecord?.status || RISK_STATUS.PENDING,
          handler: statusRecord?.handler || '',
          note: statusRecord?.note || '',
          updatedAt: statusRecord?.updatedAt || null
        });
      }
    }
  }

  return allRisks.sort((a, b) => {
    const levelOrder = { high: 0, medium: 1, low: 2 };
    const statusOrder = { [RISK_STATUS.PENDING]: 0, [RISK_STATUS.CONFIRMED]: 1, [RISK_STATUS.DEFERRED]: 2, [RISK_STATUS.RESOLVED]: 3 };
    const aLevel = a.processingStatus === RISK_STATUS.PENDING ? levelOrder[a.level] : 4;
    const bLevel = b.processingStatus === RISK_STATUS.PENDING ? levelOrder[b.level] : 4;
    if (aLevel !== bLevel) return aLevel - bLevel;
    if (a.scheduleDate !== b.scheduleDate) return a.scheduleDate.localeCompare(b.scheduleDate);
    return statusOrder[a.processingStatus] - statusOrder[b.processingStatus];
  });
}

export function getRiskStats(risks) {
  const stats = {
    total: risks.length,
    pending: 0,
    confirmed: 0,
    deferred: 0,
    resolved: 0,
    high: 0,
    medium: 0,
    low: 0,
    byType: {},
    byPlay: {}
  };

  for (const risk of risks) {
    stats[risk.processingStatus === RISK_STATUS.PENDING ? 'pending' :
           risk.processingStatus === RISK_STATUS.CONFIRMED ? 'confirmed' :
           risk.processingStatus === RISK_STATUS.DEFERRED ? 'deferred' : 'resolved']++;
    stats[risk.level]++;

    if (!stats.byType[risk.type]) stats.byType[risk.type] = 0;
    stats.byType[risk.type]++;

    if (!stats.byPlay[risk.schedulePlay]) stats.byPlay[risk.schedulePlay] = 0;
    stats.byPlay[risk.schedulePlay]++;
  }

  return stats;
}

export function updateRiskProcessingStatus(riskKey, status, handler = '', note = '') {
  return saveRiskStatus({
    riskKey,
    status,
    handler,
    note
  });
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

export function computeDailyRisk(date, costumes, reservations, workOrders, packingLists, includeStatus = true) {
  const daySchedules = getSchedulesByDate(date);
  const risks = [];
  const todayStr = new Date().toISOString().slice(0, 10);
  const riskStatuses = includeStatus ? getAllRiskStatuses() : [];
  const statusMap = new Map(riskStatuses.map((r) => [r.riskKey, r]));

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
          const type = 'overdue';
          const riskKey = generateRiskKey(schedule.id, type, costume.id);
          const statusRecord = statusMap.get(riskKey);
          scheduleRisks.push({
            level: 'high',
            type,
            costumeId: costume.id,
            costumeName: costume.name,
            message: `「${costume.name}」逾期未还：${costume.borrower}，应还${costume.due}`,
            riskKey,
            processingStatus: statusRecord?.status || RISK_STATUS.PENDING
          });
        } else if (costume.due && costume.due < date) {
          const type = 'borrowed';
          const riskKey = generateRiskKey(schedule.id, type, costume.id);
          const statusRecord = statusMap.get(riskKey);
          scheduleRisks.push({
            level: 'medium',
            type,
            costumeId: costume.id,
            costumeName: costume.name,
            message: `「${costume.name}」借出至${costume.due}，演出前可能未归还`,
            riskKey,
            processingStatus: statusRecord?.status || RISK_STATUS.PENDING
          });
        } else {
          const type = 'borrowed';
          const riskKey = generateRiskKey(schedule.id, type, costume.id);
          const statusRecord = statusMap.get(riskKey);
          scheduleRisks.push({
            level: 'low',
            type,
            costumeId: costume.id,
            costumeName: costume.name,
            message: `「${costume.name}」已借出：${costume.borrower}，至${costume.due}`,
            riskKey,
            processingStatus: statusRecord?.status || RISK_STATUS.PENDING
          });
        }
      }

      if (costume.clean === '待清洗') {
        const type = 'cleaning';
        const riskKey = generateRiskKey(schedule.id, type, costume.id);
        const statusRecord = statusMap.get(riskKey);
        scheduleRisks.push({
          level: 'medium',
          type,
          costumeId: costume.id,
          costumeName: costume.name,
          message: `「${costume.name}」待清洗，演出前需完成`,
          riskKey,
          processingStatus: statusRecord?.status || RISK_STATUS.PENDING
        });
      }
      if (costume.clean === '维修中') {
        const type = 'repair';
        const riskKey = generateRiskKey(schedule.id, type, costume.id);
        const statusRecord = statusMap.get(riskKey);
        scheduleRisks.push({
          level: 'high',
          type,
          costumeId: costume.id,
          costumeName: costume.name,
          message: `「${costume.name}」维修中，演出可能受影响`,
          riskKey,
          processingStatus: statusRecord?.status || RISK_STATUS.PENDING
        });
      }

      const activeWorkOrders = workOrders.filter(
        (wo) => wo.costumeId === costume.id &&
          (wo.status === '待清洗' || wo.status === '清洗中' || wo.status === '待维修' || wo.status === '维修中')
      );
      for (const wo of activeWorkOrders) {
        const isWOOverdue = wo.dueDate && wo.dueDate < todayStr;
        if (isWOOverdue) {
          const type = 'workorder_overdue';
          const riskKey = generateRiskKey(schedule.id, type, costume.id);
          const statusRecord = statusMap.get(riskKey);
          scheduleRisks.push({
            level: 'high',
            type,
            costumeId: costume.id,
            costumeName: costume.name,
            message: `「${costume.name}」${wo.type}工单已逾期，负责人：${wo.assignee}`,
            riskKey,
            processingStatus: statusRecord?.status || RISK_STATUS.PENDING
          });
        } else if (wo.dueDate && wo.dueDate > date) {
          const type = 'workorder_late';
          const riskKey = generateRiskKey(schedule.id, type, costume.id);
          const statusRecord = statusMap.get(riskKey);
          scheduleRisks.push({
            level: 'medium',
            type,
            costumeId: costume.id,
            costumeName: costume.name,
            message: `「${costume.name}」${wo.type}工单预计完成${wo.dueDate}，晚于演出日`,
            riskKey,
            processingStatus: statusRecord?.status || RISK_STATUS.PENDING
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
        const type = 'reservation_conflict';
        const riskKey = generateRiskKey(schedule.id, type, costume.id);
        const statusRecord = statusMap.get(riskKey);
        scheduleRisks.push({
          level: 'high',
          type,
          costumeId: costume.id,
          costumeName: costume.name,
          message: `预约「${costume.name}」给${res.reservedFor}，但服装已借出`,
          riskKey,
          processingStatus: statusRecord?.status || RISK_STATUS.PENDING
        });
      }
    }

    const relatedPackingLists = packingLists.filter(
      (pl) => pl.play === schedule.play && pl.performanceDate === date
    );
    for (const pl of relatedPackingLists) {
      const unpacked = pl.items.filter((item) => item.status !== '已打包' && item.status !== '已归还').length;
      if (unpacked > 0) {
        const type = 'packing_incomplete';
        const riskKey = generateRiskKey(schedule.id, type, pl.id);
        const statusRecord = statusMap.get(riskKey);
        scheduleRisks.push({
          level: 'medium',
          type,
          costumeId: null,
          costumeName: '',
          message: `装箱单「${pl.name}」有${unpacked}件未打包`,
          riskKey,
          processingStatus: statusRecord?.status || RISK_STATUS.PENDING
        });
      }
    }

    const activeRisks = scheduleRisks.filter((r) => r.processingStatus !== RISK_STATUS.RESOLVED);
    risks.push({
      schedule,
      risks: scheduleRisks,
      activeRisks,
      highCount: activeRisks.filter((r) => r.level === 'high').length,
      mediumCount: activeRisks.filter((r) => r.level === 'medium').length,
      lowCount: activeRisks.filter((r) => r.level === 'low').length,
      resolvedCount: scheduleRisks.filter((r) => r.processingStatus === RISK_STATUS.RESOLVED).length,
      deferredCount: scheduleRisks.filter((r) => r.processingStatus === RISK_STATUS.DEFERRED).length,
      confirmedCount: scheduleRisks.filter((r) => r.processingStatus === RISK_STATUS.CONFIRMED).length
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

function normalizeDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

export function generatePackingListFromSchedule(schedule, costumes, reservations, workOrders) {
  const collected = new Map();

  const schedDateNorm = normalizeDate(schedule.date);
  if (!schedDateNorm) {
    return {
      play: schedule.play,
      performanceDate: schedule.date,
      name: `${schedule.play} - ${schedule.date} 装箱单`,
      note: `排期日期无效，无法生成装箱单`,
      items: [],
      sourceScheduleId: schedule.id,
      generatedAt: new Date().toISOString()
    };
  }

  const linkedIds = schedule.linkedCostumeIds || [];
  for (const cid of linkedIds) {
    const c = costumes.find((x) => x.id === cid);
    if (c && !collected.has(c.id)) {
      collected.set(c.id, { costume: c, source: '排期关联' });
    }
  }

  const schedDate = new Date(schedDateNorm);
  const rangeStart = new Date(schedDate);
  rangeStart.setDate(rangeStart.getDate() - 30);
  const rangeStartStr = rangeStart.toISOString().slice(0, 10);
  const rangeEnd = new Date(schedDate);
  rangeEnd.setDate(rangeEnd.getDate() + 7);
  const rangeEndStr = rangeEnd.toISOString().slice(0, 10);

  const dayReservations = reservations.filter(
    (r) => r.status === 'active' &&
      r.play === schedule.play &&
      normalizeDate(r.date) === schedDateNorm
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
    (r) => r.status === 'active' &&
      r.play === schedule.play &&
      normalizeDate(r.date) !== schedDateNorm &&
      normalizeDate(r.date) >= rangeStartStr &&
      normalizeDate(r.date) < schedDateNorm
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
