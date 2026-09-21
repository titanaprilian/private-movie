import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { GenreSeriesCatalog, type GenreCatalogFilter } from '@/modules/genres';

const genreCatalogSearchSchema = z.object({
  filter: z.enum(['all', 'ongoing']).optional().default('all'),
});

export type GenreCatalogSearch = z.infer<typeof genreCatalogSearchSchema>;

export const Route = createFileRoute('/genres/$slug')({
  validateSearch: (search: Record<string, unknown>): GenreCatalogSearch => {
    return genreCatalogSearchSchema.parse(search);
  },
  component: GenreCatalogPage,
});

function GenreCatalogPage() {
  const { slug } = Route.useParams();
  const { filter } = Route.useSearch();
  const navigate = Route.useNavigate();

  const handleFilterChange = (next: GenreCatalogFilter) => {
    navigate({ search: { filter: next }, replace: true });
  };

  return <GenreSeriesCatalog slug={slug} filter={filter} onFilterChange={handleFilterChange} />;
}
