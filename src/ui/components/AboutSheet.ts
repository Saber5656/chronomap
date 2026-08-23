import type { LayerEntry } from "../../providers/layers/types";
import type { AppState } from "../../state/appState";
import type { Store } from "../../state/store";
import { el } from "../../util/dom";
import { onLangChange, t, type Locale } from "../i18n";
import type { PoiSourceInfo } from "./LayersSheet";
import type { SheetContentController } from "./BottomSheet";
import "./AboutSheet.css";

const REPOSITORY_URL = "https://github.com/Saber5656/chronomap";
const APP_VERSION = typeof __APP_VERSION__ === "string" ? __APP_VERSION__ : "unknown";
const DEFAULT_POI_LICENSE = {
  text: "CC BY-SA 4.0",
  url: "https://creativecommons.org/licenses/by-sa/4.0/",
} as const;

const DOCUMENT_LINKS = [
  {
    id: "license",
    label: "about.link.license",
    href: `${REPOSITORY_URL}/blob/main/LICENSE`,
  },
  {
    id: "third-party",
    label: "about.link.thirdParty",
    href: `${REPOSITORY_URL}/blob/main/THIRD_PARTY_NOTICES.md`,
  },
  {
    id: "security",
    label: "about.link.security",
    href: `${REPOSITORY_URL}/blob/main/SECURITY.md`,
  },
  {
    id: "shortcut",
    label: "about.link.shortcut",
    href: `${REPOSITORY_URL}/blob/main/docs/integrations/ios-shortcut.md`,
  },
] as const;

export interface AboutCredit {
  readonly text: string;
  readonly sourceUrl?: string;
  readonly licenseName: string;
  readonly licenseUrl?: string;
}

export interface AboutDataSource {
  readonly provider: string;
  readonly credits: readonly AboutCredit[];
}

export interface AboutSheetOptions {
  readonly registry: readonly LayerEntry[];
  readonly poiSource: PoiSourceInfo | null;
}

export type AboutSheetController = SheetContentController;

function safeHttpsUrl(value: string | undefined): string | null {
  if (value === undefined || value.trim() === "") return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username !== "" || url.password !== "") return null;
    return value;
  } catch {
    return null;
  }
}

function externalLink(text: string, url: string | undefined): HTMLElement {
  const safeUrl = safeHttpsUrl(url);
  if (safeUrl === null) return el("span", { class: "about-sheet__plain-text" }, text);
  return el(
    "a",
    {
      href: safeUrl,
      target: "_blank",
      rel: "noopener noreferrer",
    },
    text,
  );
}

function creditKey(credit: AboutCredit): string {
  return [credit.text, credit.sourceUrl ?? "", credit.licenseName, credit.licenseUrl ?? ""].join(
    "\u0000",
  );
}

/** Group the loaded layer registry by provider while retaining every distinct credit tuple. */
export function collectRegistryDataSources(
  registry: readonly LayerEntry[],
): readonly AboutDataSource[] {
  const sources = new Map<string, AboutCredit[]>();
  for (const entry of registry) {
    const credit: AboutCredit = {
      text: entry.attribution.text,
      ...(entry.attribution.url === undefined ? {} : { sourceUrl: entry.attribution.url }),
      licenseName: entry.attribution.license.name,
      ...(entry.attribution.license.url === undefined
        ? {}
        : { licenseUrl: entry.attribution.license.url }),
    };
    const credits = sources.get(entry.provider) ?? [];
    if (!credits.some((candidate) => creditKey(candidate) === creditKey(credit))) {
      credits.push(credit);
    }
    sources.set(entry.provider, credits);
  }

  return [...sources.entries()].map(([provider, credits]) => ({ provider, credits }));
}

function labeledValue(label: string, value: HTMLElement): HTMLElement {
  const row = el("p", { class: "about-sheet__source-value" });
  row.append(el("span", { class: "about-sheet__label" }, `${label}: `), value);
  return row;
}

function registrySourceRow(source: AboutDataSource, locale: Locale): HTMLElement {
  const row = el("section", {
    class: "about-sheet__source-row",
    "data-source-row": source.provider,
    "data-source-provider": source.provider,
  });
  row.append(el("h4", { class: "about-sheet__source-name" }, source.provider));

  for (const credit of source.credits) {
    row.append(
      labeledValue(t("about.credit", {}, locale), externalLink(credit.text, credit.sourceUrl)),
      labeledValue(
        t("about.license", {}, locale),
        externalLink(credit.licenseName, credit.licenseUrl),
      ),
    );
  }
  return row;
}

function poiSourceRow(source: PoiSourceInfo, locale: Locale): HTMLElement {
  const row = el("section", {
    class: "about-sheet__source-row",
    "data-source-row": "poi",
    "data-source-provider": source.id,
  });
  row.append(
    el("h4", { class: "about-sheet__source-name" }, source.title[locale]),
    el("p", { class: "about-sheet__source-value about-sheet__poi-credit" }, [
      el("span", { class: "about-sheet__label" }, `${t("about.credit", {}, locale)}: `),
      externalLink(source.attribution.text, source.attribution.url),
    ]),
    labeledValue(
      t("about.license", {}, locale),
      externalLink(
        source.license?.text ?? DEFAULT_POI_LICENSE.text,
        source.license?.url ?? DEFAULT_POI_LICENSE.url,
      ),
    ),
  );
  return row;
}

function documentLink(
  id: (typeof DOCUMENT_LINKS)[number]["id"],
  locale: Locale,
): HTMLAnchorElement {
  const definition = DOCUMENT_LINKS.find((candidate) => candidate.id === id);
  if (definition === undefined) throw new Error(`Unknown About document link: ${id}`);
  return el(
    "a",
    {
      href: definition.href,
      target: "_blank",
      rel: "noopener noreferrer",
      "data-about-link": definition.id,
    },
    t(definition.label, {}, locale),
  );
}

/** Render factual app, source-credit, privacy, and project-document information. */
export function mount(
  parent: HTMLElement,
  store: Store<AppState>,
  options: AboutSheetOptions,
): AboutSheetController {
  const root = el("div", { class: "about-sheet" });
  const registrySources = collectRegistryDataSources(options.registry);
  parent.append(root);

  function render(): void {
    const locale = store.get().ui.lang;
    const appSection = el("section", {
      class: "about-sheet__section",
      "data-about-section": "app",
    });
    appSection.append(
      el("h3", { class: "about-sheet__section-heading" }, t("about.app", {}, locale)),
      el("p", { class: "about-sheet__app-name" }, t("about.name", {}, locale)),
      el(
        "p",
        { class: "about-sheet__version" },
        t("about.version", { version: APP_VERSION }, locale),
      ),
      el("p", {}, [
        el("span", { class: "about-sheet__label" }, `${t("about.repository", {}, locale)}: `),
        el(
          "a",
          { href: REPOSITORY_URL, target: "_blank", rel: "noopener noreferrer" },
          REPOSITORY_URL,
        ),
      ]),
    );

    const sourcesSection = el("section", {
      class: "about-sheet__section",
      "data-about-section": "sources",
    });
    const sourceRows = registrySources.map((source) => registrySourceRow(source, locale));
    if (options.poiSource !== null) sourceRows.push(poiSourceRow(options.poiSource, locale));
    sourcesSection.append(
      el("h3", { class: "about-sheet__section-heading" }, t("about.sources", {}, locale)),
      ...sourceRows,
    );

    const privacySection = el("section", {
      class: "about-sheet__section",
      "data-about-section": "privacy",
    });
    const privacyItems = [
      "about.privacy.coordinates",
      "about.privacy.storage",
      "about.privacy.clear",
      "about.privacy.serviceWorker",
      "about.privacy.network",
      "about.privacy.outbound",
    ] as const;
    privacySection.append(
      el("h3", { class: "about-sheet__section-heading" }, t("about.privacy", {}, locale)),
      el(
        "ul",
        { class: "about-sheet__privacy-list" },
        privacyItems.map((key) => el("li", {}, t(key, {}, locale))),
      ),
    );

    const linksSection = el("section", {
      class: "about-sheet__section",
      "data-about-section": "links",
    });
    linksSection.append(
      el("h3", { class: "about-sheet__section-heading" }, t("about.links", {}, locale)),
      el("ul", { class: "about-sheet__link-list" }, [
        el("li", {}, documentLink("license", locale)),
        el("li", {}, documentLink("third-party", locale)),
        el("li", {}, documentLink("security", locale)),
        el("li", {}, documentLink("shortcut", locale)),
      ]),
    );

    root.replaceChildren(appSection, sourcesSection, privacySection, linksSection);
  }

  const unsubscribeLanguage = onLangChange(store, render);
  render();

  return {
    destroy() {
      unsubscribeLanguage();
      root.remove();
    },
  };
}
