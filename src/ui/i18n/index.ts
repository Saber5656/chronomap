import enStrings from "./strings.en.json";
import jaStrings from "./strings.ja.json";
import { formatDistance as formatDistanceValue } from "./formatDistance";
import { createActions } from "../../state/actions";
import type { AppState } from "../../state/appState";
import type { Store } from "../../state/store";

export const LOCALES = ["ja", "en"] as const;
export type Locale = (typeof LOCALES)[number];
export type I18nKey = keyof typeof jaStrings;
export type InterpolationVars = Record<string, string | number>;
export const LANG_STORAGE_KEY = "chronomap.lang";
const strings: Record<Locale, Record<I18nKey, string>> = { ja: jaStrings, en: enStrings };
let currentLocale: Locale = "ja";
let activeUnsubscribe: (() => void) | undefined;
function storedLocale(): Locale | null {
  try {
    const value = localStorage.getItem(LANG_STORAGE_KEY);
    return value === "ja" || value === "en" ? value : null;
  } catch {
    return null;
  }
}
function syncLocale(locale: Locale): void {
  currentLocale = locale;
  try {
    localStorage.setItem(LANG_STORAGE_KEY, locale);
  } catch {
    /* Storage can be unavailable in private browsing or a restricted iframe. */
  }
  if (typeof document !== "undefined") document.documentElement.lang = locale;
}
export function detectLocale(): Locale {
  const stored = storedLocale();
  return (
    stored ??
    (typeof navigator !== "undefined" && navigator.language.startsWith("ja") ? "ja" : "en")
  );
}
function interpolate(value: string, vars?: InterpolationVars): string {
  return value.replace(/\{(\w+)\}/g, (token, name: string) => {
    if (vars?.[name] === undefined) return token;
    return String(vars[name]);
  });
}
export function t(key: I18nKey, vars?: InterpolationVars, locale: Locale = currentLocale): string {
  const value = strings[locale][key];
  if (value === undefined) {
    if (import.meta.env.DEV) console.warn(`Missing i18n key: ${String(key)}`);
    return String(key);
  }
  return interpolate(value, vars);
}
export type LangChangeListener = (next: Locale, previous: Locale) => void;
export function onLangChange(store: Store<AppState>, listener: LangChangeListener): () => void {
  return store.on(
    (state) => state.ui.lang,
    (next, previous) => {
      syncLocale(next);
      listener(next, previous);
    },
  );
}
export type I18nController = { destroy(): void };
export function initI18n(store: Store<AppState>): I18nController {
  activeUnsubscribe?.();
  const actions = createActions(store);
  const initial = detectLocale();
  syncLocale(initial);
  actions.setLang(initial);
  const unsubscribe = onLangChange(store, () => undefined);
  activeUnsubscribe = unsubscribe;
  return {
    destroy: () => {
      unsubscribe();
      if (activeUnsubscribe === unsubscribe) activeUnsubscribe = undefined;
    },
  };
}
export interface LanguageToggleBinding {
  readonly key: "menu.lang";
  getLabel(): string;
  getLocale(): Locale;
  setLocale(locale: Locale): void;
  toggle(): Locale;
}
export function bindLanguageToggle(store: Store<AppState>): LanguageToggleBinding {
  const actions = createActions(store);
  const setLocale = (locale: Locale) => {
    actions.setLang(locale);
    syncLocale(locale);
  };
  return {
    key: "menu.lang",
    getLabel: () => t("menu.lang"),
    getLocale: () => store.get().ui.lang,
    setLocale,
    toggle: () => {
      const next = store.get().ui.lang === "ja" ? "en" : "ja";
      setLocale(next);
      return next;
    },
  };
}
export const createLanguageToggle = bindLanguageToggle;
export function formatDistance(meters: number, locale: Locale = currentLocale): string {
  return formatDistanceValue(meters, locale);
}
