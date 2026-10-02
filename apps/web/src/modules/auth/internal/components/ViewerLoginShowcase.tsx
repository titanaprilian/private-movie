import { Popcorn, Sparkles } from 'lucide-react';

export function ViewerLoginShowcase() {
  return (
    <div
      data-testid="login-showcase"
      className="hidden lg:flex w-1/2 flex-col justify-between overflow-hidden border-r-2 border-[var(--border)] bg-[#131f24] p-10 text-white"
    >
      <img
        src="/assets/logo-full.png"
        alt="Private Movie"
        className="h-12 w-auto self-start"
      />

      <div className="flex flex-col items-center text-center">
        <span
          data-testid="login-mascot"
          className="inline-flex h-40 w-40 items-center justify-center rounded-[32px] border-2 border-b-4 border-[#37464f] bg-[#202f36] shadow-2xl"
        >
          <Popcorn className="h-20 w-20 text-[var(--green)]" aria-hidden="true" />
        </span>
        <h2 className="mt-8 max-w-md font-display text-4xl font-extrabold leading-tight">
          Your cozy cinema, anywhere you go
        </h2>
        <p className="mt-4 max-w-sm font-sans text-base font-bold text-white/85">
          Pick up right where you left off. Chunky, playful, and made for
          movie nights with the people you love.
        </p>
        <div className="mt-6 flex items-center gap-2 rounded-full border-2 border-[#37464f] bg-[#202f36] px-4 py-2 font-sans text-xs font-extrabold uppercase tracking-[0.8px] text-white/80">
          <Sparkles className="h-4 w-4" aria-hidden="true" />
          Continue watching in one tap
        </div>
      </div>

      <p className="font-sans text-xs font-bold text-white/70">
        Grab the popcorn — your watchlist is waiting.
      </p>
    </div>
  );
}
