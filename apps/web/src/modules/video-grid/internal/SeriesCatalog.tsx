import { dummySeries } from './types';
import { SeriesCard } from './SeriesCard';

export interface SeriesCatalogProps {
  onNavigate: (seriesId: string) => void;
}

export function SeriesCatalog({ onNavigate }: SeriesCatalogProps) {
  return (
    <>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-lg font-semibold">Series</h1>
          <p className="text-xs text-muted">
            Browse and manage your series collection.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {dummySeries.map((series) => (
          <SeriesCard
            key={series.id}
            series={series}
            onClick={() => onNavigate(series.id)}
          />
        ))}
      </div>
    </>
  );
}