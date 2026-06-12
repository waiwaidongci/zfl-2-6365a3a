<script>
  import { X, AlertTriangle, CheckCircle, Plus, Minus, ChevronDown, ChevronRight, Save, ArrowRightLeft, Database, RefreshCw, CheckCircle2, XCircle, Edit3, Clock, Cpu, GitBranch, Activity } from 'lucide-svelte';
  import { TABLES, TABLE_LABELS, EVENT_TYPE_LABELS } from '$lib/database.js';
  import {
    DIFF_TYPES,
    DIFF_LABELS,
    DECISION_CHOICES,
    DECISION_LABELS,
    MERGE_TABLES,
    AUTO_MERGE_TABLES,
    collectPendingConflicts,
    fieldValueToString
  } from '$lib/mergeUtils.js';

  export let diffResult;
  export let decisions;
  export let importFileName;
  export let importMeta;
  export let onClose;
  export let onConfirmMerge;

  let activeTable = TABLES.costumes;
  let activeFilter = DIFF_TYPES.FIELD_CONFLICT;
  let expandedItems = new Set();
  let expandedTimelines = new Set();
  let manualEditItem = null;
  let manualEditTable = null;
  let manualMergeData = {};

  $: pending = collectPendingConflicts(diffResult, decisions);
  $: pendingCount = pending.length;
  $: canProceed = pendingCount === 0;
  $: activeFilterItems = diffResult.tables?.[activeTable]?.[activeFilter] || [];
  $: currentMeta = diffResult?.currentMeta || null;
  $: deviceStats = getDeviceStats(diffResult);

  const TABLE_ORDER = MERGE_TABLES;

  const FILTER_ORDER = [
    DIFF_TYPES.FIELD_CONFLICT,
    DIFF_TYPES.EVENT_BASED_RESOLVABLE,
    DIFF_TYPES.DELETED_SUSPECT,
    DIFF_TYPES.MODIFIED_ONLY_IN_CURRENT,
    DIFF_TYPES.MODIFIED_ONLY_IN_IMPORT,
    DIFF_TYPES.ADDED,
    DIFF_TYPES.IDENTICAL
  ];

  function getDeviceStats(dr) {
    if (!dr?.timeline) return { current: 0, import: 0, total: 0 };
    let cur = 0, imp = 0;
    for (const e of dr.timeline) {
      if (e.side === 'current') cur++;
      else imp++;
    }
    return { current: cur, import: imp, total: cur + imp };
  }

  function formatEventTime(ts) {
    if (!ts) return '';
    const d = new Date(ts);
    return d.toLocaleString('zh-CN', { hour12: false });
  }

  function getSideClass(side) {
    return side === 'current' ? 'timeline-current' : 'timeline-import';
  }

  function getSideLabel(side) {
    return side === 'current' ? '当前设备' : '导入设备';
  }

  function toggleTimeline(id) {
    if (expandedTimelines.has(id)) {
      expandedTimelines.delete(id);
    } else {
      expandedTimelines.add(id);
    }
    expandedTimelines = new Set(expandedTimelines);
  }

  function getRecordTitle(table, record) {
    if (!record) return '(无)';
    switch (table) {
      case TABLES.costumes:
        return record.name || record.id?.slice(0, 8);
      case TABLES.actors:
        return record.name || record.id?.slice(0, 8);
      case TABLES.reservations:
        return `${record.costumeName || '服装'} - ${record.reservedFor || ''}`;
      case TABLES.workOrders:
        return `${record.type || ''} - ${record.costumeName || record.id?.slice(0, 8)}`;
      case TABLES.packingLists:
        return record.name || record.id?.slice(0, 8);
      case TABLES.schedules:
        return `${record.play || ''} ${record.date || ''}`;
      default:
        return record.id?.slice(0, 8) || '记录';
    }
  }

  function getFilterClass(type) {
    switch (type) {
      case DIFF_TYPES.ADDED:
        return 'diff-added';
      case DIFF_TYPES.IDENTICAL:
        return 'diff-identical';
      case DIFF_TYPES.FIELD_CONFLICT:
        return 'diff-conflict';
      case DIFF_TYPES.DELETED_SUSPECT:
        return 'diff-deleted';
      case DIFF_TYPES.MODIFIED_ONLY_IN_CURRENT:
        return 'diff-cur-mod';
      case DIFF_TYPES.MODIFIED_ONLY_IN_IMPORT:
        return 'diff-imp-mod';
      case DIFF_TYPES.EVENT_BASED_RESOLVABLE:
        return 'diff-event';
      default:
        return '';
    }
  }

  function getRiskClass(severity) {
    return severity === 'danger' ? 'risk-danger' : 'risk-warning';
  }

  function toggleItem(id) {
    if (expandedItems.has(id)) {
      expandedItems.delete(id);
    } else {
      expandedItems.add(id);
    }
    expandedItems = new Set(expandedItems);
  }

  function setDecision(table, id, choice) {
    decisions = {
      ...decisions,
      [table]: {
        ...(decisions[table] || {}),
        [id]: {
          choice,
          mergedData: choice === DECISION_CHOICES.MANUAL
            ? (decisions[table]?.[id]?.mergedData || (diffResult.tables[table]?.[DIFF_TYPES.FIELD_CONFLICT]?.find((d) => d.id === id)?.current))
            : null
        }
      }
    };
  }

  function applyAutoMergedSuggestion(table, id, item) {
    const dec = decisions[table]?.[id];
    if (dec?.autoMergedData) {
      decisions = {
        ...decisions,
        [table]: {
          ...(decisions[table] || {}),
          [id]: {
            choice: DECISION_CHOICES.MANUAL,
            mergedData: deepClone(dec.autoMergedData)
          }
        }
      };
    }
  }

  function startManualEdit(table, item) {
    manualEditTable = table;
    manualEditItem = item;
    manualMergeData = {};
    const base = item.current || item.imported || {};
    for (const fc of item.fieldConflicts) {
      manualMergeData[fc.field] = base[fc.field] ?? fc.current ?? fc.imported;
    }
    const merged = { ...base };
    for (const [k, v] of Object.entries(manualMergeData)) {
      merged[k] = v;
    }
    decisions = {
      ...decisions,
      [table]: {
        ...(decisions[table] || {}),
        [item.id]: {
          choice: DECISION_CHOICES.MANUAL,
          mergedData: merged
        }
      }
    };
  }

  function updateManualField(fieldName, value) {
    manualMergeData[fieldName] = value;
    manualMergeData = { ...manualMergeData };
    const item = manualEditItem;
    if (!item) return;
    const base = item.current || item.imported || {};
    const merged = { ...base };
    for (const [k, v] of Object.entries(manualMergeData)) {
      merged[k] = v;
    }
    decisions = {
      ...decisions,
      [manualEditTable]: {
        ...(decisions[manualEditTable] || {}),
        [item.id]: {
          choice: DECISION_CHOICES.MANUAL,
          mergedData: merged
        }
      }
    };
  }

  function saveManualEdit() {
    manualEditItem = null;
    manualEditTable = null;
    manualMergeData = {};
  }

  function cancelManualEdit() {
    if (manualEditTable && manualEditItem) {
      decisions = {
        ...decisions,
        [manualEditTable]: {
          ...(decisions[manualEditTable] || {}),
          [manualEditItem.id]: {
            choice: null,
            mergedData: null
          }
        }
      };
    }
    manualEditItem = null;
    manualEditTable = null;
    manualMergeData = {};
  }

  function handleConfirm() {
    if (!canProceed) return;
    onConfirmMerge?.(decisions);
  }

  function batchResolveAll(choice) {
    for (const table of Object.keys(diffResult.tables)) {
      const td = diffResult.tables[table];
      const conflicts = [
        ...td[DIFF_TYPES.FIELD_CONFLICT],
        ...td[DIFF_TYPES.DELETED_SUSPECT],
        ...td[DIFF_TYPES.EVENT_BASED_RESOLVABLE]
      ];
      for (const item of conflicts) {
        const dec = decisions[table]?.[item.id];
        if (!dec || !dec.choice) {
          setDecision(table, item.id, choice);
        }
      }
    }
  }

  function deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }
</script>

<div class="merge-panel">
  <div class="merge-header">
    <div>
      <h2><Database size={20} />离线多设备数据合并</h2>
      <p class="merge-subtitle">
        导入文件：<strong>{importFileName}</strong>
        {#if importMeta?.deviceId}
          · 来源设备：<code>{importMeta.deviceId}</code>
        {/if}
        {#if importMeta?.exportedAt}
          · 导出时间：{formatEventTime(importMeta.exportedAt)}
        {/if}
      </p>
      {#if deviceStats.total > 0}
        <div class="device-stats-row">
          <span class="device-stat">
            <Cpu size={12} class="stat-icon cur" />
            当前设备 {currentMeta?.deviceId || '(未知)'}：<strong>{deviceStats.current}</strong> 条变更事件
          </span>
          <span class="device-stat">
            <Cpu size={12} class="stat-icon imp" />
            导入设备 {importMeta?.deviceId || '(未知)'}：<strong>{deviceStats.import}</strong> 条变更事件
          </span>
          <span class="device-stat total">
            <Activity size={12} class="stat-icon" />
            合计 {deviceStats.total} 条同步事件
          </span>
        </div>
      {/if}
    </div>
    <button type="button" class="icon-btn" on:click={onClose} aria-label="关闭"><X size={20} /></button>
  </div>

  {#if diffResult.risks && diffResult.risks.length > 0}
    <div class="risk-banner">
      <AlertTriangle size={18} />
      <span>检测到 <strong>{diffResult.risks.length}</strong> 个跨表引用风险，请在合并前确认：</span>
    </div>
    <div class="risk-list">
      {#each diffResult.risks as risk, i}
        <div class="risk-item {getRiskClass(risk.severity)}">
          <strong>[{TABLE_LABELS[risk.table] || risk.table}]</strong>
          <span>{risk.recordName} · {risk.message}</span>
          {#if risk.severity === 'danger'}
            <XCircle size={14} />
          {/if}
        </div>
      {/each}
    </div>
  {/if}

  <div class="merge-summary">
    {#each TABLE_ORDER as table}
      {@const sum = diffResult.summary[table]}
      {@const totalPending = (sum?.[DIFF_TYPES.FIELD_CONFLICT] || 0) + (sum?.[DIFF_TYPES.DELETED_SUSPECT] || 0)}
      <button
        type="button"
        class="sum-card {activeTable === table ? 'active' : ''}"
        on:click={() => { activeTable = table; }}
      >
        <div class="sum-title">{TABLE_LABELS[table] || table}</div>
        <div class="sum-grid">
          {#if sum?.[DIFF_TYPES.ADDED]}
            <span class="sum-chip diff-added"><Plus size={10} />{sum[DIFF_TYPES.ADDED]}</span>
          {/if}
          {#if sum?.[DIFF_TYPES.FIELD_CONFLICT]}
            <span class="sum-chip diff-conflict"><AlertTriangle size={10} />{sum[DIFF_TYPES.FIELD_CONFLICT]}</span>
          {/if}
          {#if sum?.[DIFF_TYPES.DELETED_SUSPECT]}
            <span class="sum-chip diff-deleted"><Minus size={10} />{sum[DIFF_TYPES.DELETED_SUSPECT]}</span>
          {/if}
          {#if sum?.[DIFF_TYPES.MODIFIED_ONLY_IN_IMPORT]}
            <span class="sum-chip diff-imp-mod">{sum[DIFF_TYPES.MODIFIED_ONLY_IN_IMPORT]}导入侧更新</span>
          {/if}
          {#if sum?.[DIFF_TYPES.MODIFIED_ONLY_IN_CURRENT]}
            <span class="sum-chip diff-cur-mod">{sum[DIFF_TYPES.MODIFIED_ONLY_IN_CURRENT]}当前侧更新</span>
          {/if}
          {#if sum?.[DIFF_TYPES.IDENTICAL]}
            <span class="sum-chip diff-identical"><CheckCircle size={10} />{sum[DIFF_TYPES.IDENTICAL]}</span>
          {/if}
        </div>
      </button>
    {/each}

    {#each AUTO_MERGE_TABLES as table}
      {@const count = diffResult.autoMergeSummary?.[table] || 0}
      {#if count > 0}
        <div class="sum-card auto-merge">
          <div class="sum-title">{TABLE_LABELS[table] || table}</div>
          <div class="sum-grid">
            <span class="sum-chip diff-added">自动追加 {count} 条新记录</span>
          </div>
          <p class="sum-hint">记录类数据无冲突，将直接合并不重复的记录</p>
        </div>
      {/if}
    {/each}
  </div>

  <div class="merge-workspace">
    <div class="filter-tabs">
      {#each FILTER_ORDER as type}
        {@const count = diffResult.summary?.[activeTable]?.[type] || 0}
        {#if count > 0 || type === activeFilter}
          <button
            type="button"
            class="filter-tab {activeFilter === type ? 'active' : ''} {getFilterClass(type)}"
            on:click={() => { activeFilter = type; }}
          >
            {DIFF_LABELS[type]}
            <span class="filter-count">{count}</span>
          </button>
        {/if}
      {/each}
    </div>

    <div class="diff-list">
      {#if activeFilterItems.length === 0}
        <div class="diff-empty">
          <CheckCircle2 size={28} />
          <p>该分类下没有需要处理的记录</p>
        </div>
      {:else}
        {#each activeFilterItems as item}
          {@const isExpanded = expandedItems.has(item.id)}
          {@const dec = decisions[activeTable]?.[item.id]}
          {@const needsDecision = activeFilter === DIFF_TYPES.FIELD_CONFLICT || activeFilter === DIFF_TYPES.DELETED_SUSPECT}
          <div class="diff-item {getFilterClass(activeFilter)} {needsDecision && (!dec || !dec.choice) ? 'needs-decision' : ''}">
            <button type="button" class="diff-header" on:click={() => toggleItem(item.id)}>
              {#if isExpanded}
                <ChevronDown size={16} />
              {:else}
                <ChevronRight size={16} />
              {/if}
              <span class="diff-title">
                {activeFilter === DIFF_TYPES.ADDED
                  ? getRecordTitle(activeTable, item.imported)
                  : getRecordTitle(activeTable, item.current || item.imported)}
              </span>
              {#if needsDecision}
                {#if dec?.choice}
                  <span class="decision-badge decision-{dec.choice}">
                    {DECISION_LABELS[dec.choice]}
                  </span>
                {:else}
                  <span class="decision-badge decision-pending">待处理</span>
                {/if}
              {/if}
            </button>

            {#if isExpanded}
              <div class="diff-body">

                {#if item.timelineAnalysis?.autoReason && activeFilter !== DIFF_TYPES.IDENTICAL && activeFilter !== DIFF_TYPES.ADDED}
                  <div class="event-analysis-banner {item.timelineAnalysis.canAutoResolve ? 'info' : 'warning'}">
                    <GitBranch size={14} />
                    <span>
                      <strong>事件时间线分析：</strong>
                      {item.timelineAnalysis.autoReason}
                    </span>
                    {#if item.timelineAnalysis.conflictSources && item.timelineAnalysis.conflictSources.length > 0}
                      <span class="conflict-fields-tag">
                        冲突字段：{item.timelineAnalysis.conflictSources.join('、').replace('__existence__', '存在状态')}
                      </span>
                    {/if}
                  </div>
                {/if}

                {#if activeFilter === DIFF_TYPES.EVENT_BASED_RESOLVABLE}
                  <div class="event-suggestion-box">
                    <Activity size={14} />
                    <div class="suggestion-content">
                      <strong>双向合并建议</strong>
                      <p class="suggestion-hint">双方修改了不同字段，系统建议双向合并。点击"应用建议"自动合并，或手动选择保留方向。</p>
                      {#if decisions[activeTable]?.[item.id]?.autoReason}
                        <p class="suggestion-reason">{decisions[activeTable][item.id].autoReason}</p>
                      {/if}
                      <button
                        type="button"
                        class="apply-suggestion-btn"
                        on:click={() => applyAutoMergedSuggestion(activeTable, item.id, item)}
                        disabled={!decisions[activeTable]?.[item.id]?.autoMergedData}
                      >
                        <GitBranch size={12} />应用双向合并建议
                      </button>
                    </div>
                  </div>
                {/if}

                {#if activeFilter === DIFF_TYPES.ADDED}
                  <div class="side-by-side">
                    <div class="side side-import">
                      <div class="side-label"><Plus size={14} />导入侧（将新增）</div>
                      <pre class="record-preview">{JSON.stringify(item.imported, null, 2)}</pre>
                    </div>
                  </div>
                {:else if activeFilter === DIFF_TYPES.IDENTICAL}
                  <div class="side-by-side">
                    <div class="side side-identical">
                      <div class="side-label"><CheckCircle size={14} />两侧完全相同</div>
                      <pre class="record-preview">{JSON.stringify(item.current, null, 2)}</pre>
                    </div>
                  </div>
                {:else if activeFilter === DIFF_TYPES.DELETED_SUSPECT}
                  <div class="side-by-side">
                    <div class="side side-current">
                      <div class="side-label">当前侧有此记录</div>
                      <pre class="record-preview">{JSON.stringify(item.current, null, 2)}</pre>
                    </div>
                    <div class="side side-empty">
                      <div class="side-label"><Minus size={14} />导入侧无此记录（疑似删除）</div>
                      <p class="empty-hint">保留当前可防止误删。如确认是删除操作请选择"使用导入版本"。</p>
                    </div>
                  </div>
                {:else}
                  <div class="conflict-fields">
                    <table class="conflict-table">
                      <thead>
                        <tr>
                          <th>字段</th>
                          <th>当前版本</th>
                          <th>导入版本</th>
                          {#if dec?.choice === DECISION_CHOICES.MANUAL}
                            <th>手动合并结果</th>
                          {/if}
                        </tr>
                      </thead>
                      <tbody>
                        {#each item.fieldConflicts as fc}
                          <tr>
                            <td class="conflict-field-name"><strong>{fc.field}</strong></td>
                            <td class="conflict-value current">{fieldValueToString(fc.current)}</td>
                            <td class="conflict-value imported">{fieldValueToString(fc.imported)}</td>
                            {#if dec?.choice === DECISION_CHOICES.MANUAL}
                              <td class="conflict-value manual">
                                <input
                                  value={manualEditItem?.id === item.id ? (manualMergeData[fc.field] ?? '') : (dec.mergedData?.[fc.field] ?? fieldValueToString(fc.current))}
                                  on:input={(e) => { updateManualField(fc.field, e.target.value); }}
                                  placeholder={fieldValueToString(fc.current)}
                                />
                              </td>
                            {/if}
                          </tr>
                        {/each}
                      </tbody>
                    </table>
                  </div>
                {/if}

                {#if item.timelineAnalysis?.hasEvents}
                  <button
                    type="button"
                    class="timeline-toggle"
                    on:click={() => toggleTimeline(item.id)}
                  >
                    {#if expandedTimelines.has(item.id)}
                      <ChevronDown size={14} />
                    {:else}
                      <ChevronRight size={14} />
                    {/if}
                    <Clock size={14} />
                    <span>查看变更事件时间线（{item.timelineAnalysis.allEvents.length} 条）</span>
                  </button>
                  {#if expandedTimelines.has(item.id)}
                    <div class="timeline-container">
                      {#each item.timelineAnalysis.allEvents as event}
                        <div class="timeline-item {getSideClass(event.side)}">
                          <div class="timeline-dot"></div>
                          <div class="timeline-content">
                            <div class="timeline-header">
                              <span class="timeline-side-tag">{getSideLabel(event.side)}</span>
                              <span class="timeline-event-type">
                                {EVENT_TYPE_LABELS[event.eventType] || event.eventType}
                              </span>
                              <span class="timeline-device">{event.deviceId}</span>
                            </div>
                            <div class="timeline-time">
                              <Clock size={11} />
                              {formatEventTime(event.timestamp)}
                              {event.syncCounter ? ` · #${event.syncCounter}` : ''}
                            </div>
                            {#if event.note}
                              <div class="timeline-note">{event.note}</div>
                            {/if}
                            {#if event.changedFields && event.changedFields.length > 0}
                              <div class="timeline-fields">
                                变更字段：{event.changedFields.join('、')}
                              </div>
                            {/if}
                          </div>
                        </div>
                      {/each}
                    </div>
                  {/if}
                {/if}

                {#if needsDecision}
                  <div class="decision-actions">
                    <button
                      type="button"
                      class="secondary {dec?.choice === DECISION_CHOICES.KEEP_CURRENT ? 'selected' : ''}"
                      on:click={() => setDecision(activeTable, item.id, DECISION_CHOICES.KEEP_CURRENT)}
                    >
                      保留当前
                    </button>
                    <button
                      type="button"
                      class="{dec?.choice === DECISION_CHOICES.USE_IMPORT ? 'selected' : ''}"
                      on:click={() => setDecision(activeTable, item.id, DECISION_CHOICES.USE_IMPORT)}
                    >
                      使用导入
                    </button>
                    {#if activeFilter === DIFF_TYPES.FIELD_CONFLICT && item.fieldConflicts.length > 0}
                      {#if manualEditItem?.id === item.id}
                        <button
                          type="button"
                          class="selected"
                          on:click={saveManualEdit}
                        >
                          <Save size={14} />保存手动合并
                        </button>
                        <button
                          type="button"
                          class="secondary"
                          on:click={cancelManualEdit}
                        >
                          取消
                        </button>
                      {:else}
                        <button
                          type="button"
                          class="secondary {dec?.choice === DECISION_CHOICES.MANUAL ? 'selected' : ''}"
                          on:click={() => startManualEdit(activeTable, item)}
                        >
                          <Edit3 size={14} />手动合并
                        </button>
                      {/if}
                    {/if}
                  </div>
                {/if}
              </div>
            {/if}
          </div>
        {/each}
      {/if}
    </div>
  </div>

  <div class="merge-footer">
    <div class="footer-left">
      {#if pendingCount > 0}
        <div class="pending-box">
          <AlertTriangle size={16} />
          <span>还有 <strong>{pendingCount}</strong> 个冲突/删除待决定</span>
          <div class="batch-actions">
            <button type="button" class="secondary small-btn" on:click={() => batchResolveAll(DECISION_CHOICES.KEEP_CURRENT)}>
              全部保留当前
            </button>
            <button type="button" class="small-btn" on:click={() => batchResolveAll(DECISION_CHOICES.USE_IMPORT)}>
              全部使用导入
            </button>
          </div>
        </div>
      {:else}
        <div class="ready-box">
          <CheckCircle2 size={16} />
          <span>所有变更已决定，可执行合并</span>
        </div>
      {/if}
    </div>
    <div class="footer-actions">
      <button type="button" class="secondary" on:click={onClose}>取消</button>
      <button
        type="button"
        on:click={handleConfirm}
        disabled={!canProceed}
      >
        <RefreshCw size={16} />确认合并
      </button>
    </div>
  </div>
</div>

<style>
  .merge-panel {
    display: flex;
    flex-direction: column;
    max-height: 85vh;
  }
  .merge-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    padding: 16px 20px;
    border-bottom: 1px solid #e8dfd2;
  }
  .merge-header h2 { margin: 0 0 4px; font-size: 18px; display: flex; align-items: center; gap: 8px; }
  .merge-subtitle { margin: 0; color: #8a7665; font-size: 13px; }
  .merge-subtitle code { background: #f0e6d6; padding: 1px 6px; border-radius: 3px; font-size: 12px; }
  .icon-btn { background: none; border: none; cursor: pointer; padding: 6px; border-radius: 4px; color: #6b5a4a; }
  .icon-btn:hover { background: #f0e6d6; }

  .risk-banner {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 20px;
    background: #fff4e6;
    color: #8a5a1a;
    border-bottom: 1px solid #ffe0bf;
    font-size: 14px;
  }
  .risk-list {
    max-height: 100px;
    overflow-y: auto;
    padding: 8px 20px;
    background: #fffaf2;
    border-bottom: 1px solid #ffe0bf;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .risk-item {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 10px;
    border-radius: 4px;
    font-size: 13px;
  }
  .risk-item.risk-warning { background: #fff4e6; color: #8a5a1a; }
  .risk-item.risk-danger { background: #fdecea; color: #8a2d2d; }

  .merge-summary {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
    gap: 10px;
    padding: 12px 20px;
    border-bottom: 1px solid #e8dfd2;
    background: #faf6f0;
  }
  .sum-card {
    background: #fff;
    border: 2px solid #e8dfd2;
    border-radius: 6px;
    padding: 10px 12px;
    cursor: pointer;
    text-align: left;
    transition: all 0.15s;
    font-family: inherit;
  }
  .sum-card:hover { border-color: #c9a97e; }
  .sum-card.active { border-color: #8a5b41; background: #fdf6ec; }
  .sum-card.auto-merge { cursor: default; opacity: 0.85; }
  .sum-title { font-weight: 600; font-size: 13px; margin-bottom: 6px; color: #4a3a2a; }
  .sum-grid { display: flex; flex-wrap: wrap; gap: 4px; }
  .sum-hint { margin: 6px 0 0; font-size: 11px; color: #8a7665; }
  .sum-chip {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    padding: 2px 7px;
    border-radius: 10px;
    font-size: 11px;
    font-weight: 500;
  }
  .sum-chip.diff-added { background: #e6f0e6; color: #2d5a2d; }
  .sum-chip.diff-identical { background: #e6eef6; color: #1a4a8a; }
  .sum-chip.diff-conflict { background: #fff4e6; color: #8a5a1a; }
  .sum-chip.diff-deleted { background: #fdecea; color: #8a2d2d; }
  .sum-chip.diff-cur-mod { background: #eef0e6; color: #5a6a2d; }
  .sum-chip.diff-imp-mod { background: #e6ecf0; color: #2d4a6a; }

  .merge-workspace {
    flex: 1;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }
  .filter-tabs {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    padding: 10px 20px;
    border-bottom: 1px solid #e8dfd2;
    background: #fff;
  }
  .filter-tab {
    padding: 6px 12px;
    border: 1px solid #e8dfd2;
    background: #faf6f0;
    border-radius: 16px;
    cursor: pointer;
    font-size: 12px;
    display: flex;
    align-items: center;
    gap: 5px;
    font-family: inherit;
    color: #4a3a2a;
  }
  .filter-tab:hover { background: #f0e6d6; }
  .filter-tab.active { background: #8a5b41; color: #fff; border-color: #8a5b41; }
  .filter-count { background: rgba(0,0,0,0.1); padding: 0 6px; border-radius: 8px; font-size: 11px; }
  .filter-tab.active .filter-count { background: rgba(255,255,255,0.25); }

  .diff-list {
    flex: 1;
    overflow-y: auto;
    padding: 12px 20px;
    background: #faf6f0;
  }
  .diff-empty {
    text-align: center;
    padding: 40px 20px;
    color: #8a7665;
  }
  .diff-empty p { margin: 8px 0 0; }
  .diff-item {
    background: #fff;
    border: 1px solid #e8dfd2;
    border-radius: 6px;
    margin-bottom: 8px;
    overflow: hidden;
  }
  .diff-item.needs-decision { border-left: 4px solid #d4893b; }
  .diff-item.diff-conflict { border-left: 4px solid #d4893b; }
  .diff-item.diff-deleted { border-left: 4px solid #c44d4d; }
  .diff-item.diff-added { border-left: 4px solid #4d8a4d; }
  .diff-item.diff-identical { border-left: 4px solid #4d76a8; }
  .diff-item.diff-cur-mod { border-left: 4px solid #7a8a4d; }
  .diff-item.diff-imp-mod { border-left: 4px solid #4d6a8a; }
  .diff-header {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 10px 14px;
    cursor: pointer;
    background: #fdf6ec;
    border: none;
    width: 100%;
    text-align: left;
    font-family: inherit;
    font-size: 14px;
    color: #26211c;
  }
  .diff-header:hover { background: #f6ead8; }
  .diff-title { flex: 1; font-weight: 500; }
  .decision-badge {
    padding: 2px 10px;
    border-radius: 10px;
    font-size: 11px;
    font-weight: 500;
  }
  .decision-badge.decision-pending { background: #fff4e6; color: #8a5a1a; }
  .decision-badge.decision-keep_current { background: #e6eef6; color: #1a4a8a; }
  .decision-badge.decision-use_import { background: #e6f0e6; color: #2d5a2d; }
  .decision-badge.decision-manual { background: #f0e6f0; color: #6a2d6a; }

  .diff-body { padding: 12px 14px; border-top: 1px solid #e8dfd2; }
  .side-by-side { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  .side {
    border: 1px solid #e8dfd2;
    border-radius: 4px;
    padding: 10px;
    background: #faf6f0;
  }
  .side.side-current { border-color: #bcd; background: #f0f4fa; }
  .side.side-import { border-color: #cdeacd; background: #f0faf0; }
  .side.side-identical { border-color: #ccc; background: #f8f8f8; }
  .side.side-empty { background: #fff5f5; border-color: #e8cccc; display: flex; flex-direction: column; justify-content: center; }
  .side-label { font-weight: 600; font-size: 12px; margin-bottom: 6px; display: flex; align-items: center; gap: 5px; color: #4a3a2a; }
  .side.side-current .side-label { color: #1a4a8a; }
  .side.side-import .side-label { color: #2d5a2d; }
  .record-preview {
    margin: 0;
    padding: 8px;
    background: #fff;
    border-radius: 4px;
    font-size: 11px;
    max-height: 220px;
    overflow: auto;
    white-space: pre-wrap;
    word-break: break-all;
  }
  .empty-hint { color: #8a7665; font-size: 12px; margin: 0; }

  .conflict-fields { margin-bottom: 10px; }
  .conflict-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 13px;
  }
  .conflict-table th, .conflict-table td {
    padding: 8px 10px;
    border: 1px solid #e8dfd2;
    text-align: left;
    vertical-align: top;
  }
  .conflict-table th {
    background: #fdf6ec;
    font-weight: 600;
    font-size: 12px;
    color: #4a3a2a;
  }
  .conflict-field-name { font-family: monospace; background: #faf6f0; white-space: nowrap; }
  .conflict-value.current { background: #f0f4fa; }
  .conflict-value.imported { background: #f0faf0; }
  .conflict-value.manual { background: #faf0f5; }
  .conflict-value input {
    width: 100%;
    padding: 4px 6px;
    border: 1px solid #d4b896;
    border-radius: 3px;
    font-size: 13px;
    background: #fff;
    font-family: inherit;
  }

  .decision-actions {
    display: flex;
    gap: 8px;
    padding-top: 10px;
    border-top: 1px dashed #e8dfd2;
    flex-wrap: wrap;
  }
  .decision-actions button {
    padding: 6px 14px;
    border-radius: 4px;
    border: 1px solid #d4b896;
    cursor: pointer;
    font-size: 13px;
    display: flex;
    align-items: center;
    gap: 5px;
    font-family: inherit;
  }
  .decision-actions button { background: #fff; color: #4a3a2a; }
  .decision-actions button.secondary { background: #faf6f0; }
  .decision-actions button.selected { background: #8a5b41; color: #fff; border-color: #8a5b41; }
  .decision-actions button:hover:not(.selected) { background: #f0e6d6; }

  .merge-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 14px 20px;
    border-top: 1px solid #e8dfd2;
    background: #fff;
    gap: 16px;
    flex-wrap: wrap;
  }
  .footer-left { flex: 1; }
  .pending-box {
    display: flex;
    align-items: center;
    gap: 8px;
    color: #8a5a1a;
    font-size: 14px;
    flex-wrap: wrap;
  }
  .batch-actions { display: flex; gap: 6px; margin-left: 8px; }
  .small-btn {
    padding: 4px 10px;
    border-radius: 4px;
    border: 1px solid #d4b896;
    background: #fff;
    cursor: pointer;
    font-size: 12px;
    font-family: inherit;
    color: #4a3a2a;
  }
  .small-btn:hover { background: #f0e6d6; }
  .ready-box {
    display: flex;
    align-items: center;
    gap: 8px;
    color: #2d5a2d;
    font-size: 14px;
  }
  .footer-actions { display: flex; gap: 8px; }
  .footer-actions button {
    padding: 8px 16px;
    border-radius: 4px;
    border: 1px solid #d4b896;
    cursor: pointer;
    font-size: 14px;
    display: flex;
    align-items: center;
    gap: 6px;
    font-family: inherit;
    background: #fff;
    color: #4a3a2a;
  }
  .footer-actions button.secondary { background: #faf6f0; }
  .footer-actions button:not(:disabled):hover { background: #f0e6d6; }
  .footer-actions button:not(.secondary):not(:disabled) {
    background: #8a5b41;
    color: #fff;
    border-color: #8a5b41;
  }
  .footer-actions button:not(.secondary):not(:disabled):hover { background: #6b4430; }
  .footer-actions button:disabled { opacity: 0.5; cursor: not-allowed; }

  .device-stats-row {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 8px;
  }
  .device-stat {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 4px 10px;
    background: #faf6f0;
    border-radius: 12px;
    font-size: 12px;
    color: #4a3a2a;
  }
  .device-stat.total {
    background: #eef0e6;
    color: #5a6a2d;
  }
  .stat-icon.cur { color: #1a4a8a; }
  .stat-icon.imp { color: #2d5a2d; }

  .event-analysis-banner {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    padding: 10px 12px;
    border-radius: 6px;
    margin-bottom: 12px;
    font-size: 13px;
    line-height: 1.5;
  }
  .event-analysis-banner.info {
    background: #eef4fa;
    color: #1a4a8a;
    border: 1px solid #bcd;
  }
  .event-analysis-banner.warning {
    background: #fff4e6;
    color: #8a5a1a;
    border: 1px solid #ffe0bf;
  }
  .event-analysis-banner strong {
    white-space: nowrap;
  }
  .conflict-fields-tag {
    margin-left: 8px;
    padding: 1px 8px;
    background: rgba(0,0,0,0.08);
    border-radius: 10px;
    font-size: 11px;
  }

  .event-suggestion-box {
    display: flex;
    gap: 10px;
    padding: 12px;
    background: #f0eef6;
    border: 1px solid #d4c9e8;
    border-radius: 6px;
    margin-bottom: 12px;
  }
  .event-suggestion-box > :first-child {
    color: #6a2d6a;
    flex-shrink: 0;
    margin-top: 2px;
  }
  .suggestion-content { flex: 1; font-size: 13px; color: #4a3a5a; }
  .suggestion-content strong { color: #6a2d6a; display: block; margin-bottom: 4px; }
  .suggestion-hint { margin: 0 0 4px; color: #6a5a7a; }
  .suggestion-reason { margin: 0 0 8px; font-size: 12px; color: #8a7a9a; }
  .apply-suggestion-btn {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 5px 12px;
    background: #6a2d6a;
    color: #fff;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 12px;
    font-family: inherit;
  }
  .apply-suggestion-btn:hover:not(:disabled) { background: #5a1d5a; }
  .apply-suggestion-btn:disabled { opacity: 0.5; cursor: not-allowed; }

  .timeline-toggle {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 6px 10px;
    background: #faf6f0;
    border: 1px solid #e8dfd2;
    border-radius: 4px;
    cursor: pointer;
    font-size: 12px;
    color: #4a3a2a;
    font-family: inherit;
    margin: 10px 0 6px;
  }
  .timeline-toggle:hover { background: #f0e6d6; }

  .timeline-container {
    margin: 6px 0 12px;
    padding: 10px 12px 10px 20px;
    background: #faf6f0;
    border-radius: 6px;
    border: 1px solid #e8dfd2;
  }
  .timeline-item {
    position: relative;
    padding: 6px 0 6px 14px;
    margin-left: 8px;
    border-left: 2px solid #d4b896;
  }
  .timeline-item.timeline-current {
    border-left-color: #4d76a8;
  }
  .timeline-item.timeline-import {
    border-left-color: #4d8a4d;
  }
  .timeline-dot {
    position: absolute;
    left: -7px;
    top: 12px;
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: #d4b896;
    border: 2px solid #fff;
  }
  .timeline-current .timeline-dot { background: #4d76a8; }
  .timeline-import .timeline-dot { background: #4d8a4d; }

  .timeline-content { font-size: 12px; color: #4a3a2a; }
  .timeline-header {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    margin-bottom: 3px;
    align-items: center;
  }
  .timeline-side-tag {
    padding: 1px 6px;
    border-radius: 8px;
    font-size: 10px;
    font-weight: 600;
  }
  .timeline-current .timeline-side-tag {
    background: #e6eef6;
    color: #1a4a8a;
  }
  .timeline-import .timeline-side-tag {
    background: #e6f0e6;
    color: #2d5a2d;
  }
  .timeline-event-type {
    font-weight: 600;
    color: #8a5b41;
    font-size: 11px;
  }
  .timeline-device {
    padding: 0 4px;
    font-family: monospace;
    font-size: 10px;
    background: #f0e6d6;
    border-radius: 3px;
    color: #6b5a4a;
  }
  .timeline-time {
    display: flex;
    align-items: center;
    gap: 4px;
    color: #8a7665;
    font-size: 11px;
    margin-bottom: 2px;
  }
  .timeline-note {
    color: #5a4a3a;
    font-size: 12px;
    padding: 2px 0;
  }
  .timeline-fields {
    margin-top: 2px;
    font-size: 11px;
    color: #6b5a4a;
  }

  .sum-chip.diff-event { background: #f0eef6; color: #6a2d6a; }
  .diff-item.diff-event { border-left: 4px solid #8a4d8a; }
</style>
