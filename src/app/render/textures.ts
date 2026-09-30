// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import * as THREE from "three";

import type { SandSpec, TopSpec } from "../look.ts";

// The surfaces' pictures, drawn here rather than fetched: a wood's grain in
// its own colours, and the speckle of a sand. Deterministic — a hash, not a
// random number — so the same look is the same picture every time, and
// nothing is loaded from anywhere.

function hash(x: number, y: number): number {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

function noise(x: number, y: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const u = fx * fx * (3 - 2 * fx);
  const v = fy * fy * (3 - 2 * fy);
  const a = hash(ix, iy);
  const b = hash(ix + 1, iy);
  const c = hash(ix, iy + 1);
  const d = hash(ix + 1, iy + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

function rgb(color: THREE.Color): [number, number, number] {
  const c = color.clone().convertLinearToSRGB();
  return [c.r * 255, c.g * 255, c.b * 255];
}

/** A wood's grain: long rings, bent by a slow noise, in the spec's face,
 *  side and edge colours. Tiles along its length. */
export function woodTexture(top: TopSpec): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const image = ctx.createImageData(size, size);
  const face = rgb(new THREE.Color(top.face));
  const side = rgb(new THREE.Color(top.side));
  const edge = rgb(new THREE.Color(top.edge));
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const warp = noise(x / 64, y / 16) * 6 + noise(x / 16, y / 5) * 0.8;
      const ring = 0.5 + 0.5 * Math.sin((y / size) * Math.PI * 18 + warp);
      const fleck = noise(x / 3, y / 1.5);
      const t = Math.pow(ring, 3);
      const k = (y * size + x) * 4;
      for (let c = 0; c < 3; c++) {
        let v = face[c]! + (side[c]! - face[c]!) * t * 0.7;
        v += (edge[c]! - face[c]!) * 0.12 * (fleck - 0.5);
        image.data[k + c] = Math.max(0, Math.min(255, v));
      }
      image.data[k + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = 4;
  return texture;
}

/** A sand's speckle: every texel a grain, in the sand's colour, its shadow
 *  or its light, coarser for a coarse sand; and, for a sparkling one, a
 *  roughness picture with a glint in a grain here and there. */
export function sandTextures(sand: SandSpec): {
  map: THREE.DataTexture;
  rough: THREE.DataTexture;
} {
  const size = 256;
  const color = rgb(new THREE.Color(sand.color));
  const dark = rgb(new THREE.Color(sand.dark));
  const light = rgb(new THREE.Color(sand.light));
  const map = new Uint8Array(size * size * 4);
  const rough = new Uint8Array(size * size * 4);
  const cellSize = sand.grain === "coarse" ? 2 : 1;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const gx = Math.floor(x / cellSize);
      const gy = Math.floor(y / cellSize);
      const h = hash(gx, gy);
      const k = (y * size + x) * 4;
      const tone = h < 0.25 ? dark : h > 0.8 ? light : color;
      const mixK = h < 0.25 ? 0.4 : h > 0.8 ? 0.45 : 0;
      for (let c = 0; c < 3; c++) {
        map[k + c] = color[c]! + (tone[c]! - color[c]!) * mixK;
      }
      map[k + 3] = 255;
      const glint = sand.sparkle && hash(gx + 7.7, gy + 1.3) > 0.9;
      const r = glint ? 40 : 235;
      rough[k] = r;
      rough[k + 1] = r;
      rough[k + 2] = r;
      rough[k + 3] = 255;
    }
  }
  const make = (data: Uint8Array, srgb: boolean) => {
    const t = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
    t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    t.wrapS = THREE.RepeatWrapping;
    t.wrapT = THREE.RepeatWrapping;
    t.magFilter = THREE.LinearFilter;
    t.minFilter = THREE.LinearMipmapLinearFilter;
    t.generateMipmaps = true;
    t.needsUpdate = true;
    return t;
  };
  return { map: make(map, true), rough: make(rough, false) };
}
