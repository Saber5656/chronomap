import "./onboarding.css";

import { calculatePopoverPlacement, type BoxSize, type SafeAreaInsets } from "./pointPicker";
import type { AppShell } from "./appShell";
import type { AppState } from "../state/appState";
import type { Store } from "../state/store";
import { el } from "../util/dom";
import { t, type I18nKey } from "../ui/i18n";

export const ONBOARDING_STORAGE_KEY = "chronomap.onboarded";
export const ONBOARDING_COMPLETE_VALUE = "1";

const TOTAL_STEPS = 3;
const POPOVER_MARGIN_PX = 12;
const POPOVER_GAP_PX = 12;
const FALLBACK_POPOVER_SIZE: BoxSize = { width: 280, height: 144 };
const DEEP_LINK_KEYS = new Set(["lat", "lng", "z", "year", "l", "op", "poi", "label"]);

type StepId = "slider" | "locate" | "menu";
type AnchorEdge = "top" | "bottom";

interface StepDefinition {
  readonly id: StepId;
  readonly key: Extract<I18nKey, `onboard.${string}`>;
  readonly anchor: AnchorEdge;
  readonly findTarget: (shell: AppShell) => HTMLElement | null;
}

interface OnboardingStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface OnboardingOptions {
  readonly location?: Pick<Location, "pathname" | "search">;
  readonly storage?: OnboardingStorage;
  readonly basePath?: string;
}

export interface OnboardingController {
  destroy(): void;
}

const STEP_DEFINITIONS: readonly StepDefinition[] = [
  {
    id: "slider",
    key: "onboard.slider",
    anchor: "top",
    findTarget: (shell) => shell.getSlot("TimeSlider").querySelector<HTMLElement>(".time-slider"),
  },
  {
    id: "locate",
    key: "onboard.locate",
    anchor: "bottom",
    findTarget: (shell) =>
      shell.getSlot("LocateButton").querySelector<HTMLElement>("button.locate-button"),
  },
  {
    id: "menu",
    key: "onboard.menu",
    anchor: "bottom",
    findTarget: (shell) =>
      shell.getSlot("MenuButton").querySelector<HTMLElement>("button.menu-trigger"),
  },
];

let nextInstanceId = 0;

function noOpController(): OnboardingController {
  return { destroy: () => undefined };
}

function safeStorage(document: Document): OnboardingStorage | undefined {
  try {
    return document.defaultView?.localStorage;
  } catch {
    return undefined;
  }
}

function hasCompleted(storage: OnboardingStorage | undefined): boolean {
  try {
    return storage?.getItem(ONBOARDING_STORAGE_KEY) === ONBOARDING_COMPLETE_VALUE;
  } catch {
    return false;
  }
}

function markCompleted(storage: OnboardingStorage | undefined): void {
  try {
    storage?.setItem(ONBOARDING_STORAGE_KEY, ONBOARDING_COMPLETE_VALUE);
  } catch {
    // Private browsing and restricted iframes may make localStorage unavailable.
  }
}

function normalizedPath(path: string): string {
  const withoutTrailingSlash = path.replace(/\/+$/u, "");
  return withoutTrailingSlash === "" ? "/" : withoutTrailingSlash;
}

function isRootRoute(pathname: string, basePath: string): boolean {
  return normalizedPath(pathname) === normalizedPath(basePath);
}

export function hasDeepLinkParams(search: string): boolean {
  const params = new URLSearchParams(search);
  for (const key of params.keys()) {
    if (DEEP_LINK_KEYS.has(key)) return true;
  }
  return false;
}

function readTarget(step: StepDefinition, shell: AppShell): HTMLElement | null {
  try {
    const target = step.findTarget(shell);
    if (target === null || target.closest("[hidden]") !== null) return null;

    const rect = target.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0 ? target : null;
  } catch {
    return null;
  }
}

function parsePixels(value: string): number {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

function viewportSize(document: Document): BoxSize {
  const view = document.defaultView;
  const visualViewport = view?.visualViewport;
  const documentWidth = document.documentElement.clientWidth;
  const documentHeight = document.documentElement.clientHeight;
  const width = visualViewport?.width || documentWidth || view?.innerWidth || 0;
  const height = visualViewport?.height || documentHeight || view?.innerHeight || 0;
  return {
    width: Math.max(1, width),
    height: Math.max(1, height),
  };
}

function safeArea(document: Document, shell: AppShell, viewport: BoxSize): SafeAreaInsets {
  const view = document.defaultView;
  const controls = shell.getSlot("controls-top");
  const sliderDock = shell.getSlot("slider-dock");
  const controlsStyle = view?.getComputedStyle(controls);
  const sliderStyle = view?.getComputedStyle(sliderDock);
  const sliderRect = sliderDock.getBoundingClientRect();

  return {
    top: Math.max(POPOVER_MARGIN_PX, parsePixels(controlsStyle?.paddingBlockStart ?? "")),
    right: Math.max(POPOVER_MARGIN_PX, parsePixels(sliderStyle?.paddingInlineEnd ?? "")),
    bottom: Math.max(POPOVER_MARGIN_PX, viewport.height - sliderRect.top + POPOVER_MARGIN_PX),
    left: Math.max(POPOVER_MARGIN_PX, parsePixels(sliderStyle?.paddingInlineStart ?? "")),
  };
}

function visibleTargetRect(target: HTMLElement, viewport: BoxSize): DOMRectReadOnly {
  const rect = target.getBoundingClientRect();
  const left = Math.max(0, Math.min(viewport.width, rect.left));
  const top = Math.max(0, Math.min(viewport.height, rect.top));
  const right = Math.max(left, Math.min(viewport.width, rect.right));
  const bottom = Math.max(top, Math.min(viewport.height, rect.bottom));
  return {
    x: left,
    y: top,
    top,
    right,
    bottom,
    left,
    width: right - left,
    height: bottom - top,
    toJSON: () => ({}),
  };
}

function isElementInside(element: EventTarget | null, container: Node): boolean {
  return element instanceof Node && container.contains(element);
}

/** Mount the lazy, first-visit coach onto the already-mounted production shell. */
export function mountOnboarding(
  parent: HTMLElement,
  shell: AppShell,
  store: Store<AppState>,
  options: OnboardingOptions = {},
): OnboardingController {
  const document = parent.ownerDocument;
  const pageLocation = options.location ?? document.defaultView?.location;
  const basePath = options.basePath ?? import.meta.env.BASE_URL;
  const storage = options.storage ?? safeStorage(document);

  if (
    pageLocation === undefined ||
    !isRootRoute(pageLocation.pathname, basePath) ||
    hasDeepLinkParams(pageLocation.search)
  ) {
    if (pageLocation !== undefined && isRootRoute(pageLocation.pathname, basePath)) {
      markCompleted(storage);
    }
    return noOpController();
  }

  if (hasCompleted(storage)) return noOpController();

  const instanceId = nextInstanceId + 1;
  nextInstanceId = instanceId;
  const messageId = `onboarding-message-${instanceId}`;
  const scrims = [
    el("div", { class: "onboarding-scrim", "data-onboarding-scrim": "top" }),
    el("div", { class: "onboarding-scrim", "data-onboarding-scrim": "right" }),
    el("div", { class: "onboarding-scrim", "data-onboarding-scrim": "bottom" }),
    el("div", { class: "onboarding-scrim", "data-onboarding-scrim": "left" }),
  ];
  const progress = el("span", {
    class: "onboarding-progress",
    "aria-hidden": "true",
    "data-onboarding-progress": "true",
  });
  const message = el("p", {
    id: messageId,
    class: "onboarding-message",
    "aria-live": "polite",
    "data-onboarding-message": "true",
  });
  const skipButton = el("button", {
    type: "button",
    class: "onboarding-skip",
    "data-onboarding-skip": "true",
  });
  const nextButton = el("button", {
    type: "button",
    class: "onboarding-next",
    "data-onboarding-next": "true",
  });
  const actions = el("div", { class: "onboarding-actions" }, [skipButton, nextButton]);
  const popover = el(
    "section",
    {
      class: "onboarding-popover",
      "data-onboarding-popover": "true",
      "aria-describedby": messageId,
    },
    [progress, message, actions],
  );
  const root = el(
    "div",
    {
      class: "onboarding-coach",
      role: "dialog",
      "aria-modal": "false",
      "aria-describedby": messageId,
      "data-onboarding-step": "1",
    },
    [...scrims, popover],
  );
  parent.append(root);

  let currentStepIndex = 0;
  let currentTarget: HTMLElement | null = null;
  let destroyed = false;
  let resizeObserver: ResizeObserver | undefined;
  let unsubscribeLanguage: () => void = () => undefined;
  const previousFocus =
    document.activeElement instanceof HTMLElement ? document.activeElement : null;

  function teardown(): void {
    unsubscribeLanguage();
    nextButton.removeEventListener("click", handleNext);
    skipButton.removeEventListener("click", complete);
    document.removeEventListener("pointerdown", handleOutsidePointerDown, true);
    document.removeEventListener("keydown", handleKeyDown);
    view?.removeEventListener("resize", handleViewportChange);
    view?.removeEventListener("scroll", handleViewportChange, true);
    visualViewport?.removeEventListener("resize", handleViewportChange);
    visualViewport?.removeEventListener("scroll", handleViewportChange);
    clearTargetHighlight();
    resizeObserver?.disconnect();
    resizeObserver = undefined;
    root.remove();
  }

  function clearTargetHighlight(): void {
    currentTarget?.classList.remove("onboarding-target");
    currentTarget = null;
    resizeObserver?.disconnect();
  }

  function updateText(step: StepDefinition): void {
    const locale = store.get().ui.lang;
    const label = t(step.key, {}, locale);
    root.setAttribute("aria-label", label);
    message.textContent = label;
    progress.textContent = `${currentStepIndex + 1} / ${TOTAL_STEPS}`;
    skipButton.textContent = t("onboard.skip", {}, locale);
    skipButton.setAttribute("aria-label", t("onboard.skip", {}, locale));
    const nextKey =
      currentStepIndex === STEP_DEFINITIONS.length - 1 ? "onboard.done" : "onboard.next";
    nextButton.textContent = t(nextKey, {}, locale);
    nextButton.setAttribute("aria-label", t(nextKey, {}, locale));
    skipButton.hidden = step.id !== "slider";
    nextButton.dataset.onboardingAction =
      currentStepIndex === STEP_DEFINITIONS.length - 1 ? "done" : "next";
    root.dataset.onboardingStep = String(currentStepIndex + 1);
    root.dataset.onboardingStepId = step.id;
  }

  function findStep(startIndex: number): { index: number; target: HTMLElement } | null {
    for (let index = startIndex; index < STEP_DEFINITIONS.length; index += 1) {
      const step = STEP_DEFINITIONS[index];
      if (step === undefined) continue;
      const target = readTarget(step, shell);
      if (target !== null) return { index, target };
    }
    return null;
  }

  function complete(): void {
    if (destroyed) return;
    markCompleted(storage);
    destroyed = true;
    teardown();
    if (previousFocus !== null && previousFocus.isConnected)
      previousFocus.focus({ preventScroll: true });
  }

  function applyScrim(rect: DOMRectReadOnly, viewport: BoxSize): void {
    const [top, right, bottom, left] = scrims as [
      HTMLDivElement,
      HTMLDivElement,
      HTMLDivElement,
      HTMLDivElement,
    ];
    top.style.left = "0px";
    top.style.top = "0px";
    top.style.width = `${viewport.width}px`;
    top.style.height = `${rect.top}px`;

    right.style.left = `${rect.right}px`;
    right.style.top = `${rect.top}px`;
    right.style.width = `${Math.max(0, viewport.width - rect.right)}px`;
    right.style.height = `${rect.height}px`;

    bottom.style.left = "0px";
    bottom.style.top = `${rect.bottom}px`;
    bottom.style.width = `${viewport.width}px`;
    bottom.style.height = `${Math.max(0, viewport.height - rect.bottom)}px`;

    left.style.left = "0px";
    left.style.top = `${rect.top}px`;
    left.style.width = `${rect.left}px`;
    left.style.height = `${rect.height}px`;
  }

  function renderPosition(): void {
    if (destroyed || currentTarget === null) return;
    const step = STEP_DEFINITIONS[currentStepIndex];
    if (step === undefined) {
      complete();
      return;
    }
    const viewport = viewportSize(document);
    const rect = visibleTargetRect(currentTarget, viewport);
    if (rect.width <= 0 || rect.height <= 0) {
      clearTargetHighlight();
      showStep(currentStepIndex + 1);
      return;
    }

    root.style.width = `${viewport.width}px`;
    root.style.height = `${viewport.height}px`;
    applyScrim(rect, viewport);

    const popoverRect = popover.getBoundingClientRect();
    const popoverSize: BoxSize = {
      width: popoverRect.width || FALLBACK_POPOVER_SIZE.width,
      height: popoverRect.height || FALLBACK_POPOVER_SIZE.height,
    };
    const anchor = {
      x: rect.left + rect.width / 2,
      y: step.anchor === "top" ? rect.top : rect.bottom,
    };
    const placement = calculatePopoverPlacement(
      anchor,
      popoverSize,
      viewport,
      safeArea(document, shell, viewport),
      POPOVER_GAP_PX,
    );
    popover.style.left = `${placement.left}px`;
    popover.style.top = `${placement.top}px`;
    popover.dataset.placement = placement.side;
  }

  function observeTarget(target: HTMLElement): void {
    resizeObserver?.disconnect();
    if (typeof ResizeObserver !== "function") return;
    resizeObserver = new ResizeObserver(renderPosition);
    resizeObserver.observe(target);
  }

  function focusNext(): void {
    nextButton.focus({ preventScroll: true });
  }

  function showStep(startIndex: number): void {
    if (destroyed) return;
    const next = findStep(startIndex);
    if (next === null) {
      complete();
      return;
    }

    clearTargetHighlight();
    currentStepIndex = next.index;
    currentTarget = next.target;
    currentTarget.classList.add("onboarding-target");
    updateText(STEP_DEFINITIONS[currentStepIndex] as StepDefinition);
    observeTarget(currentTarget);
    renderPosition();
    focusNext();
  }

  function refreshStep(): void {
    if (destroyed) return;
    const step = STEP_DEFINITIONS[currentStepIndex];
    const target = step === undefined ? null : readTarget(step, shell);
    if (target === null) {
      clearTargetHighlight();
      showStep(currentStepIndex + 1);
      return;
    }
    if (target !== currentTarget) {
      clearTargetHighlight();
      currentTarget = target;
      currentTarget.classList.add("onboarding-target");
      observeTarget(currentTarget);
    }
    renderPosition();
  }

  function handleNext(): void {
    if (currentStepIndex >= STEP_DEFINITIONS.length - 1) {
      complete();
      return;
    }
    showStep(currentStepIndex + 1);
  }

  function handleOutsidePointerDown(event: PointerEvent): void {
    if (destroyed) return;
    if (
      isElementInside(event.target, root) ||
      (currentTarget !== null && isElementInside(event.target, currentTarget))
    ) {
      return;
    }
    // The scrim intentionally has pointer-events:none, so the map receives the same pointer
    // sequence after this capture listener dismisses the coach.
    complete();
  }

  function handleKeyDown(event: KeyboardEvent): void {
    if (destroyed || event.key !== "Escape") return;
    event.preventDefault();
    complete();
  }

  function handleViewportChange(): void {
    refreshStep();
  }

  const view = document.defaultView;
  const visualViewport = view?.visualViewport;
  unsubscribeLanguage = store.on(
    (state) => state.ui.lang,
    (next: AppState["ui"]["lang"]) => {
      const step = STEP_DEFINITIONS[currentStepIndex];
      if (step === undefined) return;
      updateText(step);
      renderPosition();
      void next;
    },
  );

  nextButton.addEventListener("click", handleNext);
  skipButton.addEventListener("click", complete);
  document.addEventListener("pointerdown", handleOutsidePointerDown, true);
  document.addEventListener("keydown", handleKeyDown);
  view?.addEventListener("resize", handleViewportChange);
  view?.addEventListener("scroll", handleViewportChange, true);
  visualViewport?.addEventListener("resize", handleViewportChange);
  visualViewport?.addEventListener("scroll", handleViewportChange);

  showStep(0);

  return {
    destroy() {
      if (destroyed) return;
      destroyed = true;
      teardown();
    },
  };
}
