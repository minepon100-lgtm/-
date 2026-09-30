// 戦闘システム
window.Battle = (() => {
  const D = window.DATA; const { esc } = UI;
  const S = () => Core.state();
  let B = null; // 戦闘状態

  function start(group, opts = {}) {
    return new Promise((resolve) => {
      const s = S();
      const floor = s.dungeon.floor;
      if (!group) group = Dungeon.rollGroup(floor);
      const enemies = [];
      const counts = {};
      for (const [id, n] of group) for (let i = 0; i < n && enemies.length < 6; i++) {
        const e = D.ENEMIES[id];
        counts[id] = (counts[id] || 0) + 1;
        enemies.push({ id, def: e, name: e.name, hp: e.hp, maxHp: e.hp, status: { sleep: 0, poison: false }, idx: enemies.length, n: counts[id] });
      }
      for (const e of enemies) if (counts[e.id] > 1) e.name = `${e.def.name}${'ABCDEF'[e.n - 1]}`;
      B = { enemies, opts, resolve, turn: 1, log: [], inputIdx: 0, actions: {}, mode: 'cmd', buffs: {}, lastActions: null, busy: false };
      for (const c of Core.partyMembers()) B.buffs[c.uid] = { atk: 0, def: 0, defending: false };
      s.stats.battles++;
      render();
      const names = [...new Set(enemies.map((e) => e.def.name))].join('、');
      addLog(opts.boss ? `${names} が立ちはだかった！` : `${names} が現れた！`);
      beginInput();
    });
  }

  const party = () => Core.partyChars();
  const slotOf = (c) => S().party.indexOf(c.uid);
  const aliveEnemies = () => B.enemies.filter((e) => e.hp > 0);
  const aliveParty = () => Core.partyMembers().filter(Core.alive);
  const canAct = (c) => c && Core.alive(c) && !c.status.sleep;
  const delay = () => [0, 480, 260, 90][S().settings.speed] || 480;

  function addLog(m, cls = '') {
    B.log.push({ m, cls });
    if (B.log.length > 60) B.log.shift();
    const el = document.getElementById('blog');
    if (el) { el.innerHTML = B.log.slice(-6).map((x) => `<div class="${x.cls}">${esc(x.m)}</div>`).join(''); el.scrollTop = el.scrollHeight; }
  }

  // ---------- 描画 ----------
  function render() {
    UI.screen('battle', `<div class="battle ${B.opts.boss ? 'boss' : ''}">
      <div class="turn-label" id="turn">ターン ${B.turn}</div>
      <div class="enemy-area" id="enemies"></div>
      <div class="blog" id="blog"></div>
      <div class="command" id="cmd"></div>
      <div class="bparty" id="bparty"></div></div>`, handlers);
    renderEnemies(); renderParty(); renderCmd();
    const el = document.getElementById('blog');
    if (el) el.innerHTML = B.log.slice(-6).map((x) => `<div class="${x.cls}">${esc(x.m)}</div>`).join('');
  }

  function renderEnemies() {
    const el = document.getElementById('enemies'); if (!el) return;
    const targeting = B.mode === 'target' && B.pending && B.pending.tgt === 'enemy';
    el.innerHTML = B.enemies.map((e, i) => `
      <button class="enemy ${e.hp <= 0 ? 'down' : ''} ${targeting && e.hp > 0 ? 'targetable' : ''}" data-act="tgtE" data-arg="${i}" id="en${i}" ${e.hp <= 0 ? 'disabled' : ''}>
        ${UI.enemySprite(e.def, 84)}
        <div class="ename">${esc(e.name)}</div>${UI.hpBar(e.hp, e.maxHp)}
        <div class="est">${e.status.sleep ? '<span class="st sleep">睡眠</span>' : ''}${e.status.poison ? '<span class="st poison">毒</span>' : ''}</div>
      </button>`).join('');
  }

  function renderParty() {
    const el = document.getElementById('bparty'); if (!el) return;
    const targeting = B.mode === 'target' && B.pending && (B.pending.tgt === 'ally' || B.pending.tgt === 'deadAlly');
    const cur = currentActor();
    el.innerHTML = party().map((c, i) => {
      if (!c) return `<div class="bmember empty"></div>`;
      const st = Core.stats(c); const bf = B.buffs[c.uid] || {};
      const okT = targeting && (B.pending.tgt === 'deadAlly' ? c.status.dead : !c.status.dead);
      return `<button class="bmember ${c.status.dead ? 'dead' : ''} ${cur === c ? 'active' : ''} ${okT ? 'targetable' : ''}" data-act="tgtA" data-arg="${c.uid}" id="pm${c.uid}">
        <div class="row-label">${i < 3 ? '前' : '後'}</div>${UI.portrait(c, 40)}
        <div class="bm-info"><div class="pm-name">${esc(c.name)}</div>
        <div class="pm-num">HP ${c.hp}/${st.maxHp}</div>${UI.hpBar(c.hp, st.maxHp)}
        <div class="pm-num">MP ${c.mp}/${st.maxMp}</div>${UI.hpBar(c.mp, st.maxMp, 'mp')}
        <div>${UI.statusText(c)}${bf.atk ? '<span class="st buff">攻↑</span>' : ''}${bf.def ? '<span class="st buff">防↑</span>' : ''}${B.actions[c.uid] ? '<span class="st ready">✓</span>' : ''}</div></div></button>`;
    }).join('');
  }

  function actors() { return party().filter(canAct); }
  function currentActor() { if (B.busy) return null; return actors()[B.inputIdx] || null; }

  function renderCmd() {
    const el = document.getElementById('cmd'); if (!el) return;
    if (B.busy) { el.innerHTML = '<div class="hint">……</div>'; return; }
    const c = currentActor();
    if (!c) { el.innerHTML = ''; return; }
    const st = Core.stats(c);
    const back = slotOf(c) >= 3 && !st.ranged;
    if (B.mode === 'cmd') {
      el.innerHTML = `<div class="cmd-head"><b>${esc(c.name)}</b> の行動 ${back ? '<span class="hint">（後列：近接攻撃は威力半減）</span>' : ''}</div>
        <div class="cmd-buttons">
        <button class="btn" data-act="attack">攻撃</button>
        <button class="btn" data-act="skills">スキル</button>
        <button class="btn" data-act="defend">防御</button>
        <button class="btn" data-act="items">道具</button>
        ${B.opts.canFlee ? '<button class="btn" data-act="flee">逃げる</button>' : ''}
        ${B.inputIdx > 0 ? '<button class="btn" data-act="undo">戻る</button>' : ''}
        </div><div class="cmd-buttons sub"><button class="btn sm" data-act="auto">オート（全員攻撃）</button>${B.lastActions ? '<button class="btn sm" data-act="repeat">前ターンと同じ</button>' : ''}</div>`;
    } else if (B.mode === 'skill') {
      const list = Core.skills(c);
      el.innerHTML = `<div class="cmd-head"><b>${esc(c.name)}</b> のスキル（MP ${c.mp}）</div><div class="cmd-buttons skills">
        ${list.map((id) => { const sk = D.SKILLS[id]; return `<button class="btn" data-act="skill" data-arg="${id}" ${c.mp < sk.mp ? 'disabled' : ''} title="${esc(sk.desc)}">${sk.name}<small>MP${sk.mp}</small></button>`; }).join('')}
        <button class="btn" data-act="cancel">戻る</button></div>`;
    } else if (B.mode === 'item') {
      const ids = Object.keys(S().bag).filter((id) => D.ITEMS[id].kind === 'consumable' && D.ITEMS[id].battle !== false);
      const reserved = reservedItems();
      el.innerHTML = `<div class="cmd-head"><b>${esc(c.name)}</b> の道具</div><div class="cmd-buttons skills">
        ${ids.length ? ids.map((id) => { const left = S().bag[id] - (reserved[id] || 0); return `<button class="btn" data-act="item" data-arg="${id}" ${left <= 0 ? 'disabled' : ''} title="${esc(D.ITEMS[id].desc)}">${D.ITEMS[id].name}<small>×${left}</small></button>`; }).join('') : '<span class="hint">使える道具がない</span>'}
        <button class="btn" data-act="cancel">戻る</button></div>`;
    } else if (B.mode === 'target') {
      const t = B.pending.tgt;
      el.innerHTML = `<div class="cmd-head"><b>${esc(c.name)}</b>：${t === 'enemy' ? '攻撃する敵' : t === 'deadAlly' ? '蘇生する仲間' : '対象の仲間'}を選んでください</div>
        <div class="cmd-buttons"><button class="btn" data-act="cancel">戻る</button></div>`;
    }
  }

  function reservedItems() {
    const r = {};
    for (const uid in B.actions) { const a = B.actions[uid]; if (a.type === 'item') r[a.item] = (r[a.item] || 0) + 1; }
    return r;
  }

  function renderAll() { renderEnemies(); renderParty(); renderCmd(); const t = document.getElementById('turn'); if (t) t.textContent = `ターン ${B.turn}`; }

  // ---------- 入力 ----------
  function beginInput() {
    B.busy = false; B.inputIdx = 0; B.actions = {}; B.mode = 'cmd'; B.pending = null;
    if (!actors().length) { executeTurn(); return; }
    renderAll();
  }

  function setAction(a) {
    const c = currentActor();
    B.actions[c.uid] = a;
    B.mode = 'cmd'; B.pending = null;
    B.inputIdx++;
    if (B.inputIdx >= actors().length) executeTurn();
    else renderAll();
  }

  function askTarget(tgt, build) {
    B.mode = 'target'; B.pending = { tgt, build };
    renderAll();
  }

  const handlers = {
    attack: () => askTarget('enemy', (t) => ({ type: 'attack', target: t })),
    defend: () => setAction({ type: 'defend' }),
    flee: () => setAction({ type: 'flee' }),
    skills: () => { B.mode = 'skill'; renderAll(); },
    items: () => { B.mode = 'item'; renderAll(); },
    cancel: () => { B.mode = 'cmd'; B.pending = null; renderAll(); },
    undo: () => { if (B.inputIdx > 0) { B.inputIdx--; delete B.actions[currentActor().uid]; B.mode = 'cmd'; renderAll(); } },
    skill: (id) => {
      const sk = D.SKILLS[id];
      const make = (t) => ({ type: 'skill', skill: id, target: t });
      if (sk.target === 'enemy' || sk.target === 'ally') askTarget(sk.target, make);
      else if (sk.target === 'deadAlly') {
        if (!party().some((c) => c && c.status.dead)) { UI.toast('戦闘不能の仲間はいない'); return; }
        askTarget('deadAlly', make);
      } else setAction(make(null));
    },
    item: (id) => {
      const it = D.ITEMS[id];
      if (it.revive && !party().some((c) => c && c.status.dead)) { UI.toast('戦闘不能の仲間はいない'); return; }
      askTarget(it.revive ? 'deadAlly' : 'ally', (t) => ({ type: 'item', item: id, target: t }));
    },
    tgtE: (i) => { if (B.mode === 'target' && B.pending.tgt === 'enemy') setAction(B.pending.build(+i)); },
    tgtA: (uid) => {
      if (B.mode === 'target' && (B.pending.tgt === 'ally' || B.pending.tgt === 'deadAlly')) {
        const c = S().chars[uid];
        if (B.pending.tgt === 'deadAlly' ? !c.status.dead : c.status.dead) return;
        setAction(B.pending.build(uid));
      }
    },
    auto: () => {
      while (B.inputIdx < actors().length) {
        const c = currentActor();
        const e = aliveEnemies()[0];
        B.actions[c.uid] = { type: 'attack', target: e ? e.idx : 0 };
        B.inputIdx++;
      }
      executeTurn();
    },
    repeat: () => {
      const last = B.lastActions || {};
      while (B.inputIdx < actors().length) {
        const c = currentActor();
        let a = last[c.uid];
        if (a && a.type === 'skill' && c.mp < D.SKILLS[a.skill].mp) a = null;
        if (a && a.type === 'item') a = null;
        if (a && a.type === 'flee') a = null;
        B.actions[c.uid] = a ? { ...a } : { type: 'attack', target: (aliveEnemies()[0] || {}).idx || 0 };
        B.inputIdx++;
      }
      executeTurn();
    },
  };

  // ---------- 実行 ----------
  async function executeTurn() {
    B.busy = true; B.mode = 'cmd';
    B.lastActions = JSON.parse(JSON.stringify(B.actions));
    renderAll();
    // 逃走
    if (Object.values(B.actions).some((a) => a.type === 'flee')) {
      const ps = aliveParty().reduce((a, c) => a + Core.stats(c).spd, 0) / Math.max(1, aliveParty().length);
      const es = aliveEnemies().reduce((a, e) => a + e.def.agi, 0) / Math.max(1, aliveEnemies().length);
      if (Core.chance(Core.clamp(55 + (ps - es) * 2, 20, 90))) {
        addLog('うまく逃げ切った！');
        await UI.wait(delay() + 300);
        return end('flee');
      }
      addLog('逃げられなかった！', 'warn');
      for (const uid in B.actions) B.actions[uid] = { type: 'none' };
      await UI.wait(delay());
    }
    for (const uid in B.actions) if (B.actions[uid].type === 'defend') B.buffs[uid].defending = true;

    const queue = [];
    for (const c of party()) if (c && B.actions[c.uid]) queue.push({ side: 'p', c, a: B.actions[c.uid], spd: Core.stats(c).spd + Core.rand(0, 6) });
    for (const e of aliveEnemies()) {
      const n = e.def.actions || 1;
      for (let i = 0; i < n; i++) queue.push({ side: 'e', e, spd: e.def.agi + Core.rand(0, 6) - i * 8 });
    }
    queue.sort((a, b) => b.spd - a.spd);

    for (const q of queue) {
      if (q.side === 'p') {
        if (!Core.alive(q.c) || q.c.status.sleep) continue;
        await doPartyAction(q.c, q.a);
      } else {
        if (q.e.hp <= 0 || q.e.status.sleep) continue;
        await doEnemyAction(q.e);
      }
      renderEnemies(); renderParty();
      if (!aliveEnemies().length) return victory();
      if (!aliveParty().length) return defeat();
    }
    // ターン終了処理
    for (const c of aliveParty()) {
      if (c.status.poison) { const dmg = Math.max(1, Math.floor(Core.stats(c).maxHp * 0.06)); c.hp -= dmg; addLog(`${c.name} は毒で ${dmg} のダメージ！`, 'dmg'); if (c.hp <= 0) { c.hp = 0; c.status.dead = true; c.status.poison = false; addLog(`${c.name} は倒れた……`, 'warn'); } }
      if (c.status.sleep && Core.chance(45)) { c.status.sleep = false; addLog(`${c.name} は目を覚ました。`); }
      const bf = B.buffs[c.uid]; if (bf) { bf.defending = false; if (bf.atk) bf.atk--; if (bf.def) bf.def--; }
    }
    for (const e of aliveEnemies()) {
      if (e.status.poison) { const dmg = Math.max(1, Math.floor(e.maxHp * 0.06)); e.hp -= dmg; addLog(`${e.name} は毒で ${dmg} のダメージ！`); if (e.hp <= 0) { e.hp = 0; addLog(`${e.name} を倒した！`, 'good'); } }
      if (e.status.sleep) { e.status.sleep--; if (!e.status.sleep) addLog(`${e.name} は目を覚ました。`); }
    }
    renderEnemies(); renderParty();
    if (!aliveEnemies().length) return victory();
    if (!aliveParty().length) return defeat();
    B.turn++;
    beginInput();
  }

  function retargetEnemy(i) {
    const e = B.enemies[i];
    if (e && e.hp > 0) return e;
    return Core.pick(aliveEnemies());
  }
  function flash(id, cls = 'hit') {
    const el = document.getElementById(id); if (!el) return;
    el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls);
  }

  function physDamage(c, e, power, opt = {}) {
    const st = Core.stats(c); const bf = B.buffs[c.uid] || {};
    const backPen = slotOf(c) >= 3 && !st.ranged ? 0.5 : 1;
    const hit = e.status.sleep ? 100 : Core.clamp(85 + (st.spd - e.def.agi) * 1.5, 50, 98);
    if (!Core.chance(hit)) return { miss: true };
    const crit = Core.chance(st.crit + (opt.crit || 0));
    let atk = st.atk * (bf.atk ? 1.3 : 1);
    let dmg = atk * power * Core.randf(0.9, 1.1) * backPen;
    if (!crit && !opt.pierce) dmg -= e.def.def * 0.35;
    if (crit) dmg *= 1.5;
    if (opt.holy && e.def.undead) dmg *= 1.5;
    return { dmg: Math.max(1, Math.floor(dmg)), crit };
  }
  function magicDamage(c, e, sk) {
    const st = Core.stats(c);
    const base = sk.holy ? st.heal : st.mat;
    let dmg = base * sk.power * Core.randf(0.9, 1.1) - e.def.def * 0.15;
    if (sk.holy && e.def.undead) dmg *= 2;
    return Math.max(1, Math.floor(dmg));
  }

  function hurtEnemy(e, dmg, c) {
    e.hp = Math.max(0, e.hp - dmg);
    if (e.status.sleep && Core.chance(30)) e.status.sleep = 0;
    flash('en' + e.idx);
    if (e.hp <= 0) { addLog(`${e.name} を倒した！`, 'good'); S().stats.kills++; }
    void c;
  }

  async function doPartyAction(c, a) {
    const s = S();
    if (a.type === 'none') return;
    if (a.type === 'defend') { addLog(`${c.name} は身を守っている。`); await UI.wait(delay() / 2); return; }
    if (a.type === 'attack') {
      const e = retargetEnemy(a.target); if (!e) return;
      const r = physDamage(c, e, 1);
      if (r.miss) addLog(`${c.name} の攻撃！ ${e.name} にかわされた。`);
      else { addLog(`${c.name} の攻撃！${r.crit ? ' 会心の一撃！' : ''} ${e.name} に ${r.dmg} のダメージ！`, r.crit ? 'crit' : ''); hurtEnemy(e, r.dmg, c); }
      await UI.wait(delay());
      return;
    }
    if (a.type === 'item') {
      const it = D.ITEMS[a.item];
      if (!s.bag[a.item]) { addLog(`${c.name} は${it.name}を使おうとしたが、もう無い！`); await UI.wait(delay()); return; }
      let t = s.chars[a.target];
      if (it.revive ? !t.status.dead : t.status.dead) { if (it.revive) { addLog(`${it.name} は必要なくなった。`); await UI.wait(delay()); return; } t = lowestAlly(); }
      if (!t) return;
      const msg = Town.applyItem(a.item, t);
      addLog(`${c.name} は${it.name}を使った。${msg}`, 'heal');
      flash('pm' + t.uid, 'healfx');
      await UI.wait(delay());
      return;
    }
    if (a.type === 'skill') {
      const sk = D.SKILLS[a.skill];
      if (c.mp < sk.mp) { addLog(`${c.name} はMPが足りない！`); await UI.wait(delay()); return; }
      c.mp -= sk.mp;
      addLog(`${c.name} の ${sk.name}！`, 'skill');
      await UI.wait(delay() * 0.6);
      const st = Core.stats(c);
      if (sk.type === 'phys' || sk.type === 'magic' || sk.type === 'debuff') {
        const targets = sk.target === 'enemies' ? aliveEnemies() : [retargetEnemy(a.target)].filter(Boolean);
        for (const e of targets) {
          if (e.hp <= 0) continue;
          if (sk.type === 'debuff') { inflictEnemy(e, sk); continue; }
          const hits = sk.hits || 1;
          for (let h = 0; h < hits && e.hp > 0; h++) {
            if (sk.type === 'phys') {
              const r = physDamage(c, e, sk.power, sk);
              if (r.miss) { addLog(`${e.name} にかわされた。`); continue; }
              addLog(`${r.crit ? '会心！ ' : ''}${e.name} に ${r.dmg} のダメージ！`, r.crit ? 'crit' : '');
              hurtEnemy(e, r.dmg, c);
              if (sk.drain) { const hv = Math.floor(r.dmg * sk.drain); c.hp = Math.min(st.maxHp, c.hp + hv); addLog(`${c.name} のHPが ${hv} 回復した。`, 'heal'); }
            } else {
              const dmg = magicDamage(c, e, sk);
              addLog(`${e.name} に ${dmg} のダメージ！`);
              hurtEnemy(e, dmg, c);
            }
            if (hits > 1) await UI.wait(delay() * 0.4);
          }
          if (sk.inflict && e.hp > 0) inflictEnemy(e, sk);
        }
      } else if (sk.type === 'heal') {
        const targets = sk.target === 'allies' ? aliveParty() : [s.chars[a.target]];
        for (let t of targets) {
          if (!t || t.status.dead) t = lowestAlly();
          if (!t) continue;
          const amt = Math.floor(st.heal * sk.power * Core.randf(0.9, 1.1));
          const mx = Core.stats(t).maxHp; const before = t.hp;
          t.hp = Math.min(mx, t.hp + amt);
          if (sk.cureAll) { t.status.poison = false; t.status.sleep = false; }
          addLog(`${t.name} のHPが ${t.hp - before} 回復した。`, 'heal');
          flash('pm' + t.uid, 'healfx');
        }
      } else if (sk.type === 'cure') {
        const t = s.chars[a.target];
        if (t && !t.status.dead) { t.status.poison = false; t.status.sleep = false; addLog(`${t.name} の状態異常が治った。`, 'heal'); }
      } else if (sk.type === 'buff') {
        for (const t of aliveParty()) { B.buffs[t.uid][sk.buff] = sk.turns; }
        addLog(sk.buff === 'atk' ? '味方全体の攻撃力が上がった！' : '味方全体の防御力が上がった！', 'good');
      } else if (sk.type === 'revive') {
        const t = s.chars[a.target];
        if (t && t.status.dead) { t.status.dead = false; t.hp = Math.max(1, Math.floor(Core.stats(t).maxHp * 0.3)); addLog(`${t.name} が蘇った！`, 'heal'); B.buffs[t.uid] = B.buffs[t.uid] || { atk: 0, def: 0, defending: false }; }
        else addLog('しかし何も起こらなかった。');
      }
      await UI.wait(delay());
    }
  }

  function inflictEnemy(e, sk) {
    const resist = e.def.boss ? 25 : 0;
    if (Core.chance(sk.chance - resist)) {
      if (sk.inflict === 'sleep') { e.status.sleep = Core.rand(1, 3); addLog(`${e.name} は眠った！`, 'good'); }
      if (sk.inflict === 'poison') { e.status.poison = true; addLog(`${e.name} は毒に侵された！`, 'good'); }
    } else addLog(`${e.name} には効かなかった。`);
  }

  function lowestAlly() {
    const l = aliveParty(); if (!l.length) return null;
    return l.sort((a, b) => a.hp / Core.stats(a).maxHp - b.hp / Core.stats(b).maxHp)[0];
  }

  function frontTargets() {
    const p = party();
    const front = [0, 1, 2].map((i) => p[i]).filter(Core.alive);
    return front.length ? front : aliveParty();
  }

  function hurtChar(c, dmg) {
    c.hp = Math.max(0, c.hp - dmg);
    flash('pm' + c.uid);
    if (c.status.sleep && Core.chance(50)) c.status.sleep = false;
    if (c.hp <= 0) { c.status.dead = true; c.status.poison = false; c.status.sleep = false; addLog(`${c.name} は倒れた……`, 'warn'); }
  }

  async function doEnemyAction(e) {
    const def = e.def;
    let sk = null;
    for (const s of def.skills || []) if (Core.chance(s.rate)) { sk = s; break; }
    if (!sk) {
      const t = Core.pick(frontTargets()); if (!t) return;
      enemyPhys(e, t, 1, `${e.name} の攻撃！`);
      await UI.wait(delay());
      return;
    }
    addLog(`${e.name} の ${sk.name}！`, 'eskill');
    await UI.wait(delay() * 0.6);
    let targets;
    if (sk.target === 'all') targets = aliveParty();
    else if (sk.target === 'front') targets = frontTargets();
    else targets = [sk.type === 'phys' ? Core.pick(frontTargets()) : Core.pick(aliveParty())];
    for (const t of targets) {
      if (!t || !Core.alive(t)) continue;
      const st = Core.stats(t); const bf = B.buffs[t.uid] || {};
      if (sk.type === 'phys') enemyPhys(e, t, sk.power, null, sk);
      else if (sk.type === 'magic' || sk.type === 'breath') {
        let dmg = (sk.type === 'breath' ? (def.mat || def.atk) : def.mat) * sk.power * Core.randf(0.9, 1.1) - st.mdef * (sk.type === 'breath' ? 0.3 : 0.5);
        if (bf.defending) dmg *= 0.7;
        dmg = Math.max(1, Math.floor(dmg));
        addLog(`${t.name} に ${dmg} のダメージ！`, 'dmg');
        hurtChar(t, dmg);
        if (sk.drain) { e.hp = Math.min(e.maxHp, e.hp + dmg); addLog(`${e.name} は生命力を吸い取った！`); }
      } else if (sk.type === 'debuff') {
        if (Core.chance(sk.chance - st.luk)) {
          if (sk.inflict === 'sleep') { t.status.sleep = true; addLog(`${t.name} は眠ってしまった！`, 'warn'); }
          if (sk.inflict === 'poison') { t.status.poison = true; addLog(`${t.name} は毒に侵された！`, 'warn'); }
        } else addLog(`${t.name} は耐えた。`);
      }
    }
    await UI.wait(delay());
  }

  function enemyPhys(e, t, power, head, sk) {
    const st = Core.stats(t); const bf = B.buffs[t.uid] || {};
    const hit = t.status.sleep ? 100 : Core.clamp(80 + (e.def.agi - st.eva) * 1.5, 35, 95);
    const pre = head ? head + ' ' : '';
    if (!Core.chance(hit)) { addLog(`${pre}${t.name} はひらりとかわした。`); return; }
    let dmg = e.def.atk * power * Core.randf(0.85, 1.15) - st.def * 0.35 * (bf.def ? 1.6 : 1);
    if (bf.defending) dmg *= 0.5;
    if (bf.def) dmg *= 0.8;
    dmg = Math.max(1, Math.floor(dmg));
    addLog(`${pre}${t.name} に ${dmg} のダメージ！`, 'dmg');
    hurtChar(t, dmg);
    if (sk && sk.inflict && Core.alive(t) && Core.chance(sk.chance - st.luk)) {
      if (sk.inflict === 'poison') { t.status.poison = true; addLog(`${t.name} は毒に侵された！`, 'warn'); }
      if (sk.inflict === 'sleep') { t.status.sleep = true; addLog(`${t.name} は眠ってしまった！`, 'warn'); }
    }
  }

  // ---------- 終了 ----------
  async function victory() {
    const s = S();
    let exp = 0, gold = 0; const drops = [];
    for (const e of B.enemies) {
      exp += e.def.exp; gold += e.def.gold;
      for (const [id, pct] of e.def.drops || []) if (Core.chance(pct)) drops.push(id);
    }
    gold = Math.floor(gold * Core.randf(0.9, 1.2));
    s.gold += gold;
    drops.forEach((id) => Core.addItem(id));
    const msgs = [];
    for (const c of aliveParty()) { c.status.sleep = false; msgs.push(...Core.gainExp(c, exp)); }
    s.dungeon.sinceBattle = 0;
    Core.save();
    addLog('戦いに勝利した！', 'good');
    await UI.wait(delay());
    await UI.modal({
      title: '勝利！', cls: 'victory',
      html: `<p>経験値 <b>${exp}</b> を獲得（生存者全員）<br>${gold} G を手に入れた。</p>
        ${drops.length ? `<p>戦利品: ${drops.map((id) => `<b>${esc(D.ITEMS[id].name)}</b>`).join('、')}</p>` : ''}
        ${msgs.length ? `<div class="levelups">${msgs.map((m) => `<div>${esc(m)}</div>`).join('')}</div>` : ''}`,
      buttons: [{ label: 'OK', value: true, cls: 'primary' }], dismiss: false,
    });
    end('win');
  }

  async function defeat() {
    addLog('パーティは全滅した……', 'warn');
    await UI.wait(delay() + 600);
    end('lose');
  }

  function end(result) {
    for (const c of Core.partyMembers()) c.status.sleep = false;
    const r = B.resolve;
    B = null;
    Core.save();
    r(result);
  }

  return { start, debug: () => B };
})();
