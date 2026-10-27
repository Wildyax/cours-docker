ARG ALPINE_VERSION=3.21
ARG NGINX_VERSION=1.27

# ---- Stage 1 : préparation des fichiers statiques ----
FROM alpine:${ALPINE_VERSION} AS build
WORKDIR /site
COPY public/ ./

# ---- Stage 2 : serveur nginx non-root ----
FROM nginxinc/nginx-unprivileged:${NGINX_VERSION}-alpine
COPY nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /site /usr/share/nginx/html
# Render injecte PORT ; 8080 par défaut en local
ENV PORT=8080
EXPOSE 8080
