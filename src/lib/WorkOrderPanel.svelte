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

<style>
  .workorder-stats { margin: 16px 0; }
  .stats-panel { background: #fff; border: 1px solid #e4d8cc; border-radius: 8px; padding: 20px; box-shadow: 0 12px 30px rgb(62 42 24 / .08); }
  .stats-title { font-size: 16px; font-weight: 600; color: #3b2f26; margin-bottom: 16px; display: flex; align-items: center; gap: 8px; }
  .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; }
  .stat-card { display: flex; align-items: center; gap: 14px; padding: 16px; border-radius: 10px; border: 1px solid #eadfd4; background: #fffaf5; transition: transform .15s ease, box-shadow .15s ease; }
  .stat-card:hover { transform: translateY(-2px); box-shadow: 0 6px 18px rgb(62 42 24 / .1); }
  .stat-icon { width: 48px; height: 48px; border-radius: 10px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
  .stat-pending .stat-icon { background: #e6eef6; color: #1a4a8a; }
  .stat-progress .stat-icon { background: #fff4e6; color: #8a5a1a; }
  .stat-done .stat-icon { background: #e6f0e6; color: #2d5a2d; }
  .stat-overdue .stat-icon { background: #f6e6e6; color: #8a2d2d; }
  .stat-overdue.has-overdue { border-color: #d98664; background: #fff5ef; }
  .stat-content { flex: 1; }
  .stat-number { font-size: 28px; font-weight: 700; color: #26211c; line-height: 1; }
  .stat-label { font-size: 13px; color: #6b5a4d; margin-top: 4px; }
  .panel { background: #fff; border: 1px solid #e4d8cc; border-radius: 8px; padding: 18px; box-shadow: 0 12px 30px rgb(62 42 24 / .08); }
  .record-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
  .record-header h2 { display: flex; align-items: center; gap: 8px; margin: 0; }
  .record-count { font-size: 13px; color: #8a7665; }
  .record-toolbar { margin-bottom: 14px; display: grid; grid-template-columns: 1fr 150px; gap: 10px; align-items: center; }
  .record-toolbar label { display: flex; align-items: center; gap: 8px; border: 1px solid #d8c8ba; border-radius: 8px; padding: 0 10px; }
  .record-toolbar label input { border: 0; padding-left: 0; }
  .record-list { display: flex; flex-direction: column; gap: 10px; max-height: 500px; overflow-y: auto; }
  .record-item { display: flex; gap: 12px; padding: 14px; border: 1px solid #eadfd4; border-radius: 8px; background: #fffaf5; }
  .record-type-badge { display: inline-flex; align-items: center; gap: 5px; padding: 4px 10px; border-radius: 6px; font-size: 12px; font-weight: 500; flex-shrink: 0; height: fit-content; }
  .record-type-清洗 { background: #f0e6f6; color: #5a1a8a; }
  .record-type-维修 { background: #f6e6e6; color: #8a1a2d; }
  .record-content { flex: 1; min-width: 0; }
  .record-title-row { display: flex; align-items: center; gap: 10px; margin-bottom: 6px; flex-wrap: wrap; }
  .record-name { font-size: 15px; color: #26211c; }
  .record-play-tag { font-size: 12px; color: #6b5a4d; background: #f0e6dc; padding: 2px 8px; border-radius: 4px; display: inline-flex; align-items: center; gap: 4px; }
  .reservation-date-tag { background: #e6eef6; color: #1a4a8a; }
  .record-summary { margin: 0 0 8px; font-size: 13px; color: #4a3b30; line-height: 1.5; }
  .record-footer { display: flex; justify-content: space-between; align-items: center; gap: 10px; flex-wrap: wrap; }
  .record-operator { font-size: 12px; color: #6b5a4d; }
  .record-time { font-size: 12px; color: #8a7665; font-family: 'SF Mono', Monaco, 'Courier New', monospace; }
  .record-empty { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 40px 20px; color: #8a7665; }
  .record-empty p { margin: 0; font-size: 15px; color: #6b5a4d; }
  .record-empty span { font-size: 13px; }
  .record-cancelled { opacity: 0.55; background: #faf6f2; }
  .record-overdue { border-color: #e0c9b8; background: #fff8f0; }
  .small-btn { padding: 5px 10px; font-size: 12px; min-height: auto; }
  .secondary { background: #efe4d9; color: #37261d; }
</style>
