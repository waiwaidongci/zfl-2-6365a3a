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

<style>
  .modal-overlay { position: fixed; inset: 0; background: rgb(38 33 28 / .55); display: flex; align-items: center; justify-content: center; padding: 16px; z-index: 100; }
  .modal { background: #fff; border-radius: 12px; width: 100%; max-width: 520px; max-height: 90vh; overflow-y: auto; box-shadow: 0 24px 60px rgb(38 33 28 / .25); }
  .modal-header { display: flex; justify-content: space-between; align-items: center; padding: 18px 20px; border-bottom: 1px solid #e4d8cc; position: sticky; top: 0; background: #fff; border-radius: 12px 12px 0 0; }
  .modal-header h2 { margin: 0; }
  .icon-btn { background: transparent; color: #6b5a4d; padding: 6px; border-radius: 6px; }
  .icon-btn:hover { background: #f6efe7; }
  .detail-form, .lend-form { padding: 18px 20px 20px; display: flex; flex-direction: column; gap: 12px; }
  .detail-form label, .lend-form label { display: flex; flex-direction: column; gap: 6px; font-size: 14px; color: #6b5a4d; }
  .detail-form label span, .lend-form label span { font-weight: 500; }
  .lend-form label { position: relative; }
  .status-info { background: #f6efe7; border-radius: 8px; padding: 12px 14px; margin: 4px 0; }
  .status-info p { margin: 4px 0; font-size: 14px; color: #4a3b30; }
  .split { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  .conflict-box { background: #fff4e6; border: 1px solid #e0c9a8; border-radius: 8px; padding: 12px 14px; }
  .conflict-title { display: flex; align-items: center; gap: 8px; color: #8a5a1a; margin-bottom: 8px; }
  .conflict-item { margin: 2px 0; font-size: 13px; color: #6b4a2a; }
  .actor-match-panel { margin-top: 10px; padding: 12px 14px; background: #faf6f2; border: 1px solid #e4d8cc; border-radius: 8px; display: flex; flex-direction: column; gap: 10px; }
  .actor-match-header { display: flex; align-items: center; gap: 8px; }
  .actor-match-header strong { color: #26211c; font-size: 14px; }
  .size-match-row { display: flex; align-items: center; gap: 8px; font-size: 13px; padding: 6px 10px; border-radius: 6px; }
  .size-match-row.match-perfect { background: #eef6ee; color: #2d5a2d; }
  .size-match-row.match-close { background: #fff4e6; color: #8a5a1a; }
  .size-match-row.match-mismatch { background: #fdecea; color: #8a2d2d; }
  .size-match-row.match-unknown { background: #f6efe7; color: #6b5a4d; }
  .size-match-row.play-match { background: #eef6ee; color: #2d5a2d; }
  .size-match-row.play-mismatch { background: #f6efe7; color: #6b5a4d; }
  .actor-plays-row { display: flex; flex-direction: column; gap: 4px; }
  .actor-plays-row > span:first-child { font-size: 12px; color: #8a7665; }
  .actor-plays-list { display: flex; flex-wrap: wrap; gap: 4px; }
  .actor-play-tag { display: inline-flex; align-items: center; padding: 2px 8px; border-radius: 4px; font-size: 12px; background: #e6eef6; color: #1a4a8a; font-weight: 500; }
  .actor-suggest-box { position: absolute; top: 100%; left: 0; right: 0; background: #fff; border: 1px solid #e4d8cc; border-radius: 8px; box-shadow: 0 6px 18px rgb(62 42 24 / .12); z-index: 100; overflow: hidden; }
  .actor-suggest-item { display: flex; align-items: center; gap: 8px; padding: 10px 12px; width: 100%; text-align: left; border: none; background: none; cursor: pointer; border-bottom: 1px solid #f0e6dc; font-size: 14px; color: #26211c; }
  .actor-suggest-item:hover { background: #faf6f2; }
  .actor-suggest-item:last-child { border-bottom: none; }
  .actor-suggest-size { margin-left: auto; font-size: 12px; color: #1a4a8a; background: #e6eef6; padding: 2px 8px; border-radius: 4px; font-weight: 500; }
  .size-match-box { border-radius: 8px; padding: 12px 14px; border: 1px solid; }
  .size-match-box.match-perfect { background: #eef6ee; border-color: #b8d8b8; color: #2d5a2d; }
  .size-match-box.match-close { background: #fff4e6; border-color: #e0c9a8; color: #8a5a1a; }
  .size-match-box.match-mismatch { background: #fdecea; border-color: #e0b8b0; color: #8a2d2d; }
  .size-match-box.match-unknown { background: #f6efe7; border-color: #e4d8cc; color: #6b5a4d; }
  .size-match-title { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
  .size-match-detail { margin: 2px 0; font-size: 13px; }
  .match-badge { display: inline-flex; align-items: center; padding: 3px 10px; border-radius: 6px; font-size: 12px; font-weight: 500; }
  .match-badge.match-perfect { background: #e6f0e6; color: #2d5a2d; }
  .match-badge.match-close { background: #fff4e6; color: #8a5a1a; }
  .match-badge.match-mismatch { background: #f6e6e6; color: #8a2d2d; }
  .match-badge.match-unknown { background: #f6efe7; color: #6b5a4d; }
  .modal-actions { display: flex; justify-content: space-between; gap: 10px; margin-top: 8px; flex-wrap: wrap; }
  .modal-actions button { flex: 1; min-width: 140px; }
  .secondary { background: #efe4d9; color: #37261d; }
  button:disabled { opacity: .5; cursor: not-allowed; }
  .record-play-tag { font-size: 12px; color: #6b5a4d; background: #f0e6dc; padding: 2px 8px; border-radius: 4px; display: inline-flex; align-items: center; gap: 4px; }
</style>
