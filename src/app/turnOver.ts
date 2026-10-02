// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { EPS, PER_CELL, inCell, launch } from "./physics.ts";
import { clear, pour, type Bulb } from "./sand.ts";

// Turning the glass over, for the sand: each heap lets go of the end it
// rested against and falls to the other, as grains (`physics.ts` flies
// them and lands them) — but for the columns that stand from end to end,
// the sand a glass turned slowly onto its side has lying along its wall,
// which are the same columns read from the other end and stay as they
// are. Pure and clock-free, and volume-exact: every grain is sand taken
// off a cell, and every kept column holds what it held.

/**
 * Turn the glass over: the heap in each bulb lets go of the end it rested
 * against and falls to the other, which is where the other bulb's role
 * now rests. `a` and `b` swap their sand — `a`'s falls into `b`'s frame
 * and `b`'s into `a`'s — as grains, `PER_CELL` a cell, so the heap drops as a
 * body and lands in a scatter the flow then brings to its angle.
 *
 * `mirror` is for a glass turned in the picture — half a turn about the
 * axis into the screen, so what was on the right is on the left. A glass
 * turned with the phone is the same glass in the same place on the screen,
 * only upside down, and nothing crosses over.
 */
export function turnOver(a: Bulb, b: Bulb, mirror = true): void {
  const fullA = fullColumns(a);
  const fullB = fullColumns(b);
  const fromA = grainsOf(a, fullA);
  const fromB = grainsOf(b, fullB);
  clear(a);
  clear(b);
  keep(b, fullA, mirror);
  keep(a, fullB, mirror);
  place(b, fromA, mirror);
  place(a, fromB, mirror);
}

/** How near the far end a column's sand must stand to count as full. */
const FULL = 0.02;

/** The columns of a heap that stand from end to end of the bulb — a glass
 *  on its side has its sand along the wall so — as their sand by cell;
 *  zero for every other. Such a column is the same column either way up:
 *  it has nowhere to fall, and is not let go. */
function fullColumns(bulb: Bulb): Float64Array {
  const { n, m, floor, ceiling, height } = bulb;
  const out = new Float64Array(n * m);
  for (let i = 0; i < n; i++) {
    const length = ceiling[i]! - floor[i]!;
    if (length <= EPS) continue;
    for (let a = 0; a < m; a++) {
      const k = i * m + a;
      const depth = height[k]! - floor[i]!;
      if (depth >= length * (1 - FULL)) out[k] = depth;
    }
  }
  return out;
}

/** The spoke across the axis from `a`, for a glass turned in the
 *  picture: x for −x. */
function mirrorSpoke(m: number, a: number): number {
  return (((m / 2 - 1 - a) % m) + m) % m;
}

/** Full columns from the other bulb, into this one's frame: the same
 *  cell, end to end — a bulb's floor is the other's ceiling read from the
 *  other end. */
function keep(bulb: Bulb, full: Float64Array, mirror: boolean): void {
  const { n, m, floor, height } = bulb;
  for (let i = 0; i < n; i++) {
    for (let a = 0; a < m; a++) {
      const depth = full[i * m + a]!;
      if (depth <= 0) continue;
      const k = i * m + (mirror ? mirrorSpoke(m, a) : a);
      height[k] = floor[i]! + depth;
    }
  }
}

type Grain = [number, number, number, number, number, number, number];

/** The sand of a bulb as grains in its own frame: the heap, `PER_CELL` a
 *  cell, but for its full columns, and whatever is already in the air. */
function grainsOf(bulb: Bulb, full: Float64Array): Grain[] {
  const out: Grain[] = [];
  const { n, m, area, floor, height, air } = bulb;
  for (let i = 0; i < n; i++) {
    const cell = area[i]! / m;
    for (let a = 0; a < m; a++) {
      const k = i * m + a;
      const depth = height[k]! - floor[i]!;
      if (depth <= EPS || full[k]! > 0) continue;
      const part = (depth * cell) / PER_CELL;
      for (let j = 0; j < PER_CELL; j++) {
        const [x, z] = inCell(bulb, i, a, k + j / PER_CELL);
        const y = floor[i]! + (depth * (j + 0.5)) / PER_CELL;
        out.push([x, y, z, 0, 0, 0, part]);
      }
    }
  }
  for (let k = 0; k < air.count; k++) {
    out.push([
      air.x[k]!,
      air.y[k]!,
      air.z[k]!,
      air.vx[k]!,
      air.vy[k]!,
      air.vz[k]!,
      air.vol[k]!,
    ]);
  }
  return out;
}

/** Grains from the other end of the glass into this bulb's frame: the
 *  heights read from the other end, and — turned in the picture — right
 *  and left swapped. */
function place(bulb: Bulb, grains: Grain[], mirror: boolean): void {
  const H = bulb.shape.height;
  const k = mirror ? -1 : 1;
  for (const [x, y, z, vx, vy, vz, vol] of grains) {
    const X = k * x;
    const Y = H - y;
    if (!launch(bulb, X, Y, z, k * vx, -vy, vz, vol)) pour(bulb, vol, X, z);
  }
}
