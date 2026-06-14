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

<style>
  .panel { background: #fff; border: 1px solid #e4d8cc; border-radius: 8px; padding: 18px; box-shadow: 0 12px 30px rgb(62 42 24 / .08); }
  .record-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
  .record-header h2 { display: flex; align-items: center; gap: 8px; margin: 0; }
  .record-count { font-size: 13px; color: #8a7665; }
  .record-toolbar { margin-bottom: 14px; }
  .record-toolbar label { display: flex; align-items: center; gap: 8px; border: 1px solid #d8c8ba; border-radius: 8px; padding: 0 10px; }
  .record-toolbar label input { border: 0; padding-left: 0; }
  .record-list { display: flex; flex-direction: column; gap: 10px; max-height: 500px; overflow-y: auto; }
  .record-item { display: flex; gap: 12px; padding: 14px; border: 1px solid #eadfd4; border-radius: 8px; background: #fffaf5; }
  .record-type-badge { display: inline-flex; align-items: center; gap: 5px; padding: 4px 10px; border-radius: 6px; font-size: 12px; font-weight: 500; flex-shrink: 0; height: fit-content; }
  .record-type-新增 { background: #e6f0e6; color: #2d5a2d; }
  .record-type-借出 { background: #fff0e6; color: #8a4a1a; }
  .record-type-归还 { background: #e6eef6; color: #1a4a8a; }
  .record-type-清洗 { background: #f0e6f6; color: #5a1a8a; }
  .record-type-预约 { background: #e6eef6; color: #1a4a8a; }
  .record-type-取消预约 { background: #f6e6e6; color: #8a2d2d; }
  .record-type-已过期 { background: #fff4e6; color: #8a5a1a; }
  .record-type-工单创建 { background: #e6f0f6; color: #1a5a8a; }
  .record-type-工单更新 { background: #fff4e6; color: #8a5a1a; }
  .record-type-维修 { background: #f6e6e6; color: #8a1a2d; }
  .record-type-装箱单创建 { background: #e6f0e6; color: #2d5a2d; }
  .record-type-装箱单删除 { background: #f6e6e6; color: #8a2d2d; }
  .record-content { flex: 1; min-width: 0; }
  .record-title-row { display: flex; align-items: center; gap: 10px; margin-bottom: 6px; flex-wrap: wrap; }
  .record-name { font-size: 15px; color: #26211c; }
  .record-play-tag { font-size: 12px; color: #6b5a4d; background: #f0e6dc; padding: 2px 8px; border-radius: 4px; display: inline-flex; align-items: center; gap: 4px; }
  .record-summary { margin: 0 0 8px; font-size: 13px; color: #4a3b30; line-height: 1.5; }
  .record-footer { display: flex; justify-content: space-between; align-items: center; gap: 10px; flex-wrap: wrap; }
  .record-operator { font-size: 12px; color: #6b5a4d; }
  .record-time { font-size: 12px; color: #8a7665; font-family: 'SF Mono', Monaco, 'Courier New', monospace; }
  .record-empty { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 40px 20px; color: #8a7665; }
  .record-empty p { margin: 0; font-size: 15px; color: #6b5a4d; }
  .record-empty span { font-size: 13px; }
  .record-cancelled { opacity: 0.55; background: #faf6f2; }
  .record-overdue { border-color: #e0c9b8; background: #fff8f0; }
</style>
