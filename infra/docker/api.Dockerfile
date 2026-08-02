# syntax=docker/dockerfile:1
# Build de contexte : à lancer depuis la racine du monorepo
# (docker build -f infra/docker/api.Dockerfile .)
FROM node:20.11.0-alpine AS base
RUN corepack enable

FROM base AS pruner
WORKDIR /repo
COPY . .
RUN npx turbo prune @tripplanner/api --docker

FROM base AS build
WORKDIR /repo
COPY --from=pruner /repo/out/json/ .
RUN pnpm install --frozen-lockfile
COPY --from=pruner /repo/out/full/ .
RUN pnpm --filter=@tripplanner/api exec prisma generate \
  && pnpm turbo run build --filter=@tripplanner/api...

FROM node:20.11.0-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup -S tripplanner && adduser -S tripplanner -G tripplanner
COPY --from=build /repo/apps/api/dist ./dist
COPY --from=build /repo/apps/api/prisma ./prisma
COPY --from=build /repo/apps/api/package.json ./package.json
COPY --from=build /repo/node_modules ./node_modules
COPY --from=build /repo/apps/api/node_modules ./apps/api/node_modules
USER tripplanner
EXPOSE 3000
CMD ["node", "dist/main.js"]
