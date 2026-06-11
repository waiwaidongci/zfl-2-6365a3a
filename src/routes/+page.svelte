<script>
  import { onMount } from 'svelte';
  import { Archive, CheckCircle2, Clock, Search, Shirt, Undo2, X, Trash2, Save, Download, Upload, AlertTriangle, CheckCircle, List, Plus, RotateCcw } from 'lucide-svelte';

  const now = new Date();
  const iso = (offset = 0) => {
    const date = new Date(now);
    date.setDate(date.getDate() + offset);
    return date.toISOString().slice(0, 10);
  };

  const seed = [
    { id: crypto.randomUUID(), name: '湖蓝长袍', size: 'M', play: '海上信笺', location: '二楼A柜', clean: '已清洗', borrower: '许舟', due: iso(-2), status: '借出', note: '领口需复查' },
    { id: crypto.randomUUID(), name: '旧式邮差外套', size: 'L', play: '海上信笺', location: '二楼B柜', clean: '待清洗', borrower: '', due: '', status: '在库', note: '' },
    { id: crypto.randomUUID(), name: '黑色燕尾服', size: 'XL', play: '午夜排练', location: '一楼贵重衣架', clean: '已清洗', borrower: '陈一', due: iso(3), status: '借出', note: '含配套领结' }
  ];

  let costumes = seed;
  let query = '';
  let playFilter = '全部剧目';
  let showOverdue = false;
  let form = { name: '', size: '', play: '', location: '', clean: '已清洗', borrower: '', due: '', status: '在库', note: '' };
  let selectedId = null;
  let editForm = { name: '', size: '', play: '', location: '', clean: '已清洗', note: '' };
  let showDeleteConfirm = false;
  let showImportModal = false;
  let importPreview = [];
  let importSkipped = [];
  let importFile = null;
  let records = [];
  let recordQuery = '';

  onMount(() => {
    const stored = localStorage.getItem('zfl-2-costumes');
    if (stored) costumes = JSON.parse(stored);
    const storedRecords = localStorage.getItem('zfl-2-records');
    if (storedRecords) records = JSON.parse(storedRecords);
  });

  let localStorageAvailable = typeof localStorage !== 'undefined';

  function persist() {
    if (localStorageAvailable) {
      localStorage.setItem('zfl-2-costumes', JSON.stringify(costumes));
    }
  }

  function persistRecords() {
    if (localStorageAvailable) {
      localStorage.setItem('zfl-2-records', JSON.stringify(records));
    }
  }

  function addRecord(type, costume, operator, summary) {
    const record = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      type,
      costumeName: costume.name,
      play: costume.play,
      operator,
      summary
    };
    records = [record, ...records];
    persistRecords();
  }

  function formatTime(isoString) {
    const date = new Date(isoString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  }

  $: filteredRecords = records.filter((record) => {
    const text = `${record.costumeName}${record.play}`;
    return text.includes(recordQuery.trim());
  });
  $: plays = ['全部剧目', ...new Set(costumes.map((item) => item.play).filter(Boolean))];
  $: filtered = costumes.filter((item) => {
    const text = `${item.name}${item.size}${item.play}${item.location}${item.borrower}`;
    const overdue = item.status === '借出' && item.due && new Date(item.due) < new Date(iso(0));
    return text.includes(query.trim()) && (playFilter === '全部剧目' || item.play === playFilter) && (!showOverdue || overdue);
  });
  $: overdueCount = costumes.filter((item) => item.status === '借出' && item.due && new Date(item.due) < new Date(iso(0))).length;
  $: borrowedCount = costumes.filter((item) => item.status === '借出').length;
  $: cleanWaitCount = costumes.filter((item) => item.clean === '待清洗').length;

  function saveCostume() {
    if (!form.name.trim() || !form.play.trim()) return;
    const newCostume = { id: crypto.randomUUID(), ...form };
    costumes = [newCostume, ...costumes];
    persist();
    addRecord('新增', newCostume, '系统', `新增服装「${newCostume.name}」，剧目：${newCostume.play}，尺码：${newCostume.size || '未填'}，位置：${newCostume.location || '未填'}`);
    form = { name: '', size: '', play: '', location: '', clean: '已清洗', borrower: '', due: '', status: '在库', note: '' };
  }

  function lend(id) {
    const borrower = prompt('借出给谁？');
    if (!borrower) return;
    const costume = costumes.find((c) => c.id === id);
    if (!costume) return;
    const dueDate = iso(7);
    costumes = costumes.map((c) => c.id === id ? { ...c, borrower, due: dueDate, status: '借出' } : c);
    persist();
    addRecord('借出', costume, borrower, `借出「${costume.name}」给${borrower}，应还日期：${dueDate}`);
  }

  function returnBack(id) {
    const costume = costumes.find((c) => c.id === id);
    if (!costume) return;
    const borrower = costume.borrower;
    costumes = costumes.map((c) => c.id === id ? { ...c, borrower: '', due: '', status: '在库', clean: '待清洗' } : c);
    persist();
    addRecord('归还', costume, borrower, `${borrower}归还「${costume.name}」，状态变更为待清洗`);
  }

  function updateClean(id, clean) {
    const costume = costumes.find((c) => c.id === id);
    if (!costume) return;
    const oldClean = costume.clean;
    costumes = costumes.map((c) => c.id === id ? { ...c, clean } : c);
    persist();
    addRecord('清洗', costume, '系统', `「${costume.name}」清洗状态从「${oldClean}」变更为「${clean}」`);
  }

  function openDetail(item) {
    selectedId = item.id;
    editForm = {
      name: item.name,
      size: item.size,
      play: item.play,
      location: item.location,
      clean: item.clean,
      note: item.note
    };
    showDeleteConfirm = false;
  }

  function closeDetail() {
    selectedId = null;
    showDeleteConfirm = false;
  }

  function saveDetail() {
    if (!editForm.name.trim() || !editForm.play.trim()) return;
    costumes = costumes.map((item) => item.id === selectedId ? { ...item, ...editForm } : item);
    persist();
    closeDetail();
  }

  function askDelete() {
    showDeleteConfirm = true;
  }

  function cancelDelete() {
    showDeleteConfirm = false;
  }

  function confirmDelete() {
    costumes = costumes.filter((item) => item.id !== selectedId);
    persist();
    closeDetail();
  }

  function exportCostumes() {
    const dataStr = JSON.stringify(costumes, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const date = new Date().toISOString().slice(0, 10);
    a.download = `costumes-${date}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function handleImportFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    importFile = file.name;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result);
        const items = Array.isArray(data) ? data : [data];
        const valid = [];
        const skipped = [];
        items.forEach((item, index) => {
          if (item && typeof item === 'object' && item.name?.trim() && item.play?.trim()) {
            valid.push({
              id: crypto.randomUUID(),
              name: item.name.trim(),
              size: item.size || '',
              play: item.play.trim(),
              location: item.location || '',
              clean: item.clean || '已清洗',
              borrower: item.borrower || '',
              due: item.due || '',
              status: item.status || '在库',
              note: item.note || ''
            });
          } else {
            skipped.push({ index, name: item?.name || '(无名称)', play: item?.play || '(无剧目)' });
          }
        });
        importPreview = valid;
        importSkipped = skipped;
        showImportModal = true;
      } catch (err) {
        alert('文件解析失败，请确保是有效的JSON文件');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  function confirmImport() {
    costumes = [...importPreview, ...costumes];
    persist();
    closeImportModal();
  }

  function closeImportModal() {
    showImportModal = false;
    importPreview = [];
    importSkipped = [];
    importFile = null;
  }

  $: selected = costumes.find((item) => item.id === selectedId);

  function handleModalKeydown(e) {
    if (e.key === 'Escape') {
      if (showImportModal) {
        closeImportModal();
      } else if (showDeleteConfirm) {
        cancelDelete();
      } else if (selectedId) {
        closeDetail();
      }
    }
  }
</script>

<main>
  <header class="hero">
    <div>
      <span>剧场服装间</span>
      <h1>借还管理前端</h1>
    </div>
    <div class="stats">
      <b><Shirt size={18} />{costumes.length}件服装</b>
      <b><Clock size={18} />{borrowedCount}件借出</b>
      <b><Archive size={18} />{cleanWaitCount}件待清洗</b>
      <b class:danger={overdueCount > 0}>{overdueCount}件逾期</b>
    </div>
  </header>

  <section class="layout">
    <form class="panel" on:submit|preventDefault={saveCostume}>
      <h2>新增服装</h2>
      <input bind:value={form.name} placeholder="服装名称" />
      <div class="split">
        <input bind:value={form.size} placeholder="尺码" />
        <input bind:value={form.play} placeholder="所属剧目" />
      </div>
      <input bind:value={form.location} placeholder="存放位置" />
      <select bind:value={form.clean}>
        <option>已清洗</option>
        <option>待清洗</option>
        <option>维修中</option>
      </select>
      <input bind:value={form.note} placeholder="备注" />
      <button>保存档案</button>
    </form>

    <section class="panel wide">
      <div class="toolbar">
        <label><Search size={16} /><input bind:value={query} placeholder="搜索服装/剧目/借用人" /></label>
        <select bind:value={playFilter}>
          {#each plays as play}
            <option>{play}</option>
          {/each}
        </select>
        <label class="check"><input type="checkbox" bind:checked={showOverdue} />只看逾期</label>
      </div>

      <div class="cards">
        {#each filtered as item}
          <article
            class:item-overdue={item.status === '借出' && item.due && new Date(item.due) < new Date(iso(0))}
            class="card-clickable"
          >
            <button
              type="button"
              class="card-overlay-btn"
              aria-label={`查看${item.name}详情`}
              on:click={() => openDetail(item)}
            ></button>
            <div>
              <strong>{item.name}</strong>
              <span>{item.play} · {item.size || '未填尺码'}</span>
            </div>
            <p>{item.location} · {item.clean}</p>
            <p>{item.status === '借出' ? `${item.borrower}借用至${item.due}` : '当前在库'}</p>
            <div class="actions" role="group" aria-label="服装操作">
              {#if item.status === '借出'}
                <button type="button" on:click={() => returnBack(item.id)}><Undo2 size={16} />归还</button>
              {:else}
                <button type="button" on:click={() => lend(item.id)}><Clock size={16} />借出</button>
              {/if}
              <button type="button" class="secondary" on:click={() => updateClean(item.id, item.clean === '已清洗' ? '待清洗' : '已清洗')}><CheckCircle2 size={16} />{item.clean === '已清洗' ? '标待洗' : '标已洗'}</button>
            </div>
          </article>
        {/each}
      </div>
    </section>
  </section>

  <section class="panel">
    <h2>按剧目查看</h2>
    <div class="playGrid">
      {#each plays.filter((play) => play !== '全部剧目') as play}
        <button type="button" on:click={() => playFilter = play}>
          <strong>{play}</strong>
          <span>{costumes.filter((item) => item.play === play).length}件</span>
        </button>
      {/each}
    </div>
  </section>

  <section class="panel">
    <h2>数据导入导出</h2>
    <div class="import-export-btns">
      <button type="button" class="secondary" on:click={exportCostumes}>
        <Download size={16} />导出JSON
      </button>
      <label class="file-input-label">
        <Upload size={16} />导入JSON
        <input type="file" accept=".json" on:change={handleImportFile} hidden />
      </label>
    </div>
    <p class="hint">导出当前所有服装档案为JSON文件，或从JSON文件导入新的服装记录。</p>
  </section>

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
              <span class="record-time">{formatTime(record.timestamp)}</span>
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

  {#if selected}
    <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
    <div class="modal-overlay" role="presentation" on:click={closeDetail}>
      <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
      <div
        class="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="detail-title"
        on:click|stopPropagation
        on:keydown={handleModalKeydown}
        tabindex="-1"
      >
        <div class="modal-header">
          <h2 id="detail-title">服装详情</h2>
          <button type="button" class="icon-btn" on:click={closeDetail} aria-label="关闭"><X size={20} /></button>
        </div>

        {#if showDeleteConfirm}
          <div class="confirm-box">
            <p>确定要删除「{selected.name}」的档案吗？此操作不可撤销。</p>
            <div class="confirm-actions">
              <button type="button" class="secondary" on:click={cancelDelete}>取消</button>
              <button type="button" class="danger" on:click={confirmDelete}><Trash2 size={16} />确认删除</button>
            </div>
          </div>
        {:else}
          <form class="detail-form" on:submit|preventDefault={saveDetail}>
            <label>
              <span>服装名称</span>
              <input bind:value={editForm.name} placeholder="服装名称" required />
            </label>
            <div class="split">
              <label>
                <span>尺码</span>
                <input bind:value={editForm.size} placeholder="尺码" />
              </label>
              <label>
                <span>所属剧目</span>
                <input bind:value={editForm.play} placeholder="所属剧目" required />
              </label>
            </div>
            <label>
              <span>存放位置</span>
              <input bind:value={editForm.location} placeholder="存放位置" />
            </label>
            <label>
              <span>清洗状态</span>
              <select bind:value={editForm.clean}>
                <option>已清洗</option>
                <option>待清洗</option>
                <option>维修中</option>
              </select>
            </label>
            <label>
              <span>备注</span>
              <input bind:value={editForm.note} placeholder="备注" />
            </label>

            {#if selected.status === '借出'}
              <div class="status-info">
                <p><strong>当前状态：</strong>{selected.status}</p>
                <p><strong>借用人：</strong>{selected.borrower}</p>
                <p><strong>应还日期：</strong>{selected.due}</p>
              </div>
            {:else}
              <div class="status-info">
                <p><strong>当前状态：</strong>在库</p>
              </div>
            {/if}

            <div class="modal-actions">
              <button type="button" class="danger-outline" on:click={askDelete}><Trash2 size={16} />删除档案</button>
              <button type="submit"><Save size={16} />保存修改</button>
            </div>
          </form>
        {/if}
      </div>
    </div>
  {/if}

  {#if showImportModal}
    <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
    <div class="modal-overlay" role="presentation" on:click={closeImportModal}>
      <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
      <div
        class="modal modal-wide"
        role="dialog"
        aria-modal="true"
        aria-labelledby="import-title"
        on:click|stopPropagation
        on:keydown={handleModalKeydown}
        tabindex="-1"
      >
        <div class="modal-header">
          <h2 id="import-title">导入服装档案</h2>
          <button type="button" class="icon-btn" on:click={closeImportModal} aria-label="关闭"><X size={20} /></button>
        </div>

        <div class="import-content">
          <p class="file-info">文件：{importFile}</p>

          {#if importPreview.length > 0}
            <div class="import-summary success">
              <CheckCircle size={18} />
              <span>检测到 <strong>{importPreview.length}</strong> 条有效记录，将被导入</span>
            </div>
          {/if}

          {#if importSkipped.length > 0}
            <div class="import-summary warning">
              <AlertTriangle size={18} />
              <span>跳过 <strong>{importSkipped.length}</strong> 条无效记录（缺少服装名称或所属剧目）</span>
            </div>
          {/if}

          {#if importPreview.length > 0}
            <div class="preview-section">
              <h3>即将导入的服装</h3>
              <div class="preview-list">
                {#each importPreview as item}
                  <div class="preview-item">
                    <strong>{item.name}</strong>
                    <span>{item.play} · {item.size || '未填尺码'}</span>
                  </div>
                {/each}
              </div>
            </div>
          {/if}

          {#if importSkipped.length > 0}
            <div class="preview-section">
              <h3>已跳过的记录</h3>
              <div class="skipped-list">
                {#each importSkipped as item}
                  <div class="skipped-item">
                    <span class="skipped-index">第{item.index + 1}条</span>
                    <span class="skipped-name">{item.name}</span>
                    <span class="skipped-play">{item.play}</span>
                  </div>
                {/each}
              </div>
            </div>
          {/if}

          <div class="modal-actions">
            <button type="button" class="secondary" on:click={closeImportModal}>取消</button>
            <button type="button" on:click={confirmImport} disabled={importPreview.length === 0}>
              <Save size={16} />确认导入 {importPreview.length} 条
            </button>
          </div>
        </div>
      </div>
    </div>
  {/if}
</main>

<style>
  * { box-sizing: border-box; }
  :global(body) { margin: 0; background: #f6f1ea; color: #26211c; font-family: Inter, "PingFang SC", Arial, sans-serif; }
  button, input, select { font: inherit; }
  main { min-height: 100vh; padding: 28px; }
  .hero { display: flex; justify-content: space-between; gap: 20px; align-items: end; padding: 30px; border-radius: 8px; color: #fff; background: linear-gradient(135deg, #332019, #8a5b41); }
  .hero span { opacity: .75; }
  h1 { margin: 8px 0 0; font-size: clamp(32px, 5vw, 54px); letter-spacing: 0; }
  h2 { margin: 0 0 16px; font-size: 18px; }
  .stats { display: flex; flex-wrap: wrap; gap: 10px; }
  .stats b { display: inline-flex; align-items: center; gap: 7px; padding: 10px 12px; border: 1px solid rgb(255 255 255 / .22); border-radius: 8px; background: rgb(255 255 255 / .12); }
  .danger { color: #ffd0c2; }
  .layout { display: grid; grid-template-columns: 340px 1fr; gap: 16px; margin: 16px 0; align-items: start; }
  .panel { background: #fff; border: 1px solid #e4d8cc; border-radius: 8px; padding: 18px; box-shadow: 0 12px 30px rgb(62 42 24 / .08); }
  form.panel { display: flex; flex-direction: column; gap: 10px; }
  input, select { width: 100%; border: 1px solid #d8c8ba; border-radius: 8px; padding: 11px 12px; background: #fff; color: #26211c; }
  button { border: 0; border-radius: 8px; padding: 11px 13px; background: #603d2d; color: #fff; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; gap: 7px; }
  .split { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  .toolbar { display: grid; grid-template-columns: 1fr 190px auto; gap: 10px; align-items: center; margin-bottom: 14px; }
  .toolbar label:first-child { display: flex; align-items: center; gap: 8px; border: 1px solid #d8c8ba; border-radius: 8px; padding: 0 10px; }
  .toolbar label:first-child input { border: 0; padding-left: 0; }
  .check { display: flex; align-items: center; gap: 8px; white-space: nowrap; }
  .check input { width: auto; }
  .cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 12px; }
  article { position: relative; border: 1px solid #eadfd4; border-radius: 8px; padding: 16px; background: #fffaf5; }
  article strong, article span { display: block; }
  article span, article p { color: #6b5a4d; }
  .item-overdue { border-color: #d98664; background: #fff5ef; }
  .card-overlay-btn { position: absolute; inset: 0; background: transparent; border: 0; padding: 0; cursor: pointer; border-radius: 8px; z-index: 1; }
  .card-overlay-btn:focus-visible { outline: 2px solid #603d2d; outline-offset: 2px; }
  .actions { position: relative; z-index: 2; display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
  .secondary { background: #efe4d9; color: #37261d; }
  .playGrid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 10px; }
  .playGrid button { justify-content: space-between; background: #f6efe7; color: #2a211b; border: 1px solid #e3d4c7; }
  .card-clickable { cursor: pointer; transition: transform .15s ease, box-shadow .15s ease; }
  .card-clickable:hover { transform: translateY(-2px); box-shadow: 0 6px 18px rgb(62 42 24 / .12); }
  .modal-overlay { position: fixed; inset: 0; background: rgb(38 33 28 / .55); display: flex; align-items: center; justify-content: center; padding: 16px; z-index: 100; }
  .modal { background: #fff; border-radius: 12px; width: 100%; max-width: 520px; max-height: 90vh; overflow-y: auto; box-shadow: 0 24px 60px rgb(38 33 28 / .25); }
  .modal-header { display: flex; justify-content: space-between; align-items: center; padding: 18px 20px; border-bottom: 1px solid #e4d8cc; position: sticky; top: 0; background: #fff; border-radius: 12px 12px 0 0; }
  .modal-header h2 { margin: 0; }
  .icon-btn { background: transparent; color: #6b5a4d; padding: 6px; border-radius: 6px; }
  .icon-btn:hover { background: #f6efe7; }
  .detail-form { padding: 18px 20px 20px; display: flex; flex-direction: column; gap: 12px; }
  .detail-form label { display: flex; flex-direction: column; gap: 6px; font-size: 14px; color: #6b5a4d; }
  .detail-form label span { font-weight: 500; }
  .status-info { background: #f6efe7; border-radius: 8px; padding: 12px 14px; margin: 4px 0; }
  .status-info p { margin: 4px 0; font-size: 14px; color: #4a3b30; }
  .modal-actions { display: flex; justify-content: space-between; gap: 10px; margin-top: 8px; flex-wrap: wrap; }
  .modal-actions button { flex: 1; min-width: 140px; }
  .danger { background: #b84a3b; }
  .danger:hover { background: #a03e30; }
  .danger-outline { background: transparent; color: #b84a3b; border: 1px solid #d9b5ad; }
  .danger-outline:hover { background: #fdf0ec; }
  .confirm-box { padding: 24px 20px; }
  .confirm-box p { margin: 0 0 18px; font-size: 15px; line-height: 1.6; color: #3b2f26; }
  .confirm-actions { display: flex; gap: 10px; justify-content: flex-end; flex-wrap: wrap; }
  .confirm-actions button { min-width: 100px; }
  .import-export-btns { display: flex; gap: 10px; margin-bottom: 10px; }
  .import-export-btns button, .import-export-btns .file-input-label { flex: 1; }
  .file-input-label { display: inline-flex; align-items: center; justify-content: center; gap: 7px; padding: 11px 13px; border-radius: 8px; background: #603d2d; color: #fff; cursor: pointer; font: inherit; border: 0; }
  .hint { margin: 0; font-size: 13px; color: #8a7665; line-height: 1.5; }
  .modal-wide { max-width: 640px; }
  .import-content { padding: 18px 20px 20px; display: flex; flex-direction: column; gap: 14px; }
  .file-info { margin: 0; padding: 10px 14px; background: #f6efe7; border-radius: 8px; font-size: 14px; color: #4a3b30; }
  .import-summary { display: flex; align-items: center; gap: 10px; padding: 12px 14px; border-radius: 8px; font-size: 14px; }
  .import-summary.success { background: #eef6ee; color: #2d5a2d; }
  .import-summary.warning { background: #fff4e6; color: #8a5a1a; }
  .import-summary strong { font-weight: 600; }
  .preview-section { display: flex; flex-direction: column; gap: 8px; }
  .preview-section h3 { margin: 0; font-size: 15px; font-weight: 600; color: #3b2f26; }
  .preview-list { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 8px; max-height: 200px; overflow-y: auto; padding: 8px; background: #faf6f2; border-radius: 8px; }
  .preview-item { padding: 10px 12px; background: #fff; border: 1px solid #e4d8cc; border-radius: 6px; }
  .preview-item strong { display: block; font-size: 14px; margin-bottom: 2px; }
  .preview-item span { font-size: 12px; color: #6b5a4d; }
  .skipped-list { display: flex; flex-direction: column; gap: 6px; max-height: 160px; overflow-y: auto; padding: 8px; background: #faf6f2; border-radius: 8px; }
  .skipped-item { display: grid; grid-template-columns: 60px 1fr 1fr; gap: 10px; padding: 8px 12px; background: #fff; border: 1px dashed #e0c9b8; border-radius: 6px; font-size: 13px; align-items: center; }
  .skipped-index { color: #b84a3b; font-weight: 500; }
  .skipped-name, .skipped-play { color: #6b5a4d; }
  button:disabled { opacity: .5; cursor: not-allowed; }
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
  .record-content { flex: 1; min-width: 0; }
  .record-title-row { display: flex; align-items: center; gap: 10px; margin-bottom: 6px; flex-wrap: wrap; }
  .record-name { font-size: 15px; color: #26211c; }
  .record-play-tag { font-size: 12px; color: #6b5a4d; background: #f0e6dc; padding: 2px 8px; border-radius: 4px; }
  .record-summary { margin: 0 0 8px; font-size: 13px; color: #4a3b30; line-height: 1.5; }
  .record-footer { display: flex; justify-content: space-between; align-items: center; gap: 10px; flex-wrap: wrap; }
  .record-operator { font-size: 12px; color: #6b5a4d; }
  .record-time { font-size: 12px; color: #8a7665; font-family: 'SF Mono', Monaco, 'Courier New', monospace; }
  .record-empty { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 40px 20px; color: #8a7665; }
  .record-empty p { margin: 0; font-size: 15px; color: #6b5a4d; }
  .record-empty span { font-size: 13px; }
  @media (max-width: 900px) { main { padding: 16px; } .hero { align-items: start; flex-direction: column; } .layout, .toolbar { grid-template-columns: 1fr; } .split { grid-template-columns: 1fr; } .modal { max-height: 95vh; } .modal-actions button { min-width: 100%; } .skipped-item { grid-template-columns: 50px 1fr; } .skipped-play { grid-column: 2; } .record-item { flex-direction: column; } .record-footer { flex-direction: column; align-items: flex-start; } }
</style>
