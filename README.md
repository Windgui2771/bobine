<p align="center"><img src="docs/banner.png" alt="Bobine" width="480"></p>

# Bobine

Une interface moderne pour regarder ta bibliothèque **Jellyfin** sur la TV, le PC ou la Xbox. Elle se pilote à la télécommande, à la manette, au clavier ou à la souris.

Bobine ne contient aucun film ni aucune série : c'est une façon de parcourir et de lire **ton propre serveur Jellyfin**.

## Ce qu'elle fait

- **Accueil** : bannière tirée au hasard dans ta bibliothèque, avec la bande-annonce en fond ; Reprendre, À suivre, nouveautés, suggestions selon ce que tu regardes.
- **Vue Dossiers** : parcours tes films et séries tels que tu les as rangés sur le disque.
- **Recherche** : filtres rapides (pas encore vu, moins de 1 h 30, en famille, 4K) et recherche vocale (micro de la télécommande sur Android TV, micro du PC dans Chrome/Edge).
- **Lecteur** : reprise là où tu t'étais arrêté, « Passer le générique » (avec l'extension Intro Skipper), épisode suivant automatique, choix de l'audio et des sous-titres.
- **Profil Enfants** verrouillé par un code.
- **Tableau de bord** pour l'administrateur : qui regarde, analyse des bibliothèques, tâches planifiées, utilisateurs, appareils, extensions.
- **Demandes Seerr** (optionnel) : demander un titre absent de la bibliothèque, suivre ses demandes, et valider celles des autres si tu en as le droit.
- **Écran de veille** avec les affiches de ta bibliothèque.

## Installation

### Android TV / Google TV / box Android

1. Télécharge le fichier `Bobine-vX.Y.Z.apk` dans les [Releases](../../releases).
2. Sur la box, installe-le avec l'appli **Downloader** en lui donnant l'adresse du fichier, ou avec une clé USB.
3. Au premier lancement, saisis l'adresse de ton Jellyfin (par exemple `http://192.168.1.10:8096`) et connecte-toi.
4. Optionnel : ajoute l'adresse de Seerr dans *Profil → Réglages* (ou *Tableau de bord → Réglages appli*).

### Version web (PC, Xbox, navigateur), avec Docker

```yaml
services:
  bobine:
    image: ghcr.io/OWNER/bobine:latest
    restart: unless-stopped
    ports:
      - "8095:80"
    environment:
      JELLYFIN_URL: "http://192.168.1.10:8096"   # proposé au premier lancement
      SEERR_URL: ""                              # optionnel : active les demandes
      HOMEPAGE_URL: ""                           # optionnel : lien vers ton tableau de bord
```

Ouvre ensuite `http://adresse-du-serveur:8095`.

Quand `SEERR_URL` est renseigné, l'image relaie les appels vers Seerr sous `/seerr/`. Ta clé API Seerr n'est jamais utilisée : chacun se connecte avec son compte Jellyfin, et Seerr applique ses droits habituels.

### Xbox

Ouvre **Microsoft Edge** sur la Xbox, va sur l'adresse de la version web et épingle la page. La manette fonctionne : croix ou stick pour se déplacer, A pour valider, B pour revenir, Start pour lecture/pause.

## Commandes

| Action | Télécommande | Manette | Clavier |
|---|---|---|---|
| Se déplacer | flèches | croix / stick | flèches |
| Valider | OK | A | Entrée |
| Revenir | Retour | B | Échap |
| Lecture / pause | Lecture | Start | Espace |
| Reculer / avancer | ◀◀ / ▶▶ | LB / RB | flèches (lecteur) |

## Compiler soi-même

- **APK** : JDK 17 et SDK Android 34, puis `cd android && ./gradlew assembleRelease`. L'interface (`web/`) est copiée automatiquement dans l'APK. Pour une APK qui charge une installation web au lieu de l'interface intégrée : `./gradlew assembleRelease -PappUrl=http://ton-serveur:8095/`.
- **Docker** : `docker build -t bobine .`

### Publier une version (mainteneur)

Pousser un tag `vX.Y.Z` lance `.github/workflows/release.yml`, qui :
- construit l'image Docker et la publie sur `ghcr.io` ;
- compile et signe l'APK, puis la joint à la Release.

Secrets à définir dans le dépôt :
- `KEYSTORE_BASE64` : le fichier `.keystore` encodé en base64 ;
- `KEYSTORE_PASSWORD` ;
- `KEY_ALIAS`.

Garde toujours la même clé : sans elle, il faudrait désinstaller l'appli pour installer une mise à jour.

## Vie privée

Bobine parle uniquement à ton serveur Jellyfin et, si tu l'as configuré, à ton Seerr. Les exceptions sont YouTube (bandes-annonces), Google Fonts (polices) et TMDB (affiches dans les demandes). Aucune statistique n'est collectée.

## Licence

MIT. Voir [LICENSE](LICENSE) et [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
Bobine n'est ni affilié à, ni soutenu par, Jellyfin ou Seerr.
