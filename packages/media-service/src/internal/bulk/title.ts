/**
 * Strip anime season descriptors ("2nd Season", "Season 2", "Part 2",
 * "Cour 2", Roman numerals like "II") so bare-number episode matching
 * doesn't mistake a season number for the episode number.
 */
export function stripSeasonDescriptors(title: string): string {
  let out = title;
  // "2nd Season", "3rd Season"
  out = out.replace(/\b\d+(?:st|nd|rd|th)\s+season\b/gi, " ");
  // Word-form ordinals must run before the generic "Season N" rule so the
  // episode number in e.g. "Second Season 7" isn't mistaken for a season.
  out = out.replace(
    /\b(?:first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth)\s+seasons?\b/gi,
    " "
  );
  // "Season 2", "Season 02"
  out = out.replace(/\bseasons?\s+\d+\b/gi, " ");
  // "Season II", "Season IV" (Roman numerals)
  out = out.replace(/\bseasons?\s+[IVXLCDM]+\b/gi, " ");
  // "Part 2", "Part II", "Cour 2", "Cour II"
  out = out.replace(/\b(?:part|cour)\s+(?:\d+|[IVXLCDM]+)\b/gi, " ");
  // Trailing standalone Roman numeral season marker, e.g. "Re:Zero II Episode 1"
  out = out.replace(/\b[IVXLCDM]{2,}\b/g, " ");
  return out.replace(/\s{2,}/g, " ").trim();
}
