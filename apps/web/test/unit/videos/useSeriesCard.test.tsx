import { renderHook, renderWithProviders, screen, fireEvent, act } from '../../utils';
import { describe, expect, it, vi } from 'vitest';
import { SeriesCard } from '@/modules/videos/internal/catalog/grid/components/SeriesCard';
import {
  getSeriesCardEpisodeCount,
  useSeriesCard,
} from '@/modules/videos/internal/catalog/grid/hooks/useSeriesCard';
import type { SeriesCardItem } from '@/modules/videos/internal/catalog/types';
import type { SeriesItem } from '@/modules/videos/internal/api';

vi.mock('@tanstack/react-router', () => ({
  Link: ({
    children,
    to,
    params,
    className,
    ...rest
  }: {
    children: React.ReactNode;
    to: string;
    params?: Record<string, string>;
    className?: string;
  }) => {
    const href = params ? to.replace('$seriesId', params.seriesId) : to;
    return (
      <a href={href} className={className} {...rest}>
        {children}
      </a>
    );
  },
  useSearch: () => ({ page: 1 }),
  useNavigate: () => vi.fn(),
}));

function makeItem(overrides: Partial<SeriesItem> = {}): SeriesCardItem {
  return {
    id: 'series-1',
    title: 'Solo Leveling',
    source: 'otakudesu',
    sourceUrl: 'https://example.com/s1',
    description: 'desc',
    posterUrl: 'https://example.com/poster.jpg',
    isFeatured: false,
    seasons: [],
    createdAt: '2025-01-12T00:00:00.000Z',
    updatedAt: '2025-01-12T00:00:00.000Z',
    ...overrides,
  } as unknown as SeriesCardItem;
}

describe('getSeriesCardEpisodeCount', () => {
  it('prefers episodes array length, falls back to episodeCount, defaults 0', () => {
    expect(getSeriesCardEpisodeCount(makeItem({ episodes: [{}, {}] } as never))).toBe(2);
    expect(getSeriesCardEpisodeCount(makeItem({ episodeCount: 7 } as never))).toBe(7);
    expect(getSeriesCardEpisodeCount(makeItem())).toBe(0);
  });
});

describe('useSeriesCard hook', () => {
  it('derives badges and image state', () => {
    const item = makeItem({
      isFeatured: true,
      isOngoingHighlighted: true,
      hasOngoing: true,
    } as never);
    const { result } = renderHook(() => useSeriesCard({ item }));
    expect(result.current.isFeatured).toBe(true);
    expect(result.current.isHighlighted).toBe(true);
    expect(result.current.isOngoing).toBe(true);
    expect(result.current.showImg).toBe(true);
    expect(result.current.initial).toBe('S');
    expect(result.current.episodeCount).toBe(0);
  });

  it('detects ongoing via seasons status', () => {
    const item = makeItem({ seasons: [{ status: 'ongoing' }] } as never);
    const { result } = renderHook(() => useSeriesCard({ item }));
    expect(result.current.isOngoing).toBe(true);
  });

  it('handleImageError hides the image', () => {
    const { result } = renderHook(() => useSeriesCard({ item: makeItem() }));
    expect(result.current.showImg).toBe(true);
    act(() => {
      result.current.handleImageError();
    });
    expect(result.current.imgFailed).toBe(true);
    expect(result.current.showImg).toBe(false);
  });

  it('stop() prevents default, stops propagation, and forwards item', () => {
    const item = makeItem();
    const { result } = renderHook(() => useSeriesCard({ item }));
    const fn = vi.fn();
    const e = { preventDefault: vi.fn(), stopPropagation: vi.fn() };
    const handler = result.current.stop(fn, item);
    handler(e as unknown as React.MouseEvent);
    expect(e.preventDefault).toHaveBeenCalledTimes(1);
    expect(e.stopPropagation).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith(item, e);
  });

  it('falls back to initial when poster missing', () => {
    const { result } = renderHook(() =>
      useSeriesCard({ item: makeItem({ posterUrl: null as unknown as string }) })
    );
    expect(result.current.showImg).toBe(false);
  });

  it('SeriesCard consumes the hook (smoke + propagation stop)', async () => {
    const onEdit = vi.fn();
    const onDelete = vi.fn();
    const parentClick = vi.fn();
    const { user } = renderWithProviders(
      <div onClick={parentClick}>
        <SeriesCard item={makeItem()} onToggleFeatured={vi.fn()} onEdit={onEdit} onDelete={onDelete} />
      </div>
    );
    expect(screen.getByTestId('series-card')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Edit Solo Leveling' }));
    expect(onEdit).toHaveBeenCalledTimes(1);
    expect(parentClick).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Delete Solo Leveling' }));
    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(parentClick).not.toHaveBeenCalled();

    fireEvent.error(screen.getByAltText('Solo Leveling'));
    expect(screen.getByTestId('series-poster-fallback')).toBeInTheDocument();
  });
});
