<script>
  import { X, AlertTriangle, CheckCircle, Plus, Minus, ChevronDown, ChevronRight, Save, ArrowRightLeft, Database, RefreshCw, CheckCircle2, XCircle, Edit3, Clock, Cpu, GitBranch, Activity, Layers, Users, Calendar, ClipboardList, Box, Package, AlertOctagon, Zap, Eye, EyeOff, Filter, Shield, Trash2, Link, Unlink, BarChart3, ArrowRight, SkipForward, Settings2, Download } from 'lucide-svelte';
  import { TABLES, TABLE_LABELS, EVENT_TYPE_LABELS } from '$lib/database.js';
  import {
    DIFF_TYPES,
    DIFF_LABELS,
    DECISION_CHOICES,
    DECISION_LABELS,
    MERGE_TABLES,
    AUTO_MERGE_TABLES,
    collectPendingConflicts,
    fieldValueToString,
    BATCH_STRATEGIES,
    BATCH_STRATEGY_LABELS,
    RISK_LEVELS,
    RISK_LEVEL_LABELS,
    IMPACT_TYPE_LABELS,
    buildPreviewSummary,
    computeImpactAnalysis,
    computeRiskList,
    applyBatchStrategy
  } from '$lib/mergeUtils.js';

  export let diffResult;
  export let decisions;
  export let importFileName;
  export let importMeta;
  export let currentDB;
  export let onClose;
  export let onConfirmMerge;
  export let onUpdateDecisions;

  const PHASES = {
    PREVIEW: 'preview',
    REVIEW: 'review',
    CONFIRM: 'confirm'
  };
  let phase = PHASES.PREVIEW;

  let activeTable = TABLES.costumes;
  let activeFilter = DIFF_TYPES.FIELD_CONFLICT;
  let previewGroupBy = 'table';
  let expandedItems = new Set();
  let expandedTimelines = new Set();
  let manualEditItem = null;
  let manualEditTable = null;
  let manualMergeData = {};
  let selectedBatchStrategy = BATCH_STRATEGIES.LATEST_EVENT;
  let batchScope = { tables: null, riskLevels: null, diffTypes: null };
  let previewExpandedTables = new Set();
  let showRiskDetails = false;

  $: impactAnalysis = currentDB && diffResult ? computeImpactAnalysis(currentDB, diffResult) : {};
  $: previewSummary = diffResult && impactAnalysis ? buildPreviewSummary(diffResult, impactAnalysis) : null;
  $: pending = collectPendingConflicts(diffResult, decisions);
  $: pendingCount = pending.length;
  $: canProceed = pendingCount === 0;
  $: activeFilterItems = diffResult.tables?.[activeTable]?.[activeFilter] || [];
  $: currentMeta = diffResult?.currentMeta || null;
  $: deviceStats = getDeviceStats(diffResult);
  $: riskList = currentDB && diffResult && decisions && impactAnalysis
    ? computeRiskList(currentDB, diffResult, decisions, impactAnalysis)
    : { toDelete: [], toRemap: [], danglingRisk: [], deletedIds: new Set(), remappedIds: {} };

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
    return severity === 'danger' ? 'risk-danger' : (severity === 'warning' ? 'risk-warning' : 'risk-info');
  }

  function toggleItem(id) {
    if (expandedItems.has(id)) expandedItems.delete(id);
    else expandedItems.add(id);
    expandedItems = new Set(expandedItems);
  }

  function togglePreviewTable(table) {
    if (previewExpandedTables.has(table)) previewExpandedTables.delete(table);
    else previewExpandedTables.add(table);
    previewExpandedTables = new Set(previewExpandedTables);
  }

  function formatShortTime(ts) {
    if (!ts) return '未知';
    const d = new Date(ts);
    return d.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false });
  }

  function setDecision(table, id, choice) {
    const newDec = {
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
    decisions = newDec;
    onUpdateDecisions?.(newDec);
  }

  function applyAutoMergedSuggestion(table, id, item) {
    const dec = decisions[table]?.[id];
    if (dec?.autoMergedData) {
      const newDec = {
        ...decisions,
        [table]: {
          ...(decisions[table] || {}),
          [id]: {
            choice: DECISION_CHOICES.MANUAL,
            mergedData: deepClone(dec.autoMergedData)
          }
        }
      };
      decisions = newDec;
      onUpdateDecisions?.(newDec);
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
    const newDec = {
      ...decisions,
      [table]: {
        ...(decisions[table] || {}),
        [item.id]: {
          choice: DECISION_CHOICES.MANUAL,
          mergedData: merged
        }
      }
    };
    decisions = newDec;
    onUpdateDecisions?.(newDec);
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
    const newDec = {
      ...decisions,
      [manualEditTable]: {
        ...(decisions[manualEditTable] || {}),
        [item.id]: {
          choice: DECISION_CHOICES.MANUAL,
          mergedData: merged
        }
      }
    };
    decisions = newDec;
    onUpdateDecisions?.(newDec);
  }

  function saveManualEdit() {
    manualEditItem = null;
    manualEditTable = null;
    manualMergeData = {};
  }

  function cancelManualEdit() {
    if (manualEditTable && manualEditItem) {
      const newDec = {
        ...decisions,
        [manualEditTable]: {
          ...(decisions[manualEditTable] || {}),
          [manualEditItem.id]: {
            choice: null,
            mergedData: null
          }
        }
      };
      decisions = newDec;
      onUpdateDecisions?.(newDec);
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
    const newDec = applyBatchStrategy(
      diffResult,
      decisions,
      choice === DECISION_CHOICES.KEEP_CURRENT ? BATCH_STRATEGIES.KEEP_CURRENT_ALL : BATCH_STRATEGIES.USE_IMPORT_ALL
    );
    decisions = newDec;
    onUpdateDecisions?.(newDec);
  }

  function handleApplyBatchStrategy() {
    const newDec = applyBatchStrategy(diffResult, decisions, selectedBatchStrategy, batchScope);
    decisions = newDec;
    onUpdateDecisions?.(newDec);
  }

  function goToPhase(target) {
    phase = target;
  }

  function jumpToReview(table, id, diffType) {
    activeTable = table;
    activeFilter = diffType;
    phase = PHASES.REVIEW;
    if (id) {
      expandedItems.add(id);
      expandedItems = new Set(expandedItems);
    }
  }

  function getImpactBadgeClass(range) {
    switch (range) {
      case 'high': return 'impact-high';
      case 'medium': return 'impact-medium';
      case 'low': return 'impact-low';
      default: return 'impact-none';
    }
  }

  function getImpactRangeLabel(range) {
    switch (range) {
      case 'high': return '高影响 (≥10)';
      case 'medium': return '中影响 (3-9)';
      case 'low': return '低影响 (1-2)';
      default: return '无引用';
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

  <div class="phase-tabs">
    <button
      type="button"
      class="phase-tab {phase === 'preview' ? 'active' : ''}"
      on:click={() => goToPhase('preview')}
    >
      <BarChart3 size={14} />
      <span>① 合并预演</span>
      <span class="phase-hint">分组摘要 + 批量策略</span>
    </button>
    <div class="phase-arrow"><ArrowRight size={14} /></div>
    <button
      type="button"
      class="phase-tab {phase === 'review' ? 'active' : ''}"
      on:click={() => goToPhase('review')}
    >
      <Eye size={14} />
      <span>② 逐条审核</span>
      <span class="phase-hint">
        {#if pendingCount > 0}
          <AlertTriangle size={12} class="inline-icon warn" /> {pendingCount} 项待决定
        {:else}
          <CheckCircle size={12} class="inline-icon ok" /> 全部已决定
        {/if}
      </span>
    </button>
    <div class="phase-arrow"><ArrowRight size={14} /></div>
    <button
      type="button"
      class="phase-tab {phase === 'confirm' ? 'active' : ''}"
      on:click={() => goToPhase('confirm')}
      disabled={!canProceed}
    >
      <Shield size={14} />
      <span>③ 执行确认</span>
      <span class="phase-hint">
        {#if canProceed}
          <CheckCircle2 size={12} class="inline-icon ok" /> 可执行
        {:else}
          <XCircle size={12} class="inline-icon warn" /> 待完成审核
        {/if}
      </span>
    </button>
  </div>

  {#if phase === 'preview' && previewSummary}
    <div class="preview-phase">
      <div class="preview-section">
        <div class="section-title">
          <Layers size={16} />
          <span>按<strong>数据表</strong>分组（共 {previewSummary.totals.tables} 张表需要决策）</span>
        </div>
        <div class="preview-tables-grid">
          {#each Object.keys(previewSummary.byTable) as table}
            {@const info = previewSummary.byTable[table]}
            {#if info.needsDecision > 0}
              <div class="preview-table-card">
                <button
                  type="button"
                  class="ptc-header"
                  on:click={() => togglePreviewTable(table)}
                >
                  {#if previewExpandedTables.has(table)}
                    <ChevronDown size={16} />
                  {:else}
                    <ChevronRight size={16} />
                  {/if}
                  <span class="ptc-name">{info.label}</span>
                  <span class="ptc-badges">
                    <span class="ptc-badge warn"><AlertTriangle size={10} /> {info.needsDecision} 项待决</span>
                    {#if info.totalImpactCount > 0}
                      <span class="ptc-badge impact">
                        <Users size={10} /> 影响 {info.totalImpactCount} 处引用
                      </span>
                    {/if}
                  </span>
                </button>
                {#if previewExpandedTables.has(table)}
                  <div class="ptc-body">
                    <div class="ptc-stats">
                      {#if info.counts?.[DIFF_TYPES.FIELD_CONFLICT]}
                        <span class="stat-chip diff-conflict">字段冲突 ×{info.counts[DIFF_TYPES.FIELD_CONFLICT]}</span>
                      {/if}
                      {#if info.counts?.[DIFF_TYPES.DELETED_SUSPECT]}
                        <span class="stat-chip diff-deleted">疑似删除 ×{info.counts[DIFF_TYPES.DELETED_SUSPECT]}</span>
                      {/if}
                      {#if info.counts?.[DIFF_TYPES.EVENT_BASED_RESOLVABLE]}
                        <span class="stat-chip diff-event">时间线可决 ×{info.counts[DIFF_TYPES.EVENT_BASED_RESOLVABLE]}</span>
                      {/if}
                      {#if info.counts?.[DIFF_TYPES.MODIFIED_ONLY_IN_CURRENT]}
                        <span class="stat-chip diff-cur-mod">仅当前改 ×{info.counts[DIFF_TYPES.MODIFIED_ONLY_IN_CURRENT]}</span>
                      {/if}
                      {#if info.counts?.[DIFF_TYPES.MODIFIED_ONLY_IN_IMPORT]}
                        <span class="stat-chip diff-imp-mod">仅导入改 ×{info.counts[DIFF_TYPES.MODIFIED_ONLY_IN_IMPORT]}</span>
                      {/if}
                    </div>
                    <div class="ptc-rows">
                      {#each info.items as row}
                        <div class="ptc-row {getRiskClass(row.riskLevel)}">
                          <div class="ptc-row-main">
                            <span class="risk-dot risk-{row.riskLevel}" title="{RISK_LEVEL_LABELS[row.riskLevel]}"></span>
                            <button
                              type="button"
                              class="ptc-row-name"
                              on:click={() => jumpToReview(row.table, row.id, row.diffType)}
                            >
                              {row.recordName}
                            </button>
                            <span class="ptc-row-type diff-{row.diffType}">{DIFF_LABELS[row.diffType]}</span>
                          </div>
                          <div class="ptc-row-meta">
                            {#if row.impactTotal > 0}
                              <span class="ptc-impact {getImpactBadgeClass(row.impactRange)}">
                                <Users size={10} /> {row.impactTotal} 引用
                              </span>
                            {/if}
                            {#if row.timelineCanAuto}
                              <span class="ptc-timeline-auto" title="{row.timelineReason}">
                                <Clock size={10} /> 可自动
                              </span>
                            {/if}
                            {#if row.conflictFields.length > 0}
                              <span class="ptc-fields" title={row.conflictFields.join('、')}>
                                冲突：{row.conflictFields.slice(0, 2).join('、')}{row.conflictFields.length > 2 ? '…' : ''}
                              </span>
                            {/if}
                          </div>
                        </div>
                      {/each}
                    </div>
                  </div>
                {/if}
              </div>
            {/if}
          {/each}
        </div>
      </div>

      <div class="preview-section">
        <div class="section-title">
          <Shield size={16} />
          <span>按<strong>风险级别</strong>分组</span>
        </div>
        <div class="risk-level-grid">
          <div class="rl-card danger">
            <div class="rl-title"><AlertOctagon size={16} /> 高危</div>
            <div class="rl-count">{previewSummary.totals.danger}</div>
            <div class="rl-list">
              {#each previewSummary.byRiskLevel[RISK_LEVELS.DANGER].slice(0, 5) as row}
                <button
                  type="button"
                  class="rl-item"
                  on:click={() => jumpToReview(row.table, row.id, row.diffType)}
                >
                  <span class="rl-name">{TABLE_LABELS[row.table]}: {row.recordName}</span>
                  {#if row.impactTotal > 0}
                    <span class="rl-imp">{row.impactTotal}引用</span>
                  {/if}
                </button>
              {/each}
              {#if previewSummary.byRiskLevel[RISK_LEVELS.DANGER].length > 5}
                <div class="rl-more">+{previewSummary.byRiskLevel[RISK_LEVELS.DANGER].length - 5} 项更多</div>
              {/if}
            </div>
          </div>
          <div class="rl-card warning">
            <div class="rl-title"><AlertTriangle size={16} /> 警告</div>
            <div class="rl-count">{previewSummary.totals.warning}</div>
            <div class="rl-list">
              {#each previewSummary.byRiskLevel[RISK_LEVELS.WARNING].slice(0, 5) as row}
                <button
                  type="button"
                  class="rl-item"
                  on:click={() => jumpToReview(row.table, row.id, row.diffType)}
                >
                  <span class="rl-name">{TABLE_LABELS[row.table]}: {row.recordName}</span>
                  {#if row.impactTotal > 0}
                    <span class="rl-imp">{row.impactTotal}引用</span>
                  {/if}
                </button>
              {/each}
              {#if previewSummary.byRiskLevel[RISK_LEVELS.WARNING].length > 5}
                <div class="rl-more">+{previewSummary.byRiskLevel[RISK_LEVELS.WARNING].length - 5} 项更多</div>
              {/if}
            </div>
          </div>
          <div class="rl-card info">
            <div class="rl-title"><CheckCircle size={16} /> 提示</div>
            <div class="rl-count">{previewSummary.totals.info}</div>
            <div class="rl-list">
              {#each previewSummary.byRiskLevel[RISK_LEVELS.INFO].slice(0, 5) as row}
                <button
                  type="button"
                  class="rl-item"
                  on:click={() => jumpToReview(row.table, row.id, row.diffType)}
                >
                  <span class="rl-name">{TABLE_LABELS[row.table]}: {row.recordName}</span>
                </button>
              {/each}
              {#if previewSummary.byRiskLevel[RISK_LEVELS.INFO].length > 5}
                <div class="rl-more">+{previewSummary.byRiskLevel[RISK_LEVELS.INFO].length - 5} 项更多</div>
              {/if}
            </div>
          </div>
        </div>
      </div>

      <div class="preview-section">
        <div class="section-title">
          <Package size={16} />
          <span>按<strong>影响引用数量</strong>分组（服装记录）</span>
        </div>
        <div class="impact-grid">
          {#each ['high', 'medium', 'low', 'none'] as range}
            {@const items = previewSummary.byImpactRange[range]}
            {#if items.length > 0 || range === 'high' || range === 'medium'}
              <div class="impact-card {getImpactBadgeClass(range)}">
                <div class="imp-title">{getImpactRangeLabel(range)}</div>
                <div class="imp-count">{items.length}</div>
                <div class="imp-list">
                  {#each items.slice(0, 5) as row}
                    <button
                      type="button"
                      class="imp-item"
                      on:click={() => jumpToReview(row.table, row.id, row.diffType)}
                    >
                      <span class="imp-name">{row.recordName}</span>
                      {#if row.impactTotal > 0}
                        <span class="imp-num">{row.impactTotal}</span>
                      {/if}
                    </button>
                  {/each}
                  {#if items.length > 5}
                    <div class="rl-more">+{items.length - 5} 项更多</div>
                  {/if}
                </div>
              </div>
            {/if}
          {/each}
        </div>
      </div>

      <div class="preview-section batch-section">
        <div class="section-title">
          <Zap size={16} />
          <span><strong>批量策略</strong> · 一键应用规则到待决项</span>
        </div>
        <div class="strategy-panel">
          <div class="strategy-header">
            <Settings2 size={16} />
            <span>选择合并策略</span>
          </div>
          <div class="strategy-options">
            {#each Object.values(BATCH_STRATEGIES) as strat}
              <button
                type="button"
                class="strategy-option {selectedBatchStrategy === strat ? 'active' : ''}"
                on:click={() => selectedBatchStrategy = strat}
              >
                <div class="so-title">
                  {#if strat === BATCH_STRATEGIES.KEEP_CURRENT_ALL}
                    <Shield size={14} />
                  {:else if strat === BATCH_STRATEGIES.USE_IMPORT_ALL}
                    <Download size={14} />
                  {:else if strat === BATCH_STRATEGIES.LATEST_EVENT}
                    <GitBranch size={14} />
                  {:else}
                    <Clock size={14} />
                  {/if}
                  {BATCH_STRATEGY_LABELS[strat]}
                </div>
                <div class="so-desc">
                  {#if strat === BATCH_STRATEGIES.KEEP_CURRENT_ALL}
                    所有待决项保留当前设备版本
                  {:else if strat === BATCH_STRATEGIES.USE_IMPORT_ALL}
                    所有待决项使用导入设备版本
                  {:else if strat === BATCH_STRATEGIES.LATEST_EVENT}
                    基于同步事件时间线自动判断
                  {:else}
                    基于记录 updatedAt 选较新的版本
                  {/if}
                </div>
              </button>
            {/each}
          </div>

          <div class="scope-controls">
            <div class="scope-group">
              <div class="scope-group-label">作用范围：按表（不选 = 全部表）</div>
              <div class="scope-chips">
                <button
                  type="button"
                  class="scope-chip {batchScope.tables === null ? 'active' : ''}"
                  on:click={() => batchScope.tables = null}
                >
                  全部
                </button>
                {#each Object.keys(diffResult.tables) as tbl}
                  <button
                    type="button"
                    class="scope-chip {batchScope.tables?.includes(tbl) ? 'active' : ''}"
                    on:click={() => {
                      const cur = batchScope.tables || [];
                      batchScope.tables = cur.includes(tbl)
                        ? cur.filter(t => t !== tbl).length === 0 ? null : cur.filter(t => t !== tbl)
                        : [...cur, tbl];
                    }}
                  >
                    {TABLE_LABELS[tbl] || tbl}
                  </button>
                {/each}
              </div>
            </div>
            <div class="scope-group">
              <div class="scope-group-label">作用范围：按风险级别</div>
              <div class="scope-chips">
                <button
                  type="button"
                  class="scope-chip {batchScope.riskLevels === null ? 'active' : ''}"
                  on:click={() => batchScope.riskLevels = null}
                >
                  全部级别
                </button>
                {#each Object.keys(RISK_LEVELS) as rl}
                  <button
                    type="button"
                    class="scope-chip {batchScope.riskLevels?.includes(rl) ? 'active' : ''}"
                    on:click={() => {
                      const cur = batchScope.riskLevels || [];
                      batchScope.riskLevels = cur.includes(rl)
                        ? cur.filter(r => r !== rl).length === 0 ? null : cur.filter(r => r !== rl)
                        : [...cur, rl];
                    }}
                  >
                    {RISK_LEVEL_LABELS[rl]}
                  </button>
                {/each}
              </div>
            </div>
          </div>

          <div class="batch-actions-row">
            <button
              type="button"
              class="secondary"
              on:click={() => batchResolveAll(DECISION_CHOICES.KEEP_CURRENT)}
            >
              <SkipForward size={14} /> 全部保留当前
            </button>
            <button
              type="button"
              on:click={handleApplyBatchStrategy}
              class="primary-btn"
            >
              <Zap size={14} /> 应用选中的批量策略
            </button>
            <button
              type="button"
              class="secondary"
              on:click={() => batchResolveAll(DECISION_CHOICES.USE_IMPORT)}
            >
              <SkipForward size={14} /> 全部使用导入
            </button>
          </div>
        </div>
      </div>

      <div class="preview-footer">
        <button
          type="button"
          class="secondary"
          on:click={() => goToPhase('review')}
        >
          <Eye size={16} /> 进入逐条审核
        </button>
        <button
          type="button"
          class={canProceed ? 'primary-btn' : 'disabled-btn'}
          disabled={!canProceed}
          on:click={() => goToPhase('confirm')}
        >
          <Shield size={16} />
          {#if canProceed}
            前往执行确认
          {:else}
            需先解决 {pendingCount} 项待决
          {/if}
        </button>
      </div>
    </div>
  {/if}

  {#if phase === 'review'}
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
          {@const impact = impactAnalysis?.[activeTable]?.[item.id]}
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
              {#if impact?.totalImpacts > 0}
                <span class="diff-impact {getImpactBadgeClass(impact.totalImpacts >= 10 ? 'high' : (impact.totalImpacts >= 3 ? 'medium' : 'low'))}">
                  <Users size={10} /> {impact.totalImpacts}
                </span>
              {/if}
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

                {#if impact?.totalImpacts > 0}
                  <div class="impact-banner">
                    <Users size={14} />
                    <span>
                      <strong>引用影响：</strong>
                      共影响 <strong>{impact.totalImpacts}</strong> 处关联
                      {#each Object.keys(impact.byType) as t}
                        {#if impact.byType[t] > 0}
                          <span class="impact-chip">{IMPACT_TYPE_LABELS[t]} ×{impact.byType[t]}</span>
                        {/if}
                      {/each}
                    </span>
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
                      <div class="side-label">
                        当前侧有此记录
                        {#if item.current?.updatedAt}
                          <span class="time-hint"><Clock size={10}/> {formatShortTime(item.current.updatedAt)}</span>
                        {/if}
                      </div>
                      <pre class="record-preview">{JSON.stringify(item.current, null, 2)}</pre>
                    </div>
                    <div class="side side-empty">
                      <div class="side-label"><Minus size={14} />导入侧无此记录（疑似删除）</div>
                      <p class="empty-hint">保留当前可防止误删。如确认是删除操作请选择"使用导入版本"。</p>
                      {#if impact?.totalImpacts > 0}
                        <div class="deletion-impacts">
                          <div class="de-title"><AlertTriangle size={12}/> <strong>选择删除将影响以下内容：</strong></div>
                          <div class="de-impact-row">
                            {#each Object.keys(impact.byType) as t}
                              {#if impact.byType[t] > 0}
                                <span class="impact-chip danger">{IMPACT_TYPE_LABELS[t]} ×{impact.byType[t]}</span>
                              {/if}
                            {/each}
                          </div>
                          {#if impact.details?.length > 0}
                            <details class="ci-details">
                              <summary>展开关联详情（{impact.details.length}）</summary>
                              <ul class="de-list">
                                {#each impact.details.slice(0, 20) as det}
                                  <li>[{IMPACT_TYPE_LABELS[det.type]}] {det.label}</li>
                                {/each}
                                {#if impact.details.length > 20}
                                  <li>…以及其他 {impact.details.length - 20} 项</li>
                                {/if}
                              </ul>
                            </details>
                          {/if}
                        </div>
                      {/if}
                    </div>
                  </div>
                {:else}
                  <div class="conflict-fields">
                    <table class="conflict-table">
                      <thead>
                        <tr>
                          <th>字段</th>
                          <th>
                            当前版本
                            {#if item.current?.updatedAt}
                              <span class="time-hint"><Clock size={10}/> {formatShortTime(item.current.updatedAt)}</span>
                            {/if}
                          </th>
                          <th>
                            导入版本
                            {#if item.imported?.updatedAt}
                              <span class="time-hint"><Clock size={10}/> {formatShortTime(item.imported.updatedAt)}</span>
                            {/if}
                          </th>
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
  {/if}

  {#if phase === 'confirm'}
    <div class="confirm-phase">
      <div class="confirm-section">
        <div class="section-title">
          <Trash2 size={16} />
          <span>将被<strong>删除</strong>的服装（{riskList.toDelete.length} 条）</span>
        </div>
        {#if riskList.toDelete.length === 0}
          <div class="empty-note"><CheckCircle2 size={18} /> 没有删除操作</div>
        {:else}
          <div class="confirm-list">
            {#each riskList.toDelete as d}
              <div class="confirm-item danger">
                <div class="ci-main">
                  <AlertOctagon size={16} />
                  <strong>{d.name}</strong>
                  <span class="ci-id">{d.id.slice(0, 8)}</span>
                  {#if d.isTrueDelete}<span class="ci-tag">真实删除(有墓碑)</span>{/if}
                </div>
                <div class="ci-impact">
                  影响：
                  {#each Object.keys(d.impactByType) as t}
                    {#if d.impactByType[t] > 0}
                      <span class="impact-chip">{IMPACT_TYPE_LABELS[t]} ×{d.impactByType[t]}</span>
                    {/if}
                  {/each}
                  {#if d.impactTotal === 0}
                    <span class="impact-chip none">无关联引用</span>
                  {/if}
                </div>
                {#if d.impactDetails?.length > 0}
                  <details class="ci-details">
                    <summary>展开详情 ({d.impactDetails.length})</summary>
                    <ul>
                      {#each d.impactDetails as det}
                        <li>[{IMPACT_TYPE_LABELS[det.type]}] {det.label}</li>
                      {/each}
                    </ul>
                  </details>
                {/if}
              </div>
            {/each}
          </div>
        {/if}
      </div>

      <div class="confirm-section">
        <div class="section-title">
          <Link size={16} />
          <span>ID<strong>重映射</strong>（{riskList.toRemap.length} 组）</span>
        </div>
        {#if riskList.toRemap.length === 0}
          <div class="empty-note"><CheckCircle2 size={18} /> 无需 ID 重映射</div>
        {:else}
          <div class="confirm-list">
            {#each riskList.toRemap as r}
              <div class="confirm-item remap">
                <div class="ci-main">
                  <Unlink size={16} />
                  <div class="remap-pair">
                    <span class="remap-from"><strong>{r.fromName}</strong> <code>{r.fromId.slice(0, 8)}</code></span>
                    <ArrowRight size={14} />
                    <span class="remap-to"><strong>{r.toName}</strong> <code>{r.toId.slice(0, 8)}</code></span>
                  </div>
                </div>
                <div class="ci-note">{r.reason}</div>
              </div>
            {/each}
          </div>
        {/if}
      </div>

      <div class="confirm-section">
        <div class="section-title">
          <AlertTriangle size={16} />
          <span>悬空引用<strong>清理</strong>（{riskList.danglingRisk.length} 处）</span>
        </div>
        {#if riskList.danglingRisk.length === 0}
          <div class="empty-note"><CheckCircle2 size={18} /> 无悬空引用</div>
        {:else}
          <div class="confirm-list">
            {#each riskList.danglingRisk.slice(0, 50) as dr}
              <div class="confirm-item dangling">
                <div class="ci-main">
                  <AlertTriangle size={14} />
                  <span class="ci-table">[{TABLE_LABELS[dr.table] || dr.table}]</span>
                  <strong>{dr.recordName}</strong>
                  <code class="ci-field">{dr.field}</code>
                </div>
                <div class="ci-note">{dr.message}</div>
              </div>
            {/each}
            {#if riskList.danglingRisk.length > 50}
              <div class="more-hint">…还有 {riskList.danglingRisk.length - 50} 处引用将被清理</div>
            {/if}
          </div>
        {/if}
      </div>

      <div class="confirm-totals">
        <div class="total-box">
          <div class="total-label">待删除服装</div>
          <div class="total-val danger">{riskList.toDelete.length}</div>
        </div>
        <div class="total-box">
          <div class="total-label">ID 重映射</div>
          <div class="total-val remap">{riskList.toRemap.length}</div>
        </div>
        <div class="total-box">
          <div class="total-label">引用清理</div>
          <div class="total-val dangling">{riskList.danglingRisk.length}</div>
        </div>
        <div class="total-box">
          <div class="total-label">决策完成度</div>
          <div class="total-val ok">{previewSummary?.totals.needsDecision - pendingCount}/{previewSummary?.totals.needsDecision || 0}</div>
        </div>
      </div>
    </div>
  {/if}

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
      {#if phase !== 'preview'}
        <button type="button" class="secondary" on:click={() => goToPhase(phase === 'confirm' ? 'review' : 'preview')}>
          {phase === 'confirm' ? '返回审核' : '返回预演'}
        </button>
      {/if}
      <button
        type="button"
        on:click={phase === 'confirm' ? handleConfirm : () => goToPhase(phase === 'preview' ? 'review' : 'confirm')}
        disabled={phase === 'confirm' ? !canProceed : false}
      >
        {#if phase === 'confirm'}
          <RefreshCw size={16} />确认合并执行
        {:else if phase === 'preview'}
          <Eye size={16} />下一步：逐条审核
        {:else}
          {#if canProceed}
            <Shield size={16} />下一步：执行确认
          {:else}
            <AlertTriangle size={16} />解决 {pendingCount} 项后可继续
          {/if}
        {/if}
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

  /* ========== Phase Tabs ========== */
  .phase-tabs {
    display: flex;
    gap: 0;
    padding: 12px 20px 0;
    background: #faf6f0;
    border-bottom: 1px solid #e8dfd2;
  }
  .phase-tab {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 18px;
    border: none;
    background: transparent;
    cursor: pointer;
    font-family: inherit;
    font-size: 14px;
    color: #8a7665;
    border-bottom: 2px solid transparent;
    margin-bottom: -1px;
    transition: all .15s ease;
  }
  .phase-tab:hover { color: #5a4a3a; background: rgba(138,91,65,.06); }
  .phase-tab.active {
    color: #5a3a22;
    border-bottom-color: #8a5b41;
    background: #fff;
    font-weight: 600;
  }
  .phase-num {
    width: 22px; height: 22px;
    border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    font-size: 12px; font-weight: 700;
    background: #e8dfd2;
    color: #5a4a3a;
  }
  .phase-tab.active .phase-num { background: #8a5b41; color: #fff; }
  .phase-tab.done .phase-num { background: #2d5a2d; color: #fff; }

  /* ========== Preview Phase ========== */
  .preview-phase {
    padding: 18px 20px;
    overflow-y: auto;
    flex: 1;
  }
  .preview-section {
    margin-bottom: 22px;
  }
  .section-title {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 15px;
    font-weight: 600;
    color: #4a3a2a;
    margin-bottom: 12px;
    padding-bottom: 8px;
    border-bottom: 1px dashed #e0d4c2;
  }

  /* Table cards grid */
  .table-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
    gap: 12px;
  }
  .table-card {
    background: #fff;
    border: 1px solid #e8dfd2;
    border-radius: 8px;
    padding: 14px;
    cursor: pointer;
    transition: all .15s ease;
  }
  .table-card:hover { border-color: #d4a878; box-shadow: 0 2px 8px rgba(138,91,65,.08); }
  .tc-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 10px;
  }
  .tc-name {
    display: flex; align-items: center; gap: 8px;
    font-weight: 600; color: #4a3a2a; font-size: 15px;
  }
  .tc-total { color: #8a7665; font-size: 13px; }
  .tc-chips { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 10px; }
  .tc-footer {
    display: flex; justify-content: space-between; align-items: center;
    padding-top: 10px; border-top: 1px solid #f0e6d6;
    font-size: 12px; color: #8a7665;
  }
  .expand-hint { display: flex; align-items: center; gap: 4px; }

  .tc-details {
    margin-top: 12px;
    padding-top: 10px;
    border-top: 1px dashed #f0e6d6;
  }
  .detail-row {
    display: flex; justify-content: space-between; align-items: center;
    padding: 4px 0;
    font-size: 12px;
  }
  .dr-label { display: flex; align-items: center; gap: 6px; color: #6b5a4a; }
  .dr-val { font-weight: 600; color: #4a3a2a; }

  /* Risk list */
  .risk-list, .impact-list {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 12px;
  }
  .rl-card {
    border-radius: 8px;
    padding: 14px;
    border: 1px solid;
    background: #fff;
    cursor: pointer;
    transition: all .15s ease;
  }
  .rl-card:hover { transform: translateY(-1px); box-shadow: 0 3px 12px rgba(0,0,0,.06); }
  .rl-card.danger { border-color: #e8a89c; background: linear-gradient(135deg,#fff,#fff5f2); }
  .rl-card.warning { border-color: #e8c98a; background: linear-gradient(135deg,#fff,#fff8ea); }
  .rl-card.info { border-color: #8ab4e8; background: linear-gradient(135deg,#fff,#f0f6ff); }
  .rl-header {
    display: flex; justify-content: space-between; align-items: center;
    margin-bottom: 8px;
  }
  .rl-title {
    display: flex; align-items: center; gap: 8px;
    font-weight: 600; font-size: 14px;
  }
  .rl-card.danger .rl-title { color: #8a3a2a; }
  .rl-card.warning .rl-title { color: #8a6a1a; }
  .rl-card.info .rl-title { color: #2a4a7a; }
  .rl-count { font-size: 24px; font-weight: 700; }
  .rl-card.danger .rl-count { color: #c2482a; }
  .rl-card.warning .rl-count { color: #c2901a; }
  .rl-card.info .rl-count { color: #2a5a8a; }
  .rl-sub { font-size: 12px; color: #8a7665; margin-top: 4px; }

  /* Impact cards */
  .impact-card {
    background: #fff;
    border: 1px solid #e8dfd2;
    border-radius: 8px;
    padding: 14px;
    cursor: pointer;
    transition: all .15s ease;
  }
  .impact-card:hover { border-color: #c49868; }
  .impact-card.high .impact-range { color: #c2482a; }
  .impact-card.medium .impact-range { color: #c2901a; }
  .impact-card.low .impact-range { color: #2a6a4a; }
  .impact-range {
    font-size: 20px; font-weight: 700; margin-bottom: 4px;
  }
  .impact-count { font-size: 12px; color: #8a7665; margin-bottom: 8px; }
  .impact-badges { display: flex; flex-wrap: wrap; gap: 5px; }

  /* Impact chip */
  .impact-chip {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    padding: 2px 8px;
    border-radius: 10px;
    background: #f0e6d6;
    color: #5a4a3a;
    font-size: 11px;
    font-weight: 500;
    margin-left: 4px;
  }
  .impact-chip.none { background: #e8e8e8; color: #8a7665; }
  .impact-chip.danger { background: #f5d8cc; color: #8a3a2a; }

  /* Strategy panel */
  .strategy-panel {
    background: linear-gradient(135deg,#fff8ea,#fff);
    border: 1px solid #e8c98a;
    border-radius: 10px;
    padding: 16px;
  }
  .strategy-header {
    display: flex; align-items: center; gap: 8px;
    font-weight: 600; color: #6a4a1a;
    margin-bottom: 14px;
  }
  .strategy-options {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
    gap: 8px;
    margin-bottom: 14px;
  }
  .strategy-option {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 10px 12px;
    border: 1px solid #e0d4c2;
    border-radius: 6px;
    background: #fff;
    cursor: pointer;
    transition: all .15s ease;
    font-family: inherit;
    text-align: left;
  }
  .strategy-option:hover { border-color: #8a5b41; }
  .strategy-option.active {
    border-color: #8a5b41;
    background: #fff5ec;
    box-shadow: inset 0 0 0 2px rgba(138,91,65,.15);
  }
  .so-title {
    display: flex; align-items: center; gap: 6px;
    font-weight: 600; font-size: 13px; color: #4a3a2a;
  }
  .so-desc { font-size: 11px; color: #8a7665; }

  .scope-controls {
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin-bottom: 14px;
  }
  .scope-group {
    display: flex; flex-direction: column; gap: 6px;
  }
  .scope-group-label {
    font-size: 12px; color: #6a5a4a; font-weight: 600;
  }
  .scope-chips { display: flex; flex-wrap: wrap; gap: 6px; }
  .scope-chip {
    display: flex; align-items: center; gap: 4px;
    padding: 4px 10px;
    border-radius: 14px;
    border: 1px solid #e0d4c2;
    background: #fff;
    cursor: pointer;
    font-size: 12px;
    font-family: inherit;
    color: #5a4a3a;
    transition: all .15s ease;
  }
  .scope-chip:hover { border-color: #8a5b41; }
  .scope-chip.active {
    background: #8a5b41;
    border-color: #8a5b41;
    color: #fff;
  }
  .scope-chip input { display: none; }

  .preview-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: 16px;
    padding-top: 16px;
    border-top: 1px solid #e8dfd2;
    flex-wrap: wrap;
    gap: 10px;
  }
  .pf-stats {
    display: flex; align-items: center; gap: 14px;
    font-size: 13px; color: #6a5a4a;
  }
  .pf-stat strong { color: #4a3a2a; font-size: 15px; }
  .pf-actions { display: flex; gap: 8px; }

  /* ========== Review: diff impact badge ========== */
  .diff-impact {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    padding: 2px 7px;
    border-radius: 10px;
    font-size: 11px;
    font-weight: 600;
    margin-left: auto;
  }
  .diff-impact.impact-high { background: #f5d8cc; color: #8a3a2a; }
  .diff-impact.impact-medium { background: #f5e8c8; color: #7a5a1a; }
  .diff-impact.impact-low { background: #d8e8d8; color: #2a5a3a; }

  .impact-banner {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    padding: 10px 14px;
    background: #eef3ff;
    border-left: 3px solid #4a7ac2;
    border-radius: 4px;
    margin-bottom: 14px;
    font-size: 13px;
    color: #2a4a6a;
  }
  .time-hint {
    margin-left: 6px;
    font-size: 11px;
    font-weight: 400;
    color: #8a7665;
    display: inline-flex;
    align-items: center;
    gap: 3px;
  }

  .deletion-impacts {
    margin-top: 12px;
    padding: 10px 12px;
    background: #fff5f2;
    border: 1px solid #e8c4b8;
    border-radius: 6px;
  }
  .de-title {
    font-size: 12px; color: #7a3a2a;
    margin-bottom: 8px;
    display: flex; align-items: center; gap: 6px;
  }
  .de-impact-row { margin-bottom: 8px; }
  .de-list {
    margin: 0;
    padding-left: 20px;
    font-size: 12px;
    color: #6a4a3a;
  }
  .de-list li { margin: 2px 0; }

  /* ========== Confirm Phase ========== */
  .confirm-phase {
    padding: 18px 20px;
    overflow-y: auto;
    flex: 1;
  }
  .confirm-section {
    margin-bottom: 22px;
  }
  .empty-note {
    padding: 20px;
    background: #f5fff5;
    border: 1px dashed #b8dcb8;
    border-radius: 8px;
    color: #2a5a3a;
    text-align: center;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    font-size: 14px;
  }
  .confirm-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .confirm-item {
    border-radius: 8px;
    padding: 12px 14px;
    border: 1px solid;
    background: #fff;
  }
  .confirm-item.danger { border-color: #e8a89c; background: #fff8f5; }
  .confirm-item.remap { border-color: #c8a8e8; background: #faf5ff; }
  .confirm-item.dangling { border-color: #e8d88a; background: #fffdf5; }
  .ci-main {
    display: flex; align-items: center; gap: 8px;
    font-size: 13px; color: #4a3a2a;
    margin-bottom: 6px;
    flex-wrap: wrap;
  }
  .ci-id {
    font-family: monospace;
    font-size: 11px;
    color: #8a7665;
    background: #f0e6d6;
    padding: 1px 6px;
    border-radius: 3px;
  }
  .ci-tag {
    font-size: 10px;
    padding: 2px 6px;
    background: #c2482a;
    color: #fff;
    border-radius: 8px;
    font-weight: 600;
  }
  .ci-table { font-size: 11px; color: #8a7665; font-weight: 600; }
  .ci-field {
    font-family: monospace;
    font-size: 11px;
    background: #f5e8c8;
    padding: 1px 5px;
    border-radius: 3px;
    color: #6a5a1a;
  }
  .ci-impact { font-size: 12px; color: #6a5a4a; }
  .ci-note { font-size: 12px; color: #6a5a4a; }
  .ci-details {
    margin-top: 8px;
    padding: 8px 0 0;
    border-top: 1px dashed #f0e6d6;
  }
  .ci-details summary {
    cursor: pointer;
    font-size: 11px;
    color: #8a7665;
    padding: 2px 0;
  }
  .ci-details summary:hover { color: #5a4a3a; }
  .ci-details ul {
    margin: 8px 0 0;
    padding-left: 20px;
    font-size: 11px;
    color: #6a5a4a;
    max-height: 160px;
    overflow-y: auto;
  }
  .ci-details li { margin: 2px 0; }

  .remap-pair {
    display: flex; align-items: center; gap: 8px;
    flex-wrap: wrap;
  }
  .remap-from, .remap-to {
    display: flex; align-items: center; gap: 6px;
    font-size: 13px;
  }
  .remap-pair code {
    font-size: 11px;
    background: #f0e6d6;
    padding: 1px 5px;
    border-radius: 3px;
    color: #5a4a3a;
  }

  .more-hint {
    text-align: center;
    padding: 8px;
    color: #8a7665;
    font-size: 12px;
  }

  .confirm-totals {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
    gap: 12px;
    padding: 18px;
    background: linear-gradient(135deg,#fff8ea,#fff);
    border: 1px solid #e0d4c2;
    border-radius: 10px;
  }
  .total-box { text-align: center; }
  .total-label {
    font-size: 12px;
    color: #8a7665;
    margin-bottom: 4px;
  }
  .total-val {
    font-size: 24px;
    font-weight: 700;
  }
  .total-val.danger { color: #c2482a; }
  .total-val.remap { color: #7a4ac2; }
  .total-val.dangling { color: #c2901a; }
  .total-val.ok { color: #2a6a4a; font-size: 18px; }
</style>
