import { describe, expect, it } from "vitest";

import {
  overlayTransitionFrame,
  runOverlayTransition,
  type OverlayTransitionScheduler,
} from "../../../src/map/overlayTransition";

class FakeAnimationFrame implements OverlayTransitionScheduler {
  private nextHandle = 1;
  private readonly callbacks = new Map<number, (timestamp: number) => void>();
  private currentTime = 0;

  requestAnimationFrame(callback: (timestamp: number) => void): number {
    const handle = this.nextHandle;
    this.nextHandle += 1;
    this.callbacks.set(handle, callback);
    return handle;
  }

  cancelAnimationFrame(handle: number): void {
    this.callbacks.delete(handle);
  }

  now(): number {
    return this.currentTime;
  }

  pendingCount(): number {
    return this.callbacks.size;
  }

  flush(timestamp: number): void {
    this.currentTime = timestamp;
    const next = this.callbacks.entries().next();
    if (next.done) return;
    this.callbacks.delete(next.value[0]);
    next.value[1](timestamp);
  }
}

describe("overlay transition", () => {
  it("evaluates a cubic ease-out from idle start to the target", () => {
    const state = { from: 0, target: 0.8, startedAt: 100, durationMs: 250 };

    expect(overlayTransitionFrame(state, 100)).toEqual({
      opacity: 0,
      progress: 0,
      done: false,
    });
    expect(overlayTransitionFrame(state, 225)).toMatchObject({ progress: 0.5, done: false });
    expect(overlayTransitionFrame(state, 225).opacity).toBeCloseTo(0.7);
    expect(overlayTransitionFrame(state, 350)).toEqual({
      opacity: 0.8,
      progress: 1,
      done: true,
    });
  });

  it("runs idle → fading → idle with fake rAF", () => {
    const scheduler = new FakeAnimationFrame();
    const frames: number[] = [];
    let completed = 0;
    const transition = runOverlayTransition({
      from: 0,
      target: 1,
      startedAt: scheduler.now(),
      scheduler,
      onFrame: (opacity) => frames.push(opacity),
      onComplete: () => {
        completed += 1;
      },
    });

    expect(scheduler.pendingCount()).toBe(1);
    scheduler.flush(0);
    scheduler.flush(125);
    expect(frames[0]).toBe(0);
    expect(frames[1]).toBeGreaterThan(0.5);
    expect(frames[1]).toBeLessThan(1);
    expect(completed).toBe(0);
    expect(scheduler.pendingCount()).toBe(1);

    scheduler.flush(250);
    expect(frames.at(-1)).toBe(1);
    expect(completed).toBe(1);
    expect(scheduler.pendingCount()).toBe(0);

    transition.cancel();
    expect(completed).toBe(1);
  });

  it("cancels a superseded transition without running a stale callback", () => {
    const scheduler = new FakeAnimationFrame();
    let firstCompleted = 0;
    const first = runOverlayTransition({
      from: 0,
      target: 1,
      startedAt: 0,
      scheduler,
      onFrame: () => undefined,
      onComplete: () => {
        firstCompleted += 1;
      },
    });

    first.cancel();
    scheduler.flush(250);

    expect(firstCompleted).toBe(0);
    expect(scheduler.pendingCount()).toBe(0);
  });
});
