// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import type { Frame, Post } from "./frame.ts";
import type { Pt } from "./paint.ts";
import type { Layout } from "./glass.ts";
import { GLASS, TOP } from "./look.ts";
import { LIGHT, axisY, css, ellipseOf, project, rgbOf } from "./scene.ts";

// The glass: its outline, what is seen through its back wall before the
// sand, and its front wall — the tint, the light on it (`glassLight`,
// rendered once per size) and the rings where it meets the plates.

/** The outline of both bulbs and the waist, on the screen. */
export function glassPath(ctx: CanvasRenderingContext2D, frame: Frame): void {
  const { cam, layout } = frame;
  const bulb = layout.bulb;
  const B = bulb.height;
  const n = 64;
  ctx.beginPath();
  // Down the right-hand side from the top plate to the bottom, then up the
  // left. The foot's ellipse is the plate's business; here the outline
  // simply starts at the foot's edge.
  for (let k = 0; k <= 2 * n; k++) {
    const f = k / n; // 0 at the top plate, 1 at the waist, 2 at the bottom
    const y = f <= 1 ? B * (1 - f) : -B * (f - 1);
    const r = bulb.radiusAt(Math.abs(y));
    const p = { x: cam.cx + cam.scale * r, y: axisY(cam, y) };
    if (k === 0) ctx.moveTo(p.x, p.y);
    else ctx.lineTo(p.x, p.y);
  }
  for (let k = 2 * n; k >= 0; k--) {
    const f = k / n;
    const y = f <= 1 ? B * (1 - f) : -B * (f - 1);
    const r = bulb.radiusAt(Math.abs(y));
    ctx.lineTo(cam.cx - cam.scale * r, axisY(cam, y));
  }
  ctx.closePath();
}

/** What is seen through the glass before the sand: the tint over the back
 *  wall, and the posts behind it, bent a little by the curve of the bulb. */
export function paintGlassBack(
  ctx: CanvasRenderingContext2D,
  frame: Frame,
  posts: Post[],
): void {
  const { cam, look, layout } = frame;
  const top = TOP[look.top];
  ctx.save();
  glassPath(ctx, frame);
  ctx.clip();
  // The back wall's tint.
  ctx.fillStyle = GLASS[look.glass].tint;
  ctx.fillRect(
    cam.cx - cam.scale,
    cam.cy - cam.scale,
    2 * cam.scale,
    2 * cam.scale,
  );
  // The posts behind, seen through the glass: pulled towards the axis and
  // widened, the way a round bulb bends what stands behind it.
  const B = layout.bulb.height;
  for (const post of posts) {
    if (post.depth >= 0 || top.posts === 0) continue;
    const hi = project(cam, post.x, B, post.z);
    const lo = project(cam, post.x, -B, post.z);
    const r = top.postR * cam.scale * 1.1;
    const color = rgbOf(top.postColor);
    ctx.fillStyle = css(color, 0.5);
    ctx.beginPath();
    const n = 48;
    const pts: Pt[] = [];
    for (let k = 0; k <= n; k++) {
      const f = k / n;
      const y = B - 2 * B * f;
      const wall = layout.bulb.radiusAt(Math.abs(y)) * cam.scale;
      const x = hi.x + (lo.x - hi.x) * f;
      const sy = hi.y + (lo.y - hi.y) * f;
      const off = x - cam.cx;
      // The nearer the post is to the bulb's edge at this height, the more
      // it is bent inward.
      const bend = Math.min(1, Math.abs(off) / Math.max(1, wall));
      const bent = cam.cx + off * (1 - 0.2 * bend * bend);
      pts.push({ x: bent, y: sy });
    }
    pts.forEach((p, k) =>
      k === 0 ? ctx.moveTo(p.x - r, p.y) : ctx.lineTo(p.x - r, p.y),
    );
    for (let k = pts.length - 1; k >= 0; k--)
      ctx.lineTo(pts[k]!.x + r, pts[k]!.y);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

/** The front wall: its tint over the sand, then the light on the glass —
 *  rendered from the bulb's own normals (`glassLight`) — and the feet. */
export function paintGlassFront(
  ctx: CanvasRenderingContext2D,
  frame: Frame,
): void {
  const { cam, look, layout } = frame;
  const spec = GLASS[look.glass];
  const bulb = layout.bulb;
  const B = bulb.height;
  const R = bulb.radius * cam.scale;
  ctx.save();
  glassPath(ctx, frame);
  ctx.clip();
  ctx.fillStyle = spec.tint;
  ctx.fillRect(
    cam.cx - cam.scale,
    cam.cy - cam.scale,
    2 * cam.scale,
    2 * cam.scale,
  );
  ctx.restore();
  if (frame.glassLight) {
    const layer = frame.glassLight;
    const w = layer.width / frame.dpr;
    const h = layer.height / frame.dpr;
    ctx.drawImage(layer, cam.cx - w / 2, cam.cy - h / 2, w, h);
  }
  // The feet, where the glass meets each plate: the ground edge of the
  // bulb, a darker ring.
  for (const y of [B, -B]) {
    const e = ellipseOf(cam, y, bulb.foot);
    ctx.beginPath();
    ctx.ellipse(e.cx, e.cy, e.rx, e.ry, 0, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(20, 30, 40, 0.35)";
    ctx.lineWidth = Math.max(1, R * 0.03);
    ctx.stroke();
  }
}

/** The two lights the glass is lit by: the key, high on the left and in
 *  front (`LIGHT`), and a cooler fill low on the right and behind, which
 *  is what puts the second, fainter line down the other side of a bulb. */
const FILL_LIGHT = [0.75, 0.25, -0.55] as const;

/**
 * The light on the glass, rendered pixel by pixel from the bulb's own
 * normals: a Blinn–Phong highlight where the surface faces halfway between
 * a light and the eye — sharp for the window, broad for the sheen — a
 * Fresnel term that brightens the glass where it turns away from the eye
 * (the edges, and the waist, where the wall is thickest), and the same
 * highlight again, dimmer, off the back wall. Rendered once for a size and
 * kept, since none of it moves with the sand; `dpr` device pixels to the
 * CSS pixel, `scale` pixels to the unit of height.
 */
export function glassLight(
  layout: Layout,
  spec: { wall: number },
  scale: number,
  pitch: number,
  dpr: number,
  light: boolean,
): HTMLCanvasElement | null {
  const bulb = layout.bulb;
  const B = bulb.height;
  const cosP = Math.cos(pitch);
  const wCss = 2 * bulb.radius * scale + 6;
  const hCss = 2 * B * scale * cosP + 6;
  const w = Math.ceil(wCss * dpr);
  const h = Math.ceil(hCss * dpr);
  const layer = document.createElement("canvas");
  layer.width = w;
  layer.height = h;
  const lc = layer.getContext("2d");
  if (!lc) return null;
  const img = lc.createImageData(w, h);
  const d = img.data;
  const [lx, ly, lz] = LIGHT;
  // Half vectors, light + eye, for the two lights.
  const hv = norm3(lx, ly + 0, lz + 1);
  const hf = norm3(FILL_LIGHT[0], FILL_LIGHT[1], FILL_LIGHT[2] + 1);
  const Rmax = bulb.radius;
  const ds = B / 400;
  for (let py = 0; py < h; py++) {
    // World height of this row: the waist is the middle.
    const y = (h / 2 - (py + 0.5)) / (dpr * scale) / cosP;
    const sAbs = Math.min(B, Math.abs(y));
    const r = bulb.radiusAt(sAbs);
    if (r <= 0) continue;
    // The profile's slope at this height, away from the waist: how the
    // wall leans. Above the waist a wall that widens with height leans
    // outward-down; below, the mirror.
    const slope =
      (bulb.radiusAt(Math.min(B, sAbs + ds)) -
        bulb.radiusAt(Math.max(0, sAbs - ds))) /
      (2 * ds);
    const len = Math.hypot(1, slope);
    const nR = 1 / len;
    const nY = (y >= 0 ? -slope : slope) / len;
    const thick = Math.pow(1 - r / Rmax, 3);
    for (let px = 0; px < w; px++) {
      const x = (px + 0.5 - w / 2) / (dpr * scale);
      if (Math.abs(x) > r) continue;
      const cosA = x / r;
      const sinA = Math.sqrt(Math.max(0, 1 - cosA * cosA));
      // The front wall's normal, and the back wall's.
      const nx = nR * cosA;
      const nz = nR * sinA;
      const front = (hx: readonly number[]) =>
        Math.max(0, nx * hx[0]! + nY * hx[1]! + nz * hx[2]!);
      const back = (hx: readonly number[]) =>
        Math.max(0, nx * hx[0]! + nY * hx[1]! - nz * hx[2]!);
      const key = front(hv);
      const fill = front(hf);
      const keyBack = back(hv);
      const sharp = Math.pow(key, 70);
      const broad = Math.pow(key, 7);
      const rim = Math.pow(1 - nz, 3.5);
      const fillLine = Math.pow(fill, 40);
      const backLine = Math.pow(keyBack, 90);
      const wall = 0.6 + 0.6 * spec.wall;
      let white =
        0.85 * sharp +
        0.16 * broad +
        0.42 * fillLine +
        0.28 * backLine +
        0.32 * thick * wall +
        (light ? 0.1 : 0.45 * wall) * rim;
      white = Math.min(1, white);
      // On a light page the edge is the wall's shadow, not its shine.
      const dark = light
        ? Math.min(1, 0.55 * rim * wall + 0.25 * thick)
        : 0.18 * rim * wall;
      const o = (py * w + px) * 4;
      // A white and a dark layer, composited here into one premultiplied
      // pixel: dark under white.
      const a = dark + white * (1 - dark);
      if (a <= 0.002) continue;
      const c = (white * 255) / a;
      d[o] = Math.min(255, Math.round(c * 0.98 + 8 * (1 - white)));
      d[o + 1] = Math.min(255, Math.round(c * 0.99 + 14 * (1 - white)));
      d[o + 2] = Math.min(255, Math.round(c + 22 * (1 - white)));
      d[o + 3] = Math.round(a * 255);
    }
  }
  lc.putImageData(img, 0, 0);
  return layer;
}

function norm3(x: number, y: number, z: number): [number, number, number] {
  const n = Math.hypot(x, y, z) || 1;
  return [x / n, y / n, z / n];
}
