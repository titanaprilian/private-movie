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

FROM oven/bun:1 AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app .

# Official standalone 7-Zip for archive ingest (ZIP / RAR / 7z).
# Pinned version + sha256 so a compromised or silently-replaced mirror cannot
# change what the ingest engine executes. Debian's p7zip-full is NOT used:
# distro builds are frequently compiled without the RAR codec, which breaks RAR
# ingest with an opaque "Cannot open the file as archive" much later in a job.
ARG SEVEN_ZIP_VERSION=2603
ARG SEVEN_ZIP_SHA256=dc99eff5008f1ab79bd7084c68513701547a808a89502bf4133683535ab3c695
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates curl xz-utils \
    && curl -fsSL -o /tmp/7zz.tar.xz \
       "https://www.7-zip.org/a/7z${SEVEN_ZIP_VERSION}-linux-x64.tar.xz" \
    && echo "${SEVEN_ZIP_SHA256}  /tmp/7zz.tar.xz" | sha256sum -c - \
    && mkdir -p /opt/7zip \
    && tar -xJf /tmp/7zz.tar.xz -C /opt/7zip 7zz \
    && chmod 0755 /opt/7zip/7zz \
    && rm -f /tmp/7zz.tar.xz \
    && ln -s /opt/7zip/7zz /usr/local/bin/7zz \
    && rm -rf /var/lib/apt/lists/*

ENV ARCHIVE_7Z_BIN=/opt/7zip/7zz

# Install Chromium and its system dependencies for Playwright
RUN bun run --cwd packages/media-scraper playwright install chromium --with-deps

EXPOSE 3000

CMD ["bun", "apps/backend/src/index.ts"]
