// Demandes via Seerr, à travers le relais /seerr/ de l'image Docker (même adresse que l'appli).
// Chaque personne se connecte à Seerr avec son compte Jellyfin : Seerr applique ses droits habituels.
import { CFG } from './config.js';
import { LS } from './api.js';

// Appli Android : les appels à Seerr passent par le code natif (Seerr refuse les appels d'une autre adresse).
const pending = {};
window.__nativeResp = (id, status, text) => { const cb = pending[id]; if (cb) { delete pending[id]; cb({ status, text }); } };
function nativeFetch(method, url, body) {
  return new Promise((res) => { const id = Math.random().toString(36).slice(2); pending[id] = res; window.AppNative.request(id, method, url, body || ''); });
}

export const seerr = {
  // version web (image Docker) : relais /seerr/ ; appli Android : adresse saisie dans les réglages
  get base() {
    if (window.AppNative?.request) { const u = LS.get('seerrUrl', ''); return u ? u.replace(/\/+$/, '') : null; }
    return CFG.seerrRelay && location.protocol.startsWith('http') ? location.origin + '/seerr' : null;
  },
  me: null,
  async req(path, { method = 'GET', body, query } = {}) {
    if (!this.base) throw Object.assign(new Error('indisponible'), { status: 0 });
    let url = this.base + '/api/v1' + path;
    if (query) url += '?' + new URLSearchParams(Object.entries(query).filter(([, v]) => v != null && v !== '')).toString();
    let status, t;
    if (window.AppNative?.request) { ({ status, text: t } = await nativeFetch(method, url, body ? JSON.stringify(body) : '')); }
    else {
      const r = await fetch(url, { method, credentials: 'include', headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined });
      status = r.status; t = await r.text();
    }
    if (status < 200 || status >= 300) { let msg = ''; try { msg = JSON.parse(t).message || ''; } catch {} throw Object.assign(new Error(msg || 'HTTP ' + status), { status }); }
    return t ? JSON.parse(t) : null;
  },
  async check() {
    try { this.me = await this.req('/auth/me'); return this.me; } catch { this.me = null; return null; }
  },
  async login(username, password) {
    this.me = await this.req('/auth/jellyfin', { method: 'POST', body: { username, password } });
    return this.me;
  },
  async logout() { try { await this.req('/auth/logout', { method: 'POST' }); } catch {} this.me = null; },
  search(q) { return this.req('/search', { query: { query: q, page: 1, language: 'fr' } }); },
  tv(id) { return this.req('/tv/' + id, { query: { language: 'fr' } }); },
  movie(id) { return this.req('/movie/' + id, { query: { language: 'fr' } }); },
  request(mediaType, mediaId, seasons) { return this.req('/request', { method: 'POST', body: mediaType === 'tv' ? { mediaType, mediaId, seasons } : { mediaType, mediaId } }); },
  myRequests() { return this.req('/request', { query: { take: 30, skip: 0, sort: 'added', requestedBy: this.me?.id } }); },
  // valider les demandes : administrateur Seerr (2) ou « gérer les demandes » (16)
  get canManage() { const p = this.me?.permissions || 0; return !!(p & 2 || p & 16); },
  pending() { return this.req('/request', { query: { take: 50, skip: 0, filter: 'pending', sort: 'added' } }); },
  approve(id) { return this.req(`/request/${id}/approve`, { method: 'POST' }); },
  decline(id) { return this.req(`/request/${id}/decline`, { method: 'POST' }); },
  poster(p, w = 342) { return p ? 'https://image.tmdb.org/t/p/w' + w + p : null; },
  // statut du média dans Seerr
  mediaStatus(s) { return ({ 2: 'Demandé', 3: 'En cours', 4: 'En partie disponible', 5: 'Disponible', 6: 'Supprimé' })[s] || null; },
  requestStatus(r) {
    if (r.status === 3) return 'Refusée';
    if (r.media?.status === 5) return 'Disponible';
    if (r.media?.status === 4) return 'En partie disponible';
    if (r.status === 1) return 'En attente de validation';
    if (r.status === 2) return 'Validée, en préparation';
    return 'En attente';
  }
};
