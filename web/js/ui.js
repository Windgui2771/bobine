import { api } from './api.js';

export function h(tag, attrs = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'html') el.innerHTML = v;
    else if (v === true) el.setAttribute(k, '');
    else el.setAttribute(k, v);
  }
  for (const c of kids.flat(Infinity)) if (c != null && c !== false) el.append(c.nodeType ? c : document.createTextNode(String(c)));
  return el;
}

const P = {
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  home: '<path d="M3 11 12 4l9 7"/><path d="M5 10v10h14V10"/>',
  film: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 4v16M17 4v16M3 9h4M3 15h4M17 9h4M17 15h4"/>',
  tv: '<rect x="3" y="5" width="18" height="12" rx="2"/><path d="M8 21h8M12 17v4"/>',
  folder: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  heart: '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>',
  dice: '<rect x="4" y="4" width="16" height="16" rx="3"/><circle cx="9" cy="9" r="1.2" fill="currentColor"/><circle cx="15" cy="15" r="1.2" fill="currentColor"/><circle cx="15" cy="9" r="1.2" fill="currentColor"/><circle cx="9" cy="15" r="1.2" fill="currentColor"/>',
  server: '<rect x="4" y="4" width="16" height="7" rx="1.5"/><rect x="4" y="13" width="16" height="7" rx="1.5"/><path d="M8 7.5h.01M8 16.5h.01"/>',
  play: '<path d="M7 4v16l13-8z" fill="currentColor" stroke="none"/>',
  pause: '<path d="M6 4h4v16H6zM14 4h4v16h-4z" fill="currentColor" stroke="none"/>',
  check: '<path d="m5 12 5 5 9-10"/>',
  mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>',
  back: '<path d="M15 5 8 12l7 7"/>',
  sub: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M7 14h4M13 14h4M7 10h10"/>',
  audio: '<path d="M4 10v4h4l5 4V6L8 10z"/><path d="M16 9a4 4 0 0 1 0 6"/>',
  rw: '<path d="M11 6 5 12l6 6M19 6l-6 6 6 6"/>',
  ff: '<path d="m13 6 6 6-6 6M5 6l6 6-6 6"/>',
  next: '<path d="M6 5v14l10-7z" fill="currentColor"/><path d="M18 5v14"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  out: '<path d="M10 4H5v16h5M15 8l4 4-4 4M19 12H9"/>',
  refresh: '<path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>'
};
export function icon(name) {
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('fill', 'none'); s.setAttribute('stroke', 'currentColor');
  s.setAttribute('stroke-width', '2'); s.setAttribute('stroke-linecap', 'round'); s.setAttribute('stroke-linejoin', 'round');
  s.setAttribute('aria-hidden', 'true'); s.innerHTML = P[name] || '';
  return s;
}

let toastT;
export function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.classList.add('on');
  clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), 2600);
}

export const fmt = {
  runtime(ticks) { if (!ticks) return ''; const m = Math.round(ticks / 6e8); return m >= 60 ? `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')}` : `${m} min`; },
  clock(sec) { sec = Math.max(0, Math.floor(sec || 0)); const hh = Math.floor(sec / 3600), mm = Math.floor(sec % 3600 / 60), ss = sec % 60; return (hh ? hh + ':' + String(mm).padStart(2, '0') : mm) + ':' + String(ss).padStart(2, '0'); },
  epCode(it) { return it.ParentIndexNumber != null && it.IndexNumber != null ? `S${String(it.ParentIndexNumber).padStart(2, '0')} · É${String(it.IndexNumber).padStart(2, '0')}` : ''; },
  is4k(it) { return (it.Width || 0) >= 3200 || (it.MediaStreams || []).some((s) => s.Type === 'Video' && (s.Width || 0) >= 3200); },
  gb(b) { return b == null ? '?' : (b / 1e12 >= 1 ? (b / 1e12).toFixed(1).replace('.', ',') + ' To' : Math.round(b / 1e9) + ' Go'); }
};

// --- cartes ---
// image en fond CSS (comme la bannière) : s'affiche aussi sur les télés au moteur web ancien
export function imgEl(src) {
  return h('div', { class: 'img', style: { backgroundImage: `url("${src}")` } });
}
export function posterCard(it, onOpen) {
  const isEp = it.Type === 'Episode';
  const isSeason = it.Type === 'Season';
  const title = (isEp || isSeason) ? (it.SeriesName || it.Name) : it.Name;
  const sub = isEp ? fmt.epCode(it) : isSeason ? it.Name : (it.ProductionYear || '');
  // un épisode affiché en affiche prend l'affiche de sa série (pas l'image de l'épisode)
  const src = isEp && it.SeriesPrimaryImageTag ? api.img(it.SeriesId, 'Primary', { fillHeight: 420, tag: it.SeriesPrimaryImageTag })
    : (it.ImageTags?.Primary ? api.img(it.Id, 'Primary', { fillHeight: 420, tag: it.ImageTags.Primary }) : null);
  const ud = it.UserData || {};
  return h('button', { class: 'card poster f', 'data-key': it.Id, 'aria-label': title + (sub ? ', ' + sub : ''), onclick: () => onOpen(it) },
    h('div', { class: 'ph' }), src && imgEl(src, title),
    h('div', { class: 'cap' }, title, sub ? h('small', {}, sub) : null),
    ud.Played ? h('span', { class: 'seen', 'aria-label': 'Déjà vu' }, '✓') : null,
    ud.PlayedPercentage > 0 && !ud.Played ? h('div', { class: 'bar' }, h('i', { style: { width: ud.PlayedPercentage + '%' } })) : null
  );
}
export function wideCard(it, onOpen) {
  const isEp = it.Type === 'Episode';
  const title = isEp ? it.SeriesName : it.Name;
  const sub = isEp ? `${fmt.epCode(it)} · ${it.Name}` : (it.ProductionYear || '');
  let src = null;
  if (it.ImageTags?.Thumb) src = api.img(it.Id, 'Thumb', { maxWidth: 640, tag: it.ImageTags.Thumb });
  else if (isEp && it.ImageTags?.Primary) src = api.img(it.Id, 'Primary', { maxWidth: 640, tag: it.ImageTags.Primary });
  else if (it.BackdropImageTags?.length) src = api.img(it.Id, 'Backdrop', { maxWidth: 640, tag: it.BackdropImageTags[0] });
  else if (it.ParentBackdropImageTags?.length) src = api.img(it.ParentBackdropItemId || it.SeriesId, 'Backdrop', { maxWidth: 640, tag: it.ParentBackdropImageTags[0] });
  const pct = it.UserData?.PlayedPercentage || 0;
  return h('button', { class: 'card wide f', 'data-key': it.Id, 'aria-label': title + ', ' + sub, onclick: () => onOpen(it) },
    h('div', { class: 'ph' }), src && imgEl(src, title),
    h('div', { class: 'cap' }, title, h('small', {}, sub)),
    pct > 0 ? h('div', { class: 'bar' }, h('i', { style: { width: pct + '%' } })) : null
  );
}
export function folderCard(it, onOpen) {
  const n = it.ChildCount ?? it.RecursiveItemCount;
  return h('button', { class: 'card folder f', 'data-key': it.Id, onclick: () => onOpen(it) },
    icon('folder'), h('div', {}, h('b', {}, it.Name), n != null ? h('small', { style: { display: 'block' } }, n + (n > 1 ? ' éléments' : ' élément')) : null));
}
export function shelf(title, items, makeCard, onOpen) {
  if (!items || !items.length) return null;
  const track = h('div', { class: 'track', 'data-row': title }, items.map((i) => makeCard(i, onOpen)));
  // flèches pour la souris (la télécommande, elle, défile toute seule)
  const step = (d) => track.scrollBy({ left: d * track.clientWidth * 0.8, behavior: 'smooth' });
  const prev = h('button', { class: 'arrow left', tabindex: '-1', 'aria-label': 'Défiler vers la gauche', onclick: () => step(-1) }, '‹');
  const next = h('button', { class: 'arrow right', tabindex: '-1', 'aria-label': 'Défiler vers la droite', onclick: () => step(1) }, '›');
  const upd = () => { prev.hidden = track.scrollLeft < 10; next.hidden = track.scrollLeft + track.clientWidth >= track.scrollWidth - 10; };
  track.addEventListener('scroll', upd, { passive: true });
  requestAnimationFrame(upd); setTimeout(upd, 600);
  return h('section', { class: 'shelf' }, h('h2', {}, title), h('div', { class: 'trackwrap' }, track, prev, next));
}
export function backdropUrl(it, w = 1920) {
  if (it.BackdropImageTags?.length) return api.img(it.Id, 'Backdrop', { maxWidth: w, tag: it.BackdropImageTags[0] });
  if (it.ParentBackdropImageTags?.length) return api.img(it.ParentBackdropItemId || it.SeriesId, 'Backdrop', { maxWidth: w, tag: it.ParentBackdropImageTags[0] });
  return null;
}
export function logoUrl(it) {
  if (it.ImageTags?.Logo) return api.img(it.Id, 'Logo', { maxWidth: 800, tag: it.ImageTags.Logo });
  if (it.ParentLogoImageTag) return api.img(it.ParentLogoItemId || it.SeriesId, 'Logo', { maxWidth: 800, tag: it.ParentLogoImageTag });
  return null;
}
