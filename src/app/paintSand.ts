// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import type { Frame } from "./frame.ts";
import { SAND, type SandSpec } from "./look.ts";
import { rim, type Bulb } from "./sand.ts";
import { glassPath } from "./paintGlass.ts";
import {
  axisY,
  css,
  cylinderLit,
  ellipseOf,
  rgbOf,
  surfaceFacets,
  tone,
  type Rgb,
} from "./scene.ts";

// The sand: each heap as lit facets under a grain pattern drawn at the
// device's own pixels, the grains that cling to the glass, the sparkle of
// a sand that has any, and the stream between the bulbs.

/** One bulb's heap: the surface as facets, then the sand pressed against
 *  the front of the glass below the near edge of the rim, the grain over
 *  both, and the grains that cling to the glass above the rim. */
export function paintSand(
  ctx: CanvasRenderingContext2D,
  frame: Frame,
  bulb: Bulb,
  baseY: number,
  up: 1 | -1,
): void {
  const { cam, look, layout } = frame;
  const sand = SAND[look.sand];
  const base = rgbOf(sand.color);
  const dark = rgbOf(sand.dark);
  const light = rgbOf(sand.light);
  const rimRing = rim(bulb);
  if (rimRing < 0) return;
  const rimR =
    rimRing + 1 < bulb.n ? bulb.centre[rimRing + 1]! : bulb.centre[rimRing]!;
  const rimH =
    baseY +
    up *
      (rimRing + 1 < bulb.n ? bulb.floor[rimRing + 1]! : bulb.height[rimRing]!);
  const funnel = bulb.rest === "waist";
  // The end the sand rests against: the waist, or its plate.
  const restBottom = baseY;

  ctx.save();
  glassPath(ctx, frame);
  ctx.clip();

  // The surface, facet by facet: lit as its slope faces the light, and in
  // a funnel darker the deeper it goes, where the light does not reach.
  const facets = surfaceFacets(cam, bulb, baseY, up, rimRing);
  const rimY = axisY(cam, rimH);
  const bottomY = axisY(cam, baseY + up * bulb.height[0]!);
  const depthPx = Math.max(1, Math.abs(bottomY - rimY));
  for (const f of facets) {
    let k = f.lit * 1.6 - 0.1;
    if (funnel) {
      const y = (f.y[0] + f.y[1] + f.y[2] + f.y[3]) / 4;
      const deep = Math.min(1, Math.max(0, Math.abs(y - rimY) / depthPx));
      k *= 1 - 0.35 * deep;
    }
    const c = tone(base, dark, light, k);
    ctx.fillStyle = css(c);
    ctx.strokeStyle = css(c);
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    ctx.moveTo(f.x[0], f.y[0]);
    ctx.lineTo(f.x[1], f.y[1]);
    ctx.lineTo(f.x[2], f.y[2]);
    ctx.lineTo(f.x[3], f.y[3]);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  // The sand against the front wall, from the near edge of the rim down to
  // the end it rests on: as wide as the wall, or as wide as the heap where
  // the heap stands clear of it. Lit as a cylinder — bright where it faces
  // the light, dark towards both edges, where it turns away — and darker
  // again towards the end it rests on, where the glass and the plate keep
  // the light off it.
  const e = ellipseOf(cam, rimH, rimR);
  const body = () => {
    ctx.beginPath();
    ctx.ellipse(e.cx, e.cy, e.rx, e.ry, 0, 0, Math.PI, false);
    const n = 32;
    for (let k = 0; k <= n; k++) {
      const y = rimH + ((restBottom - rimH) * k) / n;
      const r = Math.min(layout.bulb.radiusAt(Math.abs(y)), rimR);
      ctx.lineTo(cam.cx - r * cam.scale, axisY(cam, y));
    }
    for (let k = n; k >= 0; k--) {
      const y = rimH + ((restBottom - rimH) * k) / n;
      const r = Math.min(layout.bulb.radiusAt(Math.abs(y)), rimR);
      ctx.lineTo(cam.cx + r * cam.scale, axisY(cam, y));
    }
    ctx.closePath();
  };
  body();
  const g = ctx.createLinearGradient(cam.cx - e.rx, 0, cam.cx + e.rx, 0);
  for (let k = 0; k <= 10; k++) {
    const u = (k / 10) * 2 - 1;
    g.addColorStop(
      k / 10,
      css(tone(base, dark, light, cylinderLit(u, 0.35) * 1.35)),
    );
  }
  ctx.fillStyle = g;
  ctx.fill();
  const restY = axisY(cam, restBottom);
  const v = ctx.createLinearGradient(0, e.cy, 0, restY);
  v.addColorStop(0, "rgba(0, 0, 0, 0)");
  v.addColorStop(0.6, "rgba(0, 0, 0, 0.12)");
  v.addColorStop(1, "rgba(0, 0, 0, 0.38)");
  ctx.fillStyle = v;
  ctx.fill();

  // The grain: the sand's own darker and lighter grains, one to a device
  // pixel, over the body just painted and over the surface as one path of
  // every facet. This is what makes it sand rather than paint.
  if (frame.grain) {
    ctx.fillStyle = frame.grain;
    ctx.fill();
    ctx.beginPath();
    for (const f of facets) {
      ctx.moveTo(f.x[0], f.y[0]);
      ctx.lineTo(f.x[1], f.y[1]);
      ctx.lineTo(f.x[2], f.y[2]);
      ctx.lineTo(f.x[3], f.y[3]);
      ctx.closePath();
    }
    ctx.fill();
  }

  // The rim itself: where the surface meets the glass it is not a line but
  // a scatter of grains, and a few cling to the wall above it, thinning
  // upwards — the dusting a running glass leaves on its walls.
  ctx.fillStyle = css(base, 0.8);
  const dust = sand.grain === "coarse" ? 36 : 64;
  const size =
    (sand.grain === "coarse" ? 1.7 : 1.15) / Math.max(1, 2 / frame.dpr);
  for (let k = 0; k < dust; k++) {
    const a = (hash(k * 1.7 + 0.3) - 0.5) * Math.PI * 0.95;
    const lift = hash(k * 2.3 + 0.7) ** 2 * cam.scale * 0.03;
    const x = e.cx + Math.sin(a) * e.rx * 0.97;
    const y = e.cy + Math.cos(a) * e.ry - up * lift;
    ctx.fillRect(x, y, size, size);
  }
  if (sand.sparkle) paintSparkle(ctx, frame, e.cx, e.cy, e.rx, restY);
  ctx.restore();
}

/** A few grains catching the light, moving as the heap does. */
function paintSparkle(
  ctx: CanvasRenderingContext2D,
  frame: Frame,
  cx: number,
  cy: number,
  rx: number,
  bottom: number,
): void {
  const light = rgbOf(SAND[frame.look.sand].light);
  ctx.fillStyle = css(light, 0.9);
  const h = Math.abs(bottom - cy);
  for (let k = 0; k < 18; k++) {
    const a = hash(k * 7.1) * Math.PI * 2;
    const rr = Math.sqrt(hash(k * 3.3)) * rx * 0.9;
    const x = cx + Math.cos(a) * rr;
    const y =
      cy +
      Math.sin(a) * rx * 0.12 +
      hash(k * 5.7) * h * 0.9 * (bottom > cy ? 1 : -1);
    const tw = 0.5 + 0.5 * Math.sin(frame.t * 3 + k);
    if (tw < 0.6) continue;
    ctx.fillRect(x, y, 1.2, 1.2);
  }
}

/** The stream: a thread of sand from the waist to the top of the heap
 *  below, and grains falling down it. */
export function paintStream(ctx: CanvasRenderingContext2D, frame: Frame): void {
  const { cam, look, layout } = frame;
  const sand = SAND[look.sand];
  const base = rgbOf(sand.color);
  const light = rgbOf(sand.light);
  const B = layout.bulb.height;
  const up = frame.gravity;
  const apexY = up * (-B + frame.sink.height[0]!);
  const waistY = axisY(cam, 0);
  const endY = axisY(cam, apexY) - up;
  // Drawn top to bottom on the screen either way; the grains fall from the
  // waist towards the heap, which is down the screen or up it.
  const y0 = Math.min(waistY, endY);
  const y1 = Math.max(waistY, endY);
  if (y1 <= y0) return;
  const bore = layout.bulb.bore * cam.scale;
  const w = Math.max(1.4, bore * 2 * (sand.grain === "coarse" ? 1.3 : 1));
  // The thread.
  const g = ctx.createLinearGradient(cam.cx - w, 0, cam.cx + w, 0);
  g.addColorStop(0, css(base, 0));
  g.addColorStop(0.35, css(light, 0.55 * frame.flow));
  g.addColorStop(0.5, css(base, 0.9 * frame.flow));
  g.addColorStop(0.65, css(light, 0.45 * frame.flow));
  g.addColorStop(1, css(base, 0));
  ctx.fillStyle = g;
  ctx.fillRect(cam.cx - w, y0, 2 * w, y1 - y0);
  // The grains, in free fall: each has its own phase, and they spread a
  // little as they fall.
  const fall = y1 - y0;
  const period = 0.55 * Math.sqrt(fall / 200);
  const count = sand.grain === "coarse" ? 14 : 22;
  const size = sand.grain === "coarse" ? 2.2 : 1.5;
  ctx.fillStyle = css(base, 0.95);
  for (let k = 0; k < count; k++) {
    const phase = hash(k * 11.3);
    const u = (frame.t / period + phase) % 1;
    const y = waistY + up * fall * u * u;
    const x = cam.cx + (hash(k * 2.9) - 0.5) * w * (0.6 + 1.2 * u);
    ctx.fillRect(x - size / 2, y - size / 2, size, size);
  }
  // Where it lands: a few grains thrown out of the apex.
  ctx.fillStyle = css(light, 0.8);
  for (let k = 0; k < 6; k++) {
    const u = (frame.t * 2.2 + hash(k * 4.7)) % 1;
    const dir = hash(k * 9.1) - 0.5;
    const x = cam.cx + dir * 14 * u;
    const y = endY - up * (6 * u - 8 * u * u);
    ctx.fillRect(x, y, 1.2, 1.2);
  }
}

/** A repeatable number in 0..1 for a seed: the grains' own places. */
function hash(seed: number): number {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

/** The grain pattern: a tile of the sand's own grains — darker ones,
 *  lighter ones and, in a sand that sparkles, a few catching the light —
 *  one to a device pixel, so it is as fine on the screen as the screen is.
 *  Drawn once per sand and per pixel ratio. */
export function grainPattern(
  ctx: CanvasRenderingContext2D,
  sand: SandSpec,
  dpr: number,
): CanvasPattern | null {
  const size = 160;
  const tile = document.createElement("canvas");
  tile.width = size;
  tile.height = size;
  const tc = tile.getContext("2d");
  if (!tc) return null;
  const img = tc.createImageData(size, size);
  const dark = rgbOf(sand.dark);
  const light = rgbOf(sand.light);
  const white: Rgb = [255, 255, 255];
  const coarse = sand.grain === "coarse";
  const density = coarse ? 0.26 : 0.42;
  const put = (x: number, y: number, c: Rgb, a: number) => {
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    const o = (y * size + x) * 4;
    img.data[o] = c[0];
    img.data[o + 1] = c[1];
    img.data[o + 2] = c[2];
    img.data[o + 3] = Math.round(a * 255);
  };
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const seed = x * 0.731 + y * 0.517 + (coarse ? 900 : 0);
      if (hash(seed) > density) continue;
      const kind = hash(seed + 0.5);
      const c =
        kind < 0.5 ? dark : kind < 0.92 || !sand.sparkle ? light : white;
      const a =
        kind < 0.5
          ? 0.4 + 0.3 * hash(seed + 1.5)
          : 0.35 + 0.4 * hash(seed + 2.5);
      put(x, y, c, a);
      if (coarse && hash(seed + 3.5) < 0.6) {
        put(x + 1, y, c, a * 0.9);
        if (hash(seed + 4.5) < 0.5) put(x, y + 1, c, a * 0.8);
      }
    }
  }
  tc.putImageData(img, 0, 0);
  const pattern = ctx.createPattern(tile, "repeat");
  // One tile pixel to one device pixel, whatever the canvas is scaled by.
  pattern?.setTransform(new DOMMatrix().scale(1 / dpr));
  return pattern;
}
