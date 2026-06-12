<script>
  import { createEventDispatcher } from 'svelte';
  import {
    CalendarDays, Plus, Search, X, Save, Trash2, Eye,
    AlertTriangle, AlertOctagon, Clock, Shirt, CheckCircle,
    Link2, ChevronDown, ChevronUp, Wrench, Droplets, Package
  } from 'lucide-svelte';
  import {
    addSchedule,
    updateSchedule,
    deleteSchedule,
    computeDailyRisk,
    autoLinkCostumes,
    getUpcomingSchedules,
    getUniquePlays,
    generatePackingListFromSchedule,
    RISK_STATUS,
    RISK_TYPE_LABELS,
    updateRiskProcessingStatus,
    compute30DayRisks,
    getRiskStats
  } from '$lib/scheduleStore.js';

  export let schedules = [];
  export let costumes = [];
  export let reservations = [];
  export let workOrders = [];
  export let packingLists = [];
  export let actors = [];

  const dispatch = createEventDispatcher();

  const now = new Date();
  const iso = (offset = 0) => {
    const d = new Date(now);
    d.setDate(d.getDate() + offset);
    return d.toISOString().slice(0, 10);
  };

  let playFilter = '全部剧目';
  let scheduleQuery = '';
  let showAddModal = false;
  let showDetailModal = false;
  let editingScheduleId = null;
  let selectedScheduleId = null;
  let expandedDate = '';
  let showRiskDetail = false;
  let riskDate = '';
  let showRiskStatusMenu = null;

  let scheduleForm = {
    play: '',
    date: iso(1),
    time: '',
    venue: '',
    status: '待确认',
    note: '',
    linkedCostumeIds: []
  };

  $: allRisks = compute30DayRisks(costumes, reservations, workOrders, packingLists);
  $: riskStats = getRiskStats(allRisks);

  function getRiskStatusBadgeClass(status) {
    if (status === RISK_STATUS.PENDING) return 'sk-risk-status-pending';
    if (status === RISK_STATUS.CONFIRMED) return 'sk-risk-status-confirmed';
    if (status === RISK_STATUS.DEFERRED) return 'sk-risk-status-deferred';
    if (status === RISK_STATUS.RESOLVED) return 'sk-risk-status-resolved';
    return '';
  }

  function handleRiskStatusChange(riskKey, newStatus) {
    updateRiskProcessingStatus(riskKey, newStatus);
    dispatch('change');
    showRiskStatusMenu = null;
  }

  $: plays = ['全部剧目', ...new Set([
    ...schedules.map((s) => s.play).filter(Boolean),
    ...costumes.map((c) => c.play).filter(Boolean)
  ])];

  $: filteredSchedules = schedules.filter((s) => {
    const text = `${s.play}${s.date}${s.time}${s.venue}${s.note}`;
    const matchesQuery = text.includes(scheduleQuery.trim());
    const matchesPlay = playFilter === '全部剧目' || s.play === playFilter;
    return matchesQuery && matchesPlay;
  }).sort((a, b) => {
    const dateComp = a.date.localeCompare(b.date);
    if (dateComp !== 0) return dateComp;
    return (a.time || '').localeCompare(b.time || '');
  });

  $: groupedByDate = (() => {
    const groups = {};
    for (const s of filteredSchedules) {
      if (!groups[s.date]) groups[s.date] = [];
      groups[s.date].push(s);
    }
    return groups;
  })();

  $: dates = Object.keys(groupedByDate).sort();

  $: selectedSchedule = schedules.find((s) => s.id === selectedScheduleId);

  $: selectedRiskSummary = riskDate ? computeDailyRisk(riskDate, costumes, reservations, workOrders, packingLists) : [];

  function openAddModal() {
    editingScheduleId = null;
    scheduleForm = {
      play: '',
      date: iso(1),
      time: '19:30',
      venue: '',
      status: '待确认',
      note: '',
      linkedCostumeIds: []
    };
    showAddModal = true;
  }

  function openEditModal(id) {
    const s = schedules.find((sch) => sch.id === id);
    if (!s) return;
    editingScheduleId = id;
    scheduleForm = {
      play: s.play || '',
      date: s.date || iso(1),
      time: s.time || '',
      venue: s.venue || '',
      status: s.status || '待确认',
      note: s.note || '',
      linkedCostumeIds: s.linkedCostumeIds || []
    };
    showAddModal = true;
  }

  function closeAddModal() {
    showAddModal = false;
    editingScheduleId = null;
  }

  function saveScheduleForm() {
    if (!scheduleForm.play.trim() || !scheduleForm.date) return;

    const linkedIds = autoLinkCostumes(
      { play: scheduleForm.play, date: scheduleForm.date, linkedCostumeIds: scheduleForm.linkedCostumeIds },
      costumes,
      reservations,
      packingLists
    );
    scheduleForm.linkedCostumeIds = linkedIds;

    if (editingScheduleId) {
      updateSchedule(editingScheduleId, scheduleForm);
    } else {
      addSchedule(scheduleForm);
    }

    schedules = schedules;
    dispatch('change');
    closeAddModal();
  }

  function confirmDeleteSchedule(id) {
    const s = schedules.find((sch) => sch.id === id);
    if (!s) return;
    if (!confirm(`确定要删除「${s.play}」${s.date}的排期吗？`)) return;
    deleteSchedule(id);
    dispatch('change');
    if (selectedScheduleId === id) {
      selectedScheduleId = null;
      showDetailModal = false;
    }
  }

  function openDetail(id) {
    selectedScheduleId = id;
    showDetailModal = true;
  }

  function closeDetail() {
    showDetailModal = false;
    selectedScheduleId = null;
  }

  function openRiskSummary(date) {
    riskDate = date;
    showRiskDetail = true;
  }

  function closeRiskSummary() {
    showRiskDetail = false;
    riskDate = '';
  }

  function toggleDateExpand(date) {
    expandedDate = expandedDate === date ? '' : date;
  }

  function formatDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr + 'T00:00:00');
    const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    return `${dateStr} ${weekdays[d.getDay()]}`;
  }

  function getStatusClass(status) {
    if (status === '已确认') return 'sk-status-confirmed';
    if (status === '待确认') return 'sk-status-pending';
    if (status === '已取消') return 'sk-status-cancelled';
    if (status === '已完成') return 'sk-status-done';
    return 'sk-status-pending';
  }

  function getDateRiskLevel(date) {
    const risks = computeDailyRisk(date, costumes, reservations, workOrders, packingLists);
    let high = 0, medium = 0;
    for (const r of risks) {
      high += r.highCount;
      medium += r.mediumCount;
    }
    if (high > 0) return 'high';
    if (medium > 0) return 'medium';
    return 'low';
  }

  function getLinkedCostumeDetails(linkedCostumeIds) {
    return costumes.filter((c) => (linkedCostumeIds || []).includes(c.id));
  }

  const sizeOrder = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'];

  function parseSize(sizeStr) {
    if (!sizeStr) return null;
    const s = sizeStr.trim().toUpperCase();
    const idx = sizeOrder.indexOf(s);
    if (idx >= 0) return idx;
    const numMatch = s.match(/(\d+)/);
    if (numMatch) {
      const num = parseInt(numMatch[1]);
      if (num >= 150 && num <= 200) return Math.round((num - 150) / 10);
    }
    return null;
  }

  function matchSize(costumeSize, actorSize) {
    const c = parseSize(costumeSize);
    const a = parseSize(actorSize);
    if (c === null || a === null) return { level: 'unknown', label: '尺码信息不全', diff: 0 };
    const diff = c - a;
    if (diff === 0) return { level: 'perfect', label: '尺码完全匹配', diff: 0 };
    if (Math.abs(diff) === 1) return { level: diff > 0 ? 'loose' : 'tight', label: diff > 0 ? '服装稍大' : '服装稍小', diff };
    return { level: 'mismatch', label: diff > 0 ? '服装过大' : '服装过小', diff };
  }

  function findActorByName(name) {
    if (!name || !name.trim()) return null;
    const trimmed = name.trim();
    return actors.find((a) => a.name === trimmed) || null;
  }

  function getActorsForCostumeAndDate(costumeId, date) {
    const dayReservations = reservations.filter(
      (r) => r.costumeId === costumeId && r.date === date && r.status === 'active' && r.type === '演员'
    );
    const result = [];
    for (const r of dayReservations) {
      const actor = findActorByName(r.reservedFor);
      result.push({
        reservation: r,
        actor,
        sizeMatch: actor ? matchSize(costumes.find((c) => c.id === costumeId)?.size, actor.size) : null
      });
    }
    return result;
  }

  function getMatchBadgeClass(level) {
    if (level === 'perfect') return 'match-perfect';
    if (level === 'loose' || level === 'tight') return 'match-close';
    if (level === 'mismatch') return 'match-mismatch';
    return 'match-unknown';
  }

  function addCostumeLink(costumeId) {
    if (!scheduleForm.linkedCostumeIds.includes(costumeId)) {
      scheduleForm.linkedCostumeIds = [...scheduleForm.linkedCostumeIds, costumeId];
    }
  }

  function removeCostumeLink(costumeId) {
    scheduleForm.linkedCostumeIds = scheduleForm.linkedCostumeIds.filter((id) => id !== costumeId);
  }

  $: availableCostumesToLink = costumes.filter((c) => {
    if (playFilter !== '全部剧目' && c.play !== playFilter) return false;
    const text = `${c.name}${c.size}${c.play}${c.location}`;
    return !scheduleForm.linkedCostumeIds.includes(c.id);
  });

  $: detailLinkedCostumes = selectedSchedule ? getLinkedCostumeDetails(selectedSchedule.linkedCostumeIds) : [];
  $: detailScheduleRisk = selectedSchedule
    ? computeDailyRisk(selectedSchedule.date, costumes, reservations, workOrders, packingLists).find((r) => r.schedule.id === selectedSchedule.id)
    : null;

  function handleGeneratePackingList(schedule) {
    const draft = generatePackingListFromSchedule(schedule, costumes, reservations, workOrders);
    dispatch('generate-packing-list', draft);
  }

  function handleKeydown(e) {
    if (e.key === 'Escape') {
      if (showRiskDetail) closeRiskSummary();
      else if (showDetailModal) closeDetail();
      else if (showAddModal) closeAddModal();
    }
  }
</script>

<svelte:window on:keydown={handleKeydown} />

<div class="sk-container">
  <div class="sk-header">
    <h2><CalendarDays size={18} />演出排期看板</h2>
    <div style="display: flex; gap: 10px; align-items: center;">
      <span class="sk-count">共 {filteredSchedules.length} 条排期</span>
      <button type="button" class="sk-btn" on:click={openAddModal}>
        <Plus size={14} />新增排期
      </button>
    </div>
  </div>

  <div class="sk-risk-summary">
    <div class="sk-risk-summary-title">
      <AlertTriangle size={16} />未来 30 天风险摘要
    </div>
    <div class="sk-risk-summary-grid">
      <div class="sk-risk-stat sk-risk-stat-high">
        <AlertOctagon size={18} />
        <div>
          <div class="sk-risk-stat-num">{riskStats.high}</div>
          <div class="sk-risk-stat-label">高风险</div>
        </div>
      </div>
      <div class="sk-risk-stat sk-risk-stat-medium">
        <AlertTriangle size={18} />
        <div>
          <div class="sk-risk-stat-num">{riskStats.medium}</div>
          <div class="sk-risk-stat-label">中风险</div>
        </div>
      </div>
      <div class="sk-risk-stat sk-risk-stat-low">
        <Clock size={18} />
        <div>
          <div class="sk-risk-stat-num">{riskStats.low}</div>
          <div class="sk-risk-stat-label">低风险</div>
        </div>
      </div>
      <div class="sk-risk-stat sk-risk-stat-pending">
        <Clock size={18} />
        <div>
          <div class="sk-risk-stat-num">{riskStats.pending}</div>
          <div class="sk-risk-stat-label">待处理</div>
        </div>
      </div>
      <div class="sk-risk-stat sk-risk-stat-confirmed">
        <CheckCircle size={18} />
        <div>
          <div class="sk-risk-stat-num">{riskStats.confirmed}</div>
          <div class="sk-risk-stat-label">已确认</div>
        </div>
      </div>
      <div class="sk-risk-stat sk-risk-stat-resolved">
        <CheckCircle2 size={18} />
        <div>
          <div class="sk-risk-stat-num">{riskStats.resolved}</div>
          <div class="sk-risk-stat-label">已解决</div>
        </div>
      </div>
    </div>
  </div>

  <div class="sk-toolbar">
    <label class="sk-search-label">
      <Search size={16} />
      <input bind:value={scheduleQuery} placeholder="搜索剧目/日期/场地" />
    </label>
    <select bind:value={playFilter}>
      {#each plays as play}
        <option>{play}</option>
      {/each}
    </select>
  </div>

  {#if dates.length === 0}
    <div class="sk-empty">
      <CalendarDays size={32} />
      <p>暂无排期</p>
      <span>点击「新增排期」添加演出安排</span>
    </div>
  {:else}
    <div class="sk-timeline">
      {#each dates as date}
        {@const daySchedules = groupedByDate[date]}
        {@const riskLevel = getDateRiskLevel(date)}
        {@const isExpanded = expandedDate === date || dates.length <= 5}
        {@const isPast = date < iso(0)}
        <div class="sk-date-group" class:sk-date-past={isPast}>
          <div class="sk-date-header" class:sk-risk-high={riskLevel === 'high'} class:sk-risk-medium={riskLevel === 'medium'} class:sk-risk-low={riskLevel === 'low'}>
            <div class="sk-date-left">
              <button type="button" class="sk-expand-btn" on:click={() => toggleDateExpand(date)}>
                {#if isExpanded}<ChevronUp size={16} />{:else}<ChevronDown size={16} />{/if}
              </button>
              <strong class="sk-date-text">{formatDate(date)}</strong>
              <span class="sk-day-count">{daySchedules.length}场</span>
              {#if riskLevel === 'high'}
                <span class="sk-risk-badge sk-risk-badge-high"><AlertOctagon size={12} />高风险</span>
              {:else if riskLevel === 'medium'}
                <span class="sk-risk-badge sk-risk-badge-medium"><AlertTriangle size={12} />注意</span>
              {:else}
                <span class="sk-risk-badge sk-risk-badge-low"><CheckCircle size={12} />正常</span>
              {/if}
            </div>
            <button type="button" class="sk-link-btn" on:click={() => openRiskSummary(date)}>
              <Eye size={14} />风险摘要
            </button>
          </div>

          {#if isExpanded}
            <div class="sk-day-schedules">
              {#each daySchedules as schedule}
                {@const linkedDetails = getLinkedCostumeDetails(schedule.linkedCostumeIds)}
                {@const dayRisks = computeDailyRisk(date, costumes, reservations, workOrders, packingLists)}
                {@const scheduleRisk = dayRisks.find((r) => r.schedule.id === schedule.id)}
                <div class="sk-card" class:sk-card-high={scheduleRisk && scheduleRisk.highCount > 0} class:sk-card-medium={scheduleRisk && scheduleRisk.highCount === 0 && scheduleRisk.mediumCount > 0}>
                  <div class="sk-card-top">
                    <div class="sk-card-info">
                      <div class="sk-card-title-row">
                        <strong class="sk-play-name">{schedule.play}</strong>
                        <span class="sk-status-badge {getStatusClass(schedule.status)}">{schedule.status}</span>
                      </div>
                      <div class="sk-card-meta">
                        {#if schedule.time}<span><Clock size={12} />{schedule.time}</span>{/if}
                        {#if schedule.venue}<span>{schedule.venue}</span>{/if}
                      </div>
                      {#if schedule.note}
                        <p class="sk-card-note">{schedule.note}</p>
                      {/if}
                    </div>
                    <div class="sk-card-actions">
                      <button type="button" class="sk-icon-btn" on:click={() => openDetail(schedule.id)} aria-label="查看详情"><Eye size={16} /></button>
                    </div>
                  </div>

                  {#if linkedDetails.length > 0}
                    <div class="sk-linked">
                      <div class="sk-linked-title"><Link2 size={12} />关联服装 ({linkedDetails.length})</div>
                      <div class="sk-linked-list">
                        {#each linkedDetails as costume}
                          <span class="sk-costume-tag" class:sk-costume-borrowed={costume.status === '借出'} class:sk-costume-overdue={costume.status === '借出' && costume.due && costume.due < iso(0)} class:sk-costume-cleaning={costume.clean === '待清洗'} class:sk-costume-repair={costume.clean === '维修中'}>
                            <Shirt size={10} />{costume.name}
                            {#if costume.status === '借出'}<Clock size={10} />
                            {:else if costume.clean === '待清洗'}<Droplets size={10} />
                            {:else if costume.clean === '维修中'}<Wrench size={10} />
                            {/if}
                          </span>
                        {/each}
                      </div>
                    </div>
                  {/if}

                  {#if scheduleRisk && scheduleRisk.risks.length > 0}
                    <div class="sk-risk-list">
                      {#each scheduleRisk.risks.slice(0, 3) as risk (risk.riskKey)}
                        <div class="sk-risk-item sk-risk-item-{risk.level}" class:sk-risk-item-resolved={risk.processingStatus === RISK_STATUS.RESOLVED}>
                          <div class="sk-risk-item-main">
                            {#if risk.level === 'high'}<AlertOctagon size={12} />
                            {:else if risk.level === 'medium'}<AlertTriangle size={12} />
                            {:else}<Clock size={12} />{/if}
                            <span>{risk.message}</span>
                          </div>
                          <span class="sk-risk-status-badge {getRiskStatusBadgeClass(risk.processingStatus)}">
                            {risk.processingStatus}
                          </span>
                        </div>
                      {/each}
                      {#if scheduleRisk.risks.length > 3}
                        <button type="button" class="sk-more-risk" on:click={() => openRiskSummary(date)}>
                          +{scheduleRisk.risks.length - 3}项更多风险
                        </button>
                      {/if}
                    </div>
                  {/if}

                  <div class="sk-card-footer">
                    <button type="button" class="sk-sm-btn sk-sm-btn-primary" on:click={() => handleGeneratePackingList(schedule)}>
                      <Package size={12} />生成装箱单
                    </button>
                    <button type="button" class="sk-sm-btn" on:click={() => openEditModal(schedule.id)}>
                      <Save size={12} />编辑
                    </button>
                    <button type="button" class="sk-sm-btn sk-sm-btn-danger" on:click={() => confirmDeleteSchedule(schedule.id)}>
                      <Trash2 size={12} />删除
                    </button>
                  </div>
                </div>
              {/each}
            </div>
          {/if}
        </div>
      {/each}
    </div>
  {/if}
</div>

{#if showAddModal}
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
  <div class="sk-modal-overlay" role="presentation" on:click={closeAddModal}>
    <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
    <div class="sk-modal" role="dialog" aria-modal="true" on:click|stopPropagation on:keydown={handleKeydown} tabindex="-1">
      <div class="sk-modal-header">
        <h2>{editingScheduleId ? '编辑排期' : '新增排期'}</h2>
        <button type="button" class="sk-icon-btn" on:click={closeAddModal} aria-label="关闭"><X size={20} /></button>
      </div>
      <form class="sk-modal-form" on:submit|preventDefault={saveScheduleForm}>
        <div class="sk-split">
          <label>
            <span>剧目名称</span>
            <input bind:value={scheduleForm.play} placeholder="请输入剧目" required />
          </label>
          <label>
            <span>演出日期</span>
            <input type="date" bind:value={scheduleForm.date} required />
          </label>
        </div>
        <div class="sk-split">
          <label>
            <span>演出时间</span>
            <input type="time" bind:value={scheduleForm.time} placeholder="如 19:30" />
          </label>
          <label>
            <span>演出场地</span>
            <input bind:value={scheduleForm.venue} placeholder="如 主剧场" />
          </label>
        </div>
        <label>
          <span>状态</span>
          <select bind:value={scheduleForm.status}>
            <option>待确认</option>
            <option>已确认</option>
            <option>已取消</option>
            <option>已完成</option>
          </select>
        </label>
        <label>
          <span>备注</span>
          <input bind:value={scheduleForm.note} placeholder="选填" />
        </label>

        <div class="sk-linked-section">
          <div class="sk-linked-section-title">
            <strong><Link2 size={14} />关联服装（{scheduleForm.linkedCostumeIds.length}件）</strong>
            <button type="button" class="sk-sm-btn" on:click={() => {
              const linkedIds = autoLinkCostumes(
                { play: scheduleForm.play, date: scheduleForm.date, linkedCostumeIds: scheduleForm.linkedCostumeIds },
                costumes, reservations, packingLists
              );
              scheduleForm.linkedCostumeIds = linkedIds;
            }}>自动关联</button>
          </div>
          {#if scheduleForm.linkedCostumeIds.length > 0}
            <div class="sk-linked-costume-list">
              {#each getLinkedCostumeDetails(scheduleForm.linkedCostumeIds) as costume}
                {@const costumeActors = getActorsForCostumeAndDate(costume.id, scheduleForm.date)}
                <div class="sk-linked-costume-item">
                  <div class="sk-linked-costume-main">
                    <span class="sk-linked-costume-name"><Shirt size={10} />{costume.name}</span>
                    <span class="sk-linked-costume-size">{costume.size || '未填尺码'}</span>
                  </div>
                  {#if costumeActors.length > 0}
                    <div class="sk-linked-costume-actors">
                      {#each costumeActors as ca}
                        <span class="sk-mini-actor">
                          {ca.actor?.name || ca.reservation.reservedFor}
                          {#if ca.sizeMatch}
                            <span class="sk-mini-size-badge {getMatchBadgeClass(ca.sizeMatch.level)}">{ca.sizeMatch.label}</span>
                          {/if}
                        </span>
                      {/each}
                    </div>
                  {/if}
                  <button type="button" class="sk-remove-costume-btn" on:click={() => removeCostumeLink(costume.id)} aria-label="移除">
                    <X size={12} />
                  </button>
                </div>
              {/each}
            </div>
          {:else}
            <p class="sk-hint">点击「自动关联」从预约和装箱单中匹配服装</p>
          {/if}
        </div>

        <div class="sk-costume-pick">
          <div class="sk-linked-section-title">
            <strong>手动添加服装</strong>
          </div>
          <div class="sk-pick-list">
            {#each availableCostumesToLink.slice(0, 20) as costume}
              {@const costumeActors = getActorsForCostumeAndDate(costume.id, scheduleForm.date)}
              <button type="button" class="sk-pick-card" on:click={() => addCostumeLink(costume.id)}>
                <div class="sk-pick-card-main">
                  <strong>{costume.name}</strong>
                  <span>{costume.play} · {costume.size || '未填'}</span>
                </div>
                {#if costumeActors.length > 0}
                  <div class="sk-pick-card-actors">
                    {#each costumeActors.slice(0, 2) as ca}
                      <span class="sk-mini-actor">
                        {ca.actor?.name || ca.reservation.reservedFor}
                        {#if ca.sizeMatch}
                          <span class="sk-mini-size-badge {getMatchBadgeClass(ca.sizeMatch.level)}">{ca.sizeMatch.label}</span>
                        {/if}
                      </span>
                    {/each}
                  </div>
                {/if}
                <Plus size={14} class="sk-pick-add" />
              </button>
            {/each}
            {#if availableCostumesToLink.length === 0}
              <p class="sk-hint">无可添加的服装</p>
            {/if}
          </div>
        </div>

        <div class="sk-modal-actions">
          <button type="button" class="sk-btn-secondary" on:click={closeAddModal}>取消</button>
          <button type="submit" disabled={!scheduleForm.play.trim() || !scheduleForm.date}>
            <Save size={16} />{editingScheduleId ? '保存修改' : '创建排期'}
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}

{#if showDetailModal && selectedSchedule}
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
  <div class="sk-modal-overlay" role="presentation" on:click={closeDetail}>
    <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
    <div class="sk-modal" role="dialog" aria-modal="true" on:click|stopPropagation on:keydown={handleKeydown} tabindex="-1">
      <div class="sk-modal-header">
        <h2>排期详情</h2>
        <button type="button" class="sk-icon-btn" on:click={closeDetail} aria-label="关闭"><X size={20} /></button>
      </div>
      <div class="sk-detail-body">
        <div class="sk-detail-section">
          <div class="sk-info-row"><span>剧目</span><strong>{selectedSchedule.play}</strong></div>
          <div class="sk-info-row"><span>日期</span><strong>{formatDate(selectedSchedule.date)}</strong></div>
          <div class="sk-info-row"><span>时间</span><strong>{selectedSchedule.time || '未设定'}</strong></div>
          <div class="sk-info-row"><span>场地</span><strong>{selectedSchedule.venue || '未设定'}</strong></div>
          <div class="sk-info-row"><span>状态</span><strong class="{getStatusClass(selectedSchedule.status)}">{selectedSchedule.status}</strong></div>
          {#if selectedSchedule.note}
            <div class="sk-info-row"><span>备注</span><strong>{selectedSchedule.note}</strong></div>
          {/if}
        </div>

        {#if detailLinkedCostumes.length > 0}
          <div class="sk-detail-section">
            <h3><Link2 size={14} />关联服装 ({detailLinkedCostumes.length})</h3>
            <div class="sk-detail-costumes">
              {#each detailLinkedCostumes as costume}
                {@const costumeActors = getActorsForCostumeAndDate(costume.id, selectedSchedule.date)}
                <div class="sk-detail-costume-row" class:sk-costume-borrowed={costume.status === '借出'} class:sk-costume-overdue={costume.status === '借出' && costume.due && costume.due < iso(0)}>
                  <div class="sk-costume-main-info">
                    <strong>{costume.name}</strong>
                    <span>{costume.play} · {costume.size || '未填'}</span>
                    {#if costumeActors.length > 0}
                      <div class="sk-costume-actors">
                        {#each costumeActors as ca}
                          <div class="sk-costume-actor-item">
                            <span class="sk-actor-name">{ca.actor?.name || ca.reservation.reservedFor}</span>
                            {#if ca.sizeMatch}
                              <span class="sk-size-badge {getMatchBadgeClass(ca.sizeMatch.level)}">{ca.sizeMatch.label}</span>
                            {/if}
                          </div>
                        {/each}
                      </div>
                    {/if}
                  </div>
                  <div class="sk-costume-status">
                    {#if costume.status === '借出'}
                      <span class="sk-status-chip sk-chip-borrowed"><Clock size={11} />借出{#if costume.due}至{costume.due}{/if}</span>
                    {:else}
                      <span class="sk-status-chip sk-chip-instock">在库</span>
                    {/if}
                    {#if costume.clean === '待清洗'}
                      <span class="sk-status-chip sk-chip-cleaning"><Droplets size={11} />待清洗</span>
                    {:else if costume.clean === '维修中'}
                      <span class="sk-status-chip sk-chip-repair"><Wrench size={11} />维修中</span>
                    {/if}
                  </div>
                </div>
              {/each}
            </div>
          </div>
        {/if}

        {#if detailScheduleRisk && detailScheduleRisk.risks.length > 0}
          <div class="sk-detail-section">
            <h3><AlertTriangle size={14} />风险提示 ({detailScheduleRisk.risks.length})</h3>
            <div class="sk-detail-risks">
              {#each detailScheduleRisk.risks as risk (risk.riskKey)}
                <div class="sk-risk-item sk-risk-item-{risk.level}" class:sk-risk-item-resolved={risk.processingStatus === RISK_STATUS.RESOLVED}>
                  <div class="sk-risk-item-main">
                    {#if risk.level === 'high'}<AlertOctagon size={13} />
                    {:else if risk.level === 'medium'}<AlertTriangle size={13} />
                    {:else}<Clock size={13} />{/if}
                    <span>{risk.message}</span>
                  </div>
                  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
                  <div class="sk-risk-status-menu" role="presentation" on:click|stopPropagation>
                    <button
                      type="button"
                      class="sk-risk-status-btn {getRiskStatusBadgeClass(risk.processingStatus)}"
                      on:click={() => showRiskStatusMenu = showRiskStatusMenu === risk.riskKey ? null : risk.riskKey}
                    >
                      {risk.processingStatus}
                      <ChevronDown size={10} />
                    </button>
                    {#if showRiskStatusMenu === risk.riskKey}
                      <div class="sk-risk-status-dropdown">
                        {#each [RISK_STATUS.PENDING, RISK_STATUS.CONFIRMED, RISK_STATUS.DEFERRED, RISK_STATUS.RESOLVED] as s}
                          <button
                            type="button"
                            class="sk-risk-dropdown-item"
                            class:sk-risk-dropdown-active={risk.processingStatus === s}
                            on:click={() => handleRiskStatusChange(risk.riskKey, s)}
                          >
                            {s}
                          </button>
                        {/each}
                      </div>
                    {/if}
                  </div>
                </div>
              {/each}
            </div>
          </div>
        {:else}
          <div class="sk-detail-section">
            <h3><CheckCircle size={14} />风险提示</h3>
            <p class="sk-hint">当前无风险提示</p>
          </div>
        {/if}

        <div class="sk-modal-actions">
          <button type="button" class="sk-btn-primary" on:click={() => { handleGeneratePackingList(selectedSchedule); closeDetail(); }}>
            <Package size={16} />生成装箱单
          </button>
          <button type="button" class="sk-btn-secondary" on:click={() => { closeDetail(); openEditModal(selectedSchedule.id); }}>
            <Save size={16} />编辑
          </button>
          <button type="button" on:click={closeDetail}>关闭</button>
        </div>
      </div>
    </div>
  </div>
{/if}

{#if showRiskDetail && riskDate}
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
  <div class="sk-modal-overlay" role="presentation" on:click={closeRiskSummary}>
    <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
    <div class="sk-modal sk-modal-wide" role="dialog" aria-modal="true" on:click|stopPropagation on:keydown={handleKeydown} tabindex="-1">
      <div class="sk-modal-header">
        <h2><AlertTriangle size={18} />{formatDate(riskDate)} 风险摘要</h2>
        <button type="button" class="sk-icon-btn" on:click={closeRiskSummary} aria-label="关闭"><X size={20} /></button>
      </div>
      <div class="sk-detail-body">
        {#if selectedRiskSummary.length === 0}
          <p class="sk-hint">当日无排期，无风险数据</p>
        {:else}
          {#each selectedRiskSummary as item}
            <div class="sk-risk-schedule-group">
              <div class="sk-risk-schedule-header">
                <strong>{item.schedule.play}</strong>
                <span>{item.schedule.time || ''} {item.schedule.venue || ''}</span>
                <span class="sk-status-badge {getStatusClass(item.schedule.status)}">{item.schedule.status}</span>
              </div>
              {#if item.resolvedCount > 0 || item.deferredCount > 0 || item.confirmedCount > 0}
                <div class="sk-risk-status-summary">
                  {#if item.pendingCount > 0}
                    <span class="sk-risk-status-tag sk-risk-status-pending">{RISK_STATUS.PENDING}: {item.pendingCount || 0}</span>
                  {/if}
                  {#if item.confirmedCount > 0}
                    <span class="sk-risk-status-tag sk-risk-status-confirmed">{RISK_STATUS.CONFIRMED}: {item.confirmedCount}</span>
                  {/if}
                  {#if item.deferredCount > 0}
                    <span class="sk-risk-status-tag sk-risk-status-deferred">{RISK_STATUS.DEFERRED}: {item.deferredCount}</span>
                  {/if}
                  {#if item.resolvedCount > 0}
                    <span class="sk-risk-status-tag sk-risk-status-resolved">{RISK_STATUS.RESOLVED}: {item.resolvedCount}</span>
                  {/if}
                </div>
              {/if}
              {#if item.risks.length > 0}
                <div class="sk-detail-risks">
                  {#each item.risks as risk (risk.riskKey)}
                    <div class="sk-risk-item sk-risk-item-{risk.level}" class:sk-risk-item-resolved={risk.processingStatus === RISK_STATUS.RESOLVED}>
                      <div class="sk-risk-item-main">
                        {#if risk.level === 'high'}<AlertOctagon size={13} />
                        {:else if risk.level === 'medium'}<AlertTriangle size={13} />
                        {:else}<Clock size={13} />{/if}
                        <span>{risk.message}</span>
                      </div>
                      <span class="sk-risk-status-badge {getRiskStatusBadgeClass(risk.processingStatus)}">
                        {risk.processingStatus}
                      </span>
                    </div>
                  {/each}
                </div>
              {:else}
                <p class="sk-hint">无风险</p>
              {/if}
            </div>
          {/each}
        {/if}

        <div class="sk-modal-actions">
          <button type="button" on:click={closeRiskSummary}>关闭</button>
        </div>
      </div>
    </div>
  </div>
{/if}

<style>
  .sk-container {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }
  .sk-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .sk-risk-summary {
    background: #fffaf5;
    border: 1px solid #eadfd4;
    border-radius: 10px;
    padding: 14px;
  }
  .sk-risk-summary-title {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 14px;
    font-weight: 600;
    color: #603d2d;
    margin-bottom: 10px;
  }
  .sk-risk-summary-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(110px, 1fr));
    gap: 8px;
  }
  .sk-risk-stat {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 12px;
    background: #fff;
    border-radius: 8px;
    border: 1px solid #eadfd4;
  }
  .sk-risk-stat-high { color: #b84a3b; border-left: 3px solid #b84a3b; }
  .sk-risk-stat-medium { color: #c9a040; border-left: 3px solid #c9a040; }
  .sk-risk-stat-low { color: #8a9a8a; border-left: 3px solid #8a9a8a; }
  .sk-risk-stat-pending { color: #c9a040; border-left: 3px solid #c9a040; }
  .sk-risk-stat-confirmed { color: #4a6b8a; border-left: 3px solid #4a6b8a; }
  .sk-risk-stat-resolved { color: #4a8a4a; border-left: 3px solid #4a8a4a; }
  .sk-risk-stat-num {
    font-size: 20px;
    font-weight: 600;
    line-height: 1;
  }
  .sk-risk-stat-label {
    font-size: 11px;
    color: #8a7665;
    margin-top: 2px;
  }

  .sk-risk-item-main {
    display: flex;
    align-items: flex-start;
    gap: 6px;
    flex: 1;
    min-width: 0;
  }
  .sk-risk-item-resolved {
    opacity: 0.5;
  }
  .sk-risk-status-badge {
    font-size: 10px;
    padding: 2px 6px;
    border-radius: 4px;
    font-weight: 500;
    flex-shrink: 0;
  }
  .sk-risk-status-pending { background: #fff4e6; color: #8a5a1a; }
  .sk-risk-status-confirmed { background: #e6eef6; color: #1a4a8a; }
  .sk-risk-status-deferred { background: #f0e6dc; color: #6b5a4d; }
  .sk-risk-status-resolved { background: #e6f0e6; color: #2d5a2d; }

  .sk-risk-status-menu {
    position: relative;
  }
  .sk-risk-status-btn {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 11px;
    padding: 3px 8px;
    border-radius: 4px;
    font-weight: 500;
    border: 1px solid transparent;
    cursor: pointer;
    font: inherit;
    background: transparent;
  }
  .sk-risk-status-btn:hover { filter: brightness(0.95); }
  .sk-risk-status-dropdown {
    position: absolute;
    top: calc(100% + 4px);
    right: 0;
    background: #fff;
    border: 1px solid #d8c8ba;
    border-radius: 6px;
    box-shadow: 0 4px 12px rgb(38 33 28 / .15);
    z-index: 10;
    min-width: 100px;
    overflow: hidden;
  }
  .sk-risk-dropdown-item {
    display: block;
    width: 100%;
    padding: 8px 12px;
    border: 0;
    background: transparent;
    cursor: pointer;
    font: inherit;
    font-size: 12px;
    color: #3b2f26;
    text-align: left;
    transition: background .15s;
  }
  .sk-risk-dropdown-item:hover { background: #f0e6dc; }
  .sk-risk-dropdown-active { background: #faf6f2; font-weight: 500; }

  .sk-risk-status-summary {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
    margin-bottom: 8px;
  }
  .sk-risk-status-tag {
    font-size: 11px;
    padding: 2px 8px;
    border-radius: 4px;
    font-weight: 500;
  }
  .sk-header h2 {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 0;
    font-size: 18px;
  }
  .sk-count {
    font-size: 13px;
    color: #8a7665;
  }
  .sk-btn {
    border: 0;
    border-radius: 8px;
    padding: 8px 13px;
    background: #603d2d;
    color: #fff;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 7px;
    font: inherit;
    font-size: 13px;
  }
  .sk-btn:hover { background: #4e3225; }
  .sk-btn-secondary {
    border: 0;
    border-radius: 8px;
    padding: 8px 13px;
    background: #efe4d9;
    color: #37261d;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 7px;
    font: inherit;
    font-size: 13px;
  }
  .sk-btn-primary {
    border: 0;
    border-radius: 8px;
    padding: 8px 13px;
    background: #603d2d;
    color: #fff;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 7px;
    font: inherit;
    font-size: 13px;
  }
  .sk-btn-primary:hover { background: #4e3225; }
  .sk-toolbar {
    display: grid;
    grid-template-columns: 1fr 160px;
    gap: 10px;
    align-items: center;
  }
  .sk-search-label {
    display: flex;
    align-items: center;
    gap: 8px;
    border: 1px solid #d8c8ba;
    border-radius: 8px;
    padding: 0 10px;
    background: #fff;
  }
  .sk-search-label input {
    border: 0;
    padding-left: 0;
    width: 100%;
    font: inherit;
    background: transparent;
  }
  .sk-toolbar select {
    width: 100%;
    border: 1px solid #d8c8ba;
    border-radius: 8px;
    padding: 11px 12px;
    background: #fff;
    color: #26211c;
    font: inherit;
  }
  .sk-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    padding: 40px 20px;
    color: #8a7665;
  }
  .sk-empty p { margin: 0; font-size: 15px; color: #6b5a4d; }
  .sk-empty span { font-size: 13px; }

  .sk-timeline {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .sk-date-group {
    border: 1px solid #eadfd4;
    border-radius: 8px;
    overflow: hidden;
    background: #fffaf5;
  }
  .sk-date-past { opacity: 0.65; }
  .sk-date-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 16px;
    border-bottom: 1px solid #f0e6dc;
    background: #faf6f2;
  }
  .sk-date-header.sk-risk-high { border-left: 3px solid #b84a3b; background: #fff5ef; }
  .sk-date-header.sk-risk-medium { border-left: 3px solid #c9a040; background: #fffbf0; }
  .sk-date-header.sk-risk-low { border-left: 3px solid #4a8a4a; background: #f6faf6; }
  .sk-date-left {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
  }
  .sk-expand-btn {
    background: transparent;
    border: 0;
    padding: 4px;
    cursor: pointer;
    color: #6b5a4d;
    border-radius: 4px;
    display: flex;
    align-items: center;
  }
  .sk-expand-btn:hover { background: #f0e6dc; }
  .sk-date-text { font-size: 15px; color: #26211c; }
  .sk-day-count {
    font-size: 12px;
    color: #8a7665;
    background: #f0e6dc;
    padding: 2px 8px;
    border-radius: 4px;
  }
  .sk-risk-badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 12px;
    font-weight: 500;
    padding: 2px 8px;
    border-radius: 4px;
  }
  .sk-risk-badge-high { background: #fdecea; color: #8a2d2d; }
  .sk-risk-badge-medium { background: #fff4e6; color: #8a5a1a; }
  .sk-risk-badge-low { background: #e6f0e6; color: #2d5a2d; }
  .sk-link-btn {
    background: transparent;
    border: 1px solid #d8c8ba;
    border-radius: 6px;
    padding: 5px 10px;
    cursor: pointer;
    color: #4a3b30;
    display: inline-flex;
    align-items: center;
    gap: 5px;
    font: inherit;
    font-size: 12px;
  }
  .sk-link-btn:hover { background: #f0e6dc; }

  .sk-day-schedules {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 12px 16px;
  }
  .sk-card {
    border: 1px solid #eadfd4;
    border-radius: 8px;
    padding: 14px;
    background: #fff;
    transition: transform .15s ease, box-shadow .15s ease;
  }
  .sk-card:hover { transform: translateY(-1px); box-shadow: 0 4px 12px rgb(62 42 24 / .08); }
  .sk-card-high { border-color: #d98664; background: #fff8f5; }
  .sk-card-medium { border-color: #c9a67e; background: #fffbf5; }
  .sk-card-top {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 10px;
  }
  .sk-card-info { flex: 1; min-width: 0; }
  .sk-card-title-row {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 4px;
    flex-wrap: wrap;
  }
  .sk-play-name { font-size: 15px; color: #26211c; }
  .sk-status-badge {
    font-size: 12px;
    padding: 2px 8px;
    border-radius: 4px;
    font-weight: 500;
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }
  .sk-status-confirmed { background: #e6f0e6; color: #2d5a2d; }
  .sk-status-pending { background: #fff4e6; color: #8a5a1a; }
  .sk-status-cancelled { background: #f6e6e6; color: #8a2d2d; }
  .sk-status-done { background: #e6eef6; color: #1a4a8a; }
  .sk-card-meta {
    display: flex;
    gap: 12px;
    font-size: 13px;
    color: #6b5a4d;
    flex-wrap: wrap;
  }
  .sk-card-meta span {
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }
  .sk-card-note {
    margin: 6px 0 0;
    font-size: 12px;
    color: #8a7665;
    line-height: 1.4;
  }
  .sk-card-actions {
    display: flex;
    gap: 4px;
    flex-shrink: 0;
  }
  .sk-icon-btn {
    background: transparent;
    border: 0;
    padding: 6px;
    cursor: pointer;
    color: #6b5a4d;
    border-radius: 6px;
    display: flex;
    align-items: center;
  }
  .sk-icon-btn:hover { background: #f0e6dc; }

  .sk-linked {
    margin-top: 10px;
    padding: 10px;
    background: #faf6f2;
    border-radius: 6px;
    border: 1px solid #e4d8cc;
  }
  .sk-linked-title {
    font-size: 12px;
    color: #6b5a4d;
    font-weight: 500;
    display: flex;
    align-items: center;
    gap: 4px;
    margin-bottom: 6px;
  }
  .sk-linked-list {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }
  .sk-costume-tag {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    padding: 2px 8px;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 500;
    background: #f0e6dc;
    color: #4a3b30;
  }
  .sk-costume-borrowed { background: #fff0e6; color: #8a4a1a; }
  .sk-costume-overdue { background: #fdecea; color: #8a2d2d; }
  .sk-costume-cleaning { background: #e6eef6; color: #1a4a8a; }
  .sk-costume-repair { background: #f6e6e6; color: #8a2d2d; }
  .sk-costume-removable {
    cursor: pointer;
    transition: background .15s;
  }
  .sk-costume-removable:hover { background: #e0c9b8; }

  .sk-costume-main-info { display: flex; flex-direction: column; gap: 4px; flex: 1; min-width: 0; }
  .sk-costume-actors { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 2px; }
  .sk-costume-actor-item { display: inline-flex; align-items: center; gap: 4px; padding: 2px 6px; background: #f6efe7; border-radius: 4px; font-size: 11px; }
  .sk-actor-name { color: #3b2f26; font-weight: 500; }
  .sk-size-badge { display: inline-flex; align-items: center; padding: 1px 6px; border-radius: 3px; font-size: 10px; font-weight: 500; }
  .sk-size-badge.match-perfect { background: #e6f0e6; color: #2d5a2d; }
  .sk-size-badge.match-loose { background: #fff4e6; color: #8a5a1a; }
  .sk-size-badge.match-tight { background: #fff4e6; color: #8a5a1a; }
  .sk-size-badge.match-mismatch { background: #f6e6e6; color: #8a2d2d; }
  .sk-size-badge.match-unknown { background: #f6efe7; color: #6b5a4d; }

  .sk-mini-actor { display: inline-flex; align-items: center; gap: 3px; font-size: 10px; color: #6b5a4d; }
  .sk-mini-size-badge { display: inline-flex; align-items: center; padding: 1px 5px; border-radius: 3px; font-size: 9px; font-weight: 500; }
  .sk-mini-size-badge.match-perfect { background: #e6f0e6; color: #2d5a2d; }
  .sk-mini-size-badge.match-loose { background: #fff4e6; color: #8a5a1a; }
  .sk-mini-size-badge.match-tight { background: #fff4e6; color: #8a5a1a; }
  .sk-mini-size-badge.match-mismatch { background: #f6e6e6; color: #8a2d2d; }
  .sk-mini-size-badge.match-unknown { background: #f6efe7; color: #6b5a4d; }

  .sk-linked-costume-list { display: flex; flex-direction: column; gap: 6px; }
  .sk-linked-costume-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 10px;
    background: #fff;
    border: 1px solid #e4d8cc;
    border-radius: 6px;
  }
  .sk-linked-costume-main { display: flex; flex-direction: column; gap: 2px; flex: 1; min-width: 0; }
  .sk-linked-costume-name { font-size: 13px; color: #26211c; font-weight: 500; display: flex; align-items: center; gap: 4px; }
  .sk-linked-costume-size { font-size: 11px; color: #6b5a4d; }
  .sk-linked-costume-actors { display: flex; flex-wrap: wrap; gap: 3px; margin-top: 2px; }
  .sk-remove-costume-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
    border: none;
    background: #f6efe7;
    color: #8a7665;
    border-radius: 4px;
    cursor: pointer;
    flex-shrink: 0;
    padding: 0;
  }
  .sk-remove-costume-btn:hover { background: #f0e6dc; color: #6b5a4d; }
  .sk-pick-card-main { display: flex; flex-direction: column; gap: 2px; flex: 1; min-width: 0; }
  .sk-pick-card-actors { display: flex; flex-wrap: wrap; gap: 3px; margin-top: 2px; }

  .sk-risk-list {
    margin-top: 10px;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .sk-risk-item {
    display: flex;
    align-items: flex-start;
    gap: 6px;
    padding: 6px 10px;
    border-radius: 6px;
    font-size: 12px;
    line-height: 1.4;
  }
  .sk-risk-item-high { background: #fdecea; color: #8a2d2d; }
  .sk-risk-item-medium { background: #fff4e6; color: #8a5a1a; }
  .sk-risk-item-low { background: #f6efe7; color: #6b5a4d; }
  .sk-more-risk {
    background: transparent;
    border: 0;
    padding: 4px 10px;
    cursor: pointer;
    color: #603d2d;
    font: inherit;
    font-size: 12px;
    text-align: left;
  }
  .sk-more-risk:hover { text-decoration: underline; }

  .sk-card-footer {
    margin-top: 10px;
    display: flex;
    gap: 6px;
    justify-content: flex-end;
  }
  .sk-sm-btn {
    padding: 4px 10px;
    font-size: 12px;
    border: 1px solid #d8c8ba;
    border-radius: 6px;
    background: transparent;
    color: #4a3b30;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font: inherit;
  }
  .sk-sm-btn:hover { background: #f0e6dc; }
  .sk-sm-btn-primary { background: #603d2d; color: #fff; border-color: #603d2d; }
  .sk-sm-btn-primary:hover { background: #4e3225; }
  .sk-sm-btn-danger { border-color: #d9b5ad; color: #b84a3b; }
  .sk-sm-btn-danger:hover { background: #fdf0ec; }

  .sk-modal-overlay {
    position: fixed;
    inset: 0;
    background: rgb(38 33 28 / .55);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 16px;
    z-index: 100;
  }
  .sk-modal {
    background: #fff;
    border-radius: 12px;
    width: 100%;
    max-width: 520px;
    max-height: 90vh;
    overflow-y: auto;
    box-shadow: 0 24px 60px rgb(38 33 28 / .25);
  }
  .sk-modal-wide { max-width: 640px; }
  .sk-modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 18px 20px;
    border-bottom: 1px solid #e4d8cc;
    position: sticky;
    top: 0;
    background: #fff;
    border-radius: 12px 12px 0 0;
    z-index: 5;
  }
  .sk-modal-header h2 {
    margin: 0;
    font-size: 18px;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .sk-modal-form {
    padding: 18px 20px 20px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .sk-modal-form label {
    display: flex;
    flex-direction: column;
    gap: 6px;
    font-size: 14px;
    color: #6b5a4d;
  }
  .sk-modal-form label span { font-weight: 500; }
  .sk-modal-form input,
  .sk-modal-form select {
    width: 100%;
    border: 1px solid #d8c8ba;
    border-radius: 8px;
    padding: 11px 12px;
    background: #fff;
    color: #26211c;
    font: inherit;
  }
  .sk-split { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  .sk-modal-actions {
    display: flex;
    justify-content: space-between;
    gap: 10px;
    margin-top: 8px;
  }
  .sk-modal-actions button {
    flex: 1;
    min-width: 140px;
    border: 0;
    border-radius: 8px;
    padding: 11px 13px;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 7px;
    font: inherit;
  }
  .sk-modal-actions button:first-child { background: #efe4d9; color: #37261d; }
  .sk-modal-actions button:last-child { background: #603d2d; color: #fff; }
  .sk-modal-actions button:last-child:hover { background: #4e3225; }
  button:disabled { opacity: .5; cursor: not-allowed; }

  .sk-linked-section {
    padding: 12px;
    background: #faf6f2;
    border-radius: 8px;
    border: 1px solid #e4d8cc;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .sk-linked-section-title {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 14px;
    color: #3b2f26;
  }
  .sk-linked-section-title strong {
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }
  .sk-hint {
    margin: 0;
    font-size: 13px;
    color: #8a7665;
    line-height: 1.5;
  }

  .sk-costume-pick {
    padding: 12px;
    background: #faf6f2;
    border-radius: 8px;
    border: 1px solid #e4d8cc;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .sk-pick-list {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 6px;
    max-height: 160px;
    overflow-y: auto;
  }
  .sk-pick-card {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 10px;
    background: #fff;
    border: 1px solid #e4d8cc;
    border-radius: 6px;
    cursor: pointer;
    text-align: left;
    font: inherit;
    transition: border-color .15s;
  }
  .sk-pick-card:hover { border-color: #c9a67e; }
  .sk-pick-card strong { font-size: 13px; color: #26211c; display: block; }
  .sk-pick-card span { font-size: 11px; color: #6b5a4d; }
  .sk-pick-add { color: #603d2d; flex-shrink: 0; }

  .sk-detail-body {
    padding: 18px 20px 20px;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  .sk-detail-section {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 14px;
    background: #faf6f2;
    border: 1px solid #e4d8cc;
    border-radius: 8px;
  }
  .sk-detail-section h3 {
    margin: 0;
    font-size: 14px;
    font-weight: 600;
    color: #3b2f26;
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .sk-info-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 6px 0;
    border-bottom: 1px dashed #e4d8cc;
    font-size: 14px;
  }
  .sk-info-row:last-child { border-bottom: none; }
  .sk-info-row span { color: #6b5a4d; }
  .sk-info-row strong { color: #26211c; font-weight: 600; }
  .sk-detail-costumes {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .sk-detail-costume-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 10px;
    background: #fff;
    border: 1px solid #e4d8cc;
    border-radius: 6px;
    gap: 8px;
  }
  .sk-detail-costume-row strong { font-size: 13px; color: #26211c; display: block; }
  .sk-detail-costume-row span { font-size: 11px; color: #6b5a4d; }
  .sk-costume-status { display: flex; gap: 4px; flex-wrap: wrap; }
  .sk-status-chip {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 500;
  }
  .sk-chip-borrowed { background: #fff0e6; color: #8a4a1a; }
  .sk-chip-instock { background: #e6f0e6; color: #2d5a2d; }
  .sk-chip-cleaning { background: #e6eef6; color: #1a4a8a; }
  .sk-chip-repair { background: #f6e6e6; color: #8a2d2d; }
  .sk-detail-risks {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .sk-risk-schedule-group {
    padding: 12px;
    background: #fff;
    border: 1px solid #e4d8cc;
    border-radius: 8px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .sk-risk-schedule-header {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }
  .sk-risk-schedule-header strong { font-size: 15px; color: #26211c; }
  .sk-risk-schedule-header span { font-size: 13px; color: #6b5a4d; }

  @media (max-width: 900px) {
    .sk-toolbar { grid-template-columns: 1fr; }
    .sk-split { grid-template-columns: 1fr; }
    .sk-modal { max-height: 95vh; }
    .sk-modal-actions button { min-width: 100%; }
    .sk-date-left { flex-wrap: wrap; }
    .sk-card-top { flex-direction: column; }
    .sk-pick-list { grid-template-columns: 1fr; }
  }
</style>
