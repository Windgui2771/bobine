# Installer Bobine sur Android (TV, box, téléphone)

Ce guide vaut pour toutes les box et TV Android : Android TV, Google TV, Xiaomi Mi Box, Nvidia Shield, Chromecast avec Google TV, TV Sony / TCL / Philips sous Android…

Bobine n'est pas sur le Play Store : on l'installe à partir du fichier APK. C'est sans risque et ça ne demande pas de « rooter » la box.

## 1. Autoriser l'installation

1. Installe l'appli **Downloader** (par AFTVnews) depuis le Play Store de la box.
2. Va dans *Paramètres → Applis → Sécurité et restrictions → Sources inconnues* (le nom exact dépend de la marque) et autorise **Downloader**.

## 2. Télécharger et installer Bobine

1. Ouvre **Downloader**.
2. Dans le champ d'adresse, saisis l'adresse de la dernière version :
   `https://github.com/Windgui2771/bobine/releases/latest`
3. Choisis le fichier `Bobine-vX.Y.Z.apk`, puis **Installer**.
4. Une fois installé, Downloader propose de supprimer le fichier APK : tu peux accepter.

**Autre méthode :** copie l'APK sur une clé USB, branche-la sur la box et ouvre le fichier avec un gestionnaire de fichiers (par exemple *File Commander*).

## 3. Premier lancement

1. Bobine apparaît dans la rangée des applis, avec sa bannière.
2. Saisis l'adresse de ton serveur Jellyfin, par exemple `http://192.168.1.10:8096`, puis **Continuer**.
3. Choisis ton profil, ou « Autre compte », et entre ton mot de passe Jellyfin. Bobine s'en souvient pour les fois suivantes.

## 4. Optionnel : les demandes (Seerr)

Si tu utilises Seerr (ou Jellyseerr / Overseerr) :

1. Va dans le **Tableau de bord → Réglages appli**, ou dans **Profil** si tu n'es pas administrateur.
2. Renseigne l'adresse de Seerr, par exemple `http://192.168.1.10:5055`, puis **Enregistrer**.
3. L'onglet **Demandes** apparaît. Connecte-toi avec ton compte Jellyfin.

## Sur un téléphone ou une tablette

C'est la même APK : l'interface s'adapte toute seule, avec des onglets en bas et un menu « Plus ».

1. Depuis le téléphone, ouvre la page des [Releases](https://github.com/Windgui2771/bobine/releases/latest) et touche `Bobine-vX.Y.Z.apk`.
2. Ouvre le fichier téléchargé. Android demande d'autoriser ton navigateur à « installer des applis inconnues » : accepte pour cette fois.
3. Au premier lancement, saisis l'adresse de la maison et, pour regarder dehors, l'[adresse extérieure](acces-exterieur.md).

Pendant la lecture, la vidéo passe en paysage. Un appui affiche ou masque les commandes, et un double appui à gauche ou à droite recule de 10 s ou avance de 30 s.

## Mettre à jour

Télécharge la nouvelle APK de la même façon et installe-la par-dessus. Tes réglages et tes connexions sont conservés.

## Ça ne marche pas ?

| Problème | Solution |
|---|---|
| « Serveur introuvable à cette adresse » | Vérifie l'adresse (avec `http://` et le port, en général `:8096`) et que la box est sur le même réseau que le serveur. |
| « Appli non installée » | Une version signée par quelqu'un d'autre est déjà installée : désinstalle-la d'abord. |
| La touche micro ouvre l'Assistant Google | C'est la box qui garde cette touche. Utilise le bouton micro dans la page **Chercher** de Bobine. |
| Une vidéo ne démarre pas | Voir la [FAQ](faq.md#une-vidéo-ne-démarre-pas). |
