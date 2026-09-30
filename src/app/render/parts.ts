// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";

import type { Layout } from "../glass.ts";
import { GLASS, TOP, type Look, type TopSpec } from "../look.ts";
import { balusterWidth, postPositions } from "../paint.ts";
import { woodTexture } from "./textures.ts";

// The hourglass as solid things: the two plates, the posts between them,
// the finials on top, and the glass — each a lathe or a box off the numbers
// `look.ts` and `glass.ts` hold, in the same unit (the whole height is 1,
// the waist at 0) and the same places the painter and Blender use. Nothing
// here is a dimension of its own: a frame is the spec's, fitted to its
// glass by `layoutOf`.

/** How many segments round a lathe: plenty, since the glass's outline is
 *  the thing the eye reads first. */
const ROUND = 96;

/** The material a top's plates are made of. */
function plateMaterial(top: TopSpec, glass: THREE.Material): THREE.Material {
  switch (top.finish) {
    case "wood":
      return new THREE.MeshPhysicalMaterial({
        map: woodTexture(top),
        roughness: 0.55,
        clearcoat: 0.25,
        clearcoatRoughness: 0.4,
      });
    case "metal":
      return new THREE.MeshStandardMaterial({
        color: new THREE.Color(top.face),
        metalness: 1,
        roughness: 0.28,
      });
    case "lacquer":
      return new THREE.MeshPhysicalMaterial({
        color: new THREE.Color(top.face),
        roughness: 0.3,
        clearcoat: 1,
        clearcoatRoughness: 0.06,
      });
    default:
      return glass;
  }
}

function postMaterial(top: TopSpec): THREE.Material {
  const color = new THREE.Color(top.postColor);
  // A wooden top's posts are its own wood (the oak's spindles, the pine's
  // dowels) unless they are dark — the walnut glass's black steel rods.
  // Every other top's are metal.
  const hsl = { h: 0, s: 0, l: 0 };
  color.getHSL(hsl);
  if (top.finish === "wood" && hsl.l > 0.2) {
    return new THREE.MeshPhysicalMaterial({
      color,
      roughness: 0.55,
      clearcoat: 0.2,
    });
  }
  return new THREE.MeshStandardMaterial({
    color,
    metalness: 1,
    roughness: 0.3,
  });
}

/** A lathe from `[r, y]` points. */
function lathe(
  points: [number, number][],
  material: THREE.Material,
): THREE.Mesh {
  const geometry = new THREE.LatheGeometry(
    points.map(([r, y]) => new THREE.Vector2(Math.max(0, r), y)),
    ROUND,
  );
  return new THREE.Mesh(geometry, material);
}

/** A turned round plate from `y0` to `y1`: a bevel under, a bead over. */
function roundPlate(
  reach: number,
  y0: number,
  y1: number,
  m: THREE.Material,
): THREE.Mesh {
  const t = y1 - y0;
  return lathe(
    [
      [0, y0],
      [reach * 0.93, y0],
      [reach * 0.985, y0 + t * 0.08],
      [reach, y0 + t * 0.25],
      [reach, y0 + t * 0.6],
      [reach * 0.975, y0 + t * 0.72],
      [reach * 0.965, y0 + t * 0.85],
      [reach * 0.94, y1],
      [0, y1],
    ],
    m,
  );
}

/** A square plate, its edges rounded. */
function squarePlate(
  reach: number,
  y0: number,
  y1: number,
  m: THREE.Material,
): THREE.Mesh {
  const t = y1 - y0;
  const mesh = new THREE.Mesh(
    new RoundedBoxGeometry(
      reach * 2,
      t,
      reach * 2,
      4,
      Math.min(t * 0.3, reach * 0.08),
    ),
    m,
  );
  mesh.position.y = (y0 + y1) / 2;
  return mesh;
}

/** One post from `y0` to `y1` at `(x, z)`. */
function post(
  top: TopSpec,
  x: number,
  z: number,
  y0: number,
  y1: number,
  m: THREE.Material,
): THREE.Mesh {
  const r = top.postR;
  let mesh: THREE.Mesh;
  if (top.post === "baluster") {
    const points: [number, number][] = [[0, y1]];
    const steps = 48;
    for (let k = 0; k <= steps; k++) {
      const f = k / steps;
      points.push([r * balusterWidth(f), y1 - (y1 - y0) * f]);
    }
    points.push([0, y0]);
    mesh = lathe(points.reverse(), m);
  } else if (top.post === "band") {
    mesh = new THREE.Mesh(
      new RoundedBoxGeometry(r * 2.6, y1 - y0, r * 0.5, 2, r * 0.12),
      m,
    );
    mesh.position.y = (y0 + y1) / 2;
    mesh.rotation.y = Math.PI / 4;
  } else {
    mesh = new THREE.Mesh(new THREE.CylinderGeometry(r, r, y1 - y0, 32), m);
    mesh.position.y = (y0 + y1) / 2;
  }
  mesh.position.x = x;
  mesh.position.z = z;
  return mesh;
}

/** A finial on the top plate at `(x, z)`, standing on `y`. */
function finial(
  top: TopSpec,
  x: number,
  z: number,
  y: number,
): THREE.Object3D | null {
  if (top.finial === "none") return null;
  const r = top.postR;
  const m = new THREE.MeshStandardMaterial({
    color: new THREE.Color(top.finialColor),
    metalness: 1,
    roughness: 0.3,
  });
  const group = new THREE.Group();
  if (top.finial === "acorn") {
    const nut = r * 1.6;
    const hex = new THREE.Mesh(
      new THREE.CylinderGeometry(nut, nut, nut * 1.1, 6),
      m,
    );
    hex.position.y = y + nut * 0.55;
    const dome: [number, number][] = [];
    for (let k = 0; k <= 12; k++) {
      const a = (Math.PI / 2) * (k / 12);
      dome.push([r * 1.5 * Math.cos(a), y + nut * 1.1 + r * 1.9 * Math.sin(a)]);
    }
    group.add(hex, lathe(dome, m));
  } else {
    const ball = new THREE.Mesh(new THREE.SphereGeometry(r * 2, 32, 16), m);
    ball.position.y = y + r * 1.9;
    group.add(ball);
  }
  group.position.x = x;
  group.position.z = z;
  return group;
}

/** The glass's own material: clear, thin, a little tinted, refracting what
 *  is behind it and reflecting the sky. */
export function glassMaterial(look: Look): THREE.MeshPhysicalMaterial {
  const spec = GLASS[look.glass];
  const tint = new THREE.Color();
  const m =
    /rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,\s/]+([\d.]+))?/.exec(
      spec.tint,
    );
  let alpha = 0.07;
  if (m) {
    tint.setRGB(
      Number(m[1]) / 255,
      Number(m[2]) / 255,
      Number(m[3]) / 255,
      THREE.SRGBColorSpace,
    );
    alpha = Number(m[4] ?? 1);
  }
  // The tint colours what passes through by its strength.
  const through = new THREE.Color(1, 1, 1).lerp(tint, Math.min(1, alpha * 2.2));
  return new THREE.MeshPhysicalMaterial({
    color: through,
    metalness: 0,
    roughness: 0.03,
    transmission: 1,
    thickness: 0.012 + 0.02 * spec.wall,
    ior: 1.5,
    specularIntensity: 1,
    // A clear glass is a mirror at the edges and a window in the middle
    // (Fresnel does that); the sky it mirrors is given its full strength.
    envMapIntensity: 2.4,
    side: THREE.DoubleSide,
    transparent: true,
  });
}

/** The glass: both bulbs as one lathe, from the bottom plate through the
 *  waist to the top. */
export function glassMesh(
  layout: Layout,
  material: THREE.Material,
): THREE.Mesh {
  const b = layout.bulb;
  const points: [number, number][] = [];
  const steps = 90;
  for (let k = 0; k <= steps; k++) {
    const y = -b.height + (2 * b.height * k) / steps;
    points.push([b.radiusAt(Math.abs(y)), y]);
  }
  const mesh = lathe(points, material);
  mesh.renderOrder = 2;
  return mesh;
}

/** The frame for a look, fitted to its glass: the plates, the posts and the
 *  finials. */
export function frameGroup(
  look: Look,
  layout: Layout,
  glass: THREE.Material,
): THREE.Group {
  const top = TOP[look.top];
  const group = new THREE.Group();
  const B = layout.bulb.height;
  const T = layout.thick;
  const plate = plateMaterial(top, glass);
  const make = top.plate === "square" ? squarePlate : roundPlate;
  const lower = make(layout.reach, -B - T, -B, plate);
  const upper = make(layout.reach, B, B + T, plate);
  group.add(lower, upper);
  if (top.inlay) {
    const inlay = new THREE.MeshStandardMaterial({
      color: new THREE.Color(top.inlay),
      metalness: 1,
      roughness: 0.25,
    });
    for (const y of [B + T + 0.0004, -B - T - 0.0004]) {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(layout.reach * 0.88, 0.0022, 8, ROUND),
        inlay,
      );
      ring.rotation.x = Math.PI / 2;
      ring.position.y = y;
      group.add(ring);
    }
  }
  if (top.posts > 0) {
    const pm = postMaterial(top);
    for (const p of postPositions(top, layout)) {
      group.add(post(top, p.x, p.z, -B - T * 0.5, B + T * 0.5, pm));
      const f = finial(top, p.x, p.z, B + T);
      if (f) group.add(f);
    }
  }
  group.traverse((o) => {
    if (o instanceof THREE.Mesh && o.material !== glass) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
  return group;
}

/** Everything a group holds, let go of. */
export function disposeGroup(group: THREE.Object3D): void {
  group.traverse((o) => {
    if (o instanceof THREE.Mesh) {
      o.geometry.dispose();
      const ms = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of ms) {
        for (const v of Object.values(m))
          if (v instanceof THREE.Texture) v.dispose();
        m.dispose();
      }
    }
  });
}
