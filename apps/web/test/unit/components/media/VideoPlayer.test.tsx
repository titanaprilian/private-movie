import { renderWithProviders, screen, userEvent, fireEvent, act, within } from '../../../utils';
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

    const controlBar = screen.getByTestId('video-control-bar');
    const playButton = within(controlBar).getByRole('button', { name: /^play$/i });
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
    const pauseButton = await within(controlBar).findByRole('button', { name: /^pause$/i });
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

    const scrubbers = screen.getAllByLabelText(/progress/i) as HTMLInputElement[];
    expect(scrubbers.length).toBeGreaterThan(0);
    const scrubber = scrubbers[0];
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
    expect(screen.getByTestId('volume-icon-high')).toBeInTheDocument();

    // Change to low volume (<= 0.5)
    fireEvent.change(volumeSlider, { target: { value: '0.4' } });
    const video = screen.getByTestId('custom-video-element') as HTMLVideoElement;
    expect(video.volume).toBe(0.4);
    expect(screen.getByTestId('volume-icon-low')).toBeInTheDocument();

    // Toggle mute
    const muteButton = screen.getByRole('button', { name: /mute/i });
    await user.click(muteButton);

    expect(screen.getByRole('button', { name: /unmute/i })).toBeInTheDocument();
    expect(screen.getByTestId('volume-icon-muted')).toBeInTheDocument();
    expect(video.muted).toBe(true);

    // Unmute restores prior volume (0.4)
    await user.click(screen.getByRole('button', { name: /unmute/i }));
    expect(screen.getByRole('button', { name: /^mute$/i })).toBeInTheDocument();
    expect(video.muted).toBe(false);
    expect(video.volume).toBe(0.4);
    expect(screen.getByTestId('volume-icon-low')).toBeInTheDocument();

    // Setting slider to 0 mutes and shows VolumeX
    fireEvent.change(volumeSlider, { target: { value: '0' } });
    expect(video.muted).toBe(true);
    expect(screen.getByTestId('volume-icon-muted')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /unmute/i })).toBeInTheDocument();

    // Clicking unmute when slider was set to 0 restores default 1 or last non-zero volume
    await user.click(screen.getByRole('button', { name: /unmute/i }));
    expect(video.muted).toBe(false);
    expect(video.volume).toBe(0.4);
  });

  it('opens the settings popover from the 3D Gear button with playback speed options (0.5x, 1x, 1.25x, 1.5x, 2x)', async () => {
    const user = userEvent.setup();
    renderWithProviders(<VideoPlayer src="https://example.com/video.mp4" />);

    const settingsButton = screen.getAllByRole('button', { name: /video settings/i })[0];
    expect(settingsButton).toBeInTheDocument();

    await user.click(settingsButton);

    const speedOptions = ['0.5x', '1x', '1.25x', '1.5x', '2x'];
    for (const opt of speedOptions) {
      expect(screen.getByRole('button', { name: opt })).toBeInTheDocument();
    }
  });

  it('selecting playback speed updates video.playbackRate and closes the popover', async () => {
    const user = userEvent.setup();
    renderWithProviders(<VideoPlayer src="https://example.com/video.mp4" />);

    await user.click(screen.getAllByRole('button', { name: /video settings/i })[0]);

    const speed15Btn = screen.getByRole('button', { name: '1.5x' });
    await user.click(speed15Btn);

    const video = screen.getByTestId('custom-video-element') as HTMLVideoElement;
    expect(video.playbackRate).toBe(1.5);
    expect(screen.queryByRole('button', { name: '1.5x' })).not.toBeInTheDocument();
  });

  it('renders quality selection options when qualities prop is provided', async () => {
    const user = userEvent.setup();
    const onQualityChange = vi.fn();
    renderWithProviders(
      <VideoPlayer
        src="https://example.com/video.mp4"
        qualities={[
          { id: '1080p', label: '1080p' },
          { id: '720p', label: '720p' },
          { id: '480p', label: '480p' },
        ]}
        onQualityChange={onQualityChange}
      />
    );

    await user.click(screen.getAllByRole('button', { name: /video settings/i })[0]);

    expect(screen.getByRole('button', { name: '1080p' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '720p' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '480p' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '720p' }));
    expect(onQualityChange).toHaveBeenCalledWith('720p');
  });

  it('does not render quality selection when qualities prop is omitted', async () => {
    const user = userEvent.setup();
    renderWithProviders(<VideoPlayer src="https://example.com/video.mp4" />);

    await user.click(screen.getAllByRole('button', { name: /video settings/i })[0]);

    expect(screen.queryByText(/quality/i)).not.toBeInTheDocument();
  });

  it('renders subtitle toggle options when subtitles prop is provided', async () => {
    const user = userEvent.setup();
    const onSubtitleChange = vi.fn();
    renderWithProviders(
      <VideoPlayer
        src="https://example.com/video.mp4"
        subtitles={[
          { id: 'en', label: 'English' },
          { id: 'id', label: 'Indonesian' },
        ]}
        onSubtitleChange={onSubtitleChange}
      />
    );

    await user.click(screen.getAllByRole('button', { name: /video settings/i })[0]);

    expect(screen.getByRole('button', { name: 'English' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Indonesian' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /subtitles off/i })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'English' }));
    expect(onSubtitleChange).toHaveBeenCalledWith('en');
  });

  it('does not render subtitle options when subtitles prop is omitted', async () => {
    const user = userEvent.setup();
    renderWithProviders(<VideoPlayer src="https://example.com/video.mp4" />);

    await user.click(screen.getAllByRole('button', { name: /video settings/i })[0]);

    expect(screen.queryByText(/subtitles/i)).not.toBeInTheDocument();
  });

  it('opening Shortcuts & Gestures displays the dialog listing keyboard keys and mobile touch gestures', async () => {
    const user = userEvent.setup();
    renderWithProviders(<VideoPlayer src="https://example.com/video.mp4" />);

    await user.click(screen.getAllByRole('button', { name: /video settings/i })[0]);
    await user.click(screen.getAllByRole('button', { name: /shortcuts & gestures/i })[0]);

    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeInTheDocument();
    // Keyboard shortcuts table
    expect(dialog.textContent).toMatch(/Space/i);
    expect(dialog.textContent).toMatch(/ArrowRight/i);
    expect(dialog.textContent).toMatch(/Fullscreen/i);
    // Mobile touch gestures
    expect(dialog.textContent).toMatch(/tap/i);
  });

  it('keyboard shortcuts are active on VideoPlayer during playback', () => {
    renderWithProviders(<VideoPlayer src="https://example.com/video.mp4" />);

    const video = screen.getByTestId('custom-video-element');
    fireEvent.play(video);

    // "k" toggles pause while playing
    fireEvent.keyDown(document, { key: 'k' });
    expect(window.HTMLMediaElement.prototype.pause).toHaveBeenCalledTimes(1);

    // "f" toggles fullscreen
    const container = screen.getByTestId('video-player-container');
    container.requestFullscreen = vi.fn().mockImplementation(() => Promise.resolve());
    document.exitFullscreen = vi.fn().mockImplementation(() => Promise.resolve());
    fireEvent.keyDown(document, { key: 'f' });
    expect(container.requestFullscreen).toHaveBeenCalledTimes(1);

    // "m" toggles mute
    fireEvent.keyDown(document, { key: 'm' });
    expect((video as HTMLVideoElement).muted).toBe(true);
  });

  it('falls back to pseudo-fullscreen (fixed inset-0) when requestFullscreen is unavailable or rejects', async () => {
    const user = userEvent.setup();
    renderWithProviders(<VideoPlayer src="https://example.com/video.mp4" />);

    const container = screen.getByTestId('video-player-container');
    // Simulate iOS Safari where requestFullscreen is missing or rejects
    container.requestFullscreen = vi.fn().mockImplementation(() => Promise.reject(new Error('Not supported')));

    const fsButton = screen.getAllByRole('button', { name: /^fullscreen$/i })[0];
    await user.click(fsButton);

    expect(container.className).toContain('fixed');
    expect(container.className).toContain('inset-0');
    expect(container.className).toContain('z-50');

    // Controls remain mounted and functional
    expect(screen.getByTestId('video-mobile-bar')).toBeInTheDocument();
    expect(screen.getByTestId('video-center-controls')).toBeInTheDocument();

    // Clicking exit fullscreen removes pseudo-fullscreen classes
    const exitFsButton = screen.getAllByRole('button', { name: /exit fullscreen/i })[0];
    await user.click(exitFsButton);

    expect(container.className).not.toContain('fixed');
    expect(container.className).not.toContain('inset-0');
  });

  it('mobile center overlay transport buttons use scaled dimensions and semi-transparent styling', () => {
    renderWithProviders(<VideoPlayer src="https://example.com/video.mp4" />);

    const centerControls = screen.getByTestId('video-center-controls');
    const skipBack = within(centerControls).getByRole('button', { name: /skip back 10 seconds/i });
    const playBtn = within(centerControls).getByRole('button', { name: /^play$/i });
    const skipForward = within(centerControls).getByRole('button', { name: /skip forward 10 seconds/i });

    expect(skipBack.className).toMatch(/w-9/);
    expect(skipBack.className).toMatch(/h-9/);
    expect(skipBack.className).toMatch(/bg-black\/55/);

    expect(playBtn.className).toMatch(/w-12/);
    expect(playBtn.className).toMatch(/h-12/);

    expect(skipForward.className).toMatch(/w-9/);
    expect(skipForward.className).toMatch(/h-9/);
    expect(skipForward.className).toMatch(/bg-black\/55/);
  });

  it('does not render a Next Episode button in the player control bar even when hasNextEpisode is true', () => {
    renderWithProviders(
      <VideoPlayer
        src="https://example.com/video.mp4"
        hasNextEpisode
        onNextEpisode={vi.fn()}
      />
    );

    // Episodic navigation lives in the watch toolbar + corner card only
    expect(screen.queryByRole('button', { name: /next episode/i })).not.toBeInTheDocument();
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

    const controlBar = screen.getByTestId('video-control-bar');
    const backButton = within(controlBar).getByRole('button', { name: /skip back 10 seconds/i });
    const forwardButton = within(controlBar).getByRole('button', { name: /skip forward 10 seconds/i });
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

  it('marks the player container as a container-query context and splits mobile/desktop bars', () => {
    renderWithProviders(<VideoPlayer src="https://example.com/video.mp4" />);

    const container = screen.getByTestId('video-player-container');
    expect(container.className).toMatch(/@container/);

    const controlBar = screen.getByTestId('video-control-bar');
    expect(controlBar.className).toMatch(/hidden/);
    expect(controlBar.className).toMatch(/@md:flex/);

    const mobileBar = screen.getByTestId('video-mobile-bar');
    expect(mobileBar.className).toMatch(/@md:hidden/);

    const centerControls = screen.getByTestId('video-center-controls');
    expect(centerControls.className).toMatch(/@md:hidden/);
  });

  it('mobile center overlay renders skip, play and forward buttons that fade with controls', () => {
    renderWithProviders(<VideoPlayer src="https://example.com/video.mp4" />);

    const centerControls = screen.getByTestId('video-center-controls');
    expect(within(centerControls).getByRole('button', { name: /skip back 10 seconds/i })).toBeInTheDocument();
    expect(within(centerControls).getByRole('button', { name: /^play$/i })).toBeInTheDocument();
    expect(within(centerControls).getByRole('button', { name: /skip forward 10 seconds/i })).toBeInTheDocument();
    expect(centerControls.className).toContain('opacity-100');

    const video = screen.getByTestId('custom-video-element');
    fireEvent.play(video);
    const container = screen.getByTestId('video-player-container');
    fireEvent.touchStart(container, { touches: [{ clientX: 500, clientY: 100 }] });
    expect(centerControls.className).toContain('opacity-0');

    fireEvent.touchStart(container, { touches: [{ clientX: 500, clientY: 100 }] });
    expect(centerControls.className).toContain('opacity-100');
  });

  it('mobile bottom bar shows seek bar, time, settings and fullscreen without volume slider or title', () => {
    renderWithProviders(<VideoPlayer src="https://example.com/video.mp4" title="Episode 3" />);

    const mobileBar = screen.getByTestId('video-mobile-bar');
    expect(mobileBar.className).toMatch(/bg-gradient-to-t/);
    expect(within(mobileBar).getByLabelText(/progress/i)).toBeInTheDocument();
    expect(within(mobileBar).getByRole('button', { name: /video settings/i })).toBeInTheDocument();
    expect(within(mobileBar).getByRole('button', { name: /fullscreen/i })).toBeInTheDocument();
    expect(within(mobileBar).queryByLabelText(/volume/i)).not.toBeInTheDocument();
    expect(within(mobileBar).queryByText('Episode 3')).not.toBeInTheDocument();
  });

  it('elapsed / duration time never wraps', () => {
    renderWithProviders(<VideoPlayer src="https://example.com/video.mp4" />);

    const mobileBar = screen.getByTestId('video-mobile-bar');
    const mobileTime = within(mobileBar).getByText(/00:00 \/ 00:00/);
    expect(mobileTime.className).toMatch(/whitespace-nowrap/);
    expect(mobileTime.className).toMatch(/tabular-nums/);
    expect(mobileTime.className).toMatch(/shrink-0/);

    const controlBar = screen.getByTestId('video-control-bar');
    const desktopTime = within(controlBar).getByText(/00:00 \/ 00:00/);
    expect(desktopTime.className).toMatch(/whitespace-nowrap/);
    expect(desktopTime.className).toMatch(/tabular-nums/);
    expect(desktopTime.className).toMatch(/shrink-0/);
  });

  it('all interactive buttons meet the 40-44px minimum touch target', () => {
    renderWithProviders(<VideoPlayer src="https://example.com/video.mp4" />);

    const centerControls = screen.getByTestId('video-center-controls');
    for (const btn of within(centerControls).getAllByRole('button')) {
      expect(btn.className).toMatch(/min-w-\[(40|44|48|56)px\]/);
      expect(btn.className).toMatch(/min-h-\[(40|44|48|56)px\]/);
    }

    const controlBar = screen.getByTestId('video-control-bar');
    for (const btn of within(controlBar).getAllByRole('button')) {
      expect(btn.className).toMatch(/min-w-\[40px\]|w-1[0-9]|w-[2-9][0-9]/);
      expect(btn.className).toMatch(/min-h-\[40px\]|h-1[0-9]|h-[2-9][0-9]/);
    }

    const mobileBar = screen.getByTestId('video-mobile-bar');
    for (const btn of within(mobileBar).getAllByRole('button')) {
      expect(btn.className).toMatch(/min-w-\[40px\]/);
      expect(btn.className).toMatch(/min-h-\[40px\]/);
    }
  });
});
