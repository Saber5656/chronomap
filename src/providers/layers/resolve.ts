import { bboxIntersects } from "../../util/geo";
import type { Bbox, EraTick, LayerEntry, LayerResolution, LayerResolutionInput } from "./types";

interface ScoredEntry {
  readonly entry: LayerEntry;
  readonly score: number;
}

function coverageIntersects(coverage: readonly Bbox[], viewBbox: Bbox): boolean {
  return coverage.some((coverageBbox) => bboxIntersects(coverageBbox, viewBbox));
}

function isAvailable(entry: LayerEntry, viewBbox: Bbox, zoom: number): boolean {
  if (entry.type !== "raster-era") return false;
  if (zoom < entry.tiles.minzoom || zoom > entry.tiles.maxzoom) return false;
  return coverageIntersects(entry.coverage, viewBbox);
}

function scoreEntry(year: number, entry: LayerEntry): number {
  if (year >= entry.era.from && year <= entry.era.to) return 0;
  return Math.min(Math.abs(year - entry.era.from), Math.abs(year - entry.era.to));
}

function compareIds(a: string, b: string): number {
  return Number(a > b) - Number(a < b);
}

function compareScoredEntries(a: ScoredEntry, b: ScoredEntry): number {
  if (a.score !== b.score) return a.score - b.score;

  const spanDifference = a.entry.era.to - a.entry.era.from - (b.entry.era.to - b.entry.era.from);
  if (spanDifference !== 0) return spanDifference;
  if (a.entry.priority !== b.entry.priority) return b.entry.priority - a.entry.priority;
  return compareIds(a.entry.id, b.entry.id);
}

function resolutionForSelection(
  selected: ScoredEntry,
  candidates: readonly ScoredEntry[],
): LayerResolution {
  return {
    activeLayerId: selected.entry.id,
    reason: "ok",
    candidates: candidates.map(({ entry }) => entry.id),
    snapped: selected.score > 0,
  };
}

export function resolve(input: LayerResolutionInput): LayerResolution {
  // n is expected to be at most 200; a scan plus sort is O(n log n), so no spatial index is needed.
  // The loader rejects antimeridian-crossing bboxes; v1 Japan data can use ordinary intersections.
  const scoredCandidates = input.registry
    .filter((entry) => isAvailable(entry, input.viewBbox, input.zoom))
    .map((entry) => ({ entry, score: scoreEntry(input.year, entry) }))
    .sort(compareScoredEntries);

  if (scoredCandidates.length === 0) {
    return {
      activeLayerId: null,
      reason: input.registry.length === 0 ? "registry-empty" : "no-coverage",
      candidates: [],
      snapped: false,
    };
  }

  if (input.overrideId !== undefined) {
    const override = scoredCandidates.find(({ entry }) => entry.id === input.overrideId);
    if (override !== undefined) return resolutionForSelection(override, scoredCandidates);
  }

  let selected = scoredCandidates[0]!;
  if (input.year >= input.currentYear - 2) {
    const presentDay = scoredCandidates.find(
      ({ entry }) => entry.provider === "gsi" && entry.id === "gsi-seamlessphoto",
    );
    if (presentDay !== undefined) selected = presentDay;
  }

  return resolutionForSelection(selected, scoredCandidates);
}

export function eraTicks(registry: readonly LayerEntry[]): EraTick[] {
  return registry
    .map(({ id, era }) => ({ layerId: id, from: era.from, to: era.to }))
    .sort((a, b) => {
      if (a.from !== b.from) return a.from - b.from;
      return compareIds(a.layerId, b.layerId);
    });
}
