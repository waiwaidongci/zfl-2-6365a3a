<script>
  import { onMount } from 'svelte';
  import {
    ClipboardList,
    Plus,
    Search,
    Calendar,
    CheckCircle,
    AlertTriangle,
    Trash2,
    Eye,
    X,
    Play,
    CheckCheck,
    MapPin,
    AlertOctagon,
    Clock
  } from 'lucide-svelte';
  import {
    getAllInventoryTasks,
    createInventoryTask,
    deleteInventoryTask,
    TASK_STATUS,
    formatTime
  } from '$lib/inventoryStore.js';
  import { globalIndex } from '$lib/dataIndex.js';

  const costumes = [];

  let tasks = [];
  let query = '';
  let statusFilter = '全部';
  let showCreateModal = false;
  let createForm = { name: '', note: '', playFilter: '全部剧目' };
  let showDeleteConfirmId = null;

  $: plays = ['全部剧目', ...globalIndex.getUniqueCostumePlaysSorted()];

  function refreshTasks() {
    tasks = getAllInventoryTasks();
  }

  onMount(() => {
    refreshTasks();
  });

  $: filteredTasks = globalIndex.filterInventoryTasks({
    query,
    statusFilter
  });

  $: inProgressCount = globalIndex.getInventoryTasksByStatus(TASK_STATUS.IN_PROGRESS).length;
  $: completedCount = globalIndex.getInventoryTasksByStatus(TASK_STATUS.COMPLETED).length;

  function openCreateModal() {
    createForm = { name: '', note: '', playFilter: '全部剧目' };
    showCreateModal = true;
  }

  function closeCreateModal() {
    showCreateModal = false;
  }

  function confirmCreate() {
    if (costumes.length === 0) {
      alert('暂无服装档案，无法创建盘点任务');
      return;
    }
    createInventoryTask(createForm.name, createForm.note, createForm.playFilter);
    refreshTasks();
    closeCreateModal();
  }

  function askDelete(taskId) {
    showDeleteConfirmId = taskId;
  }

  function cancelDelete() {
    showDeleteConfirmId = null;
  }

  function confirmDelete() {
    if (!showDeleteConfirmId) return;
    deleteInventoryTask(showDeleteConfirmId);
    refreshTasks();
    showDeleteConfirmId = null;
  }

  export function refresh() {
    refreshTasks();
  }
</script>

<section class="inventory-panel">
  <div class="inventory-header">
    <div class="inventory-title">
      <ClipboardList size={20} />
      <h2>服装盘点</h2>
    </div>
    <div class="inventory-stats">
      <span class="stat-badge stat-progress">
        <Clock size={14} />
        进行中 {inProgressCount}
      </span>
      <span class="stat-badge stat-done">
        <CheckCircle size={14} />
        已完成 {completedCount}
      </span>
      <button type="button" class="create-btn" on:click={openCreateModal}>
        <Plus size={16} />新建盘点
      </button>
    </div>
  </div>

  <div class="inventory-toolbar">
    <label class="search-label">
      <Search size={16} />
      <input bind:value={query} placeholder="搜索盘点任务" />
    </label>
    <select bind:value={statusFilter}>
      <option>全部</option>
      <option>进行中</option>
      <option>已完成</option>
    </select>
  </div>

  <div class="inventory-list">
    {#each filteredTasks as task}
      <div class="inventory-task-card" class:task-completed={task.status === TASK_STATUS.COMPLETED}>
      <button
        type="button"
        class="task-main"
        on:click={() => {
          const event = new CustomEvent('select-task', { detail: task.id });
          document.dispatchEvent(event);
        }}
      >
        <div class="task-header">
          <strong class="task-name">{task.name}</strong>
          <span class="task-status-badge {task.status === TASK_STATUS.COMPLETED ? 'status-done' : 'status-progress'}">
            {#if task.status === TASK_STATUS.COMPLETED}
              <CheckCircle size={12} />
            {:else}
              <Play size={12} />
            {/if}
            {task.status}
          </span>
        </div>
        <div class="task-meta">
          <span class="task-play"><MapPin size={12} />{task.playFilter}</span>
          <span class="task-date"><Calendar size={12} />{formatTime(task.createdAt)}</span>
        </div>
        {#if task.note}
          <p class="task-note">{task.note}</p>
        {/if}
        <div class="task-progress">
          <div class="progress-bar">
            <div
              class="progress-fill"
              style="width: {task.totalCount > 0 ? (task.completedCount / task.totalCount * 100) : 0}%"
            ></div>
          </div>
          <span class="progress-text">{task.completedCount}/{task.totalCount} 件已盘点
          </span>
        </div>
        <div class="task-breakdown">
          <span class="breakdown-item breakdown-normal">
          <CheckCircle size={12} />正常 {task.normalCount}
        </span>
          <span class="breakdown-item breakdown-missing">
          <AlertOctagon size={12} />缺失 {task.missingCount}
        </span>
          <span class="breakdown-item breakdown-location">
          <MapPin size={12} />位置不符 {task.locationMismatchCount}
        </span>
          <span class="breakdown-item breakdown-status">
          <AlertTriangle size={12} />状态不符 {task.statusMismatchCount}
        </span>
        </div>
      </button>
      <div class="task-actions">
        <button
          type="button"
          class="small-btn"
          on:click={() => {
            const event = new CustomEvent('select-task', { detail: task.id });
            document.dispatchEvent(event);
          }}
        >
          <Eye size={12} />查看
        </button>
        <button type="button" class="danger-outline small-btn" on:click={() => askDelete(task.id)}>
          <Trash2 size={12} />删除
        </button>
      </div>
    </div>
    {/each}
    {#if filteredTasks.length === 0}
      <div class="inventory-empty">
        <ClipboardList size={32} />
        <p>暂无盘点任务</p>
        <span>点击「新建盘点」开始第一次盘点</span>
      </div>
    {/if}
  </div>

  {#if showCreateModal}
    <div class="modal-overlay" role="presentation" on:click={closeCreateModal}>
      <div
        class="modal"
        role="dialog"
        aria-modal="true"
        on:click|stopPropagation
        tabindex="-1"
      >
        <div class="modal-header">
          <h2>新建盘点任务</h2>
          <button type="button" class="icon-btn" on:click={closeCreateModal} aria-label="关闭">
            <X size={20} />
          </button>
        </div>
        <form class="modal-body" on:submit|preventDefault={confirmCreate}>
          <label>
            <span>任务名称</span>
            <input bind:value={createForm.name} placeholder="留空将自动生成名称" />
          </label>
          <label>
            <span>盘点范围</span>
            <select bind:value={createForm.playFilter}>
              {#each plays as play}
                <option>{play}</option>
              {/each}
            </select>
          </label>
          <label>
            <span>备注</span>
            <input bind:value={createForm.note} placeholder="选填，如盘点原因、范围说明等" />
          </label>
          <div class="modal-hint">
            将从服装档案中生成盘点项，共 {createForm.playFilter === '全部剧目' ? costumes.length : costumes.filter((c) => c.play === createForm.playFilter).length} 件服装将被纳入盘点。
          </div>
          <div class="modal-actions">
            <button type="button" class="secondary" on:click={closeCreateModal}>取消</button>
            <button type="submit">
              <Plus size={16} />创建盘点任务
            </button>
          </div>
        </form>
      </div>
    </div>
  {/if}

  {#if showDeleteConfirmId}
    <div class="modal-overlay" role="presentation" on:click={cancelDelete}>
      <div
        class="modal modal-small"
        role="dialog"
        aria-modal="true"
        on:click|stopPropagation
      >
        <div class="modal-header">
          <h2>确认删除</h2>
          <button type="button" class="icon-btn" on:click={cancelDelete} aria-label="关闭">
            <X size={20} />
          </button>
        </div>
        <div class="modal-body">
          <p>确定要删除这个盘点任务吗？所有盘点明细也将被删除，此操作不可撤销。</p>
          <div class="modal-actions">
            <button type="button" class="secondary" on:click={cancelDelete}>取消</button>
            <button type="button" class="danger" on:click={confirmDelete}>
              <Trash2 size={16} />确认删除
            </button>
          </div>
        </div>
      </div>
    </div>
  {/if}
</section>

<style>
  .inventory-panel {
    background: #fff;
    border: 1px solid #e4d8cc;
    border-radius: 8px;
    padding: 18px;
    box-shadow: 0 12px 30px rgb(62 42 24 / .08);
  }

  .inventory-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 14px;
    flex-wrap: wrap;
    gap: 10px;
  }

  .inventory-title {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .inventory-title h2 {
    margin: 0;
    font-size: 18px;
  }

  .inventory-stats {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }

  .stat-badge {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 5px 10px;
    border-radius: 6px;
    font-size: 12px;
    font-weight: 500;
  }

  .stat-progress {
    background: #fff4e6;
    color: #8a5a1a;
  }

  .stat-done {
    background: #e6f0e6;
    color: #2d5a2d;
  }

  .create-btn {
    background: #603d2d;
    color: #fff;
    padding: 8px 14px;
    border-radius: 8px;
    font-size: 14px;
  }

  .inventory-toolbar {
    display: grid;
    grid-template-columns: 1fr 150px;
    gap: 10px;
    margin-bottom: 14px;
  }

  .search-label {
    display: flex;
    align-items: center;
    gap: 8px;
    border: 1px solid #d8c8ba;
    border-radius: 8px;
    padding: 0 10px;
  }

  .search-label input {
    border: 0;
    padding-left: 0;
  }

  .inventory-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
    max-height: 480px;
    overflow-y: auto;
  }

  .inventory-task-card {
    border: 1px solid #eadfd4;
    border-radius: 8px;
    background: #fffaf5;
    overflow: hidden;
    transition: transform .15s ease, box-shadow .15s ease;
  }

  .inventory-task-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 18px rgb(62 42 24 / .12);
  }

  .task-completed {
    opacity: 0.85;
  }

  .task-main {
    width: 100%;
    text-align: left;
    background: transparent;
    border: 0;
    padding: 14px;
    cursor: pointer;
    color: inherit;
    font: inherit;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .task-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 10px;
  }

  .task-name {
    font-size: 15px;
    color: #26211c;
    font-weight: 600;
  }

  .task-status-badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 3px 8px;
    border-radius: 4px;
    font-size: 12px;
    font-weight: 500;
    flex-shrink: 0;
  }

  .status-progress {
    background: #fff4e6;
    color: #8a5a1a;
  }

  .status-done {
    background: #e6f0e6;
    color: #2d5a2d;
  }

  .task-meta {
    display: flex;
    gap: 12px;
    font-size: 12px;
    color: #6b5a4d;
  }

  .task-meta span {
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }

  .task-note {
    margin: 0;
    font-size: 13px;
    color: #6b5a4d;
    line-height: 1.4;
  }

  .task-progress {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .progress-bar {
    flex: 1;
    height: 6px;
    background: #f0e6dc;
    border-radius: 3px;
    overflow: hidden;
  }

  .progress-fill {
    height: 100%;
    background: linear-gradient(90deg, #603d2d, #8a5b41);
    border-radius: 3px;
    transition: width .3s ease;
  }

  .progress-text {
    font-size: 12px;
    color: #6b5a4d;
    flex-shrink: 0;
  }

  .task-breakdown {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .breakdown-item {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    padding: 3px 8px;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 500;
  }

  .breakdown-normal {
    background: #e6f0e6;
    color: #2d5a2d;
  }

  .breakdown-missing {
    background: #fdecea;
    color: #8a2d2d;
  }

  .breakdown-location {
    background: #fff4e6;
    color: #8a5a1a;
  }

  .breakdown-status {
    background: #e6eef6;
    color: #1a4a8a;
  }

  .task-actions {
    display: flex;
    gap: 6px;
    padding: 0 14px 12px;
    border-top: 1px solid #f0e6dc;
    padding-top: 10px;
    justify-content: flex-end;
  }

  .small-btn {
    padding: 6px 12px;
    font-size: 12px;
    min-height: auto;
    display: inline-flex;
    align-items: center;
    gap: 5px;
  }

  .danger-outline {
    background: transparent;
    color: #b84a3b;
    border: 1px solid #d9b5ad;
  }

  .danger-outline:hover {
    background: #fdf0ec;
  }

  .inventory-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    padding: 40px 20px;
    color: #8a7665;
    text-align: center;
  }

  .inventory-empty p {
    margin: 0;
    font-size: 15px;
    color: #6b5a4d;
  }

  .inventory-empty span {
    font-size: 13px;
  }

  .modal-overlay {
    position: fixed;
    inset: 0;
    background: rgb(38 33 28 / .55);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 16px;
    z-index: 200;
  }

  .modal {
    background: #fff;
    border-radius: 12px;
    width: 100%;
    max-width: 480px;
    max-height: 90vh;
    overflow-y: auto;
    box-shadow: 0 24px 60px rgb(38 33 28 / .25);
  }

  .modal-small {
    max-width: 400px;
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px 18px;
    border-bottom: 1px solid #e4d8cc;
    position: sticky;
    top: 0;
    background: #fff;
    border-radius: 12px 12px 0 0;
  }

  .modal-header h2 {
    margin: 0;
    font-size: 16px;
  }

  .icon-btn {
    background: transparent;
    color: #6b5a4d;
    padding: 6px;
    border-radius: 6px;
    border: 0;
    cursor: pointer;
  }

  .icon-btn:hover {
    background: #f6efe7;
  }

  .modal-body {
    padding: 18px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .modal-body label {
    display: flex;
    flex-direction: column;
    gap: 6px;
    font-size: 14px;
    color: #6b5a4d;
  }

  .modal-body label span {
    font-weight: 500;
  }

  .modal-body input,
  .modal-body select {
    width: 100%;
    border: 1px solid #d8c8ba;
    border-radius: 8px;
    padding: 10px 12px;
    background: #fff;
    color: #26211c;
    font: inherit;
  }

  .modal-hint {
    font-size: 13px;
    color: #8a7665;
    padding: 10px 12px;
    background: #faf6f2;
    border-radius: 8px;
  }

  .modal-actions {
    display: flex;
    gap: 10px;
    margin-top: 8px;
  }

  .modal-actions button {
    flex: 1;
  }

  .secondary {
    background: #efe4d9;
    color: #37261d;
  }

  .danger {
    background: #b84a3b;
    color: #fff;
  }

  @media (max-width: 900px) {
    .inventory-toolbar {
      grid-template-columns: 1fr;
    }
    .task-meta {
      flex-wrap: wrap;
    }
    .task-breakdown {
      gap: 4px;
    }
  }
</style>
