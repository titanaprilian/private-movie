import { useState, useMemo } from 'react';
import { formatBytes, type StorageResource } from './api';
import { ChunkyButton } from '@/components/ui/chunky-button';
import { ChunkyInput } from '@/components/ui/chunky-input';
import { ChunkyCheckbox } from '@/components/ui/chunky-checkbox';
import { ChunkyChip } from '@/components/ui/chunky-chip';
import { ChunkyCard, ChunkyCardList } from '@/components/ui/chunky-card';
import { ChunkySkeleton } from '@/components/ui/chunky-skeleton';
import { ChunkyActionMenu } from '@/components/ui/chunky-action-menu';
import {
  Search,
  RefreshCw,
  Trash2,
  Play,
  Edit2,
  Link as LinkIcon,
  AlertTriangle,
  ExternalLink,
} from 'lucide-react';
import { Link } from '@tanstack/react-router';

export type StatusFilter = 'all' | 'linked' | 'orphaned';
export type SortByField = 'size' | 'date' | 'name';
export type SortOrder = 'asc' | 'desc';

export interface StorageResourceTableProps {
  resources: StorageResource[];
  isLoading?: boolean;
  onRefreshScan: () => void;
  isRefreshing?: boolean;
  onPreview: (resource: StorageResource) => void;
  onEditSource: (resource: StorageResource) => void;
  onAttachOrphan: (resource: StorageResource) => void;
  onDeleteSingle: (resource: StorageResource) => void;
  onDeleteBatch: (selectedResources: StorageResource[]) => void;
  onPurgeOrphans: () => void;
  orphanedCount?: number;
}

export function StorageResourceTable({
  resources,
  isLoading = false,
  onRefreshScan,
  isRefreshing = false,
  onPreview,
  onEditSource,
  onAttachOrphan,
  onDeleteSingle,
  onDeleteBatch,
  onPurgeOrphans,
  orphanedCount = 0,
}: StorageResourceTableProps) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [sortBy, setSortBy] = useState<SortByField>('size');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);

  // Toggle sort direction or field
  const handleSort = (field: SortByField) => {
    if (sortBy === field) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
  };

  // Filtered & sorted resources
  const processedResources = useMemo(() => {
    return resources
      .filter((r) => {
        // Status filter
        if (statusFilter === 'linked' && r.status !== 'linked') return false;
        if (statusFilter === 'orphaned' && r.status !== 'orphaned')
          return false;

        // Search filter (filename, S3 key, or series title)
        if (search.trim()) {
          const query = search.toLowerCase();
          const matchesFilename = r.filename.toLowerCase().includes(query);
          const matchesKey = r.key.toLowerCase().includes(query);
          const matchesSeries = r.episode?.seriesTitle
            ?.toLowerCase()
            .includes(query);
          const matchesEpisode = r.episode?.title
            ?.toLowerCase()
            .includes(query);
          if (
            !matchesFilename &&
            !matchesKey &&
            !matchesSeries &&
            !matchesEpisode
          ) {
            return false;
          }
        }
        return true;
      })
      .sort((a, b) => {
        let cmp = 0;
        if (sortBy === 'size') {
          cmp = (a.sizeBytes || 0) - (b.sizeBytes || 0);
        } else if (sortBy === 'date') {
          const dateA = new Date(a.lastModified || 0).getTime();
          const dateB = new Date(b.lastModified || 0).getTime();
          cmp = dateA - dateB;
        } else if (sortBy === 'name') {
          cmp = a.filename.localeCompare(b.filename);
        }
        return sortOrder === 'asc' ? cmp : -cmp;
      });
  }, [resources, statusFilter, search, sortBy, sortOrder]);

  // Checkbox handlers
  const allProcessedKeys = processedResources.map((r) => r.key);
  const isAllSelected =
    allProcessedKeys.length > 0 &&
    allProcessedKeys.every((key) => selectedKeys.includes(key));
  const isSomeSelected = selectedKeys.length > 0 && !isAllSelected;

  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedKeys([]);
    } else {
      setSelectedKeys(allProcessedKeys);
    }
  };

  const toggleSelectRow = (key: string) => {
    setSelectedKeys((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const selectedResources = useMemo(() => {
    return resources.filter((r) => selectedKeys.includes(r.key));
  }, [resources, selectedKeys]);

  const sortIndicator = (field: SortByField) => {
    if (sortBy !== field) return '↕';
    return sortOrder === 'asc' ? '↑' : '↓';
  };

  return (
    <div className="space-y-4" data-testid="storage-table-container">
      {/* Toolbar: filter chips, search & actions */}
      <ChunkyCard className="p-3 sm:p-4 flex flex-col gap-3">
        {/* Status Filter Chips */}
        <div className="flex items-center gap-2 flex-wrap">
          <ChunkyChip
            type="button"
            variant={statusFilter === 'all' ? 'active' : 'default'}
            pressed={statusFilter === 'all'}
            onClick={() => setStatusFilter('all')}
            data-testid="filter-tab-all"
          >
            All
          </ChunkyChip>
          <ChunkyChip
            type="button"
            variant={statusFilter === 'linked' ? 'active' : 'default'}
            pressed={statusFilter === 'linked'}
            onClick={() => setStatusFilter('linked')}
            data-testid="filter-tab-linked"
          >
            Linked
          </ChunkyChip>
          <ChunkyChip
            type="button"
            variant={statusFilter === 'orphaned' ? 'active' : 'default'}
            pressed={statusFilter === 'orphaned'}
            onClick={() => setStatusFilter('orphaned')}
            data-testid="filter-tab-orphaned"
          >
            Orphaned ({orphanedCount})
          </ChunkyChip>
        </div>

        {/* Search & Actions */}
        <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
          <div className="relative w-full sm:max-w-xs">
            <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-[var(--muted)] pointer-events-none" />
            <ChunkyInput
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search filename or series..."
              className="pl-10 font-mono"
              data-testid="storage-search-input"
            />
          </div>

          <div className="flex items-center gap-2 sm:ml-auto">
            <ChunkyButton
              variant="outline"
              size="sm"
              onClick={onRefreshScan}
              disabled={isRefreshing || isLoading}
              data-testid="refresh-scan-btn"
            >
              <RefreshCw
                className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`}
              />
              Refresh Scan
            </ChunkyButton>

            <ChunkyButton
              variant="gold"
              size="sm"
              onClick={onPurgeOrphans}
              disabled={isLoading || orphanedCount === 0}
              data-testid="purge-orphans-btn"
            >
              <Trash2 className="w-4 h-4" />
              Purge All Orphans
            </ChunkyButton>
          </div>
        </div>
      </ChunkyCard>

      {/* Sticky 3D batch selection toolbar */}
      {selectedKeys.length > 0 && (
        <ChunkyCard
          className="sticky top-2 z-10 px-4 py-3 flex items-center justify-between gap-2 border-[var(--green)] bg-[var(--green-soft)]"
          data-testid="batch-toolbar"
        >
          <span className="font-sans text-sm font-extrabold text-[var(--ink)]">
            {selectedKeys.length} file{selectedKeys.length > 1 ? 's' : ''}{' '}
            selected
          </span>
          <ChunkyButton
            variant="danger"
            size="sm"
            onClick={() => onDeleteBatch(selectedResources)}
            data-testid="delete-selected-btn"
          >
            <Trash2 className="w-4 h-4" />
            Delete Selected ({selectedKeys.length})
          </ChunkyButton>
        </ChunkyCard>
      )}

      {/* Grid Header Row */}
      <div className="hidden lg:grid gap-3.5 items-center px-4 pb-2 grid-cols-[36px_minmax(0,2fr)_minmax(0,1.4fr)_130px_170px_48px]">
        <span className="flex justify-center">
          <ChunkyCheckbox
            checked={isAllSelected}
            indeterminate={isSomeSelected}
            onCheckedChange={toggleSelectAll}
            aria-label="Select all files"
            data-testid="select-all-checkbox"
          />
        </span>
        <button
          type="button"
          onClick={() => handleSort('name')}
          data-testid="sort-header-name"
          className="flex items-center gap-1 font-sans text-xs font-extrabold uppercase tracking-wider text-[var(--muted)] hover:text-[var(--ink)] cursor-pointer text-left"
        >
          Filename / Key <span aria-hidden="true">{sortIndicator('name')}</span>
        </button>
        <span className="font-sans text-xs font-extrabold uppercase tracking-wider text-[var(--muted)]">
          Status
        </span>
        <button
          type="button"
          onClick={() => handleSort('size')}
          data-testid="sort-header-size"
          className="flex items-center gap-1 font-sans text-xs font-extrabold uppercase tracking-wider text-[var(--muted)] hover:text-[var(--ink)] cursor-pointer text-left"
        >
          Size <span aria-hidden="true">{sortIndicator('size')}</span>
        </button>
        <button
          type="button"
          onClick={() => handleSort('date')}
          data-testid="sort-header-date"
          className="flex items-center gap-1 font-sans text-xs font-extrabold uppercase tracking-wider text-[var(--muted)] hover:text-[var(--ink)] cursor-pointer text-left"
        >
          Modified <span aria-hidden="true">{sortIndicator('date')}</span>
        </button>
        <span className="font-sans text-xs font-extrabold uppercase tracking-wider text-[var(--muted)] text-right">
          Actions
        </span>
      </div>

      {/* Mobile select-all row */}
      <div className="flex lg:hidden items-center gap-2 px-1">
        <ChunkyCheckbox
          checked={isAllSelected}
          indeterminate={isSomeSelected}
          onCheckedChange={toggleSelectAll}
          aria-label="Select all files"
          data-testid="select-all-checkbox-mobile"
        />
        <button
          type="button"
          onClick={() => handleSort('name')}
          data-testid="sort-header-name-mobile"
          className="flex items-center gap-1 font-sans text-xs font-extrabold uppercase tracking-wider text-[var(--muted)] hover:text-[var(--ink)] cursor-pointer"
        >
          Sort by name <span aria-hidden="true">{sortIndicator('name')}</span>
        </button>
      </div>

      {/* Data Row Cards */}
      {isLoading ? (
        <ChunkyCardList data-testid="storage-loading-list">
          {[1, 2, 3].map((i) => (
            <ChunkySkeleton key={i} className="p-4">
              <div className="h-4 bg-[var(--border)] rounded-xl w-2/3 mb-2" />
              <div className="h-3 bg-[var(--border)] rounded-xl w-1/3" />
            </ChunkySkeleton>
          ))}
          <p className="text-center font-sans text-xs font-bold text-[var(--muted)]">
            Scanning S3 object bucket inventory...
          </p>
        </ChunkyCardList>
      ) : processedResources.length === 0 ? (
        <ChunkyCard
          className="p-8 text-center"
          data-testid="storage-empty-state"
        >
          <p className="font-display font-bold text-lg text-[var(--ink)]">
            No files found
          </p>
          <p className="font-sans text-sm font-semibold text-[var(--muted)] mt-1">
            No S3 storage resources found.
          </p>
        </ChunkyCard>
      ) : (
        <ChunkyCardList>
          {processedResources.map((resource) => {
            const isSelected = selectedKeys.includes(resource.key);
            const isVideo = /\.(mp4|mkv|webm|mov|avi)$/i.test(
              resource.filename
            );

            return (
              <ChunkyCard
                key={resource.key}
                selected={isSelected}
                className="p-3 items-center grid gap-3 grid-cols-[36px_minmax(0,1fr)_48px] lg:grid-cols-[36px_minmax(0,2fr)_minmax(0,1.4fr)_130px_170px_48px]"
                data-testid={`row-${resource.key}`}
              >
                {/* Row selection */}
                <span className="flex justify-center">
                  <ChunkyCheckbox
                    checked={isSelected}
                    onCheckedChange={() => toggleSelectRow(resource.key)}
                    aria-label={`Select ${resource.filename}`}
                    data-testid={`checkbox-${resource.key}`}
                  />
                </span>

                {/* Filename & S3 Key */}
                <div className="min-w-0">
                  <div
                    className="font-sans font-extrabold text-[15px] text-[var(--ink)] leading-snug truncate"
                    title={resource.filename}
                  >
                    {resource.filename}
                  </div>
                  <div
                    className="font-mono font-semibold text-[13px] text-[var(--muted)] truncate"
                    title={resource.key}
                  >
                    {resource.key}
                  </div>
                  {/* Stacked meta for compact viewports */}
                  <div className="lg:hidden mt-1 font-mono text-xs font-bold text-[var(--ink)]">
                    {formatBytes(resource.sizeBytes)}
                    <span className="text-[11px] font-semibold text-[var(--muted)]">
                      {' '}
                      (
                      {formatBytes(resource.sizeBytes, {
                        decimals: 2,
                        standard: 'decimal',
                      })}
                      )
                    </span>
                  </div>
                </div>

                {/* Association Status */}
                <div className="col-span-2 lg:col-span-1 min-w-0">
                  {resource.status === 'linked' && resource.episode ? (
                    <div className="space-y-1">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-xl border-2 border-[var(--green-dark)] bg-[var(--green-soft)] text-[11px] font-sans font-extrabold uppercase tracking-wider text-[var(--green)]">
                        <LinkIcon className="w-3 h-3" /> Linked
                      </span>
                      <div className="font-sans text-sm font-bold text-[var(--ink)] truncate">
                        <Link
                          to="/admin/videos/$seriesId"
                          params={{ seriesId: resource.episode.seriesId }}
                          className="hover:underline inline-flex items-center gap-1"
                        >
                          {resource.episode.seriesTitle}
                          <ExternalLink className="w-3 h-3 opacity-60" />
                        </Link>
                      </div>
                      <div className="font-mono text-[11px] font-semibold text-[var(--muted)]">
                        S{resource.episode.seasonNumber ?? 1}E
                        {resource.episode.episodeNumber ?? 1} —{' '}
                        {resource.episode.title}
                      </div>
                      {resource.videoSource && (
                        <div className="font-mono text-[10px] font-semibold text-[var(--muted)]">
                          [{resource.videoSource.label} •{' '}
                          {resource.videoSource.quality}]
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-xl border-2 border-[var(--gold-dark)] bg-[var(--gold)]/15 text-[11px] font-sans font-extrabold uppercase tracking-wider text-[var(--gold-dark)]">
                        <AlertTriangle className="w-3 h-3" /> Orphaned
                      </span>
                      <div className="font-sans text-[11px] font-semibold text-[var(--muted)] italic">
                        Unlinked S3 file
                      </div>
                    </div>
                  )}
                </div>

                {/* Formatted Size (dual display) */}
                <div className="hidden lg:block font-mono text-sm font-extrabold text-[var(--ink)]">
                  {formatBytes(resource.sizeBytes)}
                  <span className="text-[11px] font-semibold text-[var(--muted)] block">
                    {formatBytes(resource.sizeBytes, {
                      decimals: 2,
                      standard: 'decimal',
                    })}
                  </span>
                </div>

                {/* Last Modified Date */}
                <div className="hidden lg:block font-mono text-xs font-semibold text-[var(--muted)]">
                  {resource.lastModified
                    ? new Date(resource.lastModified).toLocaleDateString(
                        undefined,
                        {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        }
                      )
                    : '—'}
                </div>

                {/* Row Actions kebab */}
                <span className="flex justify-end">
                  <ChunkyActionMenu
                    triggerLabel={`Actions for ${resource.filename}`}
                    items={[
                      ...(isVideo
                        ? [
                            {
                              label: 'Preview',
                              onSelect: () => onPreview(resource),
                              icon: <Play className="w-4 h-4" />,
                            },
                          ]
                        : []),
                      ...(resource.status === 'linked' && resource.videoSource
                        ? [
                            {
                              label: 'Edit metadata',
                              onSelect: () => onEditSource(resource),
                              icon: <Edit2 className="w-4 h-4" />,
                            },
                          ]
                        : []),
                      ...(resource.status === 'orphaned'
                        ? [
                            {
                              label: 'Attach orphan',
                              onSelect: () => onAttachOrphan(resource),
                              icon: <LinkIcon className="w-4 h-4" />,
                            },
                          ]
                        : []),
                      {
                        label: 'Delete',
                        onSelect: () => onDeleteSingle(resource),
                        icon: <Trash2 className="w-4 h-4" />,
                        danger: true,
                      },
                    ]}
                  />
                </span>
              </ChunkyCard>
            );
          })}
        </ChunkyCardList>
      )}
    </div>
  );
}
