import enStrings from "../../../src/ui/i18n/strings.en.json";
import jaStrings from "../../../src/ui/i18n/strings.ja.json";
import { describe, expect, it } from "vitest";

const namedKeys = [
  "about.app",
  "about.name",
  "about.credit",
  "about.license",
  "about.link.license",
  "about.link.security",
  "about.link.shortcut",
  "about.link.thirdParty",
  "about.links",
  "about.privacy",
  "about.privacy.clear",
  "about.privacy.coordinates",
  "about.privacy.network",
  "about.privacy.outbound",
  "about.privacy.serviceWorker",
  "about.privacy.storage",
  "about.repository",
  "about.sources",
  "about.version",
  "announce.layerChanged",
  "badge.presentDay",
  "common.close",
  "common.comingSoon",
  "common.retry",
  "coverage.nearby",
  "coverage.nearest",
  "coverage.none",
  "coverage.registryError",
  "coverage.snapped",
  "geo.aria",
  "geo.denied.body",
  "geo.denied.title",
  "geo.registerFailed",
  "geo.requested",
  "geo.timeout",
  "handoff.apple",
  "handoff.copyFailed",
  "handoff.geo",
  "handoff.google",
  "handoff.menuAria",
  "handoff.popupBlocked",
  "import.err.invalid",
  "import.err.nocoords",
  "import.err.shortlink",
  "import.inputLabel",
  "import.open",
  "import.opened",
  "import.paste",
  "import.placeholder",
  "menu.about",
  "menu.aria",
  "menu.close",
  "menu.import",
  "menu.lang",
  "menu.registerGeo",
  "menu.share",
  "net.backOnline",
  "net.offline",
  "net.tilesFailing",
  "onboard.done",
  "onboard.locate",
  "onboard.menu",
  "onboard.next",
  "onboard.skip",
  "onboard.slider",
  "opacity.aria",
  "opacity.label",
  "photos.commonsCredit",
  "photos.nearbyOld",
  "picker.copyCoords",
  "picker.openInMaps",
  "picker.travelHere",
  "poi.aria",
  "poi.attribution",
  "poi.detailError",
  "poi.distance",
  "poi.fetchError",
  "poi.openInMaps",
  "poi.readOnWikipedia",
  "poi.zoomHint",
  "share.copied",
  "share.fail.shortlink",
  "slider.aria",
  "slider.noData",
  "slider.valuetext",
  "sw.offlineReady",
  "sw.reload",
  "sw.updateReady",
] as const;

function interpolationVariables(value: string): string[] {
  return [...new Set([...value.matchAll(/\{(\w+)\}/g)].map((match) => match[1]!))].sort();
}

describe("i18n string tables", () => {
  it("contains the complete named-key seed in both locales", () => {
    expect(Object.keys(jaStrings)).toEqual(expect.arrayContaining([...namedKeys]));
    expect(Object.keys(enStrings)).toEqual(expect.arrayContaining([...namedKeys]));
  });

  it("has identical non-empty key sets", () => {
    const jaKeys = Object.keys(jaStrings).sort();
    const enKeys = Object.keys(enStrings).sort();
    expect(enKeys).toEqual(jaKeys);
    expect(Object.values(jaStrings).every((value) => value.trim() !== "")).toBe(true);
    expect(Object.values(enStrings).every((value) => value.trim() !== "")).toBe(true);
  });

  it("uses the same interpolation variables for every key", () => {
    for (const key of Object.keys(jaStrings) as Array<keyof typeof jaStrings>) {
      expect(interpolationVariables(enStrings[key])).toEqual(
        interpolationVariables(jaStrings[key]),
      );
    }
  });
});
