import { renderWithProviders, screen, within } from '../../utils';
import { describe, expect, it, vi, afterEach } from 'vitest';
import { StorageResourceTable } from '@/modules/storage/internal/components/StorageResourceTable';
import { ChunkyCopyButton } from '@/components/ui/chunky-copy-button';
import type { StorageResource } from '@/modules/storage/internal/api';

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}));

function episodeResource(
  overrides: Partial<StorageResource> & Pick<StorageResource, 'key' | 'filename'>,
): StorageResource {
  return {
    id: overrides.key,
    sizeBytes: 100,
    lastModified: '2026-09-01T10:00:00.000Z',
    status: 'linked',
    ...overrides,
  } as StorageResource;
}

const linkedResources: StorageResource[] = [
  episodeResource({
    key: 'shows/s1e3.mp4',
    filename: 's1e3.mp4',
    sizeBytes: 300,
    lastModified: '2026-09-03T10:00:00.000Z',
    videoSource: { id: 'src-3', label: 'Main', quality: '1080p', episodeId: 'ep-3' },
    episode: {
      id: 'ep-3',
      title: 'Ep Three',
      episodeNumber: 3,
      seasonNumber: 1,
      seriesId: 'series-1',
      seriesTitle: 'Cyberpunk Series',
      sourceCount: 1,
    },
  }),
  episodeResource({
    key: 'shows/s2e1.mp4',
    filename: 's2e1.mp4',
    sizeBytes: 100,
    lastModified: '2026-09-01T10:00:00.000Z',
    videoSource: { id: 'src-4', label: 'Main', quality: '1080p', episodeId: 'ep-4' },
    episode: {
      id: 'ep-4',
      title: 'Season Two Premiere',
      episodeNumber: 1,
      seasonNumber: 2,
      seriesId: 'series-1',
      seriesTitle: 'Cyberpunk Series',
      sourceCount: 1,
    },
  }),
  episodeResource({
    key: 'shows/s1e1.mp4',
    filename: 's1e1.mp4',
    sizeBytes: 200,
    lastModified: '2026-09-02T10:00:00.000Z',
    videoSource: { id: 'src-1', label: 'Main', quality: '1080p', episodeId: 'ep-1' },
    episode: {
      id: 'ep-1',
      title: 'Ep One',
      episodeNumber: 1,
      seasonNumber: 1,
      seriesId: 'series-1',
      seriesTitle: 'Cyberpunk Series',
      sourceCount: 1,
    },
  }),
];

const orphanResource: StorageResource = {
  id: 'orphan.mp4',
  key: 'orphan.mp4',
  filename: 'orphan.mp4',
  sizeBytes: 50,
  lastModified: '2026-09-04T10:00:00.000Z',
  status: 'orphaned',
};

function defaultProps(overrides = {}) {
  return {
    resources: linkedResources,
    onRefreshScan: vi.fn(),
    onPreview: vi.fn(),
    onEditSource: vi.fn(),
    onAttachOrphan: vi.fn(),
    onDeleteSingle: vi.fn(),
    onDeleteBatch: vi.fn(),
    onPurgeOrphans: vi.fn(),
    ...overrides,
  };
}

function rowOrder(): string[] {
  const container = screen.getByTestId('storage-table-container');
  const rows = container.querySelectorAll('[data-testid^="row-"]');
  return Array.from(rows).map((r) => r.getAttribute('data-testid') ?? '');
}

function mockClipboard() {
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText },
    configurable: true,
    writable: true,
  });
  return writeText;
}

describe('ChunkyCopyButton primitive', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders an inline copy button with a tooltip showing the full value', async () => {
    const { user } = renderWithProviders(
      <ChunkyCopyButton value="shows/s1e1.mp4" data-testid="copy-btn" />
    );
    const btn = screen.getByTestId('copy-btn');
    expect(btn).toHaveAccessibleName('Copy shows/s1e1.mp4');
    expect(
      screen.getByTestId('chunky-copy-icon')
    ).toBeInTheDocument();

    await user.hover(btn);
    expect(await screen.findByText('shows/s1e1.mp4')).toBeInTheDocument();
  });

  it('copies the value and shows checkmark feedback', async () => {
    const { user } = renderWithProviders(
      <ChunkyCopyButton value="shows/s1e1.mp4" data-testid="copy-btn" />
    );
    // renderWithProviders runs userEvent.setup(), which stubs
    // navigator.clipboard — install our mock afterwards.
    const writeText = mockClipboard();
    const btn = screen.getByTestId('copy-btn');
    await user.click(btn);

    expect(writeText).toHaveBeenCalledWith('shows/s1e1.mp4');
    expect(btn).toHaveAttribute('data-copied', 'true');
    expect(screen.getByTestId('chunky-copy-check')).toBeInTheDocument();
  });
});

describe('StorageResourceTable polish', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('styles data rows as .ep-like cards with a 4px bottom border and hover lift', () => {
    renderWithProviders(<StorageResourceTable {...defaultProps()} />);
    const row = screen.getByTestId('row-shows/s1e1.mp4');
    expect(row).toHaveClass('border-b-4');
    expect(row).toHaveClass('bg-[var(--bg)]');
    expect(row).toHaveClass('hover:border-[#4b5d67]');
    expect(row).toHaveClass('hover:-translate-y-0.5');
  });

  it('copies the full S3 key via the copy button and shows feedback', async () => {
    const { user } = renderWithProviders(
      <StorageResourceTable {...defaultProps()} />
    );
    const writeText = mockClipboard();
    const copyBtn = screen.getByTestId('copy-key-shows/s1e1.mp4');
    await user.click(copyBtn);

    expect(writeText).toHaveBeenCalledWith('shows/s1e1.mp4');
    expect(copyBtn).toHaveAttribute('data-copied', 'true');
  });

  it('copies the filename via the filename copy button', async () => {
    const { user } = renderWithProviders(
      <StorageResourceTable {...defaultProps()} />
    );
    const writeText = mockClipboard();
    await user.click(screen.getByTestId('copy-filename-shows/s1e1.mp4'));
    expect(writeText).toHaveBeenCalledWith('s1e1.mp4');
  });

  it('defaults to chronological episode order in drill-down mode', () => {
    renderWithProviders(
      <StorageResourceTable {...defaultProps()} hideToolbar />
    );
    // Input order is S1E3, S2E1, S1E1 — expect S1E1, S1E3, S2E1.
    expect(rowOrder()).toEqual([
      'row-shows/s1e1.mp4',
      'row-shows/s1e3.mp4',
      'row-shows/s2e1.mp4',
    ]);
  });

  it('keeps size sorting in the overview toolbar mode', () => {
    renderWithProviders(<StorageResourceTable {...defaultProps()} />);
    // Default overview sort is size desc: 300, 200, 100.
    expect(rowOrder()).toEqual([
      'row-shows/s1e3.mp4',
      'row-shows/s1e1.mp4',
      'row-shows/s2e1.mp4',
    ]);
  });

  it('renders a streamlined right-aligned action bar with only the purge button', () => {
    renderWithProviders(
      <StorageResourceTable {...defaultProps({ orphanedCount: 2 })} />
    );
    const toolbar = screen.getByTestId('storage-toolbar');
    expect(toolbar).toBeInTheDocument();
    expect(toolbar).toHaveClass('flex');
    expect(toolbar).toHaveClass('justify-end');
    expect(screen.getByTestId('purge-orphans-btn')).toBeInTheDocument();

    // Removed controls stay gone.
    expect(screen.queryByTestId('filter-tab-all')).not.toBeInTheDocument();
    expect(screen.queryByTestId('filter-tab-linked')).not.toBeInTheDocument();
    expect(screen.queryByTestId('filter-tab-orphaned')).not.toBeInTheDocument();
    expect(screen.queryByTestId('storage-search-input')).not.toBeInTheDocument();
    expect(screen.queryByTestId('refresh-scan-btn')).not.toBeInTheDocument();
  });

  it('triggers onPurgeOrphans when the purge button is clicked', async () => {
    const props = defaultProps({ orphanedCount: 2 });
    const { user } = renderWithProviders(<StorageResourceTable {...props} />);
    await user.click(screen.getByTestId('purge-orphans-btn'));
    expect(props.onPurgeOrphans).toHaveBeenCalledTimes(1);
  });

  it('disables the purge button while loading or when there are no orphans', () => {
    const { rerender } = renderWithProviders(
      <StorageResourceTable {...defaultProps()} isLoading orphanedCount={2} />
    );
    expect(screen.getByTestId('purge-orphans-btn')).toBeDisabled();

    rerender(<StorageResourceTable {...defaultProps()} orphanedCount={0} />);
    expect(screen.getByTestId('purge-orphans-btn')).toBeDisabled();
  });

  it('suppresses the entire top bar when hideToolbar is true', () => {
    renderWithProviders(
      <StorageResourceTable {...defaultProps({ orphanedCount: 2 })} hideToolbar />
    );
    expect(screen.queryByTestId('storage-toolbar')).not.toBeInTheDocument();
    expect(screen.queryByTestId('purge-orphans-btn')).not.toBeInTheDocument();
  });

  it('keeps column header sorting accessible over the drill-down default', async () => {
    const { user } = renderWithProviders(
      <StorageResourceTable
        {...defaultProps({ resources: [...linkedResources, orphanResource] })}
        hideToolbar
      />
    );
    await user.click(screen.getByTestId('sort-header-name'));
    await user.click(screen.getByTestId('sort-header-name'));
    // Name asc: orphan.mp4, s1e1.mp4, s1e3.mp4, s2e1.mp4
    expect(rowOrder()).toEqual([
      'row-orphan.mp4',
      'row-shows/s1e1.mp4',
      'row-shows/s1e3.mp4',
      'row-shows/s2e1.mp4',
    ]);
  });

  it('keeps row selection, batch delete, and row action menus working', async () => {
    const props = defaultProps({ resources: [...linkedResources, orphanResource] });
    const { user } = renderWithProviders(<StorageResourceTable {...props} />);

    // Batch row selection
    await user.click(screen.getByTestId('checkbox-shows/s1e1.mp4'));
    expect(await screen.findByTestId('batch-toolbar')).toBeInTheDocument();
    expect(props.onDeleteBatch).not.toHaveBeenCalled();
    await user.click(screen.getByTestId('delete-selected-btn'));
    expect(props.onDeleteBatch).toHaveBeenCalledTimes(1);

    // Individual row action menu (preview + delete for a linked video file)
    await user.click(
      screen.getByRole('button', { name: 'Actions for s1e1.mp4' })
    );
    const menu = await screen.findByRole('menu');
    expect(
      within(menu).getByRole('menuitem', { name: 'Preview' })
    ).toBeInTheDocument();
    expect(
      within(menu).getByRole('menuitem', { name: 'Delete' })
    ).toBeInTheDocument();
    await user.click(within(menu).getByRole('menuitem', { name: 'Preview' }));
    expect(props.onPreview).toHaveBeenCalledTimes(1);
  });
});
