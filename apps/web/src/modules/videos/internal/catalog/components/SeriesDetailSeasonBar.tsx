import { toast } from 'sonner';
import {
  Edit2,
  RefreshCw,
  Plus,
  Trash2,
  Copy,
} from 'lucide-react';
import { Droppable } from '@hello-pangea/dnd';
import type { SeriesDetails, SeasonDetails } from '../../api';
import { getSeasonNumber } from '../../seasons/seasonUtils';
import { ChunkyButton } from '@/components/ui/chunky-button';
import { ChunkyChip } from '@/components/ui/chunky-chip';
import { ChunkyActionMenu } from '@/components/ui/chunky-action-menu';

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

export function SeriesDetailSeasonBar({
  seasons,
  activeSeason,
  selectedSeasonId,
  onSelectSeason,
  onAddSeason,
  isScrapePending,
  onRunAutoScrape,
  onEditSeason,
  onDeleteSeason,
}: SeriesDetailSeasonBarProps) {
  return (
    <div className="season-bar">
      <span className="lbl">SEASON:</span>
      <div className="flex flex-wrap items-center gap-2 flex-1 min-w-0">
        {seasons && seasons.length > 0 ? (
          seasons.map((season, index) => {
            const isActive = season.id === (activeSeason?.id ?? selectedSeasonId);
            const title = season.title || `Season ${getSeasonNumber(season, index)}`;
            return (
              <Droppable
                key={season.id}
                droppableId={`season-tab-${season.id}`}
              >
                {(tabProvided, tabSnapshot) => (
                  <div
                    ref={tabProvided.innerRef}
                    {...tabProvided.droppableProps}
                    className={
                      tabSnapshot.isDraggingOver
                        ? 'ring-2 ring-[var(--green)] rounded-[14px]'
                        : undefined
                    }
                  >
                    <ChunkyChip
                      variant={isActive ? 'active' : 'default'}
                      pressed={isActive}
                      onClick={() => onSelectSeason(season.id)}
                      type="button"
                    >
                      {title}
                    </ChunkyChip>
                  </div>
                )}
              </Droppable>
            );
          })
        ) : (
          <span className="text-sm font-semibold text-[var(--muted)]">
            No seasons yet
          </span>
        )}
        <ChunkyButton
          type="button"
          variant="outline"
          size="sm"
          onClick={onAddSeason}
          aria-label="Add season"
          title="Add season"
        >
          <Plus className="size-4" aria-hidden="true" />
        </ChunkyButton>
      </div>

      {activeSeason && (
        <div className="ml-auto flex-none">
          <ChunkyActionMenu
            triggerLabel="Season actions"
            align="end"
            items={[
              ...(activeSeason.status === 'ongoing' && activeSeason.scraperUrl
                ? [
                    {
                      label: isScrapePending
                        ? 'Scraping...'
                        : 'Run Auto-Scrape Now',
                      icon: (
                        <RefreshCw
                          className={`size-4 ${
                            isScrapePending ? 'animate-spin' : ''
                          }`}
                        />
                      ),
                      disabled: isScrapePending,
                      onSelect: () => {
                        onRunAutoScrape(activeSeason.id);
                      },
                    },
                  ]
                : []),
              {
                label: 'Edit Season',
                icon: <Edit2 className="size-4" />,
                onSelect: onEditSeason,
              },
              {
                label: 'Copy Season ID',
                icon: <Copy className="size-4" />,
                onSelect: () => {
                  if (activeSeason) {
                    if (navigator.clipboard?.writeText) {
                      navigator.clipboard.writeText(activeSeason.id);
                    }
                    toast.success('Season ID copied to clipboard');
                  }
                },
              },
              {
                label: 'Delete Season',
                icon: <Trash2 className="size-4" />,
                danger: true,
                disabled: (seasons?.length ?? 0) <= 1,
                onSelect: () => {
                  if (seasons && seasons.length <= 1) return;
                  onDeleteSeason();
                },
              },
            ]}
          />
        </div>
      )}
    </div>
  );
}
