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

/** A sprite with its picture loaded. */
export type Loaded = Sprite & { image: HTMLImageElement };

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
      withImage(g?.add),
      withImage(g?.multiply),
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
