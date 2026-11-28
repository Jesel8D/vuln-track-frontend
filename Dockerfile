# syntax=docker/dockerfile:1
FROM node:24.22.3-alpine3.24@sha256:116b800c3754b440ee0aa3ed2f20f5bf3d99a554bfd9adeea09ea8017f6e85f5 AS build
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
