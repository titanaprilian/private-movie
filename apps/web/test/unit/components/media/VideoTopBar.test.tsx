import { renderWithProviders, screen, userEvent } from '../../../utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { VideoTopBar } from '@/components/media/VideoTopBar';

describe('VideoTopBar component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders tactile 3D Back button when onBack is passed and executes callback on click', async () => {
    const user = userEvent.setup();
    const handleBack = vi.fn();

    renderWithProviders(
      <VideoTopBar
        showControls={true}
        onBack={handleBack}
        title="Sample Video"
      />
    );

    const backButton = screen.getByRole('button', { name: /back/i });
    expect(backButton).toBeInTheDocument();
    expect(backButton.className).toMatch(/rounded-full/);
    expect(backButton.className).toMatch(/active:translate-y-/);
    expect(backButton.className).toMatch(/border-b-4/);

    await user.click(backButton);
    expect(handleBack).toHaveBeenCalledTimes(1);
  });

  it('omits Back button when onBack is undefined', () => {
    renderWithProviders(
      <VideoTopBar
        showControls={true}
        title="Sample Video"
      />
    );

    const backButton = screen.queryByRole('button', { name: /back/i });
    expect(backButton).not.toBeInTheDocument();
  });

  it('displays correctly formatted series and episode title pill when seriesTitle and episodeLabel are provided', () => {
    renderWithProviders(
      <VideoTopBar
        showControls={true}
        seriesTitle="Breaking Bad"
        episodeLabel="S1:E3"
        title="...And the Bag's in the River"
      />
    );

    expect(screen.getByText("Breaking Bad · S1:E3 – ...And the Bag's in the River")).toBeInTheDocument();
  });

  it('displays correctly formatted series and episode title pill without title suffix when title is omitted', () => {
    renderWithProviders(
      <VideoTopBar
        showControls={true}
        seriesTitle="Breaking Bad"
        episodeLabel="S1:E3"
      />
    );

    expect(screen.getByText("Breaking Bad · S1:E3")).toBeInTheDocument();
  });

  it('falls back to title when seriesTitle or episodeLabel is missing', () => {
    renderWithProviders(
      <VideoTopBar
        showControls={true}
        title="Standalone Movie"
      />
    );

    expect(screen.getByText("Standalone Movie")).toBeInTheDocument();
  });

  it('renders nothing in title container if no titles are provided', () => {
    const { container } = renderWithProviders(
      <VideoTopBar
        showControls={true}
      />
    );

    // Should not render title pill if no title or series info is provided
    expect(container.querySelector('[data-testid="video-top-bar-title"]')).not.toBeInTheDocument();
  });

  it('fades out and disables pointer events when showControls is false', () => {
    renderWithProviders(
      <VideoTopBar
        showControls={false}
        title="Sample Video"
        onBack={vi.fn()}
      />
    );

    const topBar = screen.getByTestId('video-top-bar');
    expect(topBar).toBeInTheDocument();
    expect(topBar.className).toContain('opacity-0');
    expect(topBar.className).toContain('pointer-events-none');
    expect(topBar.className).not.toContain('opacity-100');
  });

  it('is visible and enables pointer events when showControls is true', () => {
    renderWithProviders(
      <VideoTopBar
        showControls={true}
        title="Sample Video"
        onBack={vi.fn()}
      />
    );

    const topBar = screen.getByTestId('video-top-bar');
    expect(topBar).toBeInTheDocument();
    expect(topBar.className).toContain('opacity-100');
    expect(topBar.className).not.toContain('pointer-events-none');
  });
});
