// ヘッドレスブラウザでの通しテスト
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' }).catch(() => chromium.launch());
  const page = await browser.newPage({ viewport: { width: 1100, height: 900 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message + '\n' + e.stack));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  const out = process.env.OUT || '.';
  await page.goto('file://' + path.resolve(__dirname, '../index.html'));
  await page.screenshot({ path: out + '/01_title.png' });
  await page.click('[data-act=newgame]');
  await page.fill('#cc-name', 'アルス');
  await page.click('[data-act=race][data-arg=human]');
  await page.click('[data-act=next]');
  await page.click('[data-act=align][data-arg=neutral]');
  await page.click('[data-act=next]');
  // ボーナスをstrに全振り
  for (let i = 0; i < 40; i++) { const b = await page.$('[data-act=inc][data-arg=str]:not([disabled])'); if (!b) break; await b.click(); }
  for (let i = 0; i < 40; i++) { const b = await page.$('[data-act=inc][data-arg=vit]:not([disabled])'); if (!b) break; await b.click(); }
  for (let i = 0; i < 40; i++) { const b = await page.$('[data-act=inc][data-arg=agi]:not([disabled])'); if (!b) break; await b.click(); }
  for (let i = 0; i < 40; i++) { const b = await page.$('[data-act=inc][data-arg=luk]:not([disabled])'); if (!b) break; await b.click(); }
  await page.screenshot({ path: out + '/02_alloc.png' });
  await page.click('[data-act=next]');
  await page.click('[data-act=cls][data-arg=fighter]');
  await page.click('[data-act=next]');
  await page.screenshot({ path: out + '/03_confirm.png' });
  await page.click('[data-act=next]');
  await page.click('.modal .btn.primary');
  await page.click('.modal .btn');
  await page.screenshot({ path: out + '/04_town.png' });
  // ガチャ
  await page.click('[data-act=gacha]');
  await page.click('[data-act=change]');
  await page.click('.modal [data-act=sel][data-arg=valgan]');
  await page.screenshot({ path: out + '/05_gacha.png' });
  await page.click('[data-act=pull][data-arg="10"]');
  await page.waitForTimeout(2600);
  await page.screenshot({ path: out + '/06_gacha_result.png' });
  await page.click('.modal .btn.primary');
  await page.click('[data-act=back]');
  // 編成
  await page.click('[data-act=formation]');
  await page.click('[data-act=auto]');
  await page.screenshot({ path: out + '/07_formation.png', fullPage: true });
  await page.click('[data-act=back]');
  // 商店
  await page.click('[data-act=shop]');
  await page.click('[data-act=buy][data-arg=potion]');
  await page.click('[data-act=tab][data-arg=sell]');
  await page.click('[data-act=back]');
  // 奈落へ
  await page.click('[data-act=dungeon]');
  await page.click('.modal .btn.primary');
  await page.waitForSelector('#view');
  await page.screenshot({ path: out + '/08_dungeon.png' });
  // 歩き回ってバトルに遭遇するまで
  let battles = 0;
  for (let i = 0; i < 200 && battles < 3; i++) {
    if (await page.$('.modal-wrap')) {
      const btns = await page.$$('.modal-wrap .btn:not([disabled])');
      const txt = await page.$eval('.modal-wrap', (e) => e.innerText);
      if (/上り階段|下り階段/.test(txt)) { await page.click('.modal-wrap .btn >> text=いいえ'); continue; }
      await btns[btns.length - 1].click(); continue;
    }
    if (await page.$('.battle')) {
      battles++;
      await page.screenshot({ path: out + `/09_battle${battles}.png` });
      for (let t = 0; t < 40 && await page.$('.battle'); t++) {
        if (await page.$('.modal-wrap')) { await page.screenshot({ path: out + `/10_victory${battles}.png` }); await page.click('.modal-wrap .btn'); break; }
        const s = await page.$('[data-act=skills]');
        if (s && t === 0) { await s.click(); const sk = await page.$('[data-act=skill]:not([disabled])'); if (sk) { await sk.click(); const e = await page.$('.enemy.targetable'); if (e) await e.click(); } }
        const a = await page.$('[data-act=auto]');
        if (a) await a.click();
        await page.waitForTimeout(300);
      }
      continue;
    }
    const k = ['w', 'w', 'w', 'd', 'w', 'a', 's'][Math.floor(Math.random() * 7)];
    await page.keyboard.press(k);
    await page.waitForTimeout(30);
  }
  await page.screenshot({ path: out + '/11_after.png' });
  await page.click('[data-act=map]');
  await page.waitForTimeout(200);
  await page.screenshot({ path: out + '/12_map.png' });
  await page.keyboard.press('Escape');
  // モバイル表示
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: out + '/13_mobile.png', fullPage: true });
  const st = await page.evaluate(() => ({ gold: Core.state().gold, party: Core.partyMembers().map((c) => c.name + ' Lv' + c.lv), battles: Core.state().stats.battles }));
  console.log(JSON.stringify(st));
  console.log('battles seen', battles);
  console.log(errors.length ? errors.join('\n') : 'NO ERRORS');
  await browser.close();
})();
