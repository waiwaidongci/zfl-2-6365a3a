<script>
  import { onMount } from 'svelte';
  import {
    X,
    CheckCircle,
    AlertOctagon,
    MapPin,
    AlertTriangle,
    Clock,
    Search,
    Eye,
    Save,
    Wrench,
    Droplets,
    CheckCheck,
    RotateCcw,
    FileText,
    ArrowLeft,
    Plus,
    Undo2
  } from 'lucide-svelte';
  import {
    getInventoryTaskById,
    getInventoryItemsByTaskId,
    updateInventoryItemStatus,
    completeInventoryTask,
    reopenInventoryTask,
    INVENTORY_STATUS,
    TASK_STATUS,
    formatTime
  } from '$lib/inventoryStore.js';
  import {
    getAll,
    setAll,
    insertOne,
    TABLES
  } from '$lib/database.js';

  export let taskId = null;
  export let onClose = null;

  let task = null;
  let items = [];
  let query = '';
  let statusFilter = '全部';
  let currentView = 'list';
  let selectedItemId = null;
  let editItemForm = {
    actualStatus: '',
    actualLocation: '',
    actualClean: '',
    note: ''
  };
  let showItemModal = false;

  let processingWorkOrders = {};
  let processingReturns = {};

  function refreshData() {
    if (!taskId) return;
    task = getInventoryTaskById(taskId);
    items = getInventoryItemsByTaskId(taskId);
  }

  onMount(() => {
    refreshData();
  });

  $: filteredItems = items.filter((item) => {
    const text = `${item.costumeName}${item.costumePlay}${item.expectedLocation}`;
    const matchesQuery = text.includes(query.trim());
    let matchesStatus = true;
    if (statusFilter === '待盘点') matchesStatus = item.actualStatus === INVENTORY_STATUS.PENDING;
    else if (statusFilter === '正常') matchesStatus = item.actualStatus === INVENTORY_STATUS.NORMAL;
    else if (statusFilter === '缺失') matchesStatus = item.actualStatus === INVENTORY_STATUS.MISSING;
    else if (statusFilter === '位置不符') matchesStatus = item.actualStatus === INVENTORY_STATUS.LOCATION_MISMATCH;
    else if (statusFilter === '状态不符') matchesStatus = item.actualStatus === INVENTORY_STATUS.STATUS_MISMATCH;
    else if (statusFilter === '有差异') matchesStatus =
      item.actualStatus === INVENTORY_STATUS.MISSING ||
      item.actualStatus === INVENTORY_STATUS.LOCATION_MISMATCH ||
      item.actualStatus === INVENTORY_STATUS.STATUS_MISMATCH;
    return matchesQuery && matchesStatus;
  });

  $: discrepancyItems = items.filter(
    (item) =>
      item.actualStatus === INVENTORY_STATUS.MISSING ||
      item.actualStatus === INVENTORY_STATUS.LOCATION_MISMATCH ||
      item.actualStatus === INVENTORY_STATUS.STATUS_MISMATCH
  );

  $: pendingCount = items.filter((i) => i.actualStatus === INVENTORY_STATUS.PENDING).length;
  $: normalCount = items.filter((i) => i.actualStatus === INVENTORY_STATUS.NORMAL).length;
  $: missingCount = items.filter((i) => i.actualStatus === INVENTORY_STATUS.MISSING).length;
  $: locationMismatchCount = items.filter((i) => i.actualStatus === INVENTORY_STATUS.LOCATION_MISMATCH).length;
  $: statusMismatchCount = items.filter((i) => i.actualStatus === INVENTORY_STATUS.STATUS_MISMATCH).length;
  $: completedCount = items.length - pendingCount;
  $: progressPercent = items.length > 0 ? (completedCount / items.length * 100) : 0;

  function openItemDetail(itemId) {
    const item = items.find((i) => i.id === itemId);
    if (!item) return;
    selectedItemId = itemId;
    editItemForm = {
      actualStatus: item.actualStatus,
      actualLocation: item.actualLocation || item.expectedLocation,
      actualClean: item.actualClean || item.expectedClean,
      note: item.note || ''
    };
    showItemModal = true;
  }

  function closeItemModal() {
    showItemModal = false;
    selectedItemId = null;
  }

  function getQuickActualClean(item, status) {
    if (status === INVENTORY_STATUS.NORMAL) return item.expectedClean;
    if (status === INVENTORY_STATUS.STATUS_MISMATCH) {
      if (item.actualClean && item.actualClean !== item.expectedClean) return item.actualClean;
      return item.expectedClean === '待清洗' ? '维修中' : '待清洗';
    }
    return item.actualClean || item.expectedClean;
  }

  function saveItemStatus() {
    if (!selectedItemId) return;
    updateInventoryItemStatus(
      selectedItemId,
      editItemForm.actualStatus,
      editItemForm.actualLocation,
      editItemForm.actualClean,
      editItemForm.note
    );
    refreshData();
    closeItemModal();
    const event = new CustomEvent('inventory-updated');
    document.dispatchEvent(event);
  }

  function quickMark(itemId, status) {
    const item = items.find((i) => i.id === itemId);
    if (!item) return;
    updateInventoryItemStatus(
      itemId,
      status,
      status === INVENTORY_STATUS.NORMAL ? item.expectedLocation : item.actualLocation || item.expectedLocation,
      getQuickActualClean(item, status),
      item.note || ''
    );
    refreshData();
    const event = new CustomEvent('inventory-updated');
    document.dispatchEvent(event);
  }

  function handleComplete() {
    if (!confirm('确定要完成本次盘点吗？完成后将生成差异报告。')) return;
    completeInventoryTask(taskId);
    refreshData();
    const event = new CustomEvent('inventory-updated');
    document.dispatchEvent(event);
  }

  function handleReopen() {
    if (!confirm('确定要重新打开本次盘点吗？')) return;
    reopenInventoryTask(taskId);
    refreshData();
    const event = new CustomEvent('inventory-updated');
    document.dispatchEvent(event);
  }

  function addRecord(type, costume, operator, summary) {
    const records = getAll(TABLES.records);
    const record = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      type,
      costumeName: costume.name,
      play: costume.play,
      operator,
      summary
    };
    setAll(TABLES.records, [record, ...records]);
  }

  function createWorkOrder(type, costume, assignee = '', note = '') {
    const initialStatus = type === '清洗' ? '待清洗' : '待维修';
    const workOrder = {
      id: crypto.randomUUID(),
      type,
      costumeId: costume.id,
      costumeName: costume.name,
      play: costume.play,
      status: initialStatus,
      assignee: assignee || (type === '清洗' ? '张阿姨' : '李师傅'),
      dueDate: (() => {
        const d = new Date();
        d.setDate(d.getDate() + (type === '清洗' ? 2 : 5));
        return d.toISOString().slice(0, 10);
      })(),
      note,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    const workOrders = getAll(TABLES.workOrders);
    setAll(TABLES.workOrders, [workOrder, ...workOrders]);
    addRecord('工单创建', costume, '盘点', `创建${type}工单「${workOrder.id.slice(0, 8)}」，状态：${initialStatus}，负责人：${workOrder.assignee}`);

    const costumes = getAll(TABLES.costumes);
    if (type === '清洗') {
      const updated = costumes.map((c) => c.id === costume.id ? { ...c, clean: '待清洗' } : c);
      setAll(TABLES.costumes, updated);
      addRecord('清洗', costume, '盘点', `「${costume.name}」清洗状态变更为「待清洗」`);
    } else if (type === '维修') {
      const updated = costumes.map((c) => c.id === costume.id ? { ...c, clean: '维修中' } : c);
      setAll(TABLES.costumes, updated);
      addRecord('清洗', costume, '盘点', `「${costume.name}」状态变更为「维修中」`);
    }

    return workOrder;
  }

  function handleCreateWorkOrder(itemId, type) {
    const item = items.find((i) => i.id === itemId);
    if (!item) return;

    const costumes = getAll(TABLES.costumes);
    const costume = costumes.find((c) => c.id === item.costumeId);
    if (!costume) {
      alert('服装档案不存在');
      return;
    }

    processingWorkOrders[itemId] = true;

    setTimeout(() => {
      const note = `盘点差异处理：${item.actualStatus}`;
      createWorkOrder(type, costume, '', note);
      processingWorkOrders[itemId] = false;
      refreshData();
      const event = new CustomEvent('inventory-updated');
      document.dispatchEvent(event);
      alert(`已生成${type}工单`);
    }, 100);
  }

  function handleReturnCostume(itemId) {
    const item = items.find((i) => i.id === itemId);
    if (!item) return;

    const costumes = getAll(TABLES.costumes);
    const costume = costumes.find((c) => c.id === item.costumeId);
    if (!costume) {
      alert('服装档案不存在');
      return;
    }

    if (costume.status !== '借出') {
      alert('该服装当前不在借出状态');
      return;
    }

    if (!confirm('确定要标记该服装为已归还吗？归还后状态将变为待清洗。')) return;

    processingReturns[itemId] = true;

    setTimeout(() => {
      const borrower = costume.borrower;
      const updatedCostumes = costumes.map((c) =>
        c.id === costume.id ? { ...c, borrower: '', due: '', status: '在库', clean: '待清洗' } : c
      );
      setAll(TABLES.costumes, updatedCostumes);

      addRecord('归还', costume, borrower, `${borrower}归还「${costume.name}」，状态变更为待清洗`);
      createWorkOrder('清洗', costume, '张阿姨', `${borrower}归还后自动生成清洗工单`);

      processingReturns[itemId] = false;
      refreshData();
      alert('归还操作已完成，已自动生成清洗工单');
    }, 100);
  }

  function handleMarkMissing(itemId) {
    const item = items.find((i) => i.id === itemId);
    if (!item) return;

    const costumes = getAll(TABLES.costumes);
    const costume = costumes.find((c) => c.id === item.costumeId);
    if (!costume) return;

    if (!confirm('确定要将此服装标记为缺失并写入借还记录吗？')) return;

    addRecord('盘点', costume, '库房管理员', `盘点发现「${costume.name}」缺失，请追查`);
    quickMark(itemId, INVENTORY_STATUS.MISSING);
    alert('已记录缺失情况');
  }

  $: selectedItem = items.find((i) => i.id === selectedItemId);

  function getStatusClass(status) {
    if (status === INVENTORY_STATUS.NORMAL) return 'status-normal';
    if (status === INVENTORY_STATUS.MISSING) return 'status-missing';
    if (status === INVENTORY_STATUS.LOCATION_MISMATCH) return 'status-location';
    if (status === INVENTORY_STATUS.STATUS_MISMATCH) return 'status-status';
    return 'status-pending';
  }

  function getStatusBadgeClass(status) {
    if (status === INVENTORY_STATUS.NORMAL) return 'badge-normal';
    if (status === INVENTORY_STATUS.MISSING) return 'badge-missing';
    if (status === INVENTORY_STATUS.LOCATION_MISMATCH) return 'badge-location';
    if (status === INVENTORY_STATUS.STATUS_MISMATCH) return 'badge-status';
    return 'badge-pending';
  }
</script>

{#if task}
  <div class="inventory-detail-overlay">
    <div class="inventory-detail-modal">
      <div class="detail-header">
        <div class="detail-header-left">
          <button type="button" class="back-btn" on:click={onClose}>
            <ArrowLeft size={18} />
          </button>
          <div>
            <h2>{task.name}</h2>
            <div class="detail-meta">
              <span class="task-status {task.status === TASK_STATUS.COMPLETED ? 'status-done' : 'status-progress'}">
                {#if task.status === TASK_STATUS.COMPLETED}
                  <CheckCircle size={12} />
                {:else}
                  <Clock size={12} />
                {/if}
                {task.status}
              </span>
              <span>创建于 {formatTime(task.createdAt)}</span>
              {#if task.completedAt}
                <span>完成于 {formatTime(task.completedAt)}</span>
              {/if}
            </div>
          </div>
        </div>
        <div class="detail-header-right">
          {#if task.status === TASK_STATUS.IN_PROGRESS}
            <button type="button" class="btn-success" on:click={handleComplete} disabled={pendingCount > 0}>
              <CheckCheck size={16} />完成盘点
            </button>
          {:else}
            <button type="button" class="secondary" on:click={handleReopen}>
              <RotateCcw size={16} />重新盘点
            </button>
          {/if}
          <button type="button" class="icon-btn" on:click={onClose} aria-label="关闭">
            <X size={20} />
          </button>
        </div>
      </div>

      <div class="detail-stats">
        <div class="stat-card stat-total">
          <div class="stat-num">{items.length}</div>
          <div class="stat-label">总件数</div>
        </div>
        <div class="stat-card stat-completed">
          <div class="stat-num">{completedCount}</div>
          <div class="stat-label">已盘点</div>
        </div>
        <div class="stat-card stat-normal">
          <div class="stat-num">{normalCount}</div>
          <div class="stat-label">正常</div>
        </div>
        <div class="stat-card stat-missing">
          <div class="stat-num">{missingCount}</div>
          <div class="stat-label">缺失</div>
        </div>
        <div class="stat-card stat-location">
          <div class="stat-num">{locationMismatchCount}</div>
          <div class="stat-label">位置不符</div>
        </div>
        <div class="stat-card stat-status">
          <div class="stat-num">{statusMismatchCount}</div>
          <div class="stat-label">状态不符</div>
        </div>
      </div>

      <div class="progress-section">
        <div class="progress-bar-large">
          <div class="progress-fill-large" style="width: {progressPercent}%"></div>
        </div>
        <span class="progress-text">{progressPercent.toFixed(1)}% 完成</span>
      </div>

      <div class="view-tabs">
        <button
          type="button"
          class="tab-btn {currentView === 'list' ? 'active' : ''}"
          on:click={() => currentView = 'list'}
        >
          <Eye size={14} />盘点列表
        </button>
        <button
          type="button"
          class="tab-btn {currentView === 'report' ? 'active' : ''}"
          on:click={() => currentView = 'report'}
        >
          <FileText size={14} />差异报告
          {#if discrepancyItems.length > 0}
            <span class="tab-badge">{discrepancyItems.length}</span>
          {/if}
        </button>
      </div>

      {#if currentView === 'list'}
        <div class="list-toolbar">
          <label class="search-label">
            <Search size={16} />
            <input bind:value={query} placeholder="搜索服装名称/剧目/位置" />
          </label>
          <select bind:value={statusFilter}>
            <option>全部</option>
            <option>待盘点</option>
            <option>正常</option>
            <option>缺失</option>
            <option>位置不符</option>
            <option>状态不符</option>
            <option>有差异</option>
          </select>
        </div>

        <div class="items-list">
          {#each filteredItems as item}
            <div class="inventory-item {getStatusClass(item.actualStatus)}">
              <div class="item-main">
                <div class="item-header">
                  <strong class="item-name">{item.costumeName}</strong>
                  <span class="item-badge {getStatusBadgeClass(item.actualStatus)}">
                    {#if item.actualStatus === INVENTORY_STATUS.NORMAL}
                      <CheckCircle size={12} />
                    {:else if item.actualStatus === INVENTORY_STATUS.MISSING}
                      <AlertOctagon size={12} />
                    {:else if item.actualStatus === INVENTORY_STATUS.LOCATION_MISMATCH}
                      <MapPin size={12} />
                    {:else if item.actualStatus === INVENTORY_STATUS.STATUS_MISMATCH}
                      <AlertTriangle size={12} />
                    {:else}
                      <Clock size={12} />
                    {/if}
                    {item.actualStatus}
                  </span>
                </div>
                <div class="item-info">
                  <span class="item-play">{item.costumePlay}</span>
                  {#if item.costumeSize}
                    <span class="item-size">{item.costumeSize}</span>
                  {/if}
                </div>
                <div class="item-expected">
                  <span class="info-label">档案位置：</span>
                  <span>{item.expectedLocation || '未设置'}</span>
                </div>
                <div class="item-expected">
                  <span class="info-label">档案状态：</span>
                  <span>{item.expectedStatus}</span>
                  <span class="clean-tag">{item.expectedClean}</span>
                </div>
                {#if item.actualStatus !== INVENTORY_STATUS.PENDING && item.note}
                  <div class="item-note">
                    <span class="info-label">备注：</span>
                    {item.note}
                  </div>
                {/if}
                {#if item.checkedAt}
                  <div class="item-time">
                    盘点时间：{formatTime(item.checkedAt)}
                  </div>
                {/if}
              </div>

              {#if task.status === TASK_STATUS.IN_PROGRESS}
                <div class="item-actions">
                  <button
                    type="button"
                    class="action-btn action-normal"
                    on:click={() => quickMark(item.id, INVENTORY_STATUS.NORMAL)}
                    title="标记正常"
                  >
                    <CheckCircle size={16} />正常
                  </button>
                  <button
                    type="button"
                    class="action-btn action-missing"
                    on:click={() => quickMark(item.id, INVENTORY_STATUS.MISSING)}
                    title="标记缺失"
                  >
                    <AlertOctagon size={16} />缺失
                  </button>
                  <button
                    type="button"
                    class="action-btn action-location"
                    on:click={() => quickMark(item.id, INVENTORY_STATUS.LOCATION_MISMATCH)}
                    title="位置不符"
                  >
                    <MapPin size={16} />位置
                  </button>
                  <button
                    type="button"
                    class="action-btn action-status"
                    on:click={() => quickMark(item.id, INVENTORY_STATUS.STATUS_MISMATCH)}
                    title="状态不符"
                  >
                    <AlertTriangle size={16} />状态
                  </button>
                  <button
                    type="button"
                    class="action-btn action-detail secondary"
                    on:click={() => openItemDetail(item.id)}
                    title="详细编辑"
                  >
                    <Eye size={16} />详情
                  </button>
                </div>
              {:else}
                <div class="item-actions">
                  <button
                    type="button"
                    class="action-btn action-detail secondary"
                    on:click={() => openItemDetail(item.id)}
                  >
                    <Eye size={16} />查看详情
                  </button>
                </div>
              {/if}
            </div>
          {/each}
          {#if filteredItems.length === 0}
            <div class="items-empty">
              <Search size={24} />
              <p>没有找到匹配的服装</p>
            </div>
          {/if}
        </div>
      {:else}
        <div class="report-section">
          {#if discrepancyItems.length === 0}
            <div class="report-empty">
              <CheckCircle size={40} />
              <p>太棒了！本次盘点没有发现差异</p>
              <span>所有服装都与档案一致</span>
            </div>
          {:else}
            <div class="report-summary">
              <h3>差异汇总</h3>
              <p>共发现 <strong>{discrepancyItems.length}</strong> 项差异，请逐一处理</p>
            </div>

            <div class="discrepancy-list">
              {#each discrepancyItems as item}
                <div class="discrepancy-card {getStatusClass(item.actualStatus)}">
                  <div class="discrepancy-header">
                    <div>
                      <strong class="discrepancy-name">{item.costumeName}</strong>
                      <span class="discrepancy-type {getStatusBadgeClass(item.actualStatus)}">
                        {#if item.actualStatus === INVENTORY_STATUS.MISSING}
                          <AlertOctagon size={12} />
                        {:else if item.actualStatus === INVENTORY_STATUS.LOCATION_MISMATCH}
                          <MapPin size={12} />
                        {:else}
                          <AlertTriangle size={12} />
                        {/if}
                        {item.actualStatus}
                      </span>
                    </div>
                    <span class="discrepancy-play">{item.costumePlay}</span>
                  </div>

                  <div class="discrepancy-details">
                    {#if item.actualStatus === INVENTORY_STATUS.MISSING}
                      <div class="detail-row">
                        <span class="detail-label">档案位置：</span>
                        <span>{item.expectedLocation || '未设置'}</span>
                      </div>
                      <div class="detail-row">
                        <span class="detail-label">档案状态：</span>
                        <span>{item.expectedStatus} / {item.expectedClean}</span>
                      </div>
                    {:else if item.actualStatus === INVENTORY_STATUS.LOCATION_MISMATCH}
                      <div class="detail-row mismatch">
                        <span class="detail-label">档案位置：</span>
                        <span class="old-value">{item.expectedLocation || '未设置'}</span>
                      </div>
                      <div class="detail-row mismatch">
                        <span class="detail-label">实际位置：</span>
                        <span class="new-value">{item.actualLocation || item.expectedLocation}</span>
                      </div>
                    {:else if item.actualStatus === INVENTORY_STATUS.STATUS_MISMATCH}
                      <div class="detail-row mismatch">
                        <span class="detail-label">档案借出状态：</span>
                        <span class="old-value">{item.expectedStatus}</span>
                      </div>
                      <div class="detail-row mismatch">
                        <span class="detail-label">档案清洗状态：</span>
                        <span class="old-value">{item.expectedClean}</span>
                      </div>
                      <div class="detail-row mismatch">
                        <span class="detail-label">实际清洗状态：</span>
                        <span class="new-value">{item.actualClean || item.expectedClean}</span>
                      </div>
                    {/if}
                    {#if item.note}
                      <div class="detail-row">
                        <span class="detail-label">备注：</span>
                        <span>{item.note}</span>
                      </div>
                    {/if}
                  </div>

                  {#if task.status === TASK_STATUS.COMPLETED || task.status === TASK_STATUS.IN_PROGRESS}
                    <div class="discrepancy-actions">
                      {#if item.actualStatus === INVENTORY_STATUS.MISSING}
                        <button
                          type="button"
                          class="action-btn action-detail"
                          on:click={() => handleMarkMissing(item.id)}
                          disabled={processingWorkOrders[item.id]}
                        >
                          <Plus size={14} />记录缺失
                        </button>
                      {/if}

                      {#if item.actualStatus === INVENTORY_STATUS.STATUS_MISMATCH && (item.actualClean || item.expectedClean) === '待清洗'}
                        <button
                          type="button"
                          class="action-btn action-clean"
                          on:click={() => handleCreateWorkOrder(item.id, '清洗')}
                          disabled={processingWorkOrders[item.id]}
                        >
                          {#if processingWorkOrders[item.id]}
                            <Clock size={14} />处理中...
                          {:else}
                            <Droplets size={14} />生成清洗工单
                          {/if}
                        </button>
                      {/if}

                      {#if item.actualStatus === INVENTORY_STATUS.STATUS_MISMATCH || item.actualStatus === INVENTORY_STATUS.MISSING}
                        <button
                          type="button"
                          class="action-btn action-repair"
                          on:click={() => handleCreateWorkOrder(item.id, '维修')}
                          disabled={processingWorkOrders[item.id]}
                        >
                          {#if processingWorkOrders[item.id]}
                            <Clock size={14} />处理中...
                          {:else}
                            <Wrench size={14} />生成维修工单
                          {/if}
                        </button>
                      {/if}

                      {#if item.expectedStatus === '借出'}
                        <button
                          type="button"
                          class="action-btn action-return"
                          on:click={() => handleReturnCostume(item.id)}
                          disabled={processingReturns[item.id]}
                        >
                          {#if processingReturns[item.id]}
                            <Clock size={14} />处理中...
                          {:else}
                            <Undo2 size={14} />标记归还
                          {/if}
                        </button>
                      {/if}

                      <button
                        type="button"
                        class="action-btn secondary"
                        on:click={() => openItemDetail(item.id)}
                      >
                        <Eye size={14} />查看详情
                      </button>
                    </div>
                  {/if}
                </div>
              {/each}
            </div>
          {/if}
        </div>
      {/if}
    </div>

    {#if showItemModal && selectedItemId}
      <div class="item-modal-overlay" role="presentation" on:click={closeItemModal}>
        <div class="item-modal" role="dialog" aria-modal="true" on:click|stopPropagation>
          <div class="modal-header">
            <h3>盘点详情</h3>
            <button type="button" class="icon-btn" on:click={closeItemModal} aria-label="关闭">
              <X size={18} />
            </button>
          </div>
          <div class="modal-body">
              {#if selectedItem}
                <div class="item-info-section">
                  <h4>{selectedItem.costumeName}</h4>
                  <p class="item-play-name">{selectedItem.costumePlay} · {selectedItem.costumeSize || '未填尺码'}</p>
                </div>

                <div class="expected-section">
                  <h5>档案信息</h5>
                  <div class="info-row">
                    <span>存放位置：</span>
                    <strong>{selectedItem.expectedLocation || '未设置'}</strong>
                  </div>
                  <div class="info-row">
                    <span>借出状态：</span>
                    <strong>{selectedItem.expectedStatus}</strong>
                  </div>
                  <div class="info-row">
                    <span>清洗状态：</span>
                    <strong>{selectedItem.expectedClean}</strong>
                  </div>
                </div>

                {#if task.status === TASK_STATUS.IN_PROGRESS}
                  <div class="actual-section">
                    <h5>盘点结果</h5>
                    <label>
                      <span>盘点状态</span>
                      <select bind:value={editItemForm.actualStatus}>
                        <option value={INVENTORY_STATUS.PENDING}>待盘点</option>
                        <option value={INVENTORY_STATUS.NORMAL}>正常</option>
                        <option value={INVENTORY_STATUS.MISSING}>缺失</option>
                        <option value={INVENTORY_STATUS.LOCATION_MISMATCH}>位置不符</option>
                        <option value={INVENTORY_STATUS.STATUS_MISMATCH}>状态不符</option>
                      </select>
                    </label>

                    {#if editItemForm.actualStatus === INVENTORY_STATUS.LOCATION_MISMATCH}
                      <label>
                        <span>实际位置</span>
                        <input bind:value={editItemForm.actualLocation} placeholder="请输入实际存放位置" />
                      </label>
                    {/if}

                    {#if editItemForm.actualStatus === INVENTORY_STATUS.STATUS_MISMATCH}
                      <label>
                        <span>实际清洗状态</span>
                        <select bind:value={editItemForm.actualClean}>
                          <option>已清洗</option>
                          <option>待清洗</option>
                          <option>维修中</option>
                        </select>
                      </label>
                    {/if}

                    <label>
                      <span>备注</span>
                      <input bind:value={editItemForm.note} placeholder="选填，描述差异详情" />
                    </label>
                  </div>
                {:else}
                  <div class="actual-section">
                    <h5>盘点结果</h5>
                    <div class="info-row">
                      <span>状态：</span>
                      <strong class="result-badge {getStatusBadgeClass(selectedItem.actualStatus)}">{selectedItem.actualStatus}</strong>
                    </div>
                    {#if selectedItem.actualLocation && selectedItem.actualStatus === INVENTORY_STATUS.LOCATION_MISMATCH}
                      <div class="info-row">
                        <span>实际位置：</span>
                        <strong>{selectedItem.actualLocation}</strong>
                      </div>
                    {/if}
                    {#if selectedItem.actualClean && selectedItem.actualStatus === INVENTORY_STATUS.STATUS_MISMATCH}
                      <div class="info-row">
                        <span>实际状态：</span>
                        <strong>{selectedItem.actualClean}</strong>
                      </div>
                    {/if}
                    {#if selectedItem.note}
                      <div class="info-row">
                        <span>备注：</span>
                        <span>{selectedItem.note}</span>
                      </div>
                    {/if}
                    {#if selectedItem.checkedAt}
                      <div class="info-row">
                        <span>盘点时间：</span>
                        <span>{formatTime(selectedItem.checkedAt)}</span>
                      </div>
                    {/if}
                  </div>
                {/if}
              {/if}

            <div class="modal-actions">
              <button type="button" class="secondary" on:click={closeItemModal}>
                {task.status === TASK_STATUS.IN_PROGRESS ? '取消' : '关闭'}
              </button>
              {#if task.status === TASK_STATUS.IN_PROGRESS}
                <button type="button" on:click={saveItemStatus}>
                  <Save size={16} />保存
                </button>
              {/if}
            </div>
          </div>
        </div>
      </div>
    {/if}
  </div>
{/if}

<style>
  .inventory-detail-overlay {
    position: fixed;
    inset: 0;
    background: rgb(38 33 28 / .55);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 16px;
    z-index: 250;
  }

  .inventory-detail-modal {
    background: #fff;
    border-radius: 12px;
    width: 100%;
    max-width: 900px;
    max-height: 92vh;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    box-shadow: 0 24px 60px rgb(38 33 28 / .25);
  }

  .detail-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    padding: 16px 20px;
    border-bottom: 1px solid #e4d8cc;
    background: #fffaf5;
    gap: 12px;
  }

  .detail-header-left {
    display: flex;
    align-items: center;
    gap: 12px;
    min-width: 0;
  }

  .back-btn {
    background: #efe4d9;
    color: #37261d;
    border: 0;
    padding: 8px;
    border-radius: 8px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .back-btn:hover {
    background: #e0d0c0;
  }

  .detail-header h2 {
    margin: 0 0 4px;
    font-size: 18px;
  }

  .detail-meta {
    display: flex;
    gap: 12px;
    font-size: 12px;
    color: #6b5a4d;
    flex-wrap: wrap;
    align-items: center;
  }

  .task-status {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 3px 8px;
    border-radius: 4px;
    font-weight: 500;
    font-size: 12px;
  }

  .status-progress {
    background: #fff4e6;
    color: #8a5a1a;
  }

  .status-done {
    background: #e6f0e6;
    color: #2d5a2d;
  }

  .detail-header-right {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;
  }

  .btn-success {
    background: #4a7c4a;
    color: #fff;
    padding: 8px 14px;
    border-radius: 8px;
    font-size: 14px;
  }

  .btn-success:hover {
    background: #3d6b3d;
  }

  .btn-success:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .secondary {
    background: #efe4d9;
    color: #37261d;
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

  .detail-stats {
    display: grid;
    grid-template-columns: repeat(6, 1fr);
    gap: 8px;
    padding: 14px 20px;
    background: #faf6f2;
    border-bottom: 1px solid #e4d8cc;
  }

  .stat-card {
    text-align: center;
    padding: 10px 8px;
    border-radius: 8px;
    background: #fff;
    border: 1px solid #eadfd4;
  }

  .stat-num {
    font-size: 22px;
    font-weight: 700;
    line-height: 1.1;
  }

  .stat-label {
    font-size: 11px;
    color: #6b5a4d;
    margin-top: 4px;
  }

  .stat-total .stat-num { color: #26211c; }
  .stat-completed .stat-num { color: #603d2d; }
  .stat-normal .stat-num { color: #2d5a2d; }
  .stat-missing .stat-num { color: #8a2d2d; }
  .stat-location .stat-num { color: #8a5a1a; }
  .stat-status .stat-num { color: #1a4a8a; }

  .progress-section {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 20px;
    border-bottom: 1px solid #f0e6dc;
  }

  .progress-bar-large {
    flex: 1;
    height: 8px;
    background: #f0e6dc;
    border-radius: 4px;
    overflow: hidden;
  }

  .progress-fill-large {
    height: 100%;
    background: linear-gradient(90deg, #603d2d, #8a5b41);
    border-radius: 4px;
    transition: width .3s ease;
  }

  .progress-text {
    font-size: 13px;
    color: #6b5a4d;
    font-weight: 500;
    flex-shrink: 0;
  }

  .view-tabs {
    display: flex;
    gap: 4px;
    padding: 0 20px;
    border-bottom: 1px solid #e4d8cc;
    background: #fff;
  }

  .tab-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 10px 14px;
    background: transparent;
    border: 0;
    border-bottom: 2px solid transparent;
    color: #6b5a4d;
    cursor: pointer;
    font-size: 14px;
    font-weight: 500;
  }

  .tab-btn:hover {
    color: #3b2f26;
  }

  .tab-btn.active {
    color: #603d2d;
    border-bottom-color: #603d2d;
  }

  .tab-badge {
    background: #b84a3b;
    color: #fff;
    padding: 1px 6px;
    border-radius: 10px;
    font-size: 11px;
    font-weight: 600;
  }

  .list-toolbar {
    display: grid;
    grid-template-columns: 1fr 160px;
    gap: 10px;
    padding: 12px 20px;
    border-bottom: 1px solid #f0e6dc;
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
    width: 100%;
  }

  .items-list {
    flex: 1;
    overflow-y: auto;
    padding: 12px 20px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .inventory-item {
    border: 1px solid #eadfd4;
    border-radius: 8px;
    background: #fffaf5;
    padding: 12px 14px;
    display: flex;
    justify-content: space-between;
    gap: 12px;
    align-items: flex-start;
  }

  .inventory-item.status-pending {
    background: #faf6f2;
  }

  .inventory-item.status-normal {
    border-color: #b8d8b8;
    background: #f0f8f0;
  }

  .inventory-item.status-missing {
    border-color: #e0b8b0;
    background: #fdf0ec;
  }

  .inventory-item.status-location {
    border-color: #e0c9a8;
    background: #fff8f0;
  }

  .inventory-item.status-status {
    border-color: #b8c8e0;
    background: #f0f4f8;
  }

  .item-main {
    flex: 1;
    min-width: 0;
  }

  .item-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 10px;
    margin-bottom: 4px;
  }

  .item-name {
    font-size: 14px;
    color: #26211c;
    font-weight: 600;
  }

  .item-badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 3px 8px;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 500;
    flex-shrink: 0;
  }

  .badge-pending {
    background: #f6efe7;
    color: #6b5a4d;
  }

  .badge-normal {
    background: #e6f0e6;
    color: #2d5a2d;
  }

  .badge-missing {
    background: #f6e6e6;
    color: #8a2d2d;
  }

  .badge-location {
    background: #fff4e6;
    color: #8a5a1a;
  }

  .badge-status {
    background: #e6eef6;
    color: #1a4a8a;
  }

  .item-info {
    display: flex;
    gap: 10px;
    margin-bottom: 6px;
  }

  .item-play, .item-size {
    font-size: 12px;
    color: #6b5a4d;
  }

  .item-play {
    background: #f0e6dc;
    padding: 2px 6px;
    border-radius: 4px;
  }

  .item-expected {
    font-size: 12px;
    color: #6b5a4d;
    margin: 2px 0;
  }

  .info-label {
    color: #8a7665;
  }

  .clean-tag {
    margin-left: 6px;
    padding: 1px 6px;
    background: #e6eef6;
    color: #1a4a8a;
    border-radius: 4px;
    font-size: 11px;
  }

  .item-note {
    font-size: 12px;
    color: #4a3b30;
    margin-top: 6px;
    padding: 6px 8px;
    background: #fff;
    border-radius: 6px;
    border-left: 3px solid #c9a67e;
  }

  .item-time {
    font-size: 11px;
    color: #8a7665;
    margin-top: 6px;
  }

  .item-actions {
    display: flex;
    flex-direction: column;
    gap: 4px;
    flex-shrink: 0;
  }

  .action-btn {
    padding: 6px 10px;
    font-size: 12px;
    border-radius: 6px;
    border: 0;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 4px;
    justify-content: center;
    min-width: 80px;
    font-weight: 500;
  }

  .action-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .action-normal {
    background: #e6f0e6;
    color: #2d5a2d;
  }

  .action-normal:hover {
    background: #d4e6d4;
  }

  .action-missing {
    background: #f6e6e6;
    color: #8a2d2d;
  }

  .action-missing:hover {
    background: #e6d4d4;
  }

  .action-location {
    background: #fff4e6;
    color: #8a5a1a;
  }

  .action-location:hover {
    background: #f0e6d4;
  }

  .action-status {
    background: #e6eef6;
    color: #1a4a8a;
  }

  .action-status:hover {
    background: #d4dce6;
  }

  .action-detail {
    background: #efe4d9;
    color: #37261d;
  }

  .action-detail:hover {
    background: #e0d0c0;
  }

  .action-clean {
    background: #5a7d9e;
    color: #fff;
  }

  .action-clean:hover {
    background: #4a6b8a;
  }

  .action-repair {
    background: #a0684c;
    color: #fff;
  }

  .action-repair:hover {
    background: #8a5b41;
  }

  .action-return {
    background: #4a7c4a;
    color: #fff;
  }

  .action-return:hover {
    background: #3d6b3d;
  }

  .items-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    padding: 40px 20px;
    color: #8a7665;
  }

  .items-empty p {
    margin: 0;
    font-size: 14px;
  }

  .report-section {
    flex: 1;
    overflow-y: auto;
    padding: 16px 20px;
  }

  .report-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    padding: 60px 20px;
    color: #2d5a2d;
    text-align: center;
  }

  .report-empty p {
    margin: 0;
    font-size: 16px;
    font-weight: 500;
  }

  .report-empty span {
    font-size: 13px;
    color: #6b5a4d;
  }

  .report-summary {
    margin-bottom: 16px;
    padding-bottom: 12px;
    border-bottom: 1px solid #e4d8cc;
  }

  .report-summary h3 {
    margin: 0 0 6px;
    font-size: 16px;
    color: #26211c;
  }

  .report-summary p {
    margin: 0;
    font-size: 13px;
    color: #6b5a4d;
  }

  .report-summary strong {
    color: #b84a3b;
    font-size: 15px;
  }

  .discrepancy-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .discrepancy-card {
    border: 1px solid #eadfd4;
    border-radius: 8px;
    background: #fffaf5;
    padding: 14px;
  }

  .discrepancy-card.status-missing {
    border-color: #e0b8b0;
    background: #fdf0ec;
  }

  .discrepancy-card.status-location {
    border-color: #e0c9a8;
    background: #fff8f0;
  }

  .discrepancy-card.status-status {
    border-color: #b8c8e0;
    background: #f0f4f8;
  }

  .discrepancy-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 10px;
    margin-bottom: 10px;
  }

  .discrepancy-header > div {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .discrepancy-name {
    font-size: 15px;
    color: #26211c;
    font-weight: 600;
  }

  .discrepancy-type {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 3px 8px;
    border-radius: 4px;
    font-size: 12px;
    font-weight: 500;
  }

  .discrepancy-play {
    font-size: 12px;
    color: #6b5a4d;
    background: #f0e6dc;
    padding: 2px 8px;
    border-radius: 4px;
  }

  .discrepancy-details {
    margin-bottom: 12px;
    padding: 10px 12px;
    background: #fff;
    border-radius: 6px;
  }

  .detail-row {
    display: flex;
    gap: 8px;
    padding: 4px 0;
    font-size: 13px;
  }

  .detail-label {
    color: #8a7665;
    flex-shrink: 0;
    min-width: 70px;
  }

  .detail-row.mismatch .old-value {
    text-decoration: line-through;
    color: #b84a3b;
  }

  .detail-row.mismatch .new-value {
    color: #2d5a2d;
    font-weight: 500;
  }

  .discrepancy-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .result-badge {
    padding: 3px 8px;
    border-radius: 4px;
    font-size: 12px;
    font-weight: 500;
  }

  .item-modal-overlay {
    position: fixed;
    inset: 0;
    background: rgb(38 33 28 / .4);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 16px;
    z-index: 300;
  }

  .item-modal {
    background: #fff;
    border-radius: 12px;
    width: 100%;
    max-width: 480px;
    max-height: 85vh;
    overflow-y: auto;
    box-shadow: 0 20px 50px rgb(38 33 28 / .3);
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 14px 16px;
    border-bottom: 1px solid #e4d8cc;
    position: sticky;
    top: 0;
    background: #fff;
    border-radius: 12px 12px 0 0;
  }

  .modal-header h3 {
    margin: 0;
    font-size: 16px;
  }

  .modal-body {
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .item-info-section h4 {
    margin: 0 0 4px;
    font-size: 18px;
    color: #26211c;
  }

  .item-play-name {
    margin: 0;
    font-size: 13px;
    color: #6b5a4d;
  }

  .expected-section, .actual-section {
    padding: 12px;
    background: #faf6f2;
    border-radius: 8px;
  }

  .expected-section h5, .actual-section h5 {
    margin: 0 0 8px;
    font-size: 14px;
    color: #3b2f26;
    font-weight: 600;
  }

  .info-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 4px 0;
    font-size: 13px;
  }

  .info-row span:first-child {
    color: #8a7665;
  }

  .actual-section label {
    display: flex;
    flex-direction: column;
    gap: 5px;
    font-size: 13px;
    color: #6b5a4d;
    margin-bottom: 10px;
  }

  .actual-section label:last-child {
    margin-bottom: 0;
  }

  .actual-section label span {
    font-weight: 500;
  }

  .actual-section input,
  .actual-section select {
    width: 100%;
    border: 1px solid #d8c8ba;
    border-radius: 8px;
    padding: 9px 11px;
    background: #fff;
    color: #26211c;
    font: inherit;
  }

  .modal-actions {
    display: flex;
    gap: 10px;
    margin-top: 4px;
  }

  .modal-actions button {
    flex: 1;
  }

  button {
    border: 0;
    border-radius: 8px;
    padding: 10px 14px;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    font: inherit;
  }

  @media (max-width: 768px) {
    .detail-stats {
      grid-template-columns: repeat(3, 1fr);
    }
    .list-toolbar {
      grid-template-columns: 1fr;
    }
    .inventory-item {
      flex-direction: column;
    }
    .item-actions {
      flex-direction: row;
      flex-wrap: wrap;
    }
    .discrepancy-header {
      flex-direction: column;
      align-items: flex-start;
    }
  }
</style>
