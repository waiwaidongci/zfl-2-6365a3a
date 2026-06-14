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
