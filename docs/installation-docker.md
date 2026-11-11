# Installer la version web de Bobine (Docker)

La version web s'utilise dans un navigateur : PC, Mac, Xbox (Microsoft Edge), tablette… On l'héberge sur ton serveur, à côté de Jellyfin, grâce à une petite image Docker basée sur nginx.

## Avec Docker Compose

Crée un fichier `docker-compose.yml` :

```yaml
services:
  bobine:
    image: ghcr.io/windgui2771/bobine:latest
    container_name: bobine
    restart: unless-stopped
    ports:
      - "8095:80"            # Bobine sera sur http://ton-serveur:8095
    environment:
      JELLYFIN_URL: "http://192.168.1.10:8096"
      SEERR_URL: ""          # ex. http://192.168.1.10:5055 pour activer les demandes
      HOMEPAGE_URL: ""       # ex. http://192.168.1.10:3000 : lien « Mes services » dans le tableau de bord
      APP_NAME: "Bobine"     # le nom affiché, si tu veux le personnaliser
```

Lance-le :

```bash
docker compose up -d
```

Ouvre ensuite `http://adresse-de-ton-serveur:8095`.

## Les variables

| Variable | Obligatoire | Rôle |
|---|---|---|
| `JELLYFIN_URL` | non, mais conseillée | Adresse de Jellyfin proposée au premier lancement. Chacun peut la changer dans l'appli. |
| `SEERR_URL` | non | Active l'onglet **Demandes**. L'image relaie les appels vers Seerr sous `/seerr/`, car Seerr refuse les appels directs d'une autre adresse. |
| `HOMEPAGE_URL` | non | Ajoute un bouton vers ton tableau de bord de services (Homepage, Homarr…). |
| `APP_NAME` | non | Nom affiché dans l'appli (par défaut « Bobine »). |

## La sécurité

- L'image ne contient **aucun mot de passe ni aucune clé**. Chacun se connecte avec **son compte Jellyfin**.
- Pour les demandes, chacun se connecte à Seerr avec son compte Jellyfin, et Seerr applique ses droits habituels (validation, quotas). Ta clé API Seerr n'est jamais utilisée.
- Pour un accès depuis Internet, place Bobine derrière ton reverse proxy habituel (Nginx Proxy Manager, Traefik, Caddy, Cloudflare Tunnel…) en **HTTPS**. Le Jellyfin doit alors lui aussi être en HTTPS, sinon le navigateur bloque les appels.

## Sur Xbox

1. Ouvre **Microsoft Edge** sur la Xbox.
2. Va sur `http://adresse-de-ton-serveur:8095` et connecte-toi.
3. Épingle la page à l'accueil (menu ⋯ → *Épingler à l'accueil*).

La manette fonctionne : croix ou stick pour se déplacer, A pour valider, B pour revenir.

## Mettre à jour

```bash
docker compose pull && docker compose up -d
```
