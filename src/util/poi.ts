/**
 * Convert a provider-scoped POI id into a deterministic numeric GeoJSON feature id.
 *
 * MapLibre feature-state accepts string ids too, but a numeric id keeps the rendered
 * GeoJSON contract explicit and works consistently across the source tile worker. FNV-1a
 * is intentionally used instead of a runtime hash so the id survives reloads and sessions.
 */
export function poiFeatureId(value: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}
