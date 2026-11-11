// Lecteur : lecture directe quand l'appareil sait lire le fichier, sinon Jellyfin convertit (HLS).
// Gère « Passer le générique » (segments Intro Skipper) et l'épisode suivant automatique.
import { api, LS } from './api.js';
import { h, icon, fmt, toast } from './ui.js';
import { nav } from './nav.js';

function canMSE(type) { try { return !!(window.MediaSource && MediaSource.isTypeSupported(type)); } catch { return false; } }
function canTag(type) { const v = document.createElement('video'); return !!v.canPlayType(type).replace('no', ''); }
function can(type) { return canMSE(type) || canTag(type); }

function buildProfile() {
  const v = [], a = ['aac', 'mp3'];
  if (can('video/mp4; codecs="avc1.640029"')) v.push('h264');
  if (can('video/mp4; codecs="hvc1.1.6.L150.B0"') || can('video/mp4; codecs="hev1.1.6.L150.B0"')) v.push('hevc');
  if (can('video/webm; codecs="vp9"') || can('video/mp4; codecs="vp09.00.10.08"')) v.push('vp9');
  if (can('video/mp4; codecs="av01.0.08M.08"')) v.push('av1');
  if (can('audio/mp4; codecs="opus"') || can('audio/webm; codecs="opus"')) a.push('opus');
  if (can('audio/mp4; codecs="flac"') || can('audio/flac')) a.push('flac');
  if (can('audio/mp4; codecs="ac-3"')) a.push('ac3');
  if (can('audio/mp4; codecs="ec-3"')) a.push('eac3');
  a.push('vorbis');
  const native = !!window.AppNative; // la WebView Android lit aussi le MKV
  const containers = ['mp4', 'm4v', 'mov', 'webm'].concat(native ? ['mkv', 'matroska'] : []);
  const hlsV = v.filter((c) => c === 'h264' || c === 'hevc').join(',') || 'h264';
  return {
    Name: 'web-tv-client', MaxStreamingBitrate: 120000000, MaxStaticBitrate: 120000000, MusicStreamingTranscodingBitrate: 384000,
    DirectPlayProfiles: [{ Type: 'Video', Container: containers.join(','), VideoCodec: v.join(','), AudioCodec: a.join(',') }],
    TranscodingProfiles: [{ Type: 'Video', Container: 'ts', Protocol: 'hls', Context: 'Streaming', VideoCodec: hlsV, AudioCodec: 'aac,mp3', MaxAudioChannels: '6', BreakOnNonKeyFrames: true, MinSegments: 1, CopyTimestamps: false }],
    ContainerProfiles: [], CodecProfiles: [],
    SubtitleProfiles: [
      { Format: 'vtt', Method: 'External' }, { Format: 'srt', Method: 'External' }, { Format: 'subrip', Method: 'External' },
      { Format: 'ass', Method: 'External' }, { Format: 'ssa', Method: 'External' },
      { Format: 'pgssub', Method: 'Encode' }, { Format: 'dvdsub', Method: 'Encode' }, { Format: 'dvbsub', Method: 'Encode' }
    ],
    ResponseProfiles: []
  };
}

export async function play(item, { startTicks, onExit, getNext } = {}) {
  const prefs = LS.get('playerPrefs', { autoNext: true, autoSkip: false });
  let it = item.MediaSources ? item : await api.item(item.Id);
  let audioIdx, subIdx = -1, ps = null, hls = null, src = null, segs = [], timers = [], closed = false, nextShown = false, skipped = {};
  let resumeTicks = startTicks ?? (it.UserData?.PlaybackPositionTicks || 0);

  const video = h('video', { autoplay: true, playsinline: true, crossorigin: 'anonymous' });
  const spinner = h('div', { class: 'spinner' });
  const title = h('div', {}, h('div', { class: 'kicker' }, it.Type === 'Episode' ? `${it.SeriesName} · ${fmt.epCode(it)}` : (it.ProductionYear || '')),
    h('h1', { style: { fontSize: '34px', marginTop: '6px' } }, it.Name));
  const cur = h('span', {}, '0:00'), dur = h('span', {}, '0:00');
  const fill = h('i'), buf = h('b');
  const bar = h('div', { class: 'track2', onclick: (e) => { const r = bar.getBoundingClientRect(); seekTo((e.clientX - r.left) / r.width * (duration() || 0)); } }, buf, fill);
  const ppBtn = h('button', { class: 'btn primary f', 'data-autofocus': true, 'aria-label': 'Lecture ou pause', onclick: () => toggle() }, icon('pause'));
  const ctrls = h('div', { class: 'row-flex' },
    h('button', { class: 'btn f', 'aria-label': 'Reculer de 10 secondes', onclick: () => seekBy(-10) }, icon('rw'), '10 s'),
    ppBtn,
    h('button', { class: 'btn f', 'aria-label': 'Avancer de 30 secondes', onclick: () => seekBy(30) }, '30 s', icon('ff')),
    h('span', { style: { flex: '1' } }),
    h('button', { class: 'btn f', onclick: () => openMenu('audio') }, icon('audio'), 'Audio'),
    h('button', { class: 'btn f', onclick: () => openMenu('sub') }, icon('sub'), 'Sous-titres'),
    getNext ? h('button', { class: 'btn f', onclick: () => goNext() }, icon('next'), 'Suivant') : null,
    h('button', { class: 'btn f', onclick: () => close() }, icon('back'), 'Quitter'));
  const ov = h('div', { class: 'ov' }, title, h('div', { class: 'bottom' }, h('div', { class: 'seek' }, cur, bar, dur), ctrls));
  const layer = h('div', { class: 'layer' });
  const root = h('div', { class: 'player' }, video, spinner, ov, layer);
  document.body.append(root);

  // masquer les commandes après 4 s sans activité
  let idleT;
  const wake = () => { root.classList.remove('idle'); clearTimeout(idleT); idleT = setTimeout(() => { if (!video.paused) root.classList.add('idle'); }, 4000); };
  root.addEventListener('mousemove', wake);
  // tactile : un appui affiche/masque les commandes, double appui à gauche/droite = -10 s / +30 s
  let lastTap = 0;
  root.addEventListener('pointerup', (e) => {
    if (e.pointerType !== 'touch' || e.target.closest('button, .track2, .menu, .next')) return;
    const now2 = Date.now(), x = e.clientX / window.innerWidth;
    if (now2 - lastTap < 300 && (x < 0.35 || x > 0.65)) { seekBy(x < 0.35 ? -10 : 30); toast(x < 0.35 ? '−10 s' : '+30 s'); lastTap = 0; return; }
    lastTap = now2;
    if (root.classList.contains('idle')) wake(); else { root.classList.add('idle'); clearTimeout(idleT); }
  });
  wake();
  // téléphone : la vidéo passe en paysage pendant la lecture
  try { window.AppNative?.setLandscape?.(true); } catch {}

  const duration = () => (it.RunTimeTicks ? it.RunTimeTicks / 1e7 : video.duration) || 0;
  // pour un flux converti, video.currentTime repart de 0 au point de départ demandé
  let offset = 0;
  const now = () => offset + (video.currentTime || 0);
  const ticks = () => Math.floor(now() * 1e7);
  function toggle() { if (video.paused) video.play().catch(() => {}); else video.pause(); }
  function seekBy(s) { seekTo(now() + s); }
  function seekTo(s) {
    s = Math.max(0, Math.min(s, duration() - 1));
    video.currentTime = s; // lecture directe ou flux HLS : la chronologie couvre tout le film
  }
  // flux converti par Jellyfin (HLS) : la liste couvre tout le fichier, on se place au bon endroit côté lecteur
  function attachHls(url, startSec) {
    offset = 0;
    if (window.Hls?.isSupported()) {
      hls = new window.Hls({ startPosition: startSec || 0, maxBufferLength: 40 });
      hls.loadSource(url); hls.attachMedia(video);
      hls.on(window.Hls.Events.ERROR, (_, d) => { if (d.fatal) { console.error(d); if (d.type === 'networkError') hls.startLoad(); else toast('Erreur de lecture'); } });
    } else {
      video.src = url;
      if (startSec) video.addEventListener('loadedmetadata', () => { video.currentTime = startSec; }, { once: true });
    }
  }

  function report(kind, extra = {}) {
    if (!ps) return;
    const b = { ItemId: it.Id, MediaSourceId: ps.ms.Id, PlaySessionId: ps.id, PositionTicks: ticks(), IsPaused: video.paused, CanSeek: true,
      PlayMethod: ps.direct ? 'DirectPlay' : 'Transcode', AudioStreamIndex: audioIdx, SubtitleStreamIndex: subIdx, ...extra };
    if (kind === 'start') api.reportStart(b); else if (kind === 'stop') api.reportStop(b); else api.reportProgress(b);
  }

  async function start(fromTicks) {
    spinner.hidden = false;
    if (hls) { hls.destroy(); hls = null; }
    if (ps && !ps.direct) api.stopTranscode(ps.id);
    const info = await api.playbackInfo(it.Id, { profile: buildProfile(), startTicks: 0, audio: audioIdx, sub: subIdx, mediaSourceId: ps?.ms?.Id });
    const ms = info.MediaSources[0];
    if (audioIdx == null) audioIdx = ms.DefaultAudioStreamIndex;
    if (subIdx === -1 && ps == null && ms.DefaultSubtitleStreamIndex != null) subIdx = ms.DefaultSubtitleStreamIndex;
    const direct = !!ms.SupportsDirectPlay && !ms.TranscodingUrl;
    ps = { id: info.PlaySessionId, ms, direct };
    [...video.querySelectorAll('track')].forEach((t) => t.remove());
    if (direct) {
      src = `${api.base}/Videos/${it.Id}/stream?static=true&mediaSourceId=${ms.Id}&deviceId=${encodeURIComponent(LS.get('deviceId'))}&playSessionId=${ps.id}&api_key=${api.token}`;
      offset = 0; video.src = src;
      video.addEventListener('loadedmetadata', () => { if (fromTicks) video.currentTime = fromTicks / 1e7; }, { once: true });
    } else {
      src = api.base + ms.TranscodingUrl;
      attachHls(src, (fromTicks || 0) / 1e7);
    }
    // sous-titres texte : piste externe WebVTT, ajoutée une fois la vidéo lancée (pour ne pas ralentir le démarrage)
    const s = (ms.MediaStreams || []).find((x) => x.Type === 'Subtitle' && x.Index === subIdx);
    if (s && s.DeliveryMethod === 'External') await new Promise((r) => { if (!video.paused && video.readyState > 2) r(); else { video.addEventListener('playing', r, { once: true }); setTimeout(r, 15000); } });
    if (s && s.DeliveryMethod === 'External' && !closed) {
      const url = `${api.base}/Videos/${it.Id}/${ms.Id}/Subtitles/${s.Index}/0/Stream.vtt?api_key=${api.token}`;
      const tr = h('track', { kind: 'subtitles', src: url, srclang: s.Language || 'fr', label: s.DisplayTitle || 'Sous-titres', default: true });
      video.append(tr);
      tr.addEventListener('load', () => { tr.track.mode = 'showing'; });
      setTimeout(() => { if (tr.track) tr.track.mode = 'showing'; }, 300);
    }
    video.play().catch(() => { toast('Appuie sur Lecture pour démarrer'); });
    report('start');
  }

  // --- segments (générique) ---
  api.segments(it.Id).then((r) => { segs = (r?.Items || []).map((x) => ({ type: x.Type, s: x.StartTicks / 1e7, e: x.EndTicks / 1e7 })); });
  let skipBtn = null, nextBox = null;
  function showSkip(seg) {
    if (skipBtn) return;
    const label = seg.type === 'Intro' ? 'Passer le générique' : seg.type === 'Recap' ? 'Passer le résumé' : seg.type === 'Preview' ? 'Passer l’aperçu' : 'Passer';
    skipBtn = h('button', { class: 'btn primary f skip', onclick: () => { skipped[seg.s] = true; seekTo(seg.e + 0.2); hideSkip(); } }, label);
    layer.append(skipBtn);
    if (nav.usingKeys) nav.focus(skipBtn);
  }
  function hideSkip() { skipBtn?.remove(); skipBtn = null; }

  async function showNext() {
    if (nextShown || !getNext || !prefs.autoNext) return;
    nextShown = true;
    const nx = await getNext(it);
    if (!nx || closed) return;
    let left = 10;
    const cd = h('i', { style: { width: '100%' } });
    const lbl = h('div', { class: 'kicker' }, `Épisode suivant dans ${left} s`);
    const img = nx.ImageTags?.Primary ? h('img', { src: api.img(nx.Id, 'Primary', { maxWidth: 300, tag: nx.ImageTags.Primary }), alt: '' }) : h('img', { alt: '' });
    const goBtn = h('button', { class: 'btn primary f', onclick: () => goNext(nx) }, 'Lire maintenant');
    nextBox = h('div', { class: 'next' }, h('div', { class: 'row-flex' }, img, h('div', {}, lbl, h('div', { style: { fontFamily: 'var(--disp)', fontWeight: 700, fontSize: '20px', marginTop: '4px' } }, `${fmt.epCode(nx)} · ${nx.Name}`))),
      h('div', { class: 'cd' }, cd),
      h('div', { class: 'row-flex' }, goBtn, h('button', { class: 'btn f', onclick: () => { clearInterval(iv); nextBox.remove(); nextBox = null; } }, 'Annuler')));
    layer.append(nextBox);
    nav.focus(goBtn);
    requestAnimationFrame(() => { cd.style.width = '90%'; });
    const iv = setInterval(() => { left--; lbl.textContent = `Épisode suivant dans ${left} s`; cd.style.width = (left * 10) + '%'; if (left <= 0) { clearInterval(iv); goNext(nx); } }, 1000);
    timers.push(iv);
  }
  async function goNext(nx) {
    nx = nx || await getNext?.(it);
    if (!nx) { toast('Pas d’épisode suivant'); return; }
    await teardown(true);
    play(nx, { startTicks: 0, onExit, getNext });
  }

  video.addEventListener('timeupdate', () => {
    const t = now(), d = duration();
    cur.textContent = fmt.clock(t); dur.textContent = fmt.clock(d);
    fill.style.width = d ? (t / d * 100) + '%' : '0';
    if (video.buffered.length) buf.style.width = d ? ((offset + video.buffered.end(video.buffered.length - 1)) / d * 100) + '%' : '0';
    const seg = segs.find((x) => x.type !== 'Outro' && t >= x.s && t < x.e - 1);
    if (seg && !skipped[seg.s]) { if (prefs.autoSkip && seg.type === 'Intro') { skipped[seg.s] = true; seekTo(seg.e + 0.2); } else showSkip(seg); } else hideSkip();
    const outro = segs.find((x) => x.type === 'Outro');
    if (it.Type === 'Episode' && d && ((outro && t >= outro.s) || (!outro && d - t < 25))) showNext();
  });
  video.addEventListener('waiting', () => { spinner.hidden = false; });
  video.addEventListener('playing', () => { spinner.hidden = true; ppBtn.replaceChildren(icon('pause')); wake(); });
  video.addEventListener('pause', () => { ppBtn.replaceChildren(icon('play')); root.classList.remove('idle'); report('progress'); });
  video.addEventListener('ended', () => { if (it.Type === 'Episode' && getNext && prefs.autoNext) goNext(); else close(); });
  video.addEventListener('error', () => { if (ps?.direct) { toast('Lecture directe impossible, conversion…'); const t = ticks(); ps.direct = false; startForced(t); } });
  async function startForced(t) { // l'appareil a refusé le fichier : on force la conversion
    const info = await api.playbackInfo(it.Id, { profile: buildProfile(), startTicks: t, audio: audioIdx, sub: subIdx, directPlay: false });
    const ms = info.MediaSources[0]; ps = { id: info.PlaySessionId, ms, direct: false };
    if (!ms.TranscodingUrl) { toast('Ce fichier ne peut pas être lu ici'); return; }
    if (hls) { hls.destroy(); hls = null; }
    src = api.base + ms.TranscodingUrl; attachHls(src, t / 1e7);
    video.play().catch(() => {});
  }
  timers.push(setInterval(() => { if (!video.paused) report('progress'); }, 10000));

  // --- menus audio / sous-titres ---
  let menu = null;
  function openMenu(kind) {
    menu?.remove();
    const streams = (ps?.ms?.MediaStreams || []).filter((s) => s.Type === (kind === 'audio' ? 'Audio' : 'Subtitle'));
    const curIdx = kind === 'audio' ? audioIdx : subIdx;
    const opts = (kind === 'sub' ? [{ Index: -1, DisplayTitle: 'Aucun' }] : []).concat(streams);
    menu = h('div', { class: 'menu', role: 'dialog' }, h('h3', {}, kind === 'audio' ? 'Langue audio' : 'Sous-titres'),
      opts.map((s) => h('button', { class: 'f' + (s.Index === curIdx ? ' on' : ''), 'data-autofocus': s.Index === curIdx ? true : null, onclick: () => {
        menu.remove(); menu = null;
        if (s.Index === curIdx) return;
        if (kind === 'audio') audioIdx = s.Index; else subIdx = s.Index;
        const t = ticks(); start(t);
      } }, (s.Index === curIdx ? '● ' : '') + (s.DisplayTitle || s.Language || ('Piste ' + s.Index)))));
    layer.append(menu);
    nav.first(menu);
  }

  const off = nav.push(({ action }) => {
    wake();
    if (menu && action === 'back') { menu.remove(); menu = null; nav.first(root); return true; }
    if (action === 'back') { close(); return true; }
    if (action === 'playpause' || (action === 'space')) { toggle(); return true; }
    if (action === 'play') { video.play(); return true; }
    if (action === 'pause') { video.pause(); return true; }
    if (action === 'ff') { seekBy(30); return true; }
    if (action === 'rw') { seekBy(-10); return true; }
    if (action === 'stop') { close(); return true; }
    // commandes cachées : gauche/droite = reculer/avancer, OK = pause
    if (root.classList.contains('idle') || document.activeElement === document.body) {
      if (action === 'left') { seekBy(-10); return true; }
      if (action === 'right') { seekBy(30); return true; }
      if (action === 'ok') { toggle(); return true; }
    }
    return false;
  });

  async function teardown(keepCb) {
    if (closed) return; closed = true;
    timers.forEach((x) => { clearInterval(x); clearTimeout(x); }); clearTimeout(idleT);
    report('stop');
    if (ps && !ps.direct) api.stopTranscode(ps.id);
    if (hls) hls.destroy();
    video.pause(); video.removeAttribute('src'); video.load();
    off(); root.remove();
    try { window.AppNative?.setLandscape?.(false); } catch {}
    if (!keepCb) onExit?.();
  }
  function close() { teardown(false); }

  try {
    await start(resumeTicks); nav.first(root);
    timers.push(setTimeout(() => { if (!closed && ps?.direct && video.readyState < 3) { toast('Lecture directe trop lente, conversion…'); const t = resumeTicks; ps.direct = false; startForced(t); } }, 20000));
  }
  catch (e) { console.error(e); toast('Impossible de lancer la lecture'); close(); }
}
