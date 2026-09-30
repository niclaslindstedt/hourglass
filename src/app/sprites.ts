// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { useEffect, useState } from "react";

import type { Glass, Look, Top } from "./look.ts";

// The modelled parts of the hourglass: sprites rendered by Blender off the
// app's own data (`scripts/blender.mjs`, the `blender-assets` skill) and
// shipped under `public/models/` with a manifest that says where each one
// lands. `paint.ts` composites them in place of its own drawing of the
// plates, the posts, the finials and the light on the glass — and draws
// its own while they load, or where they are missing, so the picture is
// never empty.
//
// A sprite is a picture in SCREEN space: the app's camera has already
// projected it. `x`, `y`, `w`, `h` are its left, top, width and height in
// units of the hourglass's height from the waist, x to the right and y
// down, so it lands on the canvas at `cam.cx + x·scale`, `cam.cy +
// y·scale`. A part the app places more than once — a post, a finial —
// carries `at`, the world point it was rendered at, and is shifted by the
// difference between that point's projection and the place it goes.
//
// The files come from this origin like any other, precached by the
// service worker and bundled into the phone and desktop apps; nothing is
// fetched from anywhere else.

export type Sprite = {
  file: string;
  x: number;
  y: number;
  w: number;
  h: number;
  at?: { x: number; y: number; z: number };
};

export type Manifest = {
  version: number;
  ppu: number;
  tops: Record<string, Record<string, Sprite>>;
  glasses: Record<string, { add: Sprite; multiply: Sprite }>;
  grain?: { file: string; size: number };
};

/** A sprite with its picture loaded — the picture itself, or for the
 *  glass's two passes a layer made from it (`glassLayer`). */
export type Loaded = Sprite & { image: CanvasImageSource };

/** What one look is drawn with, once loaded. Any part may be missing —
 *  the painter draws its own for it. */
export type LookSprites = {
  plate: Loaded | null;
  /** The post, or for bands the two posts that face two ways. */
  posts: Loaded[];
  finial: Loaded | null;
  glassAdd: Loaded | null;
  glassMultiply: Loaded | null;
  grain: HTMLImageElement | null;
};

const BASE = `${import.meta.env.BASE_URL}models/`;

let manifest: Promise<Manifest | null> | null = null;
const images = new Map<string, Promise<HTMLImageElement | null>>();

/** The manifest, fetched once; null where the build ships no models. */
function loadManifest(): Promise<Manifest | null> {
  if (!manifest) {
    manifest = fetch(`${BASE}manifest.json`)
      .then((r) => (r.ok ? (r.json() as Promise<Manifest>) : null))
      .catch(() => null);
  }
  return manifest;
}

/** One picture, fetched once and decoded; null where it is missing. */
function loadImage(file: string): Promise<HTMLImageElement | null> {
  let p = images.get(file);
  if (!p) {
    p = new Promise<HTMLImageElement | null>((done) => {
      const img = new Image();
      img.decoding = "async";
      img.onload = () => done(img);
      img.onerror = () => done(null);
      img.src = `${BASE}${file}`;
    });
    images.set(file, p);
  }
  return p;
}

async function withImage(sprite: Sprite | undefined): Promise<Loaded | null> {
  if (!sprite) return null;
  const image = await loadImage(sprite.file);
  return image ? { ...sprite, image } : null;
}

/** The glass's passes as layers, made once a file. */
const layers = new Map<string, Promise<HTMLCanvasElement | null>>();

/**
 * One of the glass's two passes, made into a layer that holds over
 * ANYTHING behind it — a sky, a page, or nothing at all.
 *
 * Blender renders them opaque: the multiply pass white wherever the glass
 * takes nothing away, the add pass black wherever it gives nothing. Drawn
 * with `multiply` and `lighter` over an opaque picture that is neutral,
 * but a canvas that is transparent behind the glass (the preset cards,
 * over whatever card they sit on) has no picture to blend with, and the
 * blend paints the sprite as it is: a white slab behind every glass. So
 * the darkening becomes black at the strength it darkens by (`1 − m`,
 * which over any colour `c` leaves `c·m`, the multiply exactly, drawn
 * plainly), and the light becomes white at the strength it lights by (its
 * value as alpha, which `lighter` adds exactly as before) — and where the
 * glass does nothing, both are clear.
 */
export function glassLayer(
  image: HTMLImageElement,
  pass: "add" | "multiply",
): HTMLCanvasElement | null {
  const c = document.createElement("canvas");
  c.width = image.naturalWidth || image.width;
  c.height = image.naturalHeight || image.height;
  const ctx = c.getContext("2d");
  if (!ctx || c.width === 0 || c.height === 0) return null;
  ctx.drawImage(image, 0, 0);
  const data = ctx.getImageData(0, 0, c.width, c.height);
  const p = data.data;
  for (let k = 0; k < p.length; k += 4) {
    const a = p[k + 3]! / 255;
    const v = (0.299 * p[k]! + 0.587 * p[k + 1]! + 0.114 * p[k + 2]!) / 255;
    const shade = pass === "multiply" ? 1 - v : v;
    const tone = pass === "multiply" ? 0 : 255;
    p[k] = tone;
    p[k + 1] = tone;
    p[k + 2] = tone;
    p[k + 3] = Math.round(255 * a * Math.min(1, Math.max(0, shade)));
  }
  ctx.putImageData(data, 0, 0);
  return c;
}

async function withGlassLayer(
  sprite: Sprite | undefined,
  pass: "add" | "multiply",
): Promise<Loaded | null> {
  if (!sprite) return null;
  let p = layers.get(sprite.file);
  if (!p) {
    p = loadImage(sprite.file).then((img) => {
      if (!img) return null;
      try {
        return glassLayer(img, pass);
      } catch {
        return null;
      }
    });
    layers.set(sprite.file, p);
  }
  const image = await p;
  return image ? { ...sprite, image } : null;
}

/** Everything a look is drawn with, loaded — or null while it loads and
 *  where the build carries no models at all. */
export async function loadLookSprites(
  top: Top,
  glass: Glass,
): Promise<LookSprites | null> {
  const m = await loadManifest();
  if (!m) return null;
  const t = m.tops[top] ?? {};
  const g = m.glasses[glass];
  const posts = t["post"]
    ? [t["post"]]
    : t["post-a"] && t["post-b"]
      ? [t["post-a"], t["post-b"]]
      : [];
  const [plate, finial, glassAdd, glassMultiply, grain, ...loadedPosts] =
    await Promise.all([
      withImage(t[`plate-${glass}`]),
      withImage(t["finial"]),
      withGlassLayer(g?.add, "add"),
      withGlassLayer(g?.multiply, "multiply"),
      m.grain ? loadImage(m.grain.file) : Promise.resolve(null),
      ...posts.map(withImage),
    ]);
  return {
    plate,
    posts: loadedPosts.filter((p): p is Loaded => p !== null),
    finial,
    glassAdd,
    glassMultiply,
    grain,
  };
}

/** The sprites for a look, as they load: null until they have, and null
 *  for good where there are none — or while `enabled` is off, for a
 *  picture drawn by the stage rather than the painter. */
export function useSprites(look: Look, enabled = true): LookSprites | null {
  const [sprites, setSprites] = useState<LookSprites | null>(null);
  useEffect(() => {
    let live = true;
    setSprites(null);
    if (!enabled) return;
    void loadLookSprites(look.top, look.glass).then((s) => {
      if (live) setSprites(s);
    });
    return () => {
      live = false;
    };
  }, [look.top, look.glass, enabled]);
  return sprites;
}
