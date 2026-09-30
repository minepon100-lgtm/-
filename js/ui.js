// UIヘルパー
window.UI = (() => {
  const D = window.DATA;
  const $ = (sel, root = document) => root.querySelector(sel);
  const esc = (s) => String(s).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  const nl2br = (s) => esc(s).replace(/\n/g, '<br>');
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  let current = null;
  const app = () => $('#app');

  // 画面を切り替える。handlers は data-act に対応する関数群
  function screen(name, html, handlers = {}) {
    const root = app();
    root.className = 'screen-' + name;
    root.innerHTML = html;
    root.onclick = (e) => {
      const el = e.target.closest('[data-act]');
      if (!el || el.disabled || !root.contains(el)) return;
      const fn = handlers[el.dataset.act];
      if (fn) fn(el.dataset.arg, el, e);
    };
    current = name;
    window.scrollTo(0, 0);
  }
  function currentScreen() { return current; }

  let modalDepth = 0;
  function modal({ title = '', html = '', buttons = [{ label: 'OK', value: true }], handlers = {}, cls = '', dismiss = true }) {
    return new Promise((resolve) => {
      const wrap = document.createElement('div');
      wrap.className = 'modal-wrap';
      wrap.style.zIndex = 100 + (++modalDepth);
      wrap.innerHTML = `<div class="modal ${cls}" role="dialog">
        ${title ? `<div class="modal-title">${esc(title)}</div>` : ''}
        <div class="modal-body">${html}</div>
        <div class="modal-buttons">${buttons.map((b, i) => `<button class="btn ${b.cls || ''}" data-mbtn="${i}" ${b.disabled ? 'disabled' : ''}>${esc(b.label)}</button>`).join('')}</div>
      </div>`;
      document.body.appendChild(wrap);
      const close = (v) => { wrap.remove(); modalDepth--; document.removeEventListener('keydown', onKey, true); resolve(v); };
      const api = { close, root: wrap };
      wrap.addEventListener('click', (e) => {
        const b = e.target.closest('[data-mbtn]');
        if (b && !b.disabled) { close(buttons[+b.dataset.mbtn].value); return; }
        const a = e.target.closest('[data-act]');
        if (a && !a.disabled && handlers[a.dataset.act]) { handlers[a.dataset.act](a.dataset.arg, a, api); return; }
        if (e.target === wrap && dismiss) close(null);
      });
      const onKey = (e) => {
        if (wrap.style.zIndex != 100 + modalDepth) return;
        if (e.key === 'Escape' && dismiss) { e.stopPropagation(); close(null); }
        if (e.key === 'Enter' && buttons.length === 1) { e.stopPropagation(); e.preventDefault(); close(buttons[0].value); }
      };
      document.addEventListener('keydown', onKey, true);
      if (handlers.__init) handlers.__init(api);
    });
  }
  const alert = (title, text) => modal({ title, html: `<p>${nl2br(text)}</p>` });
  const confirm = (title, text, yes = 'はい', no = 'いいえ') => modal({ title, html: `<p>${nl2br(text)}</p>`, buttons: [{ label: no, value: false }, { label: yes, value: true, cls: 'primary' }] });
  function prompt(title, label, def = '', maxlen = 12) {
    return modal({
      title,
      html: `<label class="field">${esc(label)}<input id="prompt-input" maxlength="${maxlen}" value="${esc(def)}"></label>
        <div class="modal-buttons"><button class="btn" data-act="pcancel">キャンセル</button><button class="btn primary" data-act="pok">決定</button></div>`,
      buttons: [],
      handlers: {
        pcancel: (a, el, api) => api.close(null),
        pok: (a, el, api) => api.close($('#prompt-input', api.root).value),
        __init: (api) => {
          const i = $('#prompt-input', api.root); i.focus(); i.select();
          i.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); api.close(i.value); } });
        },
      },
    });
  }

  function toast(text, ms = 1800) {
    const t = document.createElement('div');
    t.className = 'toast';
    t.innerHTML = nl2br(text);
    document.body.appendChild(t);
    requestAnimationFrame(() => t.classList.add('show'));
    setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 400); }, ms);
  }

  const stars = (r) => (r ? '★'.repeat(r) : '');
  const rarityClass = (r) => (r ? 'r' + r : 'hero');

  // キャラクターの肖像（SVG生成）
  function portrait(c, size = 64) {
    const race = c.race; const color = c.color || '#ccc';
    const clsIcon = { fighter: 'M32 14 L35 40 L32 44 L29 40 Z M24 38 H40 V41 H24 Z', thief: 'M26 20 L38 42 L36 44 L24 22 Z', mage: 'M32 12 L38 26 H26 Z M31 26 H33 V46 H31 Z', priest: 'M30 14 H34 V24 H42 V28 H34 V46 H30 V28 H22 V24 H30 Z' }[c.cls];
    const headR = race === 'dwarf' ? 10 : race === 'hobbit' || race === 'gnome' ? 9 : 10;
    const headY = race === 'hobbit' || race === 'gnome' ? 30 : 26;
    const ears = race === 'elf' ? `<path d="M22 ${headY} L15 ${headY - 8} L23 ${headY - 3}Z M42 ${headY} L49 ${headY - 8} L41 ${headY - 3}Z" fill="${color}" opacity=".9"/>` : '';
    const beard = race === 'dwarf' ? `<path d="M24 ${headY + 4} Q32 ${headY + 20} 40 ${headY + 4} Z" fill="#8a6a4a"/>` : '';
    const hat = c.cls === 'mage' ? `<path d="M20 ${headY - 6} L32 ${headY - 26} L44 ${headY - 6} Z" fill="#3a3070" stroke="#a090ff" stroke-width="1"/>` : c.cls === 'priest' ? `<path d="M22 ${headY - 6} Q32 ${headY - 20} 42 ${headY - 6} Z" fill="#e8e0c8"/>` : c.cls === 'fighter' ? `<path d="M21 ${headY - 2} Q32 ${headY - 18} 43 ${headY - 2} L43 ${headY - 5} L21 ${headY - 5} Z" fill="#9aa0a8"/>` : `<path d="M21 ${headY - 3} Q32 ${headY - 16} 43 ${headY - 3} L40 ${headY + 2} L24 ${headY + 2} Z" fill="#2a3a2a" opacity=".85"/>`;
    return `<svg class="portrait" viewBox="0 0 64 64" width="${size}" height="${size}" aria-hidden="true">
      <defs><radialGradient id="pg${c.uid || c.tid || 'x'}" cx="50%" cy="35%" r="70%"><stop offset="0" stop-color="${color}" stop-opacity=".55"/><stop offset="1" stop-color="#0b0b12"/></radialGradient></defs>
      <rect width="64" height="64" fill="url(#pg${c.uid || c.tid || 'x'})"/>
      <path d="M12 64 Q14 ${headY + 14} 32 ${headY + 12} Q50 ${headY + 14} 52 64 Z" fill="${color}" opacity=".75"/>
      ${ears}<circle cx="32" cy="${headY}" r="${headR}" fill="#e8d0b8"/>${beard}${hat}
      <circle cx="28" cy="${headY + 1}" r="1.3" fill="#222"/><circle cx="36" cy="${headY + 1}" r="1.3" fill="#222"/>
      <g transform="translate(40 36) scale(.4)" fill="#fff" opacity=".85"><path d="${clsIcon}"/></g>
    </svg>`;
  }

  // 敵のスプライト（SVG生成）
  function enemySprite(e, size = 96) {
    const c = e.color || '#aaa';
    const shapes = {
      blob: `<ellipse cx="50" cy="68" rx="34" ry="24" fill="${c}"/><ellipse cx="42" cy="58" rx="6" ry="8" fill="#fff"/><ellipse cx="58" cy="58" rx="6" ry="8" fill="#fff"/><circle cx="42" cy="60" r="3" fill="#111"/><circle cx="58" cy="60" r="3" fill="#111"/>`,
      beast: `<ellipse cx="50" cy="62" rx="32" ry="18" fill="${c}"/><circle cx="24" cy="50" r="14" fill="${c}"/><path d="M14 40 L18 28 L24 38Z M28 38 L32 26 L34 40Z" fill="${c}"/><circle cx="20" cy="48" r="3" fill="#f33"/><path d="M26 80 v12 M40 80 v12 M60 80 v12 M74 80 v12" stroke="${c}" stroke-width="6"/>`,
      humanoid: `<circle cx="50" cy="26" r="13" fill="${c}"/><rect x="34" y="40" width="32" height="34" rx="6" fill="${c}"/><path d="M34 44 L18 66 M66 44 L84 30" stroke="${c}" stroke-width="7" stroke-linecap="round"/><path d="M84 30 L92 6" stroke="#ccc" stroke-width="4"/><path d="M40 74 L36 96 M60 74 L64 96" stroke="${c}" stroke-width="8" stroke-linecap="round"/><circle cx="45" cy="25" r="2.5" fill="#f22"/><circle cx="55" cy="25" r="2.5" fill="#f22"/>`,
      flyer: `<path d="M50 50 L6 24 L22 56 L6 70 L50 62 L94 70 L78 56 L94 24 Z" fill="${c}"/><circle cx="50" cy="52" r="12" fill="${c}" stroke="#000" stroke-opacity=".3"/><circle cx="45" cy="50" r="2.5" fill="#ff3"/><circle cx="55" cy="50" r="2.5" fill="#ff3"/>`,
      serpent: `<path d="M20 88 Q10 60 40 62 Q70 64 60 40 Q52 20 72 16" stroke="${c}" stroke-width="14" fill="none" stroke-linecap="round"/><circle cx="74" cy="16" r="10" fill="${c}"/><circle cx="77" cy="13" r="2.5" fill="#ff0"/><path d="M84 18 L94 20 L86 22" stroke="#f33" stroke-width="2" fill="none"/>`,
      caster: `<path d="M50 14 L70 40 L30 40Z" fill="${c}"/><circle cx="50" cy="44" r="10" fill="#222"/><circle cx="46" cy="44" r="2" fill="#0ff"/><circle cx="54" cy="44" r="2" fill="#0ff"/><path d="M30 54 L70 54 L80 96 L20 96Z" fill="${c}"/><path d="M78 60 L86 20" stroke="#a87" stroke-width="4"/><circle cx="86" cy="18" r="6" fill="#aef" opacity=".9"/>`,
      brute: `<circle cx="50" cy="22" r="14" fill="${c}"/><path d="M40 12 L36 2 L44 10Z M60 12 L64 2 L56 10Z" fill="#eee"/><rect x="26" y="36" width="48" height="40" rx="10" fill="${c}"/><path d="M26 42 L10 72 M74 42 L90 72" stroke="${c}" stroke-width="10" stroke-linecap="round"/><path d="M38 76 L36 98 M62 76 L64 98" stroke="${c}" stroke-width="11" stroke-linecap="round"/><circle cx="45" cy="21" r="2.5" fill="#f22"/><circle cx="55" cy="21" r="2.5" fill="#f22"/>`,
      ghost: `<path d="M50 10 Q80 10 80 50 L80 90 L70 80 L60 92 L50 80 L40 92 L30 80 L20 90 L20 50 Q20 10 50 10Z" fill="${c}" opacity=".75"/><ellipse cx="40" cy="42" rx="5" ry="8" fill="#113"/><ellipse cx="60" cy="42" rx="5" ry="8" fill="#113"/>`,
      lord: `<path d="M50 4 L58 20 L74 8 L70 28 L50 24 L30 28 L26 8 L42 20Z" fill="#fc3"/><circle cx="50" cy="34" r="14" fill="${c}"/><path d="M20 50 Q50 36 80 50 L90 98 L10 98Z" fill="${c}"/><path d="M20 52 L2 30 L8 60Z M80 52 L98 30 L92 60Z" fill="#401030"/><circle cx="44" cy="33" r="3" fill="#ff0"/><circle cx="56" cy="33" r="3" fill="#ff0"/><path d="M84 60 L96 2" stroke="#ddd" stroke-width="5"/>`,
    };
    const sc = e.scale || 1;
    return `<svg class="enemy-sprite" viewBox="0 0 100 100" width="${Math.round(size * sc)}" height="${Math.round(size * sc)}" aria-hidden="true">${shapes[e.shape] || shapes.blob}</svg>`;
  }

  function hpBar(cur, max, cls = 'hp') {
    const p = max > 0 ? Math.max(0, Math.min(100, (cur / max) * 100)) : 0;
    return `<div class="bar ${cls}"><div style="width:${p}%"></div></div>`;
  }

  function charLine(c) {
    const cl = D.CLASSES[c.cls];
    return `${esc(D.ALIGNS[c.align].name.charAt(0))}-${esc(cl.name)} ${esc(D.RACES[c.race].name)}`;
  }

  function statusText(c) {
    if (c.status.dead) return '<span class="st dead">戦闘不能</span>';
    const a = [];
    if (c.status.poison) a.push('<span class="st poison">毒</span>');
    if (c.status.sleep) a.push('<span class="st sleep">睡眠</span>');
    return a.join('');
  }

  return { $, esc, nl2br, wait, screen, currentScreen, modal, alert, confirm, prompt, toast, stars, rarityClass, portrait, enemySprite, hpBar, charLine, statusText };
})();
