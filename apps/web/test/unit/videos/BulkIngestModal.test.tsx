import { renderWithProviders, screen, waitFor } from '../../utils';
import { cleanup } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { BulkIngestModal } from '@/modules/videos/internal/BulkIngestModal';
import * as api from '@/modules/videos/internal/api';

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

vi.mock('@/modules/videos/internal/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/modules/videos/internal/api')>();
  return {
    ...actual,
    remoteIngestEpisodeVideoSource: vi.fn(),
  };
});

const mockLocalEpisodes = [
  { id: 'ep-1', title: 'Intro to Deep Modules', order: 1 },
  { id: 'ep-2', title: 'TanStack Router Setup', order: 2 },
  { id: 'ep-3', title: 'State Management', order: 3 },
];

const mockSeasons = [
  {
    id: 's1',
    title: 'Season 1',
    tmdbSeason: 1,
    episodes: mockLocalEpisodes,
  },
];

describe('BulkIngestModal component', () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.remoteIngestEpisodeVideoSource).mockResolvedValue({
      id: 'ep-1',
      title: 'Ingested Ep',
      videoSources: [],
      createdAt: '',
      updatedAt: '',
    });
  });

  it('renders nothing when open is false', () => {
    const { container } = renderWithProviders(
      <BulkIngestModal
        open={false}
        onOpenChange={vi.fn()}
        seriesId="series-100"
        localEpisodes={mockLocalEpisodes}
        seasons={mockSeasons}
      />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('renders Step 1 form when open', () => {
    renderWithProviders(
      <BulkIngestModal
        open={true}
        onOpenChange={vi.fn()}
        seriesId="series-100"
        localEpisodes={mockLocalEpisodes}
        seasons={mockSeasons}
      />
    );

    expect(screen.getByText('Bulk Remote Video Ingest')).toBeInTheDocument();
    expect(screen.getByTestId('bulk-ingest-urls-textarea')).toBeInTheDocument();
    expect(screen.getByLabelText(/Target Season/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Default Quality/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Default Source Label/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Shared HTTP Referer/i)).toBeInTheDocument();
    expect(screen.getByTestId('bulk-ingest-parse-btn')).toBeInTheDocument();
  });

  it('parses URLs and moves to Step 2 upon submitting valid URLs', async () => {
    const { user } = renderWithProviders(
      <BulkIngestModal
        open={true}
        onOpenChange={vi.fn()}
        seriesId="series-100"
        localEpisodes={mockLocalEpisodes}
        seasons={mockSeasons}
      />
    );

    const textarea = screen.getByTestId('bulk-ingest-urls-textarea');
    await user.type(
      textarea,
      'https://cdn.com/Teach.You.a.Lesson.E01.1080p.mp4\nhttps://cdn.com/random_hash_99.mp4'
    );

    await user.click(screen.getByTestId('bulk-ingest-parse-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('bulk-ingest-row-0')).toBeInTheDocument();
      expect(screen.getByTestId('bulk-ingest-row-1')).toBeInTheDocument();
    });

    expect(screen.getByText('Teach.You.a.Lesson.E01.1080p.mp4')).toBeInTheDocument();
    expect(screen.getByText('Needs Review')).toBeInTheDocument();
    expect(screen.getByTestId('bulk-ingest-start-btn')).toBeInTheDocument();
  });

  it('allows manual combobox re-matching and row editing in Step 2', async () => {
    const { user } = renderWithProviders(
      <BulkIngestModal
        open={true}
        onOpenChange={vi.fn()}
        seriesId="series-100"
        localEpisodes={mockLocalEpisodes}
        seasons={mockSeasons}
      />
    );

    const textarea = screen.getByTestId('bulk-ingest-urls-textarea');
    await user.type(textarea, 'https://cdn.com/random_hash_99.mp4');
    await user.click(screen.getByTestId('bulk-ingest-parse-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('bulk-ingest-row-0')).toBeInTheDocument();
    });

    const comboboxTrigger = screen.getByRole('combobox', { name: /Target episode for random_hash_99.mp4/i });
    expect(comboboxTrigger).toHaveTextContent('-- Skip / Unmapped --');

    await user.click(comboboxTrigger);
    const ep2Option = await screen.findByText(/Ep 2: TanStack Router Setup/i);
    await user.click(ep2Option);

    expect(comboboxTrigger).toHaveTextContent('Ep 2: TanStack Router Setup');
    expect(screen.queryByText('Needs Review')).not.toBeInTheDocument();
  });

  it('transitions to Step 3, displays progress, and completes execution calling remoteIngestEpisodeVideoSource', async () => {
    const onOpenChange = vi.fn();

    const { user } = renderWithProviders(
      <BulkIngestModal
        open={true}
        onOpenChange={onOpenChange}
        seriesId="series-100"
        localEpisodes={mockLocalEpisodes}
        seasons={mockSeasons}
      />
    );

    const textarea = screen.getByTestId('bulk-ingest-urls-textarea');
    await user.type(textarea, 'https://cdn.com/Teach.You.a.Lesson.E01.1080p.mp4');
    await user.click(screen.getByTestId('bulk-ingest-parse-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('bulk-ingest-start-btn')).toBeInTheDocument();
    });

    await user.click(screen.getByTestId('bulk-ingest-start-btn'));

    await waitFor(() => {
      expect(screen.getByRole('progressbar')).toBeInTheDocument();
      expect(screen.getByTestId('bulk-ingest-logs')).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(api.remoteIngestEpisodeVideoSource).toHaveBeenCalledWith(
        'ep-1',
        expect.objectContaining({
          url: 'https://cdn.com/Teach.You.a.Lesson.E01.1080p.mp4',
        })
      );
    });

    const closeBtn = await screen.findByTestId('bulk-ingest-close-btn');
    await user.click(closeBtn);

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
