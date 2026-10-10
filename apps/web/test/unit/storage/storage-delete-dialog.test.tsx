import { renderWithProviders, screen, within } from '../../utils';
import { describe, expect, it, vi, afterEach } from 'vitest';
import { DeleteConfirmDialog } from '@/modules/storage/internal/components/dialogs/DeleteConfirmDialog';
import type { StorageResource } from '@/modules/storage/internal/api';

function loneSourceResource(index: number): StorageResource {
  const key = `shows/s1e${index}.mp4`;
  return {
    id: key,
    key,
    filename: `s1e${index}.mp4`,
    sizeBytes: 100 * 1024 * 1024,
    lastModified: '2026-09-01T10:00:00.000Z',
    status: 'linked',
    videoSource: {
      id: `src-${index}`,
      label: 'Main',
      quality: '1080p',
      episodeId: `ep-${index}`,
    },
    episode: {
      id: `ep-${index}`,
      title: `Episode ${index}`,
      episodeNumber: index,
      seasonNumber: 1,
      seriesId: 'series-1',
      seriesTitle: 'Cyberpunk Series',
      sourceCount: 1,
    },
  };
}

function batchResources(count: number): StorageResource[] {
  return Array.from({ length: count }, (_, i) => loneSourceResource(i + 1));
}

function defaultProps(overrides = {}) {
  return {
    open: true,
    onOpenChange: vi.fn(),
    targetType: 'batch' as const,
    selectedResources: batchResources(30),
    onConfirm: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe('DeleteConfirmDialog bounded scrolling', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('contains modal content in a bounded scrollable area', () => {
    renderWithProviders(<DeleteConfirmDialog {...defaultProps()} />);
    const scroll = screen.getByTestId('delete-dialog-scroll');
    expect(scroll).toHaveClass('max-h-[50vh]');
    expect(scroll).toHaveClass('overflow-y-auto');
  });

  it('constrains the sole-source warning episode list to a scrollable area', () => {
    renderWithProviders(<DeleteConfirmDialog {...defaultProps()} />);
    expect(screen.getByTestId('sole-source-warning')).toBeInTheDocument();
    const list = screen.getByTestId('sole-source-episode-list');
    expect(list).toHaveClass('max-h-36');
    expect(list).toHaveClass('overflow-y-auto');
    expect(list.children.length).toBe(30);
  });

  it('keeps confirm and cancel buttons visible and clickable with dozens of items', async () => {
    const props = defaultProps();
    const { user } = renderWithProviders(<DeleteConfirmDialog {...props} />);

    const dialog = screen.getByTestId('chunky-confirm-dialog');
    const confirmBtn = within(dialog).getByTestId('confirm-delete-btn');
    const cancelBtn = within(dialog).getByRole('button', { name: 'Cancel' });
    expect(confirmBtn).toBeVisible();
    expect(cancelBtn).toBeVisible();

    await user.click(confirmBtn);
    expect(props.onConfirm).toHaveBeenCalledTimes(1);
    expect(props.onOpenChange).toHaveBeenCalledWith(false);
  });

  it('summarizes file count and reclaimed space for the batch', () => {
    renderWithProviders(<DeleteConfirmDialog {...defaultProps()} />);
    expect(screen.getByTestId('delete-file-count')).toHaveTextContent('30');
    expect(screen.getByTestId('reclaimed-space')).not.toBeEmptyDOMElement();
  });

  it('shows loading state while deletion is in flight and closes on success', async () => {
    let resolveConfirm!: () => void;
    const onConfirm = vi
      .fn()
      .mockImplementation(
        () => new Promise<void>((resolve) => { resolveConfirm = resolve; })
      );
    const onOpenChange = vi.fn();
    const { user } = renderWithProviders(
      <DeleteConfirmDialog {...defaultProps({ onConfirm, onOpenChange })} />
    );

    await user.click(screen.getByTestId('confirm-delete-btn'));
    expect(await screen.findByText('Deleting...')).toBeInTheDocument();
    expect(screen.getByTestId('confirm-delete-btn')).toBeDisabled();

    resolveConfirm();
    expect(await screen.findByText('Confirm Delete')).toBeInTheDocument();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('surfaces deletion errors without closing the dialog', async () => {
    const onOpenChange = vi.fn();
    const { user } = renderWithProviders(
      <DeleteConfirmDialog
        {...defaultProps({
          onConfirm: vi.fn().mockRejectedValue(new Error('S3 delete failed')),
          onOpenChange,
        })}
      />
    );

    await user.click(screen.getByTestId('confirm-delete-btn'));
    expect(await screen.findByTestId('delete-error')).toHaveTextContent(
      'S3 delete failed'
    );
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it('closes via cancel without deleting', async () => {
    const props = defaultProps();
    const { user } = renderWithProviders(<DeleteConfirmDialog {...props} />);
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(props.onConfirm).not.toHaveBeenCalled();
    expect(props.onOpenChange).toHaveBeenCalledWith(false);
  });
});
