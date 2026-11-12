# Nouveautés

## 0.3.1 — 12 novembre 2026

- Correction : les affiches restaient noires sur les télés dont le moteur web (« Android System WebView ») est ancien. Les mises en page n'utilisent plus `inset`, `aspect-ratio` ni `gap` sans solution de repli.

## 0.3.0 — 11 novembre 2026

### Nouveaux appareils
- **Téléphones et tablettes Android** : interface tactile avec onglets en bas et menu « Plus », vidéo en paysage pendant la lecture, double appui pour reculer ou avancer.
- **Windows 10 / 11** : appli à installer ou version portable, plein écran avec F11 et automatique pendant les vidéos, manette Xbox.

### Ailleurs que chez soi
- **Deux adresses de serveur** (maison + extérieure) : Bobine prend toute seule celle qui répond.

### Corrections
- Téléphone en paysage : menu latéral compact.
- Points de la bannière qui pouvaient recouvrir les boutons.

## 0.2.0 — 11 novembre 2026

Première version publique.

### Interface
- Accueil avec bannière tirée au hasard dans la bibliothèque et bande-annonce en fond, rangées Reprendre / À suivre / nouveautés.
- Suggestions selon ce qu'on regarde (« Parce que tu regardes… », « Réalisé par… », « Avec… »).
- Vue Dossiers pour les films et les séries, selon l'arborescence du disque.
- Recherche en direct avec filtres rapides et recherche vocale.
- Écran de veille, profil Enfants verrouillé par code.

### Lecture
- Lecture directe quand c'est possible, sinon conversion par Jellyfin (HLS), avec bascule automatique.
- Reprise exacte, « Passer le générique » (Intro Skipper), épisode suivant automatique.
- Choix de la langue et des sous-titres.

### Administration
- Tableau de bord : qui regarde, bibliothèques (analyse ciblée), tâches planifiées, utilisateurs, appareils, extensions.
- Demandes Seerr : demander, suivre, valider ou refuser.

### Appareils
- APK Android TV avec l'interface intégrée.
- Image Docker pour la version web (PC, Xbox), avec relais Seerr optionnel.
- Navigation à la télécommande, à la manette, au clavier et à la souris.
