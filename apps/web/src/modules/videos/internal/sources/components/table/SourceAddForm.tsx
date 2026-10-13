import { useState } from 'react';
import { toast } from 'sonner';
import { X } from 'lucide-react';
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
  type SourceAddFormProps,
  type SourceType,
} from '../../types';

export function SourceAddForm({ isPending, onCancel, onSave }: SourceAddFormProps) {
  const [type, setType] = useState<SourceType>('direct');
  const [label, setLabel] = useState('');
  const [url, setUrl] = useState('');
  const [quality, setQuality] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
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
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-extrabold text-[var(--ink)]">New Video Source</span>
          <ChunkyButton
            type="button"
            variant="outline"
            size="sm"
            onClick={onCancel}
            aria-label="Close add source form"
          >
            <X aria-hidden="true" />
          </ChunkyButton>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1.5">
            <label htmlFor="add-source-type" className="text-xs font-extrabold text-[var(--ink)]">
              Type
            </label>
            <ChunkySelect value={type} onValueChange={(val) => setType(val as SourceType)}>
              <ChunkySelectTrigger id="add-source-type" aria-label="Type">
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
            <label htmlFor="add-source-label" className="text-xs font-extrabold text-[var(--ink)]">
              Label
            </label>
            <ChunkyInput
              id="add-source-label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. Server 1 or 1080p Stream"
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div className="col-span-2 space-y-1.5">
            <label htmlFor="add-source-url" className="text-xs font-extrabold text-[var(--ink)]">
              URL / Embed / Key
            </label>
            <ChunkyInput
              id="add-source-url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://... or S3 key"
              required
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="add-source-quality" className="text-xs font-extrabold text-[var(--ink)]">
              Quality
            </label>
            <ChunkyInput
              id="add-source-quality"
              value={quality}
              onChange={(e) => setQuality(e.target.value)}
              placeholder="1080p, 720p"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-1">
          <ChunkyButton type="button" variant="outline" size="sm" onClick={onCancel}>
            Cancel
          </ChunkyButton>
          <ChunkyButton type="submit" size="sm" disabled={isPending}>
            {isPending ? 'Saving...' : 'Add Source'}
          </ChunkyButton>
        </div>
      </form>
    </ChunkyCard>
  );
}
