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
