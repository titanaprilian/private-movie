export interface GenreItem {
  id: string;
  name: string;
  slug: string;
  isBigGenre: boolean;
  displayOrder: number;
  createdAt?: string | Date;
  updatedAt?: string | Date;
}

export interface CreateGenreRequest {
  name: string;
  slug: string;
  isBigGenre?: boolean;
  displayOrder?: number;
}

export interface UpdateGenreRequest {
  name: string;
  slug: string;
  isBigGenre?: boolean;
  displayOrder?: number;
}

export type GenreResponse = {
  data: GenreItem;
};

export type GenresListResponse = {
  data: GenreItem[];
};
