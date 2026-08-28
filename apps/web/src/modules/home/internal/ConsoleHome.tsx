const RELEASES = [
  { id: "MX-241", title: "Jujutsu Kaisen Season 3", time: "18:30 JST", ep: "12 / 24", status: "Airing Today", studio: "MAPPA" },
  { id: "NX-092", title: "Frieren: Beyond Journey's End", time: "21:00 JST", ep: "28 / 28", status: "Finished", studio: "Madhouse" },
  { id: "AX-881", title: "Spy x Family Part 3", time: "23:00 JST", ep: "01 / 12", status: "Premieres Tomorrow", studio: "WIT / CloverWorks" },
  { id: "KX-110", title: "Demon Slayer: Infinity Castle", time: "00:00 JST", ep: "01 / --", status: "Airing Today", studio: "ufotable" },
  { id: "CX-444", title: "Chainsaw Man: Reze Arc", time: "01:30 JST", ep: "Movie", status: "In Theaters", studio: "MAPPA" },
];

export function ConsoleHome() {
  return (
    <div className="min-h-screen bg-bg p-4 md:p-5 flex justify-center">
      <div className="w-full max-w-5xl">
        
        {/* Header / Command Line feel */}
        <div className="mb-6 flex flex-col md:flex-row justify-between md:items-end border-b border-c pb-4 gap-4">
          <div>
            <h1 className="text-xl font-semibold mb-1">Release Radar</h1>
            <p className="text-sm text-muted">Tracking seasonal drops and simulcast schedules.</p>
          </div>
          <div className="flex gap-2">
            <button className="px-3 py-1.5 border border-c bg-card rounded text-xs font-medium hover-bg">
              Filter: Today
            </button>
            <button className="px-3 py-1.5 bg-primary text-primary-fg rounded text-xs font-medium hover:opacity-90">
              Refresh Schedule
            </button>
          </div>
        </div>

        {/* Console Grid Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {["Currently Tracking", "Unwatched Eps", "Airing Today", "Dropped Series"].map((stat, i) => (
            <div key={i} className="bg-card border border-c rounded p-4 flex flex-col">
              <span className="text-xs text-muted font-medium mb-2">{stat}</span>
              <span className="inline-block mono text-2xl">{Math.floor(Math.random() * 50) + 5}</span>
            </div>
          ))}
        </div>

        {/* Data Table View */}
        <div className="bg-card border border-c rounded overflow-hidden">
          <div className="px-4 py-3 border-b border-c flex items-center justify-between">
            <h2 className="text-sm font-medium">Global Simulcast Queue</h2>
            <span className="mono text-[10px] text-muted border border-c px-1.5 py-0.5 rounded uppercase tracking-wide">
              Live Feed
            </span>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-sidebar">
                <tr>
                  <th className="px-4 py-2 text-[10px] text-muted uppercase tracking-wide border-b border-c font-medium">ID ↕</th>
                  <th className="px-4 py-2 text-[10px] text-muted uppercase tracking-wide border-b border-c font-medium">Title</th>
                  <th className="px-4 py-2 text-[10px] text-muted uppercase tracking-wide border-b border-c font-medium">Progress</th>
                  <th className="px-4 py-2 text-[10px] text-muted uppercase tracking-wide border-b border-c font-medium hidden md:table-cell">Studio</th>
                  <th className="px-4 py-2 text-[10px] text-muted uppercase tracking-wide border-b border-c font-medium">Status / ETA ↕</th>
                  <th className="px-4 py-2 text-[10px] text-muted uppercase tracking-wide border-b border-c font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {RELEASES.map((rel, i) => (
                  <tr key={i} className="border-b border-c hover-bg last:border-0 group">
                    <td className="px-4 py-2.5 mono text-xs">{rel.id}</td>
                    <td className="px-4 py-2.5 font-medium">{rel.title}</td>
                    <td className="px-4 py-2.5 mono text-xs">{rel.ep}</td>
                    <td className="px-4 py-2.5 hidden md:table-cell text-muted">{rel.studio}</td>
                    <td className="px-4 py-2.5">
                      <span className={`inline-flex items-center px-1.5 leading-4 text-[10px] rounded uppercase mono
                        ${rel.status === "Airing Today" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : 
                          rel.status === "Finished" ? "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400" : 
                          "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"}
                      `}>
                        {rel.status}
                      </span>
                      <div className="text-xs text-muted mt-0.5 mono">{rel.time}</div>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <button className="p-1 text-muted hover:text-primary transition">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <circle cx="12" cy="12" r="10" />
                          <path d="M10 8l6 4-6 4V8z" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {/* Footer Controls */}
          <div className="px-4 py-2.5 border-t border-c flex items-center justify-between text-xs text-muted">
            <span>Showing 1 to 5 of 42 active series</span>
            <div className="flex gap-1">
              <button className="px-2 py-1 border border-c rounded hover-bg">Prev</button>
              <button className="px-2 py-1 border border-c rounded hover-bg">Next</button>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
