import { parseSharedLocation, type ParseResult } from "../../integrations/parseSharedLocation";
import { createActions } from "../../state/actions";
import type { AppState, ImportFailureReason } from "../../state/appState";
import type { Store } from "../../state/store";
import { el } from "../../util/dom";
import { onLangChange, t, type I18nKey, type Locale } from "../i18n";
import type { SheetContentController } from "./BottomSheet";

const INPUT_LENGTH_LIMIT = 4_096;

const GUIDANCE_KEYS: Record<ImportFailureReason, I18nKey> = {
  shortlink: "import.err.shortlink",
  "no-coords": "import.err.nocoords",
  invalid: "import.err.invalid",
};

export interface ImportSheetOptions {
  readonly parseLocation?: (raw: string) => ParseResult;
  readonly onLocationOpened?: (result: Extract<ParseResult, { ok: true }>) => void;
}

export type ImportSheetController = SheetContentController;

/** Whether a keyboard event should submit the import form instead of inserting a newline. */
export function shouldSubmitImportKey(
  event: Pick<KeyboardEvent, "key" | "shiftKey" | "isComposing" | "keyCode">,
): boolean {
  return event.key === "Enter" && !event.shiftKey && !event.isComposing && event.keyCode !== 229;
}

function clipboardReader(ownerDocument: Document): (() => Promise<string>) | null {
  try {
    const clipboard = ownerDocument.defaultView?.navigator.clipboard;
    if (clipboard === undefined || typeof clipboard.readText !== "function") return null;
    return () => clipboard.readText();
  } catch {
    return null;
  }
}

function requestFor(store: Store<AppState>): NonNullable<AppState["ui"]["importRequest"]> {
  return (
    store.get().ui.importRequest ?? {
      prefill: "",
      reason: null,
      autofocus: true,
    }
  );
}

/** Mount the offline-capable URL/coordinate import form inside the BottomSheet host. */
export function mount(
  parent: HTMLElement,
  store: Store<AppState>,
  options: ImportSheetOptions = {},
): ImportSheetController {
  const ownerDocument = parent.ownerDocument;
  const actions = createActions(store);
  const root = el("form", { class: "import-sheet", novalidate: "true" });
  const label = el("label", { class: "import-sheet__label", for: "chronomap-import-input" });
  const input = el("textarea", {
    id: "chronomap-import-input",
    class: "import-sheet__input",
    rows: 3,
    maxlength: INPUT_LENGTH_LIMIT,
    autocomplete: "off",
    spellcheck: "false",
    "aria-describedby": "chronomap-import-guidance",
  });
  const guidance = el("div", {
    id: "chronomap-import-guidance",
    class: "import-sheet__guidance",
    role: "alert",
    hidden: true,
  });
  const controls = el("div", { class: "import-sheet__actions" });
  const pasteButton = el("button", {
    type: "button",
    class: "import-sheet__paste",
    "data-import-action": "paste",
  });
  const submitButton = el(
    "button",
    {
      type: "submit",
      class: "import-sheet__submit",
      "data-import-action": "open",
    },
    "",
  );
  const readClipboard = clipboardReader(ownerDocument);
  const parseLocation = options.parseLocation ?? parseSharedLocation;
  let guidanceReason: ImportFailureReason | null = requestFor(store).reason;
  let destroyed = false;

  controls.append(pasteButton, submitButton);
  root.append(label, input, guidance, controls);
  parent.append(root);

  function locale(): Locale {
    return store.get().ui.lang;
  }

  function render(): void {
    if (destroyed) return;
    const currentLocale = locale();
    label.textContent = t("import.inputLabel", {}, currentLocale);
    input.placeholder = t("import.placeholder", {}, currentLocale);
    input.setAttribute("aria-label", t("import.inputLabel", {}, currentLocale));
    pasteButton.textContent = t("import.paste", {}, currentLocale);
    submitButton.textContent = t("import.open", {}, currentLocale);
    guidance.hidden = guidanceReason === null;
    guidance.textContent =
      guidanceReason === null ? "" : t(GUIDANCE_KEYS[guidanceReason], {}, currentLocale);
  }

  function showGuidance(reason: ImportFailureReason): void {
    guidanceReason = reason;
    render();
  }

  function submit(): void {
    const result = parseLocation(input.value);
    if (!result.ok) {
      showGuidance(result.reason);
      return;
    }

    const openedView = { lat: result.lat, lng: result.lng, zoom: result.zoom ?? 16 };
    actions.closeSheet();
    actions.setView(openedView);
    options.onLocationOpened?.(result);
    actions.showToast("info", t("import.opened", {}, locale()));
  }

  function handleSubmit(event: Event): void {
    event.preventDefault();
    submit();
  }

  function handleKeyDown(event: KeyboardEvent): void {
    if (!shouldSubmitImportKey(event)) return;
    event.preventDefault();
    submit();
  }

  async function handlePaste(): Promise<void> {
    if (readClipboard === null) return;
    try {
      input.value = (await readClipboard()).slice(0, INPUT_LENGTH_LIMIT);
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.focus({ preventScroll: true });
    } catch {
      // Clipboard permission failures intentionally fall back to manual paste with no toast.
    }
  }

  function handlePasteClick(): void {
    void handlePaste();
  }

  input.value = requestFor(store).prefill.slice(0, INPUT_LENGTH_LIMIT);
  pasteButton.hidden = readClipboard === null;
  root.addEventListener("submit", handleSubmit);
  input.addEventListener("keydown", handleKeyDown);
  pasteButton.addEventListener("click", handlePasteClick);
  const unsubscribeLanguage = onLangChange(store, render);
  render();

  return {
    focus() {
      input.focus({ preventScroll: true });
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      unsubscribeLanguage();
      root.removeEventListener("submit", handleSubmit);
      input.removeEventListener("keydown", handleKeyDown);
      pasteButton.removeEventListener("click", handlePasteClick);
      root.remove();
    },
  };
}
