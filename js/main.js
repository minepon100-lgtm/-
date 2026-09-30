// 起動・タイトル
window.Main = (() => {
  let keyHandler = null;
  document.addEventListener('keydown', (e) => {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
    if (keyHandler && UI.currentScreen() === 'dungeon') keyHandler(e);
  });
  function setKeys(fn) { keyHandler = fn; }

  function title() {
    setKeys(null);
    const has = Core.hasSave();
    UI.screen('title', `<div class="title-wrap">
      <div class="title-logo"><div class="t-sub">OFFLINE EDITION</div><h1>Wizardry Variants<br><span>Daphne</span> Offline</h1>
      <div class="t-sub2">〜 第一奈落 〜</div></div>
      <div class="title-menu">
        ${has ? '<button class="btn primary big-btn" data-act="continue">つづきから</button>' : ''}
        <button class="btn ${has ? '' : 'primary'} big-btn" data-act="newgame">はじめから</button>
        <button class="btn" data-act="import">セーブデータ読み込み</button>
        <button class="btn" data-act="help">遊び方</button>
      </div>
      <p class="hint credit">非公式ファンメイド作品です。キャラクター・ストーリー・グラフィックはすべてオリジナルです。<br>通信・課金要素なしで完全オフラインで動作します。</p>
    </div>`, {
      continue: () => { if (Core.load()) resume(); else UI.alert('エラー', 'セーブデータを読み込めませんでした。'); },
      newgame: async () => {
        if (has && !(await UI.confirm('確認', '現在のセーブデータは上書きされます。\n最初から始めますか？'))) return;
        Creation.start();
      },
      import: () => Town.importDialog(true),
      help,
    });
  }

  function resume() {
    const s = Core.state();
    if (s.dungeon.active) Dungeon.show(); else Town.show();
  }

  function help() {
    UI.modal({
      title: '遊び方', cls: 'wide',
      html: `<h4>目的</h4><p>主人公を作成し、仲間と共に「第一奈落」地下4階の奥にいる<b>深淵の番人</b>を倒すとクリアです。</p>
      <h4>町</h4><ul>
        <li><b>招来の間</b>：ゴールドで仲間を招きます（1回 ${DATA.GACHA.single}G / 10回 ${DATA.GACHA.ten}G）。ピックアップは全キャラクターから自由に選べます。</li>
        <li><b>宿屋</b>：HP・MPを回復。<b>寺院</b>：戦闘不能の仲間を蘇生。<b>商店</b>：装備・道具の売買。</li>
        <li><b>編成</b>：最大6人。前列3人が敵の直接攻撃を受け、後列は弓・槍以外の近接攻撃が半減します。</li></ul>
      <h4>奈落の操作</h4><ul>
        <li>W/↑：前進　S/↓：後退　A/←・D/→：向きを変える　Q/E：横移動</li>
        <li>M：地図　Space/Enter：足元を調べる（階段・宝箱など）</li>
        <li>画面のボタンでも操作できます（スマートフォン対応）。</li></ul>
      <h4>ヒント</h4><ul>
        <li>宝箱には罠があることも。盗賊がいれば罠を調べて解除できます。</li>
        <li>各階には強敵（地図の「!」）が道を塞いでいます。地下3階では鍵を探しましょう。</li>
        <li>全滅すると救助隊に町へ運ばれ、所持金の2割を失います。</li>
        <li>進行状況はブラウザに自動保存されます。「記録」から書き出し・読み込みができます。</li></ul>`,
    });
  }

  function boot() {
    title();
    if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    }
  }

  return { title, resume, setKeys, boot };
})();

window.addEventListener('DOMContentLoaded', () => Main.boot());
