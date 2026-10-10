export interface SeriesItem {
  id: string;
  title: string;
  synopsis: string;
  posterUrl: string;
  bannerUrl: string;
  logoUrl?: string | null;
  type: string;
  matchScore: string;
  year: number;
  rating: string;
  seasons: number;
  episodes: number;
  subDub: 'SUB' | 'DUB' | 'SUB | DUB';
  genres: string[];
}

export interface CarouselRowData {
  id: string;
  title: string;
  items: SeriesItem[];
}
