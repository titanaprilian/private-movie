import React, { useRef, useState } from 'react';
import { Play, Plus, Check, ChevronLeft, ChevronRight, Volume2, VolumeX, Sparkles } from 'lucide-react';

export interface SeriesItem {
  id: string;
  title: string;
  synopsis: string;
  posterUrl: string;
  bannerUrl: string;
  matchScore: string;
  year: number;
  rating: string;
  seasons: number;
  episodes: number;
  subDub: 'SUB' | 'DUB' | 'SUB | DUB';
  genres: string[];
}

export interface CarouselRowData {
  id: string;
  title: string;
  items: SeriesItem[];
}

const HERO_ANIME: SeriesItem = {
  id: 'hero-aot',
  title: 'Attack on Titan: The Final Season',
  synopsis: 'The truth outside the walls and the identity of the Titans have been revealed. As the Marleyan military continues their advance, Eren Yeager sets out to destroy them all.',
  posterUrl: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?q=80&w=800&auto=format&fit=crop',
  bannerUrl: 'https://images.unsplash.com/photo-1596727147705-61a532a659bd?q=80&w=2560&auto=format&fit=crop',
  matchScore: '98% Match',
  year: 2026,
  rating: 'TV-MA',
  seasons: 4,
  episodes: 88,
  subDub: 'SUB | DUB',
  genres: ['Dark Fantasy', 'Action', 'Drama'],
};

const MOCK_SERIES_CATALOG: SeriesItem[] = [
  {
    id: 's-1',
    title: 'Demon Slayer: Hashira Training Arc',
    synopsis: 'Tanjiro undergoes rigorous training with the Hashira to prepare for the coming battle against Muzan Kibutsuji.',
    posterUrl: 'https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?q=80&w=800&auto=format&fit=crop',
    bannerUrl: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?q=80&w=1200&auto=format&fit=crop',
    matchScore: '99% Match',
    year: 2026,
    rating: 'TV-14',
    seasons: 4,
    episodes: 55,
    subDub: 'SUB | DUB',
    genres: ['Action', 'Supernatural'],
  },
  {
    id: 's-2',
    title: 'Jujutsu Kaisen: Culling Game',
    synopsis: 'Sorcerers across Japan are forced into a deadly battle royale designed by Noritoshi Kamo.',
    posterUrl: 'https://images.unsplash.com/photo-1563089145-599997674d42?q=80&w=800&auto=format&fit=crop',
    bannerUrl: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?q=80&w=1200&auto=format&fit=crop',
    matchScore: '97% Match',
    year: 2026,
    rating: 'TV-MA',
    seasons: 3,
    episodes: 47,
    subDub: 'SUB | DUB',
    genres: ['Action', 'Fantasy'],
  },
  {
    id: 's-3',
    title: 'Solo Leveling Season 2',
    synopsis: 'Sung Jinwoo ascends further as the Shadow Monarch, facing global gate calamities and monarch wars.',
    posterUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?q=80&w=800&auto=format&fit=crop',
    bannerUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?q=80&w=1200&auto=format&fit=crop',
    matchScore: '96% Match',
    year: 2026,
    rating: 'TV-MA',
    seasons: 2,
    episodes: 24,
    subDub: 'SUB | DUB',
    genres: ['Action', 'Fantasy'],
  },
  {
    id: 's-4',
    title: 'Chainsaw Man: Reze Arc',
    synopsis: 'Denji meets Reze, a mysterious girl working at a coffee shop who hides a explosive secret.',
    posterUrl: 'https://images.unsplash.com/photo-1579783902614-a3fb3927b675?q=80&w=800&auto=format&fit=crop',
    bannerUrl: 'https://images.unsplash.com/photo-1579783902614-a3fb3927b675?q=80&w=1200&auto=format&fit=crop',
    matchScore: '95% Match',
    year: 2025,
    rating: 'TV-MA',
    seasons: 1,
    episodes: 12,
    subDub: 'SUB | DUB',
    genres: ['Action', 'Horror'],
  },
  {
    id: 's-5',
    title: 'Frieren: Beyond Journey\'s End',
    synopsis: 'An elf mage discovers the meaning of human relationships after her hero party disbands.',
    posterUrl: 'https://images.unsplash.com/photo-1514539079130-25950c84af65?q=80&w=800&auto=format&fit=crop',
    bannerUrl: 'https://images.unsplash.com/photo-1514539079130-25950c84af65?q=80&w=1200&auto=format&fit=crop',
    matchScore: '99% Match',
    year: 2025,
    rating: 'TV-14',
    seasons: 2,
    episodes: 28,
    subDub: 'SUB | DUB',
    genres: ['Fantasy', 'Adventure'],
  },
  {
    id: 's-6',
    title: 'Cyberpunk: Edgerunners II',
    synopsis: 'A street kid trying to survive in a technology and body modification-obsessed city of the future.',
    posterUrl: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?q=80&w=800&auto=format&fit=crop',
    bannerUrl: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?q=80&w=1200&auto=format&fit=crop',
    matchScore: '94% Match',
    year: 2026,
    rating: 'TV-MA',
    seasons: 1,
    episodes: 10,
    subDub: 'SUB | DUB',
    genres: ['Sci-Fi', 'Action'],
  },
  {
    id: 's-7',
    title: 'Vinland Saga Season 3',
    synopsis: 'Thorfinn voyages east to Miklagard to raise funds for establishing a peaceful settlement in Vinland.',
    posterUrl: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?q=80&w=800&auto=format&fit=crop',
    bannerUrl: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?q=80&w=1200&auto=format&fit=crop',
    matchScore: '98% Match',
    year: 2026,
    rating: 'TV-MA',
    seasons: 3,
    episodes: 72,
    subDub: 'SUB',
    genres: ['Historical', 'Drama'],
  },
  {
    id: 's-8',
    title: 'Bleach: Thousand-Year Blood War',
    synopsis: 'Soul Reapers engage in an all-out war against the Quincy empire led by Yhwach.',
    posterUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?q=80&w=800&auto=format&fit=crop',
    bannerUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?q=80&w=1200&auto=format&fit=crop',
    matchScore: '97% Match',
    year: 2026,
    rating: 'TV-14',
    seasons: 3,
    episodes: 39,
    subDub: 'SUB | DUB',
    genres: ['Action', 'Supernatural'],
  },
];

const CAROUSEL_ROWS: CarouselRowData[] = [
  {
    id: 'row-trending',
    title: 'Trending Now',
    items: MOCK_SERIES_CATALOG,
  },
  {
    id: 'row-simulcast',
    title: 'Simulcasts - Spring 2026',
    items: [MOCK_SERIES_CATALOG[1], MOCK_SERIES_CATALOG[2], MOCK_SERIES_CATALOG[0], MOCK_SERIES_CATALOG[4], MOCK_SERIES_CATALOG[3], MOCK_SERIES_CATALOG[5], MOCK_SERIES_CATALOG[7], MOCK_SERIES_CATALOG[6]],
  },
  {
    id: 'row-shounen',
    title: 'Top Shounen',
    items: [MOCK_SERIES_CATALOG[0], MOCK_SERIES_CATALOG[1], MOCK_SERIES_CATALOG[7], MOCK_SERIES_CATALOG[2], MOCK_SERIES_CATALOG[3], MOCK_SERIES_CATALOG[4], MOCK_SERIES_CATALOG[6], MOCK_SERIES_CATALOG[5]],
  },
  {
    id: 'row-fantasy',
    title: 'Action & Dark Fantasy',
    items: [MOCK_SERIES_CATALOG[2], MOCK_SERIES_CATALOG[3], MOCK_SERIES_CATALOG[4], MOCK_SERIES_CATALOG[0], MOCK_SERIES_CATALOG[1], MOCK_SERIES_CATALOG[6], MOCK_SERIES_CATALOG[5], MOCK_SERIES_CATALOG[7]],
  },
];

function CarouselRowComponent({ row }: { row: CarouselRowData }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [myListIds, setMyListIds] = useState<Record<string, boolean>>({});

  const toggleMyList = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setMyListIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const scroll = (direction: 'left' | 'right') => {
    if (!containerRef.current) return;
    const scrollAmount = direction === 'left' ? -600 : 600;
    if (typeof containerRef.current.scrollBy === 'function') {
      containerRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    } else {
      containerRef.current.scrollLeft += scrollAmount;
    }
  };

  return (
    <div className="relative group/row my-6">
      <h2 className="text-xl md:text-2xl font-bold mb-3 text-zinc-100 flex items-center gap-2 px-8 md:px-16">
        <span>{row.title}</span>
        <ChevronRight className="w-5 h-5 text-zinc-500 opacity-0 group-hover/row:opacity-100 transition-opacity" />
      </h2>

      <div className="relative px-8 md:px-16">
        {/* Left Scroll Button */}
        <button
          onClick={() => scroll('left')}
          className="absolute left-0 top-0 bottom-0 z-40 w-12 bg-black/60 hover:bg-black/90 flex items-center justify-center text-white opacity-0 group-hover/row:opacity-100 transition-all duration-200"
          aria-label={`Scroll ${row.title} left`}
        >
          <ChevronLeft className="w-8 h-8" />
        </button>

        {/* Horizontal Carousel Container */}
        <div
          ref={containerRef}
          className="flex gap-4 overflow-x-auto py-4 scrollbar-none scroll-smooth snap-x snap-mandatory"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {row.items.map((item, idx) => {
            const inList = myListIds[item.id] ?? false;

            return (
              <div
                key={`${row.id}-${item.id}-${idx}`}
                data-testid="series-card"
                className="w-[240px] sm:w-[280px] flex-shrink-0 snap-start group relative rounded-md bg-zinc-900 border border-zinc-800 hover:border-zinc-700 transition-all duration-300 transform hover:scale-105 sm:hover:scale-110 z-10 hover:z-30 shadow-md hover:shadow-2xl cursor-pointer"
              >
                {/* Poster / Aspect Ratio Box */}
                <div className="relative aspect-[16/9] w-full rounded-t-md overflow-hidden bg-zinc-800">
                  <img
                    src={item.posterUrl}
                    alt={item.title}
                    className="w-full h-full object-cover group-hover:opacity-90 transition-opacity"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-transparent to-transparent opacity-80" />

                  {/* SUB/DUB Badge overlay */}
                  <div className="absolute top-2 left-2 flex items-center gap-1.5">
                    <span className="bg-red-600/90 backdrop-blur-md text-white text-[10px] font-bold px-1.5 py-0.5 rounded shadow mono">
                      {item.subDub}
                    </span>
                  </div>

                  {/* Season Badge */}
                  <div className="absolute top-2 right-2">
                    <span className="bg-black/70 backdrop-blur-md text-zinc-300 text-[10px] font-mono px-1.5 py-0.5 rounded border border-zinc-700">
                      {item.seasons} {item.seasons === 1 ? 'Season' : 'Seasons'}
                    </span>
                  </div>
                </div>

                {/* Card Content / Hover Details */}
                <div className="p-3 bg-zinc-900 rounded-b-md">
                  <h3 className="text-sm font-semibold text-zinc-100 truncate group-hover:text-white transition-colors">
                    {item.title}
                  </h3>

                  {/* Hover Meta Row */}
                  <div className="flex items-center justify-between text-xs mt-2 text-zinc-400">
                    <div className="flex items-center gap-2">
                      <span className="text-emerald-400 font-medium">{item.matchScore}</span>
                      <span className="border border-zinc-700 px-1 rounded text-[10px] font-mono">{item.rating}</span>
                    </div>
                    <span className="font-mono text-[11px] text-zinc-400">{item.episodes} EPS</span>
                  </div>

                  {/* Action buttons revealed on hover */}
                  <div className="flex items-center justify-between mt-3 pt-2 border-t border-zinc-800/80">
                    <div className="flex items-center gap-2">
                      <button
                        className="w-8 h-8 rounded-full bg-white text-black flex items-center justify-center hover:bg-zinc-200 transition-colors shadow"
                        aria-label={`Play ${item.title}`}
                      >
                        <Play className="w-4 h-4 fill-black text-black ml-0.5" />
                      </button>
                      <button
                        onClick={(e) => toggleMyList(item.id, e)}
                        className={`w-8 h-8 rounded-full border border-zinc-700 flex items-center justify-center transition-colors ${
                          inList ? 'bg-emerald-600 border-emerald-500 text-white' : 'bg-zinc-800 hover:bg-zinc-700 text-white'
                        }`}
                        aria-label={inList ? `Remove ${item.title} from list` : `Add ${item.title} to list`}
                      >
                        {inList ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                      </button>
                    </div>

                    <div className="flex items-center gap-1">
                      {item.genres.slice(0, 2).map((g) => (
                        <span key={g} className="text-[10px] font-mono text-zinc-400 bg-zinc-800 px-1.5 py-0.5 rounded">
                          {g}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Right Scroll Button */}
        <button
          onClick={() => scroll('right')}
          className="absolute right-0 top-0 bottom-0 z-40 w-12 bg-black/60 hover:bg-black/90 flex items-center justify-center text-white opacity-0 group-hover/row:opacity-100 transition-all duration-200"
          aria-label={`Scroll ${row.title} right`}
        >
          <ChevronRight className="w-8 h-8" />
        </button>
      </div>
    </div>
  );
}

export function CinematicHome() {
  const [heroMuted, setHeroMuted] = useState(true);
  const [heroInList, setHeroInList] = useState(false);

  return (
    <div className="min-h-screen bg-black text-white overflow-x-hidden font-sans selection:bg-red-600 selection:text-white">
      {/* Hero Banner Section */}
      <div className="relative h-[85vh] min-h-[550px] w-full bg-zinc-950 border-b border-zinc-800">
        {/* Background Banner Image */}
        <div
          className="absolute inset-0 bg-cover bg-center transition-opacity duration-700"
          style={{ backgroundImage: `url(${HERO_ANIME.bannerUrl})` }}
        />

        {/* Gradient overlays for cinematic effect */}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent z-10" />
        <div className="absolute inset-0 bg-gradient-to-r from-black via-black/60 to-transparent z-10" />

        {/* Hero Content */}
        <div className="absolute bottom-12 left-0 z-20 w-full px-8 md:px-16 text-left">
          <div className="max-w-3xl space-y-4">
            {/* Tagline / Badge */}
            <div className="flex items-center gap-2 text-xs font-mono tracking-widest text-red-500 uppercase">
              <Sparkles className="w-4 h-4 text-red-500" />
              <span>Featured Simulcast</span>
            </div>

            {/* Title */}
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-white leading-tight drop-shadow-md">
              {HERO_ANIME.title}
            </h1>

            {/* Meta Row */}
            <div className="flex items-center gap-3 text-sm text-zinc-300 flex-wrap">
              <span className="text-emerald-400 font-semibold">{HERO_ANIME.matchScore}</span>
              <span>{HERO_ANIME.year}</span>
              <span className="border border-zinc-600 px-1.5 py-0.5 rounded text-xs font-mono bg-black/40">{HERO_ANIME.rating}</span>
              <span className="bg-red-600/80 text-white px-1.5 py-0.5 rounded text-xs font-mono font-bold">{HERO_ANIME.subDub}</span>
              <span>{HERO_ANIME.seasons} Seasons</span>
            </div>

            {/* Synopsis */}
            <p className="text-zinc-300 text-base md:text-lg line-clamp-3 leading-relaxed max-w-2xl text-shadow">
              {HERO_ANIME.synopsis}
            </p>

            {/* Action Buttons */}
            <div className="flex items-center gap-4 pt-4">
              <button className="bg-white text-black px-7 py-3 rounded-md text-base font-semibold hover:bg-zinc-200 transition-colors flex items-center gap-2 shadow-lg hover:shadow-white/10 cursor-pointer">
                <Play className="w-5 h-5 fill-black text-black" />
                <span>Play</span>
              </button>

              <button
                onClick={() => setHeroInList(!heroInList)}
                className={`px-6 py-3 rounded-md text-base font-medium transition-colors flex items-center gap-2 border shadow-lg cursor-pointer ${
                  heroInList ? 'bg-emerald-600 border-emerald-500 text-white' : 'bg-zinc-900/80 hover:bg-zinc-800 text-white border-zinc-700'
                }`}
              >
                {heroInList ? <Check className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
                <span>{heroInList ? 'In My List' : 'My List'}</span>
              </button>

              <button
                onClick={() => setHeroMuted(!heroMuted)}
                className="w-12 h-12 rounded-full bg-zinc-900/80 hover:bg-zinc-800 text-white border border-zinc-700 flex items-center justify-center transition-colors ml-auto md:ml-0"
                aria-label={heroMuted ? 'Unmute' : 'Mute'}
              >
                {heroMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
              </button>
            </div>

            {/* Genre tags */}
            <div className="flex items-center gap-2 pt-2">
              {HERO_ANIME.genres.map((genre) => (
                <span key={genre} className="text-xs text-zinc-400 font-mono flex items-center gap-2 bg-zinc-900/60 px-2 py-1 rounded border border-zinc-800">
                  {genre}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Content Carousel Rows */}
      <div className="relative z-30 pb-20 -mt-10 space-y-4">
        {CAROUSEL_ROWS.map((row) => (
          <CarouselRowComponent key={row.id} row={row} />
        ))}
      </div>
    </div>
  );
}
