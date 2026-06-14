<script>
  import { createEventDispatcher } from 'svelte';
  import {
    AlertTriangle, AlertOctagon, Clock, Search, X, Save, CheckCircle,
    CalendarDays, Filter, ChevronDown, ChevronUp, Eye, User, MessageSquare,
    CheckCircle2, PauseCircle, XCircle, ArrowRight, ArrowRightLeft,
    Shirt, Zap, Wrench, Droplets, Package, MoreHorizontal, Edit3,
    ThumbsUp, SkipForward, RotateCcw, ClipboardList, AlertCircle
  } from 'lucide-svelte';
  import {
    updateRiskProcessingStatus,
    RISK_STATUS,
    RISK_TYPE_LABELS,
    getAllSuggestions,
    getSuggestionsByScheduleId,
    getSuggestionStats,
    computeAllSuggestions,
    filterSuggestions,
    applyScheduleSuggestion,
    previewScheduleSuggestion,
    confirmSuggestionOnly,
    deferSuggestion,
    SUGGESTION_STATUS,
    SUGGESTION_STATUS_LABELS,
    ACTION_PRIORITY_LABELS
  } from '$lib/scheduleStore.js';
  import { globalIndex } from '$lib/dataIndex.js';

  const dispatch = createEventDispatcher();

  const now = new Date();
  const iso = (offset = 0) => {
    const d = new Date(now);
    d.setDate(d.getDate() + offset);
    return d.toISOString().slice(0, 10);
  };

  let playFilter = '全部剧目';
  let levelFilter = '全部级别';
  let statusFilter = '全部状态';
  let typeFilter = '全部类型';
  let riskQuery = '';
  let showDetailModal = false;
  let selectedRisk = null;
  let showStatusMenu = null;
  let editingNote = false;
  let noteForm = { handler: '', note: '' };

  let showSuggestionTab = false;
  let suggestionStatusFilter = '全部状态';
  let suggestionPlayFilter = '全部剧目';
  let suggestionOnlyWithAlt = false;
  let showSuggestionDetail = false;
  let selectedSuggestion = null;
  let editingSuggestionNote = false;
  let suggestionNoteForm = { handler: '', note: '' };
  let selectedAltCostumeId = null;

  let showPreviewModal = false;
  let currentPreview = null;
  let previewUpdatePackingList = true;
  let previewLoading = false;

  $: allRisks = $globalIndex.computeAllRisks();
  $: riskStats = $globalIndex.getRiskStats(allRisks);
  $: allSuggestions = computeAllSuggestions();
  $: suggestionStats = getSuggestionStats();

  $: plays = ['全部剧目', ...(riskStats.byPlay ? Object.keys(riskStats.byPlay).filter(Boolean) : [])];
  $: riskTypes = ['全部类型', ...(riskStats.byType ? Object.keys(riskStats.byType).filter(Boolean) : [])];
  $: suggestionPlays = ['全部剧目', ...(suggestionStats.byPlay ? Object.keys(suggestionStats.byPlay).filter(Boolean) : [])];

  $: filteredRisks = $globalIndex.filterRisks({
    play: playFilter,
    level: levelFilter,
    status: statusFilter,
    type: typeFilter,
    query: riskQuery.trim()
  });

  $: filteredSuggestions = filterSuggestions({
    play: suggestionPlayFilter,
    status: suggestionStatusFilter === '全部状态' ? null : suggestionStatusFilter,
    hasAlternatives: suggestionOnlyWithAlt ? true : null
  });

  $: selectedRiskSuggestions = selectedRisk?.scheduleId
    ? (getSuggestionsByScheduleId(selectedRisk.scheduleId)?.suggestions || [])
    : [];

  $: groupedByStatus = (() => {
    const groups = {
      [RISK_STATUS.PENDING]: [],
      [RISK_STATUS.CONFIRMED]: [],
      [RISK_STATUS.DEFERRED]: [],
      [RISK_STATUS.RESOLVED]: []
    };
    for (const r of filteredRisks) {
      if (groups[r.processingStatus]) {
        groups[r.processingStatus].push(r);
      }
    }
    return groups;
  })();

  function openRiskDetail(risk) {
    selectedRisk = risk;
    noteForm = {
      handler: risk.handler || '',
      note: risk.note || ''
    };
    editingNote = false;
    showDetailModal = true;
  }

  function handleStatusChange(risk, newStatus) {
    updateRiskProcessingStatus(risk.riskKey, newStatus, noteForm.handler, noteForm.note);
    dispatch('change');
    showStatusMenu = null;
    if (selectedRisk && selectedRisk.riskKey === risk.riskKey) {
      selectedRisk.processingStatus = newStatus;
    }
  }

  function saveNote() {
    if (!selectedRisk) return;
    updateRiskProcessingStatus(selectedRisk.riskKey, selectedRisk.processingStatus, noteForm.handler, noteForm.note);
    dispatch('change');
    editingNote = false;
    if (selectedRisk) {
      selectedRisk.handler = noteForm.handler;
      selectedRisk.note = noteForm.note;
    }
  }

  function closeDetail() {
    showDetailModal = false;
    selectedRisk = null;
    showStatusMenu = null;
    editingNote = false;
    noteForm = { handler: '', note: '' };
    showSuggestionTab = false;
  }

  function openSuggestionDetail(suggestion) {
    selectedSuggestion = suggestion;
    showSuggestionDetail = true;
    editingSuggestionNote = false;
    suggestionNoteForm = { handler: suggestion.handler || '', note: suggestion.note || '' };
    selectedAltCostumeId = suggestion.alternatives && suggestion.alternatives.length > 0
      ? suggestion.alternatives[0].costumeId
      : null;
  }

  function closeSuggestionDetail() {
    showSuggestionDetail = false;
    selectedSuggestion = null;
    editingSuggestionNote = false;
    suggestionNoteForm = { handler: '', note: '' };
    selectedAltCostumeId = null;
  }

  function handleApplySuggestion() {
    if (!selectedSuggestion) return;
    previewLoading = true;
    previewUpdatePackingList = true;
    currentPreview = previewScheduleSuggestion(selectedSuggestion.suggestionId, {
      applyAlternative: selectedAltCostumeId,
      updatePackingList: true
    });
    previewLoading = false;
    showPreviewModal = true;
  }

  function handlePreviewTogglePacking(ev) {
    if (!selectedSuggestion) return;
    previewUpdatePackingList = ev.target.checked;
    currentPreview = previewScheduleSuggestion(selectedSuggestion.suggestionId, {
      applyAlternative: selectedAltCostumeId,
      updatePackingList: previewUpdatePackingList
    });
  }

  function handlePreviewConfirm() {
    if (!selectedSuggestion) return;
    const result = applyScheduleSuggestion(selectedSuggestion.suggestionId, {
      applyAlternative: selectedAltCostumeId,
      handler: suggestionNoteForm.handler,
      note: suggestionNoteForm.note,
      updatePackingList: previewUpdatePackingList
    });
    dispatch('suggestion-applied', { suggestionId: selectedSuggestion.suggestionId, result });
    closePreviewModal();
    closeSuggestionDetail();
  }

  function closePreviewModal() {
    showPreviewModal = false;
    currentPreview = null;
    previewLoading = false;
  }

  function handleConfirmSuggestion() {
    if (!selectedSuggestion) return;
    confirmSuggestionOnly(selectedSuggestion.suggestionId, {
      handler: suggestionNoteForm.handler,
      note: suggestionNoteForm.note
    });
    dispatch('suggestion-confirmed', { suggestionId: selectedSuggestion.suggestionId });
    closeSuggestionDetail();
  }

  function handleDeferSuggestion() {
    if (!selectedSuggestion) return;
    deferSuggestion(selectedSuggestion.suggestionId, {
      handler: suggestionNoteForm.handler,
      note: suggestionNoteForm.note
    });
    dispatch('suggestion-deferred', { suggestionId: selectedSuggestion.suggestionId });
    closeSuggestionDetail();
  }

  function getActionIcon(type) {
    if (!type) return Zap;
    if (type.includes('repair') || type.includes('维修')) return Wrench;
    if (type.includes('clean') || type.includes('清洗')) return Droplets;
    if (type.includes('pack') || type.includes('装箱')) return Package;
    if (type.includes('swap') || type.includes('替代') || type.includes('replace')) return ArrowRightLeft;
    return Zap;
  }

  function formatDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr + 'T00:00:00');
    const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    return `${dateStr} ${weekdays[d.getDay()]}`;
  }

  function getStatusBadgeClass(status) {
    if (status === RISK_STATUS.PENDING) return 'rc-status-pending';
    if (status === RISK_STATUS.CONFIRMED) return 'rc-status-confirmed';
    if (status === RISK_STATUS.DEFERRED) return 'rc-status-deferred';
    if (status === RISK_STATUS.RESOLVED) return 'rc-status-resolved';
    return '';
  }

  function getRiskLevelClass(level) {
    if (level === 'high') return 'rc-risk-high';
    if (level === 'medium') return 'rc-risk-medium';
    return 'rc-risk-low';
  }

  function getRiskLevelLabel(level) {
    if (level === 'high') return '高风险';
    if (level === 'medium') return '中风险';
    return '低风险';
  }

  function getDaysUntil(dateStr) {
    const today = new Date(iso(0));
    const target = new Date(dateStr);
    const diff = Math.ceil((target - today) / (1000 * 60 * 60 * 24));
    if (diff < 0) return `已过${Math.abs(diff)}天`;
    if (diff === 0) return '今天';
    return `${diff}天后`;
  }

  function handleKeydown(e) {
    if (e.key === 'Escape') {
      if (showPreviewModal) closePreviewModal();
      else if (showDetailModal) closeDetail();
    }
  }
</script>

<svelte:window on:keydown={handleKeydown} />

<div class="rc-container">
  <div class="rc-header">
    <div class="rc-header-left">
      <h2><AlertTriangle size={20} />风险处理中心</h2>
      <span class="rc-subtitle">未来 30 天排期风险汇总与追踪</span>
    </div>
    <div class="rc-header-right">
      <span class="rc-count">共 {filteredRisks.length} 项风险</span>
    </div>
  </div>

  <div class="rc-stats">
    <div class="rc-stat-card rc-stat-pending">
      <div class="rc-stat-icon"><Clock size={20} /></div>
      <div class="rc-stat-content">
        <div class="rc-stat-number">{riskStats.pending}</div>
        <div class="rc-stat-label">待处理</div>
      </div>
    </div>
    <div class="rc-stat-card rc-stat-confirmed">
      <div class="rc-stat-icon"><CheckCircle2 size={20} /></div>
      <div class="rc-stat-content">
        <div class="rc-stat-number">{riskStats.confirmed}</div>
        <div class="rc-stat-label">已确认</div>
      </div>
    </div>
    <div class="rc-stat-card rc-stat-deferred">
      <div class="rc-stat-icon"><PauseCircle size={20} /></div>
      <div class="rc-stat-content">
        <div class="rc-stat-number">{riskStats.deferred}</div>
        <div class="rc-stat-label">暂缓</div>
      </div>
    </div>
    <div class="rc-stat-card rc-stat-resolved">
      <div class="rc-stat-icon"><CheckCircle size={20} /></div>
      <div class="rc-stat-content">
        <div class="rc-stat-number">{riskStats.resolved}</div>
        <div class="rc-stat-label">已解决</div>
      </div>
    </div>
    <div class="rc-stat-card rc-stat-high">
      <div class="rc-stat-icon"><AlertOctagon size={20} /></div>
      <div class="rc-stat-content">
        <div class="rc-stat-number">{riskStats.high}</div>
        <div class="rc-stat-label">高风险</div>
      </div>
    </div>
    <div class="rc-stat-card rc-stat-medium">
      <div class="rc-stat-icon"><AlertTriangle size={20} /></div>
      <div class="rc-stat-content">
        <div class="rc-stat-number">{riskStats.medium}</div>
        <div class="rc-stat-label">中风险</div>
      </div>
    </div>
    <div class="rc-stat-card" style="border-left:3px solid #4a6b8a;background:#f0f6fb;">
      <div class="rc-stat-icon" style="background:#e6eef6;color:#1a4a8a;"><ArrowRightLeft size={20} /></div>
      <div class="rc-stat-content">
        <div class="rc-stat-number">{suggestionStats.pending || 0}</div>
        <div class="rc-stat-label">调配待处理</div>
      </div>
    </div>
    <div class="rc-stat-card" style="border-left:3px solid #4a8a4a;background:#f0fbf0;">
      <div class="rc-stat-icon" style="background:#e6f0e6;color:#2d5a2d;"><ThumbsUp size={20} /></div>
      <div class="rc-stat-content">
        <div class="rc-stat-number">{suggestionStats.applied || 0}</div>
        <div class="rc-stat-label">已执行调配</div>
      </div>
    </div>
    <div class="rc-stat-card" style="border-left:3px solid #8a6b4a;background:#f5f0eb;">
      <div class="rc-stat-icon" style="background:#f0e6dc;color:#6b5a4d;"><Shirt size={20} /></div>
      <div class="rc-stat-content">
        <div class="rc-stat-number">{suggestionStats.withAlternatives || 0}</div>
        <div class="rc-stat-label">有替代服装</div>
      </div>
    </div>
  </div>

  <div class="rc-tabs">
    <button
      type="button"
      class="rc-tab-btn"
      class:rc-tab-active={!showSuggestionTab}
      on:click={() => { showSuggestionTab = false; }}
    >
      <AlertTriangle size={14} />风险清单
    </button>
    <button
      type="button"
      class="rc-tab-btn"
      class:rc-tab-active={showSuggestionTab}
      on:click={() => { showSuggestionTab = true; }}
    >
      <ArrowRightLeft size={14} />调配建议
      {#if suggestionStats.urgentCount > 0}
        <span class="rc-tab-badge">{suggestionStats.urgentCount}</span>
      {/if}
    </button>
  </div>

  <div class="rc-toolbar">
    <label class="rc-search-label">
      <Search size={16} />
      <input bind:value={riskQuery} placeholder="搜索剧目/服装/日期/负责人" />
    </label>
    <div class="rc-filters">
      <select bind:value={playFilter}>
        {#each plays as play}
          <option>{play}</option>
        {/each}
      </select>
      <select bind:value={levelFilter}>
        <option>全部级别</option>
        <option value="high">高风险</option>
        <option value="medium">中风险</option>
        <option value="low">低风险</option>
      </select>
      <select bind:value={statusFilter}>
        <option>全部状态</option>
        <option>{RISK_STATUS.PENDING}</option>
        <option>{RISK_STATUS.CONFIRMED}</option>
        <option>{RISK_STATUS.DEFERRED}</option>
        <option>{RISK_STATUS.RESOLVED}</option>
      </select>
      <select bind:value={typeFilter}>
        {#each riskTypes as type}
          <option value={type}>{type === '全部类型' ? type : (RISK_TYPE_LABELS[type] || type)}</option>
        {/each}
      </select>
    </div>
  </div>

  {#if filteredRisks.length === 0}
    <div class="rc-empty">
      <CheckCircle size={32} />
      <p>暂无符合条件的风险项</p>
      <span>调整筛选条件或添加排期后查看</span>
    </div>
  {:else}
    <div class="rc-risk-groups">
      {#each Object.entries(groupedByStatus) as [status, risks]}
        {#if risks.length > 0 || statusFilter === '全部状态'}
          <div class="rc-risk-group" class:rc-group-hidden={risks.length === 0}>
            <div class="rc-group-header">
              <span class="rc-status-badge {getStatusBadgeClass(status)}">
                {#if status === RISK_STATUS.PENDING}<Clock size={12} />
                {:else if status === RISK_STATUS.CONFIRMED}<CheckCircle2 size={12} />
                {:else if status === RISK_STATUS.DEFERRED}<PauseCircle size={12} />
                {:else}<CheckCircle size={12} />{/if}
                {status} ({risks.length})
              </span>
            </div>
            <div class="rc-risk-list">
              {#each risks as risk (risk.riskKey)}
                <div class="rc-risk-card {getRiskLevelClass(risk.level)}" class:rc-card-resolved={risk.processingStatus === RISK_STATUS.RESOLVED}>
                  <div class="rc-risk-main">
                    <div class="rc-risk-top">
                      <div class="rc-risk-level">
                        {#if risk.level === 'high'}<AlertOctagon size={14} />
                        {:else if risk.level === 'medium'}<AlertTriangle size={14} />
                        {:else}<Clock size={14} />{/if}
                        <span>{getRiskLevelLabel(risk.level)}</span>
                      </div>
                      <span class="rc-risk-type">{RISK_TYPE_LABELS[risk.type] || risk.type}</span>
                      <span class="rc-days-until">{getDaysUntil(risk.scheduleDate)}</span>
                    </div>
                    <div class="rc-risk-message">{risk.message}</div>
                    <div class="rc-risk-meta">
                      <span class="rc-meta-play"><CalendarDays size={12} />{risk.schedulePlay}</span>
                      <span class="rc-meta-date">{formatDate(risk.scheduleDate)}</span>
                      {#if risk.scheduleTime}
                        <span class="rc-meta-time">{risk.scheduleTime}</span>
                      {/if}
                      {#if risk.handler}
                        <span class="rc-meta-handler"><User size={12} />{risk.handler}</span>
                      {/if}
                    </div>
                    {#if risk.note}
                      <div class="rc-risk-note">
                        <MessageSquare size={12} />
                        <span>{risk.note}</span>
                      </div>
                    {/if}
                  </div>
                  <div class="rc-risk-actions">
                    <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
                    <div class="rc-status-menu" role="presentation" on:click|stopPropagation>
                      <button
                        type="button"
                        class="rc-status-btn {getStatusBadgeClass(risk.processingStatus)}"
                        on:click={() => showStatusMenu = showStatusMenu === risk.riskKey ? null : risk.riskKey}
                      >
                        {#if risk.processingStatus === RISK_STATUS.PENDING}<Clock size={12} />
                        {:else if risk.processingStatus === RISK_STATUS.CONFIRMED}<CheckCircle2 size={12} />
                        {:else if risk.processingStatus === RISK_STATUS.DEFERRED}<PauseCircle size={12} />
                        {:else}<CheckCircle size={12} />{/if}
                        {risk.processingStatus}
                        <ChevronDown size={12} />
                      </button>
                      {#if showStatusMenu === risk.riskKey}
                        <div class="rc-status-dropdown">
                          {#each [RISK_STATUS.PENDING, RISK_STATUS.CONFIRMED, RISK_STATUS.DEFERRED, RISK_STATUS.RESOLVED] as s}
                            <button
                              type="button"
                              class="rc-dropdown-item"
                              class:rc-dropdown-active={risk.processingStatus === s}
                              on:click={() => handleStatusChange(risk, s)}
                            >
                              {#if s === RISK_STATUS.PENDING}<Clock size={14} />
                              {:else if s === RISK_STATUS.CONFIRMED}<CheckCircle2 size={14} />
                              {:else if s === RISK_STATUS.DEFERRED}<PauseCircle size={14} />
                              {:else}<CheckCircle size={14} />{/if}
                              {s}
                            </button>
                          {/each}
                        </div>
                      {/if}
                    </div>
                    <button type="button" class="rc-detail-btn" on:click={() => openRiskDetail(risk)}>
                      <Eye size={14} />详情
                    </button>
                  </div>
                </div>
              {/each}
            </div>
          </div>
        {/if}
      {/each}
    </div>
  {/if}

  {#if showSuggestionTab}
    <div class="rc-toolbar">
      <div class="rc-filters">
        <select bind:value={suggestionPlayFilter}>
          {#each suggestionPlays as p}
            <option>{p}</option>
          {/each}
        </select>
        <select bind:value={suggestionStatusFilter}>
          <option>全部状态</option>
          <option value={SUGGESTION_STATUS.PENDING}>待处理</option>
          <option value={SUGGESTION_STATUS.CONFIRMED}>已确认</option>
          <option value={SUGGESTION_STATUS.DEFERRED}>暂缓</option>
          <option value={SUGGESTION_STATUS.APPLIED}>已执行</option>
        </select>
        <label class="rc-checkbox-label">
          <input type="checkbox" bind:checked={suggestionOnlyWithAlt} />
          <span>仅显示有替代服装</span>
        </label>
      </div>
      <div class="rc-count">共 {filteredSuggestions.length} 条建议</div>
    </div>

    {#if filteredSuggestions.length === 0}
      <div class="rc-empty">
        <Shirt size={40} />
        <p>暂无调配建议</p>
        <span>当检测到服装冲突或风险时会生成建议方案</span>
      </div>
    {:else}
      <div class="rc-risk-groups">
        {#each filteredSuggestions as sug (sug.suggestionId)}
          <div class="rc-risk-card {getRiskLevelClass(sug.riskLevel)} {sug.status === SUGGESTION_STATUS.APPLIED ? 'rc-card-resolved' : ''}">
            <div class="rc-risk-main">
              <div class="rc-risk-top">
                <span class="rc-risk-level">
                  {#if sug.riskLevel === 'high'}<AlertOctagon size={12} />
                  {:else if sug.riskLevel === 'medium'}<AlertTriangle size={12} />
                  {:else}<Clock size={12} />{/if}
                  {getRiskLevelLabel(sug.riskLevel)}
                </span>
                <span class="rc-risk-type">{sug.aggregatedTypes ? sug.aggregatedTypes.join('·') : (sug.riskType || '')}</span>
                <span class="rc-days-until">{formatDate(sug.scheduleDate)} ({getDaysUntil(sug.scheduleDate)})</span>
                {#if sug.alternatives && sug.alternatives.length > 0}
                  <span class="rc-days-until" style="background:#e6eef6;color:#1a4a8a;">
                    <Shirt size={10} />{sug.alternatives.length} 个候选
                  </span>
                {/if}
                <span class="rc-status-badge {sug.status === SUGGESTION_STATUS.PENDING ? 'rc-status-pending' : sug.status === SUGGESTION_STATUS.CONFIRMED ? 'rc-status-confirmed' : sug.status === SUGGESTION_STATUS.DEFERRED ? 'rc-status-deferred' : 'rc-status-resolved'}">
                  {SUGGESTION_STATUS_LABELS[sug.status] || sug.status}
                </span>
              </div>
              <div class="rc-risk-message">{sug.description}</div>
              <div class="rc-risk-meta">
                <span class="rc-meta-play"><CalendarDays size={10} />{sug.play || '-'}</span>
                {#if sug.costumeName}
                  <span><Shirt size={10} />{sug.costumeName}</span>
                {/if}
                {#if sug.actorName}
                  <span><User size={10} />{sug.actorName}</span>
                {/if}
                {#if sug.handler}
                  <span><MessageSquare size={10} />{sug.handler}</span>
                {/if}
              </div>
              {#if sug.primaryAction}
                <div class="rc-suggest-action">
                  <svelte:component this={getActionIcon(sug.primaryAction.type)} size={12} />
                  <strong>{sug.primaryAction.title}</strong>
                  {#if sug.primaryAction.priority}
                    <span class="rc-priority-tag rc-priority-{sug.primaryAction.priority}">
                      {ACTION_PRIORITY_LABELS[sug.primaryAction.priority]}
                    </span>
                  {/if}
                  <p>{sug.primaryAction.description}</p>
                </div>
              {/if}
              {#if sug.note}
                <div class="rc-risk-note"><MessageSquare size={12} />{sug.note}</div>
              {/if}
            </div>
            <div class="rc-risk-actions">
              <button type="button" class="rc-detail-btn" on:click={() => openSuggestionDetail(sug)}>
                <Eye size={14} />查看建议
              </button>
            </div>
          </div>
        {/each}
      </div>
    {/if}
  {/if}
</div>

{#if showDetailModal && selectedRisk}
  <div class="rc-modal-overlay" role="presentation" on:click={closeDetail}>
    <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
    <div class="rc-modal" role="dialog" aria-modal="true" on:click|stopPropagation on:keydown={handleKeydown} tabindex="-1">
      <div class="rc-modal-header">
        <h2>风险详情</h2>
        <button type="button" class="rc-icon-btn" on:click={closeDetail} aria-label="关闭"><X size={20} /></button>
      </div>
      <div class="rc-modal-body">
        <div class="rc-detail-section">
          <div class="rc-detail-row">
            <span class="rc-detail-label">风险级别</span>
            <span class="rc-level-badge {getRiskLevelClass(selectedRisk.level)}">
              {#if selectedRisk.level === 'high'}<AlertOctagon size={12} />
              {:else if selectedRisk.level === 'medium'}<AlertTriangle size={12} />
              {:else}<Clock size={12} />{/if}
              {getRiskLevelLabel(selectedRisk.level)}
            </span>
          </div>
          <div class="rc-detail-row">
            <span class="rc-detail-label">风险类型</span>
            <strong>{RISK_TYPE_LABELS[selectedRisk.type] || selectedRisk.type}</strong>
          </div>
          <div class="rc-detail-row">
            <span class="rc-detail-label">处理状态</span>
            <span class="rc-status-badge {getStatusBadgeClass(selectedRisk.processingStatus)}">
              {#if selectedRisk.processingStatus === RISK_STATUS.PENDING}<Clock size={12} />
              {:else if selectedRisk.processingStatus === RISK_STATUS.CONFIRMED}<CheckCircle2 size={12} />
              {:else if selectedRisk.processingStatus === RISK_STATUS.DEFERRED}<PauseCircle size={12} />
              {:else}<CheckCircle size={12} />{/if}
              {selectedRisk.processingStatus}
            </span>
          </div>
          <div class="rc-detail-row">
            <span class="rc-detail-label">风险描述</span>
            <p class="rc-detail-message">{selectedRisk.message}</p>
          </div>
        </div>

        <div class="rc-detail-section">
          <h3>关联排期</h3>
          <div class="rc-detail-row">
            <span class="rc-detail-label">剧目</span>
            <strong>{selectedRisk.schedulePlay}</strong>
          </div>
          <div class="rc-detail-row">
            <span class="rc-detail-label">演出日期</span>
            <strong>{formatDate(selectedRisk.scheduleDate)} ({getDaysUntil(selectedRisk.scheduleDate)})</strong>
          </div>
          {#if selectedRisk.scheduleTime}
            <div class="rc-detail-row">
              <span class="rc-detail-label">演出时间</span>
              <strong>{selectedRisk.scheduleTime}</strong>
            </div>
          {/if}
          {#if selectedRisk.scheduleVenue}
            <div class="rc-detail-row">
              <span class="rc-detail-label">演出场地</span>
              <strong>{selectedRisk.scheduleVenue}</strong>
            </div>
          {/if}
          <div class="rc-detail-row">
            <span class="rc-detail-label">排期状态</span>
            <strong>{selectedRisk.scheduleStatus}</strong>
          </div>
        </div>

        {#if selectedRisk.costumeName}
          <div class="rc-detail-section">
            <h3>关联服装</h3>
            <div class="rc-detail-row">
              <span class="rc-detail-label">服装名称</span>
              <strong>{selectedRisk.costumeName}</strong>
            </div>
          </div>
        {/if}

        <div class="rc-detail-section">
          <h3>处理信息</h3>
          {#if editingNote}
            <div class="rc-note-form">
              <label>
                <span><User size={12} />负责人</span>
                <input bind:value={noteForm.handler} placeholder="请输入负责人姓名" />
              </label>
              <label>
                <span><MessageSquare size={12} />处理备注</span>
                <textarea bind:value={noteForm.note} placeholder="记录处理进度或说明" rows="3"></textarea>
              </label>
              <div class="rc-note-actions">
                <button type="button" class="rc-btn-secondary" on:click={() => { editingNote = false; }}>取消</button>
                <button type="button" class="rc-btn-primary" on:click={saveNote}><Save size={14} />保存</button>
              </div>
            </div>
          {:else}
            <div class="rc-detail-row">
              <span class="rc-detail-label">负责人</span>
              <strong>{selectedRisk.handler || '未指定'}</strong>
            </div>
            <div class="rc-detail-row">
              <span class="rc-detail-label">处理备注</span>
              <p class="rc-detail-note">{selectedRisk.note || '暂无备注'}</p>
            </div>
            {#if selectedRisk.updatedAt}
              <div class="rc-detail-row">
                <span class="rc-detail-label">最后更新</span>
                <strong>{formatTime(selectedRisk.updatedAt)}</strong>
              </div>
            {/if}
            <button type="button" class="rc-edit-note-btn" on:click={() => editingNote = true}>
              <Edit3 size={14} />编辑处理信息
            </button>
          {/if}
        </div>

        <div class="rc-detail-section">
          <h3>快速操作</h3>
          <div class="rc-quick-actions">
            <button
              type="button"
              class="rc-quick-btn"
              class:rc-quick-active={selectedRisk.processingStatus === RISK_STATUS.CONFIRMED}
              on:click={() => handleStatusChange(selectedRisk, RISK_STATUS.CONFIRMED)}
            >
              <CheckCircle2 size={16} />标记已确认
            </button>
            <button
              type="button"
              class="rc-quick-btn"
              class:rc-quick-active={selectedRisk.processingStatus === RISK_STATUS.DEFERRED}
              on:click={() => handleStatusChange(selectedRisk, RISK_STATUS.DEFERRED)}
            >
              <PauseCircle size={16} />标记暂缓
            </button>
            <button
              type="button"
              class="rc-quick-btn rc-quick-success"
              class:rc-quick-active={selectedRisk.processingStatus === RISK_STATUS.RESOLVED}
              on:click={() => handleStatusChange(selectedRisk, RISK_STATUS.RESOLVED)}
            >
              <CheckCircle size={16} />标记已解决
            </button>
          </div>
        </div>

        {#if selectedRiskSuggestions.length > 0}
          <div class="rc-detail-section">
            <h3><ArrowRightLeft size={14} />调配建议 ({selectedRiskSuggestions.length})</h3>
            {#each selectedRiskSuggestions as sug (sug.suggestionId)}
              <div class="rc-suggest-card" class:rc-suggest-applied={sug.status === SUGGESTION_STATUS.APPLIED}>
                <div class="rc-suggest-header">
                  <div class="rc-suggest-title">
                    <span class="rc-risk-level {getRiskLevelClass(sug.riskLevel)}">
                      {getRiskLevelLabel(sug.riskLevel)}
                    </span>
                    <strong>{sug.description}</strong>
                  </div>
                  <span class="rc-status-badge {sug.status === SUGGESTION_STATUS.PENDING ? 'rc-status-pending' : sug.status === SUGGESTION_STATUS.CONFIRMED ? 'rc-status-confirmed' : sug.status === SUGGESTION_STATUS.DEFERRED ? 'rc-status-deferred' : 'rc-status-resolved'}">
                    {SUGGESTION_STATUS_LABELS[sug.status]}
                  </span>
                </div>
                {#if sug.primaryAction}
                  <div class="rc-suggest-action">
                    <svelte:component this={getActionIcon(sug.primaryAction.type)} size={12} />
                    <strong>{sug.primaryAction.title}</strong>
                    <span class="rc-priority-tag rc-priority-{sug.primaryAction.priority}">
                      {ACTION_PRIORITY_LABELS[sug.primaryAction.priority]}
                    </span>
                    <p>{sug.primaryAction.description}</p>
                  </div>
                {/if}
                {#if sug.alternatives && sug.alternatives.length > 0}
                  <div class="rc-alt-list">
                    <div class="rc-alt-title"><Shirt size={12} />候选替代服装（{sug.alternatives.length}）</div>
                    {#each sug.alternatives as alt (alt.costumeId)}
                      <div class="rc-alt-item">
                        <div class="rc-alt-main">
                          <div class="rc-alt-name"><strong>{alt.name}</strong>
                            <span class="rc-alt-score">匹配度 {alt.score || 0}</span>
                          </div>
                          <div class="rc-alt-meta">
                            {#if alt.size}<span>尺码 {alt.size}</span>{/if}
                            {#if alt.role}<span>角色 {alt.role}</span>{/if}
                            {#if alt.crossPlay}<span style="color:#8a6b4a;">跨剧目</span>{/if}
                          </div>
                          {#if alt.availabilityReasons && alt.availabilityReasons.length > 0}
                            <div class="rc-alt-reasons">
                              {#each alt.availabilityReasons as r}
                                <span class="rc-alt-reason">{r}</span>
                              {/each}
                            </div>
                          {/if}
                        </div>
                      </div>
                    {/each}
                  </div>
                {/if}
                {#if sug.status !== SUGGESTION_STATUS.APPLIED}
                  <button type="button" class="rc-detail-btn rc-suggest-btn" on:click={() => openSuggestionDetail(sug)}>
                    <Zap size={12} />查看完整方案
                  </button>
                {/if}
              </div>
            {/each}
          </div>
        {/if}

        <div class="rc-modal-actions">
          <button type="button" on:click={closeDetail}>关闭</button>
        </div>
      </div>
    </div>
  </div>
{/if}

{#if showSuggestionDetail && selectedSuggestion}
  <div class="rc-modal-overlay" role="presentation" on:click={closeSuggestionDetail}>
    <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
    <div class="rc-modal rc-modal-wide" role="dialog" aria-modal="true" on:click|stopPropagation tabindex="-1">
      <div class="rc-modal-header">
        <h2><ArrowRightLeft size={16} />调配建议详情</h2>
        <button type="button" class="rc-icon-btn" on:click={closeSuggestionDetail} aria-label="关闭"><X size={20} /></button>
      </div>
      <div class="rc-modal-body">
        <div class="rc-detail-section">
          <div class="rc-detail-row">
            <span class="rc-detail-label">风险级别</span>
            <span class="rc-level-badge {getRiskLevelClass(selectedSuggestion.riskLevel)}">
              {#if selectedSuggestion.riskLevel === 'high'}<AlertOctagon size={12} />
              {:else if selectedSuggestion.riskLevel === 'medium'}<AlertTriangle size={12} />
              {:else}<Clock size={12} />{/if}
              {getRiskLevelLabel(selectedSuggestion.riskLevel)}
            </span>
          </div>
          <div class="rc-detail-row">
            <span class="rc-detail-label">建议状态</span>
            <span class="rc-status-badge {selectedSuggestion.status === SUGGESTION_STATUS.PENDING ? 'rc-status-pending' : selectedSuggestion.status === SUGGESTION_STATUS.CONFIRMED ? 'rc-status-confirmed' : selectedSuggestion.status === SUGGESTION_STATUS.DEFERRED ? 'rc-status-deferred' : 'rc-status-resolved'}">
              {SUGGESTION_STATUS_LABELS[selectedSuggestion.status] || selectedSuggestion.status}
            </span>
          </div>
          <div class="rc-detail-row">
            <span class="rc-detail-label">关联排期</span>
            <strong>{selectedSuggestion.play || '-'} · {formatDate(selectedSuggestion.scheduleDate)}</strong>
          </div>
          <div class="rc-detail-row">
            <span class="rc-detail-label">问题描述</span>
            <p class="rc-detail-message">{selectedSuggestion.description}</p>
          </div>
        </div>

        {#if selectedSuggestion.alternatives && selectedSuggestion.alternatives.length > 0}
          <div class="rc-detail-section">
            <h3><Shirt size={14} />候选替代服装</h3>
            <div class="rc-alt-detail-list">
              {#each selectedSuggestion.alternatives as alt (alt.costumeId)}
                <label
                  class="rc-alt-detail-item"
                  class:rc-alt-selected={selectedAltCostumeId === alt.costumeId}
                >
                  <input
                    type="radio"
                    name="alt-select"
                    bind:group={selectedAltCostumeId}
                    value={alt.costumeId}
                    style="display:none;"
                  />
                  <div class="rc-alt-check">
                    {#if selectedAltCostumeId === alt.costumeId}
                      <CheckCircle size={18} style="color:#4a8a4a;" />
                    {:else}
                      <div class="rc-alt-circle"></div>
                    {/if}
                  </div>
                  <div class="rc-alt-detail-main">
                    <div class="rc-alt-name">
                      <strong>{alt.name}</strong>
                      <span class="rc-alt-score">综合匹配 {alt.score || 0} 分</span>
                    </div>
                    <div class="rc-alt-meta">
                      {#if alt.size}<span>尺码 {alt.size}</span>{/if}
                      {#if alt.role}<span>角色 {alt.role}</span>{/if}
                      {#if alt.crossPlay}<span style="color:#8a6b4a;">跨剧目</span>{/if}
                    </div>
                    <div class="rc-alt-score-breakdown">
                      {#if alt.availabilityScore != null}<span>可用性 {alt.availabilityScore}</span>{/if}
                      {#if alt.playMatchScore != null}<span>剧目匹配 {alt.playMatchScore}</span>{/if}
                      {#if alt.sizeMatchLevel}<span>尺码 {alt.sizeMatchLevel}</span>{/if}
                      {#if alt.borrowFrequency != null}<span>借用频次 {alt.borrowFrequency}次</span>{/if}
                    </div>
                    {#if alt.availabilityReasons && alt.availabilityReasons.length > 0}
                      <div class="rc-alt-reasons">
                        {#each alt.availabilityReasons as r}
                          <span class="rc-alt-reason">{r}</span>
                        {/each}
                      </div>
                    {/if}
                  </div>
                </label>
              {/each}
            </div>
          </div>
        {/if}

        {#if selectedSuggestion.primaryAction || (selectedSuggestion.actions && selectedSuggestion.actions.length > 0)}
          <div class="rc-detail-section">
            <h3><Zap size={14} />处理动作建议</h3>
            {#if selectedSuggestion.primaryAction}
              <div class="rc-suggest-action rc-suggest-action-primary">
                <svelte:component this={getActionIcon(selectedSuggestion.primaryAction.type)} size={14} />
                <strong>{selectedSuggestion.primaryAction.title}</strong>
                <span class="rc-priority-tag rc-priority-{selectedSuggestion.primaryAction.priority}">
                  {ACTION_PRIORITY_LABELS[selectedSuggestion.primaryAction.priority]}
                </span>
                <p>{selectedSuggestion.primaryAction.description}</p>
              </div>
            {/if}
            {#if selectedSuggestion.actions && selectedSuggestion.actions.length > 0}
              {#each selectedSuggestion.actions as act}
                <div class="rc-suggest-action">
                  <svelte:component this={getActionIcon(act.type)} size={12} />
                  <strong>{act.title}</strong>
                  {#if act.priority}<span class="rc-priority-tag rc-priority-{act.priority}">{ACTION_PRIORITY_LABELS[act.priority]}</span>{/if}
                  <p>{act.description}</p>
                </div>
              {/each}
            {/if}
          </div>
        {/if}

        <div class="rc-detail-section">
          <h3>处理信息</h3>
          {#if editingSuggestionNote || selectedSuggestion.status !== SUGGESTION_STATUS.APPLIED}
            <div class="rc-note-form">
              <label>
                <span><User size={12} />负责人</span>
                <input bind:value={suggestionNoteForm.handler} placeholder="请输入负责人姓名" />
              </label>
              <label>
                <span><MessageSquare size={12} />处理备注</span>
                <textarea bind:value={suggestionNoteForm.note} placeholder="记录处理进度或说明" rows="3"></textarea>
              </label>
              {#if !editingSuggestionNote && (selectedSuggestion.handler || selectedSuggestion.note) && selectedSuggestion.status !== SUGGESTION_STATUS.APPLIED}
                <button type="button" class="rc-edit-note-btn" style="align-self:flex-start;" on:click={() => editingSuggestionNote = true}>
                  <Edit3 size={14} />编辑已有备注
                </button>
              {/if}
            </div>
          {:else}
            <div class="rc-detail-row">
              <span class="rc-detail-label">负责人</span>
              <strong>{selectedSuggestion.handler || '未指定'}</strong>
            </div>
            <div class="rc-detail-row">
              <span class="rc-detail-label">处理备注</span>
              <p class="rc-detail-note">{selectedSuggestion.note || '暂无备注'}</p>
            </div>
          {/if}
        </div>

        {#if selectedSuggestion.status !== SUGGESTION_STATUS.APPLIED}
          <div class="rc-detail-section">
            <h3>操作</h3>
            <div class="rc-quick-actions">
              <button
                type="button"
                class="rc-quick-btn rc-quick-active"
                style="border-color:#4a8a4a;background:#e6f0e6;color:#2d5a2d;"
                on:click={handleApplySuggestion}
              >
                <ThumbsUp size={16} />一键执行方案
                {#if selectedAltCostumeId}<small style="opacity:0.7;">（含替代服装替换+装箱单同步）</small>{/if}
              </button>
              <button
                type="button"
                class="rc-quick-btn"
                on:click={handleConfirmSuggestion}
              >
                <CheckCircle2 size={16} />仅确认（手动处理）
              </button>
              <button
                type="button"
                class="rc-quick-btn"
                on:click={handleDeferSuggestion}
              >
                <SkipForward size={16} />暂缓处理
              </button>
            </div>
          </div>
        {:else}
          <div class="rc-detail-section" style="background:#f0fbf0;border-color:#b8d8b8;">
            <h3 style="color:#2d5a2d;"><CheckCircle size={14} />已执行记录</h3>
            <div class="rc-detail-row">
              <span class="rc-detail-label">执行时间</span>
              <strong>{selectedSuggestion.appliedAt ? formatTime(selectedSuggestion.appliedAt) : '-'}</strong>
            </div>
            {#if selectedSuggestion.appliedBy}
              <div class="rc-detail-row">
                <span class="rc-detail-label">执行人</span>
                <strong>{selectedSuggestion.appliedBy}</strong>
              </div>
            {/if}
            {#if selectedSuggestion.appliedAlternativeName}
              <div class="rc-detail-row">
                <span class="rc-detail-label">替换服装</span>
                <strong>{selectedSuggestion.appliedAlternativeName}</strong>
              </div>
            {/if}
          </div>
        {/if}

        <div class="rc-modal-actions">
          <button type="button" on:click={closeSuggestionDetail}>关闭</button>
        </div>
      </div>
    </div>
  </div>
{/if}

{#if showPreviewModal && currentPreview}
  <div class="rc-modal-overlay" role="presentation" on:click={closePreviewModal}>
    <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
    <div class="rc-modal rc-modal-wide rc-modal-xl" role="dialog" aria-modal="true" on:click|stopPropagation on:keydown={handleKeydown} tabindex="-1">
      <div class="rc-modal-header">
        <h2><Eye size={16} />执行前预演 · 调配影响预览</h2>
        <button type="button" class="rc-icon-btn" on:click={closePreviewModal} aria-label="关闭"><X size={20} /></button>
      </div>
      <div class="rc-modal-body">
        <div class="rc-preview-summary">
          <div class="rc-preview-summary-item">
            <span class="rc-preview-summary-label">排期</span>
            <strong>{currentPreview.schedule?.play || '-'} · {currentPreview.schedule?.date || '-'}</strong>
          </div>
          <div class="rc-preview-summary-item">
            <span class="rc-preview-summary-label">建议</span>
            <strong>{currentPreview.suggestion?.description || '-'}</strong>
          </div>
        </div>

        {#if currentPreview.scheduleChanges}
          <div class="rc-detail-section">
            <h3><Shirt size={14} />排期服装变更</h3>
            <div class="rc-preview-change">
              <div class="rc-preview-change-col">
                <div class="rc-preview-change-label rc-preview-change-old"><XCircle size={12} />移除</div>
                <div class="rc-preview-change-box rc-preview-change-box-old">
                  <strong>{currentPreview.scheduleChanges.oldCostumeName}</strong>
                  {#if currentPreview.scheduleChanges.oldCostumeId}
                    <span class="rc-preview-change-sub">ID: {currentPreview.scheduleChanges.oldCostumeId.slice(0, 8)}...</span>
                  {/if}
                </div>
              </div>
              <div class="rc-preview-change-arrow">
                <ArrowRight size={20} />
              </div>
              <div class="rc-preview-change-col">
                <div class="rc-preview-change-label rc-preview-change-new"><CheckCircle size={12} />替换为</div>
                <div class="rc-preview-change-box rc-preview-change-box-new">
                  <strong>{currentPreview.scheduleChanges.newCostumeName}</strong>
                  {#if currentPreview.scheduleChanges.newCostumeId}
                    <span class="rc-preview-change-sub">ID: {currentPreview.scheduleChanges.newCostumeId.slice(0, 8)}...</span>
                  {/if}
                </div>
              </div>
            </div>
          </div>
        {/if}

        <div class="rc-detail-section">
          <h3><Package size={14} />装箱单条目更新</h3>
          <label class="rc-checkbox-label rc-preview-checkbox">
            <input type="checkbox" bind:checked={previewUpdatePackingList} on:change={handlePreviewTogglePacking} />
            <span>同步更新装箱单（{currentPreview.packingListChanges?.length || 0} 个装箱单将被修改）</span>
          </label>
          {#if previewUpdatePackingList && currentPreview.packingListChanges?.length > 0}
            <div class="rc-preview-packing-list">
              {#each currentPreview.packingListChanges as pc (pc.packingListId)}
                <div class="rc-preview-packing-card">
                  <div class="rc-preview-packing-title">
                    <Package size={12} />
                    <strong>{pc.packingListName}</strong>
                  </div>
                  <div class="rc-preview-packing-change">
                    <div class="rc-preview-packing-item rc-preview-packing-item-old">
                      <span class="rc-preview-packing-item-label">原条目</span>
                      <div>
                        <strong>{pc.oldItem.costumeName}</strong>
                        {#if pc.oldItem.size}<span class="rc-preview-packing-sub">尺码 {pc.oldItem.size}</span>{/if}
                        {#if pc.oldItem.location}<span class="rc-preview-packing-sub">位置 {pc.oldItem.location}</span>{/if}
                      </div>
                    </div>
                    <div class="rc-preview-change-arrow"><ArrowRight size={16} /></div>
                    <div class="rc-preview-packing-item rc-preview-packing-item-new">
                      <span class="rc-preview-packing-item-label">新条目</span>
                      <div>
                        <strong>{pc.newItem.costumeName}</strong>
                        {#if pc.newItem.size}<span class="rc-preview-packing-sub">尺码 {pc.newItem.size}</span>{/if}
                        {#if pc.newItem.location}<span class="rc-preview-packing-sub">位置 {pc.newItem.location}</span>{/if}
                      </div>
                    </div>
                  </div>
                </div>
              {/each}
            </div>
          {:else if !previewUpdatePackingList}
            <p class="rc-hint">已选择不同步装箱单，装箱单条目将保持不变。</p>
          {:else}
            <p class="rc-hint">当前排期暂无关联装箱单。</p>
          {/if}
        </div>

        {#if currentPreview.riskImpacts && currentPreview.riskImpacts.length > 0}
          <div class="rc-detail-section">
            <h3><AlertTriangle size={14} />相关风险状态变化</h3>
            <div class="rc-preview-risk-list">
              {#each currentPreview.riskImpacts as ri (ri.riskKey)}
                <div class="rc-preview-risk-item" class:rc-preview-risk-resolve={ri.impact === 'resolve'} class:rc-preview-risk-introduce={ri.impact === 'introduce'}>
                  <div class="rc-preview-risk-icon">
                    {#if ri.impact === 'resolve'}
                      <CheckCircle2 size={14} />
                    {:else}
                      <AlertCircle size={14} />
                    {/if}
                  </div>
                  <div class="rc-preview-risk-main">
                    <div class="rc-preview-risk-header">
                      <span class="rc-risk-level rc-risk-{ri.riskLevel}">{getRiskLevelLabel(ri.riskLevel)}</span>
                      <strong>{RISK_TYPE_LABELS[ri.riskType] || ri.riskType}</strong>
                      <span class="rc-preview-risk-badge rc-preview-risk-badge-{ri.impact}">
                        {ri.impact === 'resolve' ? '将解决' : '需关注'}
                      </span>
                    </div>
                    <p class="rc-preview-risk-message">{ri.riskMessage}</p>
                    <div class="rc-preview-risk-meta">
                      <span><Shirt size={10} />{ri.costumeName}</span>
                      <span>{ri.impactDescription}</span>
                    </div>
                  </div>
                </div>
              {/each}
            </div>
          </div>
        {/if}

        {#if currentPreview.affectedWorkOrders && currentPreview.affectedWorkOrders.length > 0}
          <div class="rc-detail-section">
            <h3><Wrench size={14} />可能受影响的工单（{currentPreview.affectedWorkOrders.length}）</h3>
            <div class="rc-preview-affected-list">
              {#each currentPreview.affectedWorkOrders as wo (wo.workOrderId)}
                <div class="rc-preview-affected-item" class:rc-preview-affected-blocker={wo.impact === 'blocker'}>
                  <div class="rc-preview-affected-icon">
                    <Wrench size={14} />
                  </div>
                  <div class="rc-preview-affected-main">
                    <div class="rc-preview-affected-header">
                      <strong>{wo.workOrderType}</strong>
                      <span class="rc-preview-affected-status">{wo.workOrderStatus}</span>
                      {#if wo.impact === 'blocker'}
                        <span class="rc-preview-affected-tag rc-preview-affected-tag-warn">可能阻碍</span>
                      {:else}
                        <span class="rc-preview-affected-tag">需确认</span>
                      {/if}
                    </div>
                    <div class="rc-preview-affected-meta">
                      <span><Shirt size={10} />{wo.costumeName}</span>
                      {#if wo.assignee && wo.assignee !== '-'}<span><User size={10} />{wo.assignee}</span>{/if}
                      {#if wo.dueDate && wo.dueDate !== '-'}<span><Clock size={10} />截止 {wo.dueDate}</span>{/if}
                    </div>
                    <p class="rc-preview-affected-desc">{wo.impactDescription}</p>
                  </div>
                </div>
              {/each}
            </div>
          </div>
        {/if}

        {#if currentPreview.affectedReservations && currentPreview.affectedReservations.length > 0}
          <div class="rc-detail-section">
            <h3><CalendarDays size={14} />可能受影响的预约（{currentPreview.affectedReservations.length}）</h3>
            <div class="rc-preview-affected-list">
              {#each currentPreview.affectedReservations as rv (rv.reservationId)}
                <div class="rc-preview-affected-item" class:rc-preview-affected-blocker={rv.impact === 'conflict'}>
                  <div class="rc-preview-affected-icon">
                    <CalendarDays size={14} />
                  </div>
                  <div class="rc-preview-affected-main">
                    <div class="rc-preview-affected-header">
                      <strong>{rv.reservationType}预约</strong>
                      <span class="rc-preview-affected-status">{rv.reservationStatus || '未标记'}</span>
                      {#if rv.impact === 'conflict'}
                        <span class="rc-preview-affected-tag rc-preview-affected-tag-danger">可能冲突</span>
                      {:else}
                        <span class="rc-preview-affected-tag">需确认</span>
                      {/if}
                    </div>
                    <div class="rc-preview-affected-meta">
                      <span><Shirt size={10} />{rv.costumeName}</span>
                      {#if rv.reservedFor && rv.reservedFor !== '-'}<span><User size={10} />{rv.reservedFor}</span>{/if}
                      {#if rv.date && rv.date !== '-'}<span><Clock size={10} />{rv.date}</span>{/if}
                    </div>
                    <p class="rc-preview-affected-desc">{rv.impactDescription}</p>
                  </div>
                </div>
              {/each}
            </div>
          </div>
        {/if}

        <div class="rc-preview-note">
          <ClipboardList size={14} />
          <span>确认执行后，系统将沿用现有事件记录机制记录操作，并自动刷新相关风险与调配建议。</span>
        </div>

        <div class="rc-modal-actions rc-modal-actions-right">
          <button type="button" class="rc-btn-secondary" on:click={closePreviewModal}>取消</button>
          <button type="button" class="rc-btn-primary" on:click={handlePreviewConfirm}>
            <ThumbsUp size={14} />确认执行
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}

<script context="module">
  function formatTime(isoString) {
    if (!isoString) return '';
    const date = new Date(isoString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}`;
  }
</script>

<style>
  .rc-container {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .rc-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
  }

  .rc-header-left {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .rc-header h2 {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 0;
    font-size: 18px;
    color: #26211c;
  }

  .rc-subtitle {
    font-size: 13px;
    color: #8a7665;
  }

  .rc-count {
    font-size: 13px;
    color: #8a7665;
    background: #f0e6dc;
    padding: 4px 10px;
    border-radius: 6px;
  }

  .rc-stats {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
    gap: 10px;
  }

  .rc-stat-card {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 14px;
    border-radius: 10px;
    background: #fff;
    border: 1px solid #eadfd4;
  }

  .rc-stat-pending { border-left: 3px solid #c9a040; }
  .rc-stat-confirmed { border-left: 3px solid #4a6b8a; }
  .rc-stat-deferred { border-left: 3px solid #8a6b4a; }
  .rc-stat-resolved { border-left: 3px solid #4a8a4a; }
  .rc-stat-high { border-left: 3px solid #b84a3b; background: #fff8f5; }
  .rc-stat-medium { border-left: 3px solid #c9a040; background: #fffbf0; }

  .rc-stat-icon {
    width: 36px;
    height: 36px;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #f0e6dc;
    color: #603d2d;
  }

  .rc-stat-pending .rc-stat-icon { background: #fff4e6; color: #8a5a1a; }
  .rc-stat-confirmed .rc-stat-icon { background: #e6eef6; color: #1a4a8a; }
  .rc-stat-deferred .rc-stat-icon { background: #f0e6dc; color: #6b5a4d; }
  .rc-stat-resolved .rc-stat-icon { background: #e6f0e6; color: #2d5a2d; }
  .rc-stat-high .rc-stat-icon { background: #fdecea; color: #8a2d2d; }
  .rc-stat-medium .rc-stat-icon { background: #fff4e6; color: #8a5a1a; }

  .rc-stat-content {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .rc-stat-number {
    font-size: 22px;
    font-weight: 600;
    color: #26211c;
    line-height: 1;
  }

  .rc-stat-label {
    font-size: 12px;
    color: #8a7665;
  }

  .rc-toolbar {
    display: flex;
    gap: 10px;
    align-items: center;
    flex-wrap: wrap;
  }

  .rc-search-label {
    display: flex;
    align-items: center;
    gap: 8px;
    border: 1px solid #d8c8ba;
    border-radius: 8px;
    padding: 0 12px;
    background: #fff;
    flex: 1;
    min-width: 200px;
  }

  .rc-search-label input {
    border: 0;
    padding: 11px 0;
    width: 100%;
    font: inherit;
    background: transparent;
  }

  .rc-filters {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }

  .rc-filters select {
    border: 1px solid #d8c8ba;
    border-radius: 8px;
    padding: 10px 12px;
    background: #fff;
    font: inherit;
    min-width: 120px;
  }

  .rc-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    padding: 60px 20px;
    color: #8a7665;
    background: #faf6f2;
    border-radius: 12px;
    border: 1px dashed #d8c8ba;
  }

  .rc-empty p { margin: 0; font-size: 15px; color: #6b5a4d; }
  .rc-empty span { font-size: 13px; }

  .rc-risk-groups {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .rc-group-header {
    margin-bottom: 8px;
  }

  .rc-status-badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 10px;
    border-radius: 6px;
    font-size: 12px;
    font-weight: 500;
  }

  .rc-status-pending { background: #fff4e6; color: #8a5a1a; }
  .rc-status-confirmed { background: #e6eef6; color: #1a4a8a; }
  .rc-status-deferred { background: #f0e6dc; color: #6b5a4d; }
  .rc-status-resolved { background: #e6f0e6; color: #2d5a2d; }

  .rc-risk-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .rc-risk-card {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    padding: 14px;
    background: #fff;
    border: 1px solid #eadfd4;
    border-radius: 10px;
    border-left: 3px solid #eadfd4;
    transition: all .15s ease;
  }

  .rc-risk-card:hover {
    box-shadow: 0 4px 12px rgb(62 42 24 / .08);
  }

  .rc-risk-high { border-left-color: #b84a3b; }
  .rc-risk-medium { border-left-color: #c9a040; }
  .rc-risk-low { border-left-color: #8a9a8a; }
  .rc-card-resolved { opacity: 0.6; }

  .rc-risk-main {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .rc-risk-top {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
  }

  .rc-risk-level {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 11px;
    font-weight: 500;
    padding: 2px 8px;
    border-radius: 4px;
  }

  .rc-risk-high .rc-risk-level { background: #fdecea; color: #8a2d2d; }
  .rc-risk-medium .rc-risk-level { background: #fff4e6; color: #8a5a1a; }
  .rc-risk-low .rc-risk-level { background: #f6efe7; color: #6b5a4d; }

  .rc-risk-type {
    font-size: 11px;
    color: #8a7665;
    background: #f0e6dc;
    padding: 2px 8px;
    border-radius: 4px;
  }

  .rc-days-until {
    font-size: 11px;
    font-weight: 500;
    padding: 2px 8px;
    border-radius: 4px;
  }

  .rc-days-until {
    background: #fff4e6;
    color: #8a5a1a;
  }

  .rc-risk-message {
    font-size: 14px;
    color: #26211c;
    line-height: 1.5;
  }

  .rc-risk-meta {
    display: flex;
    gap: 12px;
    flex-wrap: wrap;
    font-size: 12px;
    color: #8a7665;
  }

  .rc-risk-meta span {
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }

  .rc-meta-play { color: #603d2d; font-weight: 500; }

  .rc-risk-note {
    display: flex;
    gap: 6px;
    font-size: 12px;
    color: #6b5a4d;
    background: #faf6f2;
    padding: 6px 10px;
    border-radius: 6px;
    border-left: 2px solid #c9a67e;
  }

  .rc-risk-actions {
    display: flex;
    flex-direction: column;
    gap: 6px;
    flex-shrink: 0;
  }

  .rc-status-menu {
    position: relative;
  }

  .rc-status-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 10px;
    border-radius: 6px;
    font-size: 12px;
    font-weight: 500;
    border: 1px solid transparent;
    cursor: pointer;
    font: inherit;
    background: transparent;
  }

  .rc-status-btn:hover {
    filter: brightness(0.95);
  }

  .rc-status-dropdown {
    position: absolute;
    top: calc(100% + 4px);
    right: 0;
    background: #fff;
    border: 1px solid #d8c8ba;
    border-radius: 8px;
    box-shadow: 0 8px 24px rgb(38 33 28 / .15);
    z-index: 10;
    min-width: 120px;
    overflow: hidden;
  }

  .rc-dropdown-item {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 10px 14px;
    border: 0;
    background: transparent;
    cursor: pointer;
    font: inherit;
    font-size: 13px;
    color: #3b2f26;
    text-align: left;
    transition: background .15s;
  }

  .rc-dropdown-item:hover {
    background: #f0e6dc;
  }

  .rc-dropdown-active {
    background: #faf6f2;
    font-weight: 500;
  }

  .rc-detail-btn {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 6px 10px;
    border: 1px solid #d8c8ba;
    border-radius: 6px;
    background: transparent;
    cursor: pointer;
    font: inherit;
    font-size: 12px;
    color: #4a3b30;
    transition: background .15s;
  }

  .rc-detail-btn:hover {
    background: #f0e6dc;
  }

  .rc-modal-overlay {
    position: fixed;
    inset: 0;
    background: rgb(38 33 28 / .55);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 16px;
    z-index: 100;
  }

  .rc-modal {
    background: #fff;
    border-radius: 12px;
    width: 100%;
    max-width: 560px;
    max-height: 90vh;
    overflow-y: auto;
    box-shadow: 0 24px 60px rgb(38 33 28 / .25);
  }

  .rc-modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 18px 20px;
    border-bottom: 1px solid #e4d8cc;
    position: sticky;
    top: 0;
    background: #fff;
    z-index: 5;
  }

  .rc-modal-header h2 {
    margin: 0;
    font-size: 18px;
  }

  .rc-icon-btn {
    background: transparent;
    border: 0;
    padding: 6px;
    cursor: pointer;
    color: #6b5a4d;
    border-radius: 6px;
  }

  .rc-icon-btn:hover { background: #f0e6dc; }

  .rc-modal-body {
    padding: 18px 20px 20px;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .rc-detail-section {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 14px;
    background: #faf6f2;
    border: 1px solid #e4d8cc;
    border-radius: 10px;
  }

  .rc-detail-section h3 {
    margin: 0;
    font-size: 14px;
    font-weight: 600;
    color: #3b2f26;
  }

  .rc-detail-row {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 12px;
  }

  .rc-detail-label {
    font-size: 13px;
    color: #8a7665;
    flex-shrink: 0;
  }

  .rc-detail-message,
  .rc-detail-note {
    margin: 0;
    font-size: 13px;
    color: #3b2f26;
    line-height: 1.6;
    text-align: right;
    flex: 1;
  }

  .rc-level-badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 10px;
    border-radius: 6px;
    font-size: 12px;
    font-weight: 500;
  }

  .rc-note-form {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .rc-note-form label {
    display: flex;
    flex-direction: column;
    gap: 6px;
    font-size: 13px;
    color: #6b5a4d;
  }

  .rc-note-form label span {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-weight: 500;
  }

  .rc-note-form input,
  .rc-note-form textarea {
    width: 100%;
    border: 1px solid #d8c8ba;
    border-radius: 8px;
    padding: 10px 12px;
    background: #fff;
    font: inherit;
  }

  .rc-note-form textarea {
    resize: vertical;
    min-height: 80px;
  }

  .rc-note-actions {
    display: flex;
    gap: 8px;
    justify-content: flex-end;
  }

  .rc-btn-secondary,
  .rc-btn-primary {
    padding: 8px 14px;
    border-radius: 8px;
    border: 0;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font: inherit;
    font-size: 13px;
  }

  .rc-btn-secondary {
    background: #efe4d9;
    color: #37261d;
  }

  .rc-btn-primary {
    background: #603d2d;
    color: #fff;
  }

  .rc-btn-primary:hover { background: #4e3225; }

  .rc-edit-note-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 8px 12px;
    border: 1px dashed #d8c8ba;
    border-radius: 8px;
    background: transparent;
    cursor: pointer;
    font: inherit;
    font-size: 13px;
    color: #603d2d;
    margin-top: 4px;
  }

  .rc-edit-note-btn:hover {
    background: #fff;
  }

  .rc-quick-actions {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
    gap: 8px;
  }

  .rc-quick-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 10px 14px;
    border: 1px solid #d8c8ba;
    border-radius: 8px;
    background: #fff;
    cursor: pointer;
    font: inherit;
    font-size: 13px;
    color: #4a3b30;
    transition: all .15s;
  }

  .rc-quick-btn:hover {
    background: #f0e6dc;
  }

  .rc-quick-active {
    background: #603d2d;
    border-color: #603d2d;
    color: #fff;
  }

  .rc-quick-success.rc-quick-active {
    background: #4a8a4a;
    border-color: #4a8a4a;
  }

  .rc-modal-actions {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
  }

  .rc-modal-actions button {
    padding: 10px 20px;
    border: 1px solid #d8c8ba;
    border-radius: 8px;
    background: #fff;
    cursor: pointer;
    font: inherit;
    font-size: 14px;
    color: #4a3b30;
  }

  .rc-modal-actions button:hover {
    background: #f0e6dc;
  }

  .rc-modal-wide {
    max-width: 760px;
  }

  .rc-tabs {
    display: flex;
    gap: 4px;
    border-bottom: 1px solid #e4d8cc;
    padding: 0;
  }

  .rc-tab-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 10px 18px;
    border: 0;
    border-bottom: 2px solid transparent;
    background: transparent;
    cursor: pointer;
    font: inherit;
    font-size: 14px;
    font-weight: 500;
    color: #8a7665;
    transition: all .15s ease;
    position: relative;
    top: 1px;
  }

  .rc-tab-btn:hover {
    color: #603d2d;
  }

  .rc-tab-active {
    color: #603d2d;
    border-bottom-color: #603d2d;
    background: #faf6f2;
  }

  .rc-tab-badge {
    background: #b84a3b;
    color: #fff;
    font-size: 11px;
    font-weight: 600;
    padding: 2px 7px;
    border-radius: 10px;
    line-height: 1;
  }

  .rc-checkbox-label {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 10px 12px;
    border: 1px solid #d8c8ba;
    border-radius: 8px;
    background: #fff;
    font-size: 13px;
    color: #4a3b30;
    cursor: pointer;
  }

  .rc-checkbox-label input {
    margin: 0;
    width: 14px;
    height: 14px;
    accent-color: #603d2d;
  }

  .rc-suggest-action {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    padding: 10px 12px;
    background: #fffbf0;
    border: 1px solid #e8d8b8;
    border-radius: 8px;
    flex-wrap: wrap;
    margin-top: 4px;
  }

  .rc-suggest-action strong {
    color: #3b2f26;
    font-size: 13px;
  }

  .rc-suggest-action p {
    margin: 0;
    font-size: 12px;
    color: #6b5a4d;
    line-height: 1.5;
    flex-basis: 100%;
    padding-left: 20px;
  }

  .rc-suggest-action-primary {
    background: #eef6ee;
    border-color: #b8d8b8;
  }

  .rc-suggest-action-primary strong { color: #2d5a2d; }

  .rc-priority-tag {
    font-size: 10px;
    font-weight: 600;
    padding: 2px 6px;
    border-radius: 4px;
    letter-spacing: .3px;
  }

  .rc-priority-urgent { background: #fdecea; color: #8a2d2d; }
  .rc-priority-high { background: #fff4e6; color: #8a5a1a; }
  .rc-priority-medium { background: #e6eef6; color: #1a4a8a; }
  .rc-priority-low { background: #efe4d9; color: #6b5a4d; }

  .rc-suggest-card {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 12px;
    background: #fff;
    border: 1px solid #e4d8cc;
    border-radius: 8px;
    margin-bottom: 8px;
  }

  .rc-suggest-card:last-child { margin-bottom: 0; }

  .rc-suggest-applied {
    opacity: 0.7;
    background: #f6faf6;
  }

  .rc-suggest-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 10px;
  }

  .rc-suggest-title {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }

  .rc-suggest-title strong {
    font-size: 13px;
    color: #3b2f26;
  }

  .rc-suggest-btn {
    align-self: flex-start;
  }

  .rc-alt-list {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .rc-alt-title {
    font-size: 12px;
    font-weight: 500;
    color: #8a6b4a;
    display: inline-flex;
    align-items: center;
    gap: 4px;
    margin-top: 4px;
  }

  .rc-alt-item {
    display: flex;
    gap: 10px;
    padding: 8px 10px;
    background: #faf6f2;
    border: 1px solid #eadfd4;
    border-radius: 6px;
  }

  .rc-alt-main {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .rc-alt-name {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
  }

  .rc-alt-name strong {
    font-size: 13px;
    color: #3b2f26;
  }

  .rc-alt-score {
    font-size: 11px;
    color: #2d5a2d;
    font-weight: 600;
    background: #e6f0e6;
    padding: 2px 6px;
    border-radius: 4px;
  }

  .rc-alt-meta {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
    font-size: 11px;
    color: #8a7665;
  }

  .rc-alt-meta span {
    background: #fff;
    padding: 1px 6px;
    border-radius: 3px;
  }

  .rc-alt-reasons {
    display: flex;
    gap: 4px;
    flex-wrap: wrap;
  }

  .rc-alt-reason {
    font-size: 10px;
    padding: 1px 5px;
    border-radius: 3px;
    background: #fff4e6;
    color: #8a5a1a;
  }

  .rc-alt-detail-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .rc-alt-detail-item {
    display: flex;
    gap: 12px;
    padding: 12px;
    background: #faf6f2;
    border: 2px solid transparent;
    border-radius: 8px;
    cursor: pointer;
    transition: all .15s;
  }

  .rc-alt-detail-item:hover {
    background: #fff;
    border-color: #d8c8ba;
  }

  .rc-alt-selected {
    background: #f0f8f0;
    border-color: #4a8a4a;
  }

  .rc-alt-check {
    flex-shrink: 0;
    padding-top: 2px;
  }

  .rc-alt-circle {
    width: 18px;
    height: 18px;
    border-radius: 50%;
    border: 2px solid #d8c8ba;
  }

  .rc-alt-detail-main {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .rc-alt-score-breakdown {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
  }

  .rc-alt-score-breakdown span {
    font-size: 10px;
    padding: 2px 6px;
    border-radius: 4px;
    background: #fff;
    color: #6b5a4d;
    border: 1px solid #eadfd4;
  }

  @media (max-width: 768px) {
    .rc-toolbar { flex-direction: column; }
    .rc-search-label { width: 100%; }
    .rc-filters { width: 100%; }
    .rc-filters select { flex: 1; min-width: 0; }
    .rc-risk-card { flex-direction: column; }
    .rc-risk-actions { flex-direction: row; }
    .rc-quick-actions { grid-template-columns: 1fr; }
    .rc-suggest-header { flex-direction: column; }
    .rc-alt-detail-item { flex-direction: column; }
  }

  .rc-modal-xl { max-width: 820px; }

  .rc-preview-summary {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
    margin-bottom: 16px;
    padding: 12px 16px;
    background: #faf6f1;
    border: 1px solid #eadfd4;
    border-radius: 8px;
  }

  .rc-preview-summary-item {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .rc-preview-summary-label {
    font-size: 11px;
    color: #8a7665;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .rc-preview-change {
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    gap: 12px;
    align-items: center;
  }

  .rc-preview-change-col {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .rc-preview-change-label {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 12px;
    font-weight: 500;
  }

  .rc-preview-change-old { color: #8a2d2d; }
  .rc-preview-change-new { color: #2d5a2d; }

  .rc-preview-change-box {
    padding: 12px;
    border-radius: 8px;
    border: 1px solid #eadfd4;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .rc-preview-change-box-old {
    background: #fff5f5;
    border-color: #e8c8c8;
  }

  .rc-preview-change-box-new {
    background: #f0fbf0;
    border-color: #b8d8b8;
  }

  .rc-preview-change-sub {
    font-size: 11px;
    color: #8a7665;
    font-family: monospace;
  }

  .rc-preview-change-arrow {
    color: #8a7665;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .rc-preview-checkbox {
    margin-bottom: 12px;
    padding: 8px 12px;
    background: #faf6f1;
    border-radius: 6px;
  }

  .rc-preview-packing-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .rc-preview-packing-card {
    padding: 12px;
    border: 1px solid #eadfd4;
    border-radius: 8px;
    background: #fff;
  }

  .rc-preview-packing-title {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;
    font-weight: 600;
    color: #26211c;
    margin-bottom: 10px;
  }

  .rc-preview-packing-change {
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    gap: 10px;
    align-items: stretch;
  }

  .rc-preview-packing-item {
    padding: 10px;
    border-radius: 6px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .rc-preview-packing-item-old {
    background: #fff5f5;
    border: 1px solid #e8c8c8;
  }

  .rc-preview-packing-item-new {
    background: #f0fbf0;
    border: 1px solid #b8d8b8;
  }

  .rc-preview-packing-item-label {
    font-size: 11px;
    font-weight: 500;
    color: #8a7665;
  }

  .rc-preview-packing-sub {
    font-size: 11px;
    color: #6b5a4d;
    margin-left: 6px;
  }

  .rc-preview-risk-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .rc-preview-risk-item {
    display: flex;
    gap: 10px;
    padding: 10px 12px;
    border-radius: 8px;
    border: 1px solid #eadfd4;
    background: #fff;
  }

  .rc-preview-risk-resolve {
    background: #f0fbf0;
    border-color: #b8d8b8;
  }

  .rc-preview-risk-introduce {
    background: #fffbf0;
    border-color: #e8d8a8;
  }

  .rc-preview-risk-icon {
    flex-shrink: 0;
    padding-top: 2px;
  }

  .rc-preview-risk-resolve .rc-preview-risk-icon { color: #2d5a2d; }
  .rc-preview-risk-introduce .rc-preview-risk-icon { color: #8a5a1a; }

  .rc-preview-risk-main {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .rc-preview-risk-header {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }

  .rc-preview-risk-badge {
    font-size: 11px;
    font-weight: 500;
    padding: 2px 8px;
    border-radius: 4px;
  }

  .rc-preview-risk-badge-resolve {
    background: #e6f0e6;
    color: #2d5a2d;
  }

  .rc-preview-risk-badge-introduce {
    background: #fff4e6;
    color: #8a5a1a;
  }

  .rc-preview-risk-message {
    font-size: 13px;
    color: #26211c;
    margin: 0;
  }

  .rc-preview-risk-meta {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
    font-size: 11px;
    color: #6b5a4d;
  }

  .rc-preview-risk-meta span {
    display: inline-flex;
    align-items: center;
    gap: 3px;
  }

  .rc-preview-affected-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .rc-preview-affected-item {
    display: flex;
    gap: 10px;
    padding: 10px 12px;
    border-radius: 8px;
    border: 1px solid #eadfd4;
    background: #fff;
  }

  .rc-preview-affected-blocker {
    background: #fff8f5;
    border-color: #e8c8b8;
  }

  .rc-preview-affected-icon {
    flex-shrink: 0;
    padding-top: 2px;
    color: #6b5a4d;
  }

  .rc-preview-affected-blocker .rc-preview-affected-icon { color: #8a4a2d; }

  .rc-preview-affected-main {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .rc-preview-affected-header {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }

  .rc-preview-affected-status {
    font-size: 11px;
    color: #6b5a4d;
    background: #f0e6dc;
    padding: 2px 6px;
    border-radius: 4px;
  }

  .rc-preview-affected-tag {
    font-size: 11px;
    font-weight: 500;
    padding: 2px 8px;
    border-radius: 4px;
    background: #e6eef6;
    color: #1a4a8a;
  }

  .rc-preview-affected-tag-warn {
    background: #fff4e6;
    color: #8a5a1a;
  }

  .rc-preview-affected-tag-danger {
    background: #fdecea;
    color: #8a2d2d;
  }

  .rc-preview-affected-meta {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
    font-size: 11px;
    color: #6b5a4d;
  }

  .rc-preview-affected-meta span {
    display: inline-flex;
    align-items: center;
    gap: 3px;
  }

  .rc-preview-affected-desc {
    font-size: 12px;
    color: #6b5a4d;
    margin: 0;
  }

  .rc-preview-note {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    padding: 10px 14px;
    background: #f0f6fb;
    border: 1px solid #c8d8e8;
    border-radius: 8px;
    font-size: 12px;
    color: #1a4a8a;
    margin-top: 4px;
  }

  .rc-hint {
    font-size: 12px;
    color: #8a7665;
    margin: 0;
    padding: 8px 0;
  }

  .rc-modal-actions-right {
    justify-content: flex-end;
  }

  .rc-btn-primary {
    background: #2d5a2d;
    color: #fff;
    border: 1px solid #2d5a2d;
    padding: 8px 16px;
    border-radius: 6px;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }

  .rc-btn-primary:hover {
    background: #234a23;
  }

  .rc-btn-secondary {
    background: #fff;
    color: #26211c;
    border: 1px solid #d4c8b8;
    padding: 8px 16px;
    border-radius: 6px;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }

  .rc-btn-secondary:hover {
    background: #faf6f1;
  }

  @media (max-width: 768px) {
    .rc-preview-change,
    .rc-preview-packing-change { grid-template-columns: 1fr; }
    .rc-preview-change-arrow { transform: rotate(90deg); }
    .rc-preview-summary { grid-template-columns: 1fr; }
  }
</style>
