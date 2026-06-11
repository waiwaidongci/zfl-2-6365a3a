<script>
  import { onMount } from 'svelte';
  import { Archive, CheckCircle2, Clock, Search, Shirt, Undo2, X, Trash2, Save } from 'lucide-svelte';

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

  onMount(() => {
    const stored = localStorage.getItem('zfl-2-costumes');
    if (stored) costumes = JSON.parse(stored);
  });

  let localStorageAvailable = typeof localStorage !== 'undefined';

  function persist() {
    if (localStorageAvailable) {
      localStorage.setItem('zfl-2-costumes', JSON.stringify(costumes));
    }
  }
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
    costumes = [{ id: crypto.randomUUID(), ...form }, ...costumes];
    persist();
    form = { name: '', size: '', play: '', location: '', clean: '已清洗', borrower: '', due: '', status: '在库', note: '' };
  }

  function lend(id) {
    const borrower = prompt('借出给谁？');
    if (!borrower) return;
    costumes = costumes.map((item) => item.id === id ? { ...item, borrower, due: iso(7), status: '借出' } : item);
    persist();
  }

  function returnBack(id) {
    costumes = costumes.map((item) => item.id === id ? { ...item, borrower: '', due: '', status: '在库', clean: '待清洗' } : item);
    persist();
  }

  function updateClean(id, clean) {
    costumes = costumes.map((item) => item.id === id ? { ...item, clean } : item);
    persist();
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

  $: selected = costumes.find((item) => item.id === selectedId);

  function handleModalKeydown(e) {
    if (e.key === 'Escape') {
      if (showDeleteConfirm) {
        cancelDelete();
      } else {
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
  @media (max-width: 900px) { main { padding: 16px; } .hero { align-items: start; flex-direction: column; } .layout, .toolbar { grid-template-columns: 1fr; } .split { grid-template-columns: 1fr; } .modal { max-height: 95vh; } .modal-actions button { min-width: 100%; } }
</style>
