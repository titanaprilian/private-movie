const GENRES = ["Action", "Adventure", "Comedy", "Drama", "Fantasy", "Horror", "Mecha", "Mystery", "Romance", "Sci-Fi", "Slice of Life", "Sports"];
const SEASONS = ["Spring 2026", "Winter 2026", "Fall 2025", "Summer 2025"];

export function GridHome() {
  return (
    <div className="min-h-screen bg-bg text-fg flex overflow-hidden">
      
      {/* Sidebar Filters */}
      <aside className="w-64 border-r border-c bg-sidebar p-5 hidden md:block overflow-y-auto">
        <h2 className="text-xl font-semibold mb-6">Browse Catalog</h2>
        
        <div className="space-y-6">
          {/* Seasons Filter */}
          <div>
            <h3 className="text-sm font-medium text-muted uppercase tracking-wider mb-3">Air Season</h3>
            <div className="space-y-2">
              {SEASONS.map((season, i) => (
                <label key={i} className="flex items-center gap-2 cursor-pointer group">
                  <input type="checkbox" className="rounded border-c form-checkbox text-primary focus:ring-primary bg-transparent" />
                  <span className="text-sm group-hover:text-primary transition">{season}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Genres Filter */}
          <div>
            <h3 className="text-sm font-medium text-muted uppercase tracking-wider mb-3">Genres</h3>
            <div className="space-y-2">
              {GENRES.map((genre, i) => (
                <label key={i} className="flex items-center gap-2 cursor-pointer group">
                  <input type="checkbox" className="rounded border-c form-checkbox text-primary focus:ring-primary bg-transparent" />
                  <span className="text-sm group-hover:text-primary transition">{genre}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      </aside>

      {/* Main Grid area */}
      <main className="flex-1 p-6 overflow-y-auto w-full">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">All Anime</h1>
          
          <select className="bg-card border border-c inset-y-0 rounded text-sm p-2 outline-none focus:border-primary">
            <option>Sort by: Popularity</option>
            <option>Sort by: Rating</option>
            <option>Sort by: Newest</option>
            <option>Sort by: A-Z</option>
          </select>
        </div>
        
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {Array.from({ length: 24 }).map((_, i) => (
            <div key={i} className="group cursor-pointer">
              {/* Thumbnail (Portrait) */}
              <div className="relative aspect-[2/3] rounded border border-c overflow-hidden mb-2 bg-muted">
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end p-2">
                  <div className="w-full flex justify-between items-center text-white">
                    <span className="text-xs bg-primary px-1 font-bold rounded">SUB | DUB</span>
                  </div>
                </div>
                <div className="absolute top-0 right-0 p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                   <button className="bg-black/50 text-white rounded p-1 hover:bg-primary transition">
                     <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                       <path d="M12 5v14M5 12h14" />
                     </svg>
                   </button>
                </div>
              </div>
              {/* Title & Meta */}
              <h3 className="text-sm font-medium line-clamp-2 leading-tight group-hover:text-primary transition">
                Generic Isekai Title With A Very Long Name Episode {i + 1}
              </h3>
              <p className="text-xs text-muted mono mt-1">{"Series • 24 EPS"}</p>
            </div>
          ))}
        </div>
        
        {/* Pagination placeholder */}
        <div className="mt-10 flex justify-center pb-10">
          <button className="px-6 py-2 border border-c rounded hover-bg text-sm font-medium">
            Load More Titles
          </button>
        </div>
      </main>
    </div>
  );
}
