import { Elysia, t } from "elysia";
import type { AuthenticationService } from "@repo/contracts";
import { successResponse } from "../../lib/response";
import { createGenreRepositoryInternal } from "./internal/genres-repository";
import { authGuard } from "../../lib/auth";

export interface GenreRoutesOptions {
  db: Parameters<typeof createGenreRepositoryInternal>[0];
  authService: AuthenticationService;
}

export const genreRoutes = (options: GenreRoutesOptions) => {
  const genreRepository = createGenreRepositoryInternal(options.db);
  const auth = authGuard(options.authService);

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
      async ({ body, set }) => {
        const created = await genreRepository.create(body);
        set.status = 201;
        return successResponse(created);
      },
      {
        beforeHandle: auth,
        body: t.Object({
          name: t.String({ minLength: 1 }),
          slug: t.String({ minLength: 1 }),
          isBigGenre: t.Optional(t.Boolean()),
          displayOrder: t.Optional(t.Number()),
        }),
      }
    )
    .put(
      "/genres/:id",
      async ({ params, body }) => {
        const updated = await genreRepository.update(params.id, body);
        return successResponse(updated);
      },
      {
        beforeHandle: auth,
        params: t.Object({
          id: t.String(),
        }),
        body: t.Object({
          name: t.String({ minLength: 1 }),
          slug: t.String({ minLength: 1 }),
          isBigGenre: t.Optional(t.Boolean()),
          displayOrder: t.Optional(t.Number()),
        }),
      }
    )
    .delete(
      "/genres/:id",
      async ({ params }) => {
        const deleted = await genreRepository.delete(params.id);
        return successResponse(deleted);
      },
      {
        beforeHandle: auth,
        params: t.Object({
          id: t.String(),
        }),
      }
    );
};
