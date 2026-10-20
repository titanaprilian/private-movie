export function parseSourceTypesParam(input: unknown): string[] | undefined {
  if (input === undefined || input === null) {
    return undefined;
  }
  const rawList = Array.isArray(input) ? input : [input];
  const out: string[] = [];
  for (const item of rawList) {
    if (typeof item !== "string") {
      continue;
    }
    for (const part of item.split(",")) {
      const trimmed = part.trim();
      if (trimmed.length > 0) {
        out.push(trimmed);
      }
    }
  }
  return out.length > 0 ? out : undefined;
}
