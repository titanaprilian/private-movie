import {
  ChunkyTabs,
  ChunkyTabsList,
  ChunkyTabsTrigger,
  ChunkyTabsContent,
} from '@/components/ui/chunky-tabs';
import type { IngestTab } from '../../hooks/useBulkIngestModal';

export interface BulkIngestTabsProps {
  activeTab: IngestTab;
  onTabChange: (tab: IngestTab) => void;
}

export function BulkIngestTabs({ activeTab, onTabChange }: BulkIngestTabsProps) {
  return (
    <div className="px-6 pt-2 pb-0">
      <ChunkyTabs value={activeTab} onValueChange={(v) => onTabChange(v as IngestTab)}>
        <ChunkyTabsList>
          <ChunkyTabsTrigger value="archive" data-testid="tab-archive">
            ZIP / RAR Archive
          </ChunkyTabsTrigger>
          <ChunkyTabsTrigger value="url" data-testid="tab-url">
            Multi-line Video URLs
          </ChunkyTabsTrigger>
        </ChunkyTabsList>
        <ChunkyTabsContent value="archive" />
        <ChunkyTabsContent value="url" />
      </ChunkyTabs>
    </div>
  );
}
