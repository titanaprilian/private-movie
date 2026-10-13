import { formatEmbedUrl, getEmbedIframeSandbox } from '@/lib/media';
import { VideoPlayer } from '@/components/media/VideoPlayer';
import type { WatchPlayerFrameProps } from '../types';

export function WatchPlayerFrame({
  activeSource,
  episodeThumbnailUrl,
  episodeTitle,
  seriesBackdropUrl,
  isPlayerFocused,
  iframeRef,
  hasNextEpisode,
  onNextEpisode,
}: WatchPlayerFrameProps) {
  return (
    <div
      data-testid="watch-player-container"
      className="sticky top-0 z-20 mx-auto bg-[var(--bg)] w-[min(100%,calc((100dvh-12rem)*16/9))] aspect-video lg:static lg:z-auto"
    >
      {activeSource ? (
        activeSource.type === 'embed' ? (
          <div
            className={`relative aspect-video w-full overflow-hidden rounded-2xl sm:rounded-[20px] border-2 border-[var(--border)] bg-[var(--bg)] ${
              isPlayerFocused ? 'ring-2 ring-white' : ''
            }`}
            style={{
              backgroundImage: episodeThumbnailUrl
                ? `url(${episodeThumbnailUrl})`
                : seriesBackdropUrl
                  ? `url(${seriesBackdropUrl})`
                  : undefined,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }}
          >
            <iframe
              ref={iframeRef}
              data-testid="watch-player"
              src={formatEmbedUrl(activeSource.url)}
              title={episodeTitle ?? 'Video player'}
              className="relative z-10 h-full w-full"
              sandbox={getEmbedIframeSandbox(activeSource.url)}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen"
              allowFullScreen
              referrerPolicy="no-referrer"
            />
          </div>
        ) : (
          <div
            className={
              isPlayerFocused
                ? 'ring-2 ring-white rounded-2xl sm:rounded-[20px]'
                : ''
            }
          >
            <VideoPlayer
              src={activeSource.url}
              title={episodeTitle}
              autoPlay
              onNextEpisode={
                hasNextEpisode ? onNextEpisode : undefined
              }
              hasNextEpisode={hasNextEpisode}
            />
          </div>
        )
      ) : (
        <div className="flex aspect-video w-full items-center justify-center rounded-2xl sm:rounded-[20px] border-2 border-[var(--border)] bg-card text-muted">
          No video source available
        </div>
      )}
    </div>
  );
}
