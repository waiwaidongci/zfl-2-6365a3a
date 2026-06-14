<script>
  import { createEventDispatcher } from 'svelte';
  import { X, Save } from 'lucide-svelte';
  import { globalIndex } from '$lib/dataIndex.js';
  import {
    getAvailableStatuses,
    updateWorkOrderStatus
  } from '$lib/workOrderStore.js';
  import { addRecord, formatDateTime } from '$lib/recordsStore.js';

  export let workOrder = null;
  export let handleModalKeydown = (e) => {
    if (e.key === 'Escape') close();
  };

  const dispatch = createEventDispatcher();

  function close() {
    dispatch('close');
  }

  function goEdit() {
    dispatch('open-edit', { id: workOrder.id });
  }

  function handleStatusChange(status) {
    updateWorkOrderStatus(workOrder.id, status, { addRecordFn: addRecord });
    dispatch('status-updated', { id: workOrder.id, status });
  }
</script>

{#if workOrder}
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
  <div class="modal-overlay" role="presentation" on:click={close}>
    <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
    <div
      class="modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="workorder-detail-title"
      on:click|stopPropagation
      on:keydown={handleModalKeydown}
      tabindex="-1"
    >
      <div class="modal-header">
        <h2 id="workorder-detail-title">工单详情</h2>
        <button type="button" class="icon-btn" on:click={close} aria-label="关闭"><X size={20} /></button>
      </div>
      <div class="detail-form">
        <div class="status-info">
          <p><strong>工单编号：</strong>{workOrder.id.slice(0, 8)}</p>
          <p><strong>工单类型：</strong>{workOrder.type}</p>
          <p><strong>当前状态：</strong>{workOrder.status}</p>
        </div>
        <div class="status-info">
          <p><strong>服装：</strong>{workOrder.costumeName}</p>
          <p><strong>剧目：</strong>{workOrder.play}</p>
        </div>
        <div class="status-info">
          <p><strong>负责人：</strong>{workOrder.assignee || '未分配'}</p>
          <p><strong>截止日期：</strong>{workOrder.dueDate}</p>
          <p><strong>创建时间：</strong>{formatDateTime(workOrder.createdAt)}</p>
          <p><strong>更新时间：</strong>{formatDateTime(workOrder.updatedAt)}</p>
        </div>
        {#if workOrder.note}
          <div class="status-info">
            <p><strong>备注：</strong>{workOrder.note}</p>
          </div>
        {/if}

        {#if workOrder.status !== '已完成' && workOrder.status !== '已取消'}
          <div class="status-info">
            <p style="margin-bottom: 8px;"><strong>状态流转：</strong></p>
            <div style="display: flex; gap: 8px; flex-wrap: wrap;">
              {#each getAvailableStatuses(workOrder).filter((s) => s !== workOrder.status) as status}
                <button
                  type="button"
                  on:click={() => handleStatusChange(status)}
                >
                  {status}
                </button>
              {/each}
            </div>
          </div>
        {/if}

        <div class="modal-actions">
          <button type="button" class="secondary" on:click={goEdit}>
            <Save size={16} />编辑工单
          </button>
          <button type="button" on:click={close}>
            关闭
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}
