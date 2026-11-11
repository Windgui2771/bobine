FROM nginx:alpine
LABEL org.opencontainers.image.title="Bobine" \
      org.opencontainers.image.description="Interface TV/PC moderne pour Jellyfin" \
      org.opencontainers.image.licenses="MIT"
COPY web/ /usr/share/nginx/html/
COPY docker/40-bobine.sh /docker-entrypoint.d/40-bobine.sh
RUN chmod +x /docker-entrypoint.d/40-bobine.sh && rm -f /etc/nginx/conf.d/default.conf
ENV APP_NAME="Bobine" JELLYFIN_URL="" SEERR_URL="" HOMEPAGE_URL=""
EXPOSE 80
