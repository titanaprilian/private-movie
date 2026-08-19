FROM oven/bun:1 AS pruner
WORKDIR /app
COPY . .
RUN bunx turbo prune --scope=@repo/backend --docker

FROM oven/bun:1 AS builder
WORKDIR /app
COPY --from=pruner /app/out/json/ .
COPY --from=pruner /app/out/bun.lock ./bun.lock
RUN bun install

COPY --from=pruner /app/out/full/ .
RUN bunx turbo run build --filter=@repo/backend...

FROM oven/bun:1-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app .

EXPOSE 3000

CMD ["bun", "apps/backend/dist/index.js"]
