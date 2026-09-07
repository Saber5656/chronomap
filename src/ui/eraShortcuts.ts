import type { LayerEntry } from "../providers/layers/types";

/** Representative years from imagery actually available in the current viewport. */
export function eraShortcuts(
  registry: readonly LayerEntry[],
  candidates: readonly string[],
  currentYear: number,
): ReadonlyArray<{ id: string; year: number }> {
  const available = new Set(candidates);
  return registry
    .filter((entry) => available.has(entry.id) && entry.era.from <= currentYear)
    .map((entry) => ({
      id: entry.id,
      year:
        entry.id === "gsi-seamlessphoto"
          ? currentYear
          : Math.min(currentYear, Math.round((entry.era.from + entry.era.to) / 2)),
    }))
    .sort((a, b) => a.year - b.year || a.id.localeCompare(b.id));
}
