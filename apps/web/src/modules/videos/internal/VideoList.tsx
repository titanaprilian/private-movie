import { useState } from 'react';
import { useSuspenseQuery } from '@tanstack/react-query';
import { episodesQueryOptions } from './api';

export function VideoList() {
  const { data } = useSuspenseQuery(episodesQueryOptions());
  const [filterText, setFilterText] = useState('');

  const episodes = data?.episodes ?? [];

  const filteredEpisodes = episodes.filter((video) => {
    const text = filterText.toLowerCase();
    return (
      video.title.toLowerCase().includes(text) ||
      video.source.toLowerCase().includes(text)
    );
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold">Videos</h1>
          <p className="text-xs text-muted">
            Manage and browse your video library.
          </p>
        </div>
        <button
          type="button"
          className="px-3 py-1.5 rounded bg-primary text-primary-fg text-xs font-medium cursor-pointer hover:opacity-90 transition-opacity"
        >
          Add Video
        </button>
      </div>

      <div className="bg-card border border-c rounded">
        <div className="px-4 py-3 border-b border-c flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-1">
            <input
              type="text"
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              placeholder="Filter videos..."
              className="w-full max-w-xs px-3 py-1.5 rounded border border-c bg-transparent text-sm"
            />
          </div>
          <span className="text-xs text-muted">
            {episodes.length} total
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-muted border-b border-c text-xs">
                <th className="px-4 py-2 font-medium w-16">Thumb</th>
                <th className="px-4 py-2 font-medium">Title ↕</th>
                <th className="px-4 py-2 font-medium">Source ↕</th>
                <th className="px-4 py-2 font-medium">Date ↕</th>
                <th className="px-4 py-2 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredEpisodes.map((video, index) => {
                const isLast = index === filteredEpisodes.length - 1;
                const formattedDate = video.createdAt
                  ? typeof video.createdAt === 'string'
                    ? video.createdAt.split('T')[0]
                    : new Date(video.createdAt).toISOString().split('T')[0]
                  : '';
                return (
                  <tr
                    key={video.id}
                    className={`${isLast ? '' : 'border-b border-c'} hover-bg`}
                  >
                    <td className="px-4 py-2">
                      <div
                        className="w-10 h-10 rounded border border-c bg-muted/20 flex items-center justify-center text-xs font-mono"
                        aria-label={`${video.title} thumbnail`}
                      >
                        {video.title.charAt(0).toUpperCase()}
                      </div>
                    </td>
                    <td className="px-4 py-2 font-medium">{video.title}</td>
                    <td className="px-4 py-2 text-muted mono">
                      {video.source}
                    </td>
                    <td className="px-4 py-2 text-muted mono">{formattedDate}</td>
                    <td className="px-4 py-2">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          className="px-2 py-1 rounded border border-c text-xs hover-bg cursor-pointer"
                        >
                          Play
                        </button>
                        <button
                          type="button"
                          className="px-2 py-1 rounded border border-c text-xs hover-bg cursor-pointer"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="px-2 py-1 rounded border border-c text-xs hover-bg cursor-pointer text-red-500"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-2.5 border-t border-c flex items-center justify-between text-xs text-muted">
          <span>Page 1 of 1</span>
          <div className="flex gap-2">
            <button
              type="button"
              className="px-2.5 py-1 rounded border border-c hover-bg cursor-pointer"
            >
              Previous
            </button>
            <button
              type="button"
              className="px-2.5 py-1 rounded border border-c hover-bg cursor-pointer"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
