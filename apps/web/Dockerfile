FROM oven/bun:1 AS pruner
WORKDIR /app
COPY . .
RUN bunx turbo prune --scope=@repo/web --docker

FROM oven/bun:1 AS builder
WORKDIR /app
COPY --from=pruner /app/out/json/ .
COPY --from=pruner /app/out/bun.lock ./bun.lock
RUN bun install

COPY --from=pruner /app/out/full/ .
ARG VITE_API_URL=""
ENV VITE_API_URL=${VITE_API_URL}
RUN bunx turbo run build --filter=@repo/web...

FROM caddy:2-alpine AS runner

COPY --from=builder /app/apps/web/dist /srv
COPY --from=builder /app/apps/web/Caddyfile /etc/caddy/Caddyfile

EXPOSE 80
