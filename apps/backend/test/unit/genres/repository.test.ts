import { describe, expect, it } from "vitest";
import {
  GenreAlreadyExistsError,
  GenreNotFoundError,
  genreRepository,
} from "@/modules/genres";
import { db } from "../../utils/db";

describe("genre repository unit tests", () => {
  const repository = genreRepository(db);

  it("creates a genre and retrieves it with findById and findAll", async () => {
    const created = await repository.create({
      name: "Action",
      slug: "action",
      isBigGenre: true,
      displayOrder: 1,
    });

    expect(created.name).toBe("Action");
    expect(created.slug).toBe("action");
    expect(created.isBigGenre).toBe(true);
    expect(created.displayOrder).toBe(1);

    const found = await repository.findById(created.id);
    expect(found).not.toBeNull();
    expect(found?.id).toBe(created.id);

    const all = await repository.findAll();
    expect(all.length).toBe(1);
    expect(all[0].id).toBe(created.id);
  });

  it("returns null when findById is called with unknown ID", async () => {
    const found = await repository.findById(crypto.randomUUID());
    expect(found).toBeNull();
  });

  it("throws GenreAlreadyExistsError when creating duplicate name or slug", async () => {
    await repository.create({
      name: "Drama",
      slug: "drama",
    });

    await expect(
      repository.create({
        name: "Drama",
        slug: "other-slug",
      }),
    ).rejects.toBeInstanceOf(GenreAlreadyExistsError);

    await expect(
      repository.create({
        name: "Other Name",
        slug: "drama",
      }),
    ).rejects.toBeInstanceOf(GenreAlreadyExistsError);
  });

  it("updates an existing genre", async () => {
    const created = await repository.create({
      name: "Comedy",
      slug: "comedy",
    });

    const updated = await repository.update(created.id, {
      name: "Romantic Comedy",
      slug: "rom-com",
      isBigGenre: true,
      displayOrder: 2,
    });

    expect(updated.name).toBe("Romantic Comedy");
    expect(updated.slug).toBe("rom-com");
    expect(updated.isBigGenre).toBe(true);
    expect(updated.displayOrder).toBe(2);
  });

  it("throws GenreNotFoundError when updating non-existent genre", async () => {
    await expect(
      repository.update(crypto.randomUUID(), {
        name: "Ghost",
        slug: "ghost",
      }),
    ).rejects.toBeInstanceOf(GenreNotFoundError);
  });

  it("throws GenreAlreadyExistsError when updating to a conflicting name/slug", async () => {
    await repository.create({ name: "Horror", slug: "horror" });
    const g2 = await repository.create({ name: "Sci-Fi", slug: "sci-fi" });

    await expect(
      repository.update(g2.id, {
        name: "Horror",
        slug: "sci-fi-2",
      }),
    ).rejects.toBeInstanceOf(GenreAlreadyExistsError);
  });

  it("deletes a genre", async () => {
    const created = await repository.create({
      name: "Thriller",
      slug: "thriller",
    });

    const deleted = await repository.delete(created.id);
    expect(deleted.id).toBe(created.id);

    const found = await repository.findById(created.id);
    expect(found).toBeNull();
  });

  it("throws GenreNotFoundError when deleting non-existent genre", async () => {
    await expect(repository.delete(crypto.randomUUID())).rejects.toBeInstanceOf(
      GenreNotFoundError,
    );
  });

  it("instantiates error classes with default and custom messages", () => {
    const notFoundDefault = new GenreNotFoundError();
    expect(notFoundDefault.message).toBe("Genre not found");
    expect(notFoundDefault.name).toBe("GenreNotFoundError");

    const notFoundCustom = new GenreNotFoundError("Custom genre missing");
    expect(notFoundCustom.message).toBe("Custom genre missing");

    const existsDefault = new GenreAlreadyExistsError();
    expect(existsDefault.message).toBe(
      "Genre with this name or slug already exists",
    );
    expect(existsDefault.name).toBe("GenreAlreadyExistsError");

    const existsCustom = new GenreAlreadyExistsError("Custom already exists");
    expect(existsCustom.message).toBe("Custom already exists");
  });
});
