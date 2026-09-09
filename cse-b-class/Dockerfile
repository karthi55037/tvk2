# ---- deps ----
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ---- build ----
FROM node:20-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# DATABASE_URL is only needed at runtime; a dummy keeps any build-time import happy
ENV DATABASE_URL=file:/tmp/build.db \
    NEXT_TELEMETRY_DISABLED=1 \
    NEXT_OUTPUT=standalone
RUN npm run build

# ---- run ----
FROM node:20-alpine AS run
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    NEXT_TELEMETRY_DISABLED=1
# non-root user; /data holds the SQLite DB and uploaded files (mount a volume here)
RUN addgroup -S app && adduser -S app -G app \
    && mkdir -p /data/storage && chown -R app:app /data

COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
# migrations + seed script run on boot (migrate is idempotent)
COPY --from=build /app/drizzle ./drizzle
COPY --from=build /app/scripts ./scripts
COPY --from=build /app/drizzle.config.ts ./drizzle.config.ts
COPY --from=build /app/package.json ./package.json

USER app
EXPOSE 3000
VOLUME /data

# Apply migrations, optionally seed (SEED_DEMO=1), then serve.
# DATABASE_URL should point at /data (e.g. file:/data/app.db) and STORAGE_DIR at /data/storage.
CMD ["sh", "-c", "node scripts/migrate.mjs && { [ \"$SEED_DEMO\" = '1' ] && node prisma/seed.mjs || true; } && node server.js"]
