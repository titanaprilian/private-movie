import { queryOptions } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface Genre {
  id: string;
  name: string;
  slug: string;
  createdAt?: string | Date;
  updatedAt?: string | Date;
}

export interface CreateGenreInput {
  name: string;
  slug: string;
}

export interface UpdateGenreInput {
  name: string;
  slug: string;
}

export function slugifyGenre(name: string): string {
  return name
    .replace(/&/g, 'and')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function extractErrorMessage(error: unknown, fallback: string): string {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const value = (error as any)?.value;
  if (value) {
    if (typeof value.error?.message === 'string') return value.error.message;
    if (typeof value.message === 'string') return value.message;
  }
  return fallback;
}

export async function fetchGenres(): Promise<Genre[]> {
  const res = await api.genres.get();

  if (res.error || !res.data || !('data' in res.data) || !res.data.data) {
    throw new Error(extractErrorMessage(res.error, 'Failed to fetch genres'));
  }

  return res.data.data as Genre[];
}

export function genresQueryOptions() {
  return queryOptions({
    queryKey: ['genres'],
    queryFn: fetchGenres,
  });
}

export async function createGenre(input: CreateGenreInput): Promise<Genre> {
  const res = await api.genres.post(input);

  if (res.error || !res.data || !('data' in res.data) || !res.data.data) {
    throw new Error(extractErrorMessage(res.error, 'Failed to create genre'));
  }

  return res.data.data as Genre;
}

export async function updateGenre(
  id: string,
  input: UpdateGenreInput
): Promise<Genre> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const res = await (api.genres as any)[id].put(input);

  if (res.error || !res.data || !('data' in res.data) || !res.data.data) {
    throw new Error(extractErrorMessage(res.error, 'Failed to update genre'));
  }

  return res.data.data as Genre;
}

export async function deleteGenre(id: string): Promise<Genre> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const res = await (api.genres as any)[id].delete();

  if (res.error || !res.data || !('data' in res.data) || !res.data.data) {
    throw new Error(extractErrorMessage(res.error, 'Failed to delete genre'));
  }

  return res.data.data as Genre;
}
