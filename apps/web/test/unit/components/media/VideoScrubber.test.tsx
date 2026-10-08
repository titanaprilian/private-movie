import { renderWithProviders, screen, fireEvent } from '../../../utils';
import { describe, expect, it, vi } from 'vitest';
import { VideoScrubber } from '@/components/media/VideoScrubber';

describe('VideoScrubber component', () => {
  it('renders 3 layers representing background track, buffered percentage, and played percentage', () => {
    const onSeek = vi.fn();
    renderWithProviders(
      <VideoScrubber
        currentTime={30}
        duration={100}
        bufferedRanges={[{ start: 0, end: 60 }]}
        onSeek={onSeek}
      />
    );

    const scrubberContainer = screen.getByTestId('video-scrubber');
    expect(scrubberContainer).toBeInTheDocument();

    const bgTrack = screen.getByTestId('video-scrubber-track-bg');
    expect(bgTrack).toBeInTheDocument();
    expect(bgTrack.className).toMatch(/bg-zinc-800/);

    const bufferedBar = screen.getByTestId('video-scrubber-buffered');
    expect(bufferedBar).toBeInTheDocument();
    expect(bufferedBar.className).toMatch(/bg-zinc-600\/80/);
    expect(bufferedBar).toHaveStyle({ width: '60%' });

    const playedBar = screen.getByTestId('video-scrubber-played');
    expect(playedBar).toBeInTheDocument();
    expect(playedBar.className).toMatch(/bg-\[var\(--green\)\]/);
    expect(playedBar).toHaveStyle({ width: '30%' });
  });

  it('renders 16px 3D thumb handle at current played position', () => {
    const onSeek = vi.fn();
    renderWithProviders(
      <VideoScrubber
        currentTime={50}
        duration={100}
        bufferedRanges={[]}
        onSeek={onSeek}
      />
    );

    const thumb = screen.getByTestId('video-scrubber-thumb');
    expect(thumb).toBeInTheDocument();
    expect(thumb.className).toMatch(/w-4|w-\[16px\]/);
    expect(thumb.className).toMatch(/h-4|h-\[16px\]/);
    expect(thumb.className).toMatch(/border-2/);
    expect(thumb.className).toMatch(/border-\[var\(--green-dark\)\]/);
  });

  it('handles empty bufferedRanges or NaN duration gracefully without crashing', () => {
    const onSeek = vi.fn();
    renderWithProviders(
      <VideoScrubber
        currentTime={0}
        duration={NaN}
        bufferedRanges={[]}
        onSeek={onSeek}
      />
    );

    const bufferedBar = screen.getByTestId('video-scrubber-buffered');
    expect(bufferedBar).toHaveStyle({ width: '0%' });

    const playedBar = screen.getByTestId('video-scrubber-played');
    expect(playedBar).toHaveStyle({ width: '0%' });
  });

  it('hovering over scrubber calculates and displays timestamp tooltip pill formatted as MM:SS', () => {
    const onSeek = vi.fn();
    renderWithProviders(
      <VideoScrubber
        currentTime={10}
        duration={120}
        bufferedRanges={[]}
        onSeek={onSeek}
      />
    );

    const container = screen.getByTestId('video-scrubber');

    // Tooltip should not be visible before hover
    expect(screen.queryByTestId('video-scrubber-tooltip')).not.toBeInTheDocument();

    // Mock getBoundingClientRect for scrubber container
    vi.spyOn(container, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      top: 0,
      width: 200,
      height: 20,
      right: 200,
      bottom: 20,
      x: 0,
      y: 0,
      toJSON: () => {},
    });

    // Hover at 50% (100px of 200px) -> 50% of 120s = 60s -> '01:00'
    fireEvent.mouseMove(container, { clientX: 100 });

    const tooltip = screen.getByTestId('video-scrubber-tooltip');
    expect(tooltip).toBeInTheDocument();
    expect(tooltip).toHaveTextContent('01:00');

    // Hover at 25% (50px of 200px) -> 25% of 120s = 30s -> '00:30'
    fireEvent.mouseMove(container, { clientX: 50 });
    expect(tooltip).toHaveTextContent('00:30');

    // Mouse leave hides tooltip
    fireEvent.mouseLeave(container);
    expect(screen.queryByTestId('video-scrubber-tooltip')).not.toBeInTheDocument();
  });

  it('seeking via input range or clicking updates current playback time', () => {
    const onSeek = vi.fn();
    renderWithProviders(
      <VideoScrubber
        currentTime={10}
        duration={120}
        bufferedRanges={[]}
        onSeek={onSeek}
      />
    );

    const rangeInput = screen.getByLabelText(/progress/i);
    fireEvent.change(rangeInput, { target: { value: '45' } });
    expect(onSeek).toHaveBeenCalledWith(45);
  });
});
