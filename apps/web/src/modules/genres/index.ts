export { GenreManager } from './internal/GenreManager';
export { GenreSeriesCatalog, GENRE_CATALOG_PAGE_LIMIT } from './internal/GenreSeriesCatalog';
export type { GenreCatalogFilter, GenreSeriesCatalogProps } from './internal/GenreSeriesCatalog';
export { fetchGenres, genresQueryOptions } from './internal/api';
export type {
  Genre,
  CreateGenreInput,
  UpdateGenreInput,
  GenreItem,
  CreateGenreRequest,
  UpdateGenreRequest,
} from './internal/api';

