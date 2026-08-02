# syntax=docker/dockerfile:1
# Build de contexte : à lancer depuis la racine du monorepo
# (docker build -f infra/docker/web.Dockerfile .)
FROM node:20.11.0-alpine AS base
RUN corepack enable

FROM base AS pruner
WORKDIR /repo
COPY . .
RUN npx turbo prune @tripplanner/web --docker

FROM base AS build
WORKDIR /repo
COPY --from=pruner /repo/out/json/ .
RUN pnpm install --frozen-lockfile
COPY --from=pruner /repo/out/full/ .
RUN pnpm turbo run build --filter=@tripplanner/web...

FROM node:20.11.0-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup -S tripplanner && adduser -S tripplanner -G tripplanner
COPY --from=build /repo/apps/web/public ./apps/web/public
COPY --from=build /repo/apps/web/.next ./apps/web/.next
COPY --from=build /repo/apps/web/package.json ./apps/web/package.json
COPY --from=build /repo/node_modules ./node_modules
COPY --from=build /repo/apps/web/node_modules ./apps/web/node_modules
USER tripplanner
WORKDIR /app/apps/web
EXPOSE 3000
CMD ["node_modules/.bin/next", "start"]
