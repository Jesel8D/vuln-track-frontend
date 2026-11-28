# syntax=docker/dockerfile:1
FROM node:24.12.0-alpine@sha256:c921b97d4b74f51744057454b306b418cf693865e73b8100559189605f6955b8 AS build
WORKDIR /web
COPY package.json package-lock.json ./
RUN --mount=type=secret,id=proxy_ca NODE_EXTRA_CA_CERTS=/run/secrets/proxy_ca npm ci --ignore-scripts --audit=false
COPY . .
ARG VITE_NVD_MODE=disabled
ENV VITE_API_URL=same-origin VITE_NVD_MODE=${VITE_NVD_MODE}
RUN npm run build
FROM caddy:2.11.9-alpine@sha256:003a97808e781aa9f7e75cc2f43d34d461099031faf5e20faefb9f61126836f0
COPY --from=build /web/dist /srv
USER 10001:10001
