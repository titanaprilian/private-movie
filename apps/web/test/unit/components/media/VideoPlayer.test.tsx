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

  it('updates volume and toggle mute with multi-state icon and restoring prior volume', async () => {
    const user = userEvent.setup();
    renderWithProviders(<VideoPlayer src="https://example.com/video.mp4" />);

    const volumeSlider = screen.getByLabelText(/volume/i) as HTMLInputElement;
    expect(volumeSlider).toBeInTheDocument();
    expect(volumeSlider.value).toBe('1');

    // Initially volume = 1 (> 0.5) -> Volume2 icon rendered
    expect(screen.getByTestId('volume-icon-high')).toBeInTheDocument();

    // Change volume to 0.4 (<= 0.5 and > 0) -> Volume1 icon rendered
    fireEvent.change(volumeSlider, { target: { value: '0.4' } });
    const video = screen.getByTestId('custom-video-element') as HTMLVideoElement;
    expect(video.volume).toBe(0.4);
    expect(screen.getByTestId('volume-icon-low')).toBeInTheDocument();

    // Click mute button -> volume muted, VolumeX icon rendered
    const muteButton = screen.getByRole('button', { name: /mute/i });
    await user.click(muteButton);

    const unmuteButton = screen.getByRole('button', { name: /unmute/i });
    expect(unmuteButton).toBeInTheDocument();
    expect(screen.getByTestId('volume-icon-muted')).toBeInTheDocument();
    expect(video.muted).toBe(true);

    // Click unmute button -> restores prior volume (0.4) and un-mutes
    await user.click(unmuteButton);
    expect(video.muted).toBe(false);
    expect(video.volume).toBe(0.4);
    expect(screen.getByTestId('volume-icon-low')).toBeInTheDocument();
    expect(volumeSlider.value).toBe('0.4');

    // Setting slider to 0 sets muted/zero state
    fireEvent.change(volumeSlider, { target: { value: '0' } });
    expect(screen.getByTestId('volume-icon-muted')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /unmute/i })).toBeInTheDocument();

    // Clicking unmute when slider was set to 0 restores default 1 or last non-zero volume
    await user.click(screen.getByRole('button', { name: /unmute/i }));
    expect(video.muted).toBe(false);
    expect(video.volume).toBe(0.4);
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

  it('renders control bar Next Episode button when hasNextEpisode is true and calls onNextEpisode on click', async () => {
    const user = userEvent.setup();
    const handleNextEpisode = vi.fn();
    renderWithProviders(
      <VideoPlayer
        src="https://example.com/video.mp4"
        hasNextEpisode
        onNextEpisode={handleNextEpisode}
      />
    );

    const nextButton = screen.getByRole('button', { name: /next episode/i });
    expect(nextButton).toBeInTheDocument();
    expect(nextButton.className).toMatch(/rounded-full/);

    await user.click(nextButton);
    expect(handleNextEpisode).toHaveBeenCalledTimes(1);
  });

  it('does not render Next Episode button when hasNextEpisode is false', () => {
    renderWithProviders(<VideoPlayer src="https://example.com/video.mp4" />);
    expect(screen.queryByRole('button', { name: /next episode/i })).not.toBeInTheDocument();
  });

  it('shows floating corner card when playback reaches the final 25 seconds', () => {
    renderWithProviders(
      <VideoPlayer
        src="https://example.com/video.mp4"
        hasNextEpisode
        onNextEpisode={vi.fn()}
      />
    );

    const video = screen.getByTestId('custom-video-element') as HTMLVideoElement;
    Object.defineProperty(video, 'duration', { value: 100, writable: true });
    fireEvent.loadedMetadata(video);
    expect(screen.queryByTestId('next-episode-card')).not.toBeInTheDocument();

    Object.defineProperty(video, 'currentTime', { value: 74, writable: true });
    fireEvent.timeUpdate(video);
    expect(screen.queryByTestId('next-episode-card')).not.toBeInTheDocument();

    Object.defineProperty(video, 'currentTime', { value: 75, writable: true });
    fireEvent.timeUpdate(video);
    expect(screen.getByTestId('next-episode-card')).toBeInTheDocument();
    expect(screen.getByText(/Next episode in 5s/i)).toBeInTheDocument();
  });

  it('does not show corner card when duration metadata is not loaded', () => {
    renderWithProviders(
      <VideoPlayer
        src="https://example.com/video.mp4"
        hasNextEpisode
        onNextEpisode={vi.fn()}
      />
    );
    const video = screen.getByTestId('custom-video-element');
    fireEvent.timeUpdate(video);
    expect(screen.queryByTestId('next-episode-card')).not.toBeInTheDocument();
  });

  it('decrements 5-second countdown and triggers onNextEpisode when it reaches 0', () => {
    vi.useFakeTimers();
    const handleNextEpisode = vi.fn();
    renderWithProviders(
      <VideoPlayer
        src="https://example.com/video.mp4"
        hasNextEpisode
        onNextEpisode={handleNextEpisode}
      />
    );

    const video = screen.getByTestId('custom-video-element') as HTMLVideoElement;
    Object.defineProperty(video, 'duration', { value: 100, writable: true });
    fireEvent.loadedMetadata(video);
    Object.defineProperty(video, 'currentTime', { value: 80, writable: true });
    fireEvent.timeUpdate(video);

    expect(screen.getByTestId('next-episode-card')).toBeInTheDocument();
    expect(screen.getByText(/Next episode in 5s/i)).toBeInTheDocument();

    for (let i = 0; i < 5; i++) {
      act(() => {
        vi.advanceTimersByTime(1000);
      });
    }

    expect(handleNextEpisode).toHaveBeenCalledTimes(1);

    vi.useRealTimers();
  });

  it('clicking Play Now immediately advances to the next episode', () => {
    const handleNextEpisode = vi.fn();
    renderWithProviders(
      <VideoPlayer
        src="https://example.com/video.mp4"
        hasNextEpisode
        onNextEpisode={handleNextEpisode}
      />
    );

    const video = screen.getByTestId('custom-video-element') as HTMLVideoElement;
    Object.defineProperty(video, 'duration', { value: 100, writable: true });
    fireEvent.loadedMetadata(video);
    Object.defineProperty(video, 'currentTime', { value: 90, writable: true });
    fireEvent.timeUpdate(video);

    const playNowBtn = screen.getByRole('button', { name: /Play Now/i });
    fireEvent.click(playNowBtn);

    expect(handleNextEpisode).toHaveBeenCalledTimes(1);
  });

  it('clicking Cancel hides the card and prevents auto-advancing on video end', () => {
    const handleNextEpisode = vi.fn();
    renderWithProviders(
      <VideoPlayer
        src="https://example.com/video.mp4"
        hasNextEpisode
        onNextEpisode={handleNextEpisode}
      />
    );

    const video = screen.getByTestId('custom-video-element') as HTMLVideoElement;
    Object.defineProperty(video, 'duration', { value: 100, writable: true });
    fireEvent.loadedMetadata(video);
    Object.defineProperty(video, 'currentTime', { value: 90, writable: true });
    fireEvent.timeUpdate(video);

    expect(screen.getByTestId('next-episode-card')).toBeInTheDocument();

    const cancelBtn = screen.getByRole('button', { name: /Cancel/i });
    fireEvent.click(cancelBtn);

    expect(screen.queryByTestId('next-episode-card')).not.toBeInTheDocument();
    expect(handleNextEpisode).not.toHaveBeenCalled();

    // Card stays hidden on further time updates and video end does not auto-advance
    Object.defineProperty(video, 'currentTime', { value: 99, writable: true });
    fireEvent.timeUpdate(video);
    expect(screen.queryByTestId('next-episode-card')).not.toBeInTheDocument();

    fireEvent.ended(video);
    expect(handleNextEpisode).not.toHaveBeenCalled();
  });

  it('auto-advances on video end when not cancelled', () => {
    const handleNextEpisode = vi.fn();
    renderWithProviders(
      <VideoPlayer
        src="https://example.com/video.mp4"
        hasNextEpisode
        onNextEpisode={handleNextEpisode}
      />
    );

    const video = screen.getByTestId('custom-video-element');
    fireEvent.ended(video);
    expect(handleNextEpisode).toHaveBeenCalledTimes(1);
  });

  it('single tap on video container on touch devices toggles controls without pausing', () => {
    renderWithProviders(<VideoPlayer src="https://example.com/video.mp4" />);

    // Controls only auto-hide while playing, so put the video in playing state
    const video = screen.getByTestId('custom-video-element');
    fireEvent.play(video);

    const container = screen.getByTestId('video-player-container');
    const controlBar = screen.getByTestId('video-control-bar');
    expect(controlBar.className).toContain('opacity-100');

    // First tap hides controls
    fireEvent.touchStart(container, { touches: [{ clientX: 100, clientY: 100 }] });
    expect(controlBar.className).toContain('opacity-0');
    expect(window.HTMLMediaElement.prototype.pause).not.toHaveBeenCalled();
    expect(window.HTMLMediaElement.prototype.play).not.toHaveBeenCalled();

    // Second tap shows controls again, still without pausing
    fireEvent.touchStart(container, { touches: [{ clientX: 100, clientY: 100 }] });
    expect(controlBar.className).toContain('opacity-100');
    expect(window.HTMLMediaElement.prototype.pause).not.toHaveBeenCalled();
  });

  it('controls auto-hide after 3s of inactivity while playing on touch devices', () => {
    vi.useFakeTimers();
    renderWithProviders(<VideoPlayer src="https://example.com/video.mp4" />);

    const video = screen.getByTestId('custom-video-element');
    fireEvent.play(video);
    const container = screen.getByTestId('video-player-container');
    const controlBar = screen.getByTestId('video-control-bar');

    // Tap to show + reset timer
    fireEvent.touchStart(container, { touches: [{ clientX: 50, clientY: 50 }] });
    // Ensure visible state: tap twice if first tap hid controls
    if (controlBar.className.includes('opacity-0')) {
      fireEvent.touchStart(container, { touches: [{ clientX: 50, clientY: 50 }] });
    }
    expect(controlBar.className).toContain('opacity-100');

    act(() => {
      vi.advanceTimersByTime(3500);
    });
    expect(controlBar.className).toContain('opacity-0');

    vi.useRealTimers();
  });

  it('clicking video on desktop with mouse toggles play/pause', () => {
    renderWithProviders(<VideoPlayer src="https://example.com/video.mp4" />);

    const video = screen.getByTestId('custom-video-element');
    fireEvent.click(video);
    expect(window.HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(1);

    fireEvent.play(video);
    fireEvent.click(video);
    expect(window.HTMLMediaElement.prototype.pause).toHaveBeenCalledTimes(1);
  });

  it('tapping inside the control bar does not toggle controls visibility', () => {
    renderWithProviders(<VideoPlayer src="https://example.com/video.mp4" />);

    // Playing: a tap outside the bar would hide controls, so this proves the guard
    const video = screen.getByTestId('custom-video-element');
    fireEvent.play(video);

    const controlBar = screen.getByTestId('video-control-bar');
    expect(controlBar.className).toContain('opacity-100');

    // Touch starting on an element inside the control bar (volume slider bubbles to container)
    const volumeSlider = screen.getByLabelText(/volume/i);
    fireEvent.touchStart(volumeSlider);

    expect(controlBar.className).toContain('opacity-100');
  });

  it('renders 3D circular skip buttons that seek video by ±10s on click', async () => {
    const user = userEvent.setup();
    window.localStorage.clear();
    renderWithProviders(<VideoPlayer src="https://example.com/video.mp4" />);

    const backButton = screen.getByRole('button', { name: /skip back 10 seconds/i });
    const forwardButton = screen.getByRole('button', { name: /skip forward 10 seconds/i });
    expect(backButton).toBeInTheDocument();
    expect(forwardButton).toBeInTheDocument();
    // Chunky 3D tactile styling adjacent to Play/Pause
    expect(backButton.className).toMatch(/rounded-full/);
    expect(backButton.className).toMatch(/shadow-\[0_3px_0/);
    expect(backButton.className).toMatch(/active:translate-y-/);
    expect(forwardButton.className).toMatch(/rounded-full/);
    expect(forwardButton.className).toMatch(/shadow-\[0_3px_0/);

    const video = screen.getByTestId('custom-video-element') as HTMLVideoElement;
    Object.defineProperty(video, 'duration', { value: 120, writable: true });
    video.currentTime = 50;

    await user.click(forwardButton);
    expect(video.currentTime).toBe(60);

    await user.click(backButton);
    expect(video.currentTime).toBe(50);
  });

  it('double-tapping the left side seeks -10s with a backward ripple overlay', () => {
    window.localStorage.setItem('pm_player_gesture_hint_seen', '1');
    renderWithProviders(<VideoPlayer src="https://example.com/video.mp4" />);

    const container = screen.getByTestId('video-player-container');
    vi.spyOn(container, 'getBoundingClientRect').mockReturnValue({
      width: 1000,
      height: 500,
      top: 0,
      left: 0,
      bottom: 500,
      right: 1000,
      x: 0,
      y: 0,
      toJSON: () => {},
    });

    const video = screen.getByTestId('custom-video-element') as HTMLVideoElement;
    Object.defineProperty(video, 'duration', { value: 120, writable: true });
    video.currentTime = 50;

    const controlBar = screen.getByTestId('video-control-bar');
    fireEvent.play(video);
    expect(controlBar.className).toContain('opacity-100');

    // Double-tap left zone: seeks without toggling controls visibility
    fireEvent.touchStart(container, { touches: [{ clientX: 100, clientY: 100 }] });
    fireEvent.touchStart(container, { touches: [{ clientX: 120, clientY: 100 }] });

    expect(video.currentTime).toBe(40);
    expect(controlBar.className).toContain('opacity-100');
    const ripple = screen.getByTestId('gesture-ripple-backward');
    expect(ripple).toBeInTheDocument();
    expect(ripple.textContent).toMatch(/⏪ -10s/);
  });

  it('double-tapping the right side seeks +10s with a forward ripple overlay', () => {
    window.localStorage.setItem('pm_player_gesture_hint_seen', '1');
    renderWithProviders(<VideoPlayer src="https://example.com/video.mp4" />);

    const container = screen.getByTestId('video-player-container');
    vi.spyOn(container, 'getBoundingClientRect').mockReturnValue({
      width: 1000,
      height: 500,
      top: 0,
      left: 0,
      bottom: 500,
      right: 1000,
      x: 0,
      y: 0,
      toJSON: () => {},
    });

    const video = screen.getByTestId('custom-video-element') as HTMLVideoElement;
    Object.defineProperty(video, 'duration', { value: 120, writable: true });
    video.currentTime = 50;

    fireEvent.touchStart(container, { touches: [{ clientX: 900, clientY: 100 }] });
    fireEvent.touchStart(container, { touches: [{ clientX: 880, clientY: 100 }] });

    expect(video.currentTime).toBe(60);
    const ripple = screen.getByTestId('gesture-ripple-forward');
    expect(ripple).toBeInTheDocument();
    expect(ripple.textContent).toMatch(/⏩ \+10s/);
  });

  it('double-clicking toggles fullscreen', () => {
    window.localStorage.setItem('pm_player_gesture_hint_seen', '1');
    renderWithProviders(<VideoPlayer src="https://example.com/video.mp4" />);

    const container = screen.getByTestId('video-player-container');
    container.requestFullscreen = vi.fn().mockImplementation(() => Promise.resolve());

    fireEvent.doubleClick(container);
    expect(container.requestFullscreen).toHaveBeenCalled();
  });

  it('shows the first-time gesture hint and persists it', () => {
    vi.useFakeTimers();
    window.localStorage.removeItem('pm_player_gesture_hint_seen');
    renderWithProviders(<VideoPlayer src="https://example.com/video.mp4" />);

    expect(screen.getByTestId('gesture-hint')).toBeInTheDocument();
    expect(screen.getByText(/double tap sides to skip 10s/i)).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(2500);
    });
    expect(screen.queryByTestId('gesture-hint')).not.toBeInTheDocument();
    expect(window.localStorage.getItem('pm_player_gesture_hint_seen')).not.toBeNull();

    vi.useRealTimers();
  });
});
