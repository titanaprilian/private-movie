import { queryOptions } from '@tanstack/react-query';
import { api, extractErrorMessage } from '@/lib/api';
import type {
  GenreItem,
  CreateGenreRequest,
  UpdateGenreRequest,
} from '@repo/contracts';

export type Genre = GenreItem;
export type CreateGenreInput = CreateGenreRequest;
export type UpdateGenreInput = UpdateGenreRequest;

export type { GenreItem, CreateGenreRequest, UpdateGenreRequest };

export function slugifyGenre(name: string): string {
  return name
    .replace(/&/g, 'and')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export async function fetchGenres(): Promise<GenreItem[]> {
  const res = await api.genres.get();

  if (res.error || !res.data || !('data' in res.data) || !res.data.data) {
    throw new Error(extractErrorMessage(res.error, 'Failed to fetch genres'));
  }

  return res.data.data as GenreItem[];
}

export function genresQueryOptions() {
  return queryOptions({
    queryKey: ['genres'],
    queryFn: fetchGenres,
  });
}

export async function createGenre(input: CreateGenreRequest): Promise<GenreItem> {
  const res = await api.genres.post(input);

  if (res.error || !res.data || !('data' in res.data) || !res.data.data) {
    throw new Error(extractErrorMessage(res.error, 'Failed to create genre'));
  }

  return res.data.data as GenreItem;
}

export async function updateGenre(
  id: string,
  input: UpdateGenreRequest
): Promise<GenreItem> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const res = await (api.genres as any)[id].put(input);

  if (res.error || !res.data || !('data' in res.data) || !res.data.data) {
    throw new Error(extractErrorMessage(res.error, 'Failed to update genre'));
  }

  return res.data.data as GenreItem;
}

export async function deleteGenre(id: string): Promise<GenreItem> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const res = await (api.genres as any)[id].delete();

  if (res.error || !res.data || !('data' in res.data) || !res.data.data) {
    throw new Error(extractErrorMessage(res.error, 'Failed to delete genre'));
  }

  return res.data.data as GenreItem;
}
