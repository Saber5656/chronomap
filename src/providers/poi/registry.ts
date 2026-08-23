import { getCommonsPhotoProvider, type CommonsPhotoProvider } from "./commonsImages";
import { createWikipediaProvider, isWikipediaLanguage } from "./wikipediaGeosearch";
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
  return enabled ? getCommonsPhotoProvider() : null;
}
