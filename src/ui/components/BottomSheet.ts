import { createActions } from "../../state/actions";
import type { AppState } from "../../state/appState";
import type { Store } from "../../state/store";
import { el } from "../../util/dom";
import { t, type I18nKey, type Locale } from "../i18n";

export type SheetKind = Exclude<AppState["ui"]["sheet"], "none">;

export interface SheetContentController {
  destroy(): void;
  /** Focus the content's primary control when the sheet was opened by user action. */
  focus?(): void;
}

export type SheetRenderer = (parent: HTMLElement, store: Store<AppState>) => SheetContentController;

export interface BottomSheetOptions {
  readonly renderers?: Partial<Record<SheetKind, SheetRenderer>>;
  readonly history?: Pick<History, "state" | "replaceState" | "pushState" | "back">;
  readonly location?: Pick<Location, "href">;
  readonly document?: Document;
}

export interface BottomSheetController {
  destroy(): void;
}

const SWIPE_CLOSE_DISTANCE_PX = 72;
const SHEET_HISTORY_MARKER = "__chronomapSheetCheckpoint";
const FOCUSABLE_SELECTOR =
  "a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex='-1'])";
const SHEET_TITLES: Record<SheetKind, I18nKey> = {
  layers: "layers.title",
  poi: "poi.aria",
  about: "menu.about",
  import: "menu.import",
};

type HistoryStateRecord = Record<string, unknown>;

function historyRecord(value: unknown): HistoryStateRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? { ...(value as HistoryStateRecord) }
    : {};
}

function comingSoonRenderer(kind: SheetKind): SheetRenderer {
  return (parent, store) => {
    const root = el("div", { class: "bottom-sheet__stub", "data-sheet-stub": kind });
    parent.append(root);

    function render(): void {
      const locale: Locale = store.get().ui.lang;
      root.textContent = `${t(SHEET_TITLES[kind], {}, locale)} — ${t("common.comingSoon", {}, locale)}`;
    }

    const unsubscribe = store.on((state) => state.ui.lang, render);
    render();
    return {
      destroy() {
        unsubscribe();
        root.remove();
      },
    };
  };
}

/** Create an explicit future-safe renderer for a sheet owned by a later issue. */
export function createSheetStub(kind: SheetKind): SheetRenderer {
  return comingSoonRenderer(kind);
}

/** Host registered sheets with one dialog, one history checkpoint, and a focus trap. */
export function mount(
  parent: HTMLElement,
  store: Store<AppState>,
  options: BottomSheetOptions = {},
): BottomSheetController {
  const ownerDocument = options.document ?? parent.ownerDocument;
  const pageHistory = options.history ?? ownerDocument.defaultView?.history;
  const pageLocation = options.location ?? ownerDocument.defaultView?.location;
  const actions = createActions(store);
  const renderers = options.renderers ?? {};

  let destroyed = false;
  let currentKind: SheetKind | null = null;
  let layer: HTMLDivElement | null = null;
  let dialog: HTMLElement | null = null;
  let titleElement: HTMLElement | null = null;
  let closeButton: HTMLButtonElement | null = null;
  let dragHandle: HTMLElement | null = null;
  let contentController: SheetContentController | null = null;
  let opener: HTMLElement | null = null;
  let ownsHistoryEntry = false;
  let handlingPopState = false;
  let dragPointerId: number | null = null;
  let dragStartY = 0;

  function writeHistory(
    method: "replaceState" | "pushState",
    sheet: SheetKind | "none",
    checkpoint: boolean,
  ): void {
    if (pageHistory === undefined) return;
    const state = {
      ...historyRecord(pageHistory.state),
      sheet,
      [SHEET_HISTORY_MARKER]: checkpoint,
    };
    const url = pageLocation?.href;
    if (url === undefined) pageHistory[method](state, "");
    else pageHistory[method](state, "", url);
  }

  function hasCheckpoint(): boolean {
    return historyRecord(pageHistory?.state)[SHEET_HISTORY_MARKER] === true;
  }

  function openHistory(kind: SheetKind, previous: AppState["ui"]["sheet"]): void {
    if (pageHistory === undefined) return;

    if (previous !== "none" || hasCheckpoint() || ownsHistoryEntry) {
      writeHistory("replaceState", kind, true);
      ownsHistoryEntry = ownsHistoryEntry || hasCheckpoint();
      return;
    }

    // Keep one same-document entry available for Android back. Subsequent sheet changes
    // replace this checkpoint, so a sheet stack never grows with every transition.
    writeHistory("replaceState", "none", false);
    writeHistory("pushState", kind, true);
    ownsHistoryEntry = true;
  }

  function closeHistory(): void {
    const shouldGoBack = ownsHistoryEntry && pageHistory !== undefined;
    ownsHistoryEntry = false;
    if (handlingPopState) return;
    if (shouldGoBack) {
      try {
        pageHistory.back();
        return;
      } catch {
        // A restricted history implementation can still close the visual sheet.
      }
    }
    writeHistory("replaceState", "none", false);
  }

  function focusTargets(): HTMLElement[] {
    if (dialog === null) return [];
    return [...dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)].filter(
      (element) => !element.hidden && element.getAttribute("aria-hidden") !== "true",
    );
  }

  function focusFirst(): void {
    const first = focusTargets()[0] ?? closeButton ?? dialog;
    first?.focus();
  }

  function focusOpener(): void {
    const element = opener;
    opener = null;
    if (element !== null && element.isConnected && !element.hidden) element.focus();
  }

  function closeRequested(): void {
    if (store.get().ui.sheet !== "none") actions.closeSheet();
  }

  function handleKeyDown(event: KeyboardEvent): void {
    if (dialog === null) return;
    if (event.key === "Escape") {
      event.preventDefault();
      closeRequested();
      return;
    }
    if (event.key !== "Tab") return;

    const targets = focusTargets();
    if (targets.length === 0) {
      event.preventDefault();
      focusFirst();
      return;
    }
    const first = targets[0]!;
    const last = targets[targets.length - 1]!;
    const active = ownerDocument.activeElement;
    if (event.shiftKey && active === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function handleFocusIn(event: FocusEvent): void {
    if (dialog === null || dialog.contains(event.target as Node)) return;
    focusFirst();
  }

  function handleBackdropPointerDown(event: PointerEvent): void {
    if (event.target === layer?.querySelector(".bottom-sheet__backdrop")) closeRequested();
  }

  function handleDragStart(event: PointerEvent): void {
    if (dialog === null || event.isPrimary === false) return;
    dragPointerId = event.pointerId;
    dragStartY = event.clientY;
    dialog.dataset.dragging = "true";
    dragHandle?.setPointerCapture?.(event.pointerId);
  }

  function handleDragMove(event: PointerEvent): void {
    if (dragPointerId !== event.pointerId || dialog === null) return;
    const offset = Math.max(0, event.clientY - dragStartY);
    dialog.style.transform = `translateY(${offset}px)`;
  }

  function handleDragEnd(event: PointerEvent): void {
    if (dragPointerId !== event.pointerId || dialog === null) return;
    const offset = Math.max(0, event.clientY - dragStartY);
    dragPointerId = null;
    dialog.dataset.dragging = "false";
    dialog.style.transform = "";
    if (offset >= SWIPE_CLOSE_DISTANCE_PX) closeRequested();
  }

  function removeCurrentSheet(restoreFocus: boolean): void {
    contentController?.destroy();
    contentController = null;
    if (dragHandle !== null) {
      dragHandle.removeEventListener("pointerdown", handleDragStart);
      dragHandle.removeEventListener("pointermove", handleDragMove);
      dragHandle.removeEventListener("pointerup", handleDragEnd);
      dragHandle.removeEventListener("pointercancel", handleDragEnd);
    }
    layer?.removeEventListener("pointerdown", handleBackdropPointerDown);
    layer?.remove();
    layer = null;
    dialog = null;
    titleElement = null;
    closeButton = null;
    dragHandle = null;
    currentKind = null;
    if (restoreFocus) focusOpener();
  }

  function renderChrome(): void {
    if (dialog === null || closeButton === null || currentKind === null) return;
    const locale: Locale = store.get().ui.lang;
    titleElement?.replaceChildren(
      ownerDocument.createTextNode(t(SHEET_TITLES[currentKind], {}, locale)),
    );
    closeButton.setAttribute("aria-label", t("common.close", {}, locale));
  }

  function renderSheet(kind: SheetKind, shouldFocus: boolean): void {
    removeCurrentSheet(false);
    currentKind = kind;
    const locale: Locale = store.get().ui.lang;
    const titleId = `chronomap-sheet-title-${kind}`;
    const nextLayer = el("div", { class: "bottom-sheet-layer" });
    const backdrop = el("div", {
      class: "bottom-sheet__backdrop",
      "aria-hidden": "true",
    });
    const nextDialog = el("section", {
      class: "bottom-sheet",
      role: "dialog",
      "aria-modal": "true",
      "aria-labelledby": titleId,
      tabindex: "-1",
    });
    const nextHandle = el("div", {
      class: "bottom-sheet__handle",
      "aria-hidden": "true",
    });
    const header = el("header", { class: "bottom-sheet__header" });
    const title = el(
      "h2",
      { id: titleId, class: "bottom-sheet__title" },
      t(SHEET_TITLES[kind], {}, locale),
    );
    const nextCloseButton = el(
      "button",
      {
        type: "button",
        class: "bottom-sheet__close",
        "aria-label": t("common.close", {}, locale),
      },
      "×",
    );
    const nextContent = el("div", { class: "bottom-sheet__content" });
    header.append(title, nextCloseButton);
    nextDialog.append(nextHandle, header, nextContent);
    nextLayer.append(backdrop, nextDialog);
    parent.append(nextLayer);

    layer = nextLayer;
    dialog = nextDialog;
    titleElement = title;
    closeButton = nextCloseButton;
    dragHandle = nextHandle;
    contentController = (renderers[kind] ?? comingSoonRenderer(kind))(nextContent, store);

    nextCloseButton.addEventListener("click", closeRequested);
    nextHandle.addEventListener("pointerdown", handleDragStart);
    nextHandle.addEventListener("pointermove", handleDragMove);
    nextHandle.addEventListener("pointerup", handleDragEnd);
    nextHandle.addEventListener("pointercancel", handleDragEnd);
    nextLayer.addEventListener("pointerdown", handleBackdropPointerDown);
    renderChrome();
    if (shouldFocus) {
      if (contentController?.focus === undefined) focusFirst();
      else contentController.focus();
    }
  }

  function handleSheetChange(
    next: AppState["ui"]["sheet"],
    previous: AppState["ui"]["sheet"],
  ): void {
    if (destroyed) return;
    if (next === "none") {
      if (previous !== "none") closeHistory();
      removeCurrentSheet(true);
      return;
    }

    if (previous === "none") {
      const active = ownerDocument.activeElement;
      opener = active instanceof HTMLElement ? active : null;
    }
    openHistory(next, previous);
    const shouldFocus = next !== "import" || store.get().ui.importRequest?.autofocus !== false;
    renderSheet(next, shouldFocus);
  }

  function handleLanguageChange(): void {
    renderChrome();
  }

  function handlePopState(): void {
    if (store.get().ui.sheet === "none") return;
    handlingPopState = true;
    ownsHistoryEntry = false;
    actions.closeSheet();
    handlingPopState = false;
  }

  const unsubscribeSheet = store.on((state) => state.ui.sheet, handleSheetChange);
  const unsubscribeLanguage = store.on((state) => state.ui.lang, handleLanguageChange);
  ownerDocument.addEventListener("keydown", handleKeyDown);
  ownerDocument.addEventListener("focusin", handleFocusIn);
  ownerDocument.defaultView?.addEventListener("popstate", handlePopState);

  const initialSheet = store.get().ui.sheet;
  if (initialSheet !== "none") handleSheetChange(initialSheet, "none");

  return {
    destroy() {
      if (destroyed) return;
      destroyed = true;
      unsubscribeSheet();
      unsubscribeLanguage();
      ownerDocument.removeEventListener("keydown", handleKeyDown);
      ownerDocument.removeEventListener("focusin", handleFocusIn);
      ownerDocument.defaultView?.removeEventListener("popstate", handlePopState);
      removeCurrentSheet(false);
      opener = null;
    },
  };
}
