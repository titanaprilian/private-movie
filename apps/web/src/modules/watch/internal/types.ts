import type {
  MediaEpisodeWithSources,
  MediaSeasonWithEpisodes,
  MediaSeriesDetails,
  MediaVideoSource,
} from '@repo/contracts';

export type WatchSeriesDetails = MediaSeriesDetails;
export type WatchSeason = MediaSeasonWithEpisodes;
export type WatchEpisode = MediaEpisodeWithSources;
export type WatchVideoSource = MediaVideoSource;

export type {
  MediaEpisodeWithSources,
  MediaSeasonWithEpisodes,
  MediaSeriesDetails,
  MediaVideoSource,
};

export interface SeriesWatchViewProps {
  seriesId?: string;
  series?: WatchSeriesDetails;
  initialSeasonId?: string;
  initialEpisodeId?: string;
  initialSourceIndex?: number;
}

export interface WatchViewErrorStateProps {
  message?: string;
  onRetry?: () => void;
}

export interface SeriesHeroBannerProps {
  series: WatchSeriesDetails;
  onPlay: () => void;
  /** @deprecated Back navigation is hoisted to the watch view shell (WatchTopNav). Kept for compat. */
  onBack?: () => void;
  isPlayDisabled?: boolean;
  isSpatialMode?: boolean;
  isPlayFocused?: boolean;
  /** @deprecated Back navigation is hoisted to the watch view shell (WatchTopNav). Kept for compat. */
  isBackFocused?: boolean;
  /** @deprecated Back navigation is hoisted to the watch view shell (WatchTopNav). Kept for compat. */
  backRef?: React.Ref<HTMLButtonElement | HTMLAnchorElement>;
  playRef?: React.Ref<HTMLButtonElement>;
}

export type WatchTopNavMode = 'overview' | 'player';

export interface WatchTopNavProps {
  mode: WatchTopNavMode;
  /** Referrer-safe back to catalogue (overview mode). */
  onBackToCatalog?: () => void;
  /** Back to episode overview (player mode). */
  onBackToOverview?: () => void;
  isBackFocused?: boolean;
  isSpatialMode?: boolean;
  backRef?: React.Ref<HTMLButtonElement>;
}

export interface EpisodeExplorerProps {
  seasons: WatchSeason[];
  activeSeasonId: string | null;
  onSelectSeason: (seasonId: string) => void;
  episodes: WatchEpisode[];
  series?: WatchSeriesDetails | null;
  activeEpisodeId?: string | null;
  onSelectEpisode: (episodeId: string) => void;
  episodeRefs?: React.MutableRefObject<(HTMLButtonElement | null)[]>;
  isSpatialMode?: boolean;
  activeZone?: string;
  focusIndex?: number;
  layoutMode?: 'grid' | 'list';
}

export interface EpisodeCardProps {
  episode: WatchEpisode;
  series?: WatchSeriesDetails | null;
  onSelect: (episodeId: string) => void;
  isNowPlaying?: boolean;
  isFocused?: boolean;
}

export interface EpisodeRowProps {
  episode: WatchEpisode;
  index: number;
  series?: WatchSeriesDetails | null;
  onSelect: (episodeId: string) => void;
  isNowPlaying?: boolean;
  isFocused?: boolean;
}

export type WatchZone = 'back' | 'player' | 'controls' | 'episodes';

export interface UseWatchNavOptions {
  controlsCount?: number;
  episodesCount?: number;
  iframeRef?: React.RefObject<HTMLIFrameElement | null>;
}

export interface UseWatchNavReturn {
  activeZone: WatchZone;
  focusIndex: number;
  setActiveZone: (zone: WatchZone) => void;
  setFocusIndex: (index: number) => void;
}

export interface UseWatchStateOptions {
  initialSeasonId?: string;
  initialEpisodeId?: string;
  initialSourceIndex?: number;
}

export interface UseWatchStateReturn {
  activeSeasonId: string | null;
  activeEpisodeId: string | null;
  activeSourceIndex: number;
  activeSeason: WatchSeason | null;
  activeEpisode: WatchEpisode | null;
  activeSource: WatchVideoSource | null;
  availableEpisodes: WatchEpisode[];
  hasNextEpisode: boolean;
  hasPrevEpisode: boolean;
  setActiveSeasonId: (seasonId: string) => void;
  setActiveEpisodeId: (episodeId: string) => void;
  setActiveSourceIndex: (index: number) => void;
  selectSeason: (seasonId: string) => void;
  selectEpisode: (episodeId: string) => void;
  selectSource: (index: number) => void;
  goToNextEpisode: () => void;
  goToPrevEpisode: () => void;
}

export interface AdblockDetectorResult {
  isLoading: boolean;
  isBlocked: boolean;
}
