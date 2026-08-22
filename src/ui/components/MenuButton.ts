import { createActions } from "../../state/actions";
import type { AppState } from "../../state/appState";
import { parseUrlState, serializeUrlState } from "../../state/urlState";
import type { Store } from "../../state/store";
import { el } from "../../util/dom";
import { bindLanguageToggle, onLangChange, t, type Locale } from "../i18n";

let nextMenuId = 0;

export interface LanguageToggleItem {
  readonly element: HTMLButtonElement;
  destroy(): void;
}

export function createLanguageToggleItem(store: Store<AppState>): LanguageToggleItem {
  const binding = bindLanguageToggle(store);
  const label = binding.getLabel();
  const button = el(
    "button",
    {
      type: "button",
      role: "menuitem",
      class: "menu-item",
      "data-menu-item": "language",
      "aria-label": label,
    },
    label,
  );

  const render = (): void => {
    const nextLabel = binding.getLabel();
    button.textContent = nextLabel;
    button.setAttribute("aria-label", nextLabel);
  };
  const handleClick = (): void => {
    binding.toggle();
  };
  const unsubscribe = onLangChange(store, render);
  button.addEventListener("click", handleClick);

  return {
    element: button,
    destroy() {
      unsubscribe();
      button.removeEventListener("click", handleClick);
      button.remove();
    },
  };
}

export interface ShareNavigator {
  readonly share?: (data: { title: string; url: string }) => Promise<void> | void;
  readonly clipboard?: { writeText(text: string): Promise<void> | void };
}

export interface MenuButtonOptions {
  readonly registryIds?: ReadonlySet<string>;
  readonly getSerialized?: () => string;
  readonly baseUrl?: string;
  readonly pageLocation?: Pick<Location, "origin" | "search">;
  readonly pageNavigator?: ShareNavigator;
}

export function buildShareUrl(
  serialized: string,
  pageLocation: Pick<Location, "origin"> = globalThis.location,
  baseUrl: string = import.meta.env.BASE_URL,
): string {
  const url = new URL(baseUrl, pageLocation.origin);
  url.search = serialized;
  url.hash = "";
  return url.href;
}

function serializableState(
  state: Readonly<AppState>,
  labelValue: string | null,
): Parameters<typeof serializeUrlState>[0] {
  return {
    view: state.view,
    year: state.year,
    requestedLayerId: state.requestedLayerId,
    timeLayer: { opacity: state.timeLayer.opacity },
    poi: { enabled: state.poi.enabled },
    label: labelValue,
  };
}

function defaultSerialized(
  store: Store<AppState>,
  registryIds: ReadonlySet<string>,
  pageLocation: Pick<Location, "search">,
): string {
  const labelValue = parseUrlState(pageLocation.search, new Date(), registryIds).label ?? null;
  return serializeUrlState(serializableState(store.get(), labelValue), registryIds);
}

export async function shareCurrentView(
  serialized: string,
  pageLocation: Pick<Location, "origin"> = globalThis.location,
  pageNavigator: ShareNavigator = globalThis.navigator,
  baseUrl: string = import.meta.env.BASE_URL,
): Promise<"shared" | "copied" | "unavailable"> {
  const url = buildShareUrl(serialized, pageLocation, baseUrl);
  if (typeof pageNavigator.share === "function") {
    await pageNavigator.share({ title: "chronomap", url });
    return "shared";
  }

  if (typeof pageNavigator.clipboard?.writeText !== "function") return "unavailable";
  await pageNavigator.clipboard.writeText(url);
  return "copied";
}

function localeFor(state: Readonly<AppState>): Locale {
  return state.ui.lang;
}

/** Mount the Issue #13 MenuButton with share and reusable language actions. */
export function mountMenuButton(
  parent: HTMLElement,
  store: Store<AppState>,
  options: MenuButtonOptions = {},
): { destroy(): void } {
  const actions = createActions(store);
  const registryIds = options.registryIds ?? new Set<string>();
  const pageLocation = options.pageLocation ?? globalThis.location;
  const pageNavigator = options.pageNavigator ?? globalThis.navigator;
  const menuId = `chronomap-menu-${nextMenuId + 1}`;
  nextMenuId += 1;

  const root = el("div", { class: "menu-button" });
  const button = el(
    "button",
    {
      type: "button",
      class: "menu-trigger",
      "aria-haspopup": "menu",
      "aria-controls": menuId,
      "aria-expanded": "false",
    },
    "⋯",
  );
  const menu = el("ul", { id: menuId, class: "menu-popover", role: "menu" });
  const shareItem = el("li", { role: "none" });
  const shareButton = el("button", { type: "button", role: "menuitem", class: "menu-item" });
  const languageItem = createLanguageToggleItem(store);
  const languageItemContainer = el("li", { role: "none" });
  shareItem.append(shareButton);
  languageItemContainer.append(languageItem.element);
  menu.append(shareItem, languageItemContainer);
  menu.hidden = true;
  root.append(button, menu);
  parent.append(root);

  let open = false;
  let destroyed = false;

  function setOpen(next: boolean): void {
    open = next;
    menu.hidden = !open;
    button.setAttribute("aria-expanded", String(open));
  }

  function render(locale: Locale): void {
    button.setAttribute("aria-label", t("menu.aria", {}, locale));
    shareButton.textContent = t("menu.share", {}, locale);
  }

  async function handleShare(): Promise<void> {
    setOpen(false);
    const serialized =
      options.getSerialized?.() ?? defaultSerialized(store, registryIds, pageLocation);
    try {
      const result = await shareCurrentView(
        serialized,
        pageLocation,
        pageNavigator,
        options.baseUrl ?? import.meta.env.BASE_URL,
      );
      if (result === "copied") {
        actions.showToast("info", t("share.copied", {}, localeFor(store.get())));
      }
    } catch {
      // A dismissed native share sheet and clipboard permission failures are intentionally silent.
    }
  }

  function handleButtonClick(): void {
    setOpen(!open);
  }

  function handleShareClick(): void {
    void handleShare();
  }

  function handleDocumentOutside(event: Event): void {
    if (open && !root.contains(event.target as Node)) setOpen(false);
  }

  function handleKeyDown(event: KeyboardEvent): void {
    if (open && event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
      button.focus();
    }
  }

  const unsubscribeLanguage = store.on((state) => state.ui.lang, render);
  render(store.get().ui.lang);
  button.addEventListener("click", handleButtonClick);
  shareButton.addEventListener("click", handleShareClick);
  document.addEventListener("pointerdown", handleDocumentOutside);
  document.addEventListener("click", handleDocumentOutside);
  document.addEventListener("keydown", handleKeyDown);

  return {
    destroy() {
      if (destroyed) return;
      destroyed = true;
      unsubscribeLanguage();
      languageItem.destroy();
      button.removeEventListener("click", handleButtonClick);
      shareButton.removeEventListener("click", handleShareClick);
      document.removeEventListener("pointerdown", handleDocumentOutside);
      document.removeEventListener("click", handleDocumentOutside);
      document.removeEventListener("keydown", handleKeyDown);
      root.remove();
    },
  };
}

export function mount(
  parent: HTMLElement,
  store: Store<AppState>,
  options: MenuButtonOptions = {},
): { destroy(): void } {
  return mountMenuButton(parent, store, options);
}
