<script>
  import { Search, List, Plus, Clock, Undo2, RotateCcw, Calendar, XCircle, Wrench, Package, Trash2 } from 'lucide-svelte';
  import { allRecords } from '$lib/scheduleStore.js';
  import { filterRecords, formatDateTime } from '$lib/recordsStore.js';

  export let recordQuery = '';
  $: records = $allRecords;

  $: filteredRecords = (records, filterRecords({
    query: recordQuery
  }));
</script>

<section class="panel">
  <div class="record-header">
    <h2><List size={18} />借还记录</h2>
    <span class="record-count">共 {records.length} 条记录</span>
  </div>
  <div class="record-toolbar">
    <label><Search size={16} /><input bind:value={recordQuery} placeholder="搜索服装名称或剧目" /></label>
  </div>
  <div class="record-list">
    {#each filteredRecords as record}
      <div class="record-item">
        <div class="record-type-badge record-type-{record.type}">
          {#if record.type === '新增'}
            <Plus size={14} />
          {:else if record.type === '借出'}
            <Clock size={14} />
          {:else if record.type === '归还'}
            <Undo2 size={14} />
          {:else if record.type === '清洗'}
            <RotateCcw size={14} />
          {:else if record.type === '预约'}
            <Calendar size={14} />
          {:else if record.type === '取消预约'}
            <XCircle size={14} />
          {:else if record.type === '工单创建'}
            <Plus size={14} />
          {:else if record.type === '工单更新'}
            <Wrench size={14} />
          {:else if record.type === '装箱单创建'}
            <Package size={14} />
          {:else if record.type === '装箱单删除'}
            <Trash2 size={14} />
          {/if}
          {record.type}
        </div>
        <div class="record-content">
          <div class="record-title-row">
            <strong class="record-name">{record.costumeName}</strong>
            <span class="record-play-tag">{record.play}</span>
          </div>
          <p class="record-summary">{record.summary}</p>
          <div class="record-footer">
            <span class="record-operator">操作者：{record.operator}</span>
            <span class="record-time">{formatDateTime(record.timestamp)}</span>
          </div>
        </div>
      </div>
    {/each}
    {#if filteredRecords.length === 0}
      <div class="record-empty">
        <List size={32} />
        <p>暂无记录</p>
        <span>进行操作后记录将显示在这里</span>
      </div>
    {/if}
  </div>
</section>
