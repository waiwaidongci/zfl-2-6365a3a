import { TABLES, EVENT_TYPES, EVENT_TYPE_LABELS, getDeviceEventTimelines, hasTombstone, SOFT_DELETE_TABLES } from '$lib/database.js';

export const DIFF_TYPES = {
  ADDED: 'added',
  IDENTICAL: 'identical',
  FIELD_CONFLICT: 'field_conflict',
  DELETED_SUSPECT: 'deleted_suspect',
  TRUE_DELETE: 'true_delete',
  OLD_BACKUP_MISSING: 'old_backup_missing',
  MODIFIED_ONLY_IN_CURRENT: 'modified_only_in_current',
  MODIFIED_ONLY_IN_IMPORT: 'modified_only_in_import',
  EVENT_BASED_RESOLVABLE: 'event_based_resolvable'
};

export const DIFF_LABELS = {
  [DIFF_TYPES.ADDED]: '新增（导入中有，当前没有）',
  [DIFF_TYPES.IDENTICAL]: '完全相同',
  [DIFF_TYPES.FIELD_CONFLICT]: '字段冲突（双方都修改了不同字段）',
  [DIFF_TYPES.DELETED_SUSPECT]: '疑似删除（当前有，导入中没有）',
  [DIFF_TYPES.TRUE_DELETE]: '真实删除（导入侧有墓碑，已确认删除）',
  [DIFF_TYPES.OLD_BACKUP_MISSING]: '旧备份缺失（导入侧无墓碑，可能是旧备份）',
  [DIFF_TYPES.MODIFIED_ONLY_IN_CURRENT]: '仅当前侧有修改',
  [DIFF_TYPES.MODIFIED_ONLY_IN_IMPORT]: '仅导入侧有修改',
  [DIFF_TYPES.EVENT_BASED_RESOLVABLE]: '基于事件时间线可自动判断'
};

export const DECISION_CHOICES = {
  KEEP_CURRENT: 'keep_current',
  USE_IMPORT: 'use_import',
  MANUAL: 'manual'
};

export const DECISION_LABELS = {
  [DECISION_CHOICES.KEEP_CURRENT]: '保留当前版本',
  [DECISION_CHOICES.USE_IMPORT]: '使用导入版本',
  [DECISION_CHOICES.MANUAL]: '手动合并'
};

export const REFERENCE_FIELDS = {
  [TABLES.reservations]: ['costumeId'],
  [TABLES.workOrders]: ['costumeId'],
  [TABLES.packingLists]: [
    { path: 'items', itemField: 'costumeId' }
  ],
  [TABLES.schedules]: ['linkedCostumeIds'],
  [TABLES.inventoryItems]: ['costumeId'],
  [TABLES.records]: ['costumeId']
};

export const MERGE_TABLES = [
  TABLES.costumes,
  TABLES.actors,
  TABLES.records,
  TABLES.reservations,
  TABLES.workOrders,
  TABLES.packingLists,
  TABLES.schedules,
  TABLES.inventoryTasks,
  TABLES.inventoryItems,
  TABLES.riskStatuses
];

export const AUTO_MERGE_TABLES = [
  TABLES.syncEvents
];

function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function deepEqual(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function getFieldDiff(current, imported) {
  const keys = new Set([...Object.keys(current || {}), ...Object.keys(imported || {})]);
  const conflicts = [];
  for (const key of keys) {
    if (key === 'id' || key === 'updatedAt' || key === 'createdAt' || key === 'syncCounter') continue;
    const cv = current?.[key];
    const iv = imported?.[key];
    if (!deepEqual(cv, iv)) {
      conflicts.push({
        field: key,
        current: cv,
        imported: iv
      });
    }
  }
  return conflicts;
}

function buildIndex(records) {
  const idx = new Map();
  for (const r of records || []) {
    if (r && r.id) idx.set(r.id, r);
  }
  return idx;
}

function analyzeTimelineForRecord(timelineByRecord, table, recordId) {
  if (!timelineByRecord) return null;
  const key = `${table}|${recordId}`;
  const events = timelineByRecord.get(key) || [];
  if (events.length === 0) return null;

  const currentEvents = events.filter((e) => e.side === 'current');
  const importEvents = events.filter((e) => e.side === 'import');

  const result = {
    allEvents: events,
    currentEvents,
    importEvents,
    hasEvents: events.length > 0,
    lastCurrentEvent: currentEvents.length > 0 ? currentEvents[currentEvents.length - 1] : null,
    lastImportEvent: importEvents.length > 0 ? importEvents[importEvents.length - 1] : null,
    conflictSources: [],
    canAutoResolve: false,
    autoChoice: null,
    autoReason: ''
  };

  if (currentEvents.length > 0 && importEvents.length > 0) {
    const lastCurTime = new Date(result.lastCurrentEvent.timestamp).getTime();
    const lastImpTime = new Date(result.lastImportEvent.timestamp).getTime();
    const curFields = new Set();
    const impFields = new Set();
    for (const e of currentEvents) {
      if (e.changedFields) {
        for (const f of e.changedFields) curFields.add(f);
      }
      if (e.eventType === EVENT_TYPES.DELETE || e.eventType === EVENT_TYPES.CREATE) {
        curFields.add('__existence__');
      }
    }
    for (const e of importEvents) {
      if (e.changedFields) {
        for (const f of e.changedFields) impFields.add(f);
      }
      if (e.eventType === EVENT_TYPES.DELETE || e.eventType === EVENT_TYPES.CREATE) {
        impFields.add('__existence__');
      }
    }
    const overlappingFields = [...curFields].filter((f) => impFields.has(f));
    if (overlappingFields.length === 0) {
      result.canAutoResolve = true;
      result.autoReason = '双方修改不同字段，可双向合并';
      result.autoChoice = 'merge_both';
      result.conflictSources = overlappingFields;
    } else if (lastCurTime > lastImpTime + 1000) {
      result.canAutoResolve = true;
      result.autoChoice = DECISION_CHOICES.KEEP_CURRENT;
      result.autoReason = `当前侧最后更新 (${new Date(lastCurTime).toLocaleString()}) 晚于导入侧 (${new Date(lastImpTime).toLocaleString()})`;
    } else if (lastImpTime > lastCurTime + 1000) {
      result.canAutoResolve = true;
      result.autoChoice = DECISION_CHOICES.USE_IMPORT;
      result.autoReason = `导入侧最后更新 (${new Date(lastImpTime).toLocaleString()}) 晚于当前侧 (${new Date(lastCurTime).toLocaleString()})`;
    } else {
      result.conflictSources = overlappingFields;
      result.autoReason = '双方在相近时间修改了相同字段，存在真实冲突';
    }
  } else if (currentEvents.length > 0) {
    result.canAutoResolve = true;
    result.autoChoice = DECISION_CHOICES.KEEP_CURRENT;
    result.autoReason = '仅当前侧有变更事件记录';
  } else if (importEvents.length > 0) {
    result.canAutoResolve = true;
    result.autoChoice = DECISION_CHOICES.USE_IMPORT;
    result.autoReason = '仅导入侧有变更事件记录';
  }

  return result;
}

export function diffTable(currentRecords, importRecords, options = {}) {
  const { timelineByRecord, table, currentDB, importDB } = options;
  const currentIdx = buildIndex(currentRecords);
  const importIdx = buildIndex(importRecords);
  const allIds = new Set([...currentIdx.keys(), ...importIdx.keys()]);

  const result = {
    [DIFF_TYPES.ADDED]: [],
    [DIFF_TYPES.IDENTICAL]: [],
    [DIFF_TYPES.FIELD_CONFLICT]: [],
    [DIFF_TYPES.DELETED_SUSPECT]: [],
    [DIFF_TYPES.TRUE_DELETE]: [],
    [DIFF_TYPES.OLD_BACKUP_MISSING]: [],
    [DIFF_TYPES.MODIFIED_ONLY_IN_CURRENT]: [],
    [DIFF_TYPES.MODIFIED_ONLY_IN_IMPORT]: [],
    [DIFF_TYPES.EVENT_BASED_RESOLVABLE]: []
  };

  const isSoftDeleteTable = SOFT_DELETE_TABLES.has(table);

  for (const id of allIds) {
    const cur = currentIdx.get(id);
    const imp = importIdx.get(id);
    const timelineAnalysis = analyzeTimelineForRecord(timelineByRecord, table, id);

    if (cur && !imp) {
      let deleteType = DIFF_TYPES.DELETED_SUSPECT;
      let tombstoneInfo = null;
      if (isSoftDeleteTable && importDB && currentDB) {
        const importHasTombstone = hasTombstone(importDB, table, id);
        const currentHasTombstone = hasTombstone(currentDB, table, id);
        tombstoneInfo = { importHasTombstone, currentHasTombstone };
        if (importHasTombstone) {
          deleteType = DIFF_TYPES.TRUE_DELETE;
        } else if (!currentHasTombstone) {
          deleteType = DIFF_TYPES.OLD_BACKUP_MISSING;
        }
      }
      result[deleteType].push({
        id,
        current: deepClone(cur),
        imported: null,
        fieldConflicts: [],
        timelineAnalysis,
        tombstoneInfo
      });
    } else if (!cur && imp) {
      result[DIFF_TYPES.ADDED].push({
        id,
        current: null,
        imported: deepClone(imp),
        fieldConflicts: [],
        timelineAnalysis
      });
    } else {
      const fieldConflicts = getFieldDiff(cur, imp);
      if (fieldConflicts.length === 0) {
        result[DIFF_TYPES.IDENTICAL].push({
          id,
          current: deepClone(cur),
          imported: deepClone(imp),
          fieldConflicts: [],
          timelineAnalysis
        });
      } else {
        if (timelineAnalysis && timelineAnalysis.hasEvents && timelineAnalysis.canAutoResolve) {
          let type = DIFF_TYPES.EVENT_BASED_RESOLVABLE;
          if (timelineAnalysis.autoChoice === DECISION_CHOICES.KEEP_CURRENT) {
            type = DIFF_TYPES.MODIFIED_ONLY_IN_CURRENT;
          } else if (timelineAnalysis.autoChoice === DECISION_CHOICES.USE_IMPORT) {
            type = DIFF_TYPES.MODIFIED_ONLY_IN_IMPORT;
          } else if (timelineAnalysis.autoChoice === 'merge_both') {
            type = DIFF_TYPES.EVENT_BASED_RESOLVABLE;
          }
          result[type].push({
            id,
            current: deepClone(cur),
            imported: deepClone(imp),
            fieldConflicts,
            timelineAnalysis
          });
        } else {
          const currentHasMeta = !!(cur.updatedAt || cur.createdAt);
          const importHasMeta = !!(imp.updatedAt || imp.createdAt);
          let type = DIFF_TYPES.FIELD_CONFLICT;
          if (currentHasMeta && importHasMeta && !timelineAnalysis?.hasEvents) {
            const curTime = new Date(cur.updatedAt || cur.createdAt).getTime();
            const impTime = new Date(imp.updatedAt || imp.createdAt).getTime();
            if (curTime > impTime) {
              type = DIFF_TYPES.MODIFIED_ONLY_IN_CURRENT;
            } else if (impTime > curTime) {
              type = DIFF_TYPES.MODIFIED_ONLY_IN_IMPORT;
            }
          }
          result[type].push({
            id,
            current: deepClone(cur),
            imported: deepClone(imp),
            fieldConflicts,
            timelineAnalysis
          });
        }
      }
    }
  }

  return result;
}

export function detectCrossReferenceRisks(currentDB, importDB, diffResult) {
  const risks = [];
  const currentCostumeIds = new Set((currentDB.tables[TABLES.costumes] || []).map((c) => c.id));
  const importCostumeIds = new Set((importDB.tables[TABLES.costumes] || []).map((c) => c.id));
  const deletedIds = new Set(
    (diffResult[TABLES.costumes]?.[DIFF_TYPES.DELETED_SUSPECT] || []).map((d) => d.id)
  );

  const checkRefs = (table, records, side) => {
    const refs = REFERENCE_FIELDS[table];
    if (!refs) return;

    for (const rec of records || []) {
      for (const refDef of refs) {
        if (typeof refDef === 'string') {
          const val = rec[refDef];
          if (Array.isArray(val)) {
            for (const v of val) {
              if (v && !currentCostumeIds.has(v) && !importCostumeIds.has(v)) {
                risks.push({
                  table,
                  side,
                  recordId: rec.id,
                  recordName: rec.costumeName || rec.name || rec.id.slice(0, 8),
                  field: refDef,
                  missingId: v,
                  severity: 'warning',
                  message: `${side === 'current' ? '当前库' : '导入库'}的记录引用了不存在的服装ID`
                });
              } else if (v && deletedIds.has(v)) {
                risks.push({
                  table,
                  side,
                  recordId: rec.id,
                  recordName: rec.costumeName || rec.name || rec.id.slice(0, 8),
                  field: refDef,
                  missingId: v,
                  severity: 'danger',
                  message: `引用的服装在导入侧疑似被删除，合并后可能断链`
                });
              }
            }
          } else if (val && !currentCostumeIds.has(val) && !importCostumeIds.has(val)) {
            risks.push({
              table,
              side,
              recordId: rec.id,
              recordName: rec.costumeName || rec.name || rec.id.slice(0, 8),
              field: refDef,
              missingId: val,
              severity: 'warning',
              message: `${side === 'current' ? '当前库' : '导入库'}的记录引用了不存在的服装ID`
            });
          } else if (val && deletedIds.has(val)) {
            risks.push({
              table,
              side,
              recordId: rec.id,
              recordName: rec.costumeName || rec.name || rec.id.slice(0, 8),
              field: refDef,
              missingId: val,
              severity: 'danger',
              message: `引用的服装在导入侧疑似被删除，合并后可能断链`
            });
          }
        } else if (refDef.path && refDef.itemField) {
          const items = rec[refDef.path];
          if (Array.isArray(items)) {
            for (const item of items) {
              const v = item[refDef.itemField];
              if (v && !currentCostumeIds.has(v) && !importCostumeIds.has(v)) {
                risks.push({
                  table,
                  side,
                  recordId: rec.id,
                  recordName: rec.name || rec.id.slice(0, 8),
                  field: `${refDef.path}[].${refDef.itemField}`,
                  missingId: v,
                  severity: 'warning',
                  message: `${side === 'current' ? '当前库' : '导入库'}的${refDef.path}引用了不存在的服装ID`
                });
              } else if (v && deletedIds.has(v)) {
                risks.push({
                  table,
                  side,
                  recordId: rec.id,
                  recordName: rec.name || rec.id.slice(0, 8),
                  field: `${refDef.path}[].${refDef.itemField}`,
                  missingId: v,
                  severity: 'danger',
                  message: `引用的服装在导入侧疑似被删除，合并后可能断链`
                });
              }
            }
          }
        }
      }
    }
  };

  for (const table of Object.keys(REFERENCE_FIELDS)) {
    checkRefs(table, currentDB.tables[table], 'current');
    checkRefs(table, importDB.tables[table], 'import');
  }

  return risks;
}

export function computeFullDiff(currentDB, importDB) {
  const timeline = getDeviceEventTimelines(currentDB, importDB);
  const diff = {};
  const summary = {};

  for (const table of MERGE_TABLES) {
    const tableDiff = diffTable(currentDB.tables[table] || [], importDB.tables[table] || [], {
      timelineByRecord: timeline.byRecord,
      table,
      currentDB,
      importDB
    });
    diff[table] = tableDiff;
    summary[table] = {
      [DIFF_TYPES.ADDED]: tableDiff[DIFF_TYPES.ADDED].length,
      [DIFF_TYPES.IDENTICAL]: tableDiff[DIFF_TYPES.IDENTICAL].length,
      [DIFF_TYPES.FIELD_CONFLICT]: tableDiff[DIFF_TYPES.FIELD_CONFLICT].length,
      [DIFF_TYPES.DELETED_SUSPECT]: tableDiff[DIFF_TYPES.DELETED_SUSPECT].length,
      [DIFF_TYPES.TRUE_DELETE]: tableDiff[DIFF_TYPES.TRUE_DELETE].length,
      [DIFF_TYPES.OLD_BACKUP_MISSING]: tableDiff[DIFF_TYPES.OLD_BACKUP_MISSING].length,
      [DIFF_TYPES.MODIFIED_ONLY_IN_CURRENT]: tableDiff[DIFF_TYPES.MODIFIED_ONLY_IN_CURRENT].length,
      [DIFF_TYPES.MODIFIED_ONLY_IN_IMPORT]: tableDiff[DIFF_TYPES.MODIFIED_ONLY_IN_IMPORT].length,
      [DIFF_TYPES.EVENT_BASED_RESOLVABLE]: tableDiff[DIFF_TYPES.EVENT_BASED_RESOLVABLE].length
    };
  }

  const autoMerge = {};
  const autoMergeSummary = {};
  for (const table of AUTO_MERGE_TABLES) {
    if (table === TABLES.syncEvents) {
      const curEventIds = new Set((currentDB.tables[table] || []).map((r) => r.id));
      const impRecs = importDB.tables[table] || [];
      const toAdd = impRecs.filter((r) => r && r.id && !curEventIds.has(r.id));
      autoMerge[table] = toAdd;
      autoMergeSummary[table] = toAdd.length;
    } else {
      const curIds = new Set((currentDB.tables[table] || []).map((r) => r.id));
      const impRecs = importDB.tables[table] || [];
      const toAdd = impRecs.filter((r) => r && r.id && !curIds.has(r.id));
      autoMerge[table] = toAdd;
      autoMergeSummary[table] = toAdd.length;
    }
  }

  const risks = detectCrossReferenceRisks(currentDB, importDB, diff);

  return {
    tables: diff,
    summary,
    autoMerge,
    autoMergeSummary,
    risks,
    timeline: timeline.allEvents,
    timelineByRecord: timeline.byRecord,
    importMeta: importDB._meta || null,
    currentMeta: currentDB._meta || null
  };
}

function mergeBothSides(current, imported, fieldConflicts, timelineAnalysis) {
  const result = deepClone(current || {});
  if (!timelineAnalysis || timelineAnalysis.autoChoice !== 'merge_both') {
    return result;
  }
  const curFields = new Set();
  const impFields = new Set();
  for (const e of timelineAnalysis.currentEvents || []) {
    if (e.changedFields) for (const f of e.changedFields) curFields.add(f);
  }
  for (const e of timelineAnalysis.importEvents || []) {
    if (e.changedFields) for (const f of e.changedFields) impFields.add(f);
  }
  for (const fc of fieldConflicts || []) {
    if (impFields.has(fc.field) && !curFields.has(fc.field)) {
      result[fc.field] = fc.imported;
    }
  }
  return result;
}

export function createDefaultDecisions(diffResult) {
  const decisions = {};

  for (const table of Object.keys(diffResult.tables)) {
    decisions[table] = {};
    const td = diffResult.tables[table];

    for (const item of td[DIFF_TYPES.ADDED]) {
      decisions[table][item.id] = {
        choice: DECISION_CHOICES.USE_IMPORT,
        mergedData: deepClone(item.imported)
      };
    }
    for (const item of td[DIFF_TYPES.IDENTICAL]) {
      decisions[table][item.id] = {
        choice: DECISION_CHOICES.KEEP_CURRENT,
        mergedData: deepClone(item.current)
      };
    }
    for (const item of td[DIFF_TYPES.EVENT_BASED_RESOLVABLE]) {
      let choice = DECISION_CHOICES.KEEP_CURRENT;
      let merged = deepClone(item.current);
      if (item.timelineAnalysis?.autoChoice === 'merge_both') {
        choice = DECISION_CHOICES.MANUAL;
        merged = mergeBothSides(item.current, item.imported, item.fieldConflicts, item.timelineAnalysis);
        decisions[table][item.id] = {
          choice,
          mergedData: deepClone(merged),
          suggestedChoice: DECISION_CHOICES.MANUAL,
          autoMergedData: deepClone(merged),
          autoReason: item.timelineAnalysis.autoReason
        };
        continue;
      } else if (item.timelineAnalysis?.autoChoice === DECISION_CHOICES.USE_IMPORT) {
        choice = DECISION_CHOICES.USE_IMPORT;
        merged = deepClone(item.imported);
      }
      decisions[table][item.id] = {
        choice,
        mergedData: merged,
        autoReason: item.timelineAnalysis?.autoReason || ''
      };
    }
    for (const item of td[DIFF_TYPES.MODIFIED_ONLY_IN_IMPORT]) {
      decisions[table][item.id] = {
        choice: DECISION_CHOICES.USE_IMPORT,
        mergedData: deepClone(item.imported),
        autoReason: item.timelineAnalysis?.autoReason || ''
      };
    }
    for (const item of td[DIFF_TYPES.MODIFIED_ONLY_IN_CURRENT]) {
      decisions[table][item.id] = {
        choice: DECISION_CHOICES.KEEP_CURRENT,
        mergedData: deepClone(item.current),
        autoReason: item.timelineAnalysis?.autoReason || ''
      };
    }
    for (const item of td[DIFF_TYPES.FIELD_CONFLICT]) {
      decisions[table][item.id] = {
        choice: null,
        mergedData: null
      };
    }
    for (const item of td[DIFF_TYPES.DELETED_SUSPECT]) {
      let choice = DECISION_CHOICES.KEEP_CURRENT;
      if (item.timelineAnalysis?.autoChoice === DECISION_CHOICES.USE_IMPORT) {
        choice = DECISION_CHOICES.USE_IMPORT;
      }
      decisions[table][item.id] = {
        choice,
        mergedData: deepClone(item.current),
        autoReason: item.timelineAnalysis?.autoReason || ''
      };
    }
    for (const item of td[DIFF_TYPES.TRUE_DELETE]) {
      decisions[table][item.id] = {
        choice: DECISION_CHOICES.USE_IMPORT,
        mergedData: null,
        autoReason: item.tombstoneInfo?.importHasTombstone
          ? '导入侧有墓碑记录，确认为真实删除'
          : '确认为真实删除'
      };
    }
    for (const item of td[DIFF_TYPES.OLD_BACKUP_MISSING]) {
      decisions[table][item.id] = {
        choice: DECISION_CHOICES.KEEP_CURRENT,
        mergedData: deepClone(item.current),
        autoReason: '两侧均无墓碑记录，导入侧可能为旧备份，保留当前版本'
      };
    }
  }

  return decisions;
}

export function buildMergedRecord(item, choice, manualData) {
  switch (choice) {
    case DECISION_CHOICES.KEEP_CURRENT:
      return deepClone(item.current);
    case DECISION_CHOICES.USE_IMPORT:
      return deepClone(item.imported);
    case DECISION_CHOICES.MANUAL:
      return deepClone(manualData || item.current);
    default:
      return null;
  }
}

export function collectPendingConflicts(diffResult, decisions) {
  const pending = [];
  for (const table of Object.keys(diffResult.tables)) {
    const td = diffResult.tables[table];
    const allConflicts = [
      ...td[DIFF_TYPES.FIELD_CONFLICT],
      ...td[DIFF_TYPES.DELETED_SUSPECT],
      ...td[DIFF_TYPES.EVENT_BASED_RESOLVABLE]
    ];
    for (const item of allConflicts) {
      const dec = decisions[table]?.[item.id];
      if (!dec || !dec.choice) {
        pending.push({ table, item });
      }
    }
  }
  return pending;
}

function applyIdRemapToValue(value, idMap) {
  if (typeof value === 'string' && idMap[value]) {
    return idMap[value];
  }
  if (Array.isArray(value)) {
    return value.map((v) => (typeof v === 'string' && idMap[v] ? idMap[v] : v));
  }
  return value;
}

export function remapReferencesInRecord(rec, table, costumeIdMap) {
  if (!rec || !costumeIdMap || Object.keys(costumeIdMap).length === 0) {
    return rec;
  }
  const refs = REFERENCE_FIELDS[table];
  if (!refs) return rec;

  const result = deepClone(rec);
  for (const refDef of refs) {
    if (typeof refDef === 'string') {
      result[refDef] = applyIdRemapToValue(result[refDef], costumeIdMap);
    } else if (refDef.path && refDef.itemField) {
      const items = result[refDef.path];
      if (Array.isArray(items)) {
        result[refDef.path] = items.map((item) => {
          if (item && typeof item[refDef.itemField] === 'string' && costumeIdMap[item[refDef.itemField]]) {
            return { ...item, [refDef.itemField]: costumeIdMap[item[refDef.itemField]] };
          }
          return item;
        });
      }
    }
  }
  return result;
}

function cleanupDanglingRefs(rec, table, deletedIds, validIds) {
  if (!rec || deletedIds.size === 0) return rec;
  const refs = REFERENCE_FIELDS[table];
  if (!refs) return rec;

  const result = deepClone(rec);
  let modified = false;

  for (const refDef of refs) {
    if (typeof refDef === 'string') {
      const val = result[refDef];
      if (typeof val === 'string' && deletedIds.has(val)) {
        result[refDef] = null;
        result[refDef + '_dangling_note'] = '原引用服装已删除';
        modified = true;
      } else if (Array.isArray(val)) {
        const filtered = val.filter((v) => !deletedIds.has(v));
        if (filtered.length !== val.length) {
          result[refDef] = filtered;
          modified = true;
        }
      }
    } else if (refDef.path && refDef.itemField) {
      const items = result[refDef.path];
      if (Array.isArray(items)) {
        const cleaned = items.map((item) => {
          if (item && deletedIds.has(item[refDef.itemField])) {
            return { ...item, [refDef.itemField]: null, _dangling_note: '原引用服装已删除' };
          }
          return item;
        });
        if (JSON.stringify(cleaned) !== JSON.stringify(items)) {
          result[refDef.path] = cleaned;
          modified = true;
        }
      }
    }
  }

  return modified ? result : rec;
}

function normalizeKey(value) {
  return String(value || '').trim().toLowerCase();
}

function isSameCostumeCandidate(current, imported) {
  if (!current || !imported) return false;
  const currentName = normalizeKey(current.name);
  const importedName = normalizeKey(imported.name);
  if (!currentName || currentName !== importedName) return false;

  const stableFields = ['play', 'size'];
  for (const field of stableFields) {
    const currentValue = normalizeKey(current[field]);
    const importedValue = normalizeKey(imported[field]);
    if (currentValue && importedValue && currentValue !== importedValue) {
      return false;
    }
  }

  return true;
}

function collectCostumeIdRemaps(diffResult, decisions) {
  const remaps = {};
  const usedAddedIds = new Set();
  const costumeDiff = diffResult.tables[TABLES.costumes];
  if (!costumeDiff) return { remaps, usedAddedIds };

  const addedItems = costumeDiff[DIFF_TYPES.ADDED] || [];
  const deletedItems = costumeDiff[DIFF_TYPES.DELETED_SUSPECT] || [];

  for (const deleted of deletedItems) {
    const deletedDecision = decisions[TABLES.costumes]?.[deleted.id];
    if (!deletedDecision?.choice) continue;

    const match = addedItems.find((added) => {
      if (usedAddedIds.has(added.id)) return false;
      const addedDecision = decisions[TABLES.costumes]?.[added.id];
      if (addedDecision?.choice !== DECISION_CHOICES.USE_IMPORT) return false;
      return isSameCostumeCandidate(deleted.current, added.imported);
    });

    if (match?.imported?.id) {
      remaps[deleted.id] = match.imported.id;
      usedAddedIds.add(match.id);
    }
  }

  return { remaps, usedAddedIds };
}

export function applyMerge(currentDB, importDB, diffResult, decisions) {
  const merged = deepClone(currentDB);
  const costumeIdMap = {};
  const currentCostumeIds = new Set((merged.tables[TABLES.costumes] || []).map((c) => c.id));
  const { remaps: changedCostumeIds, usedAddedIds } = collectCostumeIdRemaps(diffResult, decisions);
  const deletedCostumeIds = new Set();
  const skippedExistingIds = {};

  for (const table of MERGE_TABLES) {
    const td = diffResult.tables[table];
    if (!td) continue;
    const finalRecords = [];
    const keepIds = new Set();

    const allItems = [
      ...td[DIFF_TYPES.ADDED],
      ...td[DIFF_TYPES.IDENTICAL],
      ...td[DIFF_TYPES.FIELD_CONFLICT],
      ...td[DIFF_TYPES.EVENT_BASED_RESOLVABLE],
      ...td[DIFF_TYPES.MODIFIED_ONLY_IN_CURRENT],
      ...td[DIFF_TYPES.MODIFIED_ONLY_IN_IMPORT],
      ...td[DIFF_TYPES.DELETED_SUSPECT],
      ...td[DIFF_TYPES.TRUE_DELETE],
      ...td[DIFF_TYPES.OLD_BACKUP_MISSING]
    ];

    for (const item of allItems) {
      const dec = decisions[table]?.[item.id];
      if (!dec || !dec.choice) continue;

      if (
        table === TABLES.costumes &&
        dec.choice === DECISION_CHOICES.USE_IMPORT &&
        item.current !== null &&
        item.imported === null
      ) {
        const isTrueDelete = diffResult.tables[table]?.[DIFF_TYPES.TRUE_DELETE]?.some((td) => td.id === item.id);
        if (isTrueDelete) {
          const softDeleted = {
            ...deepClone(item.current),
            deletedAt: new Date().toISOString(),
            deletedByDeviceId: importDB._meta?.deviceId || null,
            deleteSummary: `合并时确认删除（导入侧有墓碑）`,
            updatedAt: new Date().toISOString()
          };
          finalRecords.push(softDeleted);
          keepIds.add(softDeleted.id);
        } else {
          skippedExistingIds[item.id] = true;
          deletedCostumeIds.add(item.id);
        }
        continue;
      }

      let rec = buildMergedRecord(item, dec.choice, dec.mergedData);
      if (!rec) continue;

      if (table === TABLES.costumes) {
        if (changedCostumeIds[item.id]) {
          costumeIdMap[item.id] = changedCostumeIds[item.id];
          skippedExistingIds[item.id] = true;
          continue;
        }
        if (dec.choice === DECISION_CHOICES.USE_IMPORT && item.current === null) {
          if (currentCostumeIds.has(rec.id)) {
            const newId = crypto.randomUUID();
            costumeIdMap[rec.id] = newId;
            rec = { ...rec, id: newId };
          }
        }
      }

      if (!rec.id) rec.id = crypto.randomUUID();
      keepIds.add(rec.id);
      finalRecords.push(rec);
    }

    if (table === TABLES.costumes || table === TABLES.actors) {
      for (const existing of merged.tables[table] || []) {
        if (table === TABLES.costumes && skippedExistingIds[existing.id]) {
          continue;
        }
        if (!keepIds.has(existing.id)) {
          finalRecords.push(deepClone(existing));
        }
      }
    }

    merged.tables[table] = finalRecords;
  }

  const mergedCostumeIds = new Set((merged.tables[TABLES.costumes] || []).map((c) => c.id));

  for (const table of Object.keys(REFERENCE_FIELDS)) {
    if (Object.keys(costumeIdMap).length > 0) {
      merged.tables[table] = (merged.tables[table] || []).map((rec) =>
        remapReferencesInRecord(rec, table, costumeIdMap)
      );
    }
    if (deletedCostumeIds.size > 0) {
      merged.tables[table] = (merged.tables[table] || []).map((rec) =>
        cleanupDanglingRefs(rec, table, deletedCostumeIds, mergedCostumeIds)
      );
    }
  }

  for (const table of AUTO_MERGE_TABLES) {
    const curIds = new Set((merged.tables[table] || []).map((r) => r.id));
    const toAdd = (diffResult.autoMerge[table] || []).filter(
      (r) => r && r.id && !curIds.has(r.id)
    );
    merged.tables[table] = [...(merged.tables[table] || []), ...toAdd.map((r) => deepClone(r))];

    if (Object.keys(costumeIdMap).length > 0 && REFERENCE_FIELDS[table]) {
      merged.tables[table] = (merged.tables[table] || []).map((rec) =>
        remapReferencesInRecord(rec, table, costumeIdMap)
      );
    }
    if (deletedCostumeIds.size > 0 && REFERENCE_FIELDS[table]) {
      merged.tables[table] = (merged.tables[table] || []).map((rec) =>
        cleanupDanglingRefs(rec, table, deletedCostumeIds, mergedCostumeIds)
      );
    }
  }

  const currentTombstoneKeys = new Set(
    (merged.tables[TABLES.tombstones] || []).map((t) => `${t.table}|${t.recordId}`)
  );
  const importTombstones = importDB.tables[TABLES.tombstones] || [];
  const mergedTombstones = [...(merged.tables[TABLES.tombstones] || [])];
  for (const ts of importTombstones) {
    const key = `${ts.table}|${ts.recordId}`;
    if (!currentTombstoneKeys.has(key)) {
      mergedTombstones.push(deepClone(ts));
      currentTombstoneKeys.add(key);
    }
  }
  merged.tables[TABLES.tombstones] = mergedTombstones;

  return { db: merged, costumeIdMap };
}

export function fieldValueToString(val) {
  if (val === null || val === undefined) return '(空)';
  if (typeof val === 'string') return val || '(空字符串)';
  if (typeof val === 'boolean') return val ? '是' : '否';
  if (typeof val === 'number') return String(val);
  if (Array.isArray(val)) return val.length > 0 ? `[${val.length}项]` : '(空数组)';
  if (typeof val === 'object') return JSON.stringify(val);
  return String(val);
}

export const RISK_LEVELS = {
  CRITICAL: 'critical',
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low',
  INFO: 'info'
};

export const RISK_LEVEL_LABELS = {
  [RISK_LEVELS.CRITICAL]: '严重',
  [RISK_LEVELS.HIGH]: '高风险',
  [RISK_LEVELS.MEDIUM]: '中风险',
  [RISK_LEVELS.LOW]: '低风险',
  [RISK_LEVELS.INFO]: '信息'
};

export const BATCH_STRATEGIES = {
  KEEP_ALL_CURRENT: 'keep_all_current',
  USE_ALL_IMPORT: 'use_all_import',
  AUTO_BY_EVENT: 'auto_by_event',
  AUTO_BY_LATEST: 'auto_by_latest'
};

export const BATCH_STRATEGY_LABELS = {
  [BATCH_STRATEGIES.KEEP_ALL_CURRENT]: '全部保留当前',
  [BATCH_STRATEGIES.USE_ALL_IMPORT]: '全部使用导入',
  [BATCH_STRATEGIES.AUTO_BY_EVENT]: '按事件时间线自动判断',
  [BATCH_STRATEGIES.AUTO_BY_LATEST]: '按最新修改时间自动合并'
};

export const REFERENCE_TABLE_LABELS = {
  [TABLES.reservations]: '排练预约',
  [TABLES.workOrders]: '清洗/维修工单',
  [TABLES.packingLists]: '演出装箱单',
  [TABLES.schedules]: '演出排期',
  [TABLES.inventoryItems]: '盘点明细',
  [TABLES.records]: '借还记录'
};

function countReferencesForCostumeId(costumeId, db) {
  const counts = {
    [TABLES.reservations]: 0,
    [TABLES.workOrders]: 0,
    [TABLES.packingLists]: 0,
    [TABLES.schedules]: 0,
    [TABLES.inventoryItems]: 0,
    [TABLES.records]: 0,
    total: 0
  };

  if (Array.isArray(db.tables?.[TABLES.reservations])) {
    counts[TABLES.reservations] = db.tables[TABLES.reservations].filter(
      (r) => r.costumeId === costumeId && !r.deletedAt
    ).length;
  }

  if (Array.isArray(db.tables?.[TABLES.workOrders])) {
    counts[TABLES.workOrders] = db.tables[TABLES.workOrders].filter(
      (r) => r.costumeId === costumeId && !r.deletedAt
    ).length;
  }

  if (Array.isArray(db.tables?.[TABLES.packingLists])) {
    for (const pl of db.tables[TABLES.packingLists]) {
      if (pl.deletedAt) continue;
      if (Array.isArray(pl.items) && pl.items.some((item) => item.costumeId === costumeId)) {
        counts[TABLES.packingLists]++;
      }
    }
  }

  if (Array.isArray(db.tables?.[TABLES.schedules])) {
    counts[TABLES.schedules] = db.tables[TABLES.schedules].filter(
      (r) => !r.deletedAt && Array.isArray(r.linkedCostumeIds) && r.linkedCostumeIds.includes(costumeId)
    ).length;
  }

  if (Array.isArray(db.tables?.[TABLES.inventoryItems])) {
    counts[TABLES.inventoryItems] = db.tables[TABLES.inventoryItems].filter(
      (r) => r.costumeId === costumeId
    ).length;
  }

  if (Array.isArray(db.tables?.[TABLES.records])) {
    counts[TABLES.records] = db.tables[TABLES.records].filter(
      (r) => r.costumeId === costumeId
    ).length;
  }

  counts.total = Object.values(counts).reduce((sum, v) => sum + (typeof v === 'number' ? v : 0), 0) - counts.total;

  return counts;
}

export function computeRecordImpact(table, record, currentDB, importDB) {
  const impact = {
    table,
    recordId: record?.id,
    recordName: '',
    referenceCounts: {
      current: { total: 0, byTable: {} },
      import: { total: 0, byTable: {} },
      maxTotal: 0
    },
    riskLevel: RISK_LEVELS.LOW,
    riskReasons: []
  };

  if (!record) return impact;

  switch (table) {
    case TABLES.costumes:
      impact.recordName = record.name || record.id?.slice(0, 8);
      const curCounts = countReferencesForCostumeId(record.id, currentDB);
      const impCounts = countReferencesForCostumeId(record.id, importDB);
      impact.referenceCounts.current = { total: curCounts.total, byTable: { ...curCounts } };
      impact.referenceCounts.import = { total: impCounts.total, byTable: { ...impCounts } };
      impact.referenceCounts.maxTotal = Math.max(curCounts.total, impCounts.total);
      delete impact.referenceCounts.current.byTable.total;
      delete impact.referenceCounts.import.byTable.total;
      break;
    case TABLES.schedules:
      impact.recordName = `${record.play || ''} ${record.date || ''}`.trim() || record.id?.slice(0, 8);
      const linkedCount = Array.isArray(record.linkedCostumeIds) ? record.linkedCostumeIds.length : 0;
      impact.referenceCounts.current.total = linkedCount;
      impact.referenceCounts.import.total = linkedCount;
      impact.referenceCounts.maxTotal = linkedCount;
      impact.referenceCounts.current.byTable = { [TABLES.costumes]: linkedCount };
      impact.referenceCounts.import.byTable = { [TABLES.costumes]: linkedCount };
      break;
    case TABLES.workOrders:
      impact.recordName = `${record.type || ''} - ${record.costumeName || record.id?.slice(0, 8)}`;
      break;
    case TABLES.packingLists:
      impact.recordName = record.name || record.id?.slice(0, 8);
      const itemCount = Array.isArray(record.items) ? record.items.length : 0;
      impact.referenceCounts.current.total = itemCount;
      impact.referenceCounts.import.total = itemCount;
      impact.referenceCounts.maxTotal = itemCount;
      impact.referenceCounts.current.byTable = { [TABLES.costumes]: itemCount };
      impact.referenceCounts.import.byTable = { [TABLES.costumes]: itemCount };
      break;
    case TABLES.reservations:
      impact.recordName = `${record.costumeName || '服装'} - ${record.reservedFor || ''}`;
      break;
    case TABLES.inventoryTasks:
      impact.recordName = record.name || record.id?.slice(0, 8);
      break;
    case TABLES.inventoryItems:
      impact.recordName = record.costumeName || record.id?.slice(0, 8);
      break;
    case TABLES.actors:
      impact.recordName = record.name || record.id?.slice(0, 8);
      break;
    case TABLES.records:
      impact.recordName = `${record.type || ''} - ${record.costumeName || record.id?.slice(0, 8)}`;
      break;
    default:
      impact.recordName = record.id?.slice(0, 8) || '记录';
  }

  return impact;
}

function assessRiskLevel(diffType, impact, item) {
  const reasons = [];
  let level = RISK_LEVELS.INFO;

  const refTotal = impact.referenceCounts?.maxTotal || 0;

  switch (diffType) {
    case DIFF_TYPES.FIELD_CONFLICT:
      if (refTotal > 10) {
        level = RISK_LEVELS.HIGH;
        reasons.push(`关联引用较多（${refTotal} 条），字段冲突可能影响多处业务`);
      } else if (refTotal > 0) {
        level = RISK_LEVELS.MEDIUM;
        reasons.push(`存在关联引用（${refTotal} 条），需确认字段变更影响`);
      } else {
        level = RISK_LEVELS.LOW;
        reasons.push('字段冲突，无关联引用');
      }
      const conflictCount = item?.fieldConflicts?.length || 0;
      if (conflictCount >= 5) {
        level = level === RISK_LEVELS.HIGH ? RISK_LEVELS.CRITICAL : RISK_LEVELS.HIGH;
        reasons.push(`冲突字段较多（${conflictCount} 个）`);
      }
      break;

    case DIFF_TYPES.DELETED_SUSPECT:
      if (refTotal > 5) {
        level = RISK_LEVELS.CRITICAL;
        reasons.push(`删除将影响 ${refTotal} 条关联记录，可能导致数据断链`);
      } else if (refTotal > 0) {
        level = RISK_LEVELS.HIGH;
        reasons.push(`删除将影响 ${refTotal} 条关联记录`);
      } else {
        level = RISK_LEVELS.MEDIUM;
        reasons.push('疑似删除记录，无关联引用');
      }
      break;

    case DIFF_TYPES.TRUE_DELETE:
      if (refTotal > 0) {
        level = RISK_LEVELS.HIGH;
        reasons.push(`确认删除，将影响 ${refTotal} 条关联记录的引用`);
      } else {
        level = RISK_LEVELS.MEDIUM;
        reasons.push('确认删除记录，有墓碑佐证');
      }
      break;

    case DIFF_TYPES.EVENT_BASED_RESOLVABLE:
      level = RISK_LEVELS.LOW;
      reasons.push('基于事件时间线可自动合并');
      break;

    case DIFF_TYPES.MODIFIED_ONLY_IN_IMPORT:
    case DIFF_TYPES.MODIFIED_ONLY_IN_CURRENT:
      if (refTotal > 5) {
        level = RISK_LEVELS.MEDIUM;
        reasons.push(`单侧修改，关联引用较多（${refTotal} 条）`);
      } else {
        level = RISK_LEVELS.LOW;
        reasons.push('单侧修改，无冲突');
      }
      break;

    case DIFF_TYPES.ADDED:
      level = RISK_LEVELS.LOW;
      reasons.push('新增记录');
      break;

    case DIFF_TYPES.IDENTICAL:
      level = RISK_LEVELS.INFO;
      reasons.push('记录完全相同');
      break;

    default:
      level = RISK_LEVELS.LOW;
  }

  return { level, reasons };
}

export function buildMergePreview(diffResult, currentDB, importDB) {
  const preview = {
    byTable: {},
    byRiskLevel: {
      [RISK_LEVELS.CRITICAL]: [],
      [RISK_LEVELS.HIGH]: [],
      [RISK_LEVELS.MEDIUM]: [],
      [RISK_LEVELS.LOW]: [],
      [RISK_LEVELS.INFO]: []
    },
    byRefCount: {
      high: [],
      medium: [],
      low: [],
      none: []
    },
    summary: {
      totalRecords: 0,
      totalConflicts: 0,
      totalAdds: 0,
      totalDeletes: 0,
      totalModified: 0,
      totalIdentical: 0,
      byRiskCount: {
        [RISK_LEVELS.CRITICAL]: 0,
        [RISK_LEVELS.HIGH]: 0,
        [RISK_LEVELS.MEDIUM]: 0,
        [RISK_LEVELS.LOW]: 0,
        [RISK_LEVELS.INFO]: 0
      },
      estimatedImpact: {
        maxAffectedReservations: 0,
        maxAffectedWorkOrders: 0,
        maxAffectedPackingLists: 0,
        maxAffectedSchedules: 0,
        maxAffectedInventoryItems: 0,
        maxAffectedRecords: 0,
        totalMaxReferences: 0
      }
    },
    itemDetails: new Map()
  };

  for (const table of MERGE_TABLES) {
    const tableDiff = diffResult.tables?.[table];
    if (!tableDiff) continue;

    preview.byTable[table] = {
      table,
      total: 0,
      byType: {},
      byRiskLevel: {
        [RISK_LEVELS.CRITICAL]: 0,
        [RISK_LEVELS.HIGH]: 0,
        [RISK_LEVELS.MEDIUM]: 0,
        [RISK_LEVELS.LOW]: 0,
        [RISK_LEVELS.INFO]: 0
      },
      totalRefImpact: 0,
      items: []
    };

    for (const diffType of Object.values(DIFF_TYPES)) {
      const items = tableDiff[diffType] || [];
      preview.byTable[table].byType[diffType] = items.length;
      preview.byTable[table].total += items.length;

      for (const item of items) {
        const record = item.current || item.imported;
        const impact = computeRecordImpact(table, record, currentDB, importDB);
        const risk = assessRiskLevel(diffType, impact, item);

        const detail = {
          table,
          id: item.id,
          diffType,
          record,
          current: item.current,
          imported: item.imported,
          fieldConflicts: item.fieldConflicts || [],
          timelineAnalysis: item.timelineAnalysis || null,
          tombstoneInfo: item.tombstoneInfo || null,
          impact,
          riskLevel: risk.level,
          riskReasons: risk.reasons
        };

        const key = `${table}|${item.id}`;
        preview.itemDetails.set(key, detail);
        preview.byTable[table].items.push(detail);
        preview.byTable[table].byRiskLevel[risk.level]++;
        preview.byTable[table].totalRefImpact += impact.referenceCounts.maxTotal;

        preview.byRiskLevel[risk.level].push(detail);

        const refTotal = impact.referenceCounts.maxTotal;
        if (refTotal >= 10) {
          preview.byRefCount.high.push(detail);
        } else if (refTotal >= 3) {
          preview.byRefCount.medium.push(detail);
        } else if (refTotal > 0) {
          preview.byRefCount.low.push(detail);
        } else {
          preview.byRefCount.none.push(detail);
        }

        const refByTable = impact.referenceCounts.current.byTable;
        if (refByTable[TABLES.reservations]) {
          preview.summary.estimatedImpact.maxAffectedReservations += refByTable[TABLES.reservations];
        }
        if (refByTable[TABLES.workOrders]) {
          preview.summary.estimatedImpact.maxAffectedWorkOrders += refByTable[TABLES.workOrders];
        }
        if (refByTable[TABLES.packingLists]) {
          preview.summary.estimatedImpact.maxAffectedPackingLists += refByTable[TABLES.packingLists];
        }
        if (refByTable[TABLES.schedules]) {
          preview.summary.estimatedImpact.maxAffectedSchedules += refByTable[TABLES.schedules];
        }
        if (refByTable[TABLES.inventoryItems]) {
          preview.summary.estimatedImpact.maxAffectedInventoryItems += refByTable[TABLES.inventoryItems];
        }
        if (refByTable[TABLES.records]) {
          preview.summary.estimatedImpact.maxAffectedRecords += refByTable[TABLES.records];
        }
        preview.summary.estimatedImpact.totalMaxReferences += refTotal;
      }
    }

    const td = tableDiff;
    preview.summary.totalRecords += preview.byTable[table].total;
    preview.summary.totalConflicts += (td[DIFF_TYPES.FIELD_CONFLICT]?.length || 0);
    preview.summary.totalAdds += (td[DIFF_TYPES.ADDED]?.length || 0);
    preview.summary.totalDeletes += (td[DIFF_TYPES.DELETED_SUSPECT]?.length || 0) + (td[DIFF_TYPES.TRUE_DELETE]?.length || 0);
    preview.summary.totalModified += (td[DIFF_TYPES.MODIFIED_ONLY_IN_CURRENT]?.length || 0) + (td[DIFF_TYPES.MODIFIED_ONLY_IN_IMPORT]?.length || 0) + (td[DIFF_TYPES.EVENT_BASED_RESOLVABLE]?.length || 0);
    preview.summary.totalIdentical += (td[DIFF_TYPES.IDENTICAL]?.length || 0);

    for (const level of Object.values(RISK_LEVELS)) {
      preview.summary.byRiskCount[level] += preview.byTable[table].byRiskLevel[level];
    }
  }

  return preview;
}

export function applyBatchStrategy(diffResult, decisions, strategy, options = {}) {
  const newDecisions = deepClone(decisions);
  const { tables = MERGE_TABLES, diffTypes = null } = options;

  for (const table of tables) {
    const tableDiff = diffResult.tables?.[table];
    if (!tableDiff) continue;

    if (!newDecisions[table]) {
      newDecisions[table] = {};
    }

    const applicableTypes = diffTypes || [
      DIFF_TYPES.FIELD_CONFLICT,
      DIFF_TYPES.DELETED_SUSPECT,
      DIFF_TYPES.EVENT_BASED_RESOLVABLE,
      DIFF_TYPES.MODIFIED_ONLY_IN_CURRENT,
      DIFF_TYPES.MODIFIED_ONLY_IN_IMPORT
    ];

    for (const diffType of applicableTypes) {
      const items = tableDiff[diffType] || [];
      for (const item of items) {
        const currentDec = newDecisions[table][item.id];
        if (currentDec?.choice && !options.overwriteExisting) continue;

        let choice = null;
        let autoReason = '';
        let mergedData = null;

        switch (strategy) {
          case BATCH_STRATEGIES.KEEP_ALL_CURRENT:
            choice = DECISION_CHOICES.KEEP_CURRENT;
            mergedData = deepClone(item.current);
            autoReason = '批量策略：保留当前版本';
            break;

          case BATCH_STRATEGIES.USE_ALL_IMPORT:
            choice = DECISION_CHOICES.USE_IMPORT;
            mergedData = deepClone(item.imported);
            autoReason = '批量策略：使用导入版本';
            break;

          case BATCH_STRATEGIES.AUTO_BY_EVENT:
            if (item.timelineAnalysis?.canAutoResolve) {
              if (item.timelineAnalysis.autoChoice === 'merge_both') {
                choice = DECISION_CHOICES.MANUAL;
                mergedData = mergeBothSides(item.current, item.imported, item.fieldConflicts, item.timelineAnalysis);
                autoReason = item.timelineAnalysis.autoReason || '双向合并';
              } else if (item.timelineAnalysis.autoChoice === DECISION_CHOICES.KEEP_CURRENT) {
                choice = DECISION_CHOICES.KEEP_CURRENT;
                mergedData = deepClone(item.current);
                autoReason = item.timelineAnalysis.autoReason || '当前侧事件较新';
              } else if (item.timelineAnalysis.autoChoice === DECISION_CHOICES.USE_IMPORT) {
                choice = DECISION_CHOICES.USE_IMPORT;
                mergedData = deepClone(item.imported);
                autoReason = item.timelineAnalysis.autoReason || '导入侧事件较新';
              }
            } else {
              continue;
            }
            break;

          case BATCH_STRATEGIES.AUTO_BY_LATEST:
            const curTime = item.current?.updatedAt || item.current?.createdAt;
            const impTime = item.imported?.updatedAt || item.imported?.createdAt;
            if (curTime && impTime) {
              if (new Date(curTime).getTime() >= new Date(impTime).getTime()) {
                choice = DECISION_CHOICES.KEEP_CURRENT;
                mergedData = deepClone(item.current);
                autoReason = `当前侧更新时间较新（${new Date(curTime).toLocaleString()}）`;
              } else {
                choice = DECISION_CHOICES.USE_IMPORT;
                mergedData = deepClone(item.imported);
                autoReason = `导入侧更新时间较新（${new Date(impTime).toLocaleString()}）`;
              }
            }
            break;
        }

        if (choice) {
          newDecisions[table][item.id] = {
            choice,
            mergedData,
            autoReason,
            batchApplied: true,
            batchStrategy: strategy
          };
        }
      }
    }
  }

  return newDecisions;
}

export function applyBatchStrategyByRisk(diffResult, decisions, strategy, riskLevel, preview) {
  const items = preview?.byRiskLevel?.[riskLevel] || [];
  const tableMap = {};
  for (const item of items) {
    if (!tableMap[item.table]) {
      tableMap[item.table] = new Set();
    }
    tableMap[item.table].add(item.diffType);
  }

  const tables = Object.keys(tableMap);
  const newDecisions = deepClone(decisions);

  for (const table of tables) {
    const tableDiff = diffResult.tables?.[table];
    if (!tableDiff) continue;
    if (!newDecisions[table]) {
      newDecisions[table] = {};
    }

    const riskItems = items.filter((i) => i.table === table);
    for (const riskItem of riskItems) {
      const currentDec = newDecisions[table][riskItem.id];
      if (currentDec?.choice) continue;

      const diffItems = tableDiff[riskItem.diffType] || [];
      const item = diffItems.find((d) => d.id === riskItem.id);
      if (!item) continue;

      let choice = null;
      let mergedData = null;
      let autoReason = '';

      switch (strategy) {
        case BATCH_STRATEGIES.KEEP_ALL_CURRENT:
          choice = DECISION_CHOICES.KEEP_CURRENT;
          mergedData = deepClone(item.current);
          autoReason = `按风险级别批量保留当前（${RISK_LEVEL_LABELS[riskLevel]}）`;
          break;
        case BATCH_STRATEGIES.USE_ALL_IMPORT:
          choice = DECISION_CHOICES.USE_IMPORT;
          mergedData = deepClone(item.imported);
          autoReason = `按风险级别批量使用导入（${RISK_LEVEL_LABELS[riskLevel]}）`;
          break;
        default:
          continue;
      }

      if (choice) {
        newDecisions[table][item.id] = {
          choice,
          mergedData,
          autoReason,
          batchApplied: true,
          batchStrategy: strategy,
          batchRiskLevel: riskLevel
        };
      }
    }
  }

  return newDecisions;
}

export function generateImpactSummary(diffResult, decisions, currentDB, importDB) {
  const summary = {
    willBeDeleted: [],
    willBeAdded: [],
    willBeUpdated: [],
    willBeRemapped: [],
    danglingRisks: [],
    stats: {
      deleteCount: 0,
      addCount: 0,
      updateCount: 0,
      remapCount: 0,
      danglingRiskCount: 0,
      affectedReservations: 0,
      affectedWorkOrders: 0,
      affectedPackingLists: 0,
      affectedSchedules: 0,
      affectedInventoryItems: 0,
      affectedRecords: 0
    }
  };

  const deletedCostumeIds = new Set();
  const addedCostumeIds = new Set();
  const remappedCostumeIds = {};

  for (const table of MERGE_TABLES) {
    const tableDiff = diffResult.tables?.[table];
    if (!tableDiff) continue;

    const allItems = [
      ...tableDiff[DIFF_TYPES.ADDED] || [],
      ...tableDiff[DIFF_TYPES.DELETED_SUSPECT] || [],
      ...tableDiff[DIFF_TYPES.TRUE_DELETE] || [],
      ...tableDiff[DIFF_TYPES.FIELD_CONFLICT] || [],
      ...tableDiff[DIFF_TYPES.MODIFIED_ONLY_IN_CURRENT] || [],
      ...tableDiff[DIFF_TYPES.MODIFIED_ONLY_IN_IMPORT] || [],
      ...tableDiff[DIFF_TYPES.EVENT_BASED_RESOLVABLE] || []
    ];

    for (const item of allItems) {
      const dec = decisions[table]?.[item.id];
      if (!dec?.choice) continue;

      const recordName = table === TABLES.costumes
        ? (item.current?.name || item.imported?.name || item.id.slice(0, 8))
        : (item.current?.name || item.imported?.name || item.id.slice(0, 8));

      if (dec.choice === DECISION_CHOICES.USE_IMPORT && item.current !== null && item.imported === null) {
        const isTrueDelete = tableDiff[DIFF_TYPES.TRUE_DELETE]?.some((td) => td.id === item.id);
        const entry = {
          table,
          id: item.id,
          recordName,
          isTrueDelete: !!isTrueDelete,
          current: item.current
        };
        summary.willBeDeleted.push(entry);
        summary.stats.deleteCount++;

        if (table === TABLES.costumes) {
          deletedCostumeIds.add(item.id);
        }
      }

      if (dec.choice === DECISION_CHOICES.USE_IMPORT && item.current === null && item.imported !== null) {
        summary.willBeAdded.push({
          table,
          id: item.id,
          recordName,
          imported: item.imported
        });
        summary.stats.addCount++;

        if (table === TABLES.costumes) {
          addedCostumeIds.add(item.id);
        }
      }

      if (item.current !== null && item.imported !== null && item.fieldConflicts?.length > 0) {
        summary.willBeUpdated.push({
          table,
          id: item.id,
          recordName,
          choice: dec.choice,
          conflictCount: item.fieldConflicts.length
        });
        summary.stats.updateCount++;
      }
    }
  }

  const { remaps } = collectCostumeIdRemaps(diffResult, decisions);
  for (const [fromId, toId] of Object.entries(remaps)) {
    const fromName = diffResult.tables[TABLES.costumes]?.[DIFF_TYPES.DELETED_SUSPECT]?.find(
      (d) => d.id === fromId
    )?.current?.name || fromId.slice(0, 8);
    const toName = diffResult.tables[TABLES.costumes]?.[DIFF_TYPES.ADDED]?.find(
      (d) => d.id === toId
    )?.imported?.name || toId.slice(0, 8);
    summary.willBeRemapped.push({
      fromId,
      toId,
      fromName,
      toName
    });
    summary.stats.remapCount++;
    remappedCostumeIds[fromId] = toId;
  }

  const allRefTables = Object.keys(REFERENCE_FIELDS);
  const combinedDB = { tables: {} };
  for (const refTable of allRefTables) {
    combinedDB.tables[refTable] = currentDB.tables[refTable] || [];
  }

  const finalValidIds = new Set();
  for (const c of currentDB.tables[TABLES.costumes] || []) {
    if (!c.deletedAt) finalValidIds.add(c.id);
  }
  for (const c of importDB.tables[TABLES.costumes] || []) {
    if (!c.deletedAt) finalValidIds.add(c.id);
  }
  for (const id of deletedCostumeIds) {
    finalValidIds.delete(id);
  }
  for (const [fromId, toId] of Object.entries(remappedCostumeIds)) {
    finalValidIds.delete(fromId);
    finalValidIds.add(toId);
  }

  for (const refTable of allRefTables) {
    const refs = REFERENCE_FIELDS[refTable];
    if (!refs) continue;

    const records = currentDB.tables[refTable] || [];
    for (const rec of records) {
      if (rec.deletedAt) continue;

      for (const refDef of refs) {
        if (typeof refDef === 'string') {
          const val = rec[refDef];
          if (Array.isArray(val)) {
            for (const v of val) {
              if (v && deletedCostumeIds.has(v) && !remappedCostumeIds[v]) {
                summary.danglingRisks.push({
                  table: refTable,
                  recordId: rec.id,
                  recordName: rec.name || rec.costumeName || rec.id.slice(0, 8),
                  field: refDef,
                  missingCostumeId: v,
                  missingCostumeName: '',
                  severity: 'danger',
                  message: `引用的服装将被删除且无重映射目标，会产生悬空引用`
                });
                summary.stats.danglingRiskCount++;
              }
            }
          } else if (val && deletedCostumeIds.has(val) && !remappedCostumeIds[val]) {
            summary.danglingRisks.push({
              table: refTable,
              recordId: rec.id,
              recordName: rec.name || rec.costumeName || rec.id.slice(0, 8),
              field: refDef,
              missingCostumeId: val,
              missingCostumeName: '',
              severity: 'danger',
              message: `引用的服装将被删除且无重映射目标，会产生悬空引用`
            });
            summary.stats.danglingRiskCount++;
          }
        } else if (refDef.path && refDef.itemField) {
          const items = rec[refDef.path];
          if (Array.isArray(items)) {
            for (const item of items) {
              const v = item[refDef.itemField];
              if (v && deletedCostumeIds.has(v) && !remappedCostumeIds[v]) {
                summary.danglingRisks.push({
                  table: refTable,
                  recordId: rec.id,
                  recordName: rec.name || rec.id.slice(0, 8),
                  field: `${refDef.path}[].${refDef.itemField}`,
                  missingCostumeId: v,
                  missingCostumeName: item.costumeName || '',
                  severity: 'danger',
                  message: `装箱单中引用的服装将被删除，会产生悬空引用`
                });
                summary.stats.danglingRiskCount++;
              }
            }
          }
        }
      }
    }
  }

  summary.stats.affectedReservations = new Set(
    summary.willBeDeleted.filter((d) => d.table === TABLES.costumes)
      .flatMap((d) =>
        (currentDB.tables[TABLES.reservations] || [])
          .filter((r) => r.costumeId === d.id && !r.deletedAt)
          .map((r) => r.id)
      )
  ).size;

  summary.stats.affectedWorkOrders = new Set(
    summary.willBeDeleted.filter((d) => d.table === TABLES.costumes)
      .flatMap((d) =>
        (currentDB.tables[TABLES.workOrders] || [])
          .filter((r) => r.costumeId === d.id && !r.deletedAt)
          .map((r) => r.id)
      )
  ).size;

  summary.stats.affectedSchedules = new Set(
    summary.willBeDeleted.filter((d) => d.table === TABLES.costumes)
      .flatMap((d) =>
        (currentDB.tables[TABLES.schedules] || [])
          .filter((r) => !r.deletedAt && Array.isArray(r.linkedCostumeIds) && r.linkedCostumeIds.includes(d.id))
          .map((r) => r.id)
      )
  ).size;

  summary.stats.affectedPackingLists = new Set(
    summary.willBeDeleted.filter((d) => d.table === TABLES.costumes)
      .flatMap((d) =>
        (currentDB.tables[TABLES.packingLists] || [])
          .filter((pl) => {
            if (pl.deletedAt) return false;
            return Array.isArray(pl.items) && pl.items.some((item) => item.costumeId === d.id);
          })
          .map((pl) => pl.id)
      )
  ).size;

  summary.stats.affectedInventoryItems = new Set(
    summary.willBeDeleted.filter((d) => d.table === TABLES.costumes)
      .flatMap((d) =>
        (currentDB.tables[TABLES.inventoryItems] || [])
          .filter((r) => r.costumeId === d.id)
          .map((r) => r.id)
      )
  ).size;

  summary.stats.affectedRecords = new Set(
    summary.willBeDeleted.filter((d) => d.table === TABLES.costumes)
      .flatMap((d) =>
        (currentDB.tables[TABLES.records] || [])
          .filter((r) => r.costumeId === d.id)
          .map((r) => r.id)
      )
  ).size;

  return summary;
}
