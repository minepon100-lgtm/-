// 招来（ガチャ）: 課金石の代わりにゴールドを使用。全キャラクターをピックアップ選択可能。
window.Gacha = (() => {
  const D = window.DATA; const G = D.GACHA; const { esc } = UI;
  const S = () => Core.state();

  const pool = (r) => Object.keys(D.CHARACTERS).filter((id) => D.CHARACTERS[id].rarity === r);
  const owned = (tid) => Object.values(S().chars).find((c) => c.tid === tid);

  // 各キャラクターの個別提供割合(%)
  function rateOf(tid) {
    const t = D.CHARACTERS[tid]; const pu = S().gacha.pickup; const r = t.rarity;
    const base = G.rates[r]; const n = pool(r).length;
    const puR = D.CHARACTERS[pu].rarity;
    if (puR !== r) return base / n;
    const share = G.pickupShare / 100;
    return tid === pu ? base * share + base * (1 - share) / n : base * (1 - share) / n;
  }

  function drawOne(guarantee4) {
    const g = S().gacha;
    g.since5++;
    let rarity;
    if (g.since5 >= G.pity5) rarity = 5;
    else {
      const x = Math.random() * 100;
      rarity = x < G.rates[5] ? 5 : x < G.rates[5] + G.rates[4] ? 4 : 3;
    }
    if (guarantee4 && rarity === 3) rarity = 4;
    if (rarity === 5) g.since5 = 0;
    const pu = g.pickup;
    let tid;
    if (D.CHARACTERS[pu].rarity === rarity && Core.chance(G.pickupShare)) tid = pu;
    else tid = Core.pick(pool(rarity));
    g.pulls++; g.points++;
    return tid;
  }

  function show() {
    const s = S(); const g = s.gacha;
    const pu = D.CHARACTERS[g.pickup];
    const puOwned = owned(g.pickup);
    const fake = { uid: 'pu', tid: g.pickup, race: pu.race, cls: pu.cls, color: pu.color, rarity: pu.rarity };
    UI.screen('gacha', `${Town.header()}<div class="panel gacha">
      <h2>招来の間</h2>
      <p class="hint">奈落の力を宿す祭壇。ゴールドを捧げ、各地の冒険者を招き寄せる。</p>
      <div class="banner r${pu.rarity}">
        <div class="banner-art">${UI.portrait(fake, 140)}</div>
        <div class="banner-info"><div class="pu-label">PICK UP</div>
          <div class="stars">${UI.stars(pu.rarity)}</div>
          <div class="big">${esc(pu.name)} <span class="hint">${esc(pu.title)}</span></div>
          <div>${D.ALIGNS[pu.align].name} / ${D.RACES[pu.race].name} / ${D.CLASSES[pu.cls].name}</div>
          ${pu.sig ? `<div class="hint">固有スキル: <b>${D.SKILLS[pu.sig].name}</b> ${esc(D.SKILLS[pu.sig].desc.replace('【固有】', ''))}</div>` : '<div class="hint">固有スキルなし</div>'}
          <div class="hint">${esc(pu.bio)}</div>
          <div>提供割合: <b>${rateOf(g.pickup).toFixed(2)}%</b> ${puOwned ? `<span class="tag ok">所持 凸${puOwned.dupes}</span>` : '<span class="tag">未所持</span>'}</div>
          <button class="btn" data-act="change">ピックアップを変更</button>
        </div></div>
      <div class="gacha-buttons">
        <button class="btn big-btn" data-act="pull" data-arg="1" ${s.gold < G.single ? 'disabled' : ''}>1回招来<br><small>${G.single.toLocaleString()} G</small></button>
        <button class="btn big-btn primary" data-act="pull" data-arg="10" ${s.gold < G.ten ? 'disabled' : ''}>10回招来<br><small>${G.ten.toLocaleString()} G・★4以上1体確定</small></button>
      </div>
      <div class="gacha-meta">
        <div>招来ポイント: <b>${g.points}</b> / ${G.exchangePoints} <button class="btn sm" data-act="exchange" ${g.points < G.exchangePoints ? 'disabled' : ''}>ピックアップと交換</button></div>
        <div>★5確定まで: あと <b>${G.pity5 - g.since5}</b> 回</div>
        <div class="hint">提供割合 ★5 ${G.rates[5]}% / ★4 ${G.rates[4]}% / ★3 ${G.rates[3]}%。ピックアップは同レアリティ内で${G.pickupShare}%の確率で選ばれます。重複したキャラクターは凸（能力+5%、最大${G.maxDupes}）、上限到達後はゴールドに還元されます。</div>
        <p><button class="btn sm" data-act="rates">個別の提供割合</button> <button class="btn sm" data-act="history">招来履歴</button></p>
      </div>
      <div class="nav-buttons"><button class="btn" data-act="back">町へ戻る</button></div></div>`, {
      back: () => Town.show(), change: changePickup, pull: (n) => pull(+n), exchange, rates: showRates, history: showHistory,
    });
  }

  async function changePickup() {
    const g = S().gacha;
    const list = Object.entries(D.CHARACTERS).sort((a, b) => b[1].rarity - a[1].rarity);
    const v = await UI.modal({
      title: 'ピックアップを選択', cls: 'wide',
      html: `<p class="hint">すべてのキャラクターから、ピックアップ対象を自由に選べます。</p><div class="roster">${list.map(([id, t]) => {
        const o = owned(id);
        return `<button class="rcard r${t.rarity} ${g.pickup === id ? 'sel' : ''}" data-act="sel" data-arg="${id}">${UI.portrait({ uid: 'sel' + id, race: t.race, cls: t.cls, color: t.color }, 48)}
          <div><div><span class="stars">${UI.stars(t.rarity)}</span> ${esc(t.name)}</div><div class="hint">${esc(t.title)} / ${D.CLASSES[t.cls].name}</div>
          ${o ? `<span class="tag ok">所持 凸${o.dupes}</span>` : '<span class="tag">未所持</span>'}</div></button>`;
      }).join('')}</div>`,
      buttons: [{ label: '閉じる', value: null }],
      handlers: { sel: (id, el, api) => api.close(id) },
    });
    if (v) { g.pickup = v; Core.save(); }
    show();
  }

  async function pull(n) {
    const s = S();
    const cost = n === 10 ? G.ten : G.single;
    if (s.gold < cost) { UI.toast('ゴールドが足りません'); return; }
    s.gold -= cost;
    const tids = [];
    for (let i = 0; i < n; i++) tids.push(drawOne(n === 10 && i === 9 && !tids.some((t) => D.CHARACTERS[t].rarity >= 4)));
    const results = tids.map((tid) => {
      const wasOwned = !!owned(tid);
      const r = Core.recruit(tid);
      return { tid, isNew: !wasOwned, dupes: r.char.dupes, refund: r.refund };
    });
    s.gacha.history.unshift(...tids.map((tid) => ({ tid, t: Date.now() })));
    s.gacha.history.length = Math.min(s.gacha.history.length, 100);
    Core.save();
    await reveal(results);
    show();
  }

  async function reveal(results) {
    const max = Math.max(...results.map((r) => D.CHARACTERS[r.tid].rarity));
    await UI.modal({
      title: '', cls: 'gacha-reveal wide', dismiss: false,
      html: `<div class="summon-circle r${max}"><div class="ring"></div><div class="ring r2"></div></div>
        <div class="results">${results.map((r, i) => { const t = D.CHARACTERS[r.tid]; return `
        <div class="result-card r${t.rarity}" style="animation-delay:${0.6 + i * 0.18}s">
          ${UI.portrait({ uid: 'res' + i, race: t.race, cls: t.cls, color: t.color }, 72)}
          <div class="stars">${UI.stars(t.rarity)}</div><div class="rname">${esc(t.name)}</div>
          <div class="rtag">${r.isNew ? '<span class="tag new">NEW</span>' : r.refund ? `<span class="tag">+${r.refund}G</span>` : `<span class="tag">凸${r.dupes}</span>`}</div>
        </div>`; }).join('')}</div>`,
      buttons: [{ label: 'OK', value: true, cls: 'primary' }],
    });
  }

  async function exchange() {
    const g = S().gacha; const t = D.CHARACTERS[g.pickup];
    if (g.points < G.exchangePoints) return;
    if (!(await UI.confirm('交換', `招来ポイント${G.exchangePoints}を使って\n${UI.stars(t.rarity)} ${t.name} と交換しますか？`))) return;
    g.points -= G.exchangePoints;
    const wasOwned = !!owned(g.pickup);
    const r = Core.recruit(g.pickup);
    Core.save();
    await reveal([{ tid: g.pickup, isNew: !wasOwned, dupes: r.char.dupes, refund: r.refund }]);
    show();
  }

  function showRates() {
    const list = Object.keys(D.CHARACTERS).sort((a, b) => D.CHARACTERS[b].rarity - D.CHARACTERS[a].rarity);
    UI.modal({ title: '個別の提供割合', html: `<table class="list">${list.map((id) => `<tr><td><span class="stars">${UI.stars(D.CHARACTERS[id].rarity)}</span> ${esc(D.CHARACTERS[id].name)}${id === S().gacha.pickup ? ' <span class="tag ok">PU</span>' : ''}</td><td class="num">${rateOf(id).toFixed(3)}%</td></tr>`).join('')}</table>` });
  }
  function showHistory() {
    const h = S().gacha.history;
    UI.modal({ title: '招来履歴（最新100件）', html: h.length ? `<table class="list">${h.map((x) => `<tr><td><span class="stars">${UI.stars(D.CHARACTERS[x.tid].rarity)}</span> ${esc(D.CHARACTERS[x.tid].name)}</td><td class="hint">${new Date(x.t).toLocaleString()}</td></tr>`).join('')}</table>` : '<p class="hint">まだ招来していません。</p>' });
  }

  return { show, rateOf, drawOne };
})();
