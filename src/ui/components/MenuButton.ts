import { bindLanguageToggle, onLangChange } from "../i18n";
import type { AppState } from "../../state/appState";
import type { Store } from "../../state/store";
import { el } from "../../util/dom";

export interface LanguageToggleItem {
  readonly element: HTMLButtonElement;
  destroy(): void;
}

/**
 * Create the language item independently so the later full MenuButton can append this same item
 * without reimplementing locale persistence or the language-change subscription.
 */
export function createLanguageToggleItem(store: Store<AppState>): LanguageToggleItem {
  const binding = bindLanguageToggle(store);
  const label = binding.getLabel();
  const button = el(
    "button",
    {
      type: "button",
      class: "menu-language-toggle",
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

export interface MenuButtonController {
  destroy(): void;
}

/** Mount only the language item; share/import actions belong to their owning issues. */
export function mountMenuButton(parent: HTMLElement, store: Store<AppState>): MenuButtonController {
  const languageItem = createLanguageToggleItem(store);
  parent.append(languageItem.element);

  return {
    destroy() {
      languageItem.destroy();
    },
  };
}
