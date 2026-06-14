<script>
  import { Search, CalendarDays, Calendar, AlertTriangle, XCircle } from 'lucide-svelte';
  import { createEventDispatcher } from 'svelte';
  import { allReservations } from '$lib/scheduleStore.js';
  import { filterReservations, cancelReservation } from '$lib/reservationStore.js';
  import { formatDateTime, addRecord } from '$lib/recordsStore.js';

  const dispatch = createEventDispatcher();

  export function iso(offset = 0) {
    const date = new Date();
    date.setDate(date.getDate() + offset);
    return date.toISOString().slice(0, 10);
  }

  export let reservationQuery = '';
  export let reservationFilter = '全部';

  $: reservations = $allReservations;

  $: filteredReservations = (reservations, filterReservations({
    query: reservationQuery,
    status: reservationFilter === '全部' ? undefined : reservationFilter
  }));

  function handleCancel(id) {
    cancelReservation(id, { addRecordFn: addRecord });
    dispatch('cancelled', { id });
  }
</script>

<section class="panel">
  <div class="record-header">
    <h2><CalendarDays size={18} />排练预约</h2>
    <span class="record-count">共 {filteredReservations.length} 条</span>
  </div>
  <div class="record-toolbar">
    <label><Search size={16} /><input bind:value={reservationQuery} placeholder="搜索服装/剧目/预约方" /></label>
    <select bind:value={reservationFilter}>
      <option>全部</option>
      <option>有效</option>
      <option>即将到来</option>
      <option>已过期</option>
      <option>已取消</option>
    </select>
  </div>
  <div class="record-list">
    {#each filteredReservations as reservation}
      <div class="record-item" class:record-cancelled={reservation.status === 'cancelled'} class:record-overdue={reservation.status === 'active' && reservation.date < iso(0)}>
        <div class="record-type-badge record-type-{reservation.status === 'cancelled' ? '取消预约' : (reservation.date < iso(0) ? '已过期' : '预约')}">
          {#if reservation.status === 'cancelled'}
            <XCircle size={14} />
            已取消
          {:else if reservation.date < iso(0)}
            <AlertTriangle size={14} />
            已过期
          {:else}
            <Calendar size={14} />
            预约
          {/if}
        </div>
        <div class="record-content">
          <div class="record-title-row">
            <strong class="record-name">{reservation.costumeName}</strong>
            <span class="record-play-tag">{reservation.play}</span>
            <span class="record-play-tag reservation-date-tag"><Calendar size={12} />{reservation.date}</span>
          </div>
          <p class="record-summary">
            {reservation.type === '演员' ? '演员' : '场次'}：{reservation.reservedFor}
            {#if reservation.note} · 备注：{reservation.note}{/if}
          </p>
          <div class="record-footer">
            <span class="record-operator">创建时间：{formatDateTime(reservation.createdAt)}</span>
            {#if reservation.status === 'active'}
              <button
                type="button"
                class="danger-outline small-btn"
                on:click={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleCancel(reservation.id);
                }}
              >
                <XCircle size={12} />取消预约
              </button>
            {/if}
          </div>
        </div>
      </div>
    {/each}
    {#if filteredReservations.length === 0}
      <div class="record-empty">
        <CalendarDays size={32} />
        <p>暂无预约</p>
        <span>点击服装卡片上的「预约」按钮创建新预约</span>
      </div>
    {/if}
  </div>
</section>

<style>
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
  .record-type-预约 { background: #e6eef6; color: #1a4a8a; }
  .record-type-取消预约 { background: #f6e6e6; color: #8a2d2d; }
  .record-type-已过期 { background: #fff4e6; color: #8a5a1a; }
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
  .danger-outline { background: transparent; color: #b84a3b; border: 1px solid #d9b5ad; }
  .danger-outline:hover { background: #fdf0ec; }
</style>
