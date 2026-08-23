import { afterEach, describe, expect, it, vi } from "vitest";

import abuseCorpusJson from "./fixtures/shared-location-abuse.json";
import { parseSharedLocation } from "../../src/integrations/parseSharedLocation";
import { latLng, label, zoom } from "../../src/security/validate";

interface SharedLocationCorpusEntry {
  readonly name: string;
  readonly input?: string;
  readonly repeat?: string;
  readonly count?: number;
  readonly expected: unknown;
}

const abuseCorpus = abuseCorpusJson as SharedLocationCorpusEntry[];
const CONTROL_OR_BIDI = /[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/u;

function corpusInput(entry: SharedLocationCorpusEntry): string {
  if (entry.input !== undefined) return entry.input;
  if (entry.repeat !== undefined && entry.count !== undefined) {
    return entry.repeat.repeat(entry.count);
  }
  throw new Error(`Shared-location corpus entry ${entry.name} has no input.`);
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("security abuse corpus: shared-location parser", () => {
  it("A3 rejects dangerous schemes, credentials, nested encodings, and oversized input", () => {
    expect(abuseCorpus.length).toBeGreaterThanOrEqual(15);

    for (const entry of abuseCorpus) {
      const input = corpusInput(entry);
      expect(() => parseSharedLocation(input), entry.name).not.toThrow();
      expect(parseSharedLocation(input), entry.name).toEqual(entry.expected);
    }
  });

  it("A4 parses the hostile corpus without any network capability", () => {
    const fetchSpy = vi.fn<typeof fetch>();
    vi.stubGlobal("fetch", fetchSpy);

    for (const entry of abuseCorpus) {
      const result = parseSharedLocation(corpusInput(entry));
      if (!result.ok) continue;

      expect(latLng(result.lat, result.lng), entry.name).toEqual({
        lat: result.lat,
        lng: result.lng,
      });
      if (result.zoom !== undefined) expect(zoom(result.zoom), entry.name).toBe(result.zoom);
      if (result.label !== undefined) {
        expect(CONTROL_OR_BIDI.test(result.label), entry.name).toBe(false);
        expect(label(result.label), entry.name).toBe(result.label);
      }
    }

    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
