import * as React from 'react';
import type {
  SeasonDetails,
  SeriesDetails,
  SeriesItem,
  TmdbPreviewResult,
  UpdateEpisodeData,
} from '../api';

export type {
  SeasonDetails,
  SeriesDetails,
  SeriesItem,
  TmdbPreviewResult,
  UpdateEpisodeData,
};

export type SeriesDetailEpisode = SeriesDetails['episodes'][number];

export type SeriesCardItem = SeriesItem & {
  episodes?: unknown[];
  episodeCount?: number;
};

export interface SeriesCardProps {
  item: SeriesCardItem;
  onToggleFeatured: (item: SeriesCardItem, e: React.MouseEvent) => void;
  onEdit: (item: SeriesCardItem, e: React.MouseEvent) => void;
  onDelete: (item: SeriesCardItem, e: React.MouseEvent) => void;
  onToggleHighlight?: (item: SeriesCardItem, e: React.MouseEvent) => void;
}

export interface GenreFilterProps {
  selectedSlugs: string[];
  onSelectionChange: (slugs: string[]) => void;
}

export interface SeriesDetailViewProps {
  seriesId: string;
  initialOrder?: number;
  initialEpisodeId?: string;
  initialSeasonId?: string;
}

export type ManageSourcesInitialTab =
  | 'add-url'
  | 'add-direct'
  | 'remote-ingest'
  | 'upload-s3'
  | 'edit-existing';

export interface UpdateEpisodeMutation {
  isPending: boolean;
  mutate: (variables: { id: string; data: UpdateEpisodeData }) => void;
}

export interface SeriesDetailModalsState {
  isMoveEpisodesOpen: boolean;
  onMoveEpisodesOpenChange: (open: boolean) => void;
  isBatchDeleteOpen: boolean;
  onBatchDeleteOpenChange: (open: boolean) => void;
  isEditSeriesOpen: boolean;
  onEditSeriesOpenChange: (open: boolean) => void;
  isSyncTmdbOpen: boolean;
  onSyncTmdbOpenChange: (open: boolean) => void;
  isBulkScrapeOpen: boolean;
  onBulkScrapeOpenChange: (open: boolean) => void;
  bulkScrapeEpisodeIds: string[] | null;
  onBulkScrapeEpisodeIdsChange: (ids: string[] | null) => void;
  isBulkIngestOpen: boolean;
  onBulkIngestOpenChange: (open: boolean) => void;
  isEditSeasonOpen: boolean;
  onEditSeasonOpenChange: (open: boolean) => void;
  isAddSeasonOpen: boolean;
  onAddSeasonOpenChange: (open: boolean) => void;
  isDeleteSeasonOpen: boolean;
  onDeleteSeasonOpenChange: (open: boolean) => void;
  isEditDialogOpen: boolean;
  onEditDialogOpenChange: (open: boolean) => void;
  isManageSourcesOpen: boolean;
  onManageSourcesOpenChange: (open: boolean) => void;
  manageSourcesInitialTab: ManageSourcesInitialTab | undefined;
  onManageSourcesInitialTabChange: (
    tab: ManageSourcesInitialTab | undefined,
  ) => void;
  isDeleteDialogOpen: boolean;
  onDeleteDialogOpenChange: (open: boolean) => void;
}

export interface SeriesDetailDialogsProps {
  series: SeriesDetails;
  seriesId: string;
  seasons: SeriesDetails['seasons'];
  activeSeason: SeasonDetails | null;
  localEpisodes: SeriesDetailEpisode[];
  selectedEpisode: SeriesDetailEpisode | null;
  selectedEpisodeIds: string[];
  episodeCountBySeason: Record<string, number>;
  updateMutation: UpdateEpisodeMutation;
  modals: SeriesDetailModalsState;
  onConfirmBulkMove: (targetSeasonId: string) => void;
  isMovePending: boolean;
  onConfirmBatchDelete: () => void;
  isBatchOperating: boolean;
  isDeleteSeasonPending: boolean;
  onConfirmDeleteSeason: () => void;
  onConfirmDeleteEpisode: () => void;
}

export interface SeriesDetailHeroProps {
  series: SeriesDetails;
  activeSeason: SeasonDetails | null;
  episodeCount: number;
  onEditSeries: () => void;
  onSyncTmdb: () => void;
  onBulkScrape: () => void;
  onBulkIngest: () => void;
}

export interface SeriesDetailSeasonBarProps {
  seasons: SeriesDetails['seasons'];
  activeSeason: SeasonDetails | null;
  selectedSeasonId: string | null;
  onSelectSeason: (seasonId: string) => void;
  onAddSeason: () => void;
  isScrapePending: boolean;
  onRunAutoScrape: (seasonId: string) => void;
  onEditSeason: () => void;
  onDeleteSeason: () => void;
}

export interface AddMediaStepInputProps {
  tmdbType: 'tv' | 'movie';
  tmdbId: string;
  includeSpecials: boolean;
  error: string | null;
  onTmdbTypeChange: (value: 'tv' | 'movie') => void;
  onTmdbIdChange: (value: string) => void;
  onIncludeSpecialsChange: (value: boolean) => void;
}

export interface AddMediaStepPreviewProps {
  tmdbType: 'tv' | 'movie';
  tmdbId: string;
  previewData: TmdbPreviewResult | null;
  importError: Error | null;
}

export interface EditEpisodeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  episode: SeriesDetailEpisode | null;
  updateMutation: UpdateEpisodeMutation;
}

export interface EditSeriesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  series: SeriesItem | SeriesDetails;
  seriesList?: SeriesItem[];
}

export interface FeaturedStarProps
  extends Omit<
    React.ButtonHTMLAttributes<HTMLButtonElement>,
    'onClick' | 'onToggle'
  > {
  featured: boolean;
  title?: string;
  onToggle: (e: React.MouseEvent) => void;
}

export interface SeriesPosterCardProps {
  seriesId: string;
  title: string;
  posterUrl: string;
  type: string;
  seasonsCount?: number | null;
  rating?: string | null;
  focused?: boolean;
  onSelect?: (seriesId: string) => void;
}

export interface RecentEpisodeCardProps {
  episodeId: string;
  seriesId: string;
  title: string;
  seriesTitle: string;
  thumbnailUrl: string;
  badgeLabel: string;
  onSelect?: (args: { episodeId: string; seriesId: string }) => void;
}

export interface SeriesDetailDialogSeries {
  id: string;
  title: string;
  synopsis: string;
  posterUrl: string;
  bannerUrl: string;
  type: string;
  seasons: number;
  episodes: number;
  rating: string;
  year: number;
  genres: string[];
}

export interface SeriesDetailDialogProps {
  series: SeriesDetailDialogSeries | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPlay?: (seriesId: string) => void;
}

export type SeriesSearch = {
  page?: number;
  q?: string;
  genre?: string;
  tab?: 'all' | 'featured' | 'ongoing';
  highlighted?: boolean;
};

export type SeriesListQueryData = {
  series: SeriesItem[];
  meta: { total: number; page: number; limit: number };
};

export interface UseEditSeriesFormOptions {
  open: boolean;
  series: SeriesItem | SeriesDetails;
  onOpenChange: (open: boolean) => void;
}

export interface UseSeriesDetailOptions {
  seriesId: string;
  initialSeasonId?: string;
}

export interface UseSeriesDetailDndOptions {
  seriesId: string;
  serverEpisodes: SeriesDetailEpisode[] | undefined;
  seasons: SeriesDetails['seasons'] | undefined;
  activeSeason: SeasonDetails | null;
  selectedEpisodeIds: string[];
  onCloseMoveDialog: () => void;
  onBulkMoveSuccess: () => void;
}

export interface UseSeriesDrawerSyncOptions {
  localEpisodes: SeriesDetailEpisode[];
  initialEpisodeId?: string;
  initialOrder?: number;
}

export interface UseAddMediaDialogReturn {
  isOpen: boolean;
  step: number;
  tmdbType: 'tv' | 'movie';
  tmdbId: string;
  includeSpecials: boolean;
  tmdbPreviewData: TmdbPreviewResult | null;
  isLoading: boolean;
  error: string | null;
  setTmdbType: (value: 'tv' | 'movie') => void;
  setTmdbId: (value: string) => void;
  setIncludeSpecials: (value: boolean) => void;
  submitPreview: () => Promise<boolean>;
  backToStep1: () => void;
  closeDialog: () => void;
  importTmdbMutation: {
    isPending: boolean;
    error: Error | null;
    mutate: (variables: { type: 'tv' | 'movie'; tmdbId: number; includeSpecials: boolean }) => void;
  };
}

export interface AddMediaStoreState {
  isOpen: boolean;
  step: 1 | 2;
  tmdbType: 'tv' | 'movie';
  tmdbId: string;
  includeSpecials: boolean;
  tmdbPreviewData: TmdbPreviewResult | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  openDialog: () => void;
  closeDialog: () => void;
  reset: () => void;
  setTmdbType: (tmdbType: 'tv' | 'movie') => void;
  setTmdbId: (tmdbId: string) => void;
  setIncludeSpecials: (includeSpecials: boolean) => void;
  setStep: (step: 1 | 2) => void;
  backToStep1: () => void;
  submitPreview: () => Promise<boolean>;
}

export type ScrapeWorkerState = AddMediaStoreState;

export interface UseGenreFilterOptions {
  selectedSlugs: string[];
  onSelectionChange: (slugs: string[]) => void;
}

export interface UseGenreFilterReturn {
  open: boolean;
  search: string;
  highlight: string;
  genres: { id: string; name: string; slug: string }[];
  isLoading: boolean;
  isError: boolean;
  namesBySlug: Map<string, string>;
  visibleGenres: { id: string; name: string; slug: string }[];
  isActive: boolean;
  triggerLabel: string;
  refetch: () => void;
  toggleGenre: (slug: string) => void;
  handleSearchChange: (value: string) => void;
  handleHighlightChange: (value: string) => void;
  handleOpenChange: (next: boolean) => void;
  handleClear: () => void;
  handleDone: () => void;
}

export interface UseSeriesCardOptions {
  item: SeriesCardItem;
}

export interface UseSeriesCardReturn {
  imgFailed: boolean;
  episodeCount: number;
  isFeatured: boolean;
  isHighlighted: boolean;
  isOngoing: boolean;
  showImg: boolean;
  initial: string;
  handleImageError: () => void;
  stop: <T extends SeriesCardItem>(
    fn: (item: T, e: React.MouseEvent) => void,
    item: T,
  ) => (e: React.MouseEvent) => void;
}

export type SeriesGridTab = 'all' | 'featured' | 'ongoing';

export interface SeriesGridQueryParams {
  page: number;
  q?: string;
  genre?: string;
  tab?: SeriesGridTab;
  highlighted?: boolean;
  limit: number;
}

export interface UseSeriesGridSearchResult {
  currentPage: number;
  activeTab: SeriesGridTab;
  highlightedOnly: boolean;
  selectedSlugs: string[];
  inputValue: string;
  setInputValue: (value: string) => void;
  queryParams: SeriesGridQueryParams;
  totalPages: number;
  /** Push list-query bounds in so out-of-range pages clamp back. */
  syncPageBounds: (total: number, limit: number) => void;
  handleToggleHighlightedOnly: () => void;
  handleTabChange: (nextTab: string) => void;
  handleGenreSelectionChange: (next: string[]) => void;
  handleToggleGenre: (slug: string) => void;
  gridTopRef: React.RefObject<HTMLDivElement | null>;
  goToPage: (page: number) => void;
}

export interface UseSeriesGridMutationsOptions {
  seriesList: SeriesItem[];
  currentPage: number;
  activeTab: SeriesGridTab;
  setDeletingSeries: (series: SeriesItem | null) => void;
}

export interface UseSeriesGridMutationsResult {
  deleteMutation: { isPending: boolean; mutate: (id: string) => void };
  featuredMutation: {
    isPending: boolean;
    mutate: (variables: { id: string; featured: boolean }) => void;
  };
  highlightMutation: {
    isPending: boolean;
    mutate: (variables: { id: string; highlighted: boolean }) => void;
  };
  handleToggleFeatured: (item: SeriesItem) => void;
  handleToggleHighlight: (item: SeriesItem, e: React.MouseEvent) => void;
}

export interface UseSeriesGridResult extends UseSeriesGridSearchResult {
  seriesList: SeriesCardItem[];
  isLoading: boolean;
  meta: { total: number; page: number; limit: number };
  bigGenres: { id: string; name: string; slug: string }[];
  highlightedCountByGenreSlug: Map<string, number>;
  editingSeries: SeriesItem | null;
  setEditingSeries: (series: SeriesItem | null) => void;
  deletingSeries: SeriesItem | null;
  setDeletingSeries: (series: SeriesItem | null) => void;
  openDialog: () => void;
  deleteMutation: UseSeriesGridMutationsResult['deleteMutation'];
  handleToggleFeatured: UseSeriesGridMutationsResult['handleToggleFeatured'];
  handleToggleHighlight: UseSeriesGridMutationsResult['handleToggleHighlight'];
  handleOpenEdit: (item: SeriesItem, e: React.MouseEvent) => void;
  handleOpenDelete: (item: SeriesItem, e: React.MouseEvent) => void;
}

export interface UseEditEpisodeFormOptions {
  open: boolean;
  episode: SeriesDetailEpisode | null;
  updateMutation: UpdateEpisodeMutation;
  onOpenChange: (open: boolean) => void;
}

export interface UseEpisodeBatchOperationsOptions {
  onInvalidateDetail: () => Promise<unknown> | void;
  onCloseBatchDeleteDialog?: () => void;
}
