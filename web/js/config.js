// Réglages de l'installation. Valeurs par défaut, remplacées par config.json s'il existe
// (généré par l'image Docker à partir des variables d'environnement).
export const CFG = {
  appName: 'Bobine',
  version: '0.3.1',
  server: '',        // adresse Jellyfin proposée au premier lancement
  seerrRelay: false, // true si /seerr/ est relayé vers Seerr (image Docker avec SEERR_URL)
  homepage: ''       // lien optionnel vers un tableau de bord (Homepage, Homarr…)
};
try {
  const r = await fetch('config.json', { cache: 'no-store' });
  if (r.ok) Object.assign(CFG, await r.json());
} catch {}
document.title = CFG.appName;
