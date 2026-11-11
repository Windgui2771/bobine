# Utiliser Bobine en dehors de chez soi

Bobine peut retenir **deux adresses** pour ton serveur :

| | Exemple | Quand elle sert |
|---|---|---|
| **Adresse à la maison** | `http://192.168.1.10:8096` | à la maison : la plus rapide |
| **Adresse extérieure** | `https://jellyfin.mondomaine.fr` | quand l'adresse de la maison ne répond pas |

À chaque démarrage, Bobine essaie d'abord l'adresse de la maison. Si elle ne répond pas en 2,5 secondes, Bobine passe sur l'adresse extérieure. Tu n'as rien à changer quand tu sors.

Pour les régler : au premier lancement, ou plus tard dans **Profil → Adresses du serveur**.

Ça marche avec les applis Android (TV et téléphone) et Windows. Pour la version web, il faut que la page Bobine elle-même soit accessible depuis l'extérieur.

## Comment rendre Jellyfin accessible de l'extérieur ?

Bobine ne s'en occupe pas : c'est une question de réseau. Les solutions courantes :

- **Un VPN privé** (Tailscale, WireGuard) : rien n'est ouvert sur Internet, mais chaque appareil doit avoir l'appli VPN. C'est la solution la plus sûre.
- **Un reverse proxy en HTTPS** (Nginx Proxy Manager, Caddy, Traefik) avec un nom de domaine et un port ouvert sur la box.
- **Un tunnel Cloudflare** : pratique, mais lis bien les conditions de Cloudflare sur la vidéo avant de faire passer tes films par là.

Dans tous les cas, utilise **HTTPS** pour l'adresse extérieure : ton mot de passe Jellyfin passe par cette connexion.
