import { describe, expect, it } from 'vitest';

import {
  haversineMeters,
  metersToPixelsAtLat,
  viewportDiagonalMeters,
} from '../../../src/util/geo';

describe('haversineMeters', () => {
  it('measures the Tokyo Station to Shin-Osaka distance within one percent', () => {
    const distance = haversineMeters(
      { lat: 35.681236, lng: 139.767125 },
      { lat: 34.733, lng: 135.5 },
    );

    expect(distance).toBeGreaterThan(403_000 * 0.99);
    expect(distance).toBeLessThan(403_000 * 1.01);
  });

  it('returns zero for the same point', () => {
    const point = { lat: 35.681236, lng: 139.767125 };

    expect(haversineMeters(point, point)).toBe(0);
  });
});

describe('viewportDiagonalMeters', () => {
  it('measures the southwest-to-northeast diagonal', () => {
    const diagonal = viewportDiagonalMeters([0, 0, 1, 1]);

    expect(diagonal).toBeGreaterThan(157_000);
    expect(diagonal).toBeLessThan(157_500);
  });
});

describe('metersToPixelsAtLat', () => {
  it('maps the equatorial circumference to one 512-pixel tile at zoom zero', () => {
    const equatorialCircumference = 40_075_016.68557849;

    expect(metersToPixelsAtLat(equatorialCircumference, 0, 0)).toBeCloseTo(
      512,
      10,
    );
  });

  it('converts a representative accuracy radius at Tokyo latitude and zoom', () => {
    expect(metersToPixelsAtLat(100, 35.681236, 15)).toBeCloseTo(51.54, 2);
  });

  it('returns zero pixels for zero meters', () => {
    expect(metersToPixelsAtLat(0, 35.681236, 15)).toBe(0);
  });
});
