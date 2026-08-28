import { useState } from 'react';
import { Play, Settings, Maximize, Volume2, ChevronDown } from 'lucide-react';

const MOCK_EPISODES = Array.from({ length: 12 }).map((_, i) => ({
  id: `ep-${i + 1}`,
  title: `The Truth of the World ${i + 1}`,
  number: i + 1,
  duration: '24m',
  thumbnail: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?q=80&w=400&auto=format&fit=crop',
}));

export function WatchOption1() {
  const [activeEp, setActiveEp] = useState(1);

  return (
    <div className="min-h-screen bg-zinc-950 text-white font-sans pb-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        
        {/* Video Player */}
        <div className="aspect-video bg-black border border-zinc-800 rounded-xl overflow-hidden relative shadow-2xl flex items-center justify-center group mb-8">
          <Play className="w-20 h-20 text-white/50 group-hover:text-white/90 transition-colors" />
          
          {/* Fake Player Controls */}
          <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/90 to-transparent flex items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity">
            <div className="flex items-center gap-4">
              <Play className="w-6 h-6" />
              <Volume2 className="w-5 h-5 text-zinc-300" />
              <div className="text-sm font-mono text-zinc-300">12:04 / 24:00</div>
            </div>
            <div className="flex items-center gap-4">
              <Settings className="w-5 h-5 text-zinc-300" />
              <Maximize className="w-5 h-5 text-zinc-300" />
            </div>
          </div>
        </div>

        {/* Info & Episodes Layout */}
        <div className="flex flex-col lg:flex-row gap-12">
          
          {/* Left: Metadata */}
          <div className="lg:w-2/3 space-y-6">
            <div>
              <h1 className="text-3xl font-bold mb-2">Attack on Titan</h1>
              <h2 className="text-xl text-zinc-400 font-medium font-mono">Episode {activeEp}: The Truth of the World</h2>
            </div>
            
            <div className="flex items-center gap-3 text-sm font-mono text-zinc-400">
              <span className="bg-zinc-800 text-zinc-200 px-2 py-1 rounded">TV-MA</span>
              <span className="bg-red-900/40 text-red-400 px-2 py-1 rounded border border-red-900/50">SUB | DUB</span>
              <span>2026</span>
              <span>MAPPA</span>
            </div>

            <p className="text-zinc-300 leading-relaxed text-lg">
              The survey corps embarks on their most dangerous mission yet. As secrets of the outside world are revealed, Eren must make a choice that will alter the fate of humanity forever. Will they uncover the secrets in the basement?
            </p>
          </div>

          {/* Right: Seasons & Episodes */}
          <div className="lg:w-1/3 border border-zinc-800 rounded-xl bg-zinc-900/50 overflow-hidden flex flex-col h-[600px]">
            {/* Season Dropdown */}
            <div className="p-4 border-b border-zinc-800 bg-zinc-900">
              <button className="w-full flex items-center justify-between text-lg font-semibold bg-zinc-800 px-4 py-3 rounded-md hover:bg-zinc-700 transition-colors cursor-pointer">
                <span>Season 4 (Final Season)</span>
                <ChevronDown className="w-5 h-5 text-zinc-400" />
              </button>
            </div>

            {/* Episode List */}
            <div className="overflow-y-auto flex-1 p-2 space-y-1 custom-scrollbar">
              {MOCK_EPISODES.map((ep) => (
                <button 
                  key={ep.id}
                  onClick={() => setActiveEp(ep.number)}
                  className={`w-full text-left flex gap-4 p-2 rounded-lg transition-colors cursor-pointer group ${
                    activeEp === ep.number ? 'bg-zinc-800' : 'hover:bg-zinc-800/60'
                  }`}
                >
                  <div className="relative w-32 aspect-video bg-zinc-800 rounded flex-shrink-0 overflow-hidden">
                    <img src={ep.thumbnail} alt={ep.title} className="object-cover w-full h-full opacity-70 group-hover:opacity-100 transition-opacity" />
                    {activeEp === ep.number && (
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                        <Play className="w-8 h-8 text-white fill-white" />
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col justify-center">
                    <span className={`text-sm font-semibold ${activeEp === ep.number ? 'text-red-400' : 'text-zinc-200'}`}>
                      {ep.number}. {ep.title}
                    </span>
                    <span className="text-xs text-zinc-500 font-mono mt-1">{ep.duration}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
