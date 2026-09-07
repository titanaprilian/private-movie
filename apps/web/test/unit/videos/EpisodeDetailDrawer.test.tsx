import { renderWithProviders, screen, userEvent } from '../../utils';
import { describe, expect, it, vi } from 'vitest';
import { EpisodeDetailDrawer } from '@/modules/videos/internal/EpisodeDetailDrawer';
import type { Episode } from '@/modules/videos/internal/api';

const mockEpisode: Episode = {
  id: 'ep-101',
  title: 'Pilot Episode',
  order: 1,
  duration: '24:10',
  resolution: '1080p',
  format: 'MP4',
  size: '450 MB',
  videoType: 'mp4',
  tags: ['Action', 'Drama'],
  description: 'An exciting start to our series adventure.',
  videoSources: [],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('EpisodeDetailDrawer Component', () => {
  it('does not render when open is false or episode is null', () => {
    const { rerender } = renderWithProviders(
      <EpisodeDetailDrawer
        open={false}
        onOpenChange={vi.fn()}
        episode={mockEpisode}
        onSave={vi.fn()}
      />
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    rerender(
      <EpisodeDetailDrawer
        open={true}
        onOpenChange={vi.fn()}
        episode={null}
        onSave={vi.fn()}
      />
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renders all general and technical metadata fields populated with episode data', () => {
    renderWithProviders(
      <EpisodeDetailDrawer
        open={true}
        onOpenChange={vi.fn()}
        episode={mockEpisode}
        onSave={vi.fn()}
      />
    );

    expect(screen.getByRole('dialog', { name: 'Episode Details: Pilot Episode' })).toBeInTheDocument();
    expect(screen.getByDisplayValue('Pilot Episode')).toBeInTheDocument();
    expect(screen.getByDisplayValue('An exciting start to our series adventure.')).toBeInTheDocument();
    expect(screen.getByDisplayValue('mp4')).toBeInTheDocument();
    expect(screen.getByDisplayValue('24:10')).toBeInTheDocument();
    expect(screen.getByDisplayValue('1080p')).toBeInTheDocument();
    expect(screen.getByDisplayValue('MP4')).toBeInTheDocument();
    expect(screen.getByDisplayValue('450 MB')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Action, Drama')).toBeInTheDocument();

    // Clean initial state: buttons disabled
    const saveBtn = screen.getByRole('button', { name: /save changes/i });
    const discardBtn = screen.getByRole('button', { name: /discard/i });
    expect(saveBtn).toBeDisabled();
    expect(discardBtn).toBeDisabled();
    expect(screen.getByText('All changes saved')).toBeInTheDocument();
  });

  it('tracks dirty state, enables Save Changes and Discard, and resets on Discard without calling onSave', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();

    renderWithProviders(
      <EpisodeDetailDrawer
        open={true}
        onOpenChange={vi.fn()}
        episode={mockEpisode}
        onSave={onSave}
      />
    );

    const titleInput = screen.getByLabelText(/^title$/i);
    const saveBtn = screen.getByRole('button', { name: /save changes/i });
    const discardBtn = screen.getByRole('button', { name: /discard/i });

    // Make dirty
    await user.type(titleInput, ' Updated');
    expect(titleInput).toHaveValue('Pilot Episode Updated');
    expect(saveBtn).not.toBeDisabled();
    expect(discardBtn).not.toBeDisabled();
    expect(screen.getByText(/unsaved changes/i)).toBeInTheDocument();

    // Click discard
    await user.click(discardBtn);
    expect(titleInput).toHaveValue('Pilot Episode');
    expect(saveBtn).toBeDisabled();
    expect(discardBtn).toBeDisabled();
    expect(screen.getByText('All changes saved')).toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();
  });

  it('submits updated metadata when Save Changes is clicked', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue(undefined);

    renderWithProviders(
      <EpisodeDetailDrawer
        open={true}
        onOpenChange={vi.fn()}
        episode={mockEpisode}
        onSave={onSave}
      />
    );

    const titleInput = screen.getByLabelText(/^title$/i);
    const resolutionInput = screen.getByLabelText(/resolution/i);
    const tagsInput = screen.getByLabelText(/tags/i);

    await user.clear(titleInput);
    await user.type(titleInput, 'New Episode Title');
    await user.clear(resolutionInput);
    await user.type(resolutionInput, '4K');
    await user.clear(tagsInput);
    await user.type(tagsInput, 'Sci-Fi, Adventure');

    const saveBtn = screen.getByRole('button', { name: /save changes/i });
    await user.click(saveBtn);

    expect(onSave).toHaveBeenCalledWith('ep-101', {
      title: 'New Episode Title',
      description: 'An exciting start to our series adventure.',
      videoType: 'mp4',
      duration: '24:10',
      resolution: '4K',
      format: 'MP4',
      size: '450 MB',
      tags: ['Sci-Fi', 'Adventure'],
    });
  });

  it('closes via close button, backdrop click, and Escape key', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();

    const { rerender } = renderWithProviders(
      <EpisodeDetailDrawer
        open={true}
        onOpenChange={onOpenChange}
        episode={mockEpisode}
        onSave={vi.fn()}
      />
    );

    // Close button
    const closeBtn = screen.getByRole('button', { name: /close drawer/i });
    await user.click(closeBtn);
    expect(onOpenChange).toHaveBeenCalledWith(false);

    // Backdrop click
    onOpenChange.mockClear();
    const backdrop = screen.getByTestId('drawer-backdrop');
    await user.click(backdrop);
    expect(onOpenChange).toHaveBeenCalledWith(false);

    // Escape key
    onOpenChange.mockClear();
    await user.keyboard('{Escape}');
    expect(onOpenChange).toHaveBeenCalledWith(false);

    // Clean unmount on close
    rerender(
      <EpisodeDetailDrawer
        open={false}
        onOpenChange={onOpenChange}
        episode={mockEpisode}
        onSave={vi.fn()}
      />
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
