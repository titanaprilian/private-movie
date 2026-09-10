import { useState, useMemo } from 'react';
import { formatBytes, type StorageResource } from './api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Search,
  RefreshCw,
  Trash2,
  Play,
  Edit2,
  Link as LinkIcon,
  AlertTriangle,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
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
        if (statusFilter === 'orphaned' && r.status !== 'orphaned') return false;

        // Search filter (filename, S3 key, or series title)
        if (search.trim()) {
          const query = search.toLowerCase();
          const matchesFilename = r.filename.toLowerCase().includes(query);
          const matchesKey = r.key.toLowerCase().includes(query);
          const matchesSeries = r.episode?.seriesTitle?.toLowerCase().includes(query);
          const matchesEpisode = r.episode?.title?.toLowerCase().includes(query);
          if (!matchesFilename && !matchesKey && !matchesSeries && !matchesEpisode) {
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
  const isSomeSelected =
    selectedKeys.length > 0 && !isAllSelected;

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

  const RenderSortIcon = ({ field }: { field: SortByField }) => {
    if (sortBy !== field) return <ArrowUpDown className="w-3 h-3 ml-1 text-muted inline opacity-60" />;
    return sortOrder === 'asc' ? (
      <ArrowUp className="w-3 h-3 ml-1 text-primary inline" />
    ) : (
      <ArrowDown className="w-3 h-3 ml-1 text-primary inline" />
    );
  };

  return (
    <div className="bg-card border border-c rounded space-y-0 overflow-hidden" data-testid="storage-table-container">
      {/* Header Controls Bar */}
      <div className="p-3 sm:p-4 border-b border-c flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1 bg-sidebar border border-c p-1 rounded">
          <button
            type="button"
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
              statusFilter === 'all'
                ? 'bg-card text-primary font-semibold border border-c'
                : 'text-muted hover:text-fg'
            }`}
            data-testid="filter-tab-all"
          >
            All
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('linked')}
            className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
              statusFilter === 'linked'
                ? 'bg-card text-primary font-semibold border border-c'
                : 'text-muted hover:text-fg'
            }`}
            data-testid="filter-tab-linked"
          >
            Linked
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('orphaned')}
            className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
              statusFilter === 'orphaned'
                ? 'bg-card text-primary font-semibold border border-c'
                : 'text-muted hover:text-fg'
            }`}
            data-testid="filter-tab-orphaned"
          >
            Orphaned ({orphanedCount})
          </button>
        </div>

        {/* Search & Actions */}
        <div className="flex items-center gap-2 flex-1 sm:max-w-xs">
          <div className="relative w-full">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-muted" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search filename or series..."
              className="pl-8 text-xs h-8 mono bg-transparent"
              data-testid="storage-search-input"
            />
          </div>
        </div>

        <div className="flex items-center gap-2 justify-end">
          {/* Refresh Scan Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={onRefreshScan}
            disabled={isRefreshing || isLoading}
            className="text-xs h-8 gap-1.5"
            data-testid="refresh-scan-btn"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh Scan
          </Button>

          {/* Purge All Orphans Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={onPurgeOrphans}
            disabled={isLoading || orphanedCount === 0}
            className="text-xs h-8 gap-1.5 text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-800 hover:bg-amber-50 dark:hover:bg-amber-950/30"
            data-testid="purge-orphans-btn"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Purge All Orphans
          </Button>
        </div>
      </div>

      {/* Selection Batch Toolbar */}
      {selectedKeys.length > 0 && (
        <div
          className="bg-primary/10 border-b border-primary/20 px-4 py-2 flex items-center justify-between text-xs"
          data-testid="batch-toolbar"
        >
          <span className="mono font-medium text-fg">
            {selectedKeys.length} file{selectedKeys.length > 1 ? 's' : ''} selected
          </span>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => onDeleteBatch(selectedResources)}
            className="text-xs h-7 gap-1.5"
            data-testid="delete-selected-btn"
          >
            <Trash2 className="w-3 h-3" />
            Delete Selected ({selectedKeys.length})
          </Button>
        </div>
      )}

      {/* Data Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm border-collapse">
          <thead>
            <tr className="border-b border-c bg-sidebar text-muted text-xs uppercase tracking-wide mono">
              <th className="p-3 w-10 text-center">
                <Checkbox
                  checked={isAllSelected || isSomeSelected}
                  onCheckedChange={toggleSelectAll}
                  aria-label="Select all files"
                  data-testid="select-all-checkbox"
                />
              </th>
              <th
                onClick={() => handleSort('name')}
                className="p-3 cursor-pointer hover:text-fg select-none"
                data-testid="sort-header-name"
              >
                Filename / Key <RenderSortIcon field="name" />
              </th>
              <th className="p-3">Association Status</th>
              <th
                onClick={() => handleSort('size')}
                className="p-3 cursor-pointer hover:text-fg select-none"
                data-testid="sort-header-size"
              >
                Size <RenderSortIcon field="size" />
              </th>
              <th
                onClick={() => handleSort('date')}
                className="p-3 cursor-pointer hover:text-fg select-none"
                data-testid="sort-header-date"
              >
                Last Modified <RenderSortIcon field="date" />
              </th>
              <th className="p-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {isLoading ? (
              <tr>
                <td colSpan={6} className="p-8 text-center text-xs text-muted mono animate-pulse">
                  Scanning S3 object bucket inventory...
                </td>
              </tr>
            ) : processedResources.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-8 text-center text-xs text-muted mono">
                  No S3 storage resources found.
                </td>
              </tr>
            ) : (
              processedResources.map((resource) => {
                const isSelected = selectedKeys.includes(resource.key);
                const isVideo = /\.(mp4|mkv|webm|mov|avi)$/i.test(resource.filename);

                return (
                  <tr
                    key={resource.key}
                    className={`hover-bg transition-colors ${
                      isSelected ? 'bg-primary/5' : ''
                    }`}
                    data-testid={`row-${resource.key}`}
                  >
                    {/* Checkbox */}
                    <td className="p-3 text-center">
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleSelectRow(resource.key)}
                        aria-label={`Select ${resource.filename}`}
                        data-testid={`checkbox-${resource.key}`}
                      />
                    </td>

                    {/* Filename & S3 Key */}
                    <td className="p-3 max-w-xs">
                      <div className="font-medium text-xs text-fg truncate" title={resource.filename}>
                        {resource.filename}
                      </div>
                      <div className="text-[11px] mono text-muted truncate mt-0.5" title={resource.key}>
                        {resource.key}
                      </div>
                    </td>

                    {/* Association Status */}
                    <td className="p-3">
                      {resource.status === 'linked' && resource.episode ? (
                        <div className="space-y-1">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                            <LinkIcon className="w-3 h-3" /> Linked
                          </span>
                          <div className="text-xs text-fg">
                            <Link
                              to="/admin/videos/$seriesId"
                              params={{ seriesId: resource.episode.seriesId }}
                              className="font-medium hover:underline inline-flex items-center gap-1"
                            >
                              {resource.episode.seriesTitle}
                              <ExternalLink className="w-2.5 h-2.5 opacity-60" />
                            </Link>
                          </div>
                          <div className="text-[11px] mono text-muted">
                            S{resource.episode.seasonNumber ?? 1}E{resource.episode.episodeNumber ?? 1} — {resource.episode.title}
                          </div>
                          {resource.videoSource && (
                            <div className="text-[10px] mono text-muted">
                              [{resource.videoSource.label} • {resource.videoSource.quality}]
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="space-y-1">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                            <AlertTriangle className="w-3 h-3" /> Orphaned
                          </span>
                          <div className="text-[11px] text-muted italic">
                            Unlinked S3 file
                          </div>
                        </div>
                      )}
                    </td>

                    {/* Formatted Size */}
                    <td className="p-3 mono text-xs text-fg font-medium">
                      {formatBytes(resource.sizeBytes)}
                    </td>

                    {/* Last Modified Date */}
                    <td className="p-3 mono text-xs text-muted">
                      {resource.lastModified
                        ? new Date(resource.lastModified).toLocaleDateString(undefined, {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : '—'}
                    </td>

                    {/* Actions */}
                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {/* Video Preview Button */}
                        {isVideo && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onPreview(resource)}
                            title="Preview video playback"
                            className="h-7 w-7 p-0"
                            data-testid={`preview-btn-${resource.key}`}
                          >
                            <Play className="w-3.5 h-3.5" />
                          </Button>
                        )}

                        {/* Edit metadata (Linked) */}
                        {resource.status === 'linked' && resource.videoSource && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onEditSource(resource)}
                            title="Edit label & quality"
                            className="h-7 w-7 p-0"
                            data-testid={`edit-btn-${resource.key}`}
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </Button>
                        )}

                        {/* Attach orphan (Orphaned) */}
                        {resource.status === 'orphaned' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onAttachOrphan(resource)}
                            title="Attach to episode"
                            className="h-7 px-2 text-xs gap-1 text-primary border-primary/30"
                            data-testid={`attach-btn-${resource.key}`}
                          >
                            <LinkIcon className="w-3 h-3" /> Attach
                          </Button>
                        )}

                        {/* Delete Single File */}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onDeleteSingle(resource)}
                          title="Delete S3 file"
                          className="h-7 w-7 p-0 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 border-c"
                          data-testid={`delete-btn-${resource.key}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
