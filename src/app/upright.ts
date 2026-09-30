// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { useEffect } from "react";

// The screen never turns. An hourglass is turned by turning it, so a page
// that rotated with the phone would undo the one gesture the sensor is
// for: laid on its side the glass would be a short wide thing, and held
// upside down the whole picture would spin round when only the sand should
// move. The phone and the desktop apps lock their windows to portrait
// (`native/app.config.js`); an installed web app asks through its manifest
// (`pwa-plugin.ts`). A browser tab cannot lock itself, so on a phone the
// page is turned back against the screen's own rotation — `#root` rotated
// the other way (`styles.css`, `data-turned` on <html>) — and it stands
// where the phone's own frame has it, the frame the sensors report in.
//
// Only on a touch screen: a desk's monitor is turned by someone who means
// it. And only toward portrait: a tablet whose natural way is landscape
// reports its portrait as a turn, and is left alone there.

/** The screen's rotation from its natural way, degrees: 0, 90, 180, 270. */
export function screenAngle(): number {
  if (typeof window === "undefined") return 0;
  // The old `window.orientation` first where there is one: its sense —
  // 90 for a phone turned to the left — is the same on iOS and Android,
  // which the newer angle's has not always been.
  const legacy = (window as { orientation?: unknown }).orientation;
  const a =
    typeof legacy === "number"
      ? legacy
      : (window.screen?.orientation?.angle ?? 0);
  return (((Math.round(a / 90) * 90) % 360) + 360) % 360;
}

/**
 * How far to turn the page back, degrees clockwise, for a screen turned
 * `angle` from its natural way and a viewport `w` × `h`: its rotation
 * undone when that leaves the page standing tall, and nothing otherwise.
 */
export function counterTurn(
  angle: number,
  w: number,
  h: number,
  touch: boolean,
): 0 | 90 | 180 | 270 {
  if (!touch) return 0;
  const a = (((Math.round(angle / 90) * 90) % 360) + 360) % 360;
  if (a === 180) return 180;
  // On its side: turned back only if the screen is now wider than tall,
  // which is what a portrait-first phone on its side is.
  if ((a === 90 || a === 270) && w > h) return a === 90 ? 270 : 90;
  return 0;
}

/**
 * A drag's `dx` and `dy` on the screen, in the page's own frame once the
 * page has been turned back by `turned` degrees clockwise.
 */
export function uprightDelta(
  dx: number,
  dy: number,
  turned: number,
): [number, number] {
  switch (turned) {
    case 90:
      return [dy, -dx];
    case 180:
      return [-dx, -dy];
    case 270:
      return [-dy, dx];
    default:
      return [dx, dy];
  }
}

/** How far the page is turned back now, degrees clockwise. */
export function pageTurn(): number {
  if (typeof document === "undefined") return 0;
  return Number(document.documentElement.dataset.turned ?? 0) || 0;
}

/** Keep the page standing tall on a phone however the screen turns. */
export function useUpright(): void {
  useEffect(() => {
    const root = document.documentElement;
    const touch = window.matchMedia?.("(pointer: coarse)").matches ?? false;
    const apply = () => {
      const turn = counterTurn(
        screenAngle(),
        window.innerWidth,
        window.innerHeight,
        touch,
      );
      if (turn === 0) delete root.dataset.turned;
      else root.dataset.turned = String(turn);
    };
    apply();
    // Where the browser will, the installed app is held to portrait
    // outright; a tab cannot be, and says so by refusing.
    try {
      const o = window.screen?.orientation as
        | (ScreenOrientation & { lock?: (o: string) => Promise<void> })
        | undefined;
      void o?.lock?.("portrait-primary").catch(() => {});
    } catch {
      // Not offered here.
    }
    window.addEventListener("resize", apply);
    window.addEventListener("orientationchange", apply);
    window.screen?.orientation?.addEventListener?.("change", apply);
    return () => {
      window.removeEventListener("resize", apply);
      window.removeEventListener("orientationchange", apply);
      window.screen?.orientation?.removeEventListener?.("change", apply);
      delete root.dataset.turned;
    };
  }, []);
}
