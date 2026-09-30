// 自動プレイbotによる通しプレイテスト（キャラクリ → 地下4階の番人撃破 → エンディング）
// 実行: NODE_PATH=$(npm root -g) node tools/fullrun.js
const { chromium } = require('playwright');
const path = require('path');

const TARGET_LV = { 1: 3, 2: 6, 3: 9, 4: 12 };
const OUT = process.env.OUT || '.';
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const page = await browser.newPage({ viewport: { width: 1100, height: 900 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message + '\n' + e.stack));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('file://' + path.resolve(__dirname, '../index.html'));
  const ev = (fn, arg) => page.evaluate(fn, arg);
  const sleep = (ms) => page.waitForTimeout(ms);

  // ---- キャラクリ ----
  await page.click('[data-act=newgame]');
  await page.fill('#cc-name', 'テスト');
  await page.click('[data-act=race][data-arg=dwarf]');
  await page.click('[data-act=next]');
  await page.click('[data-act=align][data-arg=good]');
  await page.click('[data-act=next]');
  for (const k of ['str', 'vit', 'agi']) for (let i = 0; i < 40; i++) { const b = await page.$(`[data-act=inc][data-arg=${k}]:not([disabled])`); if (!b) break; await b.click(); }
  await page.click('[data-act=next]');
  await page.click('[data-act=cls][data-arg=fighter]');
  await page.click('[data-act=next]');
  await page.click('[data-act=next]');
  await page.click('.modal .btn.primary');
  await page.click('.modal .btn');
  await ev(() => { Core.state().settings.speed = 3; });

  let wipes = 0, battles = 0, townTrips = 0;

  // ---- 戦闘bot ----
  async function decide() {
    return ev(() => {
      const B = Battle.debug(); if (!B || B.busy) return null;
      const D = DATA;
      const party = Core.partyChars();
      const actors = party.filter((c) => c && !c.status.dead && !c.status.sleep);
      const c = actors[B.inputIdx]; if (!c) return null;
      if (B.mode !== 'cmd') return { kind: 'cancel' };
      const alive = party.filter((x) => x && !x.status.dead);
      const dead = party.filter((x) => x && x.status.dead);
      const en = B.enemies.filter((e) => e.hp > 0);
      const sk = Core.skills(c).filter((id) => c.mp >= D.SKILLS[id].mp);
      const has = (id) => sk.includes(id);
      const ratio = (x) => x.hp / Core.stats(x).maxHp;
      const low = alive.filter((x) => ratio(x) < 0.5).sort((a, b) => ratio(a) - ratio(b));
      const boss = en.some((e) => e.def.boss);
      if (dead.length && has('revive')) return { kind: 'skill', id: 'revive', ally: dead[0].uid };
      if (low.length >= 2 && has('sig_benediction')) return { kind: 'skill', id: 'sig_benediction' };
      if (low.length >= 2 && has('heal_all')) return { kind: 'skill', id: 'heal_all' };
      if (low.length) { for (const id of ['heal_m', 'heal_s']) if (has(id)) return { kind: 'skill', id, ally: low[0].uid }; }
      if (boss && has('holy_shield') && !B.buffs[c.uid].def && B.turn % 3 === 1 && c.cls === 'priest') return { kind: 'skill', id: 'holy_shield' };
      const conserve = !boss && c.mp < Core.stats(c).maxMp * 0.4;
      if (!conserve && en.length >= 3) for (const id of ['sig_starfall', 'thunderstorm', 'sig_crimson', 'sig_holy_blade', 'sig_ice_coffin', 'explosion', 'holy_light', 'sweep']) if (has(id)) return { kind: 'skill', id };
      const tgt = en.sort((a, b) => a.hp - b.hp)[0];
      if (!conserve || boss) for (const id of ['sig_hero', 'crush', 'shadow_strike', 'ice_lance', 'sig_shadow_bind', 'sig_pierce', 'sig_gale', 'sig_judgement', 'double_hit', 'fire_bolt', 'power_strike']) if (has(id) && (boss || tgt.hp > 25)) return { kind: 'skill', id, enemy: tgt.idx };
      return { kind: 'attack', enemy: tgt.idx };
    });
  }

  async function fight() {
    battles++;
    for (let guard = 0; guard < 4000; guard++) {
      if (await page.$('.modal-wrap')) return;
      if (!(await page.$('.battle'))) return;
      const d = await decide();
      if (!d) { await sleep(40); continue; }
      try {
        if (d.kind === 'cancel') { await page.click('[data-act=cancel]'); continue; }
        if (d.kind === 'attack') { await page.click('[data-act=attack]'); await page.click(`#en${d.enemy}`); continue; }
        await page.click('[data-act=skills]');
        await page.click(`[data-act=skill][data-arg=${d.id}]`);
        if (d.enemy != null && await page.$('.enemy.targetable')) await page.click(`#en${d.enemy}`);
        else if (d.ally && await page.$('.bmember.targetable')) await page.click(`#pm${d.ally}`);
      } catch (e) { await sleep(50); }
    }
  }

  // モーダル・戦闘を処理。want: 'down' | 'up' | null
  async function handle(want = null) {
    let result = null;
    for (let i = 0; i < 200; i++) {
      if (await page.$('.battle') && !(await page.$('.modal-wrap'))) { await fight(); continue; }
      const m = await page.$('.modal-wrap');
      if (!m) break;
      const txt = await page.$eval('.modal-wrap', (e) => e.innerText);
      const click = async (label) => { const b = await page.$(`.modal-wrap .btn:not([disabled]) >> text=${label}`); if (b) { await b.click(); return true; } return false; };
      if (/上り階段/.test(txt)) { await click(want === 'up' ? 'はい' : 'いいえ'); if (want === 'up') result = 'up'; continue; }
      if (/下り階段/.test(txt)) { await click(want === 'down' ? 'はい' : 'いいえ'); if (want === 'down') result = 'down'; continue; }
      if (/全滅/.test(txt) && await click('町へ')) { wipes++; result = 'wipe'; log('!! 全滅'); continue; }
      if (/周回/.test(txt)) { await click('いいえ'); continue; }
      if (/踏破/.test(txt) && await click('町へ帰還')) { result = 'clear'; await page.screenshot({ path: OUT + '/ending.png' }); continue; }
      if (await click('戦う')) continue;
      if (await click('開ける')) continue;
      const btns = await page.$$('.modal-wrap .btn:not([disabled])');
      await btns[btns.length - 1].click();
    }
    return result;
  }

  const state = () => ev(() => { const s = Core.state(); return { ...s.dungeon, bag: s.bag, done: Core.floorState(s.dungeon.floor).done, screen: UI.currentScreen() }; });

  function bfs(grid, from, goal, hasKey, doneG = new Set()) {
    const key = (x, y) => x + ',' + y;
    const prev = new Map([[key(from.x, from.y), null]]);
    const q = [[from.x, from.y]];
    while (q.length) {
      const [x, y] = q.shift();
      if (x === goal.x && y === goal.y) break;
      for (const [dx, dy, dir] of [[0, -1, 0], [1, 0, 1], [0, 1, 2], [-1, 0, 3]]) {
        const nx = x + dx, ny = y + dy, c = grid[ny][nx];
        if (c === '#' || (c === 'L' && !hasKey)) continue;
        // 目的地以外の階段・番人は避ける
        if ((c === 'U' || c === 'S' || ((c === 'X' || c === 'B') && !doneG.has(nx + ',' + ny))) && !(nx === goal.x && ny === goal.y)) continue;
        const k = key(nx, ny); if (prev.has(k)) continue;
        prev.set(k, [x, y, dir]); q.push([nx, ny]);
      }
    }
    const path = []; let k = key(goal.x, goal.y);
    if (!prev.has(k)) return null;
    while (prev.get(k)) { const [px, py, dir] = prev.get(k); path.unshift(dir); k = key(px, py); }
    return path;
  }

  async function stepDir(dir) {
    const s = await state();
    const diff = (dir - s.dir + 4) % 4;
    if (diff === 1) await page.keyboard.press('d');
    if (diff === 3) await page.keyboard.press('a');
    if (diff === 2) { await page.keyboard.press('d'); await page.keyboard.press('d'); }
    await page.keyboard.press('w');
    await sleep(15);
  }

  async function needRest() {
    return ev(() => { const m = Core.partyMembers(); const hp = m.reduce((a, c) => a + c.hp, 0); const mx = m.reduce((a, c) => a + Core.stats(c).maxHp, 0); const mp = m.filter((c) => DATA.CLASSES[c.cls].caster).every((c) => c.mp < 6); return m.some((c) => c.status.dead) || hp / mx < 0.45 || mp; });
  }

  async function townTrip(floor) {
    townTrips++;
    if (await page.$('#view')) await ev(() => Dungeon.returnToTown('test'));
    await sleep(50);
    // 寺院
    await page.click('[data-act=temple]');
    for (let i = 0; i < 10; i++) { const b = await page.$('.modal [data-act=revive]:not([disabled])'); if (!b) break; await b.click(); await sleep(80); }
    await page.click('.modal-wrap .btn >> text=出る');
    // 宿屋
    await page.click('[data-act=inn]');
    const inn = await page.$('.modal .btn.primary:not([disabled])');
    if (inn) { await inn.click(); await page.click('.modal .btn'); } else await page.click('.modal-wrap .btn >> text=出る');
    // 装備更新（商店のロジックに沿って購入）
    await ev(() => {
      const s = Core.state(); const D = DATA; const tier = Core.shopTier();
      const buy = (id) => { const it = D.ITEMS[id]; if (s.gold - it.price < 1500) return false; s.gold -= it.price; Core.addItem(id); return true; };
      for (const c of Core.partyMembers()) for (const slot of ['weapon', 'armor']) {
        const key = slot === 'weapon' ? (c.cls === 'mage' ? 'mat' : 'atk') : 'def';
        const cur = c.equip[slot] ? (D.ITEMS[c.equip[slot]][key] || 0) : 0;
        const cands = Object.keys(D.ITEMS).filter((id) => D.ITEMS[id].slot === slot && D.ITEMS[id].tier <= tier && Core.canEquip(c, id) && (D.ITEMS[id][key] || 0) > cur)
          .sort((a, b) => (D.ITEMS[b][key] || 0) - (D.ITEMS[a][key] || 0));
        for (const id of Object.keys(s.bag)) if (D.ITEMS[id].slot === slot && Core.canEquip(c, id) && (D.ITEMS[id][key] || 0) > cur) { Core.equipItem(c, id); break; }
        if (c.equip[slot] && (D.ITEMS[c.equip[slot]][key] || 0) > cur) continue;
        for (const id of cands) if (buy(id)) { Core.equipItem(c, id); break; }
      }
      if ((s.bag.potion || 0) < 6 && s.gold > 800) { s.gold -= 300; Core.addItem('potion', 6); }
      if ((s.bag.return_scroll || 0) < 1 && s.gold > 800) { s.gold -= 300; Core.addItem('return_scroll'); }
      Core.save();
    });
    // 招来
    const gold = await ev(() => Core.state().gold);
    if (gold > 9000) {
      await page.click('[data-act=gacha]');
      await page.click('[data-act=pull][data-arg="10"]');
      await sleep(300);
      await page.click('.modal .btn.primary');
      await page.click('[data-act=back]');
      await page.click('[data-act=formation]');
      await page.click('[data-act=auto]');
      await page.click('[data-act=back]');
    }
    // 再突入
    await page.click('[data-act=dungeon]');
    const label = await ev((f) => MAPS[f].name.replace('第一奈落 ', ''), floor);
    await page.click(`.modal-wrap .btn >> text=${label}`);
    for (let i = 0; i < 3 && await page.$('.modal-wrap'); i++) await page.click('.modal-wrap .btn.primary');
    await page.waitForSelector('#view');
  }

  async function goto(floor, goal, want) {
    for (let attempt = 0; attempt < 60; attempt++) {
      const s = await state();
      if (s.floor !== floor || s.screen !== 'dungeon') return 'moved';
      if (s.x === goal.x && s.y === goal.y) { const r = await handle(want); if (want && !r) { await page.keyboard.press('Enter'); return (await handle(want)) || 'arrived'; } return r || 'arrived'; }
      const grid = await ev((f) => MAPS[f].grid, floor);
      const p = bfs(grid, s, goal, !!s.bag.abyss_key, new Set(Object.keys(s.done).filter((k) => k[0] === 'G').map((k) => k.slice(1))));
      if (!p) return 'nopath';
      for (const dir of p) {
        await stepDir(dir);
        const r = await handle(null);
        if (r === 'wipe') return 'wipe';
        const s2 = await state();
        if (s2.screen !== 'dungeon') return 'moved';
        if (battles && await needRest()) { await townTrip(floor); break; }
        if (s2.x === goal.x && s2.y === goal.y) break;
      }
    }
    return 'timeout';
  }

  async function grind(floor, lv) {
    for (let i = 0; i < 3000; i++) {
      const hlv = await ev(() => Math.min(...Core.partyMembers().map((c) => c.lv)));
      if (hlv >= lv) return;
      const s = await state();
      if (s.screen !== 'dungeon') { await townTrip(floor); continue; }
      const grid = await ev((f) => MAPS[f].grid, floor);
      const opts = [0, 1, 2, 3].filter((d) => { const dx = [0, 1, 0, -1][d], dy = [-1, 0, 1, 0][d]; const c = grid[s.y + dy][s.x + dx]; return c !== '#' && !'USXBLT'.includes(c); });
      await stepDir(opts[Math.floor(Math.random() * opts.length)]);
      const r = await handle(null);
      if (r === 'wipe') { await townTrip(floor); continue; }
      if (await needRest()) await townTrip(floor);
    }
  }

  const find = (grid, ch) => { const r = []; grid.forEach((row, y) => [...row].forEach((c, x) => { if (c === ch) r.push({ x, y }); })); return r; };

  // ---- 探索 ----
  await page.click('[data-act=dungeon]');
  await page.click('.modal .btn.primary');
  await page.waitForSelector('#view');
  let cleared = false;
  for (let floor = 1; floor <= 4 && !cleared; floor++) {
    const grid = await ev((f) => MAPS[f].grid, floor);
    log(`== B${floor}F 開始`, JSON.stringify(await ev(() => ({ gold: Core.state().gold, lv: Core.partyMembers().map((c) => c.name + c.lv) }))));
    const targets = [...find(grid, 'T'), ...find(grid, 'K'), ...'123456789'.split('').flatMap((d) => find(grid, d))];
    for (const t of targets) {
      const r = await goto(floor, t, null);
      if (r === 'wipe') { await townTrip(floor); }
      if ((await state()).floor !== floor) await townTrip(floor);
    }
    await grind(floor, TARGET_LV[floor]);
    if (await needRest()) await townTrip(floor);
    // 番人
    const gpos = [...find(grid, 'X'), ...find(grid, 'B')];
    for (const g of gpos) {
      for (let tries = 0; tries < 6; tries++) {
        const r = await goto(floor, g, null);
        const done = await ev((k) => !!Core.floorState(Core.state().dungeon.floor).done['G' + k] || Core.state().flags.cleared, g.x + ',' + g.y);
        log(`番人 ${g.x},${g.y}: ${r} done=${done}`);
        if (r === 'clear' || (await ev(() => Core.state().flags.cleared))) { cleared = true; break; }
        if (done) break;
        await townTrip(floor);
        await grind(floor, TARGET_LV[floor] + tries + 1);
      }
    }
    if (cleared) break;
    // 番人の奥にある鍵を回収
    for (const k of find(grid, 'K')) if (!(await state()).bag.abyss_key) log(`鍵: ${await goto(floor, k, null)} key=${!!(await state()).bag.abyss_key}`);
    if (await needRest()) await townTrip(floor);
    const sPos = find(grid, 'S')[0];
    const r = await goto(floor, sPos, 'down');
    log(`B${floor}F 下り階段: ${r}`);
    if ((await state()).floor !== floor + 1) { log('下りられなかった'); break; }
  }
  const final = await ev(() => { const s = Core.state(); return { cleared: s.flags.cleared, gold: s.gold, stats: s.stats, party: Core.partyMembers().map((c) => `${c.name}(${DATA.CLASSES[c.cls].name})Lv${c.lv}`), roster: Object.keys(s.chars).length, pulls: s.gacha.pulls, screen: UI.currentScreen() }; });
  log('結果', JSON.stringify(final), { wipes, battles, townTrips });
  await page.screenshot({ path: OUT + '/final.png' });
  console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'NO ERRORS');
  await browser.close();
  process.exit(final.cleared && !errors.length ? 0 : 1);
})();
