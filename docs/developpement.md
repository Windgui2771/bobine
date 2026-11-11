# Développement

## Organisation du code

```
web/                 L'interface : HTML, CSS et JavaScript (modules ES), sans étape de compilation
  js/config.js         réglages (remplacés par config.json dans l'image Docker)
  js/api.js            appels à l'API Jellyfin
  js/app.js            écrans, navigation entre les écrans
  js/nav.js            navigation à la télécommande, à la manette et au clavier
  js/player.js         lecteur (lecture directe ou HLS, générique, épisode suivant)
  js/seerr.js          demandes Seerr
  js/ui.js             composants (cartes, rangées, icônes)
  vendor/hls.min.js    hls.js (Apache-2.0)
android/             L'appli Android (TV et téléphone) : une WebView qui contient l'interface
desktop/             L'appli Windows (Electron) : même interface, servie sous app://bobine/
docker/              Script de démarrage de l'image Docker (génère config.json et la config nginx)
Dockerfile           Image nginx qui sert l'interface et relaie Seerr
.github/workflows/   Publication automatique (APK + image Docker) à chaque tag vX.Y.Z
```

## Lancer l'interface en local

N'importe quel serveur de fichiers statiques fait l'affaire :

```bash
cd web && python3 -m http.server 8080
```

Ouvre ensuite `http://localhost:8080`. Ajoute `?debug` à l'adresse pour exposer `window.__cp` dans la console.

## Compiler l'APK

Il faut le JDK 17 et le SDK Android 34.

```bash
cd android
export KEYSTORE_FILE=/chemin/vers/release.keystore KEYSTORE_PASSWORD=... KEY_ALIAS=...
./gradlew assembleRelease
```

- L'interface (`web/`) est copiée automatiquement dans l'APK.
- Variante qui charge une installation web au lieu de l'interface intégrée : `./gradlew assembleRelease -PappUrl=http://ton-serveur:8095/`.

## Compiler l'image Docker

```bash
docker build -t bobine .
docker run -p 8095:80 -e JELLYFIN_URL=http://192.168.1.10:8096 bobine
```

## Publier une version (mainteneur)

1. Mets à jour `CHANGELOG.md`, la version dans `web/js/config.js`, `desktop/package.json`, `desktop/preload.js` et `versionCode`/`versionName` dans `android/app/build.gradle`.
2. Crée une Release GitHub avec le tag `vX.Y.Z`.
3. Le workflow construit l'image `ghcr.io/windgui2771/bobine` (amd64 + arm64) et l'appli Windows (installateur + portable), jointe à la Release. Si les secrets de signature sont configurés, il compile aussi l'APK signée et la joint à la Release.

Secrets du dépôt (*Settings → Secrets and variables → Actions*) :

| Secret | Contenu |
|---|---|
| `KEYSTORE_BASE64` | le fichier `.keystore` encodé en base64 |
| `KEYSTORE_PASSWORD` | son mot de passe |
| `KEY_ALIAS` | l'alias de la clé |

Garde toujours la même clé. Avec une autre clé, il faudrait désinstaller l'appli avant d'installer la mise à jour.
