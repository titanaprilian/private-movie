import { t } from "elysia";

export const createGenreBody = t.Object({
  name: t.String({ minLength: 1 }),
  slug: t.String({ minLength: 1 }),
  isBigGenre: t.Optional(t.Boolean()),
  displayOrder: t.Optional(t.Number()),
});

export const updateGenreBody = t.Object({
  name: t.String({ minLength: 1 }),
  slug: t.String({ minLength: 1 }),
  isBigGenre: t.Optional(t.Boolean()),
  displayOrder: t.Optional(t.Number()),
});

export const genreIdParams = t.Object({
  id: t.String(),
});

export const listGenresDetail = {
  tags: ["Genres"],
  summary: "List genres",
  description: "Returns all genres ordered for display.",
};

export const createGenreDetail = {
  tags: ["Genres"],
  summary: "Create genre",
  description: "Creates a new genre. Requires authentication.",
};

export const updateGenreDetail = {
  tags: ["Genres"],
  summary: "Update genre",
  description: "Updates an existing genre by id. Requires authentication.",
};

export const deleteGenreDetail = {
  tags: ["Genres"],
  summary: "Delete genre",
  description: "Deletes a genre by id. Requires authentication.",
};
