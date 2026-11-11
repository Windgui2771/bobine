// Navigation à la télécommande / au clavier (flèches, OK, Retour) et à la souris.
// Tout élément avec la classe .f est atteignable aux flèches.
const KEYS = {
  ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
  Enter: 'ok', NumpadEnter: 'ok', ' ': 'space',
  Escape: 'back', Backspace: 'back', GoBack: 'back', BrowserBack: 'back',
  MediaPlayPause: 'playpause', MediaPlay: 'play', MediaPause: 'pause', MediaStop: 'stop',
  MediaFastForward: 'ff', MediaRewind: 'rw', MediaTrackNext: 'next', MediaTrackPrevious: 'prev'
};
const CODES = { 4: 'back', 8: 'back', 27: 'back', 19: 'up', 20: 'down', 21: 'left', 22: 'right', 23: 'ok', 66: 'ok', 85: 'playpause', 126: 'play', 127: 'pause', 90: 'ff', 89: 'rw', 461: 'back', 10009: 'back' };

export const nav = {
  handlers: [],          // pile : le dernier écran/overlay reçoit les touches en premier
  usingKeys: false,
  push(fn) { this.handlers.push(fn); return () => { const i = this.handlers.lastIndexOf(fn); if (i >= 0) this.handlers.splice(i, 1); }; },

  focusables(root) {
    const scope = root || this.scope();
    return [...scope.querySelectorAll('.f')].filter((el) => !el.disabled && el.offsetParent !== null && el.getClientRects().length);
  },
  scope() { return document.querySelector('.modal') || document.querySelector('.saver') || document.querySelector('.player') || document.getElementById('app'); },

  focus(el, opts = {}) {
    if (!el) return false;
    el.focus({ preventScroll: true });
    if (this.usingKeys) el.classList.add('kb');
    const track = el.closest('.track');
    if (track) {
      const r = el.getBoundingClientRect(), tr = track.getBoundingClientRect();
      if (r.left < tr.left + 40) track.scrollLeft -= (tr.left + 56 - r.left);
      else if (r.right > tr.right - 40) track.scrollLeft += (r.right - tr.right + 56);
    }
    if (!opts.noScroll) el.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
    return true;
  },
  first(root) {
    const pref = (root || this.scope()).querySelector('[data-autofocus].f');
    return this.focus(pref || this.focusables(root)[0]);
  },

  move(dir) {
    const cur = document.activeElement;
    const list = this.focusables();
    if (!cur || !list.includes(cur)) return this.first();
    // mémoire de ligne : revenir sur le dernier élément visité d'une étagère
    const c = cur.getBoundingClientRect();
    const cx = c.left + c.width / 2, cy = c.top + c.height / 2;
    let best = null, bestScore = Infinity;
    for (const el of list) {
      if (el === cur) continue;
      const r = el.getBoundingClientRect();
      const x = r.left + r.width / 2, y = r.top + r.height / 2;
      let main, side;
      if (dir === 'right') { if (r.left < c.right - 4 && x <= cx + 2) continue; main = r.left - c.right; side = Math.abs(y - cy); }
      else if (dir === 'left') { if (r.right > c.left + 4 && x >= cx - 2) continue; main = c.left - r.right; side = Math.abs(y - cy); }
      else if (dir === 'down') { if (r.top < c.bottom - 4 && y <= cy + 2) continue; main = r.top - c.bottom; side = Math.abs(x - cx); }
      else { if (r.bottom > c.top + 4 && y >= cy - 2) continue; main = c.top - r.bottom; side = Math.abs(x - cx); }
      main = Math.max(0, main);
      // vertical : on favorise l'alignement ; horizontal : on reste sur la même ligne
      const overlap = (dir === 'left' || dir === 'right') ? (r.bottom > c.top && r.top < c.bottom ? 0 : 1) : 0;
      let score = main + side * (dir === 'up' || dir === 'down' ? 0.6 : 2.5) + overlap * 2000;
      // haut/bas : on ne saute pas du contenu vers le menu de gauche (et inversement)
      if ((dir === 'up' || dir === 'down') && !!el.closest('#rail') !== !!cur.closest('#rail')) score += 5000;
      const row = el.closest('[data-row]');
      if ((dir === 'up' || dir === 'down') && row && row.dataset.last && row !== cur.closest('[data-row]')) {
        const last = row.querySelector(`[data-key="${CSS.escape(row.dataset.last)}"]`);
        if (last === el) score -= 400;
      }
      if (score < bestScore) { bestScore = score; best = el; }
    }
    if (best) {
      const row = cur.closest('[data-row]');
      if (row && cur.dataset.key) row.dataset.last = cur.dataset.key;
      this.focus(best);
      return true;
    }
    return false;
  },

  init() {
    window.addEventListener('keydown', (e) => {
      const action = KEYS[e.key] || CODES[e.keyCode];
      if (!action) { this.handlers.at(-1)?.({ action: 'other', e }); return; }
      const t = e.target;
      const typing = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT');
      if (typing && (action === 'left' || action === 'right' || action === 'space')) return;
      if (typing && action === 'back' && e.key === 'Backspace') return;
      if (typing && action === 'ok' && t.tagName !== 'SELECT') { t.dispatchEvent(new CustomEvent('submit-input')); }
      this.usingKeys = true;
      document.body.classList.add('keys');
      for (let i = this.handlers.length - 1; i >= 0; i--) {
        if (this.handlers[i]({ action, e }) === true) { e.preventDefault(); return; }
      }
      if (['up', 'down', 'left', 'right'].includes(action)) { e.preventDefault(); if (!this.move(action) && !document.activeElement?.classList.contains('f')) this.first(); }
      else if (action === 'ok' && !typing) {
        const el = document.activeElement;
        if (el && el.classList.contains('f')) { e.preventDefault(); el.click(); }
      }
    }, true);
    // à la souris, l'anneau clavier disparaît
    window.addEventListener('mousemove', () => {
      if (!this.usingKeys) return;
      this.usingKeys = false; document.body.classList.remove('keys');
      document.querySelectorAll('.kb').forEach((x) => x.classList.remove('kb'));
    }, { passive: true });
    document.addEventListener('focusout', (e) => e.target.classList?.remove('kb'));
    this.initGamepad();
  },

  // manette (Xbox, PC) : croix ou stick = flèches, A = OK, B = retour, Start = lecture/pause
  initGamepad() {
    const MAP = { 12: 'ArrowUp', 13: 'ArrowDown', 14: 'ArrowLeft', 15: 'ArrowRight', 0: 'Enter', 1: 'Escape', 9: 'MediaPlayPause', 4: 'MediaRewind', 5: 'MediaFastForward' };
    const held = {}; let raf = null;
    const fire = (key) => {
      const codes = { ArrowUp: 38, ArrowDown: 40, ArrowLeft: 37, ArrowRight: 39, Enter: 13, Escape: 27, MediaPlayPause: 179 };
      const ev = new KeyboardEvent('keydown', { key: key, code: key, keyCode: codes[key] || 0, bubbles: true, cancelable: true });
      (document.activeElement || document.body).dispatchEvent(ev);
    };
    const loop = (t) => {
      const pads = navigator.getGamepads ? [...navigator.getGamepads()].filter(Boolean) : [];
      if (!pads.length) { raf = null; return; }
      const gp = pads[0];
      const want = {};
      for (const [b, key] of Object.entries(MAP)) if (gp.buttons[b]?.pressed) want[key] = true;
      const [ax, ay] = gp.axes;
      if (ay < -0.6) want.ArrowUp = true; if (ay > 0.6) want.ArrowDown = true;
      if (ax < -0.6) want.ArrowLeft = true; if (ax > 0.6) want.ArrowRight = true;
      for (const key of Object.keys(want)) {
        const h = held[key];
        // premier appui immédiat, puis répétition si on garde appuyé (flèches seulement)
        if (!h) { held[key] = { since: t, last: t }; fire(key); }
        else if (key.startsWith('Arrow') && t - h.since > 420 && t - h.last > 110) { h.last = t; fire(key); }
      }
      for (const key of Object.keys(held)) if (!want[key]) delete held[key];
      raf = requestAnimationFrame(loop);
    };
    window.addEventListener('gamepadconnected', () => { if (!raf) raf = requestAnimationFrame(loop); });
  }
};
