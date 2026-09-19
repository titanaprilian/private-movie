import { describe, expect, it } from "vitest";
import type {
  GenreItem,
  CreateGenreRequest,
  UpdateGenreRequest,
  GenreResponse,
  AdminVideoSourceItem,
  AdminEpisodeItem,
  AdminSeasonItem,
  AdminSeriesItem,
  AdminSeriesDetails,
  AdminPresignUploadRequest,
} from "../src";

describe("domain contracts", () => {
  it("exports genre contract types correctly", () => {
    const genre: GenreItem = {
      id: "genre-1",
      name: "Action",
      slug: "action",
      isBigGenre: true,
      displayOrder: 1,
    };
    const createReq: CreateGenreRequest = {
      name: "Comedy",
      slug: "comedy",
      isBigGenre: false,
      displayOrder: 0,
    };
    const updateReq: UpdateGenreRequest = {
      name: "Action Comedy",
      slug: "action-comedy",
      isBigGenre: true,
      displayOrder: 2,
    };
    const resp: GenreResponse = {
      data: genre,
    };

    expect(genre.name).toBe("Action");
    expect(createReq.slug).toBe("comedy");
    expect(updateReq.name).toBe("Action Comedy");
    expect(resp.data.id).toBe("genre-1");
  });

  it("exports media management contract types correctly", () => {
    const source: AdminVideoSourceItem = {
      id: "src-1",
      type: "s3",
      url: "https://example.com/video.mp4",
      label: "1080p",
    };
    const episode: AdminEpisodeItem = {
      id: "ep-1",
      title: "Episode 1",
      videoSources: [source],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const season: AdminSeasonItem = {
      id: "s-1",
      seriesId: "ser-1",
      title: "Season 1",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      episodes: [episode],
    };
    const series: AdminSeriesItem = {
      id: "ser-1",
      sourceUrl: "https://example.com/series/1",
      source: "otakudesu",
      title: "Test Series",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const seriesDetails: AdminSeriesDetails = {
      ...series,
      seasons: [season],
      episodes: [episode],
    };
    const presignReq: AdminPresignUploadRequest = {
      filename: "test.mp4",
      contentType: "video/mp4",
    };

    expect(source.type).toBe("s3");
    expect(season.episodes).toHaveLength(1);
    expect(seriesDetails.title).toBe("Test Series");
    expect(presignReq.filename).toBe("test.mp4");
  });
});
