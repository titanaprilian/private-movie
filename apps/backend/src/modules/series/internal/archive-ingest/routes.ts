import { Elysia } from "elysia";
import { createStorageProviderRegistry } from "@repo/media-service";
import { authGuard } from "../../../../lib/auth";
import { successResponse, errorResponse } from "../../../../lib/response";
import { SeriesNotFoundError } from "../errors";
import { createSeriesRepository } from "../catalog/repository";
import { ArchiveIngestJobManager } from "./services/job";
import { createArchiveIngestRepository } from "./repository";
import { createVideoSourceRepositoryInternal } from "@repo/media-service";
import type { SeriesRoutesOptions } from "../../schemas";
import {
  archiveJobConfirmBodySchema,
  archiveJobCreateBodySchema,
  archiveJobParamsSchema,
  archiveJobPollQuerySchema,
  archiveJobRetryBodySchema,
  seriesUuidParamsSchema,
} from "../../schemas";

export const archiveIngestRoutes = (options: SeriesRoutesOptions) => {
  const auth = authGuard(options.authService);
  const storageRegistry =
    options.storageProviderRegistry ??
    createStorageProviderRegistry(options.db, options.s3StorageService);

  const seriesRepository = createSeriesRepository(options.db, {
    s3StorageService: options.s3StorageService,
    storageProviderRegistry: storageRegistry,
  });

  const repository = createArchiveIngestRepository(options.db);
  const videoSourceRepository = createVideoSourceRepositoryInternal(
    options.db,
    {
      s3StorageService: options.s3StorageService,
      storageProviderRegistry: storageRegistry,
    },
  );

  const archiveJobService =
    options.archiveJobService ??
    new ArchiveIngestJobManager({
      repository,
      videoSourceRepository,
      s3StorageService: options.s3StorageService,
      storageProviderRegistry: storageRegistry,
      ...(options.archiveFetchFn ? { fetchFn: options.archiveFetchFn } : {}),
      ...(options.archiveStagingBaseDir
        ? { stagingBaseDir: options.archiveStagingBaseDir }
        : { stagingBaseDir: "/tmp/archive-ingest-staging" }),
    });
  return new Elysia({ name: "series-archive-ingest-routes" })
    .post(
      "/series/:id/archive-ingest/jobs",
      async ({ params, body, headers }) => {
        const seriesRow = await seriesRepository.findById(params.id);
        if (!seriesRow) {
          throw new SeriesNotFoundError(
            `Series with id ${params.id} not found`,
          );
        }
        const token = (headers["authorization"] ?? "").replace(
          /^Bearer\s+/i,
          "",
        );
        const ownerId = await options.authService.verifyAccessToken(token);
        const job = await archiveJobService.submitJob(ownerId, {
          sourceUrl: body.sourceUrl,
          seriesId: params.id,
          storageProviderId: body.storageProviderId ?? null,
          password: body.password ?? null,
          referer: body.referer ?? null,
        });
        return successResponse(job);
      },
      {
        beforeHandle: auth,
        detail: {
          tags: ["Series"],
          summary: "Start archive ingest job",
          description:
            "Starts a new durable archive ingest job for the series or returns an existing active job for the same source. Returns HTTP 200 in both cases. Requires authentication.",
        },
        params: seriesUuidParamsSchema,
        body: archiveJobCreateBodySchema,
      },
    )
    .get(
      "/series/:id/archive-ingest/jobs/:jobId",
      async ({ params, query, set }) => {
        const job = await archiveJobService.getJob(params.jobId);
        if (!job) {
          return errorResponse(set, 404, new Error("Job not found"));
        }
        if (query?.summary === true) {
          return successResponse(archiveJobService.toJobProgress(job));
        }
        return successResponse(job);
      },
      {
        beforeHandle: auth,
        detail: {
          tags: ["Series"],
          summary: "Poll archive ingest job",
          description:
            "Returns the current state, progress, entries, and error details of an archive ingest job. Pass ?summary=true during the upload phase for a lightweight progress payload without entries/selection. Requires authentication.",
        },
        params: archiveJobParamsSchema,
        query: archiveJobPollQuerySchema,
      },
    )
    .post(
      "/series/:id/archive-ingest/jobs/:jobId/confirm",
      async ({ params, body, set }) => {
        const job = await archiveJobService.getJob(params.jobId);
        if (!job) {
          return errorResponse(set, 404, new Error("Job not found"));
        }
        try {
          const confirmed = await archiveJobService.confirmJob(
            params.jobId,
            body.selection.map((item) => ({
              filename: item.filename,
              episodeId: item.episodeId ?? null,
              label: item.label ?? null,
              quality: item.quality ?? null,
              isIgnored: item.isIgnored ?? false,
            })),
            {
              storageProviderId: body.storageProviderId ?? null,
              password: body.password ?? null,
            },
          );
          return successResponse(confirmed);
        } catch (err) {
          return errorResponse(
            set,
            422,
            err instanceof Error ? err : new Error(String(err)),
          );
        }
      },
      {
        beforeHandle: auth,
        detail: {
          tags: ["Series"],
          summary: "Confirm archive ingest job selection",
          description:
            "Submits the user's episode-file match selection and starts the sequential upload phase. Requires authentication.",
        },
        params: archiveJobParamsSchema,
        body: archiveJobConfirmBodySchema,
      },
    )
    .post(
      "/series/:id/archive-ingest/jobs/:jobId/cancel",
      async ({ params, set }) => {
        const cancelled = await archiveJobService.cancelJob(params.jobId);
        if (!cancelled) {
          return errorResponse(set, 404, new Error("Job not found"));
        }
        return successResponse(cancelled);
      },
      {
        beforeHandle: auth,
        detail: {
          tags: ["Series"],
          summary: "Cancel archive ingest job",
          description:
            "Cancels an active archive ingest job, aborts its running download/upload, and purges its staging directory. Requires authentication.",
        },
        params: archiveJobParamsSchema,
      },
    )
    .post(
      "/series/:id/archive-ingest/jobs/:jobId/retry",
      async ({ params, body, set }) => {
        const job = await archiveJobService.getJob(params.jobId);
        if (!job) {
          return errorResponse(set, 404, new Error("Job not found"));
        }
        try {
          const retried = await archiveJobService.retryJob(params.jobId, {
            password: body?.password ?? null,
          });
          return successResponse(retried);
        } catch (err) {
          return errorResponse(
            set,
            422,
            err instanceof Error ? err : new Error(String(err)),
          );
        }
      },
      {
        beforeHandle: auth,
        detail: {
          tags: ["Series"],
          summary: "Retry failed archive ingest job",
          description:
            "Retries a previously failed archive ingest job, re-running the download pipeline from the beginning. An optional password is forwarded for password-protected archives. Requires authentication.",
        },
        params: archiveJobParamsSchema,
        body: archiveJobRetryBodySchema,
      },
    );
};
