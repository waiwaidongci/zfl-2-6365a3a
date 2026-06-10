<script>
  import { onMount } from 'svelte';
  import { Archive, CheckCircle2, Clock, Search, Shirt, Undo2 } from 'lucide-svelte';

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

  onMount(() => {
    const stored = localStorage.getItem('zfl-2-costumes');
    if (stored) costumes = JSON.parse(stored);
  });

  $: localStorageAvailable = typeof localStorage !== 'undefined';
  $: if (localStorageAvailable) localStorage.setItem('zfl-2-costumes', JSON.stringify(costumes));
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
    form = { name: '', size: '', play: '', location: '', clean: '已清洗', borrower: '', due: '', status: '在库', note: '' };
  }

  function lend(id) {
    const borrower = prompt('借出给谁？');
    if (!borrower) return;
    costumes = costumes.map((item) => item.id === id ? { ...item, borrower, due: iso(7), status: '借出' } : item);
  }

  function returnBack(id) {
    costumes = costumes.map((item) => item.id === id ? { ...item, borrower: '', due: '', status: '在库', clean: '待清洗' } : item);
  }

  function updateClean(id, clean) {
    costumes = costumes.map((item) => item.id === id ? { ...item, clean } : item);
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
          <article class:item-overdue={item.status === '借出' && item.due && new Date(item.due) < new Date(iso(0))}>
            <div>
              <strong>{item.name}</strong>
              <span>{item.play} · {item.size || '未填尺码'}</span>
            </div>
            <p>{item.location} · {item.clean}</p>
            <p>{item.status === '借出' ? `${item.borrower}借用至${item.due}` : '当前在库'}</p>
            <div class="actions">
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
  article { border: 1px solid #eadfd4; border-radius: 8px; padding: 16px; background: #fffaf5; }
  article strong, article span { display: block; }
  article span, article p { color: #6b5a4d; }
  .item-overdue { border-color: #d98664; background: #fff5ef; }
  .actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
  .secondary { background: #efe4d9; color: #37261d; }
  .playGrid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 10px; }
  .playGrid button { justify-content: space-between; background: #f6efe7; color: #2a211b; border: 1px solid #e3d4c7; }
  @media (max-width: 900px) { main { padding: 16px; } .hero { align-items: start; flex-direction: column; } .layout, .toolbar { grid-template-columns: 1fr; } .split { grid-template-columns: 1fr; } }
</style>
