// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { DEFAULT_LOOK_PRESET } from "../look.ts";
import type { Run } from "../timer.ts";
import { DEFAULT_SETTINGS, type AppSettings } from "../useAppSettings.ts";

// The demo: what `VITE_SEED=demo` boots onto, for `make demo` and the store
// screenshots. A glass part way through a run, computed from `now` so it
// is the same picture on any day at any hour, and held in memory — nothing
// on the device is read or written while it shows, and the pickers cannot
// connect anything because there is nothing to connect.
//
// The check is `=== "demo"`, never truthiness, and a production build never
// sets it, so Vite folds all of this away.

export const DEMO = import.meta.env.VITE_SEED === "demo";

/** How far through its run the demo glass is: enough sand in both bulbs
 *  for the funnel and the cone to read. */
export const DEMO_MINUTES = 30;
export const DEMO_FRACTION = 0.38;

/** The demo's settings: the default glass, half an hour. */
export function demoSettings(): AppSettings {
  return {
    ...DEFAULT_SETTINGS,
    preset: DEFAULT_LOOK_PRESET,
    minutes: DEMO_MINUTES,
  };
}

/** The demo's run as of `now`: turned over a while ago, still running. */
export function demoRun(now: number): Run {
  return {
    minutes: DEMO_MINUTES,
    fraction: 0,
    startedAt: now - DEMO_FRACTION * DEMO_MINUTES * 60_000,
  };
}
