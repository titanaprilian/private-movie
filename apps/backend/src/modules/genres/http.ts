import { Elysia, t } from "elysia";
import { UnauthorizedError, type AuthenticationService } from "@repo/contracts";
import { errorResponse, successResponse } from "../../lib/response";
import { createGenreRepositoryInternal } from "./internal/genres-repository";
import { GenreAlreadyExistsError, GenreNotFoundError } from "./internal/errors";

export interface GenreRoutesOptions {
  db: Parameters<typeof createGenreRepositoryInternal>[0];
  authService: AuthenticationService;
}

export const genreRoutes = (options: GenreRoutesOptions) => {
  const genreRepository = createGenreRepositoryInternal(options.db);

  return new Elysia({ name: "genre-routes" })
    .get(
      "/genres",
      async () => {
        const result = await genreRepository.findAll();
        return successResponse(result);
      }
    )
    .post(
      "/genres",
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
          const created = await genreRepository.create(body);
          set.status = 201;
          return successResponse(created);
        } catch (error) {
          if (error instanceof GenreAlreadyExistsError) {
            return errorResponse(set, 409, error);
          }
          throw error;
        }
      },
      {
        body: t.Object({
          name: t.String({ minLength: 1 }),
          slug: t.String({ minLength: 1 }),
        }),
      }
    )
    .put(
      "/genres/:id",
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
          const updated = await genreRepository.update(params.id, body);
          return successResponse(updated);
        } catch (error) {
          if (error instanceof GenreNotFoundError) {
            return errorResponse(set, 404, error);
          }
          if (error instanceof GenreAlreadyExistsError) {
            return errorResponse(set, 409, error);
          }
          throw error;
        }
      },
      {
        params: t.Object({
          id: t.String(),
        }),
        body: t.Object({
          name: t.String({ minLength: 1 }),
          slug: t.String({ minLength: 1 }),
        }),
      }
    )
    .delete(
      "/genres/:id",
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
          const deleted = await genreRepository.delete(params.id);
          return successResponse(deleted);
        } catch (error) {
          if (error instanceof GenreNotFoundError) {
            return errorResponse(set, 404, error);
          }
          throw error;
        }
      },
      {
        params: t.Object({
          id: t.String(),
        }),
      }
    );
};
