// 町（拠点）と共通メニュー
window.Town = (() => {
  const D = window.DATA; const { esc } = UI;
  const S = () => Core.state();

  function header() {
    const s = S();
    return `<div class="topbar"><div class="gold">💰 ${s.gold.toLocaleString()} G</div>
      <div>到達: 地下${s.deepest}階</div>
      <div>${s.flags.cleared ? `<span class="tag ok">第一奈落 踏破${s.clearCount > 1 ? ' ×' + s.clearCount : ''}</span>` : '<span class="tag">第一奈落 探索中</span>'}</div></div>`;
  }

  function partyStrip(clickable = true) {
    return `<div class="party-strip">${Core.partyChars().map((c, i) => c ? `
      <div class="pmember ${c.status.dead ? 'dead' : ''} ${UI.rarityClass(c.rarity)}" ${clickable ? `data-act="char" data-arg="${c.uid}"` : ''}>
        <div class="row-label">${i < 3 ? '前' : '後'}</div>${UI.portrait(c, 44)}
        <div class="pm-info"><div class="pm-name">${esc(c.name)}</div><div class="pm-sub">Lv${c.lv} ${D.CLASSES[c.cls].name}</div>
        ${UI.hpBar(c.hp, Core.stats(c).maxHp)}${UI.hpBar(c.mp, Core.stats(c).maxMp, 'mp')}
        <div class="pm-num">${c.hp}/${Core.stats(c).maxHp}</div>${UI.statusText(c)}</div></div>` : `<div class="pmember empty"><div class="row-label">${i < 3 ? '前' : '後'}</div><span>空き</span></div>`).join('')}</div>`;
  }

  function show() {
    const s = S();
    s.dungeon.active = false;
    Core.save();
    UI.screen('town', `${header()}
      <div class="town-banner"><h1>奈落の縁の町</h1><p>瘴気の霧の向こうに、第一奈落の入口が口を開けている。</p></div>
      <div class="town-grid">
        <button class="facility main" data-act="dungeon"><span class="ico">⛰</span>奈落へ<small>第一奈落を探索する</small></button>
        <button class="facility" data-act="gacha"><span class="ico">✦</span>招来の間<small>ゴールドで仲間を招く</small></button>
        <button class="facility" data-act="inn"><span class="ico">🛏</span>宿屋<small>HP・MPを回復</small></button>
        <button class="facility" data-act="shop"><span class="ico">⚖</span>商店<small>装備と道具の売買</small></button>
        <button class="facility" data-act="temple"><span class="ico">✝</span>寺院<small>蘇生・治療</small></button>
        <button class="facility" data-act="formation"><span class="ico">⚔</span>編成<small>パーティを組む</small></button>
        <button class="facility" data-act="roster"><span class="ico">☷</span>仲間一覧<small>ステータス・装備</small></button>
        <button class="facility" data-act="system"><span class="ico">⚙</span>記録<small>セーブ・設定</small></button>
      </div>
      <h3>パーティ</h3>${partyStrip()}`, {
      dungeon: enterDungeon, gacha: () => Gacha.show(), inn, shop: () => shop('buy'), temple, formation, roster, system,
      char: (uid) => charDetail(s.chars[uid]).then(show),
    });
  }

  async function enterDungeon() {
    const s = S();
    const members = Core.partyMembers();
    if (!members.some(Core.alive)) { UI.alert('奈落へ', '戦える仲間がいません。\n編成を見直すか、寺院で蘇生してください。'); return; }
    const floors = [];
    for (let f = 1; f <= s.deepest; f++) floors.push(f);
    const f = await UI.modal({
      title: 'どの階層から探索しますか？',
      html: `<p class="hint">到達済みの階層へは、階段の前から探索を始められます。</p>`,
      buttons: [...floors.map((f) => ({ label: MAPS[f].name.replace('第一奈落 ', ''), value: f, cls: f === s.deepest ? 'primary' : '' })), { label: 'やめる', value: null }],
    });
    if (!f) return;
    if (members.some((c) => c.status.dead)) {
      if (!(await UI.confirm('確認', '戦闘不能の仲間がいます。このまま出発しますか？'))) return;
    }
    Dungeon.enter(f);
  }

  async function inn() {
    const s = S();
    const party = Core.partyMembers().filter(Core.alive);
    const all = Object.values(s.chars).filter(Core.alive);
    const cost1 = party.reduce((a, c) => a + c.lv * 10, 0);
    const cost2 = all.reduce((a, c) => a + c.lv * 10, 0);
    const v = await UI.modal({
      title: '宿屋「奈落の灯」',
      html: `<p>「いらっしゃい。ゆっくり休んでいきな」</p><p class="hint">休むとHP・MPが全快し、毒と眠りが治ります（戦闘不能は治りません）。</p>`,
      buttons: [{ label: `パーティで泊まる (${cost1} G)`, value: 'party', disabled: s.gold < cost1, cls: 'primary' }, { label: `仲間全員で泊まる (${cost2} G)`, value: 'all', disabled: s.gold < cost2 }, { label: '出る', value: null }],
    });
    if (!v) return;
    const list = v === 'party' ? party : all;
    s.gold -= v === 'party' ? cost1 : cost2;
    list.forEach(Core.fullHeal);
    Core.save();
    await UI.alert('宿屋', '一晩ぐっすり眠った。\n全員のHPとMPが回復した！');
    show();
  }

  async function temple() {
    const s = S();
    const dead = Object.values(s.chars).filter((c) => c.status.dead);
    const poisoned = Object.values(s.chars).filter((c) => !c.status.dead && c.status.poison);
    const html = `<p>「迷える者よ、神の御前へ」</p>
      ${dead.length ? `<table class="list">${dead.map((c) => `<tr><td>${esc(c.name)} Lv${c.lv}</td><td>${c.lv * 100} G</td>
        <td><button class="btn sm primary" data-act="revive" data-arg="${c.uid}" ${s.gold < c.lv * 100 ? 'disabled' : ''}>蘇生</button></td></tr>`).join('')}</table>` : '<p class="hint">戦闘不能の仲間はいません。</p>'}
      ${poisoned.length ? `<p><button class="btn" data-act="cure">毒の治療 (${poisoned.length * 20} G)</button></p>` : ''}`;
    await UI.modal({
      title: '寺院', html, buttons: [{ label: '出る', value: null }],
      handlers: {
        revive: (uid, el, api) => {
          const c = s.chars[uid]; const cost = c.lv * 100;
          if (s.gold < cost) return;
          s.gold -= cost; c.status.dead = false; Core.fullHeal(c); Core.save();
          api.close(); UI.toast(`${c.name} は息を吹き返した！`); setTimeout(temple, 50);
        },
        cure: (a, el, api) => {
          const cost = poisoned.length * 20; if (s.gold < cost) return;
          s.gold -= cost; poisoned.forEach((c) => { c.status.poison = false; }); Core.save();
          api.close(); UI.toast('毒が浄化された'); setTimeout(temple, 50);
        },
      },
    });
    show();
  }

  // ---------- 商店 ----------
  function whoCanEquip(id) {
    return Core.partyMembers().map((c) => `<span class="who ${Core.canEquip(c, id) ? 'ok' : 'ng'}" title="${esc(c.name)}">${esc(c.name.slice(0, 2))}</span>`).join('');
  }
  function itemStatText(it) {
    const a = [];
    if (it.atk) a.push(`攻+${it.atk}`); if (it.def) a.push(`防+${it.def}`); if (it.mat) a.push(`魔+${it.mat}`);
    if (it.agi) a.push(`速+${it.agi}`); if (it.luk) a.push(`運+${it.luk}`); if (it.crit) a.push(`会心+${it.crit}`);
    if (it.ranged) a.push('後列可');
    if (it.desc) a.push(it.desc);
    return a.join(' ');
  }
  const KIND_NAMES = { consumable: '道具', sword: '剣', dagger: '短剣', mace: '鎚', staff: '杖', bow: '弓', axe: '斧', spear: '槍', robe: '衣', light: '軽鎧', heavy: '重鎧', acc: '装飾', key: '鍵' };

  function shop(tab) {
    const s = S();
    const tier = Core.shopTier();
    let rows;
    if (tab === 'buy') {
      rows = Object.entries(D.ITEMS).filter(([, it]) => it.tier <= tier && it.price > 0).map(([id, it]) => `
        <tr><td><span class="kind">${KIND_NAMES[it.kind]}</span> ${esc(it.name)}<div class="hint">${esc(itemStatText(it))}</div></td>
        <td class="num">${it.price} G</td><td class="num">所持${s.bag[id] || 0}</td><td>${it.slot ? whoCanEquip(id) : ''}</td>
        <td><button class="btn sm primary" data-act="buy" data-arg="${id}" ${s.gold < it.price ? 'disabled' : ''}>買う</button></td></tr>`).join('');
    } else {
      const ids = Object.keys(s.bag).filter((id) => D.ITEMS[id].kind !== 'key');
      rows = ids.length ? ids.map((id) => { const it = D.ITEMS[id]; return `
        <tr><td><span class="kind">${KIND_NAMES[it.kind]}</span> ${esc(it.name)}<div class="hint">${esc(itemStatText(it))}</div></td>
        <td class="num">${Math.floor(it.price / 2)} G</td><td class="num">×${s.bag[id]}</td><td></td>
        <td><button class="btn sm" data-act="sell" data-arg="${id}">売る</button></td></tr>`; }).join('') : '<tr><td>売れる物がありません（装備中の品は外してから売れます）</td></tr>';
    }
    UI.screen('shop', `${header()}<div class="panel"><h2>商店「奈落交易所」</h2>
      <p class="hint">品揃えは奈落の探索が進むと増えます（現在ランク${tier}）。</p>
      <div class="tabs"><button class="tab ${tab === 'buy' ? 'on' : ''}" data-act="tab" data-arg="buy">購入</button><button class="tab ${tab === 'sell' ? 'on' : ''}" data-act="tab" data-arg="sell">売却</button></div>
      <table class="list shop">${rows}</table>
      <div class="nav-buttons"><button class="btn" data-act="back">町へ戻る</button></div></div>`, {
      tab: (t) => shop(t),
      back: show,
      buy: (id) => { const it = D.ITEMS[id]; if (s.gold < it.price) return; s.gold -= it.price; Core.addItem(id); Core.save(); UI.toast(`${it.name} を購入した`); shop('buy'); },
      sell: (id) => { const it = D.ITEMS[id]; if (!s.bag[id]) return; Core.removeItem(id); s.gold += Math.floor(it.price / 2); Core.save(); UI.toast(`${it.name} を売却した`); shop('sell'); },
    });
  }

  // ---------- 編成 ----------
  let selSlot = null;
  function formation() {
    const s = S();
    const inParty = new Set(s.party.filter(Boolean));
    const roster = Object.values(s.chars).sort((a, b) => (b.isHero - a.isHero) || (b.rarity - a.rarity) || (b.lv - a.lv));
    UI.screen('formation', `${header()}<div class="panel"><h2>編成</h2>
      <p class="hint">枠を選んでから、下の一覧から仲間を選んでください。前列(1〜3)は近接攻撃が可能で、敵の直接攻撃を受けます。後列(4〜6)は弓・槍以外の近接攻撃が半減します。</p>
      <div class="formation">${s.party.map((uid, i) => { const c = uid && s.chars[uid]; return `
        <button class="fslot ${selSlot === i ? 'sel' : ''} ${c ? UI.rarityClass(c.rarity) : ''}" data-act="slot" data-arg="${i}">
          <div class="row-label">${i < 3 ? '前列' : '後列'}${(i % 3) + 1}</div>
          ${c ? `${UI.portrait(c, 56)}<div>${esc(c.name)}</div><div class="hint">Lv${c.lv} ${D.CLASSES[c.cls].name}</div>` : '<div class="hint">空き</div>'}
        </button>`; }).join('')}</div>
      <div class="nav-buttons"><button class="btn" data-act="remove" ${selSlot == null || !s.party[selSlot] || s.party[selSlot] === s.heroUid ? 'disabled' : ''}>選択枠を外す</button>
        <button class="btn" data-act="auto">おまかせ編成</button><button class="btn primary" data-act="back">町へ戻る</button></div>
      <h3>仲間一覧（${roster.length}人）</h3>
      <div class="roster">${roster.map((c) => `
        <button class="rcard ${UI.rarityClass(c.rarity)} ${inParty.has(c.uid) ? 'inparty' : ''} ${c.status.dead ? 'dead' : ''}" data-act="pick" data-arg="${c.uid}">
          ${UI.portrait(c, 48)}<div><div>${c.rarity ? `<span class="stars">${UI.stars(c.rarity)}</span>` : '<span class="tag hero">主人公</span>'} ${esc(c.name)}</div>
          <div class="hint">Lv${c.lv} ${UI.charLine(c)}${c.dupes ? ` 凸${c.dupes}` : ''}</div>${inParty.has(c.uid) ? '<div class="tag ok">編成中</div>' : ''}</div></button>`).join('')}</div></div>`, {
      back: () => { selSlot = null; show(); },
      slot: (i) => { i = +i; selSlot = selSlot === i ? null : i; formation(); },
      remove: () => { if (selSlot == null) return; if (s.party[selSlot] === s.heroUid) { UI.toast('主人公は外せません'); return; } s.party[selSlot] = null; Core.save(); formation(); },
      pick: (uid) => {
        let target = selSlot;
        const cur = s.party.indexOf(uid);
        if (target == null) {
          if (cur >= 0) { charDetail(s.chars[uid]).then(formation); return; }
          target = s.party.indexOf(null);
          if (target < 0) { UI.toast('枠を選んでください'); return; }
        }
        if (s.party[target] === s.heroUid && cur < 0) { UI.toast('主人公は外せません'); return; }
        if (cur >= 0) { s.party[cur] = s.party[target]; }
        s.party[target] = uid;
        selSlot = null; Core.save(); formation();
      },
      auto: () => {
        const cand = Object.values(s.chars).filter((c) => !c.status.dead && c.uid !== s.heroUid).sort((a, b) => (b.lv * 10 + b.rarity * 5) - (a.lv * 10 + a.rarity * 5));
        const hero = s.chars[s.heroUid];
        const chosen = [hero, ...cand].slice(0, 6);
        const front = chosen.filter((c) => c.cls === 'fighter' || c.cls === 'thief' || c.isHero && (c.cls === 'fighter' || c.cls === 'thief'));
        const back = chosen.filter((c) => !front.includes(c));
        while (front.length < 3 && back.length) front.push(back.shift());
        while (front.length > 3) back.unshift(front.pop());
        s.party = [...front, ...back, null, null, null, null, null, null].slice(0, 6).map((c) => (c ? c.uid : null));
        if (!s.party.includes(s.heroUid)) s.party[0] = s.heroUid;
        Core.save(); formation();
      },
    });
  }

  function roster() {
    const s = S();
    const list = Object.values(s.chars).sort((a, b) => (b.isHero - a.isHero) || (b.rarity - a.rarity) || (b.lv - a.lv));
    UI.screen('roster', `${header()}<div class="panel"><h2>仲間一覧</h2>
      <div class="roster">${list.map((c) => `<button class="rcard ${UI.rarityClass(c.rarity)} ${c.status.dead ? 'dead' : ''}" data-act="char" data-arg="${c.uid}">
        ${UI.portrait(c, 48)}<div><div>${c.rarity ? `<span class="stars">${UI.stars(c.rarity)}</span>` : '<span class="tag hero">主人公</span>'} ${esc(c.name)}</div>
        <div class="hint">${esc(c.title)} / Lv${c.lv} ${UI.charLine(c)}${c.dupes ? ` 凸${c.dupes}` : ''}</div>
        <div class="pm-num">HP ${c.hp}/${Core.stats(c).maxHp} MP ${c.mp}/${Core.stats(c).maxMp}</div>${UI.statusText(c)}</div></button>`).join('')}</div>
      <div class="nav-buttons"><button class="btn primary" data-act="back">町へ戻る</button></div></div>`, {
      back: show, char: (uid) => charDetail(s.chars[uid]).then(roster),
    });
  }

  // ---------- キャラクター詳細（町・奈落共通） ----------
  function charDetailHtml(c) {
    const st = Core.stats(c); const s = S();
    const next = D.expToNext(c.lv);
    const t = c.tid ? D.CHARACTERS[c.tid] : null;
    const eq = (slot, label) => { const id = c.equip[slot]; const it = id && D.ITEMS[id];
      return `<tr><th>${label}</th><td>${it ? esc(it.name) + `<div class="hint">${esc(itemStatText(it))}</div>` : '<span class="hint">なし</span>'}</td>
        <td><button class="btn sm" data-act="eq" data-arg="${slot}">変更</button>${it ? ` <button class="btn sm" data-act="uneq" data-arg="${slot}">外す</button>` : ''}</td></tr>`; };
    return `<div class="detail"><div class="detail-head">${UI.portrait(c, 96)}<div>
        <div>${c.rarity ? `<span class="stars">${UI.stars(c.rarity)}</span>` : '<span class="tag hero">主人公</span>'} <span class="hint">${esc(c.title)}</span></div>
        <div class="big">${esc(c.name)} ${c.dupes ? `<span class="tag">凸${c.dupes}</span>` : ''}</div>
        <div>Lv ${c.lv} ${UI.charLine(c)}</div><div class="hint">EXP ${c.exp} / ${next}</div>
        <div>HP ${c.hp}/${st.maxHp}　MP ${c.mp}/${st.maxMp} ${UI.statusText(c)}</div></div></div>
      ${t ? `<p class="hint bio">${esc(t.bio)}</p>` : ''}
      <div class="two-col"><table class="stats">${D.STATS.map((k) => `<tr><th>${D.STAT_NAMES[k]}</th><td>${c.base[k]}</td></tr>`).join('')}</table>
      <table class="stats"><tr><th>攻撃力</th><td>${st.atk}</td></tr><tr><th>防御力</th><td>${st.def}</td></tr><tr><th>魔力</th><td>${st.mat}</td></tr>
        <tr><th>回復力</th><td>${st.heal}</td></tr><tr><th>速さ</th><td>${st.spd}</td></tr><tr><th>会心</th><td>${st.crit}%</td></tr></table></div>
      <h4>装備</h4><table class="list">${eq('weapon', '武器')}${eq('armor', '防具')}${eq('acc', '装飾')}</table>
      <h4>スキル</h4><ul class="skills">${Core.skills(c).map((id) => { const sk = D.SKILLS[id]; return `<li><b>${sk.name}</b> <span class="hint">MP${sk.mp}</span> ${esc(sk.desc)}</li>`; }).join('')}
        ${D.CLASS_SKILLS[c.cls].filter(([lv]) => lv > c.lv).map(([lv, id]) => `<li class="locked">Lv${lv}: ${D.SKILLS[id].name}</li>`).join('')}</ul>
      ${s ? '' : ''}</div>`;
  }

  function charDetail(c) {
    const s = S();
    return UI.modal({
      title: 'ステータス', cls: 'wide', html: charDetailHtml(c),
      buttons: [{ label: '閉じる', value: null }],
      handlers: {
        eq: async (slot, el, api) => {
          const opts = Object.keys(s.bag).filter((id) => D.ITEMS[id].slot === slot && Core.canEquip(c, id));
          if (!opts.length) { UI.toast('装備できる品を持っていません'); return; }
          const cur = Core.stats(c);
          const id = await UI.modal({
            title: '装備を選択', html: '<p class="hint">括弧内は現在との差分</p>',
            buttons: [...opts.map((id) => {
              const it = D.ITEMS[id]; const old = c.equip[slot] ? D.ITEMS[c.equip[slot]] : {};
              const dif = ['atk', 'def', 'mat'].map((k) => { const d = (it[k] || 0) - (old[k] || 0); return d ? `${{ atk: '攻', def: '防', mat: '魔' }[k]}${d > 0 ? '+' : ''}${d}` : ''; }).filter(Boolean).join(' ');
              return { label: `${it.name} ×${s.bag[id]} (${dif || '±0'})`, value: id };
            }), { label: 'やめる', value: null }],
          });
          if (id) { Core.equipItem(c, id); Core.save(); }
          void cur;
          api.root.querySelector('.modal-body').innerHTML = charDetailHtml(c);
        },
        uneq: (slot, el, api) => { Core.unequip(c, slot); Core.save(); api.root.querySelector('.modal-body').innerHTML = charDetailHtml(c); },
      },
    });
  }

  // ---------- 道具・スキル（フィールド） ----------
  async function chooseMember(title, filter) {
    const list = Core.partyMembers();
    return UI.modal({
      title, html: '',
      buttons: [...list.map((c) => ({ label: `${c.name}  HP${c.hp}/${Core.stats(c).maxHp} MP${c.mp}/${Core.stats(c).maxMp}${c.status.dead ? ' [戦闘不能]' : c.status.poison ? ' [毒]' : ''}`, value: c.uid, disabled: filter && !filter(c) })), { label: 'やめる', value: null }],
    });
  }

  // 道具を使う。戻り値: 'escape' など特殊効果
  async function useItemField() {
    const s = S();
    const ids = Object.keys(s.bag).filter((id) => D.ITEMS[id].kind === 'consumable');
    if (!ids.length) { UI.toast('使える道具がありません'); return null; }
    const id = await UI.modal({ title: '道具', html: '', buttons: [...ids.map((id) => ({ label: `${D.ITEMS[id].name} ×${s.bag[id]}  - ${D.ITEMS[id].desc}`, value: id })), { label: 'やめる', value: null }] });
    if (!id) return null;
    const it = D.ITEMS[id];
    if (it.escape) {
      if (!s.dungeon.active) { UI.toast('町では使えません'); return null; }
      if (!(await UI.confirm('帰還の巻物', '町へ帰還しますか？'))) return null;
      Core.removeItem(id); Core.save(); return 'escape';
    }
    const uid = await chooseMember(`${it.name} を誰に使う？`, (c) => (it.revive ? c.status.dead : !c.status.dead));
    if (!uid) return null;
    applyItem(id, s.chars[uid]);
    Core.save();
    return 'used';
  }

  function applyItem(id, c) {
    const it = D.ITEMS[id]; const st = Core.stats(c);
    Core.removeItem(id);
    if (it.revive) { c.status.dead = false; c.hp = Math.max(1, Math.floor(st.maxHp * 0.3)); UI.toast(`${c.name} は生き返った！`); return `${c.name} は生き返った！`; }
    let m = [];
    if (it.heal) { const b = c.hp; c.hp = Math.min(st.maxHp, c.hp + it.heal); m.push(`HPが${c.hp - b}回復`); }
    if (it.mp) { const b = c.mp; c.mp = Math.min(st.maxMp, c.mp + it.mp); m.push(`MPが${c.mp - b}回復`); }
    if (it.cure) { c.status.poison = false; c.status.sleep = false; m.push('状態異常が治った'); }
    const msg = `${c.name}の${m.join('、')}`;
    UI.toast(msg);
    return msg;
  }

  async function fieldSkill() {
    const s = S();
    const casters = Core.partyMembers().filter((c) => Core.alive(c) && Core.skills(c).some((id) => D.SKILLS[id].field));
    if (!casters.length) { UI.toast('フィールドで使えるスキルがありません'); return; }
    const uid = await UI.modal({ title: '誰のスキルを使う？', html: '', buttons: [...casters.map((c) => ({ label: `${c.name} MP${c.mp}`, value: c.uid })), { label: 'やめる', value: null }] });
    if (!uid) return;
    const c = s.chars[uid];
    const sks = Core.skills(c).filter((id) => D.SKILLS[id].field);
    const sid = await UI.modal({ title: 'スキル', html: '', buttons: [...sks.map((id) => ({ label: `${D.SKILLS[id].name} (MP${D.SKILLS[id].mp}) ${D.SKILLS[id].desc}`, value: id, disabled: c.mp < D.SKILLS[id].mp })), { label: 'やめる', value: null }] });
    if (!sid) return;
    const sk = D.SKILLS[sid];
    let targets;
    if (sk.target === 'allies') targets = Core.partyMembers().filter(Core.alive);
    else {
      const tu = await chooseMember(`${sk.name} の対象`, (t) => (sk.type === 'revive' ? t.status.dead : !t.status.dead));
      if (!tu) return;
      targets = [s.chars[tu]];
    }
    c.mp -= sk.mp;
    const st = Core.stats(c);
    for (const t of targets) {
      const ts = Core.stats(t);
      if (sk.type === 'heal') { const amt = Math.floor(st.heal * sk.power * Core.randf(0.9, 1.1)); t.hp = Math.min(ts.maxHp, t.hp + amt); if (sk.cureAll) { t.status.poison = false; } }
      if (sk.type === 'cure') { t.status.poison = false; t.status.sleep = false; }
      if (sk.type === 'revive') { t.status.dead = false; t.hp = Math.max(1, Math.floor(ts.maxHp * 0.3)); }
    }
    UI.toast(`${c.name} は ${sk.name} を唱えた！`);
    Core.save();
  }

  // ---------- 記録 ----------
  async function system() {
    const s = S();
    const v = await UI.modal({
      title: '記録・設定',
      html: `<p class="hint">進行状況はこの端末のブラウザに自動保存されます。別の端末へ移す場合は「書き出し」を使ってください。</p>
        <p>戦闘速度: <b>${['ふつう', 'はやい', 'さいそく'][s.settings.speed - 1] || 'ふつう'}</b>　エンカウント率: <b>${['少なめ', 'ふつう', '多め'][s.settings.encounter] || 'ふつう'}</b></p>
        <p class="hint">戦闘 ${s.stats.battles} 回 / 撃破 ${s.stats.kills} 体 / 招来 ${s.gacha.pulls} 回</p>`,
      buttons: [{ label: 'セーブ', value: 'save', cls: 'primary' }, { label: '戦闘速度', value: 'speed' }, { label: 'エンカウント率', value: 'enc' }, { label: '書き出し', value: 'export' }, { label: '読み込み', value: 'import' }, { label: 'タイトルへ', value: 'title' }, { label: '閉じる', value: null }],
    });
    if (v === 'save') { Core.save(); UI.toast('セーブしました'); }
    if (v === 'speed') { s.settings.speed = (s.settings.speed % 3) + 1; Core.save(); return system(); }
    if (v === 'enc') { s.settings.encounter = (s.settings.encounter + 1) % 3; Core.save(); return system(); }
    if (v === 'export') await exportDialog();
    if (v === 'import') { await importDialog(); return; }
    if (v === 'title') { Core.save(); Main.title(); return; }
    show();
  }

  async function exportDialog() {
    const data = Core.exportSave();
    await UI.modal({
      title: 'セーブデータの書き出し',
      html: `<p class="hint">以下の文字列をコピーして保管してください。ファイルとしても保存できます。</p><textarea class="savebox" readonly>${esc(data)}</textarea>
        <p><button class="btn" data-act="copy">コピー</button> <button class="btn" data-act="dl">ファイルに保存</button></p>`,
      handlers: {
        copy: (a, el, api) => { const t = api.root.querySelector('textarea'); t.select(); try { navigator.clipboard.writeText(data).then(() => UI.toast('コピーしました'), () => { document.execCommand('copy'); UI.toast('コピーしました'); }); } catch (e) { document.execCommand('copy'); UI.toast('コピーしました'); } },
        dl: () => { const b = new Blob([data], { type: 'text/plain' }); const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = 'wvd_offline_save.txt'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000); },
      },
    });
  }

  async function importDialog(fromTitle) {
    let text = '';
    const v = await UI.modal({
      title: 'セーブデータの読み込み',
      html: `<p class="hint">書き出した文字列を貼り付けるか、ファイルを選択してください。現在のデータは上書きされます。</p><textarea class="savebox" id="imp-text"></textarea><p><input type="file" id="imp-file" accept=".txt,.json"></p>`,
      buttons: [{ label: 'キャンセル', value: null }, { label: '読み込む', value: 'ok', cls: 'primary' }],
      handlers: { __init: (api) => {
        const ta = api.root.querySelector('#imp-text'); ta.addEventListener('input', () => { text = ta.value; });
        api.root.querySelector('#imp-file').addEventListener('change', (e) => { const f = e.target.files[0]; if (!f) return; f.text().then((t) => { ta.value = t; text = t; }); });
      } },
    });
    if (v !== 'ok' || !text.trim()) { if (fromTitle) Main.title(); else show(); return; }
    try { Core.importSave(text); await UI.alert('読み込み', '読み込みに成功しました。'); Main.resume(); } catch (e) { await UI.alert('エラー', 'セーブデータを読み込めませんでした。'); if (fromTitle) Main.title(); else show(); }
  }

  return { show, charDetail, useItemField, applyItem, fieldSkill, partyStrip, header, importDialog, chooseMember, itemStatText };
})();
