import { api, LS } from './api.js';
import { nav } from './nav.js';
import { h, icon, toast, fmt, posterCard, wideCard, folderCard, shelf, backdropUrl, logoUrl } from './ui.js';
import { play } from './player.js';
import { seerr } from './seerr.js';
import { CFG } from './config.js';

const view = document.getElementById('view');
const rail = document.getElementById('rail');
const native = window.AppNative || null;

// ---------- profil Enfants ----------
const kidsCfg = () => LS.get('kids', null); // { userId, pin }
const isKids = () => !!(api.user && kidsCfg()?.userId === api.user.Id);
const hashPin = (p) => { let x = 5381; for (const c of 'cp:' + p) x = ((x << 5) + x + c.charCodeAt(0)) >>> 0; return x.toString(36); };
const ADULT = /^(FR-1[0268]|FR-12|FR-16|FR-18|-1[0268]|1[0268]\+?|R|NC-17|PG-13|TV-14|TV-MA|X|18|16|12|DE-1[268]|GB-1[258])$/i;
const KID_GENRES = ['Animation', 'Familial', 'Family', 'Enfants', 'Kids', 'Children'];
function kidSafe(it) {
  if (it.Type === 'Folder' || it.Type === 'CollectionFolder') return true;
  if (it.OfficialRating && ADULT.test(it.OfficialRating.trim())) return false;
  return (it.Genres || []).some((g) => KID_GENRES.includes(g));
}
const kf = (list) => (isKids() ? (list || []).filter(kidSafe) : (list || []));

// ---------- routeur ----------
const stack = [];
let libs = { movies: null, tvshows: null };
async function go(name, params = {}, { replace = false } = {}) {
  if (stack.length) stack.at(-1).focusKey = document.activeElement?.dataset?.key || null;
  if (replace) stack.pop();
  stack.push({ name, params });
  await render();
}
async function back() {
  if (document.querySelector('.modal')) { document.querySelector('.modal').remove(); nav.first(); return; }
  if (stack.length > 1) { stack.pop(); await render(true); return; }
  if (native?.exit) native.exit();
}
let renderSeq = 0;
async function render(restoring) {
  const seq = ++renderSeq;
  const top = stack.at(-1);
  const screen = SCREENS[top.name];
  drawRail(top.name);
  view.replaceChildren(h('div', { class: 'center' }, h('div', { class: 'spinner', style: { position: 'static', margin: 0 } })));
  let el;
  try { el = await screen(top.params); }
  catch (e) {
    console.error(e);
    if (e.status === 401) { api.token = null; stack.length = 0; return go('profiles'); }
    el = h('div', { class: 'page' }, h('div', { class: 'empty' }, h('b', {}, 'Ça n’a pas marché'), 'Le serveur n’a pas répondu. ', h('button', { class: 'btn small f', onclick: () => render() }, 'Réessayer')));
  }
  if (seq !== renderSeq) return;
  view.replaceChildren(el);
  view.scrollTop = 0;
  const key = restoring && top.focusKey;
  const target = key && view.querySelector(`[data-key="${CSS.escape(key)}"]`);
  requestAnimationFrame(() => { if (target) nav.focus(target); else nav.first(view) || nav.first(); });
}

// ---------- rail ----------
function drawRail(active) {
  const hide = ['setup', 'profiles', 'login'].includes(active);
  rail.hidden = hide;
  if (hide) return;
  const kids = isKids();
  const items = kids
    ? [['search', 'search', 'Chercher'], ['home', 'home', 'Accueil']]
    : [['search', 'search', 'Chercher'], ['home', 'home', 'Accueil'], ['films', 'film', 'Films'], ['series', 'tv', 'Séries'],
       ['folders', 'folder', 'Dossiers'], ['mylist', 'heart', 'Ma liste'], ['surprise', 'dice', 'Hasard']]
        .concat(seerr.base ? [['requests', 'list', 'Demandes']] : [])
        .concat(api.isAdmin ? [['server', 'server', 'Tableau de bord']] : []);
  const u = api.user;
  const pic = api.userImg(u);
  // téléphone : 4 onglets principaux + « Plus » qui ouvre le reste
  if (matchMedia('(max-width:820px)').matches) {
    const main = ['home', 'search', 'films', 'series'];
    const prim = items.filter(([k]) => main.includes(k)).sort((a, b) => main.indexOf(a[0]) - main.indexOf(b[0]));
    const rest = items.filter(([k]) => !main.includes(k));
    const moreOn = rest.some(([k]) => k === active) || active === 'me';
    rail.replaceChildren(
      ...prim.map(([k, ic, label]) => h('button', { class: 'f' + (active === k ? ' on' : ''), 'aria-label': label, onclick: () => { stack.length = 0; go(k); } }, icon(ic), h('span', {}, label))),
      h('button', { class: 'f' + (moreOn ? ' on' : ''), 'aria-label': 'Plus', onclick: () => moreSheet(rest, kids) }, icon('list'), h('span', {}, 'Plus')));
    return;
  }
  rail.replaceChildren(
    h('button', { class: 'logo f', 'data-key': 'rail-logo', 'aria-label': 'Accueil', onclick: () => { stack.length = 0; go('home'); } }, h('img', { src: 'icon.svg', alt: '' })),
    ...items.map(([k, ic, label]) => h('button', { class: 'f' + (active === k ? ' on' : ''), 'data-key': 'rail-' + k, 'aria-label': label, 'aria-current': active === k ? 'page' : null,
      onclick: () => { stack.length = 0; go(k); } }, icon(ic), h('span', {}, label))),
    h('div', { class: 'grow' }),
    h('button', { class: 'avatar f', 'data-key': 'rail-me', 'aria-label': 'Profil ' + u.Name, onclick: () => kids ? askPin(() => go('profiles')) : go('me') },
      pic ? h('img', { src: pic, alt: '' }) : (u.Name[0] || '?').toUpperCase())
  );
}

function moreSheet(rest, kids) {
  const close = modal([h('h2', {}, 'Menu'),
    h('div', { class: 'list', style: { width: '100%' } },
      rest.map(([k, ic, label]) => h('button', { class: 'li f', style: { justifyContent: 'flex-start', gap: '14px', width: '100%' }, onclick: () => { close(); stack.length = 0; go(k); } }, icon(ic), label)),
      h('button', { class: 'li f', style: { justifyContent: 'flex-start', gap: '14px', width: '100%' }, onclick: () => { close(); kids ? askPin(() => go('profiles')) : go('me'); } }, icon('out'), 'Profil · ' + api.user.Name))]);
}
let resizeT;
window.addEventListener('resize', () => { clearTimeout(resizeT); resizeT = setTimeout(() => { if (stack.length && api.user) drawRail(stack.at(-1).name); }, 200); });

// ---------- ouverture d'un élément ----------
function open(it) {
  if (it.Type === 'Folder' || it.Type === 'CollectionFolder' || it.Type === 'BoxSet') return go('folders', { lib: currentLibOf(it), path: [...(stack.at(-1).params.path || []), { id: it.Id, name: it.Name }] });
  if (it.Type === 'Episode') return go('detail', { id: it.SeriesId, season: it.SeasonId, focusEp: it.Id });
  if (it.Type === 'Season') return go('detail', { id: it.SeriesId, season: it.Id });
  return go('detail', { id: it.Id });
}
function currentLibOf() { return stack.at(-1).params.lib || 'movies'; }
function playNow(it, startTicks) {
  play(it, { startTicks, onExit: () => render(true), getNext: it.Type === 'Episode' ? nextEpisode : null });
}
async function nextEpisode(ep) {
  const r = await api.req(`/Shows/${ep.SeriesId}/Episodes`, { query: { userId: api.user.Id, startItemId: ep.Id, limit: 2, fields: api.FIELDS } });
  return (r.Items || []).find((x) => x.Id !== ep.Id) || null;
}

// ---------- écrans ----------
const SCREENS = {
  async setup() {
    const guess = CFG.server || (location.protocol === 'http:' && !native ? `http://${location.hostname}:8096` : 'http://');
    const inp = h('input', { class: 'input f', id: 'srv', value: LS.get('server', '') || guess, 'data-autofocus': true, inputmode: 'url', autocomplete: 'off' });
    const inp2 = h('input', { class: 'input f', id: 'srv2', value: LS.get('server2', ''), placeholder: 'https://jellyfin.mondomaine.fr', inputmode: 'url', autocomplete: 'off' });
    const err = h('div', { class: 'err', role: 'alert' });
    const submit = async () => {
      err.textContent = '';
      LS.set('server', inp.value.trim().replace(/\/+$/, '')); LS.set('server2', inp2.value.trim().replace(/\/+$/, ''));
      const ok = await api.pickServer();
      if (!ok) { err.textContent = 'Aucune des deux adresses ne répond.'; return; }
      try { const i = await api.publicInfo(); toast('Connecté à ' + i.ServerName + (ok === LS.get('server2') ? ' (adresse extérieure)' : '')); stack.length = 0; go('profiles'); }
      catch { err.textContent = 'Serveur introuvable à cette adresse.'; }
    };
    inp.addEventListener('submit-input', () => inp2.focus());
    inp2.addEventListener('submit-input', submit);
    return h('div', { class: 'center' }, h('img', { src: 'icon.svg', alt: '', style: { width: '72px' } }), h('h1', {}, CFG.appName),
      h('div', { class: 'field' }, h('label', { for: 'srv' }, 'Adresse du serveur Jellyfin (à la maison)'), inp),
      h('div', { class: 'field' }, h('label', { for: 'srv2' }, 'Adresse extérieure (optionnel)'), inp2,
        h('small', { class: 'muted', style: { lineHeight: 1.4 } }, 'Utilisée automatiquement quand l\u2019adresse de la maison ne répond pas.')), err,
      h('button', { class: 'btn primary f', onclick: submit }, 'Continuer'));
  },

  async profiles() {
    api.token = null;
    const saved = Object.values(LS.get('sessions', {}));
    let pub = [];
    try { pub = await api.publicUsers(); } catch {}
    const seen = new Set(saved.map((s) => s.id));
    const all = saved.map((s) => ({ id: s.id, name: s.name, img: s.img, saved: true })).concat(pub.filter((u) => !seen.has(u.Id)).map((u) => ({ id: u.Id, name: u.Name, img: u.PrimaryImageTag, saved: false })));
    const kids = kidsCfg();
    const pick = async (p) => {
      if (p.saved) { const u = await api.resume(p.id); if (u) { await afterLogin(); return; } toast('Session expirée, reconnecte-toi'); }
      go('login', { name: p.name });
    };
    return h('div', { class: 'center' }, h('div', { class: 'kicker' }, CFG.appName), h('h1', {}, 'Qui regarde ?'),
      h('div', { class: 'profiles' },
        all.map((p) => h('button', { class: 'profile f', 'data-key': p.id, onclick: () => pick(p) },
          h('div', { class: 'pic', style: kids?.userId === p.id ? { background: '#2C6E49' } : null }, p.img ? h('img', { src: `${api.base}/Users/${p.id}/Images/Primary?tag=${p.img}&maxHeight=240`, alt: '' }) : p.name[0].toUpperCase()),
          h('span', {}, p.name), kids?.userId === p.id ? h('small', { class: 'muted' }, 'Enfants') : null)),
        h('button', { class: 'profile f', 'data-key': 'other', onclick: () => go('login', {}) }, h('div', { class: 'pic' }, '+'), h('span', {}, 'Autre compte'))),
      h('button', { class: 'btn small f', onclick: () => go('setup') }, 'Changer de serveur'));
  },

  async login({ name }) {
    const u = h('input', { class: 'input f', id: 'u', value: name || '', autocomplete: 'username', 'data-autofocus': name ? null : true });
    const p = h('input', { class: 'input f', id: 'p', type: 'password', autocomplete: 'current-password', 'data-autofocus': name ? true : null });
    const err = h('div', { class: 'err', role: 'alert' });
    const submit = async () => {
      err.textContent = '';
      try { await api.login(u.value.trim(), p.value); if (seerr.base) seerr.login(u.value.trim(), p.value).catch(() => {}); p.value = ''; await afterLogin(); }
      catch { err.textContent = 'Nom ou mot de passe incorrect.'; }
    };
    u.addEventListener('submit-input', () => p.focus());
    p.addEventListener('submit-input', submit);
    return h('div', { class: 'center' }, h('h1', {}, 'Connexion'),
      h('div', { class: 'field' }, h('label', { for: 'u' }, 'Nom d’utilisateur'), u),
      h('div', { class: 'field' }, h('label', { for: 'p' }, 'Mot de passe'), p), err,
      h('div', { class: 'row-flex' }, h('button', { class: 'btn primary f', onclick: submit }, 'Se connecter'), h('button', { class: 'btn f', onclick: back }, 'Retour')));
  },

  async home() {
    if (isKids()) return kidsHome();
    await loadLibs();
    const [resume, next, lm, ls, reco] = await Promise.all([
      api.resumeItems(20).catch(() => ({ Items: [] })), api.nextUp(20).catch(() => ({ Items: [] })),
      libs.movies ? api.latest(libs.movies, 24).catch(() => []) : [], libs.tvshows ? api.latest(libs.tvshows, 24).catch(() => []) : [],
      api.recommendations().catch(() => [])
    ]);
    // suggestions séries : à partir des 3 dernières séries regardées
    // historique réel : épisodes triés par date de dernière lecture (vus ou commencés)
    const hist = await api.items({ recursive: true, includeItemTypes: 'Episode', sortBy: 'DatePlayed', sortOrder: 'Descending', limit: 200, enableImageTypes: 'Primary' }).catch(() => ({ Items: [] }));
    const watchedSeries = [];
    for (const e of hist.Items) if (e.SeriesId && e.UserData?.LastPlayedDate && !watchedSeries.some((w) => w.id === e.SeriesId)) watchedSeries.push({ id: e.SeriesId, name: e.SeriesName });
    const seriesRows = await Promise.all(watchedSeries.slice(0, 3).map(async (w) => {
      const r = await api.similar(w.id).catch(() => ({ Items: [] }));
      return { name: w.name, items: r.Items.filter((x) => x.Type === 'Series' && !watchedSeries.some((ws) => ws.id === x.Id)) };
    }));
    // bannière : ce qu'on est en train de regarder + nouveautés + une pépite non vue
    // bannière : tirage au hasard dans toute la bibliothèque (films + séries avec image de fond)
    const rnd = await api.items({ recursive: true, includeItemTypes: 'Movie,Series', sortBy: 'Random', limit: 10, imageTypes: 'Backdrop', fields: api.FIELDS + ',RemoteTrailers' }).catch(() => ({ Items: [] }));
    const pick = rnd.Items.filter((x) => backdropUrl(x)).sort((a, b) => (ytId(b) ? 1 : 0) - (ytId(a) ? 1 : 0)); // ceux avec bande-annonce d'abord
    const recoLabel = (c) => ({ SimilarToRecentlyPlayed: 'Parce que tu as regardé ', SimilarToLikedItem: 'Parce que tu as aimé ', HasDirectorFromRecentlyPlayed: 'Réalisé par ', HasActorFromRecentlyPlayed: 'Avec ', HasLikedDirector: 'Réalisé par ', HasLikedActor: 'Avec ' }[c.RecommendationType] || 'Pour toi, d\u2019après ') + c.BaselineItemName;
    return h('div', {},
      pick.length ? banner(pick) : h('div', { class: 'page' }, h('h1', {}, 'Bonsoir ' + api.user.Name)),
      shelf('Reprendre', resume.Items, wideCard, (it) => playNow(it)),
      shelf('À suivre', next.Items, wideCard, (it) => playNow(it, 0)),
      shelf('Derniers films ajoutés', lm, posterCard, open),
      shelf('Dernières séries ajoutées', ls, posterCard, open),
      ...seriesRows.map((r, k) => shelf((k === 0 ? 'Parce que tu regardes ' : 'Parce que tu as regardé ') + r.name, r.items, posterCard, open)),
      ...reco.map((c) => shelf(recoLabel(c), c.Items, posterCard, open)));
  },

  async films() { return libraryGrid('Movie', 'Films'); },
  async series() { return libraryGrid('Series', 'Séries'); },

  async mylist() {
    const r = await api.items({ recursive: true, includeItemTypes: 'Movie,Series', isFavorite: true, sortBy: 'SortName' });
    return h('div', { class: 'page' }, h('div', { class: 'kicker' }, 'Ma liste'), h('h1', {}, 'Mes favoris'),
      r.Items.length ? h('div', { class: 'grid', 'data-row': 'g' }, r.Items.map((i) => posterCard(i, open)))
        : h('div', { class: 'empty' }, h('b', {}, 'Liste vide'), 'Sur la fiche d’un film ou d’une série, choisis « Ma liste ».'));
  },

  async surprise() {
    const r = await api.items({ recursive: true, includeItemTypes: 'Movie', isPlayed: false, sortBy: 'Random', limit: 1 });
    const it = r.Items[0];
    if (!it) return h('div', { class: 'page' }, h('div', { class: 'empty' }, h('b', {}, 'Tout est vu !'), 'Plus aucun film non vu.'));
    stack.pop(); stack.push({ name: 'detail', params: { id: it.Id, surprise: true } });
    return SCREENS.detail({ id: it.Id, surprise: true });
  },

  async folders({ lib = 'movies', path = [] }) {
    await loadLibs();
    const rootId = libs[lib];
    const parentId = path.length ? path.at(-1).id : rootId;
    const r = await api.items({ parentId, sortBy: 'SortName', sortOrder: 'Ascending', fields: api.FIELDS });
    const items = kf(r.Items).filter((i) => !(i.Type === 'Folder' && i.ChildCount === 0)); // dossiers vides masqués
    const folders = items.filter((i) => i.IsFolder && i.Type !== 'Series' && i.Type !== 'BoxSet' || i.Type === 'Folder');
    const media = items.filter((i) => !folders.includes(i));
    const sw = (k, label) => h('button', { class: 'chip f' + (lib === k ? ' on' : ''), 'aria-pressed': lib === k ? 'true' : 'false', onclick: () => go('folders', { lib: k, path: [] }, { replace: true }) }, label);
    return h('div', { class: 'page' }, h('div', { class: 'kicker' }, 'Dossiers'), h('h1', {}, path.length ? path.at(-1).name : 'Mes dossiers'),
      h('div', { class: 'toolbar' }, sw('movies', 'Films'), sw('tvshows', 'Séries')),
      h('nav', { class: 'crumbs', 'aria-label': 'Chemin' },
        h('button', { class: 'f', onclick: () => go('folders', { lib, path: [] }, { replace: true }) }, lib === 'movies' ? 'Films' : 'Séries'),
        path.map((p, i) => [h('span', {}, '›'), h('button', { class: 'f', onclick: () => go('folders', { lib, path: path.slice(0, i + 1) }, { replace: true }) }, p.name)])),
      folders.length ? h('div', { class: 'grid folders', 'data-row': 'fold' }, folders.map((f) => folderCard(f, (it) => go('folders', { lib, path: [...path, { id: it.Id, name: it.Name }] })))) : null,
      media.length ? h('div', { class: 'grid', 'data-row': 'med' }, media.map((m) => posterCard(m, open))) : null,
      !items.length ? h('div', { class: 'empty' }, h('b', {}, 'Dossier vide'), '') : null);
  },

  async detail({ id, season, focusEp }) {
    const it = await api.item(id);
    if (isKids() && !kidSafe(it)) return h('div', { class: 'page' }, h('div', { class: 'empty' }, h('b', {}, 'Pas disponible'), 'Ce titre n’est pas dans le profil Enfants.'));
    const page = h('div', { class: 'detail' });
    if (it.Type === 'Series') {
      const [seasons, nu] = await Promise.all([api.seasons(it.Id), api.nextUp(1, it.Id).catch(() => ({ Items: [] }))]);
      const nextEp = nu.Items[0];
      page.append(hero(it, { nextEp }));
      const ss = seasons.Items;
      let cur = season || nextEp?.SeasonId || ss[0]?.Id;
      const tabs = h('div', { class: 'seasons', 'data-row': 'seasons' });
      const list = h('div', { class: 'eps', 'data-row': 'eps' });
      const draw = async () => {
        tabs.replaceChildren(...ss.map((s) => h('button', { class: 'chip f' + (s.Id === cur ? ' on' : ''), 'data-key': s.Id, onclick: () => { cur = s.Id; draw(); } }, s.Name)));
        const eps = await api.episodes(it.Id, cur);
        list.replaceChildren(...eps.Items.map((e) => episodeRow(e)));
        const target = focusEp && list.querySelector(`[data-key="${focusEp}"]`);
        if (target) { focusEp = null; requestAnimationFrame(() => nav.focus(target)); }
      };
      page.append(tabs, list);
      await draw();
    } else {
      page.append(hero(it, {}));
      const sim = await api.similar(it.Id).catch(() => ({ Items: [] }));
      const s = shelf('Dans le même esprit', kf(sim.Items), posterCard, open);
      if (s) page.append(s);
    }
    page.append(h('div', { style: { height: '40px' } }));
    return page;
  },

  async search() { return searchScreen(); },
  async requests() { return requestsScreen(); },
  async server() { return serverScreen(); },
  async me() { return meScreen(); }
};

// ---------- bandes-annonces (YouTube) ----------
function ytId(it) {
  for (const t of it.RemoteTrailers || []) {
    const m = /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([\w-]{11})/.exec(t.Url || '');
    if (m) return m[1];
  }
  return null;
}
let ytPromise = null;
function loadYT() {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (!ytPromise) ytPromise = new Promise((res) => {
    window.onYouTubeIframeAPIReady = () => res(window.YT);
    const sc = document.createElement('script'); sc.src = 'https://www.youtube.com/iframe_api'; sc.onerror = () => { ytPromise = null; res(null); };
    document.head.append(sc); setTimeout(() => res(window.YT?.Player ? window.YT : null), 8000);
  });
  return ytPromise;
}
async function trailerModal(id) {
  const YT = await loadYT();
  if (!YT) { toast('Bande-annonce indisponible'); return; }
  const holder = h('div');
  const closeBtn = h('button', { class: 'btn f tclose', 'data-autofocus': true, onclick: () => close() }, 'Fermer');
  const m = h('div', { class: 'modal trailer', onclick: (e) => { if (e.target === m) close(); } }, h('div', { class: 'tbox' }, holder), closeBtn);
  document.body.append(m);
  const p = new YT.Player(holder, { videoId: id, playerVars: { autoplay: 1, rel: 0, modestbranding: 1, playsinline: 1 },
    events: { onReady: (e) => e.target.playVideo(), onStateChange: (e) => { if (e.data === 0) close(); }, onError: () => { toast('Cette bande-annonce ne peut pas être lue ici'); close(); } } });
  const off = nav.push(({ action }) => {
    if (action === 'back') { close(); return true; }
    if (action === 'playpause' || action === 'space') { const st = p.getPlayerState?.(); st === 1 ? p.pauseVideo() : p.playVideo(); return true; }
    return false;
  });
  requestAnimationFrame(() => nav.first(m));
  let done = false;
  function close() { if (done) return; done = true; off(); try { p.destroy(); } catch {} m.remove(); nav.first(view); }
}

// ---------- morceaux d'écran ----------
function banner(items) {
  let i = 0, timer = null;
  const wrap = h('section', { class: 'banner', 'data-row': 'banner' });
  const dots = h('div', { class: 'dots' });
  let trailerT = null, yt = null;
  const show = (n, focusBtn) => {
    i = (n + items.length) % items.length;
    const old = wrap.querySelector('.hero');
    const hadFocus = old && old.contains(document.activeElement);
    const el = hero(items[i], { home: true });
    if (old) old.replaceWith(el); else wrap.prepend(el);
    // bande-annonce muette en fond après 2,5 s (si le titre en a une)
    clearTimeout(trailerT); try { yt?.destroy(); } catch {} yt = null;
    const id = ytId(items[i]);
    if (id && LS.get('bannerTrailers', true)) trailerT = setTimeout(async () => {
      const YT = await loadYT(); if (!YT || !document.contains(el)) return;
      const box = h('div', { class: 'ytbg' }, h('div'));
      el.prepend(box);
      yt = new YT.Player(box.firstChild, { videoId: id, playerVars: { autoplay: 1, mute: 1, controls: 0, rel: 0, modestbranding: 1, playsinline: 1, iv_load_policy: 3, disablekb: 1, start: 4 },
        events: {
          onReady: (e) => { e.target.mute(); e.target.playVideo(); },
          onStateChange: (e) => {
            if (e.data === 1) { box.classList.add('on'); restart(40000); }
            if (e.data === 0) { show(i + 1); restart(); }
          },
          onError: () => { box.remove(); }
        } });
    }, 2500);
    dots.replaceChildren(...items.map((_, k) => h('button', { class: k === i ? 'on' : '', tabindex: '-1', 'aria-label': 'Affiche ' + (k + 1), onclick: () => { show(k); restart(); } })));
    if (hadFocus || focusBtn) nav.focus(el.querySelector('.btn'));
  };
  const restart = (ms = 9000) => { clearInterval(timer); timer = setInterval(() => { if (!document.contains(wrap)) { clearInterval(timer); try { yt?.destroy(); } catch {} return; } if (wrap.contains(document.activeElement) && nav.usingKeys) return; show(i + 1); restart(); }, ms); };
  wrap.append(dots, h('button', { class: 'bnav l', tabindex: '-1', 'aria-label': 'Précédent', onclick: () => { show(i - 1); restart(); } }, '‹'),
    h('button', { class: 'bnav r', tabindex: '-1', 'aria-label': 'Suivant', onclick: () => { show(i + 1); restart(); } }, '›'));
  show(0); restart();
  // télécommande : droite sur le dernier bouton = affiche suivante, gauche sur le premier = précédente
  const off = nav.push(({ action }) => {
    if (!document.contains(wrap)) { off(); return false; }
    const btns = [...wrap.querySelectorAll('.hero .btn')];
    if (action === 'right' && document.activeElement === btns.at(-1)) { show(i + 1, true); restart(); return true; }
    if (action === 'left' && document.activeElement === btns[0] && i > 0) { show(i - 1, true); restart(); return true; }
    return false;
  });
  return wrap;
}

function hero(it, { home, nextEp } = {}) {
  const bg = backdropUrl(it.Type === 'Episode' ? { ...it, BackdropImageTags: [] } : it);
  const logo = logoUrl(it);
  const ud = it.UserData || {};
  const resumeT = ud.PlaybackPositionTicks || 0;
  const meta = [it.ProductionYear, it.Type === 'Series' ? (it.ChildCount ? it.ChildCount + ' saison' + (it.ChildCount > 1 ? 's' : '') : '') : fmt.runtime(it.RunTimeTicks),
    it.OfficialRating, fmt.is4k(it) ? '4K' : '', it.CommunityRating ? '★ ' + it.CommunityRating.toFixed(1).replace('.', ',') : ''].filter(Boolean);
  const btns = [];
  if (it.Type === 'Series') {
    if (nextEp) btns.push(h('button', { class: 'btn primary f', 'data-autofocus': true, onclick: () => playNow(nextEp) }, icon('play'), (nextEp.UserData?.PlaybackPositionTicks ? 'Reprendre ' : 'Lire ') + fmt.epCode(nextEp)));
    else btns.push(h('button', { class: 'btn primary f', 'data-autofocus': true, onclick: async () => {
      const r = await api.req(`/Shows/${it.Id}/Episodes`, { query: { userId: api.user.Id, limit: 1, fields: api.FIELDS } });
      if (r.Items[0]) playNow(r.Items[0], 0); else toast('Aucun épisode');
    } }, icon('play'), it.UserData?.Played ? 'Revoir depuis le début' : 'Lire'));
  } else if (it.Type === 'Episode') {
    btns.push(h('button', { class: 'btn primary f', 'data-autofocus': true, onclick: () => playNow(it) }, icon('play'), resumeT ? 'Reprendre' : 'Lire'));
  } else {
    btns.push(h('button', { class: 'btn primary f', 'data-autofocus': true, onclick: () => playNow(it) }, icon('play'), resumeT ? 'Reprendre à ' + fmt.clock(resumeT / 1e7) : 'Lire'));
    if (resumeT) btns.push(h('button', { class: 'btn f', onclick: () => playNow(it, 0) }, 'Depuis le début'));
  }
  const tid = ytId(it);
  if (tid) btns.push(h('button', { class: 'btn f', onclick: () => trailerModal(tid) }, icon('play'), 'Bande-annonce'));
  if (home) btns.push(h('button', { class: 'btn f', onclick: () => open(it) }, 'Plus d’infos'));
  else if (!isKids()) {
    let fav = !!ud.IsFavorite, seen = !!ud.Played;
    const favB = h('button', { class: 'btn f', 'aria-pressed': String(fav) });
    const seenB = h('button', { class: 'btn f', 'aria-pressed': String(seen) });
    const paint = () => { favB.replaceChildren(icon('heart'), fav ? 'Dans ma liste' : 'Ma liste'); seenB.replaceChildren(icon('check'), seen ? 'Vu' : 'Marquer vu'); };
    favB.onclick = async () => { fav = !fav; paint(); await api.setFavorite(it.Id, fav).catch(() => toast('Échec')); };
    seenB.onclick = async () => { seen = !seen; paint(); await api.setPlayed(it.Id, seen).catch(() => toast('Échec')); };
    paint(); btns.push(favB, seenB);
  }
  if (stack.at(-1)?.params?.surprise) btns.push(h('button', { class: 'btn f', onclick: () => go('surprise', {}, { replace: true }) }, icon('dice'), 'Un autre'));
  const title = it.Type === 'Episode' ? it.SeriesName : it.Name;
  return h('section', { class: 'hero', style: bg ? { backgroundImage: `url("${bg}")` } : null },
    h('div', { class: 'inner' },
      h('div', { class: 'kicker' }, it.Type === 'Series' ? 'Série' : it.Type === 'Episode' ? 'Reprendre · ' + fmt.epCode(it) : (it.Genres || []).slice(0, 2).join(' · ') || 'Film'),
      logo ? h('img', { class: 'logoimg', src: logo, alt: title }) : h('h1', {}, title),
      h('div', { class: 'meta' }, meta.map((m, i) => i === 0 ? h('b', {}, m) : h('span', {}, m))),
      it.Overview ? h('p', {}, it.Overview) : null,
      h('div', { class: 'row-flex', 'data-row': 'hero' }, btns)));
}

function episodeRow(e) {
  const ud = e.UserData || {};
  const src = e.ImageTags?.Primary ? api.img(e.Id, 'Primary', { maxWidth: 440, tag: e.ImageTags.Primary }) : null;
  return h('button', { class: 'ep f', 'data-key': e.Id, onclick: () => playNow(e) },
    h('div', { class: 'thumb' }, src ? h('img', { src, alt: '', loading: 'lazy' }) : null,
      ud.PlayedPercentage > 0 && !ud.Played ? h('div', { class: 'bar', style: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '4px', background: 'rgba(255,255,255,.2)' } }, h('i', { style: { display: 'block', height: '100%', width: ud.PlayedPercentage + '%', background: 'var(--accent)' } })) : null,
      ud.Played ? h('span', { class: 'seen', style: { position: 'absolute', top: '8px', right: '8px', width: '24px', height: '24px', borderRadius: '50%', background: 'var(--accent)', color: '#05070B', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 } }, '✓') : null),
    h('div', {}, h('div', { class: 'kicker' }, `Épisode ${e.IndexNumber ?? '?'}` + (e.RunTimeTicks ? ' · ' + fmt.runtime(e.RunTimeTicks) : '')),
      h('div', { class: 't' }, e.Name), e.Overview ? h('p', {}, e.Overview) : null));
}

async function loadLibs() {
  if (libs.movies || libs.tvshows) return;
  const v = await api.views();
  for (const x of v.Items) { if (x.CollectionType === 'movies' && !libs.movies) libs.movies = x.Id; if (x.CollectionType === 'tvshows' && !libs.tvshows) libs.tvshows = x.Id; }
}

// filtres rapides partagés (Films, Séries, Recherche)
const QUICK = [
  ['nonvu', 'Pas encore vu', (i) => !i.UserData?.Played],
  ['court', 'Moins de 1 h 30', (i) => i.Type === 'Series' || (i.RunTimeTicks && i.RunTimeTicks < 90 * 6e8)],
  ['famille', 'En famille', (i) => (i.Genres || []).some((g) => KID_GENRES.includes(g))],
  ['uhd', '4K', (i) => fmt.is4k(i)]
];
function chipsBar(active, onChange, types) {
  return QUICK.filter(([k]) => !(k === 'court' && types === 'Series')).map(([k, label]) => h('button', { class: 'chip f' + (active[k] ? ' on' : ''), 'aria-pressed': String(!!active[k]),
    onclick: () => { active[k] = !active[k]; onChange(); } }, label));
}
const applyQuick = (list, active) => list.filter((i) => QUICK.every(([k, , fn]) => !active[k] || fn(i)));

async function libraryGrid(type, label) {
  await loadLibs();
  const st = stack.at(-1).params;
  st.sort = st.sort || 'DateCreated'; st.q = st.q || {};
  const all = await api.items({ recursive: true, includeItemTypes: type, parentId: type === 'Movie' ? libs.movies : libs.tvshows, sortBy: st.sort === 'DateCreated' ? 'DateCreated,SortName' : st.sort,
    sortOrder: st.sort === 'SortName' ? 'Ascending' : 'Descending', fields: 'Genres,Width,ChildCount', enableImageTypes: 'Primary' });
  const grid = h('div', { class: 'grid', 'data-row': 'g' });
  const count = h('span', { class: 'muted' });
  const bar = h('div', { class: 'toolbar', 'data-row': 'tools' });
  let list = [], shown = 0;
  const sentinel = h('div', { style: { height: '1px' } });
  const more = () => { const chunk = list.slice(shown, shown + 120); shown += chunk.length; grid.append(...chunk.map((i) => posterCard(i, open))); };
  const io = new IntersectionObserver((e) => { if (e[0].isIntersecting && shown < list.length) more(); }, { root: view, rootMargin: '800px' });
  const redraw = () => {
    list = applyQuick(all.Items, st.q); shown = 0; grid.replaceChildren(); more();
    count.textContent = list.length + ' ' + label.toLowerCase();
    const sel = h('select', { class: 'f', 'aria-label': 'Trier', onchange: (e) => { st.sort = e.target.value; render(); } },
      [['DateCreated', 'Ajout récent'], ['SortName', 'A → Z'], ['PremiereDate', 'Année de sortie'], ['CommunityRating', 'Mieux notés']].map(([v, l]) => h('option', { value: v, selected: st.sort === v }, l)));
    bar.replaceChildren(sel, ...chipsBar(st.q, redraw, type), count);
  };
  redraw();
  const page = h('div', { class: 'page' }, h('div', { class: 'kicker' }, 'Bibliothèque'), h('h1', {}, label), bar, grid, sentinel);
  requestAnimationFrame(() => io.observe(sentinel));
  return page;
}

async function kidsHome() {
  await loadLibs();
  const r = await api.items({ recursive: true, includeItemTypes: 'Movie,Series', genres: KID_GENRES.join('|'), sortBy: 'Random', limit: 120 });
  const items = r.Items.filter(kidSafe);
  return h('div', { class: 'page', style: { '--accent': '#B6FF3C' } }, h('div', { class: 'kicker', style: { color: '#B6FF3C' } }, 'Profil Enfants'), h('h1', {}, 'Salut ! On regarde quoi ?'),
    items.length ? h('div', { class: 'grid', style: { gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))' }, 'data-row': 'k' }, items.map((i) => posterCard(i, open)))
      : h('div', { class: 'empty' }, h('b', {}, 'Rien pour l’instant'), 'Aucun titre classé Animation ou Familial.'));
}

// ---------- recherche (+ voix, filtres, demandes Seerr) ----------
async function searchScreen() {
  const st = stack.at(-1).params; st.q = st.q || {};
  const inp = h('input', { class: 'input f', id: 'q', value: st.text || '', placeholder: 'Titre, acteur, genre…', autocomplete: 'off', 'data-autofocus': true, 'aria-label': 'Rechercher' });
  const results = h('div');
  const chips = h('div', { class: 'toolbar', 'data-row': 'chips' });
  let raw = [], t;
  const draw = () => {
    chips.replaceChildren(...chipsBar(st.q, draw));
    const list = applyQuick(raw, st.q);
    results.replaceChildren(
      list.length ? h('div', { class: 'grid', 'data-row': 'res' }, list.map((i) => posterCard(i, open)))
        : (st.text ? h('div', { class: 'empty' }, h('b', {}, 'Rien dans ta bibliothèque'), (Object.values(st.q).some(Boolean) ? 'Essaie en retirant un filtre.' : '')) : null),
      seerrRow);
  };
  let seerrRow = h('div');
  const run = async () => {
    st.text = inp.value.trim();
    if (st.text.length < 2) { raw = []; seerrRow = h('div'); draw(); return; }
    const q = st.text;
    const r = await api.items({ recursive: true, searchTerm: q, includeItemTypes: 'Movie,Series', limit: 60 }).catch(() => ({ Items: [] }));
    if (q !== st.text) return;
    raw = kf(r.Items);
    seerrRow = !isKids() && seerr.base ? await seerrSuggestions(q, raw) : h('div');
    if (q !== st.text) return;
    draw();
  };
  inp.addEventListener('input', () => { clearTimeout(t); t = setTimeout(run, 350); });
  inp.addEventListener('submit-input', () => { clearTimeout(t); run(); });

  // voix : micro de la télécommande (appli TV) ou micro du PC (Chrome/Edge)
  const SR = native ? null : (window.SpeechRecognition || window.webkitSpeechRecognition);
  let mic = null;
  if (native?.startVoice || SR) {
    mic = h('button', { class: 'mic f', 'aria-label': 'Recherche vocale', onclick: () => listen() }, icon('mic'));
  }
  function gotText(txt) { mic?.classList.remove('on'); if (!txt) return; inp.value = txt; run(); }
  function listen() {
    mic.classList.add('on'); toast('J’écoute…');
    if (native?.startVoice) { window.onAppVoice = gotText; native.startVoice(); return; }
    const rec = new SR(); rec.lang = 'fr-FR'; rec.interimResults = false; rec.maxAlternatives = 1;
    rec.onresult = (e) => gotText(e.results[0][0].transcript);
    rec.onerror = () => { mic.classList.remove('on'); toast('Micro indisponible'); };
    rec.onend = () => mic.classList.remove('on');
    rec.start();
  }
  draw();
  if (st.text) run();
  if (st.voice && mic) { st.voice = false; setTimeout(listen, 400); }
  return h('div', { class: 'page' }, h('div', { class: 'kicker' }, 'Recherche'), h('h1', {}, 'Qu’est-ce qu’on regarde ?'),
    h('div', { class: 'searchbar', 'data-row': 'sb' }, inp, mic), chips, results);
}

async function seerrSuggestions(q, local) {
  if (!seerr.me && !(await seerr.check())) {
    return h('section', { class: 'shelf', style: { margin: '30px 0 0' } }, h('h2', { style: { padding: 0 } }, 'Pas dans ta bibliothèque ?'),
      h('div', { class: 'row-flex', style: { marginTop: '12px' } }, h('span', { class: 'muted' }, 'Connecte-toi aux demandes pour voir ce que tu peux demander.'),
        h('button', { class: 'btn small f', onclick: () => seerrLoginModal(() => render()) }, 'Se connecter')));
  }
  let r;
  try { r = await seerr.search(q); } catch { return h('div'); }
  const names = new Set(local.map((i) => (i.Name || '').toLowerCase()));
  const res = (r.results || []).filter((x) => (x.mediaType === 'movie' || x.mediaType === 'tv') && x.mediaInfo?.status !== 5 && !names.has((x.title || x.name || '').toLowerCase())).slice(0, 18);
  if (!res.length) return h('div');
  return h('section', { class: 'shelf', style: { marginLeft: 'calc(-1 * var(--pad))', marginRight: 'calc(-1 * var(--pad))' } },
    h('h2', {}, 'Pas dans ta bibliothèque'),
    h('div', { class: 'track', 'data-row': 'seerr' }, res.map((x) => seerrCard(x))));
}
function seerrCard(x) {
  const title = x.title || x.name;
  const year = (x.releaseDate || x.firstAirDate || '').slice(0, 4);
  const status = seerr.mediaStatus(x.mediaInfo?.status);
  const src = seerr.poster(x.posterPath);
  return h('button', { class: 'card poster f', 'data-key': 's' + x.id, 'aria-label': `${title} ${year}, ${status || 'à demander'}`, onclick: () => requestModal(x) },
    h('div', { class: 'ph' }, title), src ? h('img', { src, alt: '', loading: 'lazy' }) : null,
    h('div', { class: 'cap' }, title, h('small', {}, [x.mediaType === 'tv' ? 'Série' : 'Film', year, status].filter(Boolean).join(' · '))));
}

function modal(content, onClose) {
  const m = h('div', { class: 'modal', onclick: (e) => { if (e.target === m) close(); } }, h('div', { class: 'box', role: 'dialog', 'aria-modal': 'true' }, content));
  const prev = document.activeElement;
  const off = nav.push(({ action }) => { if (action === 'back') { close(); return true; } return false; });
  function close() { off(); m.remove(); onClose?.(); if (prev && document.contains(prev)) nav.focus(prev); }
  document.body.append(m);
  requestAnimationFrame(() => nav.first(m));
  return close;
}

function seerrLoginModal(done) {
  const u = h('input', { class: 'input f', value: api.user?.Name || '', autocomplete: 'username', 'aria-label': 'Nom d’utilisateur' });
  const p = h('input', { class: 'input f', type: 'password', autocomplete: 'current-password', 'aria-label': 'Mot de passe', 'data-autofocus': true });
  const err = h('div', { class: 'err', role: 'alert' });
  const submit = async () => { err.textContent = ''; try { await seerr.login(u.value.trim(), p.value); p.value = ''; close(); toast('Connecté aux demandes'); done?.(); } catch { err.textContent = 'Connexion refusée.'; } };
  p.addEventListener('submit-input', submit);
  const close = modal([h('h2', {}, 'Demandes'), h('div', { class: 'muted', style: { textAlign: 'center' } }, 'Même identifiant et mot de passe que Jellyfin.'),
    h('div', { class: 'field' }, u), h('div', { class: 'field' }, p), err, h('button', { class: 'btn primary f', onclick: submit }, 'Se connecter')]);
}

async function requestModal(x) {
  const title = x.title || x.name;
  const box = h('div', { style: { display: 'flex', flexDirection: 'column', gap: '16px', alignItems: 'center', width: '100%' } });
  const close = modal(box);
  const status = x.mediaInfo?.status;
  const head = [h('h2', { style: { textAlign: 'center' } }, title), x.overview ? h('div', { class: 'muted', style: { fontSize: '14px', lineHeight: 1.45, maxHeight: '120px', overflow: 'auto' } }, x.overview) : null];
  if (status && status >= 2 && status <= 3) { box.append(...head, h('div', {}, 'Déjà demandé : ' + seerr.mediaStatus(status)), h('button', { class: 'btn f', onclick: close }, 'Fermer')); nav.first(box); return; }
  if (x.mediaType === 'movie') {
    box.append(...head, h('div', { class: 'row-flex' }, h('button', { class: 'btn primary f', 'data-autofocus': true, onclick: async () => {
      try { await seerr.request('movie', x.id); close(); toast('Demande envoyée : ' + title); } catch (e) { toast(e.message || 'Demande refusée'); }
    } }, 'Demander ce film'), h('button', { class: 'btn f', onclick: close }, 'Annuler')));
  } else {
    let tv; try { tv = await seerr.tv(x.id); } catch { toast('Série introuvable'); close(); return; }
    const avail = new Set((tv.mediaInfo?.seasons || []).filter((s) => s.status >= 2).map((s) => s.seasonNumber));
    const seasons = (tv.seasons || []).filter((s) => s.seasonNumber > 0);
    const pick = new Set(seasons.filter((s) => !avail.has(s.seasonNumber)).map((s) => s.seasonNumber));
    const grid = h('div', { class: 'row-flex', style: { justifyContent: 'center' } });
    const paint = () => grid.replaceChildren(...seasons.map((s) => {
      const done = avail.has(s.seasonNumber);
      return h('button', { class: 'chip f' + (pick.has(s.seasonNumber) ? ' on' : ''), disabled: done, 'aria-pressed': String(pick.has(s.seasonNumber)),
        onclick: () => { pick.has(s.seasonNumber) ? pick.delete(s.seasonNumber) : pick.add(s.seasonNumber); paint(); } }, `Saison ${s.seasonNumber}` + (done ? ' ✓' : ''));
    }));
    paint();
    box.append(...head, h('div', { class: 'kicker' }, 'Saisons à demander'), grid, h('div', { class: 'row-flex' }, h('button', { class: 'btn primary f', onclick: async () => {
      if (!pick.size) { toast('Choisis au moins une saison'); return; }
      try { await seerr.request('tv', x.id, [...pick].sort((a, b) => a - b)); close(); toast('Demande envoyée : ' + title); } catch (e) { toast(e.message || 'Demande refusée'); }
    } }, 'Demander'), h('button', { class: 'btn f', onclick: close }, 'Annuler')));
  }
  nav.first(box);
}

async function requestsScreen() {
  const page = h('div', { class: 'page' }, h('div', { class: 'kicker' }, 'Demandes'), h('h1', {}, 'Mes demandes'));
  if (!seerr.me && !(await seerr.check())) {
    page.append(h('div', { class: 'empty' }, h('b', {}, 'Pas connecté'), 'Connecte-toi avec ton compte Jellyfin pour voir et faire des demandes. ',
      h('div', { style: { marginTop: '16px' } }, h('button', { class: 'btn primary f', 'data-autofocus': true, onclick: () => seerrLoginModal(() => render()) }, 'Se connecter'))));
    return page;
  }
  const r = await seerr.myRequests();
  const rows = await Promise.all((r.results || []).map(async (q) => {
    const m = q.media || {};
    let info = {}; try { info = m.mediaType === 'tv' ? await seerr.tv(m.tmdbId) : await seerr.movie(m.tmdbId); } catch {}
    const title = info.title || info.name || ('TMDB ' + m.tmdbId);
    const st = seerr.requestStatus(q);
    const color = st === 'Disponible' ? 'var(--ok)' : st === 'Refusée' ? 'var(--bad)' : 'var(--fg2)';
    return h('div', { class: 'li' }, h('div', {}, h('b', {}, title), h('div', { class: 'muted', style: { fontSize: '13px', marginTop: '4px' } },
      [m.mediaType === 'tv' ? 'Série' : 'Film', q.seasons?.length ? 'saisons ' + q.seasons.map((s) => s.seasonNumber).join(', ') : '', 'demandé le ' + new Date(q.createdAt).toLocaleDateString('fr-FR')].filter(Boolean).join(' · '))),
      h('span', { style: { color, fontWeight: 600 } }, st));
  }));
  if (seerr.canManage) {
    const pend = await seerr.pending().catch(() => ({ results: [] }));
    const prow = await Promise.all((pend.results || []).map(async (q) => {
      const m = q.media || {};
      let info = {}; try { info = m.mediaType === 'tv' ? await seerr.tv(m.tmdbId) : await seerr.movie(m.tmdbId); } catch {}
      const title = info.title || info.name || ('TMDB ' + m.tmdbId);
      const act = (fn, msg) => async () => { try { await fn(q.id); toast(msg + ' : ' + title); render(); } catch (e) { toast(e.message || 'Échec'); } };
      return h('div', { class: 'li' }, h('div', {}, h('b', {}, title), h('div', { class: 'muted', style: { fontSize: '13px', marginTop: '4px' } },
        [m.mediaType === 'tv' ? 'Série' : 'Film', q.seasons?.length ? 'saisons ' + q.seasons.map((x) => x.seasonNumber).join(', ') : '', 'par ' + (q.requestedBy?.displayName || '?'), new Date(q.createdAt).toLocaleDateString('fr-FR')].filter(Boolean).join(' · '))),
        h('div', { class: 'acts' }, h('button', { class: 'btn small primary f', onclick: act((id) => seerr.approve(id), 'Validée') }, 'Valider'), h('button', { class: 'btn small f', onclick: act((id) => seerr.decline(id), 'Refusée') }, 'Refuser')));
    }));
    page.append(h('h2', { style: { marginTop: '26px' } }, 'À valider (' + prow.length + ')'), prow.length ? h('div', { class: 'list', 'data-row': 'pending' }, prow) : h('div', { class: 'muted', style: { marginTop: '10px' } }, 'Aucune demande en attente.'),
      h('h2', { style: { marginTop: '30px' } }, 'Mes demandes'));
  }
  page.append(h('div', { class: 'toolbar' }, h('button', { class: 'btn small f', onclick: () => go('search') }, icon('search'), 'Chercher un titre à demander'), h('span', { class: 'muted' }, 'Connecté en tant que ' + (seerr.me.displayName || seerr.me.jellyfinUsername || ''))),
    rows.length ? h('div', { class: 'list' }, rows) : h('div', { class: 'empty' }, h('b', {}, 'Aucune demande'), 'Cherche un titre : s’il n’est pas sur le serveur, tu pourras le demander.'));
  return page;
}

// ---------- Tableau de bord (administrateur) ----------
async function serverScreen() {
  if (!api.isAdmin) return h('div', { class: 'page' }, h('div', { class: 'empty' }, h('b', {}, 'Réservé à l\u2019administrateur'), ''));
  const st = stack.at(-1).params; st.tab = st.tab || 'apercu';
  const tabs = [['apercu', 'Aperçu'], ['biblio', 'Bibliothèques'], ['taches', 'Tâches'], ['users', 'Utilisateurs'], ['appareils', 'Appareils'], ['plugins', 'Extensions'], ['reglages', 'Réglages appli']];
  const body = h('div');
  const page = h('div', { class: 'page' }, h('div', { class: 'kicker' }, 'Réservé à ' + api.user.Name), h('h1', {}, 'Tableau de bord'),
    h('div', { class: 'tabs', 'data-row': 'tabs' }, tabs.map(([k, l]) => h('button', { class: 'chip f' + (st.tab === k ? ' on' : ''), 'data-key': 'tab-' + k, onclick: () => { st.tab = k; render(); } }, l))),
    body);
  const stat = (k, v, d, c) => h('div', { class: 'stat' }, h('div', { class: 'k' }, k), h('div', { class: 'v', style: c ? { color: c } : null }, v), h('div', { class: 'muted', style: { fontSize: '13px' } }, d));
  const when = (d) => d ? new Date(d).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—';
  const T = st.tab;

  if (T === 'apercu') {
    const [info, sessions, tasks, counts, act] = await Promise.all([api.systemInfo(), api.sessions(), api.tasks(), api.counts(), api.activity().catch(() => ({ Items: [] }))]);
    const watching = sessions.filter((s) => s.NowPlayingItem);
    const running = tasks.filter((t) => t.State === 'Running');
    const failed = tasks.filter((t) => t.LastExecutionResult?.Status === 'Failed');
    body.append(h('div', { class: 'stats' },
      stat('Jellyfin', info.Version, info.ServerName + (info.HasPendingRestart ? ' · redémarrage en attente' : ''), 'var(--ok)'),
      stat('En lecture', String(watching.length), watching.length ? watching.map((s) => s.UserName).join(', ') : 'Personne en ce moment'),
      stat('Bibliothèque', `${counts.MovieCount} films`, `${counts.SeriesCount} séries · ${counts.EpisodeCount} épisodes`),
      stat('Tâches', failed.length ? failed.length + ' en échec' : 'OK', running.length ? 'En cours : ' + running.map((t) => t.Name).join(', ') : 'Rien en cours', failed.length ? 'var(--bad)' : 'var(--ok)')),
      h('div', { class: 'two' },
        h('section', {}, h('h2', {}, 'Qui regarde'), h('div', { class: 'list' }, watching.length ? watching.map((s) => h('div', { class: 'li' },
          h('div', {}, h('b', {}, s.UserName), h('div', { class: 'muted', style: { fontSize: '13px', marginTop: '4px' } }, (s.NowPlayingItem.SeriesName ? s.NowPlayingItem.SeriesName + ' · ' : '') + s.NowPlayingItem.Name)),
          h('span', { class: 'muted' }, s.DeviceName + (s.PlayState?.PlayMethod === 'Transcode' ? ' · conversion' : ' · direct')))) : h('div', { class: 'li muted' }, 'Personne'))),
        h('section', {}, h('h2', {}, 'Activité récente'), h('div', { class: 'list' }, (act.Items || []).slice(0, 10).map((a) => h('div', { class: 'li' },
          h('span', {}, a.Name), h('span', { class: 'muted', style: { whiteSpace: 'nowrap' } }, when(a.Date))))))),
      native ? null : h('div', { class: 'toolbar' }, h('a', { class: 'btn f', href: api.base + '/web/#/dashboard', target: '_blank', rel: 'noopener' }, 'Tableau de bord Jellyfin complet'),
        CFG.homepage ? h('a', { class: 'btn f', href: CFG.homepage, target: '_blank', rel: 'noopener' }, icon('server'), 'Mes services') : null));
  }

  if (T === 'biblio') {
    const [vf, counts, tasks] = await Promise.all([api.virtualFolders(), api.counts(), api.tasks()]);
    const scan = tasks.find((t) => t.Key === 'RefreshLibrary');
    body.append(h('div', { class: 'muted', style: { marginTop: '18px', lineHeight: 1.5 } },
      'L\u2019analyse cherche les nouveaux fichiers, retire ceux qui ont disparu et complète les infos manquantes. Elle tourne déjà toute seule toutes les 15 minutes. ',
      scan?.LastExecutionResult ? 'Dernière analyse complète : ' + when(scan.LastExecutionResult.EndTimeUtc) + '.' : ''),
      h('div', { class: 'list', style: { marginTop: '18px' } },
        h('div', { class: 'li' }, h('div', {}, h('b', {}, 'Tout'), h('div', { class: 'muted', style: { fontSize: '13px', marginTop: '4px' } }, 'Films et séries')),
          h('div', { class: 'acts' }, h('button', { class: 'btn small f', onclick: () => confirmModal('Analyser toutes les bibliothèques ?', async () => { await api.refreshLibrary(); toast('Analyse complète lancée'); }) }, icon('refresh'), 'Analyser'))),
        vf.map((v) => h('div', { class: 'li' },
          h('div', {}, h('b', {}, v.Name), h('div', { class: 'muted', style: { fontSize: '13px', marginTop: '4px' } },
            (v.CollectionType === 'movies' ? counts.MovieCount + ' films' : v.CollectionType === 'tvshows' ? counts.SeriesCount + ' séries' : v.CollectionType || '') + ' · ' + (v.Locations || []).join(', ') + (v.RefreshStatus === 'Active' ? ' · analyse en cours' : ''))),
          h('div', { class: 'acts' }, h('button', { class: 'btn small f', onclick: () => confirmModal('Analyser seulement « ' + v.Name + ' » ?', async () => { await api.refreshItem(v.ItemId); toast('Analyse de ' + v.Name + ' lancée'); }) }, icon('refresh'), 'Analyser'))))));
  }

  if (T === 'taches') {
    const tasks = (await api.tasks()).sort((a, b) => a.Category.localeCompare(b.Category) || a.Name.localeCompare(b.Name));
    body.append(h('div', { class: 'list', style: { marginTop: '18px' } }, tasks.map((t) => {
      const r = t.LastExecutionResult;
      const tag = t.State === 'Running' ? h('span', { class: 'tag' }, 'en cours ' + Math.round(t.CurrentProgressPercentage || 0) + ' %')
        : r ? h('span', { class: 'tag ' + (r.Status === 'Completed' ? 'ok' : r.Status === 'Failed' ? 'bad' : '') }, r.Status === 'Completed' ? 'OK' : r.Status === 'Failed' ? 'échec' : r.Status) : h('span', { class: 'tag' }, 'jamais lancée');
      return h('div', { class: 'li' }, h('div', {}, h('b', {}, t.Name), h('div', { class: 'muted', style: { fontSize: '13px', marginTop: '4px' } }, t.Category + ' · dernière : ' + when(r?.EndTimeUtc))),
        h('div', { class: 'acts' }, tag, t.State !== 'Running' ? h('button', { class: 'btn small f', onclick: () => confirmModal('Lancer « ' + t.Name + ' » maintenant ?', async () => { await api.runTask(t.Id); toast('Tâche lancée'); setTimeout(() => render(), 1500); }) }, 'Lancer') : null));
    })));
  }

  if (T === 'users') {
    const users = (await api.users()).sort((a, b) => a.Name.localeCompare(b.Name));
    body.append(h('div', { class: 'muted', style: { marginTop: '18px' } }, 'Pour créer un compte ou changer un mot de passe, passe par le tableau de bord Jellyfin.'),
      h('div', { class: 'list', style: { marginTop: '14px' } }, users.map((u) => {
        const off = u.Policy.IsDisabled;
        return h('div', { class: 'li' }, h('div', {}, h('b', {}, u.Name), h('div', { class: 'muted', style: { fontSize: '13px', marginTop: '4px' } }, 'Dernière activité : ' + when(u.LastActivityDate))),
          h('div', { class: 'acts' }, u.Policy.IsAdministrator ? h('span', { class: 'tag ok' }, 'admin') : null, off ? h('span', { class: 'tag bad' }, 'désactivé') : null,
            u.Id !== api.user.Id ? h('button', { class: 'btn small f', onclick: () => confirmModal((off ? 'Réactiver ' : 'Désactiver ') + u.Name + ' ?', async () => { await api.setUserDisabled(u.Id, !off); toast(u.Name + (off ? ' réactivé' : ' désactivé')); render(); }) }, off ? 'Réactiver' : 'Désactiver') : null));
      })));
  }

  if (T === 'appareils') {
    const d = await api.devices();
    body.append(h('div', { class: 'list', style: { marginTop: '18px' } }, (d.Items || []).sort((a, b) => (b.DateLastActivity || '').localeCompare(a.DateLastActivity || '')).map((x) => h('div', { class: 'li' },
      h('div', {}, h('b', {}, x.Name), h('div', { class: 'muted', style: { fontSize: '13px', marginTop: '4px' } }, x.AppName + ' ' + (x.AppVersion || '') + ' · ' + (x.LastUserName || ''))),
      h('span', { class: 'muted' }, when(x.DateLastActivity))))));
  }

  if (T === 'plugins') {
    const pl = await api.plugins();
    body.append(h('div', { class: 'list', style: { marginTop: '18px' } }, pl.map((x) => h('div', { class: 'li' },
      h('div', {}, h('b', {}, x.Name), h('div', { class: 'muted', style: { fontSize: '13px', marginTop: '4px' } }, 'version ' + x.Version)),
      h('span', { class: 'tag ' + (x.Status === 'Active' ? 'ok' : 'bad') }, x.Status === 'Active' ? 'actif' : x.Status)))));
  }

  if (T === 'reglages') body.append(h('div', { class: 'two' }, kidsSettings(), playerSettings()));
  return page;
}

function kidsSettings() {
  const cfg = kidsCfg();
  const box = h('section', {}, h('h2', {}, 'Profil Enfants'));
  const body = h('div', { class: 'list' });
  box.append(body);
  (async () => {
    const users = await api.req('/Users').catch(() => []);
    const sel = h('select', { class: 'f input', style: { height: '48px', fontSize: '16px' }, 'aria-label': 'Compte utilisé pour le profil Enfants' },
      h('option', { value: '' }, '— Aucun —'), users.filter((u) => !u.Policy.IsAdministrator).map((u) => h('option', { value: u.Id, selected: cfg?.userId === u.Id }, u.Name)));
    const pin = h('input', { class: 'input f', inputmode: 'numeric', maxlength: 4, placeholder: 'Code à 4 chiffres', 'aria-label': 'Code parental' });
    body.append(h('div', { class: 'muted', style: { fontSize: '14px', lineHeight: 1.5 } }, 'Sur cet appareil, ce compte n’affiche que l’animation et les films familiaux, et sortir du profil demande le code. Pour un blocage complet, règle aussi le contrôle parental du compte dans Jellyfin.'),
      sel, pin, h('button', { class: 'btn primary f', onclick: () => {
        if (!sel.value) { LS.del('kids'); toast('Profil Enfants désactivé'); return; }
        if (!/^\d{4}$/.test(pin.value) && !cfg?.pin) { toast('Choisis un code à 4 chiffres'); return; }
        LS.set('kids', { userId: sel.value, pin: /^\d{4}$/.test(pin.value) ? hashPin(pin.value) : cfg.pin }); pin.value = ''; toast('Profil Enfants enregistré sur cet appareil');
      } }, 'Enregistrer'));
  })();
  return box;
}
function playerSettings() {
  const p = LS.get('playerPrefs', { autoNext: true, autoSkip: false });
  const delay = LS.get('saverMin', 5);
  const tog = (k, label) => h('button', { class: 'chip f' + (p[k] ? ' on' : ''), 'aria-pressed': String(!!p[k]), onclick: (e) => { p[k] = !p[k]; LS.set('playerPrefs', p); e.currentTarget.classList.toggle('on', p[k]); e.currentTarget.setAttribute('aria-pressed', String(p[k])); } }, label);
  return h('section', {}, h('h2', {}, 'Lecture et veille'), h('div', { class: 'list' },
    h('div', { class: 'row-flex' }, tog('autoNext', 'Épisode suivant automatique'), tog('autoSkip', 'Sauter le générique sans demander')),
    native?.request ? seerrSetting() : null,
    h('div', { class: 'row-flex' }, h('button', { class: 'chip f' + (LS.get('bannerTrailers', true) ? ' on' : ''), onclick: (e) => { const v = !LS.get('bannerTrailers', true); LS.set('bannerTrailers', v); e.currentTarget.classList.toggle('on', v); } }, 'Bandes-annonces dans la bannière')),
    h('div', { class: 'row-flex' }, h('span', { class: 'muted' }, 'Écran de veille après'),
      h('select', { class: 'f input', style: { height: '44px', width: 'auto' }, onchange: (e) => { LS.set('saverMin', Number(e.target.value)); toast('Enregistré'); } },
        [2, 5, 10, 20, 0].map((m) => h('option', { value: m, selected: delay === m }, m ? m + ' min' : 'jamais'))))));
}

// appli Android : adresse de Seerr (optionnelle) pour les demandes
function seerrSetting() {
  const inp = h('input', { class: 'input f', value: LS.get('seerrUrl', ''), placeholder: 'http://192.168.x.x:5055', 'aria-label': 'Adresse de Seerr', inputmode: 'url' });
  const save = () => { const v = inp.value.trim(); LS.set('seerrUrl', v); seerr.me = null; toast(v ? 'Seerr enregistré' : 'Demandes désactivées'); drawRail(stack.at(-1).name); };
  inp.addEventListener('submit-input', save);
  return h('div', { class: 'field', style: { width: '100%' } }, h('label', {}, 'Demandes : adresse de Seerr (optionnel)'), h('div', { class: 'row-flex', style: { flexWrap: 'nowrap' } }, inp, h('button', { class: 'btn small f', onclick: save }, 'Enregistrer')));
}

async function meScreen() {
  const st = h('div', { class: 'row-flex', 'data-row': 'me' },
    h('button', { class: 'btn primary f', 'data-autofocus': true, onclick: () => { stack.length = 0; go('profiles'); } }, 'Changer de profil'),
    h('button', { class: 'btn f', onclick: () => confirmModal('Se déconnecter de ce profil sur cet appareil ?', async () => { await seerr.logout(); await api.logout(); stack.length = 0; go('profiles'); }) }, icon('out'), 'Se déconnecter'));
  return h('div', { class: 'page' }, h('div', { class: 'kicker' }, 'Profil'), h('h1', {}, api.user.Name), h('div', { style: { marginTop: '24px' } }, st),
    !api.isAdmin ? h('div', { style: { marginTop: '30px' } }, playerSettings()) : null,
    h('div', { style: { marginTop: '30px' } }, h('button', { class: 'btn small f', onclick: () => go('setup') }, 'Adresses du serveur')),
    h('div', { class: 'muted', style: { marginTop: '30px', fontSize: '13px' } }, CFG.appName + ' ' + CFG.version + ' · serveur ' + api.base));
}

function confirmModal(text, action) {
  const close = modal([h('div', { style: { fontSize: '18px', textAlign: 'center', lineHeight: 1.4 } }, text),
    h('div', { class: 'row-flex' }, h('button', { class: 'btn primary f', 'data-autofocus': true, onclick: async () => { close(); try { await action(); } catch { toast('Échec'); } } }, 'Oui'), h('button', { class: 'btn f', onclick: () => close() }, 'Non'))]);
}

function askPin(onOk) {
  const cfg = kidsCfg(); let code = '';
  const dots = h('div', { class: 'pins' }); const msg = h('div', { class: 'err', role: 'status' });
  const paint = () => dots.replaceChildren(...[0, 1, 2, 3].map((i) => h('i', { class: i < code.length ? 'on' : '' })));
  const press = (k) => {
    if (k === 'x') return close(); if (k === '<') { code = code.slice(0, -1); paint(); return; }
    code += k; paint();
    if (code.length === 4) { if (hashPin(code) === cfg?.pin) { close(); onOk(); } else { code = ''; paint(); msg.textContent = 'Code incorrect'; } }
  };
  paint();
  const close = modal([h('h2', {}, 'Code parental'), dots, msg,
    h('div', { class: 'pad' }, ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'x', '0', '<'].map((k) => h('button', { class: 'f', 'aria-label': k === 'x' ? 'Annuler' : k === '<' ? 'Effacer' : k, onclick: () => press(k) }, k === 'x' ? '✕' : k === '<' ? '⌫' : k)))]);
  const off = nav.push(({ e }) => { if (e && /^\d$/.test(e.key) && document.querySelector('.modal')) { press(e.key); return true; } return false; });
  const m = document.querySelector('.modal:last-of-type'); new MutationObserver((_, o) => { if (!document.contains(m)) { off(); o.disconnect(); } }).observe(document.body, { childList: true });
}

// ---------- écran de veille ----------
let idleT = null, saver = null;
function armSaver() {
  clearTimeout(idleT);
  const min = LS.get('saverMin', 5);
  if (!min || !api.user || document.querySelector('.player')) return;
  idleT = setTimeout(startSaver, min * 60000);
}
async function startSaver() {
  if (saver || document.querySelector('.player') || !api.user) return;
  let items = [];
  try { items = (await api.items({ recursive: true, includeItemTypes: 'Movie,Series', sortBy: 'Random', limit: 30, imageTypes: 'Backdrop', enableImageTypes: 'Backdrop' })).Items.filter((i) => i.BackdropImageTags?.length); } catch {}
  items = kf(items);
  if (!items.length) return;
  const clockB = h('b'), clockS = h('span');
  const tt = h('div', { class: 'tt' });
  const bgs = items.slice(0, 12).map((i) => h('div', { class: 'bg', style: { backgroundImage: `url("${backdropUrl(i)}")` } }));
  saver = h('div', { class: 'saver', 'aria-hidden': 'true' }, ...bgs, h('div', { class: 'shade' }), h('div', { class: 'clock' }, clockB, clockS), tt);
  document.body.append(saver);
  let k = 0;
  const step = () => {
    bgs.forEach((b, j) => b.classList.toggle('on', j === k));
    const it = items[k];
    tt.replaceChildren(h('div', { class: 'kicker' }, it.Type === 'Series' ? 'Série' : 'Film'), h('h1', {}, it.Name));
    const d = new Date(); clockB.textContent = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    clockS.textContent = d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
    k = (k + 1) % bgs.length;
  };
  step();
  const iv = setInterval(step, 8000);
  const stop = (e) => { e?.preventDefault?.(); clearInterval(iv); saver?.remove(); saver = null; off(); window.removeEventListener('mousedown', stop, true); armSaver(); return true; };
  const off = nav.push(() => stop());
  window.addEventListener('mousedown', stop, true);
}
['keydown', 'mousemove', 'mousedown', 'wheel', 'touchstart'].forEach((ev) => window.addEventListener(ev, () => { if (!saver) armSaver(); }, { passive: true }));

// ---------- démarrage ----------
async function afterLogin() {
  libs = { movies: null, tvshows: null };
  stack.length = 0;
  armSaver();
  if (seerr.base) seerr.check();
  go('home');
}
nav.init();
nav.push(({ action }) => { if (action === 'back') { back(); return true; } return false; });
window.appBack = () => back(); // appelé par l'appli Android TV (touche Retour)
window.appVoiceKey = () => { if (!api.user || document.querySelector('.player')) return; stack.length = 0; go('search', { voice: true }); }; // touche micro de la télécommande
if (new URLSearchParams(location.search).has('debug')) window.__cp = { api, go, afterLogin, seerr }; // aide aux tests

(async () => {
  if (!LS.get('server', '')) return go('setup');
  await api.pickServer();
  const last = LS.get('last');
  if (last && await api.resume(last)) return afterLogin();
  go('profiles');
})();
