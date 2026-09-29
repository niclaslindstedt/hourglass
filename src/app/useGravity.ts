// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { useCallback, useEffect, useRef, useState } from "react";

// Which way is down, read off the phone.
//
// An hourglass is turned over by turning it over — so when the phone is
// turned upside down the sand runs the other way, and the glass on the
// screen stays exactly where it is: it is the phone that moved, not the
// picture. What the sand needs to know is one thing: whether gravity, as
// the device reports it, points down the screen or up it. Everything else
// about the reading — a lean to the left, the phone lying flat — changes
// nothing, because a glass on its side stops and a glass laid flat stops,
// and a timer that stopped whenever the phone was put down would be a
// worse hourglass than one that runs true.
//
// The reading is gravity's share along the screen's own vertical:
// `sin(beta)`, +1 upright, −1 upside down. It flips with a wide hysteresis
// — past a third of a right angle beyond level, either way — so a phone
// carried flat does not turn its glass over at every jolt.
//
// The readings never leave the frame they decide: nothing is stored,
// nothing is sent; the sign is the only thing that survives one.
//
// On iOS the sensor needs the user's permission, asked from a tap
// (`requestGravity`); elsewhere it needs nothing.

/** Down the screen (1) or up it (−1). */
export type Gravity = 1 | -1;

/** How far past level, as sine, before the glass counts as turned. */
const FLIP_AT = 0.35;

type Permitting = {
  requestPermission?: () => Promise<"granted" | "denied">;
};

/** Whether this device asks before it reports orientation (iOS). */
export function gravityNeedsPermission(): boolean {
  if (typeof window === "undefined") return false;
  const ctor = (window as { DeviceOrientationEvent?: Permitting })
    .DeviceOrientationEvent;
  return typeof ctor?.requestPermission === "function";
}

/** Ask, from a user gesture. Resolves to whether readings will come. */
export async function requestGravity(): Promise<boolean> {
  const ctor = (window as { DeviceOrientationEvent?: Permitting })
    .DeviceOrientationEvent;
  if (!ctor?.requestPermission) return true;
  try {
    return (await ctor.requestPermission()) === "granted";
  } catch {
    return false;
  }
}

/** The sign of gravity along the screen from one reading: the sine of the
 *  front-back tilt, which is +1 for an upright phone and −1 for one held
 *  upside down. Null when there is no reading. */
export function gravitySign(beta: number | null): number | null {
  if (beta === null || !Number.isFinite(beta)) return null;
  return Math.sin((beta * Math.PI) / 180);
}

/** The next gravity, given the last and a fresh sign: a flip only past the
 *  hysteresis, either way. */
export function nextGravity(last: Gravity, sign: number | null): Gravity {
  if (sign === null) return last;
  if (last === 1 && sign < -FLIP_AT) return -1;
  if (last === -1 && sign > FLIP_AT) return 1;
  return last;
}

/**
 * Gravity along the screen, live. `enabled` off means no listener at all
 * — and 1, down, which is what a desk and a phone without a sensor get.
 * `first` is true until the sensor has said anything: the first reading
 * sets which way up the glass already is, rather than turning it.
 */
export function useGravity(enabled: boolean): {
  gravity: Gravity;
  first: boolean;
} {
  const [gravity, setGravity] = useState<Gravity>(1);
  const [first, setFirst] = useState(true);
  const last = useRef<Gravity>(1);

  const onReading = useCallback((e: DeviceOrientationEvent) => {
    const sign = gravitySign(e.beta);
    if (sign === null) return;
    setFirst((was) => {
      if (was) {
        // The first reading says which way up the phone already is.
        last.current = sign < 0 ? -1 : 1;
        setGravity(last.current);
      }
      return false;
    });
    const next = nextGravity(last.current, sign);
    if (next !== last.current) {
      last.current = next;
      setGravity(next);
    }
  }, []);

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;
    window.addEventListener("deviceorientation", onReading);
    return () => window.removeEventListener("deviceorientation", onReading);
  }, [enabled, onReading]);

  return { gravity, first };
}
