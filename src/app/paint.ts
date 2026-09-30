// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import type { Layout } from "./glass.ts";
import type { Frame, Post } from "./frame.ts";
import type { Loaded } from "./sprites.ts";
import { SAND, TOP, type TopSpec } from "./look.ts";
import { glassPath, paintGlassBack, paintGlassFront } from "./paintGlass.ts";
import { paintSand, paintStream } from "./paintSand.ts";
import {
  PITCH,
  axisY,
  css,
  cylinderLit,
  ellipseOf,
  mix,
  project,
  rgbOf,
  tone,
  type Camera,
  type Rgb,
} from "./scene.ts";

// The hourglass, painted. Everything here is paint: the shapes come from
// `glass.ts`, the heap from `sand.ts`, the camera and the light from
// `scene.ts`, and the colours from the look. Nothing here decides anything
// about the sand or the time.
//
// The order is the order things stand in, back to front: the shadow on the
// table, the bottom plate, the posts behind the glass, the glass's back
// wall, the sand, the stream, the glass's front wall and its reflections,
// the posts in front, the top plate and what sits on it.
//
// The glass is `paintGlass.ts` and the sand `paintSand.ts`; this file is the
// frame, the table and the order, and re-exports what a screen needs.

export type { Frame } from "./frame.ts";
export { glassLight } from "./paintGlass.ts";
export { grainPattern } from "./paintSand.ts";

export function paintHourglass(
  ctx: CanvasRenderingContext2D,
  frame: Frame,
): void {
  const { cam, look, layout } = frame;
  const top = TOP[look.top];
  const B = layout.bulb.height;
  const sp = frame.sprites;

  paintShadow(ctx, frame);
  if (frame.glow > 0) paintGlow(ctx, frame);
  // The plates: the modelled one where it has loaded — the same picture
  // for both ends, the upper one shifted up by the glass and a plate —
  // and the painter's own otherwise.
  const plateLift = -(2 * B + top.thick) * Math.cos(PITCH);
  if (sp?.plate) drawSprite(ctx, cam, sp.plate);
  else paintPlate(ctx, cam, top, -B - top.thick, -B, layout.reach);
  paintFootShadow(ctx, frame);
  const posts = postPositions(top, layout);
  const post = (p: Post, k: number) => {
    const s = sp?.posts[sp.posts.length === 2 ? k : 0];
    if (s?.at) drawSpriteAt(ctx, cam, s, p.x, -B, p.z);
    else paintPost(ctx, cam, top, p, B);
  };
  posts.forEach((p, k) => {
    if (p.depth < 0) post(p, k);
  });
  paintGlassBack(ctx, frame, posts);
  const up = frame.gravity;
  paintSand(ctx, frame, frame.source, 0, up);
  paintSand(ctx, frame, frame.sink, -up * B, up);
  if (frame.flow > 0) paintStream(ctx, frame);
  paintPlateShade(ctx, frame);
  paintGlassFront(ctx, frame);
  posts.forEach((p, k) => {
    if (p.depth >= 0) post(p, k);
  });
  if (sp?.plate) drawSprite(ctx, cam, sp.plate, 0, plateLift);
  else paintPlate(ctx, cam, top, B, B + top.thick, layout.reach);
  for (const p of posts) {
    if (sp?.finial?.at)
      drawSpriteAt(ctx, cam, sp.finial, p.x, B + top.thick, p.z);
    else paintFinial(ctx, cam, top, p, B + top.thick);
  }
}

// ── The modelled parts ──────────────────────────────────────────────────────

/** A sprite where it was rendered, shifted by `dx`, `dy` screen units. */
export function drawSprite(
  ctx: CanvasRenderingContext2D,
  cam: Camera,
  s: Loaded,
  dx = 0,
  dy = 0,
): void {
  ctx.drawImage(
    s.image,
    cam.cx + (s.x + dx) * cam.scale,
    cam.cy + (s.y + dy) * cam.scale,
    s.w * cam.scale,
    s.h * cam.scale,
  );
}

/** A sprite rendered at one world point, moved to another: a post or a
 *  finial, shifted by the difference of the two projections. */
function drawSpriteAt(
  ctx: CanvasRenderingContext2D,
  cam: Camera,
  s: Loaded,
  x: number,
  y: number,
  z: number,
): void {
  const at = s.at ?? { x: 0, y: 0, z: 0 };
  const from = project(cam, at.x, at.y, at.z);
  const to = project(cam, x, y, z);
  drawSprite(
    ctx,
    cam,
    s,
    (to.x - from.x) / cam.scale,
    (to.y - from.y) / cam.scale,
  );
}

// ── The table ───────────────────────────────────────────────────────────────

function paintShadow(ctx: CanvasRenderingContext2D, frame: Frame): void {
  const { cam, layout } = frame;
  const top = TOP[frame.look.top];
  const y = -layout.bulb.height - top.thick;
  const e = ellipseOf(cam, y, layout.reach * 1.35);
  const g = ctx.createRadialGradient(e.cx, e.cy, 0, e.cx, e.cy, e.rx);
  g.addColorStop(0, "rgba(0, 0, 0, 0.32)");
  g.addColorStop(0.6, "rgba(0, 0, 0, 0.14)");
  g.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.save();
  ctx.translate(e.cx, e.cy + e.ry * 0.6);
  ctx.scale(1, Math.max(0.18, e.ry / e.rx) * 1.6);
  ctx.translate(-e.cx, -e.cy);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(e.cx, e.cy, e.rx, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function paintGlow(ctx: CanvasRenderingContext2D, frame: Frame): void {
  const { cam } = frame;
  const sand = rgbOf(SAND[frame.look.sand].light);
  const r = cam.scale * 0.55;
  const g = ctx.createRadialGradient(cam.cx, cam.cy, 0, cam.cx, cam.cy, r);
  g.addColorStop(0, css(sand, 0.22 * frame.glow));
  g.addColorStop(1, css(sand, 0));
  ctx.fillStyle = g;
  ctx.fillRect(cam.cx - r, cam.cy - r, 2 * r, 2 * r);
}

// ── The plates ──────────────────────────────────────────────────────────────

/** The glass's shadow on the bottom plate: the light is high on the left
 *  and in front, so the foot's shadow falls to the right and back. */
function paintFootShadow(ctx: CanvasRenderingContext2D, frame: Frame): void {
  const { cam, layout } = frame;
  const B = layout.bulb.height;
  const e = ellipseOf(cam, -B, layout.bulb.radius * 0.9);
  const ox = e.rx * 0.28;
  const oy = -e.ry * 0.5;
  const g = ctx.createRadialGradient(
    e.cx + ox,
    e.cy + oy,
    0,
    e.cx + ox,
    e.cy + oy,
    e.rx,
  );
  g.addColorStop(0, "rgba(0, 0, 0, 0.42)");
  g.addColorStop(0.55, "rgba(0, 0, 0, 0.2)");
  g.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.save();
  ctx.translate(e.cx + ox, e.cy + oy);
  ctx.scale(1, Math.max(0.12, e.ry / e.rx) * 1.3);
  ctx.translate(-(e.cx + ox), -(e.cy + oy));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(e.cx + ox, e.cy + oy, e.rx, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** The top plate's shade on what is under it: the light comes from above,
 *  so the top of the upper bulb — glass and sand — is in the plate's
 *  shadow, fading out down the bulb. */
function paintPlateShade(ctx: CanvasRenderingContext2D, frame: Frame): void {
  const { cam, layout } = frame;
  if (TOP[frame.look.top].finish === "glass") return;
  const B = layout.bulb.height;
  ctx.save();
  glassPath(ctx, frame);
  ctx.clip();
  const y0 = axisY(cam, B);
  const y1 = axisY(cam, B * 0.55);
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  g.addColorStop(0, "rgba(0, 0, 0, 0.42)");
  g.addColorStop(0.35, "rgba(0, 0, 0, 0.16)");
  g.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = g;
  ctx.fillRect(cam.cx - cam.scale, y0 - 2, 2 * cam.scale, y1 - y0 + 2);
  ctx.restore();
}

/** One end plate, from `y0` (its underside) to `y1` (its top face). */
function paintPlate(
  ctx: CanvasRenderingContext2D,
  cam: Camera,
  top: TopSpec,
  y0: number,
  y1: number,
  reach: number,
): void {
  if (top.finish === "glass") {
    paintGlassEnd(ctx, cam, top, y0, y1, reach);
    return;
  }
  const face = rgbOf(top.face);
  const side = rgbOf(top.side);
  const edge = rgbOf(top.edge);
  const a = reach;
  if (top.plate === "square") {
    // The corners, in the plate's own space, then on the screen at both
    // heights. Rounded a little, the way a sawn corner is eased.
    const corners = squareCorners(a, cam, y0, y1);
    // Which side faces show is which have their outward normal towards the
    // viewer; with the camera round to the right, that is the front and the
    // right-hand face.
    const faces: [number, number, Rgb][] = [
      [0, 1, tone(face, side, edge, 0.78)], // front: from front-left to front-right
      [1, 2, tone(face, side, edge, 0.5)], // right: from front-right to back-right
    ];
    for (const [i, j, color] of faces) {
      const t0 = corners.top[i]!;
      const t1 = corners.top[j]!;
      const b0 = corners.bottom[i]!;
      const b1 = corners.bottom[j]!;
      ctx.beginPath();
      ctx.moveTo(t0.x, t0.y);
      ctx.lineTo(t1.x, t1.y);
      ctx.lineTo(b1.x, b1.y);
      ctx.lineTo(b0.x, b0.y);
      ctx.closePath();
      ctx.fillStyle = css(color);
      ctx.fill();
      if (top.finish === "metal") {
        const g = ctx.createLinearGradient(t0.x, t0.y, b0.x, b0.y);
        g.addColorStop(0, css(edge, 0.35));
        g.addColorStop(0.5, css(side, 0.0));
        g.addColorStop(1, css(side, 0.4));
        ctx.fillStyle = g;
        ctx.fill();
      }
      if (top.finish === "wood")
        paintGrainLines(ctx, [t0, t1, b1, b0], edge, side, 4);
    }
    // The top face.
    ctx.beginPath();
    corners.top.forEach((p, k) =>
      k === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y),
    );
    ctx.closePath();
    const lit = tone(face, side, edge, 1.12);
    ctx.fillStyle = css(lit);
    ctx.fill();
    if (top.finish === "wood") paintGrainLines(ctx, corners.top, edge, side, 6);
    if (top.finish === "metal") paintBrush(ctx, corners.top, edge, side);
    if (top.finish === "lacquer") paintSheen(ctx, corners.top, edge);
    ctx.strokeStyle = css(edge, 0.6);
    ctx.lineWidth = Math.max(1, cam.scale * 0.0025);
    ctx.stroke();
    if (top.inlay) {
      const inset = squareCorners(a * 0.86, cam, y0, y1);
      ctx.beginPath();
      inset.top.forEach((p, k) =>
        k === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y),
      );
      ctx.closePath();
      ctx.strokeStyle = top.inlay;
      ctx.lineWidth = Math.max(1, cam.scale * 0.003);
      ctx.stroke();
    }
    return;
  }

  // A disc: the side is the band between the two ellipses' near arcs, lit
  // as a cylinder; the top is the upper ellipse.
  const lo = ellipseOf(cam, y0, a);
  const hi = ellipseOf(cam, y1, a);
  ctx.beginPath();
  ctx.ellipse(hi.cx, hi.cy, hi.rx, hi.ry, 0, 0, Math.PI, false);
  ctx.ellipse(lo.cx, lo.cy, lo.rx, lo.ry, 0, Math.PI, 0, true);
  ctx.closePath();
  ctx.fillStyle = cylinderGradient(
    ctx,
    hi.cx - hi.rx,
    hi.cx + hi.rx,
    face,
    side,
    edge,
  );
  ctx.fill();
  if (top.finish === "wood") {
    // Turned wood: the grain runs round the disc, so the side shows it as
    // fine horizontal lines.
    ctx.save();
    ctx.clip();
    ctx.strokeStyle = css(side, 0.28);
    ctx.lineWidth = 1;
    const n = 5;
    for (let k = 1; k < n; k++) {
      const yy = hi.cy + ((lo.cy - hi.cy) * k) / n;
      ctx.beginPath();
      ctx.moveTo(hi.cx - hi.rx, yy);
      ctx.lineTo(hi.cx + hi.rx, yy);
      ctx.stroke();
    }
    ctx.restore();
  }
  ctx.beginPath();
  ctx.ellipse(hi.cx, hi.cy, hi.rx, hi.ry, 0, 0, Math.PI * 2);
  const g = ctx.createLinearGradient(
    hi.cx - hi.rx,
    hi.cy - hi.ry,
    hi.cx + hi.rx,
    hi.cy + hi.ry,
  );
  g.addColorStop(0, css(tone(face, side, edge, 1.25)));
  g.addColorStop(0.55, css(face));
  g.addColorStop(1, css(tone(face, side, edge, 0.8)));
  ctx.fillStyle = g;
  ctx.fill();
  if (top.finish === "wood") {
    // Rings of the turning, as faint concentric ellipses.
    ctx.strokeStyle = css(side, 0.16);
    ctx.lineWidth = 1;
    for (let k = 1; k <= 5; k++) {
      const f = k / 6;
      ctx.beginPath();
      ctx.ellipse(hi.cx, hi.cy, hi.rx * f, hi.ry * f, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
  if (top.finish === "metal") {
    ctx.strokeStyle = css(edge, 0.25);
    ctx.lineWidth = 1;
    for (let k = 1; k <= 8; k++) {
      const f = k / 9;
      ctx.beginPath();
      ctx.ellipse(hi.cx, hi.cy, hi.rx * f, hi.ry * f, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
  ctx.beginPath();
  ctx.ellipse(hi.cx, hi.cy, hi.rx, hi.ry, 0, 0, Math.PI * 2);
  ctx.strokeStyle = css(edge, 0.7);
  ctx.lineWidth = Math.max(1, cam.scale * 0.0025);
  ctx.stroke();
  if (top.inlay) {
    ctx.beginPath();
    ctx.ellipse(hi.cx, hi.cy, hi.rx * 0.86, hi.ry * 0.86, 0, 0, Math.PI * 2);
    ctx.strokeStyle = top.inlay;
    ctx.lineWidth = Math.max(1, cam.scale * 0.003);
    ctx.stroke();
  }
}

/** A frameless glass's thick ground end: a short clear cylinder. */
function paintGlassEnd(
  ctx: CanvasRenderingContext2D,
  cam: Camera,
  top: TopSpec,
  y0: number,
  y1: number,
  reach: number,
): void {
  const lo = ellipseOf(cam, y0, reach);
  const hi = ellipseOf(cam, y1, reach);
  ctx.beginPath();
  ctx.ellipse(hi.cx, hi.cy, hi.rx, hi.ry, 0, 0, Math.PI, false);
  ctx.ellipse(lo.cx, lo.cy, lo.rx, lo.ry, 0, Math.PI, 0, true);
  ctx.closePath();
  const g = ctx.createLinearGradient(hi.cx - hi.rx, 0, hi.cx + hi.rx, 0);
  g.addColorStop(0, top.edge);
  g.addColorStop(0.25, top.face);
  g.addColorStop(0.6, top.side);
  g.addColorStop(1, top.edge);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(hi.cx, hi.cy, hi.rx, hi.ry, 0, 0, Math.PI * 2);
  ctx.fillStyle = top.face;
  ctx.fill();
  ctx.strokeStyle = top.edge;
  ctx.lineWidth = 1;
  ctx.stroke();
}

export type Pt = { x: number; y: number };

function squareCorners(
  a: number,
  cam: Camera,
  y0: number,
  y1: number,
): { top: Pt[]; bottom: Pt[] } {
  // Front-left, front-right, back-right, back-left: z towards the viewer.
  const xs = [-a, a, a, -a];
  const zs = [a, a, -a, -a];
  const at = (y: number) => xs.map((x, i) => project(cam, x, y, zs[i]!));
  return { top: at(y1), bottom: at(y0) };
}

/** Faint lines of grain across a face, from its first edge to its third. */
function paintGrainLines(
  ctx: CanvasRenderingContext2D,
  quad: Pt[],
  edge: Rgb,
  side: Rgb,
  count: number,
): void {
  const [p0, p1, p2, p3] = quad as [Pt, Pt, Pt, Pt];
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(p0.x, p0.y);
  ctx.lineTo(p1.x, p1.y);
  ctx.lineTo(p2.x, p2.y);
  ctx.lineTo(p3.x, p3.y);
  ctx.closePath();
  ctx.clip();
  ctx.lineWidth = 1;
  for (let k = 0; k < count; k++) {
    // A seeded wobble, so the grain is the same grain every frame.
    const f = (k + 0.5) / count + 0.06 * Math.sin(k * 12.9898);
    const ax = p0.x + (p3.x - p0.x) * f;
    const ay = p0.y + (p3.y - p0.y) * f;
    const bx = p1.x + (p2.x - p1.x) * f;
    const by = p1.y + (p2.y - p1.y) * f;
    ctx.strokeStyle = k % 2 ? css(side, 0.14) : css(edge, 0.1);
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    const mx = (ax + bx) / 2;
    const my = (ay + by) / 2 + Math.sin(k * 3.7) * 1.5;
    ctx.quadraticCurveTo(mx, my, bx, by);
    ctx.stroke();
  }
  ctx.restore();
}

/** Brushed metal: a soft band of light across the face. */
function paintBrush(
  ctx: CanvasRenderingContext2D,
  quad: Pt[],
  edge: Rgb,
  side: Rgb,
): void {
  const [p0, , p2] = quad as [Pt, Pt, Pt, Pt];
  const g = ctx.createLinearGradient(p0.x, p0.y, p2.x, p2.y);
  g.addColorStop(0, css(edge, 0.35));
  g.addColorStop(0.45, css(edge, 0));
  g.addColorStop(0.8, css(side, 0.25));
  g.addColorStop(1, css(side, 0.05));
  ctx.fillStyle = g;
  ctx.fill();
}

/** Lacquer: one soft highlight on the face. */
function paintSheen(
  ctx: CanvasRenderingContext2D,
  quad: Pt[],
  edge: Rgb,
): void {
  const [p0, p1, p2, p3] = quad as [Pt, Pt, Pt, Pt];
  const cx = (p0.x + p1.x + p2.x + p3.x) / 4;
  const cy = (p0.y + p1.y + p2.y + p3.y) / 4;
  const r = Math.abs(p1.x - p0.x) * 0.6;
  const g = ctx.createRadialGradient(cx - r * 0.5, cy, 0, cx, cy, r);
  g.addColorStop(0, css(edge, 0.45));
  g.addColorStop(1, css(edge, 0));
  ctx.fillStyle = g;
  ctx.fill();
}

function cylinderGradient(
  ctx: CanvasRenderingContext2D,
  x0: number,
  x1: number,
  face: Rgb,
  side: Rgb,
  edge: Rgb,
): CanvasGradient {
  const g = ctx.createLinearGradient(x0, 0, x1, 0);
  for (let k = 0; k <= 8; k++) {
    const u = (k / 8) * 2 - 1;
    g.addColorStop(k / 8, css(tone(face, side, edge, cylinderLit(u) * 1.35)));
  }
  return g;
}

// ── The posts ───────────────────────────────────────────────────────────────

/** Where the posts stand, in the plate's space. */
export function postPositions(top: TopSpec, layout: Layout): Post[] {
  const out: Post[] = [];
  const inset = layout.postAt;
  const place = (x: number, z: number) => {
    const p = project(
      { pitch: 0, yaw: YAW_FOR_ORDER, scale: 1, cx: 0, cy: 0 },
      x,
      0,
      z,
    );
    out.push({ x, z, depth: p.depth });
  };
  if (top.posts === 4) {
    for (const [sx, sz] of [
      [-1, 1],
      [1, 1],
      [1, -1],
      [-1, -1],
    ] as const) {
      place(sx * inset, sz * inset);
    }
  } else if (top.posts === 3) {
    for (const deg of [30, 150, 270]) {
      const a = (deg * Math.PI) / 180;
      place(inset * Math.cos(a), inset * Math.sin(a));
    }
  } else if (top.posts === 2) {
    place(-inset, inset);
    place(inset, -inset);
  }
  return out;
}

/** The yaw the posts are ordered by — the camera's, so what is behind the
 *  glass is painted before it. */
const YAW_FOR_ORDER = (-11 * Math.PI) / 180;

function paintPost(
  ctx: CanvasRenderingContext2D,
  cam: Camera,
  top: TopSpec,
  post: Post,
  B: number,
): void {
  const hi = project(cam, post.x, B, post.z);
  const lo = project(cam, post.x, -B, post.z);
  const r = top.postR * cam.scale;
  const color = rgbOf(top.postColor);
  const light = rgbOf(top.postLight);
  const dark = mix(color, [0, 0, 0], 0.45);
  const w = top.post === "band" ? r * 2.6 : r * 2;
  const g = ctx.createLinearGradient(hi.x - w / 2, 0, hi.x + w / 2, 0);
  if (top.post === "band") {
    g.addColorStop(0, css(light, 0.9));
    g.addColorStop(0.15, css(color));
    g.addColorStop(0.85, css(color));
    g.addColorStop(1, css(dark));
  } else {
    g.addColorStop(0, css(dark));
    g.addColorStop(0.3, css(light));
    g.addColorStop(0.55, css(color));
    g.addColorStop(1, css(dark));
  }
  ctx.fillStyle = g;
  if (top.post === "baluster") {
    // A turned spindle: a profile of swellings and necks, symmetric about
    // the middle, drawn as a polygon the gradient lies across.
    ctx.beginPath();
    const n = 40;
    const left: Pt[] = [];
    const right: Pt[] = [];
    for (let k = 0; k <= n; k++) {
      const f = k / n;
      const x = hi.x + (lo.x - hi.x) * f;
      const y = hi.y + (lo.y - hi.y) * f;
      const half = (r * balusterWidth(f)) / 1;
      left.push({ x: x - half, y });
      right.push({ x: x + half, y });
    }
    left.forEach((p, k) =>
      k === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y),
    );
    for (let k = right.length - 1; k >= 0; k--)
      ctx.lineTo(right[k]!.x, right[k]!.y);
    ctx.closePath();
    ctx.fill();
    return;
  }
  ctx.beginPath();
  ctx.moveTo(hi.x - w / 2, hi.y);
  ctx.lineTo(hi.x + w / 2, hi.y);
  ctx.lineTo(lo.x + w / 2, lo.y);
  ctx.lineTo(lo.x - w / 2, lo.y);
  ctx.closePath();
  ctx.fill();
}

/** A spindle's half-width along its length, as a multiple of the post
 *  radius: a bead near each end, a long swell in the middle. */
export function balusterWidth(f: number): number {
  const bead = (at: number, w: number) =>
    Math.exp(-((f - at) ** 2) / (2 * w * w));
  return (
    0.55 +
    0.45 * bead(0.5, 0.16) +
    0.4 * bead(0.12, 0.03) +
    0.4 * bead(0.88, 0.03) +
    0.15 * bead(0.3, 0.02) +
    0.15 * bead(0.7, 0.02)
  );
}

function paintFinial(
  ctx: CanvasRenderingContext2D,
  cam: Camera,
  top: TopSpec,
  post: Post,
  y: number,
): void {
  if (top.finial === "none") return;
  const p = project(cam, post.x, y, post.z);
  const r = top.postR * cam.scale;
  const color = rgbOf(top.finialColor);
  const light = mix(color, [255, 255, 255], 0.55);
  const dark = mix(color, [0, 0, 0], 0.5);
  if (top.finial === "acorn") {
    // A hex nut, then the dome.
    const nut = r * 1.6;
    ctx.fillStyle = css(dark);
    ctx.fillRect(p.x - nut, p.y - nut * 1.1, 2 * nut, nut * 1.1);
    ctx.fillStyle = css(color);
    ctx.fillRect(p.x - nut * 0.55, p.y - nut * 1.1, nut * 1.1, nut * 1.1);
    const dome = r * 1.5;
    const g = ctx.createRadialGradient(
      p.x - dome * 0.4,
      p.y - nut * 1.1 - dome * 0.6,
      0,
      p.x,
      p.y - nut * 1.1,
      dome * 1.4,
    );
    g.addColorStop(0, css(light));
    g.addColorStop(0.5, css(color));
    g.addColorStop(1, css(dark));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(p.x, p.y - nut * 1.1, dome, dome * 1.25, 0, Math.PI, 0, false);
    ctx.closePath();
    ctx.fill();
    return;
  }
  const ball = r * 2;
  const g = ctx.createRadialGradient(
    p.x - ball * 0.4,
    p.y - ball * 1.3,
    0,
    p.x,
    p.y - ball,
    ball * 1.3,
  );
  g.addColorStop(0, css(light));
  g.addColorStop(0.45, css(color));
  g.addColorStop(1, css(dark));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(p.x, p.y - ball * 0.95, ball, 0, Math.PI * 2);
  ctx.fill();
}
