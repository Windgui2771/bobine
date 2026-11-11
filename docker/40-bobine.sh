#!/bin/sh
# Génère la configuration de l'appli et de nginx à partir des variables d'environnement.
set -e
esc() { printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g'; }
RELAY=false; [ -n "$SEERR_URL" ] && RELAY=true
cat > /usr/share/nginx/html/config.json <<JSON
{ "appName": "$(esc "$APP_NAME")", "server": "$(esc "$JELLYFIN_URL")", "seerrRelay": $RELAY, "homepage": "$(esc "$HOMEPAGE_URL")" }
JSON
SEERR_BLOCK=""
if [ -n "$SEERR_URL" ]; then
  SEERR_BLOCK="location /seerr/ {
    proxy_pass ${SEERR_URL%/}/;
    proxy_set_header Host \$proxy_host;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto \$scheme;
  }"
fi
cat > /etc/nginx/conf.d/bobine.conf <<CONF
server {
  listen 80;
  root /usr/share/nginx/html;
  index index.html;
  location / {
    add_header Cache-Control "no-cache";
    try_files \$uri \$uri/ /index.html;
  }
  $SEERR_BLOCK
}
CONF
echo "Bobine : Jellyfin=${JELLYFIN_URL:-(à saisir)} Seerr=${SEERR_URL:-(désactivé)}"
