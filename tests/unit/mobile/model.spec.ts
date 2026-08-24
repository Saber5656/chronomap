import { describe, expect, it } from "vitest";

import {
  attributionLabel,
  createMobileRegistry,
  eraLabel,
  layerTitle,
  MIN_TOUCH_TARGET,
  MOBILE_MAP_MAX_ZOOM,
  MOBILE_MAP_MIN_ZOOM,
  mobileYearRange,
  regionToBbox,
  regionToZoom,
  resolveMobileLayer,
  TOKYO_DEMO_REGION,
} from "../../../apps/mobile/src/model";

const CURRENT_YEAR = 2026;
const registry = createMobileRegistry(CURRENT_YEAR);

describe("Expo mobile map model", () => {
  it("uses the canonical 1961–1969 GSI layer for the Tokyo 1965 demo", () => {
    const selection = resolveMobileLayer({
      year: 1965,
      region: TOKYO_DEMO_REGION,
      currentYear: CURRENT_YEAR,
      registry,
    });

    expect(selection.activeLayer?.id).toBe("gsi-ort-old10");
    expect(selection.resolution.reason).toBe("ok");
    expect(selection.resolution.snapped).toBe(false);
  });

  it("uses the canonical present-day seamless imagery at a supported Tokyo zoom", () => {
    const selection = resolveMobileLayer({
      year: CURRENT_YEAR,
      region: TOKYO_DEMO_REGION,
      currentYear: CURRENT_YEAR,
      registry,
    });

    expect(selection.activeLayer?.id).toBe("gsi-seamlessphoto");
    expect(selection.resolution.reason).toBe("ok");
  });

  it("keeps the basemap usable when no registry coverage exists", () => {
    const selection = resolveMobileLayer({
      year: 1965,
      region: { latitude: 0, longitude: 0, latitudeDelta: 0.02, longitudeDelta: 0.02 },
      currentYear: CURRENT_YEAR,
      registry,
    });

    expect(selection.activeLayer).toBeNull();
    expect(selection.resolution.reason).toBe("no-coverage");
  });

  it("clamps malformed and edge regions to an ordered geographic bbox", () => {
    expect(
      regionToBbox({
        latitude: Number.POSITIVE_INFINITY,
        longitude: 180,
        latitudeDelta: 0,
        longitudeDelta: Number.NaN,
      }),
    ).toEqual([179.999999, -0.0000005, 180, 0.0000005]);

    const polar = regionToBbox({
      latitude: 90,
      longitude: -180,
      latitudeDelta: 200,
      longitudeDelta: 400,
    });
    expect(polar[0]).toBe(-180);
    expect(polar[1]).toBe(0);
    expect(polar[2]).toBe(0);
    expect(polar[3]).toBe(90);
  });

  it("clamps native region deltas to the shared zoom contract", () => {
    expect(regionToZoom({ ...TOKYO_DEMO_REGION, longitudeDelta: 0 })).toBe(18);
    expect(regionToZoom({ ...TOKYO_DEMO_REGION, longitudeDelta: 720 })).toBe(2);
    expect(regionToZoom({ ...TOKYO_DEMO_REGION, longitudeDelta: Number.NaN })).toBe(2);
  });

  it("derives the mobile year range from the canonical registry", () => {
    expect(mobileYearRange(registry, CURRENT_YEAR)).toEqual({ minimum: 1928, maximum: 2026 });
    expect(mobileYearRange([], CURRENT_YEAR)).toEqual({ minimum: 2026, maximum: 2026 });
  });

  it("formats localized titles and single-year or ranged eras", () => {
    const singleYearLayer = registry.find((entry) => entry.id === "gsi-ort-1928");
    const rangedLayer = registry.find((entry) => entry.id === "gsi-ort-old10");

    expect(singleYearLayer).toBeDefined();
    expect(rangedLayer).toBeDefined();
    expect(layerTitle(singleYearLayer!, "ja")).toBe("大阪 空中写真 1928年頃");
    expect(layerTitle(singleYearLayer!, "en")).toBe("Osaka aerial photos around 1928");
    expect(eraLabel(singleYearLayer!)).toBe("1928");
    expect(eraLabel(rangedLayer!)).toBe("1961–1969");
  });

  it("keeps provider-specific credits visible and touch targets mobile-sized", () => {
    const presentLayer = registry.find((entry) => entry.id === "gsi-seamlessphoto");

    expect(presentLayer).toBeDefined();
    expect(attributionLabel(null, "GSI tiles")).toBe("GSI tiles");
    expect(attributionLabel(presentLayer!, "GSI tiles")).toContain("GRUS画像（© Axelspace）");
    expect(MIN_TOUCH_TARGET).toBeGreaterThanOrEqual(44);
    expect(MOBILE_MAP_MIN_ZOOM).toBe(5);
    expect(MOBILE_MAP_MAX_ZOOM).toBe(18);
  });

  it("normalizes year input before resolving", () => {
    const future = resolveMobileLayer({
      year: 9999,
      region: TOKYO_DEMO_REGION,
      currentYear: CURRENT_YEAR,
      registry,
    });
    const past = resolveMobileLayer({
      year: 1000,
      region: TOKYO_DEMO_REGION,
      currentYear: CURRENT_YEAR,
      registry,
    });

    expect(future.year).toBe(CURRENT_YEAR);
    expect(past.year).toBe(1890);
  });
});
