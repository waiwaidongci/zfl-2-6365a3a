<script>
  import { createEventDispatcher } from 'svelte';
  import {
    AlertTriangle, AlertOctagon, Clock, Search, X, Save, CheckCircle,
    CalendarDays, Filter, ChevronDown, ChevronUp, Eye, User, MessageSquare,
    CheckCircle2, PauseCircle, XCircle, ArrowRight
  } from 'lucide-svelte';
  import {
    updateRiskProcessingStatus,
    RISK_STATUS,
    RISK_TYPE_LABELS
  } from '$lib/scheduleStore.js';
  import { globalIndex } from '$lib/dataIndex.js';

  const costumes = [];
  const reservations = [];
  const workOrders = [];
  const packingLists = [];

  $: allRisks = $globalIndex.computeAllRisks();
  $: riskStats = $globalIndex.getRiskStats(allRisks);

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

  $: plays = ['全部剧目', ...(riskStats.byPlay ? Object.keys(riskStats.byPlay).filter(Boolean) : [])];
  $: riskTypes = ['全部类型', ...(riskStats.byType ? Object.keys(riskStats.byType).filter(Boolean) : [])];

  $: filteredRisks = $globalIndex.filterRisks({
    play: playFilter,
    level: levelFilter,
    status: statusFilter,
    type: typeFilter,
    query: riskQuery.trim()
  });

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

  function closeDetail() {
    showDetailModal = false;
    selectedRisk = null;
    showStatusMenu = null;
    editingNote = false;
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
      if (showDetailModal) closeDetail();
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

        <div class="rc-modal-actions">
          <button type="button" on:click={closeDetail}>关闭</button>
        </div>
      </div>
    </div>
  </div>
{/if}

<script context="module">
  import { Edit3 } from 'lucide-svelte';

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

  @media (max-width: 768px) {
    .rc-toolbar { flex-direction: column; }
    .rc-search-label { width: 100%; }
    .rc-filters { width: 100%; }
    .rc-filters select { flex: 1; min-width: 0; }
    .rc-risk-card { flex-direction: column; }
    .rc-risk-actions { flex-direction: row; }
    .rc-quick-actions { grid-template-columns: 1fr; }
  }
</style>
