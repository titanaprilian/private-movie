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

  it('renders chunky drawer structure with retained fields populated with episode data', () => {
    renderWithProviders(
      <EpisodeDetailDrawer
        open={true}
        onOpenChange={vi.fn()}
        episode={mockEpisode}
        onSave={vi.fn()}
      />
    );

    expect(screen.getByTestId('chunky-drawer-content')).toBeInTheDocument();
    expect(screen.getByTestId('chunky-drawer-header')).toBeInTheDocument();
    expect(screen.getByTestId('chunky-drawer-body')).toBeInTheDocument();
    expect(screen.getByTestId('chunky-drawer-footer')).toBeInTheDocument();

    expect(screen.getByRole('dialog', { name: 'Pilot Episode' })).toBeInTheDocument();
    expect(screen.getByDisplayValue('Pilot Episode')).toBeInTheDocument();
    expect(screen.getByDisplayValue('An exciting start to our series adventure.')).toBeInTheDocument();
    expect(screen.getByDisplayValue('24:10')).toBeInTheDocument();

    // Pruned fields must not render
    expect(screen.queryByLabelText(/video type/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/resolution/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/^format$/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/file size/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/tags/i)).not.toBeInTheDocument();

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

  it('submits only retained metadata fields when Save Changes is clicked', async () => {
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
    const durationInput = screen.getByLabelText(/duration/i);

    await user.clear(titleInput);
    await user.type(titleInput, 'New Episode Title');
    await user.clear(durationInput);
    await user.type(durationInput, '25:00');

    const saveBtn = screen.getByRole('button', { name: /save changes/i });
    await user.click(saveBtn);

    expect(onSave).toHaveBeenCalledWith('ep-101', {
      title: 'New Episode Title',
      description: 'An exciting start to our series adventure.',
      duration: '25:00',
    });
  });

  it('closes via close button, overlay click, and Escape key', async () => {
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
    const closeBtn = screen.getByRole('button', { name: /^close$/i });
    await user.click(closeBtn);
    expect(onOpenChange).toHaveBeenCalledWith(false);

    // Overlay click
    onOpenChange.mockClear();
    const overlay = screen.getByTestId('chunky-drawer-overlay');
    await user.click(overlay);
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

  it('embeds SourceManagementTable and triggers onOpenAdvancedIngest when ingest buttons are clicked', async () => {
    const user = userEvent.setup();
    const onOpenAdvancedIngest = vi.fn();

    const episodeWithSources: Episode = {
      ...mockEpisode,
      videoSources: [
        {
          id: 'src-1',
          type: 'direct',
          url: 'https://stream.example.com/source1.mp4',
          label: 'Direct Server',
          quality: '1080p',
        },
      ],
    };

    renderWithProviders(
      <EpisodeDetailDrawer
        open={true}
        onOpenChange={vi.fn()}
        episode={episodeWithSources}
        onSave={vi.fn()}
        onOpenAdvancedIngest={onOpenAdvancedIngest}
      />
    );

    expect(screen.getByText('Video Sources')).toBeInTheDocument();
    expect(screen.getByText('Direct Server')).toBeInTheDocument();

    const ingestBtn = screen.getByRole('button', { name: /^ingest$/i });
    const uploadBtn = screen.getByRole('button', { name: /^upload$/i });

    await user.click(ingestBtn);
    expect(onOpenAdvancedIngest).toHaveBeenCalledWith('remote-ingest');

    await user.click(uploadBtn);
    expect(onOpenAdvancedIngest).toHaveBeenCalledWith('upload-s3');
  });
});
