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

export interface UseWatchSpatialFocusOptions {
  hasSeries: boolean;
  isSpatialMode: boolean;
  activeZone: WatchZone;
  focusIndex: number;
  setFocusIndex: (index: number) => void;
  selectedEpisodeId: string | null;
  iframeRef: React.RefObject<HTMLIFrameElement | null>;
  controlsCount: number;
}

export interface UseWatchSpatialFocusReturn {
  backRef: React.RefObject<HTMLAnchorElement | HTMLButtonElement | null>;
  playRef: React.RefObject<HTMLButtonElement | null>;
  controlsRefs: React.MutableRefObject<(HTMLButtonElement | null)[]>;
  episodeRefs: React.MutableRefObject<(HTMLButtonElement | null)[]>;
}

export type UseSeriesWatchViewOptions = SeriesWatchViewProps;

export interface UseSeriesWatchViewReturn {
  series: WatchSeriesDetails | null | undefined;
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  refetch: () => void;
  selectedEpisodeId: string | null;
  activeSeason: WatchSeason | null;
  activeSeasonId: string | null;
  activeEpisode: WatchEpisode | null;
  activeSource: WatchVideoSource | null;
  activeSourceIndex: number;
  availableEpisodes: WatchEpisode[];
  hasNextEpisode: boolean;
  hasPrevEpisode: boolean;
  selectSeason: (seasonId: string) => void;
  selectSource: (index: number) => void;
  isSpatialMode: boolean;
  activeZone: WatchZone;
  focusIndex: number;
  iframeRef: React.RefObject<HTMLIFrameElement | null>;
  backRef: React.RefObject<HTMLAnchorElement | HTMLButtonElement | null>;
  playRef: React.RefObject<HTMLButtonElement | null>;
  controlsRefs: React.MutableRefObject<(HTMLButtonElement | null)[]>;
  episodeRefs: React.MutableRefObject<(HTMLButtonElement | null)[]>;
  showAdblockModal: boolean;
  handleDismissWarning: () => void;
  sources: WatchVideoSource[];
  seasons: WatchSeason[];
  firstPlayableEpisode: WatchEpisode | null;
  isEmbedSource: boolean;
  serverControlIndex: number;
  backFocused: boolean;
  playerFocused: boolean;
  formattedEpisodeDuration: string | null;
  handleBackToHome: () => void;
  handleSelectEpisode: (episodeId: string) => void;
  handleGoToPrevEpisode: () => void;
  handleGoToNextEpisode: () => void;
  handlePlayFirstEpisode: () => void;
  handleBackToOverview: () => void;
  handleReloadIframe: () => void;
  handleOpenNewTab: () => void;
}

export interface WatchPlayerFrameProps {
  activeSource: WatchVideoSource | null;
  episodeThumbnailUrl?: string | null;
  episodeTitle?: string;
  seriesBackdropUrl?: string | null;
  isPlayerFocused?: boolean;
  iframeRef?: React.Ref<HTMLIFrameElement>;
  hasNextEpisode?: boolean;
  onNextEpisode?: () => void;
}

export interface WatchToolbarProps {
  hasPrevEpisode: boolean;
  hasNextEpisode: boolean;
  onPrevEpisode: () => void;
  onNextEpisode: () => void;
  onReloadPlayer: () => void;
  onOpenNewTab: () => void;
  isEmbedSource: boolean;
  activeSourceIndex: number;
  sources: WatchVideoSource[];
  onSelectSource: (index: number) => void;
  controlsRefs?: React.MutableRefObject<(HTMLButtonElement | null)[]>;
  serverControlIndex: number;
  isSpatialMode?: boolean;
  activeZone?: string;
  focusIndex?: number;
}

export interface ActiveEpisodeCardProps {
  seriesTitle: string;
  activeEpisode: WatchEpisode;
  activeSeasonTitle?: string | null;
  formattedDuration?: string | null;
  onBackToOverview: () => void;
}

export interface AdblockWarningDialogProps {
  open: boolean;
  onDismiss: () => void;
}

export interface WatchOverviewModeProps {
  series: WatchSeriesDetails;
  onBackToCatalog: () => void;
  isBackFocused: boolean;
  isSpatialMode: boolean;
  backRef: React.Ref<HTMLButtonElement>;
  onPlay: () => void;
  isPlayDisabled: boolean;
  isPlayFocused: boolean;
  playRef: React.Ref<HTMLButtonElement>;
  seasons: WatchSeason[];
  activeSeasonId: string | null;
  onSelectSeason: (seasonId: string) => void;
  episodes: WatchEpisode[];
  onSelectEpisode: (episodeId: string) => void;
  episodeRefs: React.MutableRefObject<(HTMLButtonElement | null)[]>;
  activeZone: WatchZone;
  focusIndex: number;
}

export interface WatchPlayerModeProps {
  series: WatchSeriesDetails;
  onBackToOverview: () => void;
  isBackFocused: boolean;
  isSpatialMode: boolean;
  backRef: React.Ref<HTMLButtonElement>;
  activeSource: WatchVideoSource | null;
  episodeThumbnailUrl?: string | null;
  episodeTitle?: string;
  isPlayerFocused: boolean;
  iframeRef: React.Ref<HTMLIFrameElement>;
  hasNextEpisode: boolean;
  hasPrevEpisode: boolean;
  onPrevEpisode: () => void;
  onNextEpisode: () => void;
  onReloadPlayer: () => void;
  onOpenNewTab: () => void;
  isEmbedSource: boolean;
  activeSourceIndex: number;
  sources: WatchVideoSource[];
  onSelectSource: (index: number) => void;
  controlsRefs: React.MutableRefObject<(HTMLButtonElement | null)[]>;
  serverControlIndex: number;
  activeZone: WatchZone;
  focusIndex: number;
  activeEpisode: WatchEpisode | null;
  activeSeasonTitle?: string | null;
  formattedDuration: string | null;
  seasons: WatchSeason[];
  activeSeasonId: string | null;
  onSelectSeason: (seasonId: string) => void;
  episodes: WatchEpisode[];
  activeEpisodeId: string | null;
  onSelectEpisode: (episodeId: string) => void;
  episodeRefs: React.MutableRefObject<(HTMLButtonElement | null)[]>;
}
