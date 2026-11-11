// Accès à l'API Jellyfin. Aucune écriture de configuration serveur :
// on lit la bibliothèque, on lance la lecture et on renvoie la progression (comme toute appli Jellyfin).
import { CFG } from './config.js';
const VERSION = CFG.version;
const LS = {
  get(k, d) { try { const v = localStorage.getItem('cp.' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('cp.' + k, JSON.stringify(v)); } catch {} },
  del(k) { try { localStorage.removeItem('cp.' + k); } catch {} }
};
export { LS };

function deviceId() {
  let id = LS.get('deviceId');
  if (!id) { id = 'cp-' + Math.random().toString(36).slice(2) + Date.now().toString(36); LS.set('deviceId', id); }
  return id;
}
function deviceName() {
  if (window.AppNative) return 'Android TV';
  const ua = navigator.userAgent;
  if (/Windows/.test(ua)) return 'PC Windows';
  if (/Android/.test(ua)) return 'Android';
  if (/Linux/.test(ua)) return 'PC Linux';
  return 'Navigateur';
}

export const api = {
  base: LS.get('server', ''),
  token: null,
  user: null,

  setServer(url) { this.base = url.replace(/\/+$/, ''); LS.set('server', this.base); },
  auth() {
    let s = `MediaBrowser Client="${CFG.appName}", Device="${deviceName()}", DeviceId="${deviceId()}", Version="${VERSION}"`;
    if (this.token) s += `, Token="${this.token}"`;
    return s;
  },
  async req(path, { method = 'GET', body, query, raw } = {}) {
    let url = this.base + path;
    if (query) {
      const q = new URLSearchParams();
      for (const [k, v] of Object.entries(query)) if (v !== undefined && v !== null && v !== '') q.set(k, v);
      const qs = q.toString(); if (qs) url += (url.includes('?') ? '&' : '?') + qs;
    }
    const r = await fetch(url, {
      method,
      headers: { 'Authorization': this.auth(), ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined
    });
    if (r.status === 401) { const e = new Error('401'); e.status = 401; throw e; }
    if (!r.ok) { const e = new Error('HTTP ' + r.status); e.status = r.status; throw e; }
    if (raw) return r;
    const t = await r.text();
    return t ? JSON.parse(t) : null;
  },

  // --- connexion ---
  publicInfo() { return this.req('/System/Info/Public'); },
  publicUsers() { return this.req('/Users/Public'); },
  async login(name, pw) {
    const r = await this.req('/Users/AuthenticateByName', { method: 'POST', body: { Username: name, Pw: pw || '' } });
    this.token = r.AccessToken; this.user = r.User;
    const saved = LS.get('sessions', {});
    saved[r.User.Id] = { token: r.AccessToken, name: r.User.Name, id: r.User.Id, img: r.User.PrimaryImageTag || null };
    LS.set('sessions', saved);
    LS.set('last', r.User.Id);
    return r.User;
  },
  async resume(id) {
    const s = LS.get('sessions', {})[id];
    if (!s) return null;
    this.token = s.token;
    try { this.user = await this.req('/Users/Me'); LS.set('last', id); return this.user; }
    catch (e) { if (e.status === 401) this.forget(id); this.token = null; return null; }
  },
  forget(id) { const s = LS.get('sessions', {}); delete s[id]; LS.set('sessions', s); },
  async logout() { try { await this.req('/Sessions/Logout', { method: 'POST' }); } catch {} if (this.user) this.forget(this.user.Id); this.token = null; this.user = null; },
  get isAdmin() { return !!this.user?.Policy?.IsAdministrator; },

  // --- images (pas d'authentification nécessaire) ---
  img(id, type = 'Primary', opts = {}) {
    const q = new URLSearchParams({ quality: '90', ...opts });
    return `${this.base}/Items/${id}/Images/${type}?${q}`;
  },
  userImg(u) { return u.PrimaryImageTag || u.img ? `${this.base}/Users/${u.Id || u.id}/Images/Primary?tag=${u.PrimaryImageTag || u.img}&maxHeight=240` : null; },

  // --- bibliothèque ---
  FIELDS: 'Overview,PrimaryImageAspectRatio,Genres,ChildCount,RecursiveItemCount,ParentId,Width',
  views() { return this.req(`/UserViews`, { query: { userId: this.user.Id } }); },
  items(query) { return this.req('/Items', { query: { userId: this.user.Id, fields: this.FIELDS, enableImageTypes: 'Primary,Backdrop,Logo,Thumb', ...query } }); },
  item(id) { return this.req(`/Items/${id}`, { query: { userId: this.user.Id } }); },
  resumeItems(limit = 20) { return this.req('/UserItems/Resume', { query: { userId: this.user.Id, limit, fields: this.FIELDS, mediaTypes: 'Video', enableImageTypes: 'Primary,Backdrop,Thumb' } }); },
  nextUp(limit = 20, seriesId) { return this.req('/Shows/NextUp', { query: { userId: this.user.Id, limit, seriesId, fields: this.FIELDS, enableResumable: false } }); },
  latest(parentId, limit = 24) { return this.req('/Items/Latest', { query: { userId: this.user.Id, parentId, limit, fields: this.FIELDS, groupItems: true } }); },
  seasons(seriesId) { return this.req(`/Shows/${seriesId}/Seasons`, { query: { userId: this.user.Id, fields: 'ItemCounts' } }); },
  episodes(seriesId, seasonId) { return this.req(`/Shows/${seriesId}/Episodes`, { query: { userId: this.user.Id, seasonId, fields: this.FIELDS } }); },
  similar(id) { return this.req(`/Items/${id}/Similar`, { query: { userId: this.user.Id, limit: 12, fields: this.FIELDS } }); },
  segments(id) { return this.req(`/MediaSegments/${id}`).catch(() => ({ Items: [] })); },
  setFavorite(id, on) { return this.req(`/UserFavoriteItems/${id}`, { method: on ? 'POST' : 'DELETE', query: { userId: this.user.Id } }); },
  setPlayed(id, on) { return this.req(`/UserPlayedItems/${id}`, { method: on ? 'POST' : 'DELETE', query: { userId: this.user.Id } }); },

  // --- lecture ---
  playbackInfo(id, opts) {
    return this.req(`/Items/${id}/PlaybackInfo`, { method: 'POST', query: { userId: this.user.Id }, body: {
      UserId: this.user.Id, DeviceProfile: opts.profile, MaxStreamingBitrate: opts.maxBitrate || 120000000,
      StartTimeTicks: opts.startTicks || 0, AudioStreamIndex: opts.audio, SubtitleStreamIndex: opts.sub,
      MediaSourceId: opts.mediaSourceId, EnableDirectPlay: opts.directPlay !== false, EnableDirectStream: true,
      EnableTranscoding: true, AllowVideoStreamCopy: true, AllowAudioStreamCopy: true, AutoOpenLiveStream: true
    } });
  },
  reportStart(b) { return this.req('/Sessions/Playing', { method: 'POST', body: b }).catch(() => {}); },
  reportProgress(b) { return this.req('/Sessions/Playing/Progress', { method: 'POST', body: b }).catch(() => {}); },
  reportStop(b) { return this.req('/Sessions/Playing/Stopped', { method: 'POST', body: b }).catch(() => {}); },
  stopTranscode(playSessionId) { return this.req('/Videos/ActiveEncodings', { method: 'DELETE', query: { deviceId: deviceId(), playSessionId } }).catch(() => {}); },

  // --- admin (lecture seule, sauf « scanner ») ---
  systemInfo() { return this.req('/System/Info'); },
  sessions() { return this.req('/Sessions', { query: { activeWithinSeconds: 960 } }); },
  tasks() { return this.req('/ScheduledTasks', { query: { isHidden: false } }); },
  counts() { return this.req('/Items/Counts', { query: { userId: this.user.Id } }); },
  activity() { return this.req('/System/ActivityLog/Entries', { query: { limit: 12, hasUserId: false } }); },
  storage() { return this.req('/System/Info/Storage').catch(() => null); },
  refreshLibrary() { return this.req('/Library/Refresh', { method: 'POST' }); },
  // analyse d'une seule bibliothèque : nouveaux fichiers + infos manquantes (comme « Analyser la médiathèque » dans Jellyfin)
  refreshItem(id) { return this.req(`/Items/${id}/Refresh`, { method: 'POST', query: { Recursive: true, MetadataRefreshMode: 'Default', ImageRefreshMode: 'Default', ReplaceAllMetadata: false, ReplaceAllImages: false } }); },
  virtualFolders() { return this.req('/Library/VirtualFolders'); },
  runTask(id) { return this.req(`/ScheduledTasks/Running/${id}`, { method: 'POST' }); },
  users() { return this.req('/Users'); },
  async setUserDisabled(id, disabled) { const u = await this.req(`/Users/${id}`); const p = { ...u.Policy, IsDisabled: disabled }; return this.req(`/Users/${id}/Policy`, { method: 'POST', body: p }); },
  plugins() { return this.req('/Plugins'); },
  devices() { return this.req('/Devices'); },
  recommendations() { return this.req('/Movies/Recommendations', { query: { userId: this.user.Id, categoryLimit: 4, itemLimit: 16, fields: this.FIELDS } }); }
};
