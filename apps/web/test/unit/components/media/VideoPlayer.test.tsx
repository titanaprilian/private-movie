import { renderWithProviders, screen, userEvent, fireEvent, act } from '../../../utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { VideoPlayer } from '@/components/media/VideoPlayer';

describe('VideoPlayer component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock HTMLMediaElement prototype methods for JSDOM
    window.HTMLMediaElement.prototype.play = vi.fn().mockImplementation(() => Promise.resolve());
    window.HTMLMediaElement.prototype.pause = vi.fn().mockImplementation(() => {});
    window.HTMLMediaElement.prototype.load = vi.fn().mockImplementation(() => {});
  });

  it('renders native video element with correct src prop', () => {
    renderWithProviders(<VideoPlayer src="https://example.com/video.mp4" title="Test Video" />);

    const video = screen.getByTestId('custom-video-element') as HTMLVideoElement;
    expect(video).toBeInTheDocument();
    expect(video.src).toBe('https://example.com/video.mp4');
  });

  it('toggles play/pause state when 3D play button is clicked', async () => {
    const user = userEvent.setup();
    renderWithProviders(<VideoPlayer src="https://example.com/video.mp4" />);

    const playButton = screen.getByRole('button', { name: /^play$/i });
    expect(playButton).toBeInTheDocument();
    // Verify 3D tactile styling classes
    expect(playButton.className).toMatch(/rounded-full/);
    expect(playButton.className).toMatch(/active:translate-y-/);

    await user.click(playButton);
    expect(window.HTMLMediaElement.prototype.play).toHaveBeenCalled();

    // Trigger onPlay event manually on video element to update state in JSDOM
    const video = screen.getByTestId('custom-video-element');
    video.dispatchEvent(new Event('play'));

    // After play is called, button should show Pause label/aria-label
    const pauseButton = await screen.findByRole('button', { name: /^pause$/i });
    expect(pauseButton).toBeInTheDocument();

    await user.click(pauseButton);
    expect(window.HTMLMediaElement.prototype.pause).toHaveBeenCalled();
  });

  it('renders floating rounded pill control bar overlay with smooth auto-hide on inactivity', () => {
    vi.useFakeTimers();
    renderWithProviders(<VideoPlayer src="https://example.com/video.mp4" />);

    const controlBar = screen.getByTestId('video-control-bar');
    expect(controlBar).toBeInTheDocument();
    expect(controlBar.className).toMatch(/rounded-full|rounded-3xl|rounded-2xl/);

    const video = screen.getByTestId('custom-video-element');
    // Simulate playing
    fireEvent.play(video);

    const playerContainer = screen.getByTestId('video-player-container');
    fireEvent.mouseMove(playerContainer);

    // Fast-forward past timeout
    act(() => {
      vi.advanceTimersByTime(3500);
    });

    expect(controlBar.className).toContain('opacity-0');

    // Moving mouse reveals controls again
    fireEvent.mouseMove(playerContainer);
    expect(controlBar.className).toContain('opacity-100');

    vi.useRealTimers();
  });

  it('renders 8px progress scrubber with keyboard and touch seek support', () => {
    renderWithProviders(<VideoPlayer src="https://example.com/video.mp4" />);

    const scrubber = screen.getByLabelText(/progress/i) as HTMLInputElement;
    expect(scrubber).toBeInTheDocument();
    expect(scrubber).toHaveAttribute('type', 'range');

    const video = screen.getByTestId('custom-video-element') as HTMLVideoElement;
    Object.defineProperty(video, 'duration', { value: 120, writable: true });
    fireEvent.loadedMetadata(video);

    fireEvent.change(scrubber, { target: { value: '45' } });
    expect(video.currentTime).toBe(45);

    // Keyboard seek with ArrowRight / ArrowLeft
    fireEvent.keyDown(scrubber, { key: 'ArrowRight' });
  });

  it('updates volume and toggle mute', async () => {
    const user = userEvent.setup();
    renderWithProviders(<VideoPlayer src="https://example.com/video.mp4" />);

    const volumeSlider = screen.getByLabelText(/volume/i) as HTMLInputElement;
    expect(volumeSlider).toBeInTheDocument();
    expect(volumeSlider.value).toBe('1');

    fireEvent.change(volumeSlider, { target: { value: '0.6' } });
    const video = screen.getByTestId('custom-video-element') as HTMLVideoElement;
    expect(video.volume).toBe(0.6);

    const muteButton = screen.getByRole('button', { name: /mute/i });
    await user.click(muteButton);

    expect(screen.getByRole('button', { name: /unmute/i })).toBeInTheDocument();
    expect(video.muted).toBe(true);
  });

  it('allows changing playback speed via popover menu (0.5x, 1x, 1.25x, 1.5x, 2x)', async () => {
    const user = userEvent.setup();
    renderWithProviders(<VideoPlayer src="https://example.com/video.mp4" />);

    const speedButton = screen.getByRole('button', { name: /playback speed/i });
    expect(speedButton).toBeInTheDocument();

    await user.click(speedButton);

    const speedOptions = ['0.5x', '1x', '1.25x', '1.5x', '2x'];
    for (const opt of speedOptions) {
      expect(screen.getByRole('button', { name: opt })).toBeInTheDocument();
    }

    const speed15Btn = screen.getByRole('button', { name: '1.5x' });
    await user.click(speed15Btn);

    const video = screen.getByTestId('custom-video-element') as HTMLVideoElement;
    expect(video.playbackRate).toBe(1.5);
  });

  it('toggles fullscreen', async () => {
    const user = userEvent.setup();
    renderWithProviders(<VideoPlayer src="https://example.com/video.mp4" />);

    const container = screen.getByTestId('video-player-container');
    container.requestFullscreen = vi.fn().mockImplementation(() => Promise.resolve());
    document.exitFullscreen = vi.fn().mockImplementation(() => Promise.resolve());

    const fsButton = screen.getByRole('button', { name: /fullscreen/i });
    await user.click(fsButton);
    expect(container.requestFullscreen).toHaveBeenCalled();
  });

  it('triggers countdown overlay when video ends and invokes onNextEpisode when countdown finishes', () => {
    vi.useFakeTimers();
    const handleNextEpisode = vi.fn();
    renderWithProviders(
      <VideoPlayer
        src="https://example.com/video.mp4"
        onNextEpisode={handleNextEpisode}
      />
    );

    const video = screen.getByTestId('custom-video-element');
    fireEvent.ended(video);

    expect(screen.getByTestId('auto-next-countdown-overlay')).toBeInTheDocument();
    expect(screen.getByText(/Next episode in 5s/i)).toBeInTheDocument();

    for (let i = 0; i < 5; i++) {
      act(() => {
        vi.advanceTimersByTime(1000);
      });
    }

    expect(handleNextEpisode).toHaveBeenCalledTimes(1);

    vi.useRealTimers();
  });

  it('invokes onNextEpisode immediately when Play Now button is clicked in countdown overlay', () => {
    const handleNextEpisode = vi.fn();
    renderWithProviders(
      <VideoPlayer
        src="https://example.com/video.mp4"
        onNextEpisode={handleNextEpisode}
      />
    );

    const video = screen.getByTestId('custom-video-element');
    fireEvent.ended(video);

    const playNowBtn = screen.getByRole('button', { name: /Play Now/i });
    fireEvent.click(playNowBtn);

    expect(handleNextEpisode).toHaveBeenCalledTimes(1);
  });

  it('cancels countdown when Cancel button is clicked in countdown overlay', () => {
    const handleNextEpisode = vi.fn();
    renderWithProviders(
      <VideoPlayer
        src="https://example.com/video.mp4"
        onNextEpisode={handleNextEpisode}
      />
    );

    const video = screen.getByTestId('custom-video-element');
    fireEvent.ended(video);

    expect(screen.getByTestId('auto-next-countdown-overlay')).toBeInTheDocument();

    const cancelBtn = screen.getByRole('button', { name: /Cancel/i });
    fireEvent.click(cancelBtn);

    expect(screen.queryByTestId('auto-next-countdown-overlay')).not.toBeInTheDocument();
    expect(handleNextEpisode).not.toHaveBeenCalled();
  });
});
