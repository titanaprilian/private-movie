export interface GenreItem {
  id: string;
  name: string;
  slug: string;
  createdAt?: string | Date;
  updatedAt?: string | Date;
}

export interface CreateGenreRequest {
  name: string;
  slug: string;
}

export interface UpdateGenreRequest {
  name: string;
  slug: string;
}

export type GenreResponse = {
  data: GenreItem;
};

export type GenresListResponse = {
  data: GenreItem[];
};
