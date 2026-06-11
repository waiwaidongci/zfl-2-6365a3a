import { TABLES } from '$lib/database.js';

export const DIFF_TYPES = {
  ADDED: 'added',
  IDENTICAL: 'identical',
  FIELD_CONFLICT: 'field_conflict',
  DELETED_SUSPECT: 'deleted_suspect',
  MODIFIED_ONLY_IN_CURRENT: 'modified_only_in_current',
  MODIFIED_ONLY_IN_IMPORT: 'modified_only_in_import'
};

export const DIFF_LABELS = {
  [DIFF_TYPES.ADDED]: '新增（导入中有，当前没有）',
  [DIFF_TYPES.IDENTICAL]: '完全相同',
  [DIFF_TYPES.FIELD_CONFLICT]: '字段冲突（双方都修改了不同字段）',
  [DIFF_TYPES.DELETED_SUSPECT]: '疑似删除（当前有，导入中没有）',
  [DIFF_TYPES.MODIFIED_ONLY_IN_CURRENT]: '仅当前侧有修改',
  [DIFF_TYPES.MODIFIED_ONLY_IN_IMPORT]: '仅导入侧有修改'
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
  TABLES.reservations,
  TABLES.workOrders,
  TABLES.packingLists,
  TABLES.schedules
];

export const AUTO_MERGE_TABLES = [
  TABLES.records,
  TABLES.inventoryTasks,
  TABLES.inventoryItems
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
    if (key === 'id') continue;
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

export function diffTable(currentRecords, importRecords) {
  const currentIdx = buildIndex(currentRecords);
  const importIdx = buildIndex(importRecords);
  const allIds = new Set([...currentIdx.keys(), ...importIdx.keys()]);

  const result = {
    [DIFF_TYPES.ADDED]: [],
    [DIFF_TYPES.IDENTICAL]: [],
    [DIFF_TYPES.FIELD_CONFLICT]: [],
    [DIFF_TYPES.DELETED_SUSPECT]: [],
    [DIFF_TYPES.MODIFIED_ONLY_IN_CURRENT]: [],
    [DIFF_TYPES.MODIFIED_ONLY_IN_IMPORT]: []
  };

  for (const id of allIds) {
    const cur = currentIdx.get(id);
    const imp = importIdx.get(id);

    if (cur && !imp) {
      result[DIFF_TYPES.DELETED_SUSPECT].push({
        id,
        current: deepClone(cur),
        imported: null,
        fieldConflicts: []
      });
    } else if (!cur && imp) {
      result[DIFF_TYPES.ADDED].push({
        id,
        current: null,
        imported: deepClone(imp),
        fieldConflicts: []
      });
    } else {
      const fieldConflicts = getFieldDiff(cur, imp);
      if (fieldConflicts.length === 0) {
        result[DIFF_TYPES.IDENTICAL].push({
          id,
          current: deepClone(cur),
          imported: deepClone(imp),
          fieldConflicts: []
        });
      } else {
        const currentHasMeta = !!(cur.updatedAt || cur.createdAt);
        const importHasMeta = !!(imp.updatedAt || imp.createdAt);
        let type = DIFF_TYPES.FIELD_CONFLICT;
        if (currentHasMeta && importHasMeta) {
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
          fieldConflicts
        });
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
  const diff = {};
  const summary = {};

  for (const table of MERGE_TABLES) {
    const tableDiff = diffTable(currentDB.tables[table] || [], importDB.tables[table] || []);
    diff[table] = tableDiff;
    summary[table] = {
      [DIFF_TYPES.ADDED]: tableDiff[DIFF_TYPES.ADDED].length,
      [DIFF_TYPES.IDENTICAL]: tableDiff[DIFF_TYPES.IDENTICAL].length,
      [DIFF_TYPES.FIELD_CONFLICT]: tableDiff[DIFF_TYPES.FIELD_CONFLICT].length,
      [DIFF_TYPES.DELETED_SUSPECT]: tableDiff[DIFF_TYPES.DELETED_SUSPECT].length,
      [DIFF_TYPES.MODIFIED_ONLY_IN_CURRENT]: tableDiff[DIFF_TYPES.MODIFIED_ONLY_IN_CURRENT].length,
      [DIFF_TYPES.MODIFIED_ONLY_IN_IMPORT]: tableDiff[DIFF_TYPES.MODIFIED_ONLY_IN_IMPORT].length
    };
  }

  const autoMerge = {};
  const autoMergeSummary = {};
  for (const table of AUTO_MERGE_TABLES) {
    const curIds = new Set((currentDB.tables[table] || []).map((r) => r.id));
    const impRecs = importDB.tables[table] || [];
    const toAdd = impRecs.filter((r) => r && r.id && !curIds.has(r.id));
    autoMerge[table] = toAdd;
    autoMergeSummary[table] = toAdd.length;
  }

  const risks = detectCrossReferenceRisks(currentDB, importDB, diff);

  return {
    tables: diff,
    summary,
    autoMerge,
    autoMergeSummary,
    risks
  };
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
    for (const item of td[DIFF_TYPES.MODIFIED_ONLY_IN_IMPORT]) {
      decisions[table][item.id] = {
        choice: DECISION_CHOICES.USE_IMPORT,
        mergedData: deepClone(item.imported)
      };
    }
    for (const item of td[DIFF_TYPES.MODIFIED_ONLY_IN_CURRENT]) {
      decisions[table][item.id] = {
        choice: DECISION_CHOICES.KEEP_CURRENT,
        mergedData: deepClone(item.current)
      };
    }
    for (const item of td[DIFF_TYPES.FIELD_CONFLICT]) {
      decisions[table][item.id] = {
        choice: null,
        mergedData: null
      };
    }
    for (const item of td[DIFF_TYPES.DELETED_SUSPECT]) {
      decisions[table][item.id] = {
        choice: DECISION_CHOICES.KEEP_CURRENT,
        mergedData: deepClone(item.current)
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
      ...td[DIFF_TYPES.DELETED_SUSPECT]
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
      ...td[DIFF_TYPES.MODIFIED_ONLY_IN_CURRENT],
      ...td[DIFF_TYPES.MODIFIED_ONLY_IN_IMPORT],
      ...td[DIFF_TYPES.DELETED_SUSPECT]
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
        skippedExistingIds[item.id] = true;
        deletedCostumeIds.add(item.id);
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
