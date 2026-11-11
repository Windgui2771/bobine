# Questions fréquentes

### Pourquoi Bobine plutôt que l'appli officielle Jellyfin ?
L'appli officielle fait très bien le travail. Bobine propose surtout une autre présentation : bannière avec bandes-annonces, vue par dossiers, filtres rapides, profil Enfants verrouillé, tableau de bord et validation des demandes Seerr depuis la TV. Les deux peuvent cohabiter sur la même box.

### Est-ce que Bobine modifie mon serveur Jellyfin ?
Non. Bobine utilise l'API officielle de Jellyfin, comme n'importe quelle appli. Les seules actions qui changent quelque chose sont celles que tu lances toi-même : marquer comme vu, ajouter à « Ma liste », et, pour l'administrateur, lancer une analyse ou une tâche, ou désactiver un compte.

### Une vidéo ne démarre pas
- Bobine lit le fichier directement quand l'appareil le permet. Sinon, Jellyfin convertit la vidéo à la volée. Si la lecture directe ne démarre pas au bout de 20 secondes, Bobine bascule toute seule sur la conversion.
- Si rien ne marche, vérifie dans Jellyfin (*Tableau de bord → Utilisateurs → ton compte*) que la **conversion vidéo** est autorisée.
- Un serveur peu puissant peut mettre quelques secondes à démarrer une conversion, surtout pour les fichiers 4K.

### Le bouton « Passer le générique » n'apparaît pas
Il faut l'extension **Intro Skipper** dans Jellyfin, et que son analyse ait tourné sur la série (*Tableau de bord → Tâches planifiées*).

### Je ne vois pas l'onglet « Demandes »
- **Version web** : renseigne `SEERR_URL` dans le `docker-compose.yml`.
- **Appli Android** : renseigne l'adresse de Seerr dans les réglages.

### Je ne vois pas les demandes des autres à valider
Ton compte Seerr doit avoir la permission *Gérer les demandes* (ou être administrateur dans Seerr).

### Je ne vois pas le « Tableau de bord »
Il n'est visible que pour les comptes **administrateurs** de Jellyfin.

### Le profil Enfants bloque-t-il vraiment tout ?
Sur l'appareil, il n'affiche que les titres classés Animation ou Familial, et sortir du profil demande le code. Pour un blocage complet, règle aussi le **contrôle parental** du compte dans Jellyfin (classification maximale), qui s'applique sur tous les appareils.

### Puis-je utiliser Bobine depuis l'extérieur de chez moi ?
Oui, si ton Jellyfin est accessible depuis Internet. Avec la version web, il faut que Bobine et Jellyfin soient tous les deux en HTTPS.

### Pourquoi Bobine n'est pas sur le Play Store ?
Publier sur le Play Store demande un compte développeur et une phase de test imposée par Google. Pour l'instant, Bobine s'installe à partir de l'APK, ce qui est simple et sans risque. Voir le [guide](installation-android-tv.md).

### Et sur iPhone, Apple TV ou Fire TV ?
- **Fire TV** : l'APK devrait fonctionner (installation avec Downloader), mais ce n'est pas encore testé.
- **Apple TV** : pas d'appli pour l'instant.
- **iPhone, iPad** : la version web marche dans Safari.

### Les bandes-annonces ne se lancent pas
Elles viennent de YouTube, d'après les liens de Jellyfin (récupérés sur TMDB). Certains éditeurs interdisent leur lecture hors de YouTube : Bobine affiche alors l'image fixe. On peut les couper dans *Réglages appli → Bandes-annonces dans la bannière*.
