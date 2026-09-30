// 状態管理・セーブ・キャラクター計算
window.Core = (() => {
  const D = window.DATA;
  const SAVE_KEY = 'wvd_offline_save_v1';
  let S = null; // ゲーム状態

  const rand = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
  const randf = (a, b) => a + Math.random() * (b - a);
  const chance = (pct) => Math.random() * 100 < pct;
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  function newState() {
    return {
      version: 1,
      created: Date.now(),
      heroUid: null,
      nextUid: 1,
      chars: {},
      party: [null, null, null, null, null, null],
      gold: D.START_GOLD,
      bag: { potion: 5, antidote: 2, return_scroll: 1 },
      gacha: { pickup: 'seraphina', points: 0, pulls: 0, since5: 0, history: [] },
      dungeon: { active: false, floor: 1, x: 1, y: 1, dir: 2, steps: 0, sinceBattle: 0 },
      floors: {},
      deepest: 1,
      flags: {},
      clearCount: 0,
      settings: { speed: 1, encounter: 1 },
      stats: { battles: 0, kills: 0, playSteps: 0 },
    };
  }

  function state() { return S; }
  function setState(s) { S = s; }

  function save() {
    if (!S) return;
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch (e) { console.warn('save failed', e); }
  }
  function hasSave() {
    try { return !!localStorage.getItem(SAVE_KEY); } catch (e) { return false; }
  }
  function load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return false;
      S = migrate(JSON.parse(raw));
      return true;
    } catch (e) { console.warn(e); return false; }
  }
  function migrate(s) {
    const base = newState();
    for (const k in base) if (s[k] === undefined) s[k] = base[k];
    for (const k in base.settings) if (s.settings[k] === undefined) s.settings[k] = base.settings[k];
    for (const k in base.gacha) if (s.gacha[k] === undefined) s.gacha[k] = base.gacha[k];
    return s;
  }
  function exportSave() { return btoa(unescape(encodeURIComponent(JSON.stringify(S)))); }
  function importSave(text) {
    const t = text.trim();
    let obj;
    try { obj = JSON.parse(t); } catch (e) { obj = JSON.parse(decodeURIComponent(escape(atob(t)))); }
    if (!obj || !obj.chars || !obj.party) throw new Error('invalid');
    S = migrate(obj);
    save();
  }
  function deleteSave() { try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* ignore */ } }

  // ---------- キャラクター ----------
  function makeChar(opt) {
    const uid = 'c' + (S.nextUid++);
    const c = {
      uid, tid: opt.tid || null, isHero: !!opt.isHero,
      name: opt.name, title: opt.title || '', race: opt.race, cls: opt.cls, align: opt.align,
      rarity: opt.rarity || 0, color: opt.color || '#ddd', portrait: opt.portrait || 0,
      lv: 1, exp: 0, base: { ...opt.base }, dupes: 0,
      hp: 1, mp: 0, status: { dead: false, poison: false, sleep: false },
      equip: { weapon: null, armor: null, acc: null },
      sig: opt.sig || null,
    };
    if (opt.equip) for (const k in opt.equip) c.equip[D.ITEMS[opt.equip[k]].slot] = opt.equip[k];
    S.chars[uid] = c;
    const st = stats(c); c.hp = st.maxHp; c.mp = st.maxMp;
    return c;
  }

  function recruit(tid) {
    const t = D.CHARACTERS[tid];
    const existing = Object.values(S.chars).find((c) => c.tid === tid);
    if (existing) {
      if (existing.dupes < D.GACHA.maxDupes) {
        const before = stats(existing);
        existing.dupes++;
        const after = stats(existing);
        if (!existing.status.dead) { existing.hp += after.maxHp - before.maxHp; existing.mp += after.maxMp - before.maxMp; }
        return { char: existing, dupe: true };
      }
      const refund = D.GACHA.dupeRefund[t.rarity];
      S.gold += refund;
      return { char: existing, dupe: true, refund };
    }
    const c = makeChar({ tid, name: t.name, title: t.title, race: t.race, cls: t.cls, align: t.align, rarity: t.rarity, color: t.color, base: t.base, sig: t.sig, equip: t.equip });
    const hero = S.chars[S.heroUid];
    const targetLv = hero ? Math.max(1, Math.floor(hero.lv * 0.8)) : 1;
    while (c.lv < targetLv) levelUp(c, true);
    fullHeal(c);
    // 空きがあれば自動で編成
    const empty = S.party.indexOf(null);
    if (empty >= 0) S.party[empty] = c.uid;
    return { char: c, dupe: false };
  }

  function equipStat(c, key) {
    let v = 0;
    for (const slot of ['weapon', 'armor', 'acc']) {
      const id = c.equip[slot]; if (!id) continue;
      const it = D.ITEMS[id]; if (it && it[key]) v += it[key];
    }
    return v;
  }

  function stats(c) {
    const cl = D.CLASSES[c.cls];
    const b = c.base;
    const lv = c.lv;
    const dm = 1 + c.dupes * 0.05;
    const heroM = c.isHero ? 1.05 : 1;
    const agi = b.agi + equipStat(c, 'agi');
    const luk = b.luk + equipStat(c, 'luk');
    const maxHp = Math.floor((cl.hpDie * 2 + b.vit) * (1 + (lv - 1) * 0.28) * dm * heroM);
    const mpStat = b[cl.mpStat];
    const maxMp = cl.caster
      ? Math.floor((6 + mpStat) * (1 + (lv - 1) * 0.22) * dm)
      : Math.floor((4 + mpStat / 2) * (1 + (lv - 1) * 0.15) * dm);
    const w = c.equip.weapon ? D.ITEMS[c.equip.weapon] : null;
    const atk = Math.floor((Math.floor(b.str * 0.8) + lv + equipStat(c, 'atk')) * dm * heroM);
    const def = Math.floor(b.vit * 0.4) + Math.floor(lv / 2) + equipStat(c, 'def');
    const mat = Math.floor((Math.floor(b.iq * 1.1) + lv + equipStat(c, 'mat')) * dm * heroM);
    const heal = Math.floor((Math.floor(b.pie * 1.1) + lv + equipStat(c, 'mat')) * dm * heroM);
    const spd = agi + Math.floor(lv / 2);
    const crit = 3 + Math.floor(luk / 2) + equipStat(c, 'crit');
    const eva = Math.floor(agi / 2) + Math.floor(luk / 4);
    const mdef = Math.floor((b.iq + b.pie) / 4) + Math.floor(lv / 2);
    return { maxHp, maxMp, atk, def, mat, heal, spd, crit, eva, mdef, agi, luk, ranged: !!(w && w.ranged) };
  }

  function skills(c) {
    const list = [];
    if (c.isHero) list.push('sig_hero');
    if (c.sig) list.push(c.sig);
    for (const [lv, id] of D.CLASS_SKILLS[c.cls]) if (c.lv >= lv) list.push(id);
    return list;
  }

  function levelUp(c, silent) {
    const cl = D.CLASSES[c.cls];
    const before = stats(c);
    c.lv++;
    const gains = [];
    const primary = { fighter: ['str', 'vit'], thief: ['agi', 'luk'], mage: ['iq', 'agi'], priest: ['pie', 'vit'] }[c.cls];
    for (const k of D.STATS) {
      const p = primary.includes(k) ? 55 : 25;
      if (c.base[k] < 25 && chance(p)) { c.base[k]++; gains.push(D.STAT_NAMES[k]); }
    }
    const after = stats(c);
    c.hp += after.maxHp - before.maxHp;
    c.mp += after.maxMp - before.maxMp;
    const newSkills = D.CLASS_SKILLS[c.cls].filter(([lv]) => lv === c.lv).map(([, id]) => D.SKILLS[id].name);
    return { gains, newSkills, hp: after.maxHp - before.maxHp, cl };
  }

  function gainExp(c, amount) {
    const msgs = [];
    c.exp += amount;
    while (c.lv < 99 && c.exp >= D.expToNext(c.lv)) {
      c.exp -= D.expToNext(c.lv);
      const r = levelUp(c);
      let m = `${c.name} はレベル ${c.lv} になった！`;
      if (r.gains.length) m += `（${r.gains.join('・')} +1）`;
      msgs.push(m);
      for (const s of r.newSkills) msgs.push(`${c.name} は「${s}」を習得した！`);
    }
    return msgs;
  }

  function fullHeal(c) {
    const st = stats(c);
    c.hp = st.maxHp; c.mp = st.maxMp;
    c.status.poison = false; c.status.sleep = false;
  }

  function partyChars() { return S.party.map((u) => (u ? S.chars[u] : null)); }
  function partyMembers() { return partyChars().filter(Boolean); }
  function alive(c) { return c && !c.status.dead; }

  function canEquip(c, itemId) {
    const it = D.ITEMS[itemId];
    if (!it || !it.slot) return false;
    if (it.slot === 'acc') return true;
    const cl = D.CLASSES[c.cls];
    if (it.slot === 'weapon') return cl.weapons.includes(it.kind);
    if (it.slot === 'armor') return cl.armors.includes(it.kind);
    return false;
  }

  function equipItem(c, itemId) {
    const it = D.ITEMS[itemId];
    if (!canEquip(c, itemId) || !S.bag[itemId]) return false;
    const old = c.equip[it.slot];
    const before = stats(c);
    removeItem(itemId);
    if (old) addItem(old);
    c.equip[it.slot] = itemId;
    clampHpMp(c, before);
    return true;
  }
  function unequip(c, slot) {
    const old = c.equip[slot]; if (!old) return;
    const before = stats(c);
    addItem(old); c.equip[slot] = null;
    clampHpMp(c, before);
  }
  function clampHpMp(c) {
    const st = stats(c);
    c.hp = Math.min(c.hp, st.maxHp); c.mp = Math.min(c.mp, st.maxMp);
  }

  function addItem(id, n = 1) { S.bag[id] = (S.bag[id] || 0) + n; }
  function removeItem(id, n = 1) { S.bag[id] = (S.bag[id] || 0) - n; if (S.bag[id] <= 0) delete S.bag[id]; }

  function shopTier() { return Math.min(3, S.deepest); }

  function floorState(f) {
    if (!S.floors[f]) S.floors[f] = { seen: {}, done: {} };
    return S.floors[f];
  }

  return {
    rand, randf, chance, pick, clamp,
    newState, state, setState, save, load, hasSave, exportSave, importSave, deleteSave,
    makeChar, recruit, stats, skills, levelUp, gainExp, fullHeal, partyChars, partyMembers, alive,
    canEquip, equipItem, unequip, addItem, removeItem, shopTier, floorState, clampHpMp,
  };
})();
