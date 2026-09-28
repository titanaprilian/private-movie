/**
 * Formats a raw episode duration for display in the admin episode table.
 *
 * Accepts seconds/minutes numbers, "MM:SS" / "HH:MM:SS" strings, plain
 * minute strings, or values already carrying a unit — and always renders
 * an explicit "min" unit (e.g. "24:15" → "24 min", "01:05:00" → "1h 5 min")
 * so the unit is never ambiguous. Returns an em dash when empty.
 */
export function formatEpisodeDuration(
  duration?: number | string | null
): string {
  if (duration === null || duration === undefined) return '—';

  if (typeof duration === 'number') {
    if (Number.isNaN(duration) || duration <= 0) return '—';
    // Large values are seconds, small values are already minutes.
    const totalMinutes =
      duration > 300 ? Math.round(duration / 60) : Math.round(duration);
    return formatMinutes(totalMinutes);
  }

  const str = String(duration).trim();
  if (!str || str === '0' || str === '00:00' || str === '0:00') return '—';

  // Already explicit ("24 min", "1h 5 min").
  if (/[0-9]+\s*min/.test(str)) return str;

  // Compact unit form ("24m", "1h 12m") → expand to "min".
  const compactMatch = str.match(/^(?:(\d+)\s*h\s*)?(\d+)\s*m$/i);
  if (compactMatch) {
    const hours = Number(compactMatch[1] ?? 0);
    const mins = Number(compactMatch[2] ?? 0);
    if (hours > 0) return mins > 0 ? `${hours}h ${mins} min` : `${hours}h`;
    return `${mins} min`;
  }

  // Clock form ("24:15", "01:05:00") → minutes (and hours) with unit.
  if (str.includes(':')) {
    const parts = str.split(':').map((p) => Number.parseInt(p, 10));
    if (!parts.some((p) => Number.isNaN(p))) {
      if (parts.length === 2) {
        return `${parts[0] ?? 0} min`;
      }
      if (parts.length === 3) {
        const hours = parts[0] ?? 0;
        const mins = parts[1] ?? 0;
        if (hours > 0) return mins > 0 ? `${hours}h ${mins} min` : `${hours}h`;
        return `${mins} min`;
      }
    }
    return str;
  }

  // Plain number string → minutes.
  const parsedNum = Number(str);
  if (!Number.isNaN(parsedNum) && parsedNum > 0) {
    return formatEpisodeDuration(parsedNum);
  }

  return str;
}

function formatMinutes(totalMinutes: number): string {
  if (totalMinutes <= 0) return '—';
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  if (hours > 0) return mins > 0 ? `${hours}h ${mins} min` : `${hours}h`;
  return `${mins} min`;
}
