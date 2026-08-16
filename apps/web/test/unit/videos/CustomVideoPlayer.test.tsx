import { renderWithProviders, screen, userEvent, fireEvent, act } from '../../utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CustomVideoPlayer } from '@/modules/videos/internal/CustomVideoPlayer';

const mockNavigate = vi.fn();
vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => mockNavigate,
}));

describe('CustomVideoPlayer component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock HTMLMediaElement prototype methods for JSDOM
    window.HTMLMediaElement.prototype.play = vi.fn().mockImplementation(() => Promise.resolve());
    window.HTMLMediaElement.prototype.pause = vi.fn().mockImplementation(() => {});
    window.HTMLMediaElement.prototype.load = vi.fn().mockImplementation(() => {});
  });

  it('renders native video element with correct src prop', () => {
    renderWithProviders(<CustomVideoPlayer src="https://example.com/video.mp4" title="Test Video" />);

    const video = screen.getByTestId('custom-video-element') as HTMLVideoElement;
    expect(video).toBeInTheDocument();
    expect(video.src).toBe('https://example.com/video.mp4');
  });

  it('toggles play/pause state when play button is clicked', async () => {
    const user = userEvent.setup();
    renderWithProviders(<CustomVideoPlayer src="https://example.com/video.mp4" />);

    const playButton = screen.getByRole('button', { name: /play/i });
    expect(playButton).toBeInTheDocument();

    await user.click(playButton);
    expect(window.HTMLMediaElement.prototype.play).toHaveBeenCalled();

    // Trigger onPlay event manually on video element to update state in JSDOM
    const video = screen.getByTestId('custom-video-element');
    video.dispatchEvent(new Event('play'));

    // After play is called, button should show Pause label/aria-label
    const pauseButton = await screen.findByRole('button', { name: /pause/i });
    expect(pauseButton).toBeInTheDocument();

    await user.click(pauseButton);
    expect(window.HTMLMediaElement.prototype.pause).toHaveBeenCalled();
  });

  it('updates volume when volume control is changed', async () => {
    renderWithProviders(<CustomVideoPlayer src="https://example.com/video.mp4" />);

    const volumeSlider = screen.getByLabelText(/volume/i) as HTMLInputElement;
    expect(volumeSlider).toBeInTheDocument();
    expect(volumeSlider.value).toBe('1');

    const muteButton = screen.getByRole('button', { name: /mute/i });
    const user = userEvent.setup();
    await user.click(muteButton);

    expect(screen.getByRole('button', { name: /unmute/i })).toBeInTheDocument();
  });

  it('renders progress bar and formatted time display', () => {
    renderWithProviders(<CustomVideoPlayer src="https://example.com/video.mp4" />);

    const progressBar = screen.getByLabelText(/progress/i);
    expect(progressBar).toBeInTheDocument();

    expect(screen.getByText('00:00 / 00:00')).toBeInTheDocument();
  });

  it('triggers countdown overlay when video ends and navigates to order + 1 when finished', () => {
    vi.useFakeTimers();
    renderWithProviders(
      <CustomVideoPlayer
        src="https://example.com/video.mp4"
        seriesId="series-123"
        currentOrder={1}
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

    expect(mockNavigate).toHaveBeenCalledWith({
      to: '/videos/$seriesId',
      params: { seriesId: 'series-123' },
      search: { order: 2 },
    });

    vi.useRealTimers();
  });

  it('navigates immediately when Play Now button is clicked in countdown overlay', () => {
    renderWithProviders(
      <CustomVideoPlayer
        src="https://example.com/video.mp4"
        seriesId="series-123"
        currentOrder={2}
      />
    );

    const video = screen.getByTestId('custom-video-element');
    fireEvent.ended(video);

    const playNowBtn = screen.getByRole('button', { name: /Play Now/i });
    fireEvent.click(playNowBtn);

    expect(mockNavigate).toHaveBeenCalledWith({
      to: '/videos/$seriesId',
      params: { seriesId: 'series-123' },
      search: { order: 3 },
    });
  });

  it('cancels countdown when Cancel button is clicked in countdown overlay', () => {
    renderWithProviders(
      <CustomVideoPlayer
        src="https://example.com/video.mp4"
        seriesId="series-123"
        currentOrder={1}
      />
    );

    const video = screen.getByTestId('custom-video-element');
    fireEvent.ended(video);

    expect(screen.getByTestId('auto-next-countdown-overlay')).toBeInTheDocument();

    const cancelBtn = screen.getByRole('button', { name: /Cancel/i });
    fireEvent.click(cancelBtn);

    expect(screen.queryByTestId('auto-next-countdown-overlay')).not.toBeInTheDocument();
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});
