import { renderWithProviders, screen, userEvent } from '../../../utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { VideoSettingsPopover } from '@/components/media/VideoSettingsPopover';

describe('VideoSettingsPopover component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function renderPopover(overrides = {}) {
    return renderWithProviders(
      <VideoSettingsPopover
        playbackSpeed={1}
        onSpeedChange={vi.fn()}
        {...overrides}
      />
    );
  }

  it('opens the settings popover from the 3D Gear button with playback speed options', async () => {
    const user = userEvent.setup();
    renderPopover();

    await user.click(screen.getByRole('button', { name: /video settings/i }));

    for (const opt of ['0.5x', '1x', '1.25x', '1.5x', '2x']) {
      expect(screen.getByRole('button', { name: opt })).toBeInTheDocument();
    }
  });

  it('selecting a speed calls onSpeedChange with that value', async () => {
    const user = userEvent.setup();
    const onSpeedChange = vi.fn();
    renderPopover({ onSpeedChange });

    await user.click(screen.getByRole('button', { name: /video settings/i }));
    await user.click(screen.getByRole('button', { name: '2x' }));

    expect(onSpeedChange).toHaveBeenCalledWith(2);
  });

  it('renders quality options only when multiple qualities exist', async () => {
    const user = userEvent.setup();
    const onQualityChange = vi.fn();
    renderPopover({
      qualities: [
        { id: '1080p', label: '1080p' },
        { id: '720p', label: '720p' },
      ],
      selectedQualityId: '1080p',
      onQualityChange,
    });

    await user.click(screen.getByRole('button', { name: /video settings/i }));

    expect(screen.getByText(/quality/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '720p' }));
    expect(onQualityChange).toHaveBeenCalledWith('720p');
  });

  it('hides the quality section when fewer than two qualities exist', async () => {
    const user = userEvent.setup();
    renderPopover({ qualities: [{ id: 'auto', label: 'Auto' }] });

    await user.click(screen.getByRole('button', { name: /video settings/i }));

    expect(screen.queryByText(/quality/i)).not.toBeInTheDocument();
  });

  it('renders subtitle options with an Off toggle and notifies on change', async () => {
    const user = userEvent.setup();
    const onSubtitleChange = vi.fn();
    renderPopover({
      subtitles: [{ id: 'en', label: 'English' }],
      selectedSubtitleId: null,
      onSubtitleChange,
    });

    await user.click(screen.getByRole('button', { name: /video settings/i }));

    expect(screen.getByRole('button', { name: 'English' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /subtitles off/i })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'English' }));
    expect(onSubtitleChange).toHaveBeenCalledWith('en');
  });

  it('hides the subtitles section when no subtitles are provided', async () => {
    const user = userEvent.setup();
    renderPopover();

    await user.click(screen.getByRole('button', { name: /video settings/i }));

    expect(screen.queryByText(/subtitles/i)).not.toBeInTheDocument();
  });

  it('opens the Shortcuts & Gestures dialog and notifies open state', async () => {
    const user = userEvent.setup();
    const onShortcutsOpenChange = vi.fn();
    renderPopover({ onShortcutsOpenChange });

    await user.click(screen.getByRole('button', { name: /video settings/i }));
    await user.click(screen.getByRole('button', { name: /shortcuts & gestures/i }));

    expect(onShortcutsOpenChange).toHaveBeenCalledWith(true);
    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeInTheDocument();
    expect(dialog.textContent).toMatch(/Space/i);
    expect(dialog.textContent).toMatch(/ArrowRight/i);
    expect(dialog.textContent).toMatch(/tap/i);
  });
});
