import { useState } from 'react';
import { Play, SkipForward, Maximize, Volume2, ListVideo, Info, ChevronDown } from 'lucide-react';

const MOCK_EPISODES = Array.from({ length: 24 }).map((_, i) => ({
  id: `ep-${i + 1}`,
  number: i + 1,
  title: `The Journey Begins Part ${i + 1}`,
  description: 'Our heroes face an unexpected challenge while crossing the great divide.',
  thumbnail: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?q=80&w=400&auto=format&fit=crop',
}));

export function WatchOption2() {
  const [activeEp, setActiveEp] = useState(1);
  const [showInfo, setShowInfo] = useState(false);

  return (
    <div className="h-screen bg-black text-white flex flex-col md:flex-row overflow-hidden font-sans">
      
      {/* Main Video Area (Left) */}
      <div className="flex-1 flex flex-col relative h-full">
        {/* Video Player */}
        <div className="flex-1 bg-zinc-950 flex items-center justify-center relative group">
          <img 
            src="https://images.unsplash.com/photo-1542751371-adc38448a05e?q=80&w=1920&auto=format&fit=crop" 
            alt="Video frame" 
            className="absolute inset-0 w-full h-full object-contain opacity-50"
          />
          
          <div className="z-10 w-24 h-24 rounded-full bg-red-600/90 text-white flex items-center justify-center cursor-pointer hover:scale-110 transition-transform shadow-2xl shadow-red-900/50">
            <Play className="w-10 h-10 ml-2 fill-white" />
          </div>

          {/* Top Bar inside Player */}
          <div className="absolute top-0 left-0 right-0 p-6 bg-gradient-to-b from-black/80 to-transparent z-10 flex justify-between items-start opacity-0 group-hover:opacity-100 transition-opacity">
            <div>
              <div className="text-zinc-400 font-mono text-sm mb-1">Jujutsu Kaisen</div>
              <h2 className="text-xl font-bold">E{activeEp} - {MOCK_EPISODES[0].title}</h2>
            </div>
            <button onClick={() => setShowInfo(!showInfo)} className="bg-zinc-800/80 p-2 rounded-full hover:bg-zinc-700 transition">
              <Info className="w-5 h-5 text-white" />
            </button>
          </div>
          
          {/* Bottom Bar inside Player */}
          <div className="absolute bottom-0 left-0 right-0 px-6 py-4 bg-gradient-to-t from-black via-black/80 to-transparent z-10 opacity-0 group-hover:opacity-100 transition-opacity">
            <div className="w-full h-1 bg-zinc-800 rounded-full mb-4 overflow-hidden">
              <div className="h-full bg-red-600 w-1/3 relative">
                <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full" />
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-6">
                <Play className="w-6 h-6 cursor-pointer hover:text-red-500 transition" />
                <SkipForward className="w-6 h-6 cursor-pointer hover:text-red-500 transition" />
                <Volume2 className="w-5 h-5 cursor-pointer hover:text-red-500 transition" />
                <span className="text-sm font-mono text-zinc-300">08:24 / 24:00</span>
              </div>
              <Maximize className="w-5 h-5 cursor-pointer hover:text-red-500 transition" />
            </div>
          </div>
        </div>

        {/* Info Slide-up Panel (Optional logic for metadata) */}
        {showInfo && (
          <div className="absolute bottom-0 left-0 w-full bg-zinc-900 border-t border-zinc-800 p-8 z-20 animate-in slide-in-from-bottom-2">
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-2xl font-bold">Jujutsu Kaisen</h3>
              <button onClick={() => setShowInfo(false)} className="text-sm border border-zinc-700 px-3 py-1 rounded hover:bg-zinc-800 transition">Close</button>
            </div>
            <div className="flex gap-4 mb-4 text-sm font-mono text-zinc-400">
              <span className="text-red-400">99% Match</span>
              <span>2026</span>
              <span className="border border-zinc-700 px-1 rounded">TV-MA</span>
            </div>
            <p className="max-w-3xl text-zinc-300 leading-relaxed text-sm">
              Yuji Itadori is a boy with tremendous physical strength, though he lives a completely ordinary high school life. One day, to save a classmate who has been attacked by curses, he eats the finger of Ryomen Sukuna, taking the curse into his own soul.
            </p>
          </div>
        )}
      </div>

      {/* Sidebar Playlist (Right) */}
      <div className="w-full md:w-96 border-l border-zinc-800 bg-zinc-950 flex flex-col h-full flex-shrink-0">
        
        {/* Sidebar Header / Season Dropdown */}
        <div className="p-5 border-b border-zinc-800 shadow-sm bg-black/50 z-10 sticky top-0">
          <div className="flex items-center gap-3 mb-4">
            <ListVideo className="w-5 h-5 text-red-500" />
            <h3 className="font-semibold tracking-wide">Up Next</h3>
          </div>
          <button className="w-full flex items-center justify-between text-left text-sm font-medium border border-zinc-700 bg-zinc-900/50 px-4 py-2.5 rounded-lg hover:border-zinc-500 transition-colors cursor-pointer">
            <span className="text-zinc-200">Season 2: Shibuya Incident</span>
            <ChevronDown className="w-4 h-4 text-zinc-400" />
          </button>
        </div>

        {/* Scrollable Episode List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar bg-black/20">
          {MOCK_EPISODES.map((ep) => (
            <div 
              key={ep.id}
              onClick={() => setActiveEp(ep.number)}
              className={`flex flex-col gap-2 p-3 rounded-xl transition-all cursor-pointer border ${
                activeEp === ep.number 
                  ? 'bg-zinc-900 border-zinc-700' 
                  : 'bg-transparent border-transparent hover:bg-zinc-900/50'
              }`}
            >
              <div className="flex gap-4">
                <div className="relative w-32 aspect-video bg-zinc-800 rounded-md overflow-hidden flex-shrink-0">
                  <img src={ep.thumbnail} alt={ep.title} className={`object-cover w-full h-full ${activeEp === ep.number ? 'opacity-50' : 'opacity-80'}`} />
                  {activeEp === ep.number && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Play className="w-6 h-6 text-white shrink-0 fill-white" />
                    </div>
                  )}
                  {activeEp !== ep.number && (
                    <div className="absolute bottom-1 right-1 bg-black/80 px-1 text-[10px] mono rounded font-medium">24m</div>
                  )}
                </div>
                
                <div className="flex flex-col flex-1 pl-1">
                  <div className="flex justify-between items-start mb-1">
                    <span className="text-xs font-mono text-zinc-500">EP {ep.number}</span>
                  </div>
                  <span className={`text-sm font-semibold leading-tight line-clamp-2 ${activeEp === ep.number ? 'text-white' : 'text-zinc-300'}`}>
                    {ep.title}
                  </span>
                </div>
              </div>
              
              {/* Expand description if active */}
              {activeEp === ep.number && (
                <p className="text-xs text-zinc-400 leading-relaxed mt-2 border-t border-zinc-800/50 pt-2 animate-in slide-in-from-top-1">
                  {ep.description}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>
      
    </div>
  );
}
