import { useState, useMemo } from 'react';
import { formatBytes, type StorageResource } from '../api';
import { ChunkyButton } from '@/components/ui/chunky-button';
import { ChunkyCheckbox } from '@/components/ui/chunky-checkbox';
import { ChunkyCard, ChunkyCardList } from '@/components/ui/chunky-card';
import { ChunkySkeleton } from '@/components/ui/chunky-skeleton';
import { ChunkyActionMenu } from '@/components/ui/chunky-action-menu';
import { ChunkyCopyButton } from '@/components/ui/chunky-copy-button';
import {
  Trash2,
  Play,
  Edit2,
  Link as LinkIcon,
  AlertTriangle,
  ExternalLink,
} from 'lucide-react';
import { Link } from '@tanstack/react-router';

export type SortByField = 'size' | 'date' | 'name' | 'episode';
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
  /** Suppresses the top action bar (purge orphans action). */
  hideToolbar?: boolean;
}

export function StorageResourceTable({
  resources,
  isLoading = false,
  onPreview,
  onEditSource,
  onAttachOrphan,
  onDeleteSingle,
  onDeleteBatch,
  onPurgeOrphans,
  orphanedCount = 0,
  hideToolbar = false,
}: StorageResourceTableProps) {
  // In series drill-down mode there is no toolbar to change the sort, so
  // resources default to chronological episode order (season, then episode).
  const [sortBy, setSortBy] = useState<SortByField>(
    hideToolbar ? 'episode' : 'size'
  );
  const [sortOrder, setSortOrder] = useState<SortOrder>(
    hideToolbar ? 'asc' : 'desc'
  );
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

  // Sorted resources (the orphaned tab is pre-scoped server-side, so no
  // client-side status or search filtering applies here)
  const processedResources = useMemo(() => {
    return resources
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
        } else if (sortBy === 'episode') {
          const seasonA = a.episode?.seasonNumber ?? Number.MAX_SAFE_INTEGER;
          const seasonB = b.episode?.seasonNumber ?? Number.MAX_SAFE_INTEGER;
          cmp = seasonA - seasonB;
          if (cmp === 0) {
            const epA = a.episode?.episodeNumber ?? Number.MAX_SAFE_INTEGER;
            const epB = b.episode?.episodeNumber ?? Number.MAX_SAFE_INTEGER;
            cmp = epA - epB;
          }
          if (cmp === 0) {
            cmp = a.filename.localeCompare(b.filename);
          }
        }
        return sortOrder === 'asc' ? cmp : -cmp;
      });
  }, [resources, sortBy, sortOrder]);

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
      {/* Top action bar: purge orphans only */}
      {!hideToolbar && (
      <div className="flex justify-end" data-testid="storage-toolbar">
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
      )}

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
                className={`p-3 items-center grid gap-3 grid-cols-[36px_minmax(0,1fr)_48px] lg:grid-cols-[36px_minmax(0,2fr)_minmax(0,1.4fr)_130px_170px_48px] bg-[var(--bg)] hover:-translate-y-0.5 active:translate-y-0 ${isSelected ? '' : 'hover:border-[#4b5d67]'}`}
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
                  <div className="flex items-center gap-1.5 min-w-0">
                    <div
                      className="font-sans font-extrabold text-[15px] text-[var(--ink)] leading-snug truncate"
                      title={resource.filename}
                    >
                      {resource.filename}
                    </div>
                    <ChunkyCopyButton
                      value={resource.filename}
                      copyLabel={`Copy filename ${resource.filename}`}
                      data-testid={`copy-filename-${resource.key}`}
                    />
                  </div>
                  <div className="flex items-center gap-1.5 min-w-0">
                    <div
                      className="font-mono font-semibold text-[13px] text-[var(--muted)] truncate"
                      title={resource.key}
                    >
                      {resource.key}
                    </div>
                    <ChunkyCopyButton
                      value={resource.key}
                      copyLabel={`Copy S3 key ${resource.key}`}
                      data-testid={`copy-key-${resource.key}`}
                    />
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
