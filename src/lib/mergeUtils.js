import { TABLES, TABLE_LABELS, EVENT_TYPES, EVENT_TYPE_LABELS, getDeviceEventTimelines, hasTombstone, SOFT_DELETE_TABLES } from '$lib/database.js';

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

export const BATCH_STRATEGIES = {
  KEEP_CURRENT_ALL: 'keep_current_all',
  USE_IMPORT_ALL: 'use_import_all',
  LATEST_EVENT: 'latest_event',
  LATEST_TIMESTAMP: 'latest_timestamp'
};

export const BATCH_STRATEGY_LABELS = {
  [BATCH_STRATEGIES.KEEP_CURRENT_ALL]: '全部保留当前版本',
  [BATCH_STRATEGIES.USE_IMPORT_ALL]: '全部使用导入版本',
  [BATCH_STRATEGIES.LATEST_EVENT]: '按最新事件时间线自动判断',
  [BATCH_STRATEGIES.LATEST_TIMESTAMP]: '按记录 updatedAt 时间戳判断'
};

export const RISK_LEVELS = {
  DANGER: 'danger',
  WARNING: 'warning',
  INFO: 'info'
};

export const RISK_LEVEL_LABELS = {
  [RISK_LEVELS.DANGER]: '高危',
  [RISK_LEVELS.WARNING]: '警告',
  [RISK_LEVELS.INFO]: '提示'
};

export const IMPACT_TYPES = {
  SCHEDULE: 'schedule',
  WORK_ORDER: 'workOrder',
  PACKING_LIST: 'packingList',
  INVENTORY_ITEM: 'inventoryItem',
  COSTUME_REF: 'costumeRef'
};

export const IMPACT_TYPE_LABELS = {
  [IMPACT_TYPES.SCHEDULE]: '排期',
  [IMPACT_TYPES.WORK_ORDER]: '工单',
  [IMPACT_TYPES.PACKING_LIST]: '装箱单',
  [IMPACT_TYPES.INVENTORY_ITEM]: '盘点明细',
  [IMPACT_TYPES.COSTUME_REF]: '服装引用'
};

function collectAllCostumeIdsFromDB(db) {
  const result = {
    byCostume: {},
    costumeRecords: new Map()
  };
  for (const c of db.tables[TABLES.costumes] || []) {
    result.costumeRecords.set(c.id, c);
    result.byCostume[c.id] = {
      schedule: 0,
      workOrder: 0,
      packingList: 0,
      inventoryItem: 0,
      costumeRef: 0,
      details: []
    };
  }
  for (const s of db.tables[TABLES.schedules] || []) {
    if (Array.isArray(s.linkedCostumeIds)) {
      for (const cid of s.linkedCostumeIds) {
        if (result.byCostume[cid]) {
          result.byCostume[cid].schedule++;
          result.byCostume[cid].details.push({
            type: IMPACT_TYPES.SCHEDULE,
            id: s.id,
            label: `${s.play || ''} ${s.date || ''}`.trim()
          });
        }
      }
    }
  }
  for (const w of db.tables[TABLES.workOrders] || []) {
    if (w.costumeId && result.byCostume[w.costumeId]) {
      result.byCostume[w.costumeId].workOrder++;
      result.byCostume[w.costumeId].details.push({
        type: IMPACT_TYPES.WORK_ORDER,
        id: w.id,
        label: `${w.type} - ${w.costumeName || ''}`
      });
    }
  }
  for (const pl of db.tables[TABLES.packingLists] || []) {
    const seen = new Set();
    if (Array.isArray(pl.items)) {
      for (const item of pl.items) {
        if (item.costumeId && result.byCostume[item.costumeId] && !seen.has(pl.id)) {
          result.byCostume[item.costumeId].packingList++;
          result.byCostume[item.costumeId].details.push({
            type: IMPACT_TYPES.PACKING_LIST,
            id: pl.id,
            label: pl.name || pl.id.slice(0, 8)
          });
          seen.add(pl.id);
        }
      }
    }
  }
  for (const inv of db.tables[TABLES.inventoryItems] || []) {
    if (inv.costumeId && result.byCostume[inv.costumeId]) {
      result.byCostume[inv.costumeId].inventoryItem++;
      result.byCostume[inv.costumeId].details.push({
        type: IMPACT_TYPES.INVENTORY_ITEM,
        id: inv.id,
        label: `${inv.inventoryTaskId?.slice(0, 6) || ''} ${inv.status || ''}`
      });
    }
  }
  for (const r of db.tables[TABLES.reservations] || []) {
    if (r.costumeId && result.byCostume[r.costumeId]) {
      result.byCostume[r.costumeId].costumeRef++;
      result.byCostume[r.costumeId].details.push({
        type: IMPACT_TYPES.COSTUME_REF,
        id: r.id,
        label: `${r.reservedFor} ${r.date || ''}`
      });
    }
  }
  for (const rec of db.tables[TABLES.records] || []) {
    if (rec.costumeId && result.byCostume[rec.costumeId]) {
      result.byCostume[rec.costumeId].costumeRef++;
    }
  }
  return result;
}

export function computeImpactAnalysis(currentDB, diffResult) {
  if (!currentDB || !currentDB.tables || !diffResult || !diffResult.tables) {
    return {};
  }
  const impactData = collectAllCostumeIdsFromDB(currentDB);
  const result = {};

  for (const table of MERGE_TABLES) {
    result[table] = {};
    const td = diffResult.tables[table];
    if (!td) continue;

    const allItems = [
      ...(td[DIFF_TYPES.FIELD_CONFLICT] || []),
      ...(td[DIFF_TYPES.DELETED_SUSPECT] || []),
      ...(td[DIFF_TYPES.TRUE_DELETE] || []),
      ...(td[DIFF_TYPES.OLD_BACKUP_MISSING] || []),
      ...(td[DIFF_TYPES.EVENT_BASED_RESOLVABLE] || []),
      ...(td[DIFF_TYPES.MODIFIED_ONLY_IN_CURRENT] || []),
      ...(td[DIFF_TYPES.MODIFIED_ONLY_IN_IMPORT] || []),
      ...(td[DIFF_TYPES.ADDED] || [])
    ];

    for (const item of allItems) {
      const id = item.id;
      const impactEntry = {
        totalImpacts: 0,
        byType: {
          schedule: 0,
          workOrder: 0,
          packingList: 0,
          inventoryItem: 0,
          costumeRef: 0
        },
        details: []
      };

      if (table === TABLES.costumes) {
        const info = impactData.byCostume[id];
        if (info) {
          impactEntry.byType = {
            schedule: info.schedule || 0,
            workOrder: info.workOrder || 0,
            packingList: info.packingList || 0,
            inventoryItem: info.inventoryItem || 0,
            costumeRef: info.costumeRef || 0
          };
          impactEntry.details = [...info.details];
          impactEntry.totalImpacts = (info.schedule || 0) + (info.workOrder || 0) + (info.packingList || 0) + (info.inventoryItem || 0) + (info.costumeRef || 0);
        }
      } else {
        const currentRec = item.current || item.imported;
        const refs = REFERENCE_FIELDS[table];
        if (refs && currentRec) {
          for (const refDef of refs) {
            if (typeof refDef === 'string') {
              const val = currentRec[refDef];
              if (Array.isArray(val)) {
                impactEntry.totalImpacts += val.length;
                impactEntry.byType.costumeRef += val.length;
              } else if (val) {
                impactEntry.totalImpacts += 1;
                impactEntry.byType.costumeRef += 1;
              }
            } else if (refDef.path && refDef.itemField) {
              const items = currentRec[refDef.path];
              if (Array.isArray(items)) {
                impactEntry.totalImpacts += items.length;
                impactEntry.byType.costumeRef += items.length;
              }
            }
          }
        }
      }

      result[table][id] = impactEntry;
    }
  }

  return result;
}

export function classifyRiskLevel(diffType, item, impactTotal, table) {
  if (diffType === DIFF_TYPES.TRUE_DELETE && impactTotal > 0) {
    return RISK_LEVELS.DANGER;
  }
  if (diffType === DIFF_TYPES.DELETED_SUSPECT && impactTotal > 3) {
    return RISK_LEVELS.DANGER;
  }
  if (diffType === DIFF_TYPES.DELETED_SUSPECT && impactTotal > 0) {
    return RISK_LEVELS.WARNING;
  }
  if (diffType === DIFF_TYPES.FIELD_CONFLICT && impactTotal > 5) {
    return RISK_LEVELS.WARNING;
  }
  if (table === TABLES.costumes && diffType === DIFF_TYPES.FIELD_CONFLICT &&
      item.fieldConflicts?.some(fc => fc.field === 'name' || fc.field === 'play')) {
    return RISK_LEVELS.WARNING;
  }
  return RISK_LEVELS.INFO;
}

export function buildPreviewSummary(diffResult, impactAnalysis) {
  if (!diffResult || !diffResult.tables) {
    return {
      byTable: {},
      byRiskLevel: { [RISK_LEVELS.DANGER]: [], [RISK_LEVELS.WARNING]: [], [RISK_LEVELS.INFO]: [] },
      byImpactRange: { high: [], medium: [], low: [], none: [] },
      totals: { tables: 0, needsDecision: 0, totalRecords: 0, danger: 0, warning: 0, info: 0 }
    };
  }
  const summary = {
    byTable: {},
    byRiskLevel: { [RISK_LEVELS.DANGER]: [], [RISK_LEVELS.WARNING]: [], [RISK_LEVELS.INFO]: [] },
    byImpactRange: {
      high: [],
      medium: [],
      low: [],
      none: []
    },
    totals: {
      tables: 0,
      needsDecision: 0,
      totalRecords: 0,
      danger: 0,
      warning: 0,
      info: 0
    }
  };

  const REQUIRES_DECISION = [
    DIFF_TYPES.FIELD_CONFLICT,
    DIFF_TYPES.DELETED_SUSPECT,
    DIFF_TYPES.EVENT_BASED_RESOLVABLE
  ];

  for (const table of MERGE_TABLES) {
    const td = diffResult.tables[table];
    if (!td) continue;

    const tableCounts = diffResult.summary?.[table] || {};

    summary.byTable[table] = {
      label: TABLE_LABELS[table] || table,
      counts: { ...tableCounts },
      needsDecision: 0,
      items: [],
      totalImpactCount: 0
    };

    const allDecisionItems = [];
    for (const dtype of REQUIRES_DECISION) {
      for (const item of td[dtype] || []) {
        allDecisionItems.push({ diffType: dtype, item });
      }
    }

    for (const { diffType, item } of allDecisionItems) {
      const impact = impactAnalysis?.[table]?.[item.id] || { totalImpacts: 0, byType: {}, details: [] };
      const riskLevel = classifyRiskLevel(diffType, item, impact.totalImpacts, table);
      let impactRange = 'none';
      if (impact.totalImpacts >= 10) impactRange = 'high';
      else if (impact.totalImpacts >= 3) impactRange = 'medium';
      else if (impact.totalImpacts > 0) impactRange = 'low';

      const row = {
        table,
        id: item.id,
        diffType,
        riskLevel,
        impactRange,
        impactTotal: impact.totalImpacts,
        impactByType: impact.byType,
        recordName: getRecordPreviewName(table, item),
        conflictFields: item.fieldConflicts?.map(fc => fc.field) || [],
        timelineCanAuto: !!item.timelineAnalysis?.canAutoResolve,
        timelineChoice: item.timelineAnalysis?.autoChoice || null,
        timelineReason: item.timelineAnalysis?.autoReason || '',
        timestampCurrent: (item.current?.updatedAt || item.current?.createdAt) || null,
        timestampImport: (item.imported?.updatedAt || item.imported?.createdAt) || null
      };

      summary.byTable[table].items.push(row);
      summary.byRiskLevel[riskLevel].push(row);
      summary.byImpactRange[impactRange].push(row);
    }

    summary.byTable[table].needsDecision = allDecisionItems.length;
    summary.byTable[table].totalImpactCount = summary.byTable[table].items.reduce((s, r) => s + r.impactTotal, 0);
    summary.totals.needsDecision += allDecisionItems.length;
    summary.totals.totalRecords += Object.keys(tableCounts).reduce(
      (s, k) => s + (tableCounts[k] || 0), 0
    );
    if (allDecisionItems.length > 0) summary.totals.tables++;
  }

  summary.totals.danger = summary.byRiskLevel[RISK_LEVELS.DANGER].length;
  summary.totals.warning = summary.byRiskLevel[RISK_LEVELS.WARNING].length;
  summary.totals.info = summary.byRiskLevel[RISK_LEVELS.INFO].length;

  return summary;
}

function getRecordPreviewName(table, item) {
  const rec = item.current || item.imported;
  if (!rec) return '(无)';
  switch (table) {
    case TABLES.costumes: return rec.name || rec.id?.slice(0, 8);
    case TABLES.actors: return rec.name || rec.id?.slice(0, 8);
    case TABLES.reservations: return `${rec.costumeName || '服装'} - ${rec.reservedFor || ''}`;
    case TABLES.workOrders: return `${rec.type || ''} - ${rec.costumeName || rec.id?.slice(0, 8)}`;
    case TABLES.packingLists: return rec.name || rec.id?.slice(0, 8);
    case TABLES.schedules: return `${rec.play || ''} ${rec.date || ''}`;
    default: return rec.id?.slice(0, 8) || '记录';
  }
}

export function computeRiskList(currentDB, diffResult, decisions, impactAnalysis) {
  const toDelete = [];
  const toRemap = [];
  const danglingRisk = [];

  const deletedIds = new Set();
  const remappedIds = {};

  const costumeDiff = diffResult.tables[TABLES.costumes];
  if (costumeDiff) {
    for (const item of costumeDiff[DIFF_TYPES.DELETED_SUSPECT] || []) {
      const dec = decisions[TABLES.costumes]?.[item.id];
      if (dec?.choice === DECISION_CHOICES.USE_IMPORT) {
        deletedIds.add(item.id);
        const impact = impactAnalysis[TABLES.costumes]?.[item.id];
        toDelete.push({
          table: TABLES.costumes,
          id: item.id,
          name: getRecordPreviewName(TABLES.costumes, item),
          impactTotal: impact?.totalImpacts || 0,
          impactByType: impact?.byType || {},
          impactDetails: impact?.details || [],
          isTrueDelete: diffResult.tables[TABLES.costumes]?.[DIFF_TYPES.TRUE_DELETE]?.some(td => td.id === item.id)
        });
      }
    }
    for (const item of costumeDiff[DIFF_TYPES.TRUE_DELETE] || []) {
      const dec = decisions[TABLES.costumes]?.[item.id];
      if (dec?.choice === DECISION_CHOICES.USE_IMPORT && !deletedIds.has(item.id)) {
        deletedIds.add(item.id);
        const impact = impactAnalysis[TABLES.costumes]?.[item.id];
        toDelete.push({
          table: TABLES.costumes,
          id: item.id,
          name: getRecordPreviewName(TABLES.costumes, item),
          impactTotal: impact?.totalImpacts || 0,
          impactByType: impact?.byType || {},
          impactDetails: impact?.details || [],
          isTrueDelete: true
        });
      }
    }

    const addedItems = costumeDiff[DIFF_TYPES.ADDED] || [];
    const usedAdded = new Set();
    for (const deleted of costumeDiff[DIFF_TYPES.DELETED_SUSPECT] || []) {
      if (!deletedIds.has(deleted.id)) continue;
      const match = addedItems.find(added => {
        if (usedAdded.has(added.id)) return false;
        const addedDec = decisions[TABLES.costumes]?.[added.id];
        if (addedDec?.choice !== DECISION_CHOICES.USE_IMPORT) return false;
        return isSameCostumeCandidate(deleted.current, added.imported);
      });
      if (match?.imported?.id) {
        remappedIds[deleted.id] = match.imported.id;
        usedAdded.add(match.id);
        toRemap.push({
          fromId: deleted.id,
          toId: match.imported.id,
          fromName: getRecordPreviewName(TABLES.costumes, deleted),
          toName: getRecordPreviewName(TABLES.costumes, { imported: match.imported }),
          reason: '根据服装名称/剧目/尺码自动匹配重映射'
        });
      }
    }
  }

  if (deletedIds.size > 0) {
    for (const table of Object.keys(REFERENCE_FIELDS)) {
      const records = currentDB.tables[table] || [];
      const refs = REFERENCE_FIELDS[table];
      for (const rec of records) {
        for (const refDef of refs) {
          if (typeof refDef === 'string') {
            const val = rec[refDef];
            if (Array.isArray(val)) {
              for (const v of val) {
                if (v && deletedIds.has(v) && !remappedIds[v]) {
                  danglingRisk.push({
                    table,
                    id: rec.id,
                    recordName: getDanglingRecordName(table, rec),
                    field: refDef,
                    missingCostumeId: v,
                    severity: 'will_be_cleaned',
                    message: `引用的服装 ${v.slice(0, 8)} 将被清除，字段置空`
                  });
                }
              }
            } else if (val && deletedIds.has(val) && !remappedIds[val]) {
              danglingRisk.push({
                table,
                id: rec.id,
                recordName: getDanglingRecordName(table, rec),
                field: refDef,
                missingCostumeId: val,
                severity: 'will_be_cleaned',
                message: `引用的服装 ${val.slice(0, 8)} 将被清除，字段置空`
              });
            }
          } else if (refDef.path && refDef.itemField) {
            const items = rec[refDef.path];
            if (Array.isArray(items)) {
              for (let idx = 0; idx < items.length; idx++) {
                const v = items[idx][refDef.itemField];
                if (v && deletedIds.has(v) && !remappedIds[v]) {
                  danglingRisk.push({
                    table,
                    id: rec.id,
                    recordName: getDanglingRecordName(table, rec),
                    field: `${refDef.path}[${idx}].${refDef.itemField}`,
                    missingCostumeId: v,
                    severity: 'will_be_cleaned',
                    message: `装箱明细中服装 ${v.slice(0, 8)} 引用将被标记为已删除`
                  });
                }
              }
            }
          }
        }
      }
    }
  }

  return { toDelete, toRemap, danglingRisk, deletedIds, remappedIds };
}

function getDanglingRecordName(table, rec) {
  switch (table) {
    case TABLES.reservations: return `${rec.costumeName || ''} ${rec.reservedFor || ''}`;
    case TABLES.workOrders: return `${rec.type || ''} ${rec.costumeName || rec.id.slice(0, 8)}`;
    case TABLES.packingLists: return rec.name || rec.id.slice(0, 8);
    case TABLES.schedules: return `${rec.play || ''} ${rec.date || ''}`;
    case TABLES.inventoryItems: return `盘点项#${rec.id.slice(0, 6)}`;
    case TABLES.records: return `借还#${rec.id.slice(0, 6)}`;
    default: return rec.id?.slice(0, 8);
  }
}

export function applyBatchStrategy(diffResult, decisions, strategy, scope = {}, impactAnalysis = null) {
  const {
    tables = null,
    riskLevels = null,
    diffTypes = null
  } = scope;

  const newDecisions = deepClone(decisions);
  const targetTables = tables || MERGE_TABLES;
  const targetDiffTypes = diffTypes || [
    DIFF_TYPES.FIELD_CONFLICT,
    DIFF_TYPES.DELETED_SUSPECT,
    DIFF_TYPES.EVENT_BASED_RESOLVABLE
  ];

  for (const table of targetTables) {
    if (!diffResult.tables[table]) continue;
    if (!newDecisions[table]) newDecisions[table] = {};

    for (const dtype of targetDiffTypes) {
      const items = diffResult.tables[table][dtype] || [];
      for (const item of items) {
        const current = newDecisions[table]?.[item.id];
        if (current?.choice && current.choice !== DECISION_CHOICES.MANUAL) continue;

        if (riskLevels && impactAnalysis) {
          const impact = impactAnalysis[table]?.[item.id] || { totalImpacts: 0 };
          const itemRisk = classifyRiskLevel(dtype, item, impact.totalImpacts, table);
          if (!riskLevels.includes(itemRisk)) continue;
        }

        let choice = null;
        let mergedData = null;
        let autoReason = '';

        switch (strategy) {
          case BATCH_STRATEGIES.KEEP_CURRENT_ALL:
            choice = DECISION_CHOICES.KEEP_CURRENT;
            mergedData = deepClone(item.current || item.imported);
            autoReason = '批量策略：保留当前';
            break;
          case BATCH_STRATEGIES.USE_IMPORT_ALL:
            choice = DECISION_CHOICES.USE_IMPORT;
            if (dtype === DIFF_TYPES.DELETED_SUSPECT) {
              mergedData = null;
            } else {
              mergedData = deepClone(item.imported || item.current);
            }
            autoReason = '批量策略：使用导入';
            break;
          case BATCH_STRATEGIES.LATEST_EVENT:
            if (item.timelineAnalysis?.canAutoResolve) {
              if (item.timelineAnalysis.autoChoice === 'merge_both') {
                choice = DECISION_CHOICES.MANUAL;
                mergedData = mergeBothSides(item.current, item.imported, item.fieldConflicts, item.timelineAnalysis);
                autoReason = item.timelineAnalysis.autoReason || '批量策略：双向合并';
              } else if (item.timelineAnalysis.autoChoice) {
                choice = item.timelineAnalysis.autoChoice;
                mergedData = choice === DECISION_CHOICES.KEEP_CURRENT
                  ? deepClone(item.current || item.imported)
                  : (dtype === DIFF_TYPES.DELETED_SUSPECT ? null : deepClone(item.imported || item.current));
                autoReason = item.timelineAnalysis.autoReason || '批量策略：按最新事件';
              }
            } else if (item.timelineAnalysis?.autoChoice) {
              choice = item.timelineAnalysis.autoChoice;
              mergedData = choice === DECISION_CHOICES.KEEP_CURRENT
                ? deepClone(item.current || item.imported)
                : (dtype === DIFF_TYPES.DELETED_SUSPECT ? null : deepClone(item.imported || item.current));
              autoReason = item.timelineAnalysis.autoReason || '';
            } else {
              continue;
            }
            break;
          case BATCH_STRATEGIES.LATEST_TIMESTAMP:
            {
              const curTs = item.current?.updatedAt || item.current?.createdAt;
              const impTs = item.imported?.updatedAt || item.imported?.createdAt;
              const curTime = curTs ? new Date(curTs).getTime() : 0;
              const impTime = impTs ? new Date(impTs).getTime() : 0;
              if (curTime > impTime) {
                choice = DECISION_CHOICES.KEEP_CURRENT;
                mergedData = deepClone(item.current);
                autoReason = `批量策略：当前时间较新 (${curTs?.slice(0, 19).replace('T', ' ') || '未知'})`;
              } else if (impTime > curTime) {
                choice = DECISION_CHOICES.USE_IMPORT;
                mergedData = dtype === DIFF_TYPES.DELETED_SUSPECT ? null : deepClone(item.imported);
                autoReason = `批量策略：导入时间较新 (${impTs?.slice(0, 19).replace('T', ' ') || '未知'})`;
              }
            }
            break;
        }

        if (choice) {
          newDecisions[table][item.id] = {
            ...(newDecisions[table][item.id] || {}),
            choice,
            mergedData,
            autoReason: autoReason || newDecisions[table][item.id]?.autoReason
          };
        }
      }
    }
  }

  return newDecisions;
}
