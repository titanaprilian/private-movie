import { useState } from 'react';
import { Play, Download, ChevronDown, ListFilter } from 'lucide-react';

const MOCK_EPISODES = Array.from({ length: 8 }).map((_, i) => ({
  id: `ep-${i + 1}`,
  number: i + 1,
  title: `Re:Zero Starting Life in Another World - Prologue ${i + 1}`,
  date: 'Oct 12, 2026',
  status: i === 0 ? 'Watching' : 'Unwatched',
}));

export function WatchOption3() {
  const [activeEp, setActiveEp] = useState(1);

  return (
    <div className="min-h-screen bg-bg text-fg font-sans relative overflow-x-hidden">
      
      {/* Immersive Blurred Background */}
      <div 
        className="absolute top-0 left-0 w-full h-[70vh] bg-cover bg-top opacity-30 mix-blend-screen pointer-events-none"
        style={{ backgroundImage: `url('https://images.unsplash.com/photo-1555680202-c86f0e12f086?q=80&w=2560&auto=format&fit=crop')` }}
      />
      <div className="absolute top-0 left-0 w-full h-[70vh] bg-gradient-to-b from-bg/40 via-bg/80 to-bg z-0 pointer-events-none" />

      <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 pb-20">
        
        {/* Header Metadata Above Player */}
        <div className="mb-6 text-center shadow-sm">
          <div className="inline-block border border-primary/20 bg-primary/10 text-primary px-3 py-1 rounded-full text-xs font-mono font-medium tracking-wide mb-4">
            SIMULCAST • NEW EPISODE TODAY
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-3">Re:Zero Season 3</h1>
          <p className="text-muted text-sm max-w-2xl mx-auto line-clamp-2">
            Natsuki Subaru's return by death continues to plague him as he faces the Sin Archbishops of the Witch's Cult. In the Watergate City of Priestella, a new nightmare begins.
          </p>
        </div>

        {/* Cinematography Player (Ultra Wide) */}
        <div className="w-full aspect-[21/9] bg-black rounded-2xl border border-c shadow-2xl shadow-indigo-500/10 overflow-hidden relative group mb-10 flex items-center justify-center cursor-pointer">
          <img 
            src="https://images.unsplash.com/photo-1555680202-c86f0e12f086?q=80&w=2560&auto=format&fit=crop" 
            alt="Video frame" 
            className="absolute inset-0 w-full h-full object-cover opacity-60 group-hover:opacity-40 transition-opacity"
          />
          <div className="absolute inset-0 bg-black/20" />
          
          <div className="z-10 bg-white/10 backdrop-blur-md border border-white/20 p-5 rounded-full flex items-center justify-center transform group-hover:scale-110 transition-all duration-300">
            <Play className="w-10 h-10 ml-2 text-white fill-white shadow-sm" />
          </div>
        </div>

        {/* Console-Style Episode Tracker / Selection */}
        <div className="bg-card border border-c rounded-xl shadow-sm overflow-hidden">
          
          {/* Tracker Toolbar */}
          <div className="p-4 border-b border-c flex flex-col md:flex-row items-center justify-between gap-4 bg-sidebar">
            <div className="flex items-center gap-4 w-full md:w-auto">
              <span className="text-sm font-semibold">Episodes</span>
              <div className="relative inline-block w-full md:w-64">
                <select className="w-full appearance-none bg-card border border-c rounded-lg py-2 pl-3 pr-10 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary">
                  <option>Season 3 (Priestella Arc)</option>
                  <option>Season 2</option>
                  <option>Season 1</option>
                </select>
                <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none text-muted">
                  <ChevronDown className="w-4 h-4" />
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <button className="p-2 border border-c rounded shadow-sm hover:bg-hover transition bg-card text-muted" aria-label="Filter episodes">
                <ListFilter className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Data Table Episodes */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-bg/50">
                <tr>
                  <th className="px-6 py-3 text-[10px] font-mono text-muted uppercase tracking-wider border-b border-c w-16">No.</th>
                  <th className="px-6 py-3 text-[10px] font-mono text-muted uppercase tracking-wider border-b border-c">Title</th>
                  <th className="px-6 py-3 text-[10px] font-mono text-muted uppercase tracking-wider border-b border-c hidden md:table-cell">Aired</th>
                  <th className="px-6 py-3 text-[10px] font-mono text-muted uppercase tracking-wider border-b border-c hidden sm:table-cell">Status</th>
                  <th className="px-6 py-3 text-[10px] font-mono text-muted uppercase tracking-wider border-b border-c text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-c">
                {MOCK_EPISODES.map((ep) => (
                  <tr 
                    key={ep.id} 
                    onClick={() => setActiveEp(ep.number)}
                    className={`transition-colors cursor-pointer ${
                      activeEp === ep.number ? 'bg-active border-l-4 border-l-primary/0' : 'hover:bg-hover'
                    }`}
                    style={{ borderLeftWidth: activeEp === ep.number ? '3px' : '0px', borderLeftColor: activeEp === ep.number ? 'var(--primary)' : 'transparent' }}
                  >
                    <td className="px-6 py-4 font-mono text-xs text-muted">{String(ep.number).padStart(2, '0')}</td>
                    <td className="px-6 py-4 font-medium flex items-center gap-3">
                      {activeEp === ep.number && <Play className="w-4 h-4 text-primary fill-primary" />}
                      <span className={activeEp === ep.number ? 'text-primary' : 'text-fg'}>{ep.title}</span>
                    </td>
                    <td className="px-6 py-4 text-muted hidden md:table-cell">{ep.date}</td>
                    <td className="px-6 py-4 hidden sm:table-cell">
                      {activeEp === ep.number ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono bg-primary/10 text-primary">Playing</span>
                      ) : ep.status === 'Unwatched' ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">Unwatched</span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono border border-c text-muted">Watched</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right flex justify-end gap-2">
                       <button className="text-muted hover:text-fg p-1 transition" title="Download">
                         <Download className="w-4 h-4" />
                       </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

        </div>
      </div>
    </div>
  );
}
