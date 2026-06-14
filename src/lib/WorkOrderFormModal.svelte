<script>
  import { createEventDispatcher } from 'svelte';
  import { X, Save } from 'lucide-svelte';
  import { globalIndex } from '$lib/dataIndex.js';
  import { costumesAvailableForWorkOrder } from '$lib/scheduleStore.js';
  import {
    getAvailableStatuses,
    saveWorkOrder
  } from '$lib/workOrderStore.js';
  import { addRecord, formatDateTime } from '$lib/recordsStore.js';

  export let show = false;
  export let creating = true;
  export let editingId = null;
  export let workOrderForm = {
    type: '清洗',
    costumeId: '',
    costumeName: '',
    play: '',
    status: '待清洗',
    assignee: '',
    dueDate: '',
    note: ''
  };
  export let handleModalKeydown = (e) => {
    if (e.key === 'Escape') close();
  };

  const dispatch = createEventDispatcher();

  function close() {
    dispatch('close');
  }

  function handleSave() {
    const result = saveWorkOrder(workOrderForm, {
      creating,
      editingId,
      addRecordFn: addRecord
    });
    if (result) {
      dispatch('saved', { result, creating, editingId });
      close();
    }
  }

  function handleTypeChange() {
    if (workOrderForm.type === '清洗') {
      workOrderForm.status = workOrderForm.status === '维修中' ? '清洗中' : '待清洗';
      if (!workOrderForm.assignee) workOrderForm.assignee = '张阿姨';
    } else {
      workOrderForm.status = workOrderForm.status === '清洗中' ? '维修中' : '待维修';
      if (!workOrderForm.assignee) workOrderForm.assignee = '李师傅';
    }
  }

  function handleCostumeChange() {
    const c = globalIndex.getCostumeById(workOrderForm.costumeId);
    if (c) {
      workOrderForm.costumeName = c.name;
      workOrderForm.play = c.play;
    }
  }
</script>

{#if show}
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
  <div class="modal-overlay" role="presentation" on:click={close}>
    <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
    <div
      class="modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="workorder-title"
      on:click|stopPropagation
      on:keydown={handleModalKeydown}
      tabindex="-1"
    >
      <div class="modal-header">
        <h2 id="workorder-title">
          {creating ? '新建工单' : '编辑工单'}
        </h2>
        <button type="button" class="icon-btn" on:click={close} aria-label="关闭"><X size={20} /></button>
      </div>
      <form class="lend-form" on:submit|preventDefault={handleSave}>
        <label>
          <span>工单类型</span>
          <select bind:value={workOrderForm.type} disabled={!creating} on:change={handleTypeChange}>
            <option value="清洗">清洗</option>
            <option value="维修">维修</option>
          </select>
        </label>
        <label>
          <span>选择服装</span>
          <select bind:value={workOrderForm.costumeId} disabled={!creating} on:change={handleCostumeChange}>
            <option value="">请选择服装</option>
            {#each $costumesAvailableForWorkOrder as costume}
              <option value={costume.id}>{costume.name} ({costume.play})</option>
            {/each}
          </select>
        </label>
        {#if workOrderForm.costumeId}
          <div class="status-info">
            <p><strong>服装：</strong>{workOrderForm.costumeName}</p>
            <p><strong>剧目：</strong>{workOrderForm.play}</p>
          </div>
        {/if}
        <label>
          <span>当前状态</span>
          <select bind:value={workOrderForm.status}>
            {#each getAvailableStatuses(workOrderForm) as status}
              <option>{status}</option>
            {/each}
          </select>
        </label>
        <label>
          <span>负责人</span>
          <input bind:value={workOrderForm.assignee} placeholder="请输入负责人姓名" required />
        </label>
        <label>
          <span>截止日期</span>
          <input type="date" bind:value={workOrderForm.dueDate} required />
        </label>
        <label>
          <span>备注</span>
          <input bind:value={workOrderForm.note} placeholder="选填，描述问题或特殊要求" />
        </label>
        <div class="modal-actions">
          <button type="button" class="secondary" on:click={close}>取消</button>
          <button type="submit" disabled={!workOrderForm.costumeId || !workOrderForm.assignee.trim()}>
            <Save size={16} />{creating ? '创建工单' : '保存修改'}
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}
