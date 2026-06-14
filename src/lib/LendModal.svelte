<script>
  import { createEventDispatcher } from 'svelte';
  import { X, Clock, User, CheckCircle, AlertTriangle, XCircle } from 'lucide-svelte';
  import { allActors } from '$lib/scheduleStore.js';
  import { getCostumeById, canLend, lendCostume, addRecord } from '$lib/recordsStore.js';
  import {
    getActorById,
    findActorByName,
    searchActorsByName,
    getActorCostumeHistory,
    matchSize,
    checkPlayMatch,
    getMatchBadgeClass
  } from '$lib/actorMatchUtils.js';

  export function iso(offset = 0) {
    const date = new Date();
    date.setDate(date.getDate() + offset);
    return date.toISOString().slice(0, 10);
  }

  export let costumeId = null;
  export let lendingBorrower = '';
  export let lendingActorId = '';
  export let handleModalKeydown = (e) => {
    if (e.key === 'Escape') close();
  };

  export const actors = $allActors;

  $: lendingCostume = costumeId ? getCostumeById(costumeId) : null;
  $: lendingActor = lendingActorId ? getActorById(lendingActorId) : null;
  $: lendingActorByBorrower = lendingBorrower ? findActorByName(lendingBorrower) : null;
  $: lendingActiveActor = lendingActor || lendingActorByBorrower;
  $: lendingSizeMatch = lendingCostume && lendingActiveActor ? matchSize(lendingCostume.size, lendingActiveActor.size) : null;
  $: lendingPlayMatch = lendingCostume && lendingActiveActor ? checkPlayMatch(lendingCostume.play, lendingActiveActor.plays) : null;
  $: lendingBorrowerSuggestions = lendingBorrower ? searchActorsByName(lendingBorrower) : [];
  $: lendingActorHistory = lendingActiveActor ? getActorCostumeHistory(lendingActiveActor.name) : [];

  const dispatch = createEventDispatcher();

  function close() {
    dispatch('close');
  }

  function handleActorSelectChange() {
    if (lendingActorId) {
      const a = getActorById(lendingActorId);
      if (a) lendingBorrower = a.name;
    }
  }

  function handleSuggClick(sugg) {
    lendingActorId = sugg.id;
    lendingBorrower = sugg.name;
  }

  function handleSubmit() {
    let borrower = lendingBorrower.trim();
    if (!borrower && lendingActor) {
      borrower = lendingActor.name;
    }
    if (!borrower) return;
    const checkResult = canLend(costumeId);
    if (!checkResult.can) {
      alert(checkResult.reason);
      return;
    }
    const result = lendCostume(
      costumeId,
      borrower,
      {
        sizeMatchInfo: lendingActiveActor && lendingSizeMatch ? lendingSizeMatch.label : null,
        addRecordFn: addRecord
      }
    );
    if (result.ok) {
      dispatch('lent', { costumeId, borrower, dueDate: result.dueDate });
      close();
    } else if (result.error) {
      alert(result.error);
    }
  }
</script>

{#if lendingCostume}
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
  <div class="modal-overlay" role="presentation" on:click={close}>
    <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
    <div
      class="modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="lend-title"
      on:click|stopPropagation
      on:keydown={handleModalKeydown}
      tabindex="-1"
    >
      <div class="modal-header">
        <h2 id="lend-title">借出服装</h2>
        <button type="button" class="icon-btn" on:click={close} aria-label="关闭"><X size={20} /></button>
      </div>
      <form class="lend-form" on:submit|preventDefault={handleSubmit}>
        <div class="status-info">
          <p><strong>服装：</strong>{lendingCostume.name}</p>
          <p><strong>剧目：</strong>{lendingCostume.play}</p>
          <p><strong>服装尺码：</strong>{lendingCostume.size || '未填'}</p>
          <p><strong>应还日期：</strong>{iso(7)}</p>
        </div>
        <label>
          <span>选择演员（可选）</span>
          <select bind:value={lendingActorId} on:change={handleActorSelectChange}>
            <option value="">不选择演员，手动输入借用人</option>
            {#each actors as actor}
              <option value={actor.id}>{actor.name} ({actor.size || '未填尺码'})</option>
            {/each}
          </select>
        </label>
        <label>
          <span>借用人</span>
          <input bind:value={lendingBorrower} placeholder="请输入借用人姓名" required />
          {#if lendingBorrowerSuggestions.length > 0 && !lendingActorId && (lendingActorByBorrower?.name !== lendingBorrower.trim())}
            <div class="actor-suggest-box">
              {#each lendingBorrowerSuggestions.slice(0, 3) as sugg}
                <button type="button" class="actor-suggest-item" on:click={() => handleSuggClick(sugg)}>
                  <User size={14} />
                  <span>{sugg.name}</span>
                  <span class="actor-suggest-size">{sugg.size || '未填尺码'}</span>
                </button>
              {/each}
            </div>
          {/if}
        </label>

        {#if lendingActiveActor}
          <div class="actor-match-panel">
            <div class="actor-match-header">
              <User size={16} />
              <strong>演员档案：{lendingActiveActor.name}</strong>
              {#if lendingActiveActor.size}
                <span class="match-badge {getMatchBadgeClass(lendingSizeMatch?.level)}">{lendingSizeMatch?.label || lendingActiveActor.size}</span>
              {/if}
            </div>

            {#if lendingSizeMatch}
              <div class="size-match-row" class:match-perfect={lendingSizeMatch.level === 'perfect'} class:match-close={lendingSizeMatch.level === 'loose' || lendingSizeMatch.level === 'tight'} class:match-mismatch={lendingSizeMatch.level === 'mismatch'} class:match-unknown={lendingSizeMatch.level === 'unknown'}>
                {#if lendingSizeMatch.level === 'perfect'}
                  <CheckCircle size={14} />
                {:else if lendingSizeMatch.level === 'loose' || lendingSizeMatch.level === 'tight'}
                  <AlertTriangle size={14} />
                {:else if lendingSizeMatch.level === 'mismatch'}
                  <XCircle size={14} />
                {:else}
                  <AlertTriangle size={14} />
                {/if}
                <span>尺码：服装 {lendingCostume.size || '未填'} / 演员 {lendingActiveActor.size || '未填'} — {lendingSizeMatch.label}</span>
              </div>
            {/if}

            {#if lendingPlayMatch}
              <div class="size-match-row" class:play-match={lendingPlayMatch.match} class:play-mismatch={!lendingPlayMatch.match}>
                {#if lendingPlayMatch.match}
                  <CheckCircle size={14} />
                {:else}
                  <AlertTriangle size={14} />
                {/if}
                <span>剧目：{lendingPlayMatch.label}</span>
              </div>
            {/if}

            {#if lendingActiveActor.plays && lendingActiveActor.plays.length > 0}
              <div class="actor-plays-row">
                <span class="label">参演剧目：</span>
                <div class="actor-plays-tags">
                  {#each lendingActiveActor.plays as play}
                    <span class="record-play-tag">{play}</span>
                  {/each}
                </div>
              </div>
            {/if}

            {#if lendingActiveActor.note}
              <div class="actor-note-row">
                <span class="label">备注：</span>
                <span>{lendingActiveActor.note}</span>
              </div>
            {/if}

            {#if lendingActorHistory.length > 0}
              <div class="actor-history-section">
                <div class="actor-history-title">
                  <Clock size={14} />
                  <span>历史使用服装</span>
                </div>
                <div class="actor-history-list">
                  {#each lendingActorHistory.slice(0, 5) as hist}
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
        <div class="modal-actions">
          <button type="button" class="secondary" on:click={close}>取消</button>
          <button type="submit" disabled={!lendingBorrower.trim()}><Clock size={16} />确认借出</button>
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
  .actor-history-section { display: flex; flex-direction: column; gap: 8px; }
  .actor-history-row { display: flex; justify-content: space-between; align-items: center; padding: 8px 10px; background: #fff; border: 1px solid #e4d8cc; border-radius: 6px; }
  .actor-history-info { display: flex; align-items: center; gap: 8px; }
  .actor-history-costume { font-size: 13px; color: #26211c; font-weight: 500; }
  .actor-history-type { font-size: 11px; color: #8a7665; padding: 2px 6px; background: #f6efe7; border-radius: 4px; }
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
  .danger { background: #b84a3b; }
  .danger:hover { background: #a03e30; }
  .split { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  .secondary { background: #efe4d9; color: #37261d; }
  button:disabled { opacity: .5; cursor: not-allowed; }
  .record-play-tag { font-size: 12px; color: #6b5a4d; background: #f0e6dc; padding: 2px 8px; border-radius: 4px; display: inline-flex; align-items: center; gap: 4px; }
</style>
