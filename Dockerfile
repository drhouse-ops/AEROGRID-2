# AEROGRID — Cloud Run deployment image
# Multi-stage: build frontend + bundle server, then run on a minimal Node image.

# ---- Stage 1: build ----
FROM node:20-slim AS build
WORKDIR /app

# Install dependencies (lockfile present)
COPY package.json package-lock.json ./
RUN npm ci

# Copy source and build (vite frontend + esbuild server bundle)
COPY . .
RUN npm run build

# ---- Stage 2: runtime ----
FROM node:20-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

# Only production deps needed; the server bundle keeps packages external.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Bundle output (frontend assets + server.cjs)
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules

EXPOSE 3000

# Cloud Run injects PORT; the server already listens on 0.0.0.0:3000.
CMD ["node", "dist/server.cjs"]
