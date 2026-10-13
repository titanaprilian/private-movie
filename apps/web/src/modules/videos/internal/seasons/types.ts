import type {
  ReorderEpisodeItem,
  SeasonDetails,
  SeriesDetails,
  UpdateEpisodeData,
} from '../api';

export type {
  ReorderEpisodeItem,
  SeasonDetails,
  SeriesDetails,
  UpdateEpisodeData,
};

export type EpisodeTableEpisode = SeriesDetails['episodes'][number];

export type EpisodeDrawerEpisode = SeriesDetails['episodes'][number];

/** Episode row type shared by the episode table and detail drawer. */
export type Episode = EpisodeTableEpisode;

export type EpisodeTableSortField =
  | 'order'
  | 'title'
  | 'duration'
  | 'releaseDate';
export type EpisodeTableSortDirection = 'asc' | 'desc';

/** Aliases kept next to the table component's historic exports. */
export type SortField = EpisodeTableSortField;
export type SortDirection = EpisodeTableSortDirection;

export type SeasonStatus = 'completed' | 'ongoing' | 'pending';

export interface CrossSeasonMove {
  episodes: Episode[];
  orders: ReorderEpisodeItem[];
}

export interface AddSeasonDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  seriesId: string;
  seasons: SeasonDetails[];
}

export interface BatchDeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedEpisodeCount: number;
  onConfirmDelete: () => void;
  isPending?: boolean;
}

export interface EditSeasonDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  season: SeasonDetails;
}

export interface EpisodeDetailDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  episode: Episode | null;
  onSave: (episodeId: string, data: UpdateEpisodeData) => Promise<void> | void;
  isSaving?: boolean;
  onOpenAdvancedIngest?: (tab: 'remote-ingest' | 'upload-s3') => void;
}

export interface EpisodeTableProps {
  episodes: Episode[];
  onSelectEpisode?: (episode: Episode) => void;
  onEditEpisode?: (episode: Episode) => void;
  onDeleteEpisode?: (episode: Episode) => void;
  onManageSources?: (episode: Episode) => void;
  selectedEpisodeId?: string | null;

  // Multi-selection props (bulk actions render in SeriesDetailView sticky bulkbar)
  selectedEpisodeIds?: string[];
  onSelectedEpisodeIdsChange?: (selectedIds: string[]) => void;
}

export interface MoveEpisodesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  seasons: SeasonDetails[];
  currentSeasonId: string | null;
  selectedCount: number;
  episodeCountBySeason: Record<string, number>;
  isPending?: boolean;
  onConfirm: (targetSeasonId: string) => void;
}

export interface UseAddSeasonFormOptions {
  open: boolean;
  seriesId: string;
  seasons: SeasonDetails[];
  onOpenChange: (open: boolean) => void;
}

export interface UseEditSeasonFormOptions {
  open: boolean;
  season: SeasonDetails;
  onOpenChange: (open: boolean) => void;
}

export interface EpisodeDrawerFormState {
  title: string;
  description: string;
  duration: string;
}

export interface UseEpisodeDetailDrawerOptions {
  episode: EpisodeDrawerEpisode | null;
  onSave: (episodeId: string, data: UpdateEpisodeData) => Promise<void> | void;
  isSaving?: boolean;
}

export interface UseEpisodeTableOptions {
  episodes: EpisodeTableEpisode[];
  selectedEpisodeIds?: string[];
  onSelectedEpisodeIdsChange?: (selectedIds: string[]) => void;
}
