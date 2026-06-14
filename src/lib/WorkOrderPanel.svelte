<script>
  import { Search, Plus, Wrench, Droplets, AlertTriangle, CheckCircle, Save, Eye, Calendar, Package } from 'lucide-svelte';
  import { globalIndex } from '$lib/dataIndex.js';
  import {
    pendingWorkOrderCount,
    inProgressWorkOrderCount,
    completedWorkOrderCount,
    overdueWorkOrderCount,
    costumesAvailableForWorkOrder,
    allWorkOrders
  } from '$lib/scheduleStore.js';
  import {
    filterWorkOrders,
    getAvailableStatuses,
    updateWorkOrderStatus
  } from '$lib/workOrderStore.js';
  import { formatDateTime, addRecord } from '$lib/recordsStore.js';
  import { createEventDispatcher } from 'svelte';

  const dispatch = createEventDispatcher();

  export let showStats = true;
  export let workOrderQuery = '';
  export let workOrderFilter = '全部';
  export let workOrderTypeFilter = '全部';

  $: workOrders = $allWorkOrders;

  export function iso(offset = 0) {
    const date = new Date();
    date.setDate(date.getDate() + offset);
    return date.toISOString().slice(0, 10);
  }

  $: filteredWorkOrders = (workOrders, filterWorkOrders({
    query: workOrderQuery,
    status: workOrderFilter === '全部' ? undefined : workOrderFilter,
    type: workOrderTypeFilter === '全部' ? undefined : workOrderTypeFilter
  }));

  export const createEvent = (name, detail = {}) => {
    const event = new CustomEvent(name, { detail, bubbles: false });
    return event;
  };
</script>

{#if showStats}
  <section class="workorder-stats">
    <div class="stats-panel">
      <div class="stats-title">工单总览</div>
      <div class="stats-grid">
        <div class="stat-card stat-pending">
          <div class="stat-icon"><Droplets size={24} /></div>
          <div class="stat-content">
            <div class="stat-number">{$pendingWorkOrderCount}</div>
            <div class="stat-label">待处理工单</div>
          </div>
        </div>
        <div class="stat-card stat-progress">
          <div class="stat-icon"><Wrench size={24} /></div>
          <div class="stat-content">
            <div class="stat-number">{$inProgressWorkOrderCount}</div>
            <div class="stat-label">处理中</div>
          </div>
        </div>
        <div class="stat-card stat-done">
          <div class="stat-icon"><CheckCircle size={24} /></div>
          <div class="stat-content">
            <div class="stat-number">{$completedWorkOrderCount}</div>
            <div class="stat-label">已完成</div>
          </div>
        </div>
        <div class="stat-card stat-overdue" class:has-overdue={$overdueWorkOrderCount > 0}>
          <div class="stat-icon"><AlertTriangle size={24} /></div>
          <div class="stat-content">
            <div class="stat-number">{$overdueWorkOrderCount}</div>
            <div class="stat-label">逾期工单</div>
          </div>
        </div>
      </div>
    </div>
  </section>
{/if}

<section class="panel">
  <div class="record-header">
    <h2><Wrench size={18} />清洗与维修工单</h2>
    <div style="display: flex; gap: 10px; align-items: center;">
      <span class="record-count">共 {filteredWorkOrders.length} 条</span>
      <button
        type="button"
        class="small-btn"
        on:click={(e) => {
          e.preventDefault();
          e.stopPropagation();
          dispatch('open-create', { costumeId: null, type: '维修' });
        }}
      >
        <Plus size={14} />新建工单
      </button>
    </div>
  </div>
  <div class="record-toolbar">
    <label><Search size={16} /><input bind:value={workOrderQuery} placeholder="搜索服装/剧目/负责人" /></label>
    <div style="display: flex; gap: 8px;">
      <select bind:value={workOrderTypeFilter}>
        <option>全部</option>
        <option>清洗</option>
        <option>维修</option>
      </select>
      <select bind:value={workOrderFilter}>
        <option>全部</option>
        <option>待处理</option>
        <option>处理中</option>
        <option>已完成</option>
        <option>已取消</option>
        <option>已逾期</option>
      </select>
    </div>
  </div>
  <div class="record-list">
    {#each filteredWorkOrders as workOrder}
      {@const isOverdue = (workOrder.status === '待清洗' || workOrder.status === '清洗中' || workOrder.status === '待维修' || workOrder.status === '维修中') && workOrder.dueDate && new Date(workOrder.dueDate) < new Date(iso(0))}
      <div class="record-item" class:record-cancelled={workOrder.status === '已取消'} class:record-overdue={isOverdue}>
        <div class="record-type-badge record-type-{workOrder.type}">
          {#if workOrder.type === '清洗'}
            <Droplets size={14} />
          {:else}
            <Wrench size={14} />
          {/if}
          {workOrder.type}
        </div>
        <div class="record-content">
          <div class="record-title-row">
            <strong class="record-name">{workOrder.costumeName}</strong>
            <span class="record-play-tag">{workOrder.play}</span>
            <span class="record-play-tag reservation-date-tag"><Calendar size={12} />截止：{workOrder.dueDate}</span>
            <span class="record-play-tag" style="background: {workOrder.status === '已完成' ? '#e6f0e6' : workOrder.status === '已取消' ? '#f6e6e6' : isOverdue ? '#fff4e6' : '#e6eef6'}; color: {workOrder.status === '已完成' ? '#2d5a2d' : workOrder.status === '已取消' ? '#8a2d2d' : isOverdue ? '#8a5a1a' : '#1a4a8a'};">
              {workOrder.status}
            </span>
          </div>
          <p class="record-summary">
            负责人：{workOrder.assignee || '未分配'}
            {#if workOrder.note} · 备注：{workOrder.note}{/if}
          </p>
          <div class="record-footer">
            <span class="record-operator">创建时间：{formatDateTime(workOrder.createdAt)}</span>
            <div style="display: flex; gap: 6px;">
              {#if workOrder.status !== '已完成' && workOrder.status !== '已取消'}
                {#each getAvailableStatuses(workOrder).filter((s) => s !== workOrder.status) as status}
                  <button
                    type="button"
                    class="small-btn"
                    on:click={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      updateWorkOrderStatus(workOrder.id, status, { addRecordFn: addRecord });
                      dispatch('status-updated', { id: workOrder.id, status });
                    }}
                  >
                    {status}
                  </button>
                {/each}
              {/if}
              <button
                type="button"
                class="secondary small-btn"
                on:click={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  dispatch('open-edit', { id: workOrder.id });
                }}
              >
                <Save size={12} />编辑
              </button>
              <button
                type="button"
                class="secondary small-btn"
                on:click={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  dispatch('open-detail', { id: workOrder.id });
                }}
              >
                <Eye size={12} />详情
              </button>
            </div>
          </div>
        </div>
      </div>
    {/each}
    {#if filteredWorkOrders.length === 0}
      <div class="record-empty">
        <Wrench size={32} />
        <p>暂无工单</p>
        <span>服装归还时将自动生成清洗工单，或点击「新建工单」创建维修工单</span>
      </div>
    {/if}
  </div>
</section>
