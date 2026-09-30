// 主人公キャラクタークリエイション
window.Creation = (() => {
  const D = window.DATA; const { esc } = UI;
  const CAP = 18;
  const COLORS = ['#e0c080', '#80a0e0', '#e08080', '#80d0a0', '#c0a0e0', '#e0e0e0', '#f0a060', '#60c0d0'];
  const START_EQUIP = { fighter: ['short_sword', 'leather'], thief: ['dagger', 'leather'], mage: ['oak_staff', 'robe'], priest: ['mace', 'robe'] };
  let C;

  function rollBonus() {
    const r = Math.random() * 100;
    if (r < 3) return Core.rand(25, 30);
    if (r < 12) return Core.rand(15, 20);
    return Core.rand(5, 11);
  }

  function start() {
    C = { step: 1, name: '', race: 'human', align: 'neutral', bonus: rollBonus(), alloc: {}, cls: null, color: COLORS[0], rolls: 1 };
    resetAlloc();
    render();
  }
  function resetAlloc() { C.alloc = {}; for (const k of D.STATS) C.alloc[k] = 0; }
  function baseStats() { const b = D.RACES[C.race].base; const o = {}; for (const k of D.STATS) o[k] = b[k] + C.alloc[k]; return o; }
  function spent() { return D.STATS.reduce((s, k) => s + C.alloc[k], 0); }
  function eligible(cls) {
    const cl = D.CLASSES[cls]; const st = baseStats();
    if (!cl.aligns.includes(C.align)) return false;
    for (const k in cl.req) if (st[k] < cl.req[k]) return false;
    return true;
  }

  function stepHeader() {
    const names = ['名前・種族', '性格', '能力値', '職業', '確認'];
    return `<ol class="steps">${names.map((n, i) => `<li class="${i + 1 === C.step ? 'on' : i + 1 < C.step ? 'done' : ''}">${i + 1}. ${n}</li>`).join('')}</ol>`;
  }

  function render() {
    let body = '';
    const st = baseStats();
    if (C.step === 1) {
      body = `<h2>あなたの名前と種族を決めてください</h2>
        <label class="field">名前（8文字まで）<input id="cc-name" maxlength="8" value="${esc(C.name)}" placeholder="例：アルス"></label>
        <div class="cards">${Object.entries(D.RACES).map(([id, r]) => `
          <button class="card ${C.race === id ? 'sel' : ''}" data-act="race" data-arg="${id}">
            <div class="card-title">${r.name}</div>
            <div class="mini-stats">${D.STATS.map((k) => `<span>${D.STAT_NAMES[k]} ${r.base[k]}</span>`).join('')}</div>
            <div class="card-desc">${r.desc}</div></button>`).join('')}</div>`;
    } else if (C.step === 2) {
      body = `<h2>性格を選んでください</h2><p class="hint">性格によって就ける職業が変わります。盗賊は善以外、僧侶は中立以外でのみ就けます。</p>
        <div class="cards">${Object.entries(D.ALIGNS).map(([id, a]) => `
          <button class="card ${C.align === id ? 'sel' : ''}" data-act="align" data-arg="${id}">
            <div class="card-title" style="color:${a.color}">${a.name}</div>
            <div class="card-desc">${{ good: '慈悲と正義を重んじる。', neutral: '何物にも縛られず、己の道を行く。', evil: '目的のためなら手段を選ばない。' }[id]}</div></button>`).join('')}</div>`;
    } else if (C.step === 3) {
      const left = C.bonus - spent();
      body = `<h2>ボーナスポイントを割り振ってください</h2>
        <div class="bonus-box"><div>ボーナス <b class="big">${C.bonus}</b></div><div>残り <b class="big ${left ? 'warn' : ''}">${left}</b></div>
          <button class="btn" data-act="reroll">振り直す</button><button class="btn" data-act="reset">リセット</button></div>
        <p class="hint">振り直し回数: ${C.rolls}　※各能力値は作成時 ${CAP} が上限です。</p>
        <table class="alloc">${D.STATS.map((k) => `<tr><th>${D.STAT_NAMES[k]}</th><td class="num">${st[k]}</td>
          <td><button class="btn sm" data-act="dec" data-arg="${k}" ${C.alloc[k] <= 0 ? 'disabled' : ''}>－</button>
          <button class="btn sm" data-act="inc" data-arg="${k}" ${left <= 0 || st[k] >= CAP ? 'disabled' : ''}>＋</button></td>
          <td class="hint">${{ str: '物理攻撃力', iq: '魔法攻撃力・魔術師MP', pie: '回復力・僧侶MP', vit: 'HP・防御力', agi: '行動順・命中・回避', luk: '会心率・罠回避' }[k]}</td></tr>`).join('')}</table>
        <div class="class-check">就ける職業: ${Object.keys(D.CLASSES).map((id) => `<span class="tag ${eligible(id) ? 'ok' : 'ng'}">${D.CLASSES[id].name}</span>`).join('')}</div>`;
    } else if (C.step === 4) {
      body = `<h2>職業を選んでください</h2>
        <div class="cards">${Object.entries(D.CLASSES).map(([id, cl]) => {
          const ok = eligible(id);
          const req = Object.entries(cl.req).map(([k, v]) => `${D.STAT_NAMES[k]}${v}以上`).join(' ');
          const al = cl.aligns.map((a) => D.ALIGNS[a].name).join('/');
          return `<button class="card ${C.cls === id ? 'sel' : ''}" data-act="cls" data-arg="${id}" ${ok ? '' : 'disabled'}>
            <div class="card-title">${cl.name}</div><div class="card-desc">${cl.desc}</div>
            <div class="hint">条件: ${req} / 性格: ${al}</div>
            <div class="hint">習得: ${D.CLASS_SKILLS[id].slice(0, 3).map(([, s]) => D.SKILLS[s].name).join('・')}…</div></button>`;
        }).join('')}</div>`;
    } else if (C.step === 5) {
      const fake = { uid: 'preview', race: C.race, cls: C.cls, color: C.color };
      body = `<h2>この姿で冒険を始めますか？</h2>
        <div class="confirm-box">${UI.portrait(fake, 128)}
          <div><div class="big">${esc(C.name)}</div>
          <div>${D.ALIGNS[C.align].name} / ${D.RACES[C.race].name} / ${D.CLASSES[C.cls].name}</div>
          <div class="mini-stats">${D.STATS.map((k) => `<span>${D.STAT_NAMES[k]} ${st[k]}</span>`).join('')}</div>
          <div class="hint">固有スキル: 奈落穿ち（主人公専用）</div></div></div>
        <h3>イメージカラー</h3>
        <div class="colors">${COLORS.map((c) => `<button class="swatch ${C.color === c ? 'sel' : ''}" style="background:${c}" data-act="color" data-arg="${c}" aria-label="色 ${c}"></button>`).join('')}</div>`;
    }
    const canNext = C.step === 1 ? true : C.step === 3 ? (C.bonus - spent() === 0 || D.STATS.every((k) => baseStats()[k] >= CAP)) && Object.keys(D.CLASSES).some(eligible)
      : C.step === 4 ? !!C.cls && eligible(C.cls) : true;
    UI.screen('creation', `<div class="panel creation">
      <h1>キャラクタークリエイション</h1>${stepHeader()}${body}
      <div class="nav-buttons">
        <button class="btn" data-act="back">${C.step === 1 ? 'タイトルへ' : '戻る'}</button>
        <button class="btn primary" data-act="next" ${canNext ? '' : 'disabled'}>${C.step === 5 ? '冒険を始める' : '次へ'}</button>
      </div>
      ${C.step === 3 && !Object.keys(D.CLASSES).some(eligible) ? '<p class="warn">この能力値では就ける職業がありません。割り振りを変えるか、振り直してください。</p>' : ''}
    </div>`, handlers);
    const ni = document.getElementById('cc-name');
    if (ni) ni.addEventListener('input', () => { C.name = ni.value; });
  }

  const handlers = {
    race: (id) => { C.race = id; resetAlloc(); C.cls = null; render(); },
    align: (id) => { C.align = id; C.cls = null; render(); },
    inc: (k) => { if (C.bonus - spent() > 0 && baseStats()[k] < CAP) C.alloc[k]++; render(); },
    dec: (k) => { if (C.alloc[k] > 0) C.alloc[k]--; render(); },
    reroll: () => { C.bonus = rollBonus(); C.rolls++; resetAlloc(); C.cls = null; render(); },
    reset: () => { resetAlloc(); render(); },
    cls: (id) => { C.cls = id; render(); },
    color: (c) => { C.color = c; render(); },
    back: () => { if (C.step === 1) { Main.title(); return; } C.step--; render(); },
    next: async () => {
      if (C.step === 1) {
        C.name = (C.name || '').trim();
        if (!C.name) { UI.toast('名前を入力してください'); return; }
      }
      if (C.step === 4 && (!C.cls || !eligible(C.cls))) return;
      if (C.step < 5) { C.step++; render(); return; }
      finish();
    },
  };

  async function finish() {
    Core.setState(Core.newState());
    const S = Core.state();
    const hero = Core.makeChar({ isHero: true, name: C.name, title: '奈落の探索者', race: C.race, cls: C.cls, align: C.align, color: C.color, base: baseStats() });
    const [w, a] = START_EQUIP[C.cls];
    hero.equip.weapon = w; hero.equip.armor = a;
    Core.fullHeal(hero);
    S.heroUid = hero.uid;
    S.party[0] = hero.uid;
    const slots = { fighter: 1, priest: 3, mage: 4, thief: 2 };
    for (const tid of D.STARTERS) {
      const r = Core.recruit(tid);
      const idx = S.party.indexOf(r.char.uid);
      if (idx >= 0) S.party[idx] = null;
      const want = slots[r.char.cls];
      if (S.party[want] == null) S.party[want] = r.char.uid; else S.party[S.party.indexOf(null)] = r.char.uid;
    }
    Core.save();
    await UI.modal({
      title: 'プロローグ', cls: 'story',
      html: `<p>${UI.nl2br(`大陸の果てに穿たれた巨大な裂け目――「奈落」。
底から溢れ出す瘴気は大地を蝕み、人々は怯えて暮らしていた。

奈落の縁に築かれた小さな町に、ひとりの冒険者が辿り着く。
その名は ${C.name}。

町の酒場で出会った三人の仲間と共に、
${C.name} は奈落の最初の深淵――「第一奈落」へと挑む。

目指すは地下四階。
門を守る「深淵の番人」を討ち、奈落の先へ続く道を拓くのだ。`)}</p>`,
      buttons: [{ label: '町へ', value: true, cls: 'primary' }],
    });
    await UI.alert('仲間が加わった', `傭兵ダン・修道女アンナ・見習い魔術師ピコが仲間になった！\n\n所持金 ${S.gold} G。\n町の「招来の間」では、ゴールドで新たな仲間を招くことができます。`);
    Town.show();
  }

  return { start };
})();
