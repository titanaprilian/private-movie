import { useState } from 'react';
import { dummyVideos } from './types';
import { VideoCard } from './VideoCard';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export function VideoGrid() {
  const [sourceFilter, setSourceFilter] = useState('all');

  return (
    <>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-lg font-semibold">Videos</h1>
          <p className="text-xs text-muted">
            Browse and manage your video collection.
          </p>
        </div>
        <button
          type="button"
          className="px-3 py-1.5 rounded bg-primary text-primary-fg text-xs font-medium cursor-pointer hover:opacity-90 transition-opacity"
        >
          + Add Video
        </button>
      </div>

      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <div className="relative max-w-xs w-full">
          <input
            placeholder="Search videos…"
            className="w-full pl-3 pr-3 py-1.5 rounded border border-c bg-transparent text-xs mono focus:outline-none focus:border-primary"
          />
        </div>
        <div className="w-40">
          <Select
            value={sourceFilter}
            onValueChange={setSourceFilter}
          >
            <SelectTrigger
              aria-label="Filter by source"
              className="h-[34px] px-3 py-1.5 text-xs mono bg-transparent"
            >
              <SelectValue placeholder="All sources" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs mono">
                All sources
              </SelectItem>
              <SelectItem value="otakudesu" className="text-xs mono">
                otakudesu
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {dummyVideos.map((video) => (
          <VideoCard key={video.id} video={video} />
        ))}
      </div>
    </>
  );
}
