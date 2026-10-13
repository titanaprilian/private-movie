import { useState } from 'react';
import { toast } from 'sonner';
import { ChunkyButton } from '@/components/ui/chunky-button';
import { ChunkyCard } from '@/components/ui/chunky-card';
import { ChunkyInput } from '@/components/ui/chunky-input';
import {
  ChunkySelect,
  ChunkySelectContent,
  ChunkySelectItem,
  ChunkySelectTrigger,
  ChunkySelectValue,
} from '@/components/ui/chunky-select';
import {
  SOURCE_TYPES,
  type SourceInlineEditFormProps,
  type SourceType,
} from '../types';

export function SourceInlineEditForm({
  source,
  isPending,
  onCancel,
  onSave,
}: SourceInlineEditFormProps) {
  const [label, setLabel] = useState(source.label);
  const [url, setUrl] = useState(source.url);
  const [type, setType] = useState<SourceType>(source.type);
  const [quality, setQuality] = useState(source.quality ?? '');

  const handleSave = () => {
    if (!url.trim() || !label.trim()) {
      toast.error('Label and URL are required');
      return;
    }
    onSave({
      label: label.trim(),
      url: url.trim(),
      type,
      quality: quality.trim() || null,
    });
  };

  return (
    <ChunkyCard className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-extrabold text-[var(--ink)]">Edit Source</span>
        <span className="font-mono text-[10px] font-bold text-[var(--muted)]">{source.id}</span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1.5">
          <label
            htmlFor={`edit-source-type-${source.id}`}
            className="text-xs font-extrabold text-[var(--ink)]"
          >
            Type
          </label>
          <ChunkySelect value={type} onValueChange={(val) => setType(val as SourceType)}>
            <ChunkySelectTrigger id={`edit-source-type-${source.id}`} aria-label="Type">
              <ChunkySelectValue placeholder="Select type" />
            </ChunkySelectTrigger>
            <ChunkySelectContent>
              {SOURCE_TYPES.map((t) => (
                <ChunkySelectItem key={t.value} value={t.value}>
                  {t.label}
                </ChunkySelectItem>
              ))}
            </ChunkySelectContent>
          </ChunkySelect>
        </div>

        <div className="space-y-1.5">
          <label
            htmlFor={`edit-source-label-${source.id}`}
            className="text-xs font-extrabold text-[var(--ink)]"
          >
            Label
          </label>
          <ChunkyInput
            id={`edit-source-label-${source.id}`}
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            required
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="col-span-2 space-y-1.5">
          <label
            htmlFor={`edit-source-url-${source.id}`}
            className="text-xs font-extrabold text-[var(--ink)]"
          >
            URL
          </label>
          <ChunkyInput
            id={`edit-source-url-${source.id}`}
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            required
          />
        </div>

        <div className="space-y-1.5">
          <label
            htmlFor={`edit-source-quality-${source.id}`}
            className="text-xs font-extrabold text-[var(--ink)]"
          >
            Quality
          </label>
          <ChunkyInput
            id={`edit-source-quality-${source.id}`}
            value={quality}
            onChange={(e) => setQuality(e.target.value)}
            placeholder="e.g. 1080p"
          />
        </div>
      </div>

      <div className="flex items-center justify-end gap-2 pt-1">
        <ChunkyButton type="button" variant="outline" size="sm" onClick={onCancel}>
          Cancel
        </ChunkyButton>
        <ChunkyButton type="button" size="sm" onClick={handleSave} disabled={isPending}>
          {isPending ? 'Saving...' : 'Save'}
        </ChunkyButton>
      </div>
    </ChunkyCard>
  );
}
