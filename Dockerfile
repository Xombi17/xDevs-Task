# syntax=docker/dockerfile:1
FROM node:24-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
# better-sqlite3 13 ships prebuilt binaries; add python3 make g++ here only if that download ever fails.
RUN npm ci

FROM node:24-slim AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build && npm run build:seed

# Used only by the compose "demo" profile (dev server, tamper demo enabled).
FROM node:24-slim AS dev
WORKDIR /app
ENV NODE_ENV=development
COPY --from=deps --chown=node:node /app/node_modules ./node_modules
COPY --chown=node:node . .
# /app itself must be writable by user node so `next dev` can create .next
RUN mkdir -p /app/data && chown node:node /app /app/data
USER node
EXPOSE 3000
VOLUME /app/data
CMD ["sh", "-c", "npx tsx scripts/seed.ts && npm run dev:demo -- -H 0.0.0.0"]

FROM node:24-slim AS runner
WORKDIR /app
ENV NODE_ENV=production \
    HOSTNAME=0.0.0.0 \
    PORT=3000 \
    DB_PATH=/app/data/signseal.db \
    NEXT_TELEMETRY_DISABLED=1
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/seed.mjs ./seed.mjs
COPY docker-entrypoint.sh ./docker-entrypoint.sh
RUN mkdir -p /app/data && chown -R node:node /app/data && chmod +x docker-entrypoint.sh
VOLUME /app/data
USER node
EXPOSE 3000
ENTRYPOINT ["./docker-entrypoint.sh"]
