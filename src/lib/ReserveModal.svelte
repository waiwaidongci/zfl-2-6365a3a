<script>
  import { createEventDispatcher } from 'svelte';
  import { X, Calendar, User, CheckCircle, AlertTriangle, XCircle, Clock } from 'lucide-svelte';
  import { getCostumeById, addRecord } from '$lib/recordsStore.js';
  import {
    checkScheduleConflict,
    createReservation,
    iso
  } from '$lib/reservationStore.js';
  import {
    findActorByName,
    searchActorsByName,
    getActorCostumeHistory,
    matchSize,
    checkPlayMatch,
    getMatchBadgeClass
  } from '$lib/actorMatchUtils.js';

  export let costumeId = null;
  export let reservationForm = {
    date: iso(1),
    type: '演员',
    reservedFor: '',
    note: ''
  };
  export let handleModalKeydown = (e) => {
    if (e.key === 'Escape') close();
  };

  $: reservingCostume = costumeId ? getCostumeById(costumeId) : null;
  $: currentConflicts = reservingCostume && reservationForm.date ? checkScheduleConflict(reservingCostume.id, reservationForm.date) : [];
  $: reservationActor = reservationForm.type === '演员' ? findActorByName(reservationForm.reservedFor) : null;
  $: reservationActorSuggestions = reservationForm.type === '演员' ? searchActorsByName(reservationForm.reservedFor) : [];
  $: reservationSizeMatch = reservingCostume && reservationActor ? matchSize(reservingCostume.size, reservationActor.size) : null;
  $: reservationPlayMatch = reservingCostume && reservationActor ? checkPlayMatch(reservingCostume.play, reservationActor.plays) : null;
  $: reservationActorHistory = reservationActor ? getActorCostumeHistory(reservationActor.name) : [];

  const dispatch = createEventDispatcher();

  function close() {
    dispatch('close');
  }

  function handleSubmit() {
    let extraSummary = '';
    if (reservationActor && reservationSizeMatch) {
      extraSummary = `尺码匹配：${reservationSizeMatch.label}`;
    }
    const result = createReservation(
      costumeId,
      reservationForm,
      {
        extraSummary,
        addRecordFn: addRecord
      }
    );
    if (result.ok) {
      dispatch('reserved', { reservation: result.reservation, costumeId });
      close();
    } else if (result.error) {
      alert(result.error);
    }
  }
</script>

{#if reservingCostume}
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
  <div class="modal-overlay" role="presentation" on:click={close}>
    <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
    <div
      class="modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="reserve-title"
      on:click|stopPropagation
      on:keydown={handleModalKeydown}
      tabindex="-1"
    >
      <div class="modal-header">
        <h2 id="reserve-title">预约服装</h2>
        <button type="button" class="icon-btn" on:click={close} aria-label="关闭"><X size={20} /></button>
      </div>
      <form class="lend-form" on:submit|preventDefault={handleSubmit}>
        <div class="status-info">
          <p><strong>服装：</strong>{reservingCostume.name}</p>
          <p><strong>剧目：</strong>{reservingCostume.play}</p>
          {#if reservingCostume.status === '借出'}
            <p><strong>当前状态：</strong>借出中（{reservingCostume.borrower}借用至{reservingCostume.due}）</p>
          {/if}
        </div>
        <label>
          <span>预约日期</span>
          <input type="date" bind:value={reservationForm.date} min={iso(0)} required />
        </label>
        <label>
          <span>预约类型</span>
          <select bind:value={reservationForm.type}>
            <option value="演员">演员</option>
            <option value="场次">排练场次</option>
          </select>
        </label>
        <label>
          <span>{reservationForm.type === '演员' ? '演员姓名' : '场次名称'}</span>
          <input bind:value={reservationForm.reservedFor} placeholder={reservationForm.type === '演员' ? '请输入演员姓名' : '请输入场次名称'} required />
          {#if reservationForm.type === '演员' && reservationActorSuggestions.length > 0 && !reservationActor}
            <div class="actor-suggest-box">
              {#each reservationActorSuggestions.slice(0, 3) as sugg}
                <button type="button" class="actor-suggest-item" on:click={() => { reservationForm.reservedFor = sugg.name; }}>
                  <User size={14} />
                  <span>{sugg.name}</span>
                  <span class="actor-suggest-size">{sugg.size || '未填尺码'}</span>
                </button>
              {/each}
            </div>
          {/if}
        </label>
        <label>
          <span>备注</span>
          <input bind:value={reservationForm.note} placeholder="选填" />
        </label>

        {#if reservationForm.type === '演员' && reservationActor}
          <div class="actor-match-panel">
            <div class="actor-match-header">
              <User size={16} />
              <strong>演员档案：{reservationActor.name}</strong>
              {#if reservationActor.size}
                <span class="match-badge {getMatchBadgeClass(reservationSizeMatch?.level)}">{reservationSizeMatch?.label || reservationActor.size}</span>
              {/if}
            </div>

            {#if reservationSizeMatch}
              <div class="size-match-row" class:match-perfect={reservationSizeMatch.level === 'perfect'} class:match-close={reservationSizeMatch.level === 'loose' || reservationSizeMatch.level === 'tight'} class:match-mismatch={reservationSizeMatch.level === 'mismatch'} class:match-unknown={reservationSizeMatch.level === 'unknown'}>
                {#if reservationSizeMatch.level === 'perfect'}
                  <CheckCircle size={14} />
                {:else if reservationSizeMatch.level === 'loose' || reservationSizeMatch.level === 'tight'}
                  <AlertTriangle size={14} />
                {:else if reservationSizeMatch.level === 'mismatch'}
                  <XCircle size={14} />
                {:else}
                  <AlertTriangle size={14} />
                {/if}
                <span>尺码：服装 {reservingCostume.size || '未填'} / 演员 {reservationActor.size || '未填'} — {reservationSizeMatch.label}</span>
              </div>
            {/if}

            {#if reservationPlayMatch}
              <div class="size-match-row" class:play-match={reservationPlayMatch.match} class:play-mismatch={!reservationPlayMatch.match}>
                {#if reservationPlayMatch.match}
                  <CheckCircle size={14} />
                {:else}
                  <AlertTriangle size={14} />
                {/if}
                <span>剧目：{reservationPlayMatch.label}</span>
              </div>
            {/if}

            {#if reservationActor.plays && reservationActor.plays.length > 0}
              <div class="actor-plays-row">
                <span class="label">参演剧目：</span>
                <div class="actor-plays-tags">
                  {#each reservationActor.plays as play}
                    <span class="record-play-tag">{play}</span>
                  {/each}
                </div>
              </div>
            {/if}

            {#if reservationActor.note}
              <div class="actor-note-row">
                <span class="label">备注：</span>
                <span>{reservationActor.note}</span>
              </div>
            {/if}

            {#if reservationActorHistory.length > 0}
              <div class="actor-history-section">
                <div class="actor-history-title">
                  <Clock size={14} />
                  <span>历史使用服装</span>
                </div>
                <div class="actor-history-list">
                  {#each reservationActorHistory.slice(0, 5) as hist}
                    <div class="actor-history-item">
                      <span class="history-costume-name">{hist.name}</span>
                      <span class="history-play-tag">{hist.play}</span>
                    </div>
                  {/each}
                </div>
              </div>
            {/if}
          </div>
        {/if}

        {#if currentConflicts.length > 0}
          <div class="conflict-box">
            <div class="conflict-title">
              <AlertTriangle size={16} />
              <strong>该日期存在冲突</strong>
            </div>
            {#each currentConflicts as conflict}
              <p class="conflict-item">· {conflict.type}：{conflict.detail}</p>
            {/each}
          </div>
        {/if}

        <div class="modal-actions">
          <button type="button" class="secondary" on:click={close}>取消</button>
          <button type="submit" disabled={!reservationForm.reservedFor.trim() || !reservationForm.date || currentConflicts.length > 0}>
            <Calendar size={16} />确认预约
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}
