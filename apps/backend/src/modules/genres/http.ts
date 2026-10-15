import { Elysia } from "elysia";
import type { AuthenticationService } from "@repo/contracts";
import { successResponse } from "../../lib/response";
import { genreRepository } from "./internal/repository";
import { authGuard } from "../../lib/auth";
import {
  createGenreBody,
  createGenreDetail,
  deleteGenreDetail,
  genreIdParams,
  listGenresDetail,
  updateGenreBody,
  updateGenreDetail,
} from "./schemas";

export interface GenreRoutesOptions {
  db: Parameters<typeof genreRepository>[0];
  authService: AuthenticationService;
}

export const genreRoutes = (options: GenreRoutesOptions) => {
  const repository = genreRepository(options.db);
  const auth = authGuard(options.authService);

  return new Elysia({ name: "genre-routes" })
    .get("/genres", async () => successResponse(await repository.findAll()), {
      detail: listGenresDetail,
    })
    .post(
      "/genres",
      async ({ body, set }) => {
        const created = await repository.create(body);
        set.status = 201;
        return successResponse(created);
      },
      { beforeHandle: auth, body: createGenreBody, detail: createGenreDetail }
    )
    .put(
      "/genres/:id",
      async ({ params, body }) =>
        successResponse(await repository.update(params.id, body)),
      {
        beforeHandle: auth,
        params: genreIdParams,
        body: updateGenreBody,
        detail: updateGenreDetail,
      }
    )
    .delete(
      "/genres/:id",
      async ({ params }) =>
        successResponse(await repository.delete(params.id)),
      { beforeHandle: auth, params: genreIdParams, detail: deleteGenreDetail }
    );
};
