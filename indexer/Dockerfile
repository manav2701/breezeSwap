# Build context is the REPOSITORY ROOT, not this directory:
#
#   docker build -f indexer/Dockerfile -t breezeswap-indexer .
#
# The previous version copied `pnpm-lock.yaml` from the build context expecting
# it to sit beside this file. It does not — the lockfile belongs to the pnpm
# workspace at the repo root — so the image only ever built by accident.

FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@10.5.2 --activate
WORKDIR /app

# Manifests first, so a dependency-free code change reuses the install layer.
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY indexer/package.json ./indexer/
COPY sdk/package.json ./sdk/

RUN pnpm install --frozen-lockfile --filter breezeswap-indexer...

COPY indexer ./indexer
COPY sdk ./sdk

RUN pnpm --filter breezeswap-indexer build

WORKDIR /app/indexer

EXPOSE 3001

# Migrations run before the server every boot. They are recorded in
# `schema_migrations` and are a no-op once applied, so this is safe to repeat —
# and it is what keeps a deployed database from drifting behind the code.
CMD ["pnpm", "start"]
