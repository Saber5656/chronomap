export interface Poi {
  id: string;
  title: string;
  lat: number;
  lng: number;
  distanceM?: number;
  source: { provider: "wikipedia" | "commons"; lang: string; url: string };
}

export interface PoiDetail {
  extract: string;
  thumbnailUrl?: string;
  pageUrl: string;
  attributionKey: "wikipedia-ccbysa";
}

export interface PoiProvider {
  id: string;
  minZoom: number;
  search(q: {
    lat: number;
    lng: number;
    radiusM: number;
    locale: "ja" | "en";
    signal: AbortSignal;
  }): Promise<Poi[]>;
}

export type PoiProviderError = {
  kind: "network" | "timeout" | "http" | "malformed" | "aborted";
  status?: number;
};
