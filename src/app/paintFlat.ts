// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import type { Layout } from "./glass.ts";
import { GLASS, SAND, type Look } from "./look.ts";
import { glassLight, grainPattern, paintHourglass } from "./paint.ts";
import type { Bulb } from "./sand.ts";
import { PITCH, YAW } from "./scene.ts";
import type { LookSprites } from "./sprites.ts";

// The flat painter's whole frame, where there is no WebGL: the picture
// the app drew before it had a stage, from the same heaps, turned as a
// tap's turn has it. Paint only (`paint.ts` and its two halves).

/** Whether the page behind the glass is light, read off the theme's own
 *  background token: the flat painter's glass edges are drawn in shadow on
 *  a light page and in light on a dark one. */
export function pageIsLight(): boolean {
  try {
    const bg = getComputedStyle(document.documentElement)
      .getPropertyValue("--page-bg")
      .trim();
    const m = /^#([0-9a-f]{6})$/i.exec(bg);
    if (!m) return false;
    const n = parseInt(m[1]!, 16);
    const luma =
      (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
    return luma > 0.5;
  } catch {
    return false;
  }
}

/** What the flat painter draws a frame of. */
export type FlatGlass = {
  look: Look;
  layout: Layout;
  source: Bulb;
  sink: Bulb;
  gravity: 1 | -1;
  glow: number;
};

/** The view a frame is drawn at: the canvas's size and pixels, how far the
 *  picture is turned (rad) and whether the frame stands the other way up,
 *  the glass's share of the height, whether the sand runs, and the moment
 *  (s) the grains move by. */
export type FlatView = {
  w: number;
  h: number;
  dpr: number;
  angle: number;
  upended: boolean;
  share: number;
  running: boolean;
  seconds: number;
};

/** One frame of the flat picture on `el`. */
export function paintFlat(
  el: HTMLCanvasElement,
  s: FlatGlass,
  sp: LookSprites | null,
  v: FlatView,
): void {
  const ctx = el.getContext("2d");
  if (!ctx) return;
  const { w, h, dpr, angle } = v;
  const scale = h * v.share;
  const light = pageIsLight();
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  ctx.save();
  if (angle !== 0) {
    ctx.translate(w / 2, h / 2);
    ctx.rotate(angle);
    ctx.translate(-w / 2, -h / 2);
  }
  const lean = Math.cos(angle);
  paintHourglass(ctx, {
    cam: {
      pitch: PITCH * lean,
      yaw: YAW * lean,
      scale,
      cx: w / 2,
      cy: h / 2,
    },
    look: s.look,
    layout: s.layout,
    source: s.source,
    sink: s.sink,
    gravity: s.gravity,
    tilt: s.sink.tilt[0],
    shake: s.source.give,
    flow: v.running ? 1 : 0,
    t: v.seconds,
    glow: s.glow,
    dpr,
    grain: grainPattern(ctx, SAND[s.look.sand], dpr, sp?.grain ?? null),
    glassLight:
      angle === 0 && !(sp?.glassAdd && sp.glassMultiply)
        ? glassLight(s.layout, GLASS[s.look.glass], scale, PITCH, dpr, light)
        : null,
    light,
    sprites: sp,
    upended: v.upended,
  });
  ctx.restore();
}
