export type GeoPoint = Readonly<{
  lat: number;
  lng: number;
}>;

export type BoundingBox = readonly [west: number, south: number, east: number, north: number];

const MEAN_EARTH_RADIUS_METERS = 6_371_008.8;
const WEB_MERCATOR_RADIUS_METERS = 6_378_137;
const MAPLIBRE_TILE_SIZE_PIXELS = 512;

function degreesToRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

export function haversineMeters(a: GeoPoint, b: GeoPoint): number {
  const latitudeA = degreesToRadians(a.lat);
  const latitudeB = degreesToRadians(b.lat);
  const latitudeDelta = latitudeB - latitudeA;
  const longitudeDelta = degreesToRadians(b.lng - a.lng);

  const latitudeTerm = Math.sin(latitudeDelta / 2);
  const longitudeTerm = Math.sin(longitudeDelta / 2);
  const haversine =
    latitudeTerm * latitudeTerm +
    Math.cos(latitudeA) * Math.cos(latitudeB) * longitudeTerm * longitudeTerm;
  const centralAngle = 2 * Math.asin(Math.sqrt(Math.min(1, haversine)));

  return MEAN_EARTH_RADIUS_METERS * centralAngle;
}

export function viewportDiagonalMeters(bbox: BoundingBox): number {
  const [west, south, east, north] = bbox;

  return haversineMeters({ lat: south, lng: west }, { lat: north, lng: east });
}

/** Returns whether two non-antimeridian bounding boxes overlap or touch. */
export function bboxIntersects(a: BoundingBox, b: BoundingBox): boolean {
  const [aWest, aSouth, aEast, aNorth] = a;
  const [bWest, bSouth, bEast, bNorth] = b;

  return aWest <= bEast && aEast >= bWest && aSouth <= bNorth && aNorth >= bSouth;
}

/** Expand a non-antimeridian bounding box around its center by a dimension factor. */
export function expandBbox(bbox: BoundingBox, factor: number): BoundingBox {
  if (!Number.isFinite(factor) || factor < 0) return bbox;

  const [west, south, east, north] = bbox;
  const centerLng = (west + east) / 2;
  const centerLat = (south + north) / 2;
  const halfWidth = ((east - west) * factor) / 2;
  const halfHeight = ((north - south) * factor) / 2;

  return [
    centerLng - halfWidth,
    centerLat - halfHeight,
    centerLng + halfWidth,
    centerLat + halfHeight,
  ];
}

export function metersToPixelsAtLat(meters: number, latitude: number, zoom: number): number {
  const earthCircumference = 2 * Math.PI * WEB_MERCATOR_RADIUS_METERS;
  const groundResolution =
    (Math.cos(degreesToRadians(latitude)) * earthCircumference) /
    (MAPLIBRE_TILE_SIZE_PIXELS * 2 ** zoom);

  return meters / groundResolution;
}
