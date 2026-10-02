// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, expect, it } from "vitest";

import {
  DURATIONS,
  RESET_MS,
  SHOWN_MAX,
  SHOWN_MIN,
  SIZE_MAX,
  SIZE_MIN,
  ZOOM_MAX,
  ZOOM_MIN,
  clampMinutes,
  clampRun,
  clampZoom,
  halt,
  isRunning,
  newRun,
  passed,
  resume,
  remainingSeconds,
  reset,
  resetting,
  shownSize,
  sizeFor,
  splitMinutes,
  stepMinutes,
  turn,
  zoomFor,
} from "../src/app/timer.ts";

const T0 = Date.UTC(2026, 2, 2, 9, 0, 0);
const MIN = 60_000;

describe("the lengths on offer", () => {
  it("run from a minute to two hours, each longer than the last", () => {
    expect(DURATIONS[0]).toBe(1);
    expect(DURATIONS[DURATIONS.length - 1]).toBe(120);
    for (let i = 1; i < DURATIONS.length; i++) {
      expect(DURATIONS[i]!).toBeGreaterThan(DURATIONS[i - 1]!);
    }
  });

  it("are what any value is clamped to, and stepped along", () => {
    expect(clampMinutes(5)).toBe(5);
    expect(clampMinutes(11)).toBe(10);
    expect(clampMinutes(13)).toBe(15);
    expect(clampMinutes(1000)).toBe(120);
    expect(clampMinutes(-3)).toBe(1);
    expect(clampMinutes("x")).toBe(5);
    expect(stepMinutes(10, 1)).toBe(15);
    expect(stepMinutes(10, -1)).toBe(9);
    expect(stepMinutes(120, 1)).toBe(120);
    expect(stepMinutes(1, -5)).toBe(1);
  });

  it("size the glass from under half the room to all of it", () => {
    expect(sizeFor(1)).toBe(SIZE_MIN);
    expect(sizeFor(120)).toBe(SIZE_MAX);
    let last = 0;
    for (const m of DURATIONS) {
      expect(sizeFor(m)).toBeGreaterThan(last);
      last = sizeFor(m);
    }
    expect(splitMinutes(90)).toEqual({ hours: 1, minutes: 30 });
    expect(splitMinutes(5)).toEqual({ hours: 0, minutes: 5 });
  });
});

describe("a run", () => {
  it("starts with all the sand in the lower bulb and no clock", () => {
    const run = newRun(5);
    expect(run).toEqual({ minutes: 5, fraction: 1, startedAt: null });
    expect(passed(run, T0)).toBe(1);
    expect(isRunning(run, T0)).toBe(false);
    expect(remainingSeconds(run, T0)).toBe(0);
  });

  it("turned over, runs out in exactly its length", () => {
    const run = turn(newRun(5), T0);
    expect(passed(run, T0)).toBe(0);
    expect(isRunning(run, T0)).toBe(true);
    expect(passed(run, T0 + 2.5 * MIN)).toBeCloseTo(0.5, 9);
    expect(remainingSeconds(run, T0 + 2.5 * MIN)).toBeCloseTo(150, 9);
    expect(passed(run, T0 + 5 * MIN)).toBe(1);
    expect(isRunning(run, T0 + 5 * MIN)).toBe(false);
    // And never past the end, however long it is left.
    expect(passed(run, T0 + 60 * MIN)).toBe(1);
  });

  it("turned part way, runs back for the time that had passed", () => {
    const run = turn(newRun(10), T0);
    const back = turn(run, T0 + 3 * MIN);
    expect(back.fraction).toBeCloseTo(0.7, 9);
    expect(back.startedAt).toBe(T0 + 3 * MIN);
    // Three minutes of sand is on top now, so it runs out in three.
    expect(passed(back, T0 + 6 * MIN)).toBe(1);
    expect(passed(back, T0 + 4.5 * MIN)).toBeCloseTo(0.85, 9);
  });

  it("halted, keeps where it stood and stops the clock", () => {
    const run = turn(newRun(4), T0);
    const stopped = halt(run, T0 + MIN);
    expect(stopped).toEqual({ minutes: 4, fraction: 0.25, startedAt: null });
    expect(passed(stopped, T0 + 100 * MIN)).toBe(0.25);
  });

  it("is read from the wall clock, so a sleep changes nothing", () => {
    const run = turn(newRun(30), T0);
    // The phone slept for an hour; the glass ran out in the meantime.
    expect(passed(run, T0 + 60 * MIN)).toBe(1);
    expect(passed(run, T0 + 15 * MIN)).toBeCloseTo(0.5, 9);
  });
});

describe("a stored run", () => {
  it("keeps what is readable and falls back to a new glass", () => {
    expect(clampRun({ minutes: 15, fraction: 0.4, startedAt: T0 })).toEqual({
      minutes: 15,
      fraction: 0.4,
      startedAt: T0,
    });
    expect(clampRun({ minutes: 13, fraction: 7, startedAt: "soon" })).toEqual({
      minutes: 15,
      fraction: 1,
      startedAt: null,
    });
    expect(clampRun(null, 20)).toEqual({
      minutes: 20,
      fraction: 1,
      startedAt: null,
    });
  });
});

describe("a run halted by a tilt", () => {
  it("resumes from where it stood, and only if it was halted and not run out", () => {
    const start = Date.UTC(2026, 8, 29, 12);
    const run = turn(newRun(10), start);
    const held = halt(run, start + 3 * 60_000);
    expect(held.startedAt).toBeNull();
    expect(held.fraction).toBeCloseTo(0.3, 9);
    const again = resume(held, start + 9 * 60_000);
    expect(again.startedAt).toBe(start + 9 * 60_000);
    // Six minutes on its side counted for nothing: a minute later it is
    // four tenths through, not a whole glass.
    expect(passed(again, start + 10 * 60_000)).toBeCloseTo(0.4, 9);
    expect(resume(run, start)).toBe(run);
    const out = halt(turn(newRun(1), start), start + 61_000);
    expect(resume(out, start + 70_000)).toBe(out);
  });
});

describe("a pinch", () => {
  it("makes the glass bigger or smaller and leaves the length alone", () => {
    for (const minutes of DURATIONS) {
      expect(shownSize(minutes, 1)).toBeCloseTo(sizeFor(minutes), 12);
    }
    expect(shownSize(5, 1.5)).toBeCloseTo(sizeFor(5) * 1.5, 12);
    expect(shownSize(5, 0.7)).toBeCloseTo(sizeFor(5) * 0.7, 12);
  });

  it("goes no further than the glass can be shown, so there is nothing to undo past the end", () => {
    for (const minutes of DURATIONS) {
      for (const zoom of [0.01, ZOOM_MIN, 1, ZOOM_MAX, 99]) {
        const size = shownSize(minutes, zoom);
        expect(size).toBeGreaterThanOrEqual(SHOWN_MIN - 1e-12);
        expect(size).toBeLessThanOrEqual(SHOWN_MAX + 1e-12);
        expect(zoomFor(minutes, zoom) * sizeFor(minutes)).toBeCloseTo(size, 12);
      }
    }
    // A two-hour glass already fills its room: pinched out it grows only
    // to the edge, and the first pinch back in shrinks it.
    expect(zoomFor(120, ZOOM_MAX)).toBeCloseTo(SHOWN_MAX / sizeFor(120), 12);
  });

  it("is kept clamped, and an unreadable one is the length's own size", () => {
    expect(clampZoom(1.7)).toBe(1.7);
    expect(clampZoom(99)).toBe(ZOOM_MAX);
    expect(clampZoom(0.01)).toBe(ZOOM_MIN);
    expect(clampZoom("big")).toBe(1);
    expect(clampZoom(-2)).toBe(1);
    expect(clampZoom(null)).toBe(1);
  });
});

describe("a reset", () => {
  it("stands the glass still with all its sand in the lower bulb, its length kept", () => {
    const start = Date.UTC(2026, 9, 2, 12);
    const run = turn(newRun(20), start);
    const back = reset(run);
    expect(back).toEqual(newRun(20));
    expect(isRunning(back, start + 5 * MIN)).toBe(false);
    expect(passed(back, start + 60 * MIN)).toBe(1);
    // Turned again, it runs its whole length.
    const again = turn(back, start + 6 * MIN);
    expect(passed(again, start + 16 * MIN)).toBeCloseTo(0.5, 9);
  });

  it("draws the rest of the sand down by the clock, quickly at first, all of it after RESET_MS", () => {
    const at = Date.UTC(2026, 9, 2, 12);
    expect(resetting(0.3, at, at)).toBeCloseTo(0.3, 12);
    expect(resetting(0.3, at, at - 50)).toBeCloseTo(0.3, 12);
    let last = 0.3;
    for (let ms = 50; ms <= RESET_MS; ms += 50) {
      const f = resetting(0.3, at, at + ms);
      expect(f).toBeGreaterThan(last);
      last = f;
    }
    expect(resetting(0.3, at, at + RESET_MS)).toBe(1);
    expect(resetting(0.3, at, at + RESET_MS * 10)).toBe(1);
    // More than half of it in the first third.
    expect(resetting(0, at, at + RESET_MS / 3)).toBeGreaterThan(0.5);
  });
});
