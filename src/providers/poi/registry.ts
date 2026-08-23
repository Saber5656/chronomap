import { createWikipediaProvider, isWikipediaLanguage } from "./wikipediaGeosearch";
import type { CommonsPhotoProvider } from "./commonsImages";
import type { Poi } from "./types";
import type { PoiProvider } from "./types";

const PROVIDERS: Record<"ja" | "en", PoiProvider> = {
  ja: createWikipediaProvider("ja"),
  en: createWikipediaProvider("en"),
};

/** Return the Wikipedia GeoSearch provider bound to the requested UI locale. */
export function getPoiProvider(locale: "ja" | "en"): PoiProvider {
  if (!isWikipediaLanguage(locale)) {
    throw new RangeError("POI provider locale must be ja or en.");
  }
  return PROVIDERS[locale];
}

/** Return the experimental Commons provider only in an explicitly enabled build. */
export function getPhotoProvider(
  enabled = import.meta.env.VITE_ENABLE_COMMONS_PHOTOS === "true",
): CommonsPhotoProvider | null {
  if (!enabled) return null;

  // Keep the experimental provider out of the flag-off application chunk. The dynamic import is
  // retained only for the explicitly enabled build and keeps its Wikimedia Commons host and
  // parser implementation behind the build-time gate.
  return {
    fetch(poi: Poi, options) {
      return import("./commonsImages").then(({ getCommonsPhotoProvider }) =>
        getCommonsPhotoProvider().fetch(poi, options),
      );
    },
  };
}
