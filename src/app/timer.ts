// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

// The timer: how long the glass runs, and where in a run it is.
//
// An hourglass has no clock in it — it has an amount of sand and a hole —
// so what is kept is where the sand was and when it was last turned, and
// how much has run through is read off the wall clock. That is what lets
// the sand be right after the phone has been asleep: the fraction that has
// passed is a function of `now`, never a count of frames. Pure and
// clock-free; `now` is a parameter, in milliseconds since the epoch.

/** The lengths the glass can be set to, in minutes. */
export const DURATIONS: readonly number[] = [
  1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 15, 20, 25, 30, 45, 60, 90, 120,
];

export const DEFAULT_MINUTES = 5;

/** The nearest length on offer to a value from anywhere. */
export function clampMinutes(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return DEFAULT_MINUTES;
  let best = DURATIONS[0]!;
  for (const m of DURATIONS) {
    if (Math.abs(m - n) < Math.abs(best - n)) best = m;
  }
  return best;
}

/** The length `steps` places along the list from `minutes` — one step is
 *  the next length up or down — held at the ends. */
export function stepMinutes(minutes: number, steps: number): number {
  const at = DURATIONS.indexOf(clampMinutes(minutes));
  const next = Math.min(DURATIONS.length - 1, Math.max(0, at + steps));
  return DURATIONS[next]!;
}

/** The smallest and the largest share of the room the glass takes. */
export const SIZE_MIN = 0.44;
export const SIZE_MAX = 1;

/**
 * How big the glass is for a length, as a share of the room it has: a
 * one-minute glass is a little under half the height, the longest one all of
 * it, and the sizes between run on a log scale — the same step in minutes
 * is a bigger glass at the short end, where a minute is a lot, than at the
 * long end, where it is not.
 */
export function sizeFor(minutes: number): number {
  const lo = DURATIONS[0]!;
  const hi = DURATIONS[DURATIONS.length - 1]!;
  const f = Math.log(minutes / lo) / Math.log(hi / lo);
  return SIZE_MIN + (SIZE_MAX - SIZE_MIN) * Math.min(1, Math.max(0, f));
}

/** A length as hours and minutes, for the label. */
export function splitMinutes(minutes: number): {
  hours: number;
  minutes: number;
} {
  return { hours: Math.floor(minutes / 60), minutes: minutes % 60 };
}

/** Where a run stands: how long the glass runs, how much of the sand was
 *  already in the lower bulb the last time it was turned, and when that was
 *  — null while it is standing still. */
export type Run = {
  minutes: number;
  /** The share of the sand in the lower bulb at `startedAt` (or now, when
   *  not running): 1 is a glass that has run out. */
  fraction: number;
  startedAt: number | null;
};

/** A glass set to `minutes`, standing with all its sand in the lower bulb,
 *  the way one is picked up off a shelf. */
export function newRun(minutes: number): Run {
  return { minutes: clampMinutes(minutes), fraction: 1, startedAt: null };
}

/** The share of the sand in the lower bulb now. */
export function passed(run: Run, now: number): number {
  if (run.startedAt === null) return run.fraction;
  const elapsed = Math.max(0, now - run.startedAt) / (run.minutes * 60_000);
  return Math.min(1, run.fraction + elapsed);
}

/** Whether sand is still running. */
export function isRunning(run: Run, now: number): boolean {
  return run.startedAt !== null && passed(run, now) < 1;
}

/** The seconds left until the top bulb is empty; 0 when it is. */
export function remainingSeconds(run: Run, now: number): number {
  return (1 - passed(run, now)) * run.minutes * 60;
}

/** Turn the glass over: what was in the lower bulb is now in the upper one,
 *  and it starts running from there. */
export function turn(run: Run, now: number): Run {
  return {
    minutes: run.minutes,
    fraction: 1 - passed(run, now),
    startedAt: now,
  };
}

/** A run that has finished (or was stopped): its fraction as of `now`,
 *  and no clock. */
export function halt(run: Run, now: number): Run {
  return { minutes: run.minutes, fraction: passed(run, now), startedAt: null };
}

/** A halted run set going again from where it stands — a glass stood up
 *  straight after being held on its side. A run already running, or one
 *  that has run out, is returned as it is. */
export function resume(run: Run, now: number): Run {
  if (run.startedAt !== null || run.fraction >= 1) return run;
  return { minutes: run.minutes, fraction: run.fraction, startedAt: now };
}

/** A stored run, every field clamped: an unreadable one is a new glass. */
export function clampRun(
  value: unknown,
  fallbackMinutes = DEFAULT_MINUTES,
): Run {
  const raw = (
    typeof value === "object" && value !== null ? value : {}
  ) as Partial<Record<keyof Run, unknown>>;
  const minutes =
    typeof raw.minutes === "number"
      ? clampMinutes(raw.minutes)
      : clampMinutes(fallbackMinutes);
  const fraction =
    typeof raw.fraction === "number" && Number.isFinite(raw.fraction)
      ? Math.min(1, Math.max(0, raw.fraction))
      : 1;
  const startedAt =
    typeof raw.startedAt === "number" && Number.isFinite(raw.startedAt)
      ? raw.startedAt
      : null;
  return { minutes, fraction, startedAt };
}
