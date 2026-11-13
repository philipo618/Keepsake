# Production container for Keepsake Express API + FFmpeg video transcoding
FROM node:22-bookworm-slim AS builder

WORKDIR /app

# Install dependencies first for layer caching
COPY package.json package-lock.json* ./
RUN if [ -f package-lock.json ]; then npm ci; else npm install --no-audit --no-fund; fi

# Copy application source
COPY . .

# Build frontend bundle (for direct Cloud Run preview) & compile production Express server
ENV VITE_BASE_PATH=/
ENV VITE_API_BASE_URL=
RUN npm run build && \
    npx esbuild server.ts \
      --bundle \
      --platform=node \
      --format=esm \
      --packages=external \
      --outfile=dist-server/server.mjs && \
    npm prune --omit=dev

# Final lightweight runtime image with FFmpeg
FROM node:22-bookworm-slim AS runtime

RUN apt-get update && \
    apt-get install -y --no-install-recommends ffmpeg ca-certificates && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080

COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/firebase-applet-config.json ./firebase-applet-config.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/dist-server ./dist-server

RUN mkdir -p /app/data/uploads

EXPOSE 8080

CMD ["node", "dist-server/server.mjs"]
