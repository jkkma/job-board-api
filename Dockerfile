# syntax=docker/dockerfile:1

# node:22-slim rather than alpine: Prisma's query engine is built against
# glibc/OpenSSL, and running it on musl needs an extra binaryTarget plus a
# matching openssl package. Debian slim removes that whole failure class for
# roughly 40MB.
FROM node:22-slim AS base
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app


# --- build ------------------------------------------------------------------
# Full dependency tree, so tsc and the Prisma generator are available.
FROM base AS build
COPY package.json package-lock.json ./
RUN npm ci
COPY prisma ./prisma
COPY tsconfig.json tsconfig.build.json ./
COPY src ./src
RUN npx prisma generate && npm run build


# --- runtime ----------------------------------------------------------------
FROM base AS runtime
ENV NODE_ENV=production
ENV PORT=5000

COPY package.json package-lock.json ./
# The `prisma` CLI is a runtime dependency on purpose: the container applies
# `prisma migrate deploy` on start, so it has to ship with the image.
RUN npm ci --omit=dev && npm cache clean --force

COPY prisma ./prisma
RUN npx prisma generate

COPY --from=build /app/dist ./dist

# Drop root. The image is read-only at runtime — nothing is written to disk.
USER node

EXPOSE 5000

# Uses the readiness probe, so an instance that cannot reach Postgres is
# reported unhealthy rather than merely "process is alive".
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/health/ready').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# No dumb-init/tini: src/server.ts installs its own SIGTERM and SIGINT
# handlers, drains the server, and disconnects Prisma before exiting, so PID 1
# does the right thing on its own.
CMD ["node", "dist/src/server.js"]
