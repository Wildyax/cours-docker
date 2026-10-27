ARG NODE_VERSION=22
ARG NGINX_VERSION=1.27

# ---- Stage 1 : compilation TypeScript ----
FROM node:${NODE_VERSION}-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
COPY public ./public
RUN npm run build

# ---- Stage 2 : serveur nginx non-root ----
FROM nginxinc/nginx-unprivileged:${NGINX_VERSION}-alpine
COPY nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html
# Render injecte PORT ; 8080 par défaut en local
ENV PORT=8080
EXPOSE 8080
