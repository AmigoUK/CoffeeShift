# --- build stage ------------------------------------------------------------
FROM node:22-alpine AS build
WORKDIR /app

# Dependencies first for layer caching
COPY package.json package-lock.json ./
RUN npm ci

# Sources and production build (prebuild regenerates public/icons from sprite data)
COPY . .
RUN npm run build

# --- serve stage ------------------------------------------------------------
FROM nginx:alpine AS serve
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY docker/security-headers.conf /etc/nginx/snippets/security-headers.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
