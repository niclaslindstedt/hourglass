// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, expect, it } from "vitest";

import {
  DEMO_FRACTION,
  DEMO_MINUTES,
  demoRun,
  demoSettings,
} from "../src/app/dev/demo.ts";
import { isRunning, passed } from "../src/app/timer.ts";

// The demo is computed from `now`, so it is the same picture on every day
// of the year and at every hour: a glass a little over a third of the way
// through a half-hour run, still running. Walked across a year, at a
// rotating hour a day so every hour is visited, and just after midnight.

describe("the demo", () => {
  it("shows the same glass on every day of a year, at every hour", () => {
    const start = Date.UTC(2026, 0, 1, 0, 0, 0);
    for (let day = 0; day < 366; day++) {
      const hour = (day * 5) % 24;
      for (const minute of [0, 1, 30]) {
        const now =
          start + day * 86_400_000 + hour * 3_600_000 + minute * 60_000;
        const run = demoRun(now);
        expect(run.minutes).toBe(DEMO_MINUTES);
        expect(passed(run, now)).toBeCloseTo(DEMO_FRACTION, 9);
        expect(isRunning(run, now)).toBe(true);
        // An hour later a half-hour glass has run out, which is the honest
        // answer.
        expect(passed(run, now + 3_600_000)).toBe(1);
      }
    }
  });

  it("starts on the default glass, set to the demo's length", () => {
    const settings = demoSettings();
    expect(settings.preset).toBe("study");
    expect(settings.minutes).toBe(DEMO_MINUTES);
  });
});
