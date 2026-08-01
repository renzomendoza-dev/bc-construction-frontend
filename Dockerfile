# ==============================================================================
# Stage 1: Build
# ==============================================================================
FROM node:22-alpine AS build

WORKDIR /build

# Copy only the manifest + lockfile first so `npm ci` is cached in its own
# layer and isn't invalidated by source-code-only changes.
COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npx ng build --configuration production

# ==============================================================================
# Stage 2: Runtime
# ==============================================================================
# This is a static SPA — nginx just serves the compiled output, no Node
# runtime needed in the final image.
FROM nginx:1.27-alpine

# SPA fallback (routes like /equipment or /inventory/items only exist client
# side; nginx must serve index.html for them instead of 404ing) plus basic
# static-asset caching. Angular's application builder always emits under a
# `browser/` subdirectory of the configured outputPath, whether or not SSR is
# enabled — see angular.json (outputPath defaults to dist/<project-name>).
COPY nginx.conf /etc/nginx/conf.d/default.conf

COPY --from=build /build/dist/bc-construction-frontend/browser /usr/share/nginx/html

# EXPOSE is documentation only — it doesn't publish the port by itself.
# Actual host<->container port publishing happens in docker-compose.yaml via
# the optional FRONTEND_PORT env var (defaults to 4200 on the host).
EXPOSE 80
