import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { WatchOption1, WatchOption2, WatchOption3 } from '@/modules/watch';

export const Route = createFileRoute('/watch-demo')({
  component: WatchDemoPage,
});

export function WatchDemoPage() {
  const [activeUi, setActiveUi] = useState<'theater' | 'split' | 'hero'>('theater');

  return (
    <div className="relative min-h-screen">
      {/* UI Switcher Overlay (for development/reference) */}
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[100] bg-card border border-c p-2 rounded shadow-2xl flex gap-2">
        <span className="flex items-center text-xs text-muted mr-2 uppercase tracking-tight mono">Details UI:</span>
        <button 
          onClick={() => setActiveUi('theater')}
          className={`px-3 py-1.5 text-xs font-medium rounded ${activeUi === 'theater' ? 'bg-primary text-primary-fg' : 'hover-bg'}`}
        >
          1. Theater Mode
        </button>
        <button 
          onClick={() => setActiveUi('split')}
          className={`px-3 py-1.5 text-xs font-medium rounded ${activeUi === 'split' ? 'bg-primary text-primary-fg' : 'hover-bg'}`}
        >
          2. Split/Playlist
        </button>
        <button 
          onClick={() => setActiveUi('hero')}
          className={`px-3 py-1.5 text-xs font-medium rounded ${activeUi === 'hero' ? 'bg-primary text-primary-fg' : 'hover-bg'}`}
        >
          3. Hero Focus
        </button>
      </div>

      {/* Render the selected UI */}
      {activeUi === 'theater' && <WatchOption1 />}
      {activeUi === 'split' && <WatchOption2 />}
      {activeUi === 'hero' && <WatchOption3 />}
    </div>
  );
}
