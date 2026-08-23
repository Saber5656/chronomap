import { describe, expect, it } from "vitest";

import hostileCorpusJson from "./fixtures/hostile-url-params.json";
import { label, latLng, opacity, year, zoom } from "../../src/security/validate";
import { parseUrlState } from "../../src/state/urlState";

const NOW = new Date(2026, 0, 1);
const REGISTRY_IDS = new Set(["gsi-1960", "gsi-current"]);
const CONTROL_OR_BIDI = /[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/u;

interface HostileCorpusEntry {
  readonly name: string;
  readonly value?: string;
  readonly rawQuery?: boolean;
  readonly repeat?: string;
  readonly count?: number;
}

const hostileCorpus = hostileCorpusJson as HostileCorpusEntry[];

function corpusValue(entry: HostileCorpusEntry): string {
  if (entry.value !== undefined) return entry.value;
  if (entry.repeat !== undefined && entry.count !== undefined) {
    return entry.repeat.repeat(entry.count);
  }
  throw new Error(`Hostile corpus entry ${entry.name} has no value.`);
}

function labelSearch(entry: HostileCorpusEntry): string {
  const value = corpusValue(entry);
  if (entry.rawQuery === true) return `?label=${value}`;
  return `?${new URLSearchParams({ label: value }).toString()}`;
}

function numericSearch(key: string, entry: HostileCorpusEntry): string {
  return `?${new URLSearchParams({ [key]: corpusValue(entry) }).toString()}`;
}

function assertNumericInvariants(parsed: ReturnType<typeof parseUrlState>): void {
  if (parsed.view !== undefined) {
    expect(latLng(parsed.view.lat, parsed.view.lng)).toEqual({
      lat: parsed.view.lat,
      lng: parsed.view.lng,
    });
    expect(zoom(parsed.view.zoom)).toBe(parsed.view.zoom);
  }
  if (parsed.year !== undefined) expect(year(parsed.year, NOW)).toBe(parsed.year);
  if (parsed.timeLayer !== undefined) {
    expect(opacity(Math.round(parsed.timeLayer.opacity * 100))).toBe(parsed.timeLayer.opacity);
  }
  if (parsed.requestedLayerId !== undefined && parsed.requestedLayerId !== null) {
    expect(REGISTRY_IDS.has(parsed.requestedLayerId)).toBe(true);
  }
}

describe("security abuse corpus: URL parameters", () => {
  it("A1 strips controls and bidi markers from every hostile label without throwing", () => {
    expect(hostileCorpus.length).toBeGreaterThanOrEqual(100);

    for (const entry of hostileCorpus) {
      const search = labelSearch(entry);
      let parsed: ReturnType<typeof parseUrlState>;
      expect(() => {
        parsed = parseUrlState(search, NOW, REGISTRY_IDS);
      }, entry.name).not.toThrow();

      const labelValue = parsed!.label;
      if (labelValue === undefined || labelValue === null) continue;

      expect(CONTROL_OR_BIDI.test(labelValue), entry.name).toBe(false);
      expect([...labelValue].length, entry.name).toBeLessThanOrEqual(120);
      expect(label(labelValue), entry.name).toBe(labelValue);
    }

    expect(parseUrlState("?label=%E2%80%AEabc%3Cscript%3E", NOW, REGISTRY_IDS).label).toBe(
      "abc<script>",
    );
  });

  it("A2 keeps every hostile numeric URL parameter inside its validated range", () => {
    const numericKeys = ["lat", "lng", "z", "year", "op"];

    for (const entry of hostileCorpus) {
      for (const key of numericKeys) {
        const search = numericSearch(key, entry);
        let parsed: ReturnType<typeof parseUrlState>;
        expect(() => {
          parsed = parseUrlState(search, NOW, REGISTRY_IDS);
        }, `${key}: ${entry.name}`).not.toThrow();
        assertNumericInvariants(parsed!);
      }
    }
  });
});
