export const RASTER_CROSSFADE_DURATION_MS = 250;

export interface OverlayTransitionState {
  readonly from: number;
  readonly target: number;
  readonly startedAt: number;
  readonly durationMs: number;
}

export interface OverlayTransitionFrame {
  readonly opacity: number;
  readonly progress: number;
  readonly done: boolean;
}

export interface OverlayTransitionScheduler {
  requestAnimationFrame(callback: (timestamp: number) => void): number;
  cancelAnimationFrame(handle: number): void;
  now(): number;
}

export interface OverlayTransitionHandle {
  cancel(): void;
}

export interface RunOverlayTransitionOptions {
  readonly from: number;
  readonly target: number;
  readonly startedAt: number;
  readonly durationMs?: number;
  readonly scheduler: OverlayTransitionScheduler;
  readonly onFrame: (opacity: number, frame: OverlayTransitionFrame) => void;
  readonly onComplete: () => void;
}

function clampUnit(value: number): number {
  return Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));
}

/**
 * Evaluate one frame of the opacity transition without touching a clock, DOM, or map.
 * The cubic ease-out keeps the historical layer visible quickly while still avoiding a pop.
 */
export function overlayTransitionFrame(
  state: OverlayTransitionState,
  timestamp: number,
): OverlayTransitionFrame {
  const duration = Math.max(0, state.durationMs);
  const elapsed = Math.max(0, timestamp - state.startedAt);
  const progress = duration === 0 ? 1 : Math.min(1, elapsed / duration);
  const eased = 1 - (1 - progress) ** 3;
  const from = clampUnit(state.from);
  const target = clampUnit(state.target);

  return {
    opacity: from + (target - from) * eased,
    progress,
    done: progress >= 1,
  };
}

/**
 * Run the pure frame function on an injected scheduler. Cancelling is idempotent and prevents
 * both future rAF callbacks and the completion callback from reaching the map.
 */
export function runOverlayTransition(
  options: RunOverlayTransitionOptions,
): OverlayTransitionHandle {
  const state: OverlayTransitionState = {
    from: clampUnit(options.from),
    target: clampUnit(options.target),
    startedAt: options.startedAt,
    durationMs: options.durationMs ?? RASTER_CROSSFADE_DURATION_MS,
  };
  let cancelled = false;
  let frameHandle: number | null = null;

  const frame = (timestamp: number): void => {
    frameHandle = null;
    if (cancelled) return;

    const result = overlayTransitionFrame(state, timestamp);
    options.onFrame(result.opacity, result);
    if (result.done) {
      options.onComplete();
      return;
    }

    frameHandle = options.scheduler.requestAnimationFrame(frame);
  };

  frameHandle = options.scheduler.requestAnimationFrame(frame);

  return {
    cancel() {
      if (cancelled) return;
      cancelled = true;
      if (frameHandle !== null) {
        options.scheduler.cancelAnimationFrame(frameHandle);
        frameHandle = null;
      }
    },
  };
}
