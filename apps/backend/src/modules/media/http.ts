import { InternalServerError } from "../../lib/errors";
import { Elysia, t } from "elysia";
import {
  MVP_MEDIA_OPENAPI,
  UnauthorizedError,
  type AuthenticationService,
} from "@repo/contracts";
import { errorResponse, successResponse } from "../../lib/response";
import {
  createSaveEpisodeService,
  createEpisodeRepositoryInternal,
  createSeriesRepositoryInternal,
  createSeasonsRepositoryInternal,
  createVideoSourceRepositoryInternal,
  EpisodeFetchError,
  EpisodeNotFoundError,
  SeasonNotFoundError,
  SeasonNotEmptyError,
  SeasonNotLinkedToTmdbError,
  SeriesFetchError,
  SeriesNotFoundError,
  VideoSourceNotFoundError,
  TmdbFetchError,
  type FetchFn,
  type BrowserFn,
  type S3StorageService,
} from "@repo/media-service";
import { EpisodeMissingFieldsError, EpisodeParseError, SeriesParseError, MirrorResolveError } from "@repo/media-scraper";

export interface MediaRoutesOptions {
  db: Parameters<typeof createSaveEpisodeService>[0];
  authService: AuthenticationService;
  fetchHtml?: FetchFn;
  browserFn?: BrowserFn;
  s3StorageService?: S3StorageService;
}

/**
 * Root-level route for the embed sandbox bootstrap.
 * Registers at `/embed/:hash` (not under `/api` prefix).
 */
export const embedRoutes = () => {
  return new Elysia({ name: "embed-routes" })
    .get(
      "/embed/:hash",
      async ({ params }) => {
        const { hash } = params;
        
        // Generate the HTML bootstrap document that:
        // 1. Registers the Service Worker
        // 2. Waits for activation and claims control
        // 3. Fetches the actual embed HTML from /api/media/proxy-embed
        // 4. Injects it via document.write()
        const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Video Embed</title>
</head>
<body>
  <script>
    (async () => {
      // Register the Service Worker
      if ('serviceWorker' in navigator) {
        try {
          const registration = await navigator.serviceWorker.register('/media-proxy-sw.js');
          
          // Force network update of the Service Worker to prevent caching stale logic
          await registration.update();
          
          // Wait for the service worker to be active and claim control
          await navigator.serviceWorker.ready;
          
          // Force the service worker to claim this page immediately
          if (registration.active) {
            await registration.active.postMessage({ type: 'CLAIM_CLIENTS' });
          }
          
          // Wait a bit to ensure clients.claim() has completed
          await new Promise(resolve => setTimeout(resolve, 100));
          
          // Now fetch the actual embed HTML from proxy-embed
          // The hash will be used to construct the actual videobello URL, preserving query parameters
          const queryParams = window.location.search;
          const embedUrl = '/api/media/proxy-embed?url=' + encodeURIComponent('https://videobello.net/embed/${hash}' + queryParams);
          const response = await fetch(embedUrl);
          
          if (!response.ok) {
            document.body.innerHTML = '<p>Failed to load embed content</p>';
            return;
          }
          
          const embedHtml = await response.text();
          
          // Inject the embed HTML into the document
          document.open();
          document.write(embedHtml);
          document.close();
        } catch (error) {
          console.error('Service Worker registration failed:', error);
          document.body.innerHTML = '<p>Service Worker failed to load</p>';
        }
      } else {
        document.body.innerHTML = '<p>Service Workers are not supported in this browser</p>';
      }
    })();
  </script>
</body>
</html>`;

        return new Response(html, {
          status: 200,
          headers: {
            "Content-Type": "text/html; charset=utf-8",
          },
        });
      },
      {
        params: t.Object({
          hash: t.String(),
        }),
      }
    );
};

export const mediaRoutes = (options: MediaRoutesOptions) => {
  const mediaService = createSaveEpisodeService(options.db, {
    fetchHtml: options.fetchHtml,
    browserFn: options.browserFn,
    s3StorageService: options.s3StorageService,
  });
  const episodeRepository = createEpisodeRepositoryInternal(options.db);
  const seriesRepository = createSeriesRepositoryInternal(options.db);
  const seasonsRepository = createSeasonsRepositoryInternal(options.db);
  const videoSourceRepository = createVideoSourceRepositoryInternal(options.db);

  return new Elysia({ name: "media-routes" })
    .get("/openapi.json", () => MVP_MEDIA_OPENAPI)
    .get(
      "/media/proxy-embed",
      async ({ query, set }) => {
        try {
          const parsedUrl = new URL(query.url);
          const origin = parsedUrl.origin;
          const res = await fetch(query.url, {
            headers: {
              Referer: "https://dramula.com",
            },
          });
          if (!res.ok) {
            return errorResponse(
              set,
              res.status,
              new Error(`Failed to fetch embed content: ${res.statusText}`)
            );
          }
          const html = await res.text();
          let modifiedHtml = html;
          if (/(<head[^>]*>)/i.test(modifiedHtml)) {
            modifiedHtml = modifiedHtml.replace(
              /(<head[^>]*>)/i,
              `$1<base href="${origin}/">`
            );
          } else if (/(<html[^>]*>)/i.test(modifiedHtml)) {
            modifiedHtml = modifiedHtml.replace(
              /(<html[^>]*>)/i,
              `$1<head><base href="${origin}/"></head>`
            );
          } else {
            modifiedHtml = `<base href="${origin}/">${modifiedHtml}`;
          }
          return new Response(modifiedHtml, {
            status: 200,
            headers: {
              "Content-Type": "text/html; charset=utf-8",
            },
          });
        } catch (error) {
          return errorResponse(
            set,
            400,
            error instanceof Error ? error : new Error("Invalid URL or fetch failed")
          );
        }
      },
      {
        query: t.Object({
          url: t.String(),
        }),
      }
    )
    .all(
      "/media/relay",
      async ({ query, set, request }) => {
        try {
          // Validate URL parameter
          if (!query.url) {
            return errorResponse(
              set,
              400,
              new Error("Missing required 'url' query parameter")
            );
          }

          // Parse and validate the target URL
          let targetUrl: URL;
          try {
            targetUrl = new URL(query.url);
          } catch {
            return errorResponse(
              set,
              400,
              new Error("Invalid URL format")
            );
          }

          // Build headers for the outbound request
          const outboundHeaders: Record<string, string> = {
            // Spoof the Referer to bypass CDN restrictions
            Referer: "https://dramula.com",
          };

          // Forward safe headers from the client
          request.headers.forEach((value, key) => {
            const lowerKey = key.toLowerCase();
            const unsafeHeaders = ['host', 'origin', 'referer', 'cookie', 'connection', 'accept-encoding'];
            if (!unsafeHeaders.includes(lowerKey)) {
              outboundHeaders[key] = value;
            }
          });

          // Fetch from the target URL with spoofed headers and corresponding method/body
          const targetResponse = await fetch(targetUrl.toString(), {
            method: request.method,
            headers: outboundHeaders,
            body: ['GET', 'HEAD'].includes(request.method.toUpperCase()) ? undefined : await request.clone().arrayBuffer()
          });

          // If target returns error, pass it through
          if (!targetResponse.ok) {
            return errorResponse(
              set,
              targetResponse.status,
              new Error(`Target server returned ${targetResponse.status}: ${targetResponse.statusText}`)
            );
          }

          // Stream the response directly without buffering
          // Preserve important headers from the target response
          const responseHeaders: HeadersInit = {};
          
          const contentType = targetResponse.headers.get("Content-Type");
          if (contentType) {
            responseHeaders["Content-Type"] = contentType;
          }

          const contentLength = targetResponse.headers.get("Content-Length");
          if (contentLength) {
            responseHeaders["Content-Length"] = contentLength;
          }

          const contentRange = targetResponse.headers.get("Content-Range");
          if (contentRange) {
            responseHeaders["Content-Range"] = contentRange;
          }

          const acceptRanges = targetResponse.headers.get("Accept-Ranges");
          if (acceptRanges) {
            responseHeaders["Accept-Ranges"] = acceptRanges;
          }

          // Return the stream directly
          return new Response(targetResponse.body, {
            status: targetResponse.status,
            headers: responseHeaders,
          });
        } catch (error) {
          return errorResponse(
            set,
            500,
            error instanceof Error ? error : new Error("Relay request failed")
          );
        }
      },
      {
        query: t.Object({
          url: t.String(),
        }),
      }
    )
    .get(
      "/episodes",
      async ({ query }) => {
        const page = query.page ?? 1;
        const limit = query.limit ?? 20;
        const { seasonId } = query;
        const result = await episodeRepository.list({
          page,
          limit,
          seasonId,
        });
        return successResponse({
          episodes: result.episodes,
          meta: {
            total: result.total,
            page,
            limit,
          },
        });
      },
      {
        query: t.Object({
          page: t.Optional(t.Number({ default: 1, minimum: 1 })),
          limit: t.Optional(t.Number({ default: 20, minimum: 1, maximum: 100 })),
          seasonId: t.Optional(t.String()),
        }),
      }
    )
    .get(
      "/episodes/:id",
      async ({ params, set }) => {
        const episode = await episodeRepository.findById(params.id);
        if (!episode) {
          return errorResponse(
            set,
            404,
            new EpisodeNotFoundError(`Episode with id ${params.id} not found`)
          );
        }
        return successResponse(episode);
      },
      {
        params: t.Object({
          id: t.String(),
        }),
      }
    )
    .post(
      "/episodes/:id/sources",
      async ({ params, body, headers, set }) => {
        const authHeader = headers["authorization"];
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
          return errorResponse(
            set,
            401,
            new UnauthorizedError("missing or invalid authorization header")
          );
        }
        const token = authHeader.substring(7);
        try {
          await options.authService.verifyAccessToken(token);
        } catch {
          return errorResponse(set, 401, new UnauthorizedError("unauthorized"));
        }

        const episode = await episodeRepository.findById(params.id);
        if (!episode) {
          return errorResponse(
            set,
            404,
            new EpisodeNotFoundError(`Episode with id ${params.id} not found`)
          );
        }

        for (const source of body.videoSources) {
          await videoSourceRepository.upsert({
            episodeId: params.id,
            type: source.type,
            url: source.url,
            label: source.label,
            quality: source.quality ?? null,
          });
        }

        const updated = await episodeRepository.findById(params.id);
        return successResponse(updated);
      },
      {
        params: t.Object({
          id: t.String({ format: "uuid" }),
        }),
        body: t.Object({
          videoSources: t.Array(
            t.Object({
              type: t.Union([t.Literal("embed"), t.Literal("direct")]),
              url: t.String(),
              label: t.String(),
              quality: t.Optional(t.Nullable(t.String())),
            })
          ),
        }),
      }
    )
    .post(
      "/episodes/:id/scrape-sources",
      async ({ params, body, headers, set }) => {
        const authHeader = headers["authorization"];
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
          return errorResponse(
            set,
            401,
            new UnauthorizedError("missing or invalid authorization header")
          );
        }
        const token = authHeader.substring(7);
        try {
          await options.authService.verifyAccessToken(token);
        } catch {
          return errorResponse(set, 401, new UnauthorizedError("unauthorized"));
        }

        try {
          const result = await mediaService.scrapeAndSaveSources(
            params.id,
            body.sourceUrl
          );
          return successResponse(result);
        } catch (error) {
          if (error instanceof EpisodeNotFoundError) {
            return errorResponse(set, 404, error);
          }
          if (
            error instanceof EpisodeFetchError ||
            error instanceof EpisodeParseError ||
            error instanceof MirrorResolveError
          ) {
            return errorResponse(set, 400, error);
          }
          throw error;
        }
      },
      {
        params: t.Object({
          id: t.String(),
        }),
        body: t.Object({
          sourceUrl: t.String({ format: "uri" }),
        }),
      }
    )
    .patch(
      "/episodes/:id/sources/:sourceId",
      async ({ params, body, headers, set }) => {
        const authHeader = headers["authorization"];
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
          return errorResponse(
            set,
            401,
            new UnauthorizedError("missing or invalid authorization header")
          );
        }
        const token = authHeader.substring(7);
        try {
          await options.authService.verifyAccessToken(token);
        } catch {
          return errorResponse(set, 401, new UnauthorizedError("unauthorized"));
        }

        const episode = await episodeRepository.findById(params.id);
        if (!episode) {
          return errorResponse(
            set,
            404,
            new EpisodeNotFoundError(`Episode with id ${params.id} not found`)
          );
        }

        const source = await videoSourceRepository.findById(params.sourceId);
        if (!source || source.episodeId !== params.id) {
          return errorResponse(
            set,
            404,
            new VideoSourceNotFoundError(
              `Video source with id ${params.sourceId} not found`
            )
          );
        }

        await videoSourceRepository.update(params.sourceId, body);

        const updatedEpisode = await episodeRepository.findById(params.id);
        return successResponse(updatedEpisode);
      },
      {
        params: t.Object({
          id: t.String({ format: "uuid" }),
          sourceId: t.String(),
        }),
        body: t.Object({
          type: t.Optional(t.Union([t.Literal("embed"), t.Literal("direct")])),
          url: t.Optional(t.String()),
          label: t.Optional(t.String()),
          quality: t.Optional(t.Nullable(t.String())),
        }),
      }
    )
    .delete(
      "/episodes/:id/sources/:sourceId",
      async ({ params, headers, set }) => {
        const authHeader = headers["authorization"];
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
          return errorResponse(
            set,
            401,
            new UnauthorizedError("missing or invalid authorization header")
          );
        }
        const token = authHeader.substring(7);
        try {
          await options.authService.verifyAccessToken(token);
        } catch {
          return errorResponse(set, 401, new UnauthorizedError("unauthorized"));
        }

        const episode = await episodeRepository.findById(params.id);
        if (!episode) {
          return errorResponse(
            set,
            404,
            new EpisodeNotFoundError(`Episode with id ${params.id} not found`)
          );
        }

        const source = await videoSourceRepository.findById(params.sourceId);
        if (!source || source.episodeId !== params.id) {
          return errorResponse(
            set,
            404,
            new VideoSourceNotFoundError(
              `Video source with id ${params.sourceId} not found`
            )
          );
        }

        await videoSourceRepository.delete(params.sourceId);

        const updatedEpisode = await episodeRepository.findById(params.id);
        return successResponse(updatedEpisode);
      },
      {
        params: t.Object({
          id: t.String({ format: "uuid" }),
          sourceId: t.String(),
        }),
      }
    )
    .post(
      "/preview-scrape",
      async ({ body, headers, set }) => {
        const authHeader = headers["authorization"];
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
          return errorResponse(
            set,
            401,
            new UnauthorizedError("missing or invalid authorization header")
          );
        }
        const token = authHeader.substring(7);
        try {
          await options.authService.verifyAccessToken(token);
        } catch {
          return errorResponse(set, 401, new UnauthorizedError("unauthorized"));
        }

        try {
          const result = await mediaService.previewScrape(body);
          return successResponse(result);
        } catch (error) {
          if (error instanceof EpisodeFetchError) {
            return errorResponse(set, 400, error);
          }
          if (error instanceof EpisodeMissingFieldsError) {
            return errorResponse(set, 400, error);
          }
          if (error instanceof EpisodeParseError) {
            return errorResponse(set, 400, error);
          }
          if (error instanceof MirrorResolveError) {
            return errorResponse(set, 400, error);
          }
          throw error;
        }
      },
      {
        body: t.Object({
          sourceUrl: t.String({ format: "uri" }),
          source: t.Union([t.Literal("otakudesu"), t.Literal("dramula")]),
          html: t.Optional(t.String()),
        }),
      }
    )
    .post(
      "/preview-scrape-series",
      async ({ body, headers, set }) => {
        const authHeader = headers["authorization"];
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
          return errorResponse(
            set,
            401,
            new UnauthorizedError("missing or invalid authorization header")
          );
        }
        const token = authHeader.substring(7);
        try {
          await options.authService.verifyAccessToken(token);
        } catch {
          return errorResponse(set, 401, new UnauthorizedError("unauthorized"));
        }

        try {
          const result = await mediaService.previewScrapeSeries(body);
          return successResponse(result);
        } catch (error) {
          if (error instanceof SeriesFetchError) {
            return errorResponse(set, 400, error);
          }
          if (error instanceof SeriesParseError) {
            return errorResponse(set, 400, error);
          }
          throw error;
        }
      },
      {
        body: t.Object({
          sourceUrl: t.String({ format: "uri" }),
          source: t.Union([t.Literal("otakudesu"), t.Literal("dramula")]),
          html: t.Optional(t.String()),
        }),
      }
    )
    .post(
      "/save-media",
      async ({ body, headers, set }) => {
        const authHeader = headers["authorization"];
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
          return errorResponse(
            set,
            401,
            new UnauthorizedError("missing or invalid authorization header")
          );
        }
        const token = authHeader.substring(7);
        try {
          await options.authService.verifyAccessToken(token);
        } catch {
          return errorResponse(set, 401, new UnauthorizedError("unauthorized"));
        }

        const saved = await mediaService.saveMedia({
          ...body,
          episode: {
            ...body.episode,
            metadata: body.episode.metadata ?? {},
          },
        });
        return successResponse(saved);
      },
      {
        body: t.Object({
          episode: t.Object({
            sourceUrl: t.String({ format: "uri" }),
            source: t.Union([t.Literal("otakudesu"), t.Literal("dramula")]),
            title: t.String(),
            videoType: t.Optional(t.Nullable(t.String())),
            videoSources: t.Optional(
              t.Array(
                t.Object({
                  type: t.Union([t.Literal("embed"), t.Literal("direct")]),
                  url: t.String(),
                  label: t.String(),
                  quality: t.Optional(t.Nullable(t.String())),
                })
              )
            ),
            metadata: t.Optional(t.Record(t.String(), t.Unknown())),
          }),
          series: t.Optional(
            t.Nullable(
              t.Object({
                sourceUrl: t.String({ format: "uri" }),
                source: t.Union([t.Literal("otakudesu"), t.Literal("dramula")]),
                title: t.String(),
                description: t.Nullable(t.String()),
                posterUrl: t.Nullable(t.String()),
              })
            )
          ),
        }),
      }
    )
    .patch(
      "/episodes/:id",
      async ({ params, body, headers, set }) => {
        const authHeader = headers["authorization"];
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
          return errorResponse(
            set,
            401,
            new UnauthorizedError("missing or invalid authorization header")
          );
        }
        const token = authHeader.substring(7);
        try {
          await options.authService.verifyAccessToken(token);
        } catch {
          return errorResponse(set, 401, new UnauthorizedError("unauthorized"));
        }

        try {
          const updated = await episodeRepository.updateEpisode(params.id, body);
          return successResponse(updated);
        } catch (error) {
          if (error instanceof EpisodeNotFoundError) {
            return errorResponse(set, 404, error);
          }
          throw error;
        }
      },
      {
        params: t.Object({
          id: t.String({ format: "uuid" }),
        }),
        body: t.Object({
          title: t.Optional(t.String()),
          description: t.Optional(t.Nullable(t.String())),
        }),
      }
    )
    .delete(
      "/episodes/:id",
      async ({ params, headers, set }) => {
        const authHeader = headers["authorization"];
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
          return errorResponse(
            set,
            401,
            new UnauthorizedError("missing or invalid authorization header")
          );
        }
        const token = authHeader.substring(7);
        try {
          await options.authService.verifyAccessToken(token);
        } catch {
          return errorResponse(set, 401, new UnauthorizedError("unauthorized"));
        }

        try {
          const deleted = await episodeRepository.deleteEpisode(params.id);
          return successResponse(deleted);
        } catch (error) {
          if (error instanceof EpisodeNotFoundError) {
            return errorResponse(set, 404, error);
          }
          throw error;
        }
      },
      {
        params: t.Object({
          id: t.String({ format: "uuid" }),
        }),
      }
    )
    .get(
      "/series",
      async ({ query }) => {
        const page = query.page ?? 1;
        const limit = query.limit ?? 20;
        const { source, q, genre } = query;
        const result = await seriesRepository.list({
          page,
          limit,
          source,
          q,
          genre,
        });
        return successResponse({
          series: result.series,
          meta: {
            total: result.total,
            page,
            limit,
          },
        });
      },
      {
        query: t.Object({
          page: t.Optional(t.Number({ default: 1, minimum: 1 })),
          limit: t.Optional(t.Number({ default: 20, minimum: 1, maximum: 100 })),
          source: t.Optional(t.Union([t.Literal("otakudesu"), t.Literal("dramula")])),
          q: t.Optional(t.String()),
          genre: t.Optional(t.String()),
        }),
      }
    )
    .get(
      "/series/home-feed",
      async () => {
        const feed = await seriesRepository.getHomeFeed();
        return successResponse(feed);
      }
    )
    .get(
      "/series/:id",
      async ({ params, set }) => {
        const s = await seriesRepository.findByIdWithEpisodes(params.id);
        if (!s) {
          return errorResponse(
            set,
            404,
            new SeriesNotFoundError(`Series with id ${params.id} not found`)
          );
        }
        return successResponse(s);
      },
      {
        params: t.Object({
          id: t.String(),
        }),
      }
    )
    .post(
      "/series/:id/preview-bulk-sources",
      async ({ params, body, headers, set }) => {
        const authHeader = headers["authorization"];
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
          return errorResponse(
            set,
            401,
            new UnauthorizedError("missing or invalid authorization header")
          );
        }
        const token = authHeader.substring(7);
        try {
          await options.authService.verifyAccessToken(token);
        } catch {
          return errorResponse(set, 401, new UnauthorizedError("unauthorized"));
        }

        try {
          const result = await mediaService.previewBulkSources({
            seriesId: params.id,
            sourceUrl: body.sourceUrl,
            source: body.source,
            episodeOffset: body.episodeOffset,
            seasonId: body.seasonId,
            html: body.html,
          });
          return successResponse(result);
        } catch (error) {
          if (error instanceof SeriesNotFoundError) {
            return errorResponse(set, 404, error);
          }
          if (error instanceof SeriesFetchError || error instanceof SeriesParseError) {
            return errorResponse(set, 400, error);
          }
          throw error;
        }
      },
      {
        params: t.Object({
          id: t.String(),
        }),
        body: t.Object({
          sourceUrl: t.String({ format: "uri" }),
          source: t.Union([t.Literal("otakudesu"), t.Literal("dramula")]),
          episodeOffset: t.Optional(t.Number()),
          seasonId: t.Optional(t.String()),
          html: t.Optional(t.String()),
        }),
      }
    )

    // --- TMDB MANUAL MATCH START ---
    .post(
      "/series/tmdb-import",
      async ({ body, headers, set }) => {
        const authHeader = headers["authorization"];
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
          return errorResponse(
            set,
            401,
            new UnauthorizedError("missing or invalid authorization header")
          );
        }
        const token = authHeader.substring(7);
        try {
          await options.authService.verifyAccessToken(token);
        } catch {
          return errorResponse(set, 401, new UnauthorizedError("unauthorized"));
        }

        try {
          const result = await mediaService.importTmdb({
            type: body.type,
            tmdbId: body.tmdbId,
            includeSpecials: body.includeSpecials,
          });
          return successResponse(result);
        } catch (e: unknown) {
          if (e instanceof TmdbFetchError) {
            return errorResponse(set, e.status === 404 ? 404 : 400, e);
          }
          if (e instanceof Error) {
            return errorResponse(set, 400, e);
          }
          return errorResponse(set, 500, new InternalServerError());
        }
      },
      {
        body: t.Object({
          type: t.Union([t.Literal("tv"), t.Literal("movie")]),
          tmdbId: t.Numeric(),
          includeSpecials: t.Optional(t.Boolean()),
        }),
      }
    )
    .get(
      "/series/:id/tmdb-preview",
      async ({ query: q, set }) => {
        try {
          const type = q.type as "movie" | "tv";
          const data = await mediaService.getTmdbPreview(type, q.tmdbId, q.season);
          return successResponse(data);
        } catch (e: unknown) {
          if (e instanceof TmdbFetchError) {
            return errorResponse(set, e.status === 404 ? 404 : 400, e);
          }
          return errorResponse(set, 500, new InternalServerError());
        }
      },
      {
        query: t.Object({
          type: t.Union([t.Literal("movie"), t.Literal("tv")]),
          tmdbId: t.Numeric(),
          season: t.Optional(t.Numeric()),
        }),
      }
    )
    .post(
      "/series/:id/tmdb-match",
      async ({ params, body, headers, set }) => {
        const authHeader = headers["authorization"];
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
          return errorResponse(set, 401, new UnauthorizedError("missing or invalid authorization header"));
        }
        const token = authHeader.substring(7);
        try {
          await options.authService.verifyAccessToken(token);
        } catch {
          return errorResponse(set, 401, new UnauthorizedError("unauthorized"));
        }
        
        try {
          const updated = await mediaService.matchTmdb({
            seriesId: params.id,
            type: body.type,
            tmdbId: body.tmdbId,
            season: body.season,
            localSeasonId: body.localSeasonId,
          });
          return successResponse(updated);
        } catch (e: unknown) {
          if (e instanceof SeriesNotFoundError) {
            return errorResponse(set, 404, e);
          }
          if (e instanceof TmdbFetchError) {
            return errorResponse(set, e.status === 404 ? 404 : 400, e);
          }
          return errorResponse(set, 500, new InternalServerError());
        }
      },
      {
        params: t.Object({ id: t.String() }),
        body: t.Object({
          type: t.Union([t.Literal("movie"), t.Literal("tv")]),
          tmdbId: t.Numeric(),
          season: t.Optional(t.Numeric()),
          localSeasonId: t.Optional(t.String()),
        }),
      }
    )
    .post(
      "/series/:id/seasons/merge",
      async ({ params, body, headers, set }) => {
        const authHeader = headers["authorization"];
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
          return errorResponse(
            set,
            401,
            new UnauthorizedError("missing or invalid authorization header")
          );
        }
        const token = authHeader.substring(7);
        try {
          await options.authService.verifyAccessToken(token);
        } catch {
          return errorResponse(set, 401, new UnauthorizedError("unauthorized"));
        }

        try {
          const result = await mediaService.mergeSeasons({
            seriesId: params.id,
            orderedSeasonIds: body.orderedSeasonIds,
          });
          return successResponse(result);
        } catch (error: unknown) {
          if (error instanceof SeriesNotFoundError) {
            return errorResponse(set, 404, error);
          }
          if (error instanceof SeasonNotFoundError) {
            return errorResponse(set, 404, error);
          }
          if (error instanceof Error) {
            return errorResponse(set, 400, error);
          }
          return errorResponse(set, 500, new InternalServerError());
        }
      },
      {
        params: t.Object({ id: t.String() }),
        body: t.Object({
          orderedSeasonIds: t.Array(t.String(), { minItems: 1 }),
        }),
      }
    )
    .post(
      "/series/:id/seasons",
      async ({ params, body, headers, set }) => {
        const authHeader = headers["authorization"];
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
          return errorResponse(
            set,
            401,
            new UnauthorizedError("missing or invalid authorization header")
          );
        }
        const token = authHeader.substring(7);
        try {
          await options.authService.verifyAccessToken(token);
        } catch {
          return errorResponse(set, 401, new UnauthorizedError("unauthorized"));
        }

        const seriesRow = await seriesRepository.findById(params.id);
        if (!seriesRow) {
          return errorResponse(
            set,
            404,
            new SeriesNotFoundError(`Series with id ${params.id} not found`)
          );
        }

        try {
          const created = await seasonsRepository.create({
            seriesId: params.id,
            title: body.title,
            description: body.description ?? null,
            posterUrl: body.posterUrl ?? null,
          });
          return successResponse(created);
        } catch (error: unknown) {
          if (error instanceof SeasonNotFoundError) {
            return errorResponse(set, 404, error);
          }
          throw error;
        }
      },
      {
        params: t.Object({ id: t.String({ format: "uuid" }) }),
        body: t.Object({
          title: t.String({ minLength: 1 }),
          description: t.Optional(t.Nullable(t.String())),
          posterUrl: t.Optional(t.Nullable(t.String())),
        }),
      }
    )
    .get(
      "/seasons/:id",
      async ({ params, set }) => {
        const season = await seasonsRepository.findById(params.id);
        if (!season) {
          return errorResponse(
            set,
            404,
            new SeasonNotFoundError(`Season with id ${params.id} not found`)
          );
        }
        return successResponse(season);
      },
      {
        params: t.Object({
          id: t.String(),
        }),
      }
    )
    .get(
      "/seasons/:id/episodes/tmdb-preview",
      async ({ params, query: q, set }) => {
        try {
          const data = await mediaService.getSeasonTmdbPreview(params.id, {
            tmdbId: q.tmdbId,
            tmdbSeason: q.tmdbSeason,
          });
          return successResponse(data);
        } catch (e: unknown) {
          const err = e as Error;
          if (e instanceof SeasonNotFoundError || err?.name === "SeasonNotFoundError") {
            return errorResponse(set, 404, err);
          }
          if (e instanceof SeasonNotLinkedToTmdbError || err?.name === "SeasonNotLinkedToTmdbError") {
            return errorResponse(set, 400, err);
          }
          if (e instanceof TmdbFetchError || err?.name === "TmdbFetchError") {
            const tmdbErr = e as TmdbFetchError;
            return errorResponse(set, tmdbErr.status === 404 ? 404 : 400, tmdbErr);
          }
          console.error("[tmdb-preview error]", e);
          return errorResponse(set, 500, new InternalServerError());
        }
      },
      {
        params: t.Object({
          id: t.String(),
        }),
        query: t.Object({
          tmdbId: t.Optional(t.Numeric()),
          tmdbSeason: t.Optional(t.Numeric()),
        }),
      }
    )
    .post(
      "/seasons/:id/episodes/tmdb-sync",
      async ({ params, body, headers, set }) => {
        const authHeader = headers["authorization"];
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
          return errorResponse(
            set,
            401,
            new UnauthorizedError("missing or invalid authorization header")
          );
        }
        const token = authHeader.substring(7);
        try {
          await options.authService.verifyAccessToken(token);
        } catch {
          return errorResponse(set, 401, new UnauthorizedError("unauthorized"));
        }

        try {
          const result = await mediaService.syncSeasonTmdb(params.id, {
            tmdbId: body?.tmdbId,
            tmdbSeason: body?.tmdbSeason,
          });
          return successResponse(result);
        } catch (e: unknown) {
          const err = e as Error;
          if (e instanceof SeasonNotFoundError || err?.name === "SeasonNotFoundError") {
            return errorResponse(set, 404, err);
          }
          if (e instanceof SeasonNotLinkedToTmdbError || err?.name === "SeasonNotLinkedToTmdbError") {
            return errorResponse(set, 400, err);
          }
          if (e instanceof TmdbFetchError || err?.name === "TmdbFetchError") {
            const tmdbErr = e as TmdbFetchError;
            return errorResponse(set, tmdbErr.status === 404 ? 404 : 400, tmdbErr);
          }
          console.error("[tmdb-sync error]", e);
          return errorResponse(set, 500, new InternalServerError());
        }
      },
      {
        params: t.Object({
          id: t.String(),
        }),
        body: t.Optional(
          t.Object({
            tmdbId: t.Optional(t.Numeric()),
            tmdbSeason: t.Optional(t.Numeric()),
          })
        ),
      }
    )
    .patch(
      "/seasons/:id",
      async ({ params, body, headers, set }) => {
        const authHeader = headers["authorization"];
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
          return errorResponse(
            set,
            401,
            new UnauthorizedError("missing or invalid authorization header")
          );
        }
        const token = authHeader.substring(7);
        try {
          await options.authService.verifyAccessToken(token);
        } catch {
          return errorResponse(set, 401, new UnauthorizedError("unauthorized"));
        }

        try {
          const updated = await seasonsRepository.updateSeason(params.id, {
            ...(body.title !== undefined ? { title: body.title } : {}),
            ...(body.description !== undefined ? { description: body.description } : {}),
            ...(body.posterUrl !== undefined ? { posterUrl: body.posterUrl } : {}),
            ...(body.status !== undefined ? { status: body.status } : {}),
          });
          return successResponse(updated);
        } catch (error: unknown) {
          if (error instanceof SeasonNotFoundError) {
            return errorResponse(set, 404, error);
          }
          throw error;
        }
      },
      {
        params: t.Object({ id: t.String({ format: "uuid" }) }),
        body: t.Object({
          title: t.Optional(t.String({ minLength: 1 })),
          description: t.Optional(t.Nullable(t.String())),
          posterUrl: t.Optional(t.Nullable(t.String())),
          status: t.Optional(t.String()),
        }),
      }
    )
    .delete(
      "/seasons/:id",
      async ({ params, headers, set }) => {
        const authHeader = headers["authorization"];
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
          return errorResponse(
            set,
            401,
            new UnauthorizedError("missing or invalid authorization header")
          );
        }
        const token = authHeader.substring(7);
        try {
          await options.authService.verifyAccessToken(token);
        } catch {
          return errorResponse(set, 401, new UnauthorizedError("unauthorized"));
        }

        try {
          await seasonsRepository.deleteSeason(params.id);
          return successResponse({ deleted: true });
        } catch (error: unknown) {
          if (error instanceof SeasonNotFoundError) {
            return errorResponse(set, 404, error);
          }
          if (error instanceof SeasonNotEmptyError) {
            return errorResponse(set, 409, error);
          }
          throw error;
        }
      },
      {
        params: t.Object({ id: t.String({ format: "uuid" }) }),
      }
    )
    // --- TMDB MANUAL MATCH END ---
    
    .put(
      "/series/:id",
      async ({ params, body, headers, set }) => {
        const authHeader = headers["authorization"];
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
          return errorResponse(
            set,
            401,
            new UnauthorizedError("missing or invalid authorization header")
          );
        }
        const token = authHeader.substring(7);
        try {
          await options.authService.verifyAccessToken(token);
        } catch {
          return errorResponse(set, 401, new UnauthorizedError("unauthorized"));
        }

        try {
          const updated = await seriesRepository.updateSeries(params.id, body);
          return successResponse(updated);
        } catch (error) {
          if (error instanceof SeriesNotFoundError) {
            return errorResponse(set, 404, error);
          }
          throw error;
        }
      },
      {
        params: t.Object({
          id: t.String({ format: "uuid" }),
        }),
        body: t.Object({
          title: t.Optional(t.String()),
          description: t.Optional(t.Nullable(t.String())),
          posterUrl: t.Optional(t.Nullable(t.String())),
          isFeatured: t.Optional(t.Boolean()),
          genreIds: t.Optional(t.Array(t.String())),
          relations: t.Optional(
            t.Array(
              t.Object({
                relatedSeriesId: t.String(),
                relationType: t.String(),
              })
            )
          ),
        }),
      }
    )
    .patch(
      "/series/:id",
      async ({ params, body, headers, set }) => {
        const authHeader = headers["authorization"];
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
          return errorResponse(
            set,
            401,
            new UnauthorizedError("missing or invalid authorization header")
          );
        }
        const token = authHeader.substring(7);
        try {
          await options.authService.verifyAccessToken(token);
        } catch {
          return errorResponse(set, 401, new UnauthorizedError("unauthorized"));
        }

        try {
          const updated = await seriesRepository.updateSeries(params.id, body);
          return successResponse(updated);
        } catch (error) {
          if (error instanceof SeriesNotFoundError) {
            return errorResponse(set, 404, error);
          }
          throw error;
        }
      },
      {
        params: t.Object({
          id: t.String({ format: "uuid" }),
        }),
        body: t.Object({
          title: t.Optional(t.String()),
          description: t.Optional(t.Nullable(t.String())),
          posterUrl: t.Optional(t.Nullable(t.String())),
          isFeatured: t.Optional(t.Boolean()),
          genreIds: t.Optional(t.Array(t.String())),
          relations: t.Optional(
            t.Array(
              t.Object({
                relatedSeriesId: t.String(),
                relationType: t.String(),
              })
            )
          ),
        }),
      }
    )
    .patch(
      "/series/:id/episodes/order",
      async ({ params, body, headers, set }) => {
        const authHeader = headers["authorization"];
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
          return errorResponse(
            set,
            401,
            new UnauthorizedError("missing or invalid authorization header")
          );
        }
        const token = authHeader.substring(7);
        try {
          await options.authService.verifyAccessToken(token);
        } catch {
          return errorResponse(set, 401, new UnauthorizedError("unauthorized"));
        }

        const seriesRow = await seriesRepository.findById(params.id);
        if (!seriesRow) {
          return errorResponse(
            set,
            404,
            new SeriesNotFoundError(`Series with id ${params.id} not found`)
          );
        }

        try {
          await episodeRepository.updateOrders(body);
          return successResponse({ success: true });
        } catch (error) {
          if (error instanceof EpisodeNotFoundError) {
            return errorResponse(set, 404, error);
          }
          throw error;
        }
      },
      {
        params: t.Object({
          id: t.String({ format: "uuid" }),
        }),
        body: t.Array(
          t.Object({
            id: t.String({ format: "uuid" }),
            order: t.Number(),
            seasonId: t.Optional(t.String({ format: "uuid" })),
          })
        ),
      }
    )
    .delete(
      "/series/:id",
      async ({ params, headers, set }) => {
        const authHeader = headers["authorization"];
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
          return errorResponse(
            set,
            401,
            new UnauthorizedError("missing or invalid authorization header")
          );
        }
        const token = authHeader.substring(7);
        try {
          await options.authService.verifyAccessToken(token);
        } catch {
          return errorResponse(set, 401, new UnauthorizedError("unauthorized"));
        }

        try {
          const deleted = await seriesRepository.deleteSeries(params.id);
          return successResponse(deleted);
        } catch (error) {
          if (error instanceof SeriesNotFoundError) {
            return errorResponse(set, 404, error);
          }
          throw error;
        }
      },
      {
        params: t.Object({
          id: t.String({ format: "uuid" }),
        }),
      }
    );
};