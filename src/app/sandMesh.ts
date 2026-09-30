// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { rimAt, spokeAngle, type Bulb } from "./sand.ts";
import { rimEdge } from "./scene.ts";

// The heap as a mesh: the numbers the renderer draws the sand's surface
// and its skin against the glass from, in the bulb's own frame (x and z
// across, y the height from the end it rests against). Pure — no WebGL
// here — so the tests can walk it.
//
// THE SURFACE is a grid: one vertex over the axis, then a ring of `m` for
// each of the `n` rings and one more for the wall. A spoke's vertices out
// to its last cell of sand stand on the sand; past it, they stand where
// the sand meets the glass (`rimEdge`), so the surface comes down to the
// wall rather than climbing it. Each vertex carries a `presence`: 1 where
// there is sand, 0 where the cell is bare glass — the shader drops what
// is not sand, so an emptied funnel shows the glass through its middle.
//
// THE SKIN is where the sand touches the glass: everything on the wall
// below the height the heap meets it, spoke by spoke (`rimHeights`), which
// is what you see of sand from the side — the body of it, pressed against
// the glass. The renderer draws the wall's own shape and cuts it there.

/** Vertices in a surface for a bulb of `n` rings and `m` spokes. */
export function surfaceVertexCount(n: number, m: number): number {
  return 1 + (n + 1) * m;
}

/** The triangles of the surface grid, as indices: a fan over the axis,
 *  then two a quad out to the wall. */
export function surfaceIndex(n: number, m: number): Uint32Array {
  const out: number[] = [];
  const v = (i: number, a: number) => 1 + i * m + ((a + m) % m);
  for (let a = 0; a < m; a++) out.push(0, v(0, a + 1), v(0, a));
  for (let i = 0; i < n; i++) {
    for (let a = 0; a < m; a++) {
      const p = v(i, a);
      const q = v(i, a + 1);
      const r = v(i + 1, a + 1);
      const s = v(i + 1, a);
      out.push(p, q, r, p, r, s);
    }
  }
  return Uint32Array.from(out);
}

/** Below this depth a cell is bare glass. */
const BARE = 1e-5;

/**
 * Write the heap's surface into `positions` (x, y, z a vertex) and
 * `presence` (one a vertex), for `surfaceIndex`'s grid.
 */
export function surfaceInto(
  bulb: Bulb,
  positions: Float32Array,
  presence: Float32Array,
): void {
  const { n, m, centre, height, floor } = bulb;
  let axis = 0;
  let axisSand = 0;
  for (let a = 0; a < m; a++) {
    axis += height[a]!;
    axisSand = Math.max(axisSand, height[a]! - floor[0]!);
  }
  positions[0] = 0;
  positions[1] = axis / m;
  positions[2] = 0;
  presence[0] = axisSand > BARE ? 1 : 0;
  for (let a = 0; a < m; a++) {
    const t = spokeAngle(bulb, a);
    const c = Math.cos(t);
    const s = Math.sin(t);
    const last = rimAt(bulb, a);
    const edge = last >= 0 ? rimEdge(bulb, a) : null;
    for (let i = 0; i <= n; i++) {
      const k = 1 + i * m + a;
      let r: number;
      let h: number;
      let p: number;
      if (i < n && i <= last) {
        r = centre[i]!;
        h = height[i * m + a]!;
        p = h - floor[i]! > BARE ? 1 : 0;
      } else if (edge) {
        r = edge.r;
        h = edge.h;
        p = 1;
      } else {
        const j = Math.min(i, n - 1);
        r = centre[j]!;
        h = floor[j]!;
        p = 0;
      }
      positions[k * 3] = r * c;
      positions[k * 3 + 1] = h;
      positions[k * 3 + 2] = r * s;
      presence[k] = p;
    }
  }
}

/** Where the heap meets the glass on each spoke, as a height from the
 *  resting end, or −1 on a spoke with no sand: the skin's cut. */
export function rimHeights(bulb: Bulb, out: Float32Array): void {
  for (let a = 0; a < bulb.m; a++) {
    const e = rimAt(bulb, a) >= 0 ? rimEdge(bulb, a) : null;
    out[a] = e ? e.h : -1;
  }
}
