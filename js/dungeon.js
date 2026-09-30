// 奈落探索（3D疑似視点ダンジョン）
window.Dungeon = (() => {
  const D = window.DATA; const { esc } = UI;
  const S = () => Core.state();
  const FWD = [[0, -1], [1, 0], [0, 1], [-1, 0]];
  const RIGHT = [[1, 0], [0, 1], [-1, 0], [0, -1]];
  const DIR_NAMES = ['北', '東', '南', '西'];
  const THEMES = {
    1: { wall: [120, 100, 80], line: '#d8c8a8', fog: '#0c0a08', floor: '#2a2218', ceil: '#141010' },
    2: { wall: [80, 110, 80], line: '#b8e0b0', fog: '#060c06', floor: '#1a2618', ceil: '#0c120c' },
    3: { wall: [90, 85, 130], line: '#c8c0f0', fog: '#08060e', floor: '#1c1a2c', ceil: '#0c0a14' },
    4: { wall: [130, 60, 70], line: '#f0b0b8', fog: '#0e0406', floor: '#2a1216', ceil: '#12060a' },
  };
  let busy = false;
  let log = [];
  let W = 640, H = 400;

  const d = () => S().dungeon;
  const map = () => MAPS[d().floor];
  const fs = () => Core.floorState(d().floor);

  function cell(x, y) {
    const g = map().grid;
    if (y < 0 || y >= g.length || x < 0 || x >= g[0].length) return '#';
    const c = g[y][x];
    if (c === 'L' && fs().done['L' + x + ',' + y]) return 'D';
    return c;
  }
  const solid = (c) => c === '#' || c === 'D' || c === 'L';
  const passable = (c) => c !== '#';

  function renderLog() { const el = document.getElementById('dlog'); if (el) { el.innerHTML = log.slice(-5).map((x) => `<div>${esc(x)}</div>`).join(''); el.scrollTop = el.scrollHeight; } }
  function addLog(m) { log.push(m); if (log.length > 30) log.shift(); renderLog(); }

  function enter(floor, atStairs) {
    const s = S();
    const m = MAPS[floor];
    let pos = { ...m.start };
    if (atStairs === 'S') {
      for (let y = 0; y < m.grid.length; y++) for (let x = 0; x < m.grid[y].length; x++) if (m.grid[y][x] === 'S') pos = { x, y, dir: (m.start.dir + 2) % 4 };
    }
    Object.assign(s.dungeon, { active: true, floor, x: pos.x, y: pos.y, dir: pos.dir, sinceBattle: 0 });
    if (floor > s.deepest) s.deepest = floor;
    log = [];
    addLog(`${m.name} に足を踏み入れた。`);
    reveal();
    Core.save();
    show();
  }

  function show() {
    busy = false;
    const s = S();
    UI.screen('dungeon', `<div class="dungeon">
      <div class="view-wrap"><canvas id="view" width="${W}" height="${H}"></canvas>
        <div class="hud-top"><span>${esc(map().name)}</span><span id="compass">${DIR_NAMES[d().dir]}</span></div>
        <div id="here" class="hud-bottom"></div><div id="flash"></div></div>
      <div class="side">
        <canvas id="minimap" width="200" height="200"></canvas>
        <div class="side-info"><div>💰 ${s.gold.toLocaleString()} G</div><div id="coord"></div></div>
        <div class="menu-buttons">
          <button class="btn sm" data-act="items">道具</button><button class="btn sm" data-act="skill">呪文</button>
          <button class="btn sm" data-act="map">地図</button><button class="btn sm" data-act="search">調べる</button>
          <button class="btn sm" data-act="menu">記録</button>
        </div>
      </div>
      <div id="dlog" class="dlog"></div>
      <div class="pad">
        <button class="btn pad-btn" data-act="sl" title="左へ移動 (Q)">⇐</button><button class="btn pad-btn" data-act="fw" title="前進 (W/↑)">▲</button><button class="btn pad-btn" data-act="sr" title="右へ移動 (E)">⇒</button>
        <button class="btn pad-btn" data-act="tl" title="左を向く (A/←)">↶</button><button class="btn pad-btn" data-act="bk" title="後退 (S/↓)">▼</button><button class="btn pad-btn" data-act="tr" title="右を向く (D/→)">↷</button>
      </div>
      <div id="dparty">${Town.partyStrip()}</div>
    </div>`, {
      fw: () => move(0), bk: () => move(2), sl: () => move(3), sr: () => move(1),
      tl: () => turn(-1), tr: () => turn(1),
      items: async () => { if (busy) return; busy = true; const r = await Town.useItemField(); busy = false; if (r === 'escape') { returnToTown('帰還の巻物の力で、町へ戻った。'); return; } refresh(); },
      skill: async () => { if (busy) return; busy = true; await Town.fieldSkill(); busy = false; refresh(); },
      map: fullMap, search: () => interact(true), menu: campMenu,
      char: async (uid) => { if (busy) return; busy = true; await Town.charDetail(S().chars[uid]); busy = false; refresh(); },
    });
    renderLog();
    draw();
    Main.setKeys(onKey);
  }

  function refresh() {
    if (UI.currentScreen() !== 'dungeon') return;
    const p = document.getElementById('dparty'); if (p) p.innerHTML = Town.partyStrip();
    const g = document.querySelector('.side-info div'); if (g) g.textContent = `💰 ${S().gold.toLocaleString()} G`;
    draw();
  }

  function onKey(e) {
    if (busy || document.querySelector('.modal-wrap')) return;
    const k = e.key.toLowerCase();
    const map_ = { arrowup: () => move(0), w: () => move(0), arrowdown: () => move(2), s: () => move(2), arrowleft: () => turn(-1), a: () => turn(-1), arrowright: () => turn(1), d: () => turn(1), q: () => move(3), e: () => move(1), m: fullMap, ' ': () => interact(true), enter: () => interact(true) };
    if (map_[k]) { e.preventDefault(); map_[k](); }
  }

  function turn(t) {
    if (busy) return;
    d().dir = (d().dir + t + 4) % 4;
    reveal(); draw();
  }

  // rel: 0前 1右 2後 3左
  async function move(rel) {
    if (busy) return;
    const dir = (d().dir + rel) % 4;
    const nx = d().x + FWD[dir][0], ny = d().y + FWD[dir][1];
    const c = cell(nx, ny);
    if (c === '#') { bump(); return; }
    if (c === 'L') {
      if (S().bag.abyss_key) {
        fs().done['L' + nx + ',' + ny] = true;
        addLog('奈落の鍵で扉を開けた！');
        UI.toast('奈落の鍵で扉を開けた！');
      } else { addLog('扉には鍵がかかっている。'); bump(); return; }
    }
    d().x = nx; d().y = ny;
    S().stats.playSteps++;
    d().sinceBattle++;
    reveal(); draw();
    await afterStep();
  }

  function bump() {
    const f = document.getElementById('flash');
    if (f) { f.classList.remove('bump'); void f.offsetWidth; f.classList.add('bump'); }
  }

  function reveal() {
    const seen = fs().seen;
    const { x, y, dir } = d();
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) seen[(x + dx) + ',' + (y + dy)] = 1;
    // 視線方向の通路を記録
    for (let f = 1; f <= 5; f++) {
      const cx = x + FWD[dir][0] * f, cy = y + FWD[dir][1] * f;
      for (let l = -1; l <= 1; l++) seen[(cx + RIGHT[dir][0] * l) + ',' + (cy + RIGHT[dir][1] * l)] = 1;
      if (solid(cell(cx, cy))) break;
    }
  }

  async function afterStep() {
    const s = S();
    // 毒のダメージ
    if (s.stats.playSteps % 4 === 0) {
      for (const c of Core.partyMembers()) if (Core.alive(c) && c.status.poison) { c.hp = Math.max(1, c.hp - Math.max(1, Math.floor(Core.stats(c).maxHp * 0.03))); }
    }
    if (s.stats.playSteps % 10 === 0) Core.save();
    const handled = await interact(false);
    if (handled) return;
    // ランダムエンカウント
    const rate = [3.5, 6, 9][s.settings.encounter] ?? 6;
    if (d().sinceBattle >= 4 && Core.chance(rate)) await randomBattle();
    refresh();
  }

  // 現在地のイベント処理。戻り値 true でエンカウント判定をスキップ
  async function interact(manual) {
    if (busy) return true;
    const { x, y } = d();
    const c = cell(x, y);
    const key = x + ',' + y;
    const done = fs().done;
    busy = true;
    try {
      if (c === 'U') {
        const up = d().floor === 1 ? '町へ戻りますか？' : `地下${d().floor - 1}階へ上りますか？`;
        if (await UI.confirm('上り階段', `上り階段がある。\n${up}`)) {
          busy = false;
          if (d().floor === 1) returnToTown('奈落を抜け、町へ戻った。');
          else enter(d().floor - 1, 'S');
        }
        return true;
      }
      if (c === 'S') {
        if (await UI.confirm('下り階段', `下り階段がある。\n地下${d().floor + 1}階へ下りますか？`)) { busy = false; enter(d().floor + 1); }
        return true;
      }
      if (c === 'T' && !done['T' + key]) { await chest(key); return true; }
      if (c === 'T' && manual) { addLog('空の宝箱だ。'); return true; }
      if (c === 'H') {
        await UI.alert('回復の泉', '澄んだ泉が湧いている。\n水を飲むと、体に力がみなぎった！\n（生存者のHP・MP全快、状態異常回復）');
        Core.partyMembers().filter(Core.alive).forEach(Core.fullHeal);
        addLog('泉の水で全快した。'); Core.save();
        return true;
      }
      if (c === 'K') {
        if (!S().bag.abyss_key) {
          await UI.alert('鍵の台座', '古びた台座の上に、黒い鍵が置かれている。\n「奈落の鍵」を手に入れた！');
          Core.addItem('abyss_key'); addLog('奈落の鍵を手に入れた。'); Core.save();
        } else if (manual) addLog('空の台座がある。');
        return true;
      }
      if (/[1-9]/.test(c)) {
        const ev = map().events[c];
        if (!done['E' + key] || manual) {
          await UI.modal({ title: ev.title, cls: 'story', html: `<p>${UI.nl2br(ev.text)}</p>` });
          if (!done['E' + key]) {
            if (ev.give) for (const id in ev.give) { Core.addItem(id, ev.give[id]); addLog(`${D.ITEMS[id].name}×${ev.give[id]} を手に入れた。`); }
            if (ev.heal) { Core.partyMembers().filter(Core.alive).forEach(Core.fullHeal); addLog('パーティは全快した。'); }
          } else if (ev.heal) { Core.partyMembers().filter(Core.alive).forEach(Core.fullHeal); addLog('パーティは全快した。'); }
          done['E' + key] = true; Core.save();
          return true;
        }
        return false;
      }
      if ((c === 'X' || c === 'B') && !done['G' + key]) {
        const g = map().guards[c];
        await UI.modal({ title: g.name, cls: 'story', html: `<p>${UI.nl2br(g.text)}</p>`, buttons: [{ label: '戦う', value: true, cls: 'danger' }], dismiss: false });
        const res = await Battle.start(g.group, { fixed: true, boss: true, final: !!g.final, canFlee: false });
        if (res === 'win') {
          done['G' + key] = true;
          Core.save();
          if (g.final) { show(); busy = true; await clearGame(); return true; }
          show();
          addLog(`${g.name} を打ち倒した！`);
        } else if (res === 'lose') { await wipe(); }
        return true;
      }
      if (c === 'B' && manual) {
        const v = await UI.modal({ title: '奈落の門', cls: 'story', html: `<p>${UI.nl2br('固く閉ざされた石の門がある。\nその先――第二奈落へ続く道は、まだ開かれていない。\n（本作は第一奈落までの収録です）\n\n門の前には、番人の残滓が今も渦巻いている……')}</p>`, buttons: [{ label: '番人と再戦する', value: 'fight', cls: 'danger' }, { label: '立ち去る', value: null }] });
        if (v === 'fight') { delete done['G' + key]; busy = false; return interact(false); }
        return true;
      }
      if (manual) addLog('特に何もない。');
      return false;
    } finally { busy = false; refresh(); }
  }

  // ---------- 宝箱 ----------
  function lootFor(floor) {
    const tier = Math.min(3, floor <= 1 ? 1 : floor - 1 + (Core.chance(40) ? 1 : 0));
    const cands = Object.keys(D.ITEMS).filter((id) => { const it = D.ITEMS[id]; return it.tier === tier || (it.kind === 'consumable' && it.tier <= Math.min(2, tier)); });
    const id = Core.pick(cands);
    // 深層では稀に奈落の護符
    if (floor >= 4 && Core.chance(4)) return 'abyss_amulet';
    return id;
  }

  async function chest(key) {
    const s = S(); const floor = d().floor;
    const thief = Core.partyMembers().filter((c) => Core.alive(c) && c.cls === 'thief').sort((a, b) => Core.stats(b).spd - Core.stats(a).spd)[0];
    const trapped = Core.chance(35 + floor * 5);
    const trapType = Core.pick(['needle', 'bomb', 'alarm', 'bomb', 'needle']);
    const trapNames = { needle: '毒針', bomb: '爆弾', alarm: '警報' };
    const v = await UI.modal({
      title: '宝箱', html: `<p>宝箱を見つけた！</p>${thief ? `<p class="hint">盗賊 ${esc(thief.name)} なら罠を調べられる。</p>` : '<p class="hint">盗賊がいれば罠を調べられる。</p>'}`,
      buttons: [{ label: '開ける', value: 'open', cls: 'primary' }, { label: '罠を調べる', value: 'inspect', disabled: !thief }, { label: '立ち去る', value: null }],
    });
    if (!v) { addLog('宝箱をそのままにした。'); return; }
    let triggered = false;
    if (v === 'inspect') {
      const st = Core.stats(thief);
      const rate = Math.min(95, 55 + st.agi * 1.5 + thief.lv * 2);
      if (!trapped) await UI.alert('罠を調べる', `${thief.name} は宝箱を調べた。\n罠はかかっていないようだ。`);
      else if (Core.chance(rate)) await UI.alert('罠を調べる', `${thief.name} は「${trapNames[trapType]}」の罠を見破り、解除した！`);
      else { await UI.alert('罠を調べる', `${thief.name} は罠の解除に失敗した！`); triggered = true; }
    } else {
      const bestLuk = Math.max(...Core.partyMembers().filter(Core.alive).map((c) => Core.stats(c).luk));
      triggered = trapped && !Core.chance(bestLuk * 1.5);
    }
    fs().done['T' + key] = true;
    if (triggered) {
      if (trapType === 'needle') {
        const t = Core.pick(Core.partyMembers().filter(Core.alive));
        t.status.poison = true; await UI.alert('罠！', `毒針が飛び出した！\n${t.name} は毒に侵された。`);
      } else if (trapType === 'bomb') {
        const dmg = 6 * floor + Core.rand(0, 6 * floor);
        for (const c of Core.partyMembers().filter(Core.alive)) { c.hp -= dmg; if (c.hp <= 0) { c.hp = 0; c.status.dead = true; } }
        await UI.alert('罠！', `宝箱が爆発した！\nパーティ全員に ${dmg} のダメージ！`);
        if (!Core.partyMembers().some(Core.alive)) { await wipe(); return; }
      } else {
        await UI.alert('罠！', '警報が鳴り響いた！\n魔物が集まってくる！');
        const res = await Battle.start(null, { canFlee: true });
        if (res === 'lose') { await wipe(); return; }
        show();
      }
    }
    const gold = floor * Core.rand(60, 160);
    const item = lootFor(floor);
    s.gold += gold;
    Core.addItem(item);
    Core.save();
    await UI.alert('宝箱の中身', `${gold} G と\n「${D.ITEMS[item].name}」を手に入れた！`);
    addLog(`宝箱から ${gold}G と ${D.ITEMS[item].name} を得た。`);
  }

  async function randomBattle() {
    busy = true;
    const res = await Battle.start(null, { canFlee: true });
    busy = false;
    if (res === 'lose') { await wipe(); return; }
    show();
  }

  function rollGroup(floor) {
    const table = MAPS[floor].table;
    const total = table.reduce((a, t) => a + t.w, 0);
    let r = Math.random() * total;
    let ent = table[0];
    for (const t of table) { r -= t.w; if (r < 0) { ent = t; break; } }
    const group = ent.e.map(([id, a, b]) => [id, Core.rand(a, b)]).filter(([, n]) => n > 0);
    return group;
  }

  async function wipe() {
    const s = S();
    const lost = Math.floor(s.gold * 0.2);
    s.gold -= lost;
    const hero = s.chars[s.heroUid];
    hero.status.dead = false; hero.hp = 1; hero.status.poison = false; hero.status.sleep = false;
    s.dungeon.active = false;
    Core.save();
    await UI.modal({ title: '全滅', cls: 'story danger', html: `<p>${UI.nl2br(`パーティは全滅した……。\n\n奈落を巡回していた救助隊によって、一行は町へ運ばれた。\n主人公は寺院の慈悲により息を吹き返したが、\n救助の謝礼として ${lost} G を支払った。\n\n倒れた仲間は寺院で蘇生できる。`)}</p>`, buttons: [{ label: '町へ', value: true }], dismiss: false });
    Main.setKeys(null);
    Town.show();
  }

  function returnToTown(msg) {
    Main.setKeys(null);
    S().dungeon.active = false;
    Core.save();
    UI.toast(msg);
    Town.show();
  }

  async function clearGame() {
    const s = S();
    const first = !s.flags.cleared;
    s.flags.cleared = true; s.clearCount++;
    Core.addItem('return_scroll');
    Core.save();
    await UI.modal({
      title: '第一奈落 踏破', cls: 'story ending', dismiss: false,
      html: `<p>${UI.nl2br(`深淵の番人ヴォルガスは、断末魔の叫びと共に崩れ落ちた。

「……見事だ……人の子よ……
　だが……奈落は……まだ……始まりに過ぎぬ……」

番人の消滅と共に、石の門に刻まれた紋様が淡く輝き、
奈落から溢れていた瘴気が、わずかに薄らいでいく。

町へ戻った ${s.chars[s.heroUid].name} たちを、人々は歓声で迎えた。
しかし、門の先にはさらなる深淵――第二奈落が口を開けている。

冒険は、まだ始まったばかりだ。`)}</p>
        <div class="clear-banner">〜 第一奈落 一週目クリア 〜</div>
        <p class="hint">クリアおめでとうございます！${first ? '引き続き町や奈落で仲間の育成・招来を楽しめます。' : ''}<br>戦闘 ${s.stats.battles} 回 / 撃破 ${s.stats.kills} 体 / 招来 ${s.gacha.pulls} 回</p>`,
      buttons: [{ label: '町へ帰還', value: true, cls: 'primary' }],
    });
    // 番人を再戦可能に（周回用）
    if (!(await UI.confirm('周回', '奈落の番人は時が経てば蘇るという。\n番人と再び戦えるようにしますか？\n（「いいえ」でも後から地下4階の門で再挑戦を選べます）'))) { /* noop */ } else {
      const f4 = Core.floorState(4);
      for (const k in f4.done) if (k.startsWith('G')) delete f4.done[k];
    }
    Core.save();
    returnToTown('第一奈落を踏破し、町へ凱旋した！');
  }

  async function campMenu() {
    if (busy) return;
    busy = true;
    const v = await UI.modal({ title: 'キャンプ', html: '<p class="hint">探索状況は自動保存されています。</p>', buttons: [{ label: 'セーブ', value: 'save', cls: 'primary' }, { label: '仲間の並び替え', value: 'order' }, { label: 'タイトルへ', value: 'title' }, { label: '閉じる', value: null }] });
    busy = false;
    if (v === 'save') { Core.save(); UI.toast('セーブしました'); }
    if (v === 'order') { await reorder(); refresh(); }
    if (v === 'title') { Core.save(); Main.setKeys(null); Main.title(); }
  }

  async function reorder() {
    const s = S();
    const a = await Town.chooseMember('入れ替える1人目を選択');
    if (!a) return;
    const b = await Town.chooseMember('入れ替える2人目を選択');
    if (!b || a === b) return;
    const ia = s.party.indexOf(a), ib = s.party.indexOf(b);
    [s.party[ia], s.party[ib]] = [s.party[ib], s.party[ia]];
    Core.save();
  }

  // ---------- 描画 ----------
  function shade(rgb, k) { return `rgb(${Math.floor(rgb[0] * k)},${Math.floor(rgb[1] * k)},${Math.floor(rgb[2] * k)})`; }

  function draw() {
    const cv = document.getElementById('view'); if (!cv) return;
    const ctx = cv.getContext('2d');
    const th = THEMES[d().floor] || THEMES[1];
    const cx = W / 2, cy = H / 2, F = H * 0.62;
    // 天井・床
    let g = ctx.createLinearGradient(0, 0, 0, cy);
    g.addColorStop(0, th.ceil); g.addColorStop(1, th.fog);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, cy);
    g = ctx.createLinearGradient(0, cy, 0, H);
    g.addColorStop(0, th.fog); g.addColorStop(1, th.floor);
    ctx.fillStyle = g; ctx.fillRect(0, cy, W, cy);
    // 床の奥行き線
    ctx.strokeStyle = 'rgba(255,255,255,0.05)'; ctx.lineWidth = 1;
    for (let z = 1; z <= 6; z++) { const yy = cy + 0.5 / z * F; ctx.beginPath(); ctx.moveTo(0, yy); ctx.lineTo(W, yy); ctx.stroke(); const yc = cy - 0.5 / z * F; ctx.beginPath(); ctx.moveTo(0, yc); ctx.lineTo(W, yc); ctx.stroke(); }

    const P = (x, z) => cx + (x / z) * F;
    const Yt = (z) => cy - (0.5 / z) * F;
    const Yb = (z) => cy + (0.5 / z) * F;
    const { x: px, y: py, dir } = d();
    const at = (f, l) => cell(px + FWD[dir][0] * f + RIGHT[dir][0] * l, py + FWD[dir][1] * f + RIGHT[dir][1] * l);
    const MAXF = 6;

    const quad = (pts, fill, stroke) => {
      ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]); ctx.closePath();
      ctx.fillStyle = fill; ctx.fill(); ctx.strokeStyle = stroke; ctx.lineWidth = 1.5; ctx.stroke();
    };
    const lightK = (z) => Math.max(0.12, 1 / (1 + z * 0.42));

    const drawDoor = (pts, z, locked) => {
      // pts: 面の4点(左上,右上,右下,左下)。中央に扉を描く
      const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
      const tl = lerp(pts[0], pts[1], 0.22), tr = lerp(pts[0], pts[1], 0.78), br = lerp(pts[3], pts[2], 0.78), bl = lerp(pts[3], pts[2], 0.22);
      const t2 = lerp(tl, bl, 0.15), t3 = lerp(tr, br, 0.15);
      const k = lightK(z);
      quad([t2, t3, br, bl], locked ? shade([110, 40, 40], k) : shade([100, 70, 40], k), shade([230, 200, 150], k));
      const mid = lerp(lerp(t2, bl, 0.55), lerp(t3, br, 0.55), 0.8);
      ctx.fillStyle = locked ? '#fc6' : shade([230, 200, 120], k); ctx.beginPath(); ctx.arc(mid[0], mid[1], Math.max(1.5, 5 * k), 0, Math.PI * 2); ctx.fill();
    };

    const drawObject = (f, l, c) => {
      const z = f + 0.5; const k = lightK(z);
      const x = P(l, z), yb = Yb(z), s = F / z;
      const done = fs().done; const key = (px + FWD[dir][0] * f + RIGHT[dir][0] * l) + ',' + (py + FWD[dir][1] * f + RIGHT[dir][1] * l);
      if (c === 'S' || c === 'U') {
        ctx.fillStyle = `rgba(0,0,0,${0.6 * k + 0.2})`;
        ctx.beginPath(); ctx.ellipse(x, yb - s * 0.03, s * 0.32, s * 0.08, 0, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = shade([220, 220, 180], k); ctx.lineWidth = 2;
        for (let i = 0; i < 4; i++) { const yy = c === 'S' ? yb - s * 0.02 - i * s * 0.02 : yb - s * 0.04 - i * s * 0.09; const w = c === 'S' ? s * (0.28 - i * 0.05) : s * (0.3 - i * 0.03); ctx.beginPath(); ctx.moveTo(x - w, yy); ctx.lineTo(x + w, yy); ctx.stroke(); }
        ctx.fillStyle = shade([255, 240, 200], k); ctx.font = `${Math.max(10, s * 0.1)}px sans-serif`; ctx.textAlign = 'center';
        ctx.fillText(c === 'S' ? '▼ 下り階段' : '▲ 上り階段', x, yb - s * 0.42);
      } else if (c === 'T' && !done['T' + key]) {
        const w = s * 0.22, h = s * 0.14;
        quad([[x - w, yb - h - s * 0.02], [x + w, yb - h - s * 0.02], [x + w, yb - s * 0.02], [x - w, yb - s * 0.02]], shade([150, 100, 40], k), shade([255, 210, 100], k));
        quad([[x - w, yb - h - s * 0.02], [x + w, yb - h - s * 0.02], [x + w * 0.9, yb - h * 1.6 - s * 0.02], [x - w * 0.9, yb - h * 1.6 - s * 0.02]], shade([170, 120, 50], k), shade([255, 210, 100], k));
      } else if (c === 'H') {
        ctx.fillStyle = `rgba(100,200,255,${0.5 * k + 0.2})`;
        ctx.beginPath(); ctx.ellipse(x, yb - s * 0.03, s * 0.3, s * 0.07, 0, 0, Math.PI * 2); ctx.fill();
      } else if (c === 'K' && !S().bag.abyss_key) {
        ctx.fillStyle = shade([160, 160, 170], k); ctx.fillRect(x - s * 0.08, yb - s * 0.3, s * 0.16, s * 0.28);
        ctx.fillStyle = `rgba(255,220,120,${k})`; ctx.beginPath(); ctx.arc(x, yb - s * 0.34, s * 0.05, 0, Math.PI * 2); ctx.fill();
      } else if ((c === 'X' || c === 'B') && !done['G' + key]) {
        ctx.fillStyle = c === 'B' ? `rgba(200,40,80,${0.55 * k})` : `rgba(20,0,0,${0.7 * k + 0.1})`;
        ctx.beginPath(); ctx.ellipse(x, yb - s * 0.35, s * (c === 'B' ? 0.3 : 0.16), s * (c === 'B' ? 0.4 : 0.34), 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = `rgba(255,60,60,${k})`; ctx.beginPath(); ctx.arc(x - s * 0.05, yb - s * 0.52, s * 0.02, 0, 7); ctx.arc(x + s * 0.05, yb - s * 0.52, s * 0.02, 0, 7); ctx.fill();
      } else if (c === 'B') {
        ctx.fillStyle = shade([90, 80, 90], k); ctx.fillRect(x - s * 0.3, yb - s * 0.9, s * 0.6, s * 0.88);
      }
    };

    for (let f = MAXF; f >= 0; f--) {
      // 床の物体
      for (const l of [-1, 1, 0]) { const c = at(f, l); if (!solid(c) && !(f === 0 && l === 0)) drawObject(f, l, c); }
      const order = [-3, 3, -2, 2, -1, 1, 0];
      for (const l of order) {
        if (f === 0 && l === 0) continue;
        const c = at(f, l);
        if (!solid(c)) continue;
        const zN = f === 0 ? 0.26 : f, zF = f + 1;
        const k = lightK(zN);
        const base = THEMES[d().floor].wall;
        // 手前の面
        if (f > 0) {
          const pts = [[P(l - 0.5, zN), Yt(zN)], [P(l + 0.5, zN), Yt(zN)], [P(l + 0.5, zN), Yb(zN)], [P(l - 0.5, zN), Yb(zN)]];
          quad(pts, shade(base, k), shade([200, 190, 170], k * 0.9));
          if (c === 'D' || c === 'L') drawDoor(pts, zN, c === 'L');
        }
        // 側面
        if (l !== 0) {
          const sx = l < 0 ? l + 0.5 : l - 0.5;
          const pts = [[P(sx, zN), Yt(zN)], [P(sx, zF), Yt(zF)], [P(sx, zF), Yb(zF)], [P(sx, zN), Yb(zN)]];
          const kk = lightK((zN + zF) / 2) * 0.8;
          quad(pts, shade(base, kk), shade([200, 190, 170], kk * 0.9));
          if (c === 'D' || c === 'L') drawDoor(l < 0 ? pts : [pts[1], pts[0], pts[3], pts[2]], (zN + zF) / 2, c === 'L');
        }
      }
    }
    // 方角
    const comp = document.getElementById('compass'); if (comp) comp.textContent = `${DIR_NAMES[dir]}を向いている`;
    const here = document.getElementById('here');
    if (here) {
      const c0 = at(0, 0); const k0 = px + ',' + py; const dn = fs().done;
      const t = c0 === 'U' ? '足元：上り階段（調べる / Enter）' : c0 === 'S' ? '足元：下り階段（調べる / Enter）' : c0 === 'T' && !dn['T' + k0] ? '足元：宝箱' : c0 === 'H' ? '足元：回復の泉' : c0 === 'B' && dn['G' + k0] ? '奈落の門の前（調べる / Enter）' : '';
      here.textContent = t; here.style.display = t ? '' : 'none';
    }
    const coord = document.getElementById('coord'); if (coord) coord.textContent = `B${d().floor}F (${px}, ${py})`;
    drawMini(document.getElementById('minimap'), 10);
  }

  function drawMini(cv, cs, full) {
    if (!cv) return;
    const ctx = cv.getContext('2d');
    const g = map().grid; const seen = fs().seen; const done = fs().done;
    ctx.fillStyle = '#07070b'; ctx.fillRect(0, 0, cv.width, cv.height);
    for (let y = 0; y < g.length; y++) for (let x = 0; x < g[y].length; x++) {
      if (!seen[x + ',' + y] && !full) continue;
      if (!seen[x + ',' + y]) continue;
      const c = cell(x, y);
      const X = x * cs, Y = y * cs;
      if (c === '#') { ctx.fillStyle = '#4a4a5a'; ctx.fillRect(X, Y, cs, cs); continue; }
      ctx.fillStyle = '#1c1c28'; ctx.fillRect(X, Y, cs, cs);
      const mark = (col, txt) => { ctx.fillStyle = col; if (txt) { ctx.font = `bold ${cs - 1}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(txt, X + cs / 2, Y + cs / 2 + 1); } else ctx.fillRect(X + cs * 0.25, Y + cs * 0.25, cs * 0.5, cs * 0.5); };
      if (c === 'D') mark('#c8a060');
      if (c === 'L') mark('#e05050');
      if (c === 'U') mark('#8fd', '↑');
      if (c === 'S') mark('#fd8', '↓');
      if (c === 'T') mark(done['T' + x + ',' + y] ? '#555' : '#fc4');
      if (c === 'H') mark('#4af');
      if (c === 'K' && !S().bag.abyss_key) mark('#ff8');
      if ((c === 'X' || c === 'B') && !done['G' + x + ',' + y]) mark('#f44', '!');
      if (/[1-9]/.test(c)) mark('#a8f', '?');
    }
    const { x, y, dir } = d();
    ctx.save(); ctx.translate(x * cs + cs / 2, y * cs + cs / 2); ctx.rotate(dir * Math.PI / 2);
    ctx.fillStyle = '#ff5'; ctx.beginPath(); ctx.moveTo(0, -cs * 0.45); ctx.lineTo(cs * 0.35, cs * 0.35); ctx.lineTo(-cs * 0.35, cs * 0.35); ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  async function fullMap() {
    if (busy) return;
    busy = true;
    await UI.modal({
      title: `${map().name} の地図`, cls: 'wide',
      html: `<canvas id="bigmap" width="400" height="400" class="bigmap"></canvas><p class="hint">↑上り階段 ↓下り階段 ■黄:宝箱 ■青:泉 !:強敵 ?:手がかり ■赤:施錠扉</p>`,
      handlers: { __init: () => setTimeout(() => drawMini(document.getElementById('bigmap'), 20, true), 0) },
    });
    busy = false;
  }

  return { enter, show, rollGroup, returnToTown, draw, debug: () => ({ busy }) };
})();
