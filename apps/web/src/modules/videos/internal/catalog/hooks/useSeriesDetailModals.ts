import { useState, useCallback } from 'react';
import type { ManageSourcesInitialTab } from '../types';

export interface UseSeriesDetailModalsReturn {
  // Move Episodes
  isMoveEpisodesOpen: boolean;
  setIsMoveEpisodesOpen: (open: boolean) => void;

  // Batch Delete
  isBatchDeleteOpen: boolean;
  setIsBatchDeleteOpen: (open: boolean) => void;

  // Edit Series
  isEditSeriesOpen: boolean;
  setIsEditSeriesOpen: (open: boolean) => void;

  // Sync TMDB
  isSyncTmdbOpen: boolean;
  setIsSyncTmdbOpen: (open: boolean) => void;

  // Bulk Scrape
  isBulkScrapeOpen: boolean;
  setIsBulkScrapeOpen: (open: boolean) => void;
  bulkScrapeEpisodeIds: string[] | null;
  setBulkScrapeEpisodeIds: (ids: string[] | null) => void;
  handleOpenBulkScrape: (episodeIds?: string[] | null) => void;

  // Bulk Ingest
  isBulkIngestOpen: boolean;
  setIsBulkIngestOpen: (open: boolean) => void;

  // Edit Season
  isEditSeasonOpen: boolean;
  setIsEditSeasonOpen: (open: boolean) => void;

  // Add Season
  isAddSeasonOpen: boolean;
  setIsAddSeasonOpen: (open: boolean) => void;

  // Delete Season
  isDeleteSeasonOpen: boolean;
  setIsDeleteSeasonOpen: (open: boolean) => void;

  // Edit Episode
  isEditDialogOpen: boolean;
  setIsEditDialogOpen: (open: boolean) => void;

  // Manage Sources
  isManageSourcesOpen: boolean;
  setIsManageSourcesOpen: (open: boolean) => void;
  manageSourcesInitialTab: ManageSourcesInitialTab | undefined;
  setManageSourcesInitialTab: (tab: ManageSourcesInitialTab | undefined) => void;
  handleOpenManageSources: (tab?: ManageSourcesInitialTab) => void;

  // Delete Episode
  isDeleteDialogOpen: boolean;
  setIsDeleteDialogOpen: (open: boolean) => void;
}

export function useSeriesDetailModals(): UseSeriesDetailModalsReturn {
  const [isMoveEpisodesOpen, setIsMoveEpisodesOpen] = useState(false);
  const [isBatchDeleteOpen, setIsBatchDeleteOpen] = useState(false);
  const [isEditSeriesOpen, setIsEditSeriesOpen] = useState(false);
  const [isSyncTmdbOpen, setIsSyncTmdbOpen] = useState(false);
  const [isBulkScrapeOpen, setIsBulkScrapeOpen] = useState(false);
  const [bulkScrapeEpisodeIds, setBulkScrapeEpisodeIds] = useState<string[] | null>(null);
  const [isBulkIngestOpen, setIsBulkIngestOpen] = useState(false);
  const [isEditSeasonOpen, setIsEditSeasonOpen] = useState(false);
  const [isAddSeasonOpen, setIsAddSeasonOpen] = useState(false);
  const [isDeleteSeasonOpen, setIsDeleteSeasonOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isManageSourcesOpen, setIsManageSourcesOpen] = useState(false);
  const [manageSourcesInitialTab, setManageSourcesInitialTab] = useState<
    ManageSourcesInitialTab | undefined
  >(undefined);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  const handleOpenBulkScrape = useCallback((episodeIds?: string[] | null) => {
    setBulkScrapeEpisodeIds(episodeIds ?? null);
    setIsBulkScrapeOpen(true);
  }, []);

  const handleOpenManageSources = useCallback((tab?: ManageSourcesInitialTab) => {
    setManageSourcesInitialTab(tab);
    setIsManageSourcesOpen(true);
  }, []);

  return {
    isMoveEpisodesOpen,
    setIsMoveEpisodesOpen,
    isBatchDeleteOpen,
    setIsBatchDeleteOpen,
    isEditSeriesOpen,
    setIsEditSeriesOpen,
    isSyncTmdbOpen,
    setIsSyncTmdbOpen,
    isBulkScrapeOpen,
    setIsBulkScrapeOpen,
    bulkScrapeEpisodeIds,
    setBulkScrapeEpisodeIds,
    handleOpenBulkScrape,
    isBulkIngestOpen,
    setIsBulkIngestOpen,
    isEditSeasonOpen,
    setIsEditSeasonOpen,
    isAddSeasonOpen,
    setIsAddSeasonOpen,
    isDeleteSeasonOpen,
    setIsDeleteSeasonOpen,
    isEditDialogOpen,
    setIsEditDialogOpen,
    isManageSourcesOpen,
    setIsManageSourcesOpen,
    manageSourcesInitialTab,
    setManageSourcesInitialTab,
    handleOpenManageSources,
    isDeleteDialogOpen,
    setIsDeleteDialogOpen,
  };
}
