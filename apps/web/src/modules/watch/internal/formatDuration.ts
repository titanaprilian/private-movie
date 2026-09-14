export function formatDuration(duration?: number | string | null): string | null {
  if (duration === null || duration === undefined || duration === '') return null;

  if (typeof duration === 'number') {
    if (isNaN(duration) || duration <= 0) return null;
    // Assuming duration in seconds or minutes; if > 300 likely seconds
    const totalMinutes = duration > 300 ? Math.round(duration / 60) : Math.round(duration);
    if (totalMinutes <= 0) return null;
    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    if (hours > 0) {
      return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
    }
    return `${mins}m`;
  }

  const str = String(duration).trim();
  if (!str || str === '0' || str === '00:00' || str === '0:00') return null;

  // Pattern like "24m", "1h 12m", "24 min"
  if (/[0-9]+[hm]/.test(str) || /[0-9]+\s*min/.test(str)) {
    return str;
  }

  // Pattern like "24:15" or "01:05:00"
  if (str.includes(':')) {
    const parts = str.split(':').map((p) => Number.parseInt(p, 10));
    if (parts.some((p) => isNaN(p))) return str;
    if (parts.length === 2) {
      const mins = parts[0] ?? 0;
      return `${mins}m`;
    }
    if (parts.length === 3) {
      const hours = parts[0] ?? 0;
      const mins = parts[1] ?? 0;
      if (hours > 0) {
        return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
      }
      return `${mins}m`;
    }
  }

  const parsedNum = Number(str);
  if (!isNaN(parsedNum) && parsedNum > 0) {
    return formatDuration(parsedNum);
  }

  return str;
}
