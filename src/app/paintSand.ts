// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import type { Frame } from "./frame.ts";
import { SAND, type SandSpec } from "./look.ts";
import { axisHeight, cellAt, spokeAngle, type Bulb } from "./sand.ts";
import { glassPath } from "./paintGlass.ts";
import {
  axisY,
  css,
  cylinderLit,
  ellipseOf,
  project,
  rgbOf,
  rimEdge,
  surfaceFacets,
  tone,
  type Rgb,
} from "./scene.ts";

// The sand: each heap as lit facets under a grain pattern drawn at the
// device's own pixels, the grains that cling to the glass, the sparkle of
// a sand that has any, and the stream between the bulbs.

/** One bulb's heap: the surface as facets, then the sand pressed against
 *  the front of the glass below the near edge of the rim, the grain over
 *  both, and the grains that cling to the glass above the rim. The rim is
 *  read spoke by spoke, so a heap leaning into a tilt meets the glass
 *  higher on one side than the other. */
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
  const facets = surfaceFacets(cam, bulb, baseY, up);
  if (facets.length === 0) return;
  const funnel = bulb.rest === "waist";
  // The end the sand rests against: the waist, or its plate.
  const restBottom = baseY;

  // Where the sand meets the front of the glass, spoke by spoke, left to
  // right across the screen.
  type RimPoint = { sx: number; sy: number; r: number; h: number };
  const front: RimPoint[] = [];
  for (let a = 0; a < bulb.m; a++) {
    const t = spokeAngle(bulb, a);
    if (Math.sin(t) < 0) continue;
    const e = rimEdge(bulb, a);
    if (!e) continue;
    const p = project(
      cam,
      e.r * Math.cos(t),
      baseY + up * e.h,
      e.r * Math.sin(t),
    );
    front.push({ sx: p.x, sy: p.y, r: e.r, h: e.h });
  }
  front.sort((p, q) => p.sx - q.sx);
  let rimR = 0;
  let rimH = 0;
  for (const p of front) {
    rimR += p.r / front.length;
    rimH += p.h / front.length;
  }
  if (front.length === 0) {
    // Sand on the far side only — a heap leaning away: the surface is all
    // there is to see.
    rimR = layout.bulb.radius * 0.5;
    rimH = axisHeight(bulb);
  }
  const rimWorldH = baseY + up * rimH;
  const e = ellipseOf(cam, rimWorldH, rimR);

  ctx.save();
  glassPath(ctx, frame);
  ctx.clip();

  // The surface, facet by facet: lit as its slope faces the light, and in
  // a funnel darker the deeper it goes, where the light does not reach.
  const rimY = e.cy;
  const bottomY = axisY(cam, baseY + up * axisHeight(bulb));
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
  const body = () => {
    if (front.length === 0) return false;
    const left = front[0]!;
    const right = front[front.length - 1]!;
    ctx.beginPath();
    ctx.moveTo(left.sx, left.sy);
    for (const p of front) ctx.lineTo(p.sx, p.sy);
    const n = 32;
    const rightH = baseY + up * right.h;
    const leftH = baseY + up * left.h;
    for (let k = 0; k <= n; k++) {
      const y = rightH + ((restBottom - rightH) * k) / n;
      const r = Math.min(layout.bulb.radiusAt(Math.abs(y)), right.r);
      ctx.lineTo(cam.cx + r * cam.scale, axisY(cam, y));
    }
    for (let k = n; k >= 0; k--) {
      const y = leftH + ((restBottom - leftH) * k) / n;
      const r = Math.min(layout.bulb.radiusAt(Math.abs(y)), left.r);
      ctx.lineTo(cam.cx - r * cam.scale, axisY(cam, y));
    }
    ctx.closePath();
    return true;
  };
  const restY = axisY(cam, restBottom);
  if (body()) {
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
    const v = ctx.createLinearGradient(0, e.cy, 0, restY);
    v.addColorStop(0, "rgba(0, 0, 0, 0)");
    v.addColorStop(0.6, "rgba(0, 0, 0, 0.12)");
    v.addColorStop(1, "rgba(0, 0, 0, 0.38)");
    ctx.fillStyle = v;
    ctx.fill();
  }

  // The grain: the sand's own darker and lighter grains, one to a device
  // pixel, over the body just painted and over the surface as one path of
  // every facet. This is what makes it sand rather than paint.
  if (frame.grain) {
    ctx.fillStyle = frame.grain;
    if (body()) ctx.fill();
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
  // upwards — the dusting a running glass leaves on its walls. Shaken,
  // the dust jumps higher.
  if (front.length > 1) {
    ctx.fillStyle = css(base, 0.8);
    const dust = sand.grain === "coarse" ? 36 : 64;
    const size =
      (sand.grain === "coarse" ? 1.7 : 1.15) / Math.max(1, 2 / frame.dpr);
    const span = front.length - 1;
    for (let k = 0; k < dust; k++) {
      const u = hash(k * 1.7 + 0.3) * span;
      const i = Math.min(span - 1, Math.floor(u));
      const f = u - i;
      const p = front[i]!;
      const q = front[i + 1]!;
      const jump = 1 + 4 * frame.shake * hash(k * 3.9 + frame.t);
      const lift = hash(k * 2.3 + 0.7) ** 2 * cam.scale * 0.03 * jump;
      const x = p.sx + (q.sx - p.sx) * f;
      const y = p.sy + (q.sy - p.sy) * f - up * lift;
      ctx.fillRect(x, y, size, size);
    }
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
 *  below, falling along gravity — straight down the screen, or at a slant
 *  when the glass is tilted — and grains falling down it. Shaken, the
 *  thread wavers and the grains scatter. */
export function paintStream(ctx: CanvasRenderingContext2D, frame: Frame): void {
  const { cam, look, layout } = frame;
  const sand = SAND[look.sand];
  const base = rgbOf(sand.color);
  const light = rgbOf(sand.light);
  const B = layout.bulb.height;
  const up = frame.gravity;
  const tx = frame.tilt;
  // Where the stream lands: the heap under the point the fall reaches,
  // read twice so the slant's reach follows the heap's height there.
  let fall = B - axisHeight(frame.sink);
  for (let k = 0; k < 2; k++) {
    const [i, a] = cellAt(frame.sink, tx * fall, 0);
    fall = Math.max(0.01, B - frame.sink.height[i * frame.sink.m + a]!);
  }
  const start = project(cam, 0, 0, 0);
  const end = project(cam, tx * fall, -up * fall, 0);
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.hypot(dx, dy);
  if (length < 1) return;
  const bore = layout.bulb.bore * cam.scale;
  const w = Math.max(1.4, bore * 2 * (sand.grain === "coarse" ? 1.3 : 1));
  const waver = frame.shake * w * 2.5;
  ctx.save();
  ctx.translate(start.x, start.y);
  ctx.rotate(Math.atan2(dx, dy) * -1);
  // The thread, down the local y axis.
  const g = ctx.createLinearGradient(-w, 0, w, 0);
  g.addColorStop(0, css(base, 0));
  g.addColorStop(0.35, css(light, 0.55 * frame.flow));
  g.addColorStop(0.5, css(base, 0.9 * frame.flow));
  g.addColorStop(0.65, css(light, 0.45 * frame.flow));
  g.addColorStop(1, css(base, 0));
  ctx.fillStyle = g;
  if (waver > 0.5) {
    // A shaken thread wavers: a path swaying from side to side down its
    // length, redrawn with a new sway a few times a second.
    const n = 12;
    const beat = Math.floor(frame.t * 14);
    const sway = (k: number) =>
      k <= 0 || k >= n ? 0 : (hash(k * 2.1 + beat) - 0.5) * waver;
    ctx.beginPath();
    ctx.moveTo(-w, 0);
    for (let k = 1; k <= n; k++) ctx.lineTo(-w + sway(k), (length * k) / n);
    for (let k = n; k >= 0; k--) ctx.lineTo(w + sway(k), (length * k) / n);
    ctx.closePath();
    ctx.fill();
  } else {
    ctx.fillRect(-w, 0, 2 * w, length);
  }
  // The grains, in free fall: each has its own phase, and they spread a
  // little as they fall — more, when the glass is shaken.
  const period = 0.55 * Math.sqrt(length / 200);
  const count = sand.grain === "coarse" ? 14 : 22;
  const size = sand.grain === "coarse" ? 2.2 : 1.5;
  ctx.fillStyle = css(base, 0.95);
  for (let k = 0; k < count; k++) {
    const phase = hash(k * 11.3);
    const u = (frame.t / period + phase) % 1;
    const y = length * u * u;
    const spread = w * (0.6 + 1.2 * u) + waver * 3 * u;
    const x =
      (hash(k * 2.9 + (waver > 0 ? Math.floor(frame.t * 8) : 0)) - 0.5) *
      spread;
    ctx.fillRect(x - size / 2, y - size / 2, size, size);
  }
  // Where it lands: a few grains thrown out of the apex.
  ctx.fillStyle = css(light, 0.8);
  for (let k = 0; k < 6; k++) {
    const u = (frame.t * 2.2 + hash(k * 4.7)) % 1;
    const dir = hash(k * 9.1) - 0.5;
    const x = dir * 14 * u * (1 + 2 * frame.shake);
    const y = length - (6 * u - 8 * u * u);
    ctx.fillRect(x, y, 1.2, 1.2);
  }
  ctx.restore();
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
  grain: HTMLImageElement | null = null,
): CanvasPattern | null {
  const size = grain ? grain.naturalWidth || 256 : 160;
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
  // The photographed sand's own grain first, where the build carries it:
  // a grey tile of each texel's difference from its surroundings, laid
  // as a lightening where it is brighter and a darkening where it is
  // darker — the relief of real sand under the specks.
  if (grain) {
    const gc = document.createElement("canvas");
    gc.width = size;
    gc.height = size;
    const g = gc.getContext("2d");
    if (g) {
      g.drawImage(grain, 0, 0, size, size);
      const src = g.getImageData(0, 0, size, size).data;
      const strength = coarse ? 1.0 : 0.7;
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          const v = (src[(y * size + x) * 4]! / 255 - 0.5) * strength;
          if (v > 0.03) put(x, y, white, Math.min(0.45, v));
          else if (v < -0.03) put(x, y, [0, 0, 0], Math.min(0.45, -v));
        }
      }
    }
  }
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const seed = x * 0.731 + y * 0.517 + (coarse ? 900 : 0);
      if (hash(seed) > density) continue;
      const kind = hash(seed + 0.5);
      const c =
        kind < 0.42 ? dark : kind < 0.84 ? light : sand.sparkle ? white : light;
      const a =
        kind < 0.42
          ? 0.3 + 0.35 * hash(seed + 1)
          : 0.25 + 0.35 * hash(seed + 2);
      put(x, y, c, a);
      if (coarse && hash(seed + 3) < 0.5) put(x + 1, y, c, a * 0.8);
    }
  }
  tc.putImageData(img, 0, 0);
  const pattern = ctx.createPattern(tile, "repeat");
  // One tile pixel to one device pixel, whatever the canvas is scaled by.
  pattern?.setTransform(new DOMMatrix().scale(1 / dpr));
  return pattern;
}
