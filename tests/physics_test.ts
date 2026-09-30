// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, expect, it } from "vitest";

import { bulbShape } from "../src/app/glass.ts";
import { GLASS, SAND } from "../src/app/look.ts";
import {
  BETA,
  G,
  GLASS_METRES,
  airborne,
  buzzFor,
  feedsHole,
  frictionOf,
  heapCentre,
  launch,
  letGo,
  muFlow,
  muStart,
  muStop,
  moving,
  setGravity,
  setSpin,
  step,
  streamPath,
  turnOver,
  wallAt,
  whirl,
} from "../src/app/physics.ts";
import {
  capacity,
  cellAt,
  createBulb,
  funnelFill,
  levelFill,
  pileFill,
  pour,
  settle,
  spokeAngle,
  volume,
  type Bulb,
} from "../src/app/sand.ts";

const shape = bulbShape(GLASS.teardrop, 0.41);
const REPOSE = SAND.quartz.repose;
const FRAME = 1 / 60;

/** Volume to within a fraction of a percent of the sand put in. */
const HAIR = 1e-3;

function bulb(rest: "waist" | "plate"): Bulb {
  return createBulb(shape, rest, REPOSE);
}

/** Everything in a bulb: the heap and the grains in the air. */
function total(b: Bulb): number {
  return volume(b) + airborne(b);
}

function run(b: Bulb, seconds: number, seed = 1): void {
  for (let t = 0; t < seconds; t += FRAME) step(b, FRAME, seed + t);
}

/** The steepest slope between two neighbouring cells of sand along any
 *  spoke, against gravity's lean. */
function steepest(b: Bulb): number {
  let worst = 0;
  const { n, m, height, floor, ceiling, lean, centre } = b;
  for (let a = 0; a < m; a++) {
    for (let i = 0; i < n - 1; i++) {
      const p = i * m + a;
      const q = (i + 1) * m + a;
      if (height[p]! - floor[i]! < 1e-9 || height[q]! - floor[i + 1]! < 1e-9)
        continue;
      if (
        ceiling[i]! - height[p]! < 1e-9 ||
        ceiling[i + 1]! - height[q]! < 1e-9
      )
        continue;
      const drop = height[p]! + lean[p]! - (height[q]! + lean[q]!);
      worst = Math.max(worst, Math.abs(drop) / (centre[i + 1]! - centre[i]!));
    }
  }
  return worst;
}

describe("the flowing layer", () => {
  it("keeps every grain while a heap slumps into a tilt", () => {
    const b = bulb("plate");
    const sand = capacity(b) * 0.4;
    pileFill(b, sand);
    setGravity(b, Math.sin(0.5), -Math.cos(0.5), 0);
    run(b, 3);
    expect(Math.abs(total(b) - sand) / sand).toBeLessThan(HAIR);
  });

  it("takes time to bring a heap down, and brings it to rest between its two angles", () => {
    const b = bulb("plate");
    const { still, moving: slide } = frictionOf(b);
    levelFill(b, capacity(b) * 0.1);
    // A heap dumped on the axis, far steeper than sand stands.
    pour(b, capacity(b) * 0.15);
    step(b, FRAME, 1);
    expect(steepest(b)).toBeGreaterThan(still);
    run(b, 5);
    expect(moving(b)).toBe(false);
    expect(steepest(b)).toBeLessThan(still * 1.03);
    // An avalanche runs on past the angle it started at.
    expect(steepest(b)).toBeGreaterThan(slide * 0.5);
  });

  it("leans a level heap into a tilt over a moment, not at once", () => {
    const b = bulb("plate");
    levelFill(b, capacity(b) * 0.35);
    const right = 0; // the spoke nearest +x
    const left = Math.round(b.m / 2);
    const at = (a: number) => b.height[(b.n - 8) * b.m + a]!;
    expect(Math.abs(spokeAngle(b, right))).toBeLessThan(0.2);
    // Fifty degrees: past the static angle, so the bed lets go. (Under it a
    // flat bed holds, as real sand does.)
    setGravity(b, Math.sin(0.87), -Math.cos(0.87), 0);
    step(b, FRAME, 1);
    const early = at(right) - at(left);
    run(b, 4);
    const late = at(right) - at(left);
    expect(late).toBeGreaterThan(0.02);
    expect(late).toBeGreaterThan(early * 2);
  });

  it("holds a flat bed tilted less than its static angle", () => {
    const b = bulb("plate");
    levelFill(b, capacity(b) * 0.35);
    const before = Float64Array.from(b.height);
    setGravity(b, Math.sin(0.5), -Math.cos(0.5), 0);
    run(b, 1);
    // A few grains at the edge, where the wall under the bed rises, settle
    // against it; the bed itself does not move.
    let mean = 0;
    for (let k = 0; k < before.length; k++)
      mean += Math.abs(before[k]! - b.height[k]!) / before.length;
    expect(mean).toBeLessThan(1e-4);
  });

  it("stands still once it has come to rest", () => {
    const b = bulb("plate");
    pileFill(b, capacity(b) * 0.3);
    settle(b);
    const before = Float64Array.from(b.height);
    run(b, 1);
    let most = 0;
    for (let k = 0; k < before.length; k++)
      most = Math.max(most, Math.abs(before[k]! - b.height[k]!));
    expect(most).toBeLessThan(1e-9);
    expect(moving(b)).toBe(false);
  });
});

describe("grains in the air", () => {
  it("turned over, a heap falls to the other end as a body and lands there, every grain of it", () => {
    const source = bulb("waist");
    const sink = bulb("plate");
    const sand = capacity(sink) * 0.4;
    pileFill(sink, sand);
    turnOver(source, sink);
    expect(volume(sink)).toBeLessThan(1e-12);
    expect(airborne(source)).toBeCloseTo(sand, 10);
    run(source, 0.05);
    expect(airborne(source)).toBeGreaterThan(sand * 0.5);
    run(source, 3);
    expect(source.air.count).toBe(0);
    expect(Math.abs(volume(source) - sand) / sand).toBeLessThan(HAIR);
    // The drop was felt, hard.
    expect(buzzFor(source.hits)).toBeGreaterThan(20);
  });

  it("stays inside the glass while it flies", () => {
    const source = bulb("waist");
    const sink = bulb("plate");
    pileFill(sink, capacity(sink) * 0.3);
    turnOver(source, sink);
    for (let t = 0; t < 1; t += FRAME) {
      step(source, FRAME, t);
      const air = source.air;
      for (let k = 0; k < air.count; k++) {
        const r = Math.hypot(air.x[k]!, air.z[k]!);
        expect(r).toBeLessThanOrEqual(wallAt(source, air.y[k]!) + 1e-9);
        expect(air.y[k]!).toBeLessThanOrEqual(shape.height + 1e-9);
      }
    }
  });

  it("is thrown up when the glass is jerked faster than a fall, and comes back down", () => {
    const b = bulb("plate");
    const sand = capacity(b) * 0.35;
    pileFill(b, sand);
    setGravity(b, 0, 1.2, 0);
    run(b, 0.1);
    expect(airborne(b)).toBeGreaterThan(0);
    setGravity(b, 0, -1, 0);
    run(b, 3);
    expect(b.air.count).toBe(0);
    expect(Math.abs(volume(b) - sand) / sand).toBeLessThan(HAIR);
  });

  it("throws once a stroke, not once a frame", () => {
    const b = bulb("plate");
    pileFill(b, capacity(b) * 0.35);
    setGravity(b, 0, 0.5, 0);
    step(b, FRAME, 1);
    const once = airborne(b);
    step(b, FRAME, 2);
    expect(airborne(b)).toBeCloseTo(once, 12);
  });
});

describe("the buzz", () => {
  it("is nothing for a stray grain and grows with the hit, to a limit", () => {
    expect(buzzFor(0)).toBe(0);
    expect(buzzFor(0.005)).toBe(0);
    expect(buzzFor(0.02)).toBeGreaterThan(0);
    expect(buzzFor(1)).toBeGreaterThan(buzzFor(0.05));
    expect(buzzFor(1e6)).toBe(40);
  });
});

describe("the stream", () => {
  it("falls straight onto the apex of a glass standing upright", () => {
    const sink = bulb("plate");
    pileFill(sink, capacity(sink) * 0.3);
    const path = streamPath(sink);
    for (let k = 0; k < path.count; k++) {
      expect(
        Math.hypot(path.points[k * 3]!, path.points[k * 3 + 2]!),
      ).toBeLessThan(1e-9);
    }
    expect(path.wall).toBe(path.count);
    const [i, a] = cellAt(sink, path.landX, path.landZ);
    expect(path.points[(path.count - 1) * 3 + 1]).toBeCloseTo(
      sink.height[i * sink.m + a]!,
      9,
    );
  });

  it("tilted, meets the glass under the waist and runs down it to the heap, never through it", () => {
    const sink = bulb("plate");
    pileFill(sink, capacity(sink) * 0.3);
    const t = (50 * Math.PI) / 180;
    setGravity(sink, Math.sin(t), -Math.cos(t), 0);
    const path = streamPath(sink);
    expect(path.wall).toBeLessThan(path.count);
    let last = Infinity;
    for (let k = 0; k < path.count; k++) {
      const x = path.points[k * 3]!;
      const y = path.points[k * 3 + 1]!;
      const z = path.points[k * 3 + 2]!;
      // Inside the glass all the way, and always going down.
      expect(Math.hypot(x, z)).toBeLessThanOrEqual(wallAt(sink, y) + 1e-9);
      expect(y).toBeLessThanOrEqual(last + 1e-12);
      last = y;
      // Once on the glass it stays on it.
      if (k >= path.wall) {
        expect(Math.hypot(x, z)).toBeGreaterThan(wallAt(sink, y) * 0.9);
      }
    }
    // It lands on the downhill side, at the heap.
    expect(path.landX).toBeGreaterThan(0);
    const [i, a] = cellAt(sink, path.landX, path.landZ);
    expect(path.points[(path.count - 1) * 3 + 1]).toBeCloseTo(
      sink.height[i * sink.m + a]!,
      9,
    );
  });
});

describe("the friction law (Pouliquen and Forterre 2002)", () => {
  const f = frictionOf(bulb("plate"));
  const deg = (t: number) => (Math.atan(t) * 180) / Math.PI;

  it("stops a thick layer at the sand's angle of repose, and starts it about a degree steeper", () => {
    expect(deg(muStop(f, 1))).toBeCloseTo(REPOSE, 0);
    const gap = deg(muStart(f, 1)) - deg(muStop(f, 1));
    expect(gap).toBeGreaterThan(0.8);
    expect(gap).toBeLessThan(1.6);
  });

  it("holds a thin layer steeper than a thick one", () => {
    // A layer a grain or two deep (0.5 mm on a 22 cm glass) against 1 cm.
    expect(muStop(f, 0.5e-3 / 0.22)).toBeGreaterThan(muStop(f, 1e-2 / 0.22));
    expect(deg(muStop(f, 1e-9))).toBeCloseTo(REPOSE + 9.7, 0);
  });

  it("is continuous at the flow rule's edge and comes to the start friction at rest", () => {
    const h = 0.01;
    expect(muFlow(f, h, BETA)).toBeCloseTo(muStop(f, h), 9);
    expect(muFlow(f, h, BETA * 1.0001)).toBeCloseTo(muStop(f, h), 4);
    // Under β the paper carries it toward the start friction by a power
    // γ = 10⁻³ — so slowly that it stays between the two until the flow
    // has all but stopped; at standstill the start friction holds (eq.
    // 3.7), which the flow applies as its static test.
    const slow = muFlow(f, h, 1e-12);
    expect(slow).toBeGreaterThan(muStop(f, h));
    expect(slow).toBeLessThan(muStart(f, h));
    // A faster flow meets more friction: it settles at a speed.
    expect(muFlow(f, h, BETA * 4)).toBeGreaterThan(muFlow(f, h, BETA * 1.5));
  });
});

describe("the stream's motion", () => {
  it("falls from the bore in the time a free fall takes", () => {
    const sink = bulb("plate");
    pileFill(sink, capacity(sink) * 0.3);
    const path = streamPath(sink);
    const drop = shape.height - path.points[(path.count - 1) * 3 + 1]!;
    // Leaving at √(g·D) and falling `drop`: v0·t + g·t²/2 = drop.
    const v0 = Math.sqrt(G * 2 * shape.bore);
    const t = (-v0 + Math.sqrt(v0 * v0 + 2 * G * drop)) / G;
    expect(path.times[path.count - 1]!).toBeCloseTo(t, 2);
    for (let k = 1; k < path.count; k++) {
      expect(path.times[k]!).toBeGreaterThan(path.times[k - 1]!);
    }
  });

  it("stops on the glass where friction holds it, and slides on where it does not", () => {
    const t = (50 * Math.PI) / 180;
    const sticky = bulb("plate");
    pileFill(sticky, capacity(sticky) * 0.3);
    setGravity(sticky, Math.sin(t), -Math.cos(t), 0);
    // Friction no wall could slide against: the rivulet stops where it
    // meets the glass, well above the heap.
    const held = streamPath(sticky, 50);
    const last = held.count - 1;
    expect(held.wall).toBeLessThanOrEqual(last);
    const [i, a] = cellAt(sticky, held.landX, held.landZ);
    expect(held.points[last * 3 + 1]!).toBeGreaterThan(
      sticky.height[i * sticky.m + a]! + 0.01,
    );
    // Sand on glass slides down to the heap.
    const slid = streamPath(sticky);
    const [j, b] = cellAt(sticky, slid.landX, slid.landZ);
    expect(slid.points[(slid.count - 1) * 3 + 1]!).toBeCloseTo(
      sticky.height[j * sticky.m + b]!,
      9,
    );
  });
});

describe("a glass turned by a tap", () => {
  /** A tap's turn as the loop drives it (`Hourglass.tsx`): half a turn
   *  about the axis into the screen over `T` seconds, eased in and out,
   *  the sand handed to the other ends at the half turn. */
  const T = 0.72;
  function turnFrame(
    source: Bulb,
    sink: Bulb,
    t: number,
    swapped: { done: boolean },
  ): void {
    const p = Math.min(1, t / T);
    const early = p < 0.5;
    const e = p >= 1 ? 1 : early ? 2 * p * p : 1 - (-2 * p + 2) ** 2 / 2;
    const angle = Math.PI * e;
    const w = p >= 1 ? 0 : (Math.PI * (early ? 4 * p : 4 * (1 - p))) / T;
    const alpha = p >= 1 ? 0 : (Math.PI * (early ? 4 : -4)) / (T * T);
    if (!early && !swapped.done) {
      turnOver(source, sink, true);
      swapped.done = true;
    }
    const k = swapped.done ? -1 : 1;
    for (const b of [source, sink]) {
      setSpin(b, p < 1 ? [0, 0, k * w] : null, [0, 0, k * alpha]);
      setGravity(b, k * Math.sin(-angle), -k * Math.cos(-angle), 0);
    }
  }

  it("pulls sand out from the waist harder the farther it lies, and bends a moving grain across its path", () => {
    const b = bulb("waist");
    // Turning at the speed of a tap's half turn at its fastest, with no
    // gravity: only the turn's own pull.
    setSpin(b, [0, 0, 8]);
    setGravity(b, 0, 0, 0);
    launch(b, 0, 0.1, 0, 0, 0, 0, 1e-9);
    launch(b, 0, 0.35, 0, 0, 0, 0, 1e-9);
    launch(b, 0, 0.2, 0, 0, 1, 0, 1e-9);
    step(b, 0.02, 1);
    // Out along the axis, away from the waist: ω²r.
    expect(b.air.vy[0]!).toBeCloseTo(64 * 0.1 * 0.02, 1);
    expect(b.air.vy[1]!).toBeGreaterThan(b.air.vy[0]! * 3);
    // Coriolis: −2ω×v, sideways for a grain running along the glass.
    expect(b.air.vx[2]!).toBeGreaterThan(0.2);
  });

  it("lets a heap go cell by cell where the pull leaves the floor, far from the waist first", () => {
    const upper = bulb("waist");
    const sand = capacity(upper) * 0.4;
    funnelFill(upper, sand, sand);
    setSpin(upper, [0, 0, 8]);
    // Gravity still along the glass, a little: the turn beats it only far
    // from the waist.
    setGravity(upper, 0.5, -0.2, 0);
    const gone = letGo(upper);
    expect(gone).toBeGreaterThan(sand * 0.05);
    expect(gone).toBeLessThan(sand * 0.95);
    let y = 0;
    for (let k = 0; k < upper.air.count; k++) y += upper.air.y[k]!;
    expect(y / upper.air.count).toBeGreaterThan(heapCentre(upper)[1]);
    expect(Math.abs(total(upper) - sand) / sand).toBeLessThan(1e-12);
    // The lower bulb, on its side: the turn presses its sand to the plate.
    const lower = bulb("plate");
    pileFill(lower, sand);
    setSpin(lower, [0, 0, 8]);
    setGravity(lower, 1, 0, 0);
    expect(letGo(lower)).toBe(0);
  });

  it("slides the sand from the start of the turn, drops it unevenly, and lands it before the turn ends", () => {
    const source = bulb("waist");
    const sink = bulb("plate");
    const sand = capacity(source) * 0.45;
    funnelFill(source, sand, sand * 0.6);
    pileFill(sink, sand * 0.4);
    const start = Float64Array.from(sink.height);
    const swapped = { done: false };
    let slid = Infinity;
    let fell = Infinity;
    for (let t = 0; t < T + 1; t += FRAME) {
      turnFrame(source, sink, t, swapped);
      step(source, FRAME, t);
      step(sink, FRAME, t + 0.5);
      if (!swapped.done) {
        let most = 0;
        for (let k = 0; k < start.length; k++)
          most = Math.max(most, Math.abs(sink.height[k]! - start[k]!));
        if (most > 0.01) slid = Math.min(slid, t);
      }
      if (airborne(source) + airborne(sink) > sand * 0.1)
        fell = Math.min(fell, t);
      if (t > T * 0.95 && t < T) {
        // Landed, near enough all of it, while the glass is still turning.
        expect(airborne(source) + airborne(sink)).toBeLessThan(sand * 0.02);
      }
    }
    // Sliding within the first third of the turn, falling before the half.
    expect(slid).toBeLessThan(T / 3);
    expect(fell).toBeLessThan(T / 2);
    // Where the turn threw it: to one side, not back on the axis.
    expect(Math.abs(heapCentre(sink)[0])).toBeGreaterThan(
      source.centre[0]! * 2 * 3,
    );
    expect(Math.abs(total(source) + total(sink) - sand) / sand).toBeLessThan(
      HAIR,
    );
    expect(Math.abs(volume(source) - sand * 0.4) / sand).toBeLessThan(HAIR);
  });

  it("feeds the hole only when the sand is at it and the glass is within the lean that halts a run", () => {
    const halts = Math.tan((60 * Math.PI) / 180);
    const b = bulb("waist");
    setGravity(b, 0, -1, 0);
    expect(feedsHole(b, halts)).toBe(false);
    levelFill(b, capacity(b) * 0.4);
    expect(feedsHole(b, halts)).toBe(true);
    // Leaned 50°: still fed. On its side at 70°, or upside down: not.
    const lean = (deg: number) => {
      const r = (deg * Math.PI) / 180;
      setGravity(b, Math.sin(r), -Math.cos(r), 0);
      return feedsHole(b, halts);
    };
    expect(lean(50)).toBe(true);
    expect(lean(70)).toBe(false);
    expect(lean(180)).toBe(false);
  });

  it("runs the sand before the turn ends: it reaches the hole in the turn's last part", () => {
    const halts = Math.tan((60 * Math.PI) / 180);
    const source = bulb("waist");
    const sink = bulb("plate");
    const sand = capacity(source) * 0.45;
    funnelFill(source, sand, sand * 0.6);
    pileFill(sink, sand * 0.4);
    const swapped = { done: false };
    let fed = Infinity;
    for (let t = 0; t <= T; t += FRAME) {
      turnFrame(source, sink, t, swapped);
      step(source, FRAME, t);
      step(sink, FRAME, t + 0.5);
      if (swapped.done && fed === Infinity && feedsHole(source, halts)) fed = t;
    }
    // Not before the glass is past its side, and a good while before it
    // stands again.
    expect(fed).toBeGreaterThan(T / 2);
    expect(fed).toBeLessThan(T * 0.9);
  });
});

describe("a glass spun about its own axis", () => {
  /** Spin the glass at `rate` rad/s for `seconds`, standing upright. */
  function spin(b: Bulb, rate: number, seconds: number): void {
    for (let t = 0; t < seconds; t += FRAME) {
      whirl(b, rate, FRAME);
      setGravity(b, 0, -1, 0);
      step(b, FRAME, t);
    }
  }
  /** How deep the sand stands in ring `i`, round it. */
  function depth(b: Bulb, i: number): number {
    let d = 0;
    for (let a = 0; a < b.m; a++) d += b.height[i * b.m + a]! - b.floor[i]!;
    return d / b.m;
  }

  it("takes up the spin as friction drags the sand round, not at once, and runs on when it stops", () => {
    const b = bulb("plate");
    pileFill(b, capacity(b) * 0.3);
    setGravity(b, 0, -1, 0);
    whirl(b, 20, FRAME);
    // At most (4/3)·μ·g/R of spin-up a second.
    const most = ((4 / 3) * 0.4 * G * FRAME) / shape.radius;
    expect(b.whirl).toBeCloseTo(most, 9);
    for (let t = 0; t < 0.5; t += FRAME) whirl(b, 20, FRAME);
    expect(b.whirl).toBe(20);
    whirl(b, 0, FRAME);
    expect(b.whirl).toBeCloseTo(20 - most, 9);
    expect(moving(b)).toBe(true);
  });

  it("leaves the heap as it lies at a slow spin, and piles it up the wall at a fast one, every grain kept and none to a side", () => {
    const slow = bulb("plate");
    const sand = capacity(slow) * 0.3;
    pileFill(slow, sand);
    const lying = Float64Array.from(slow.height);
    spin(slow, 5, 1.5);
    let moved = 0;
    for (let k = 0; k < lying.length; k++)
      moved = Math.max(moved, Math.abs(slow.height[k]! - lying[k]!));
    // Under a millimetre anywhere: a heap on the edge of its start angle
    // is nudged, and that is all.
    expect(moved).toBeLessThan(1e-3 / GLASS_METRES);

    const fast = bulb("plate");
    pileFill(fast, sand);
    const wall = fast.n - 2;
    const middle = depth(fast, 0);
    const edge = depth(fast, wall);
    spin(fast, 20, 1.5);
    // Out from the axis and up the glass: ω²r against gravity.
    expect(depth(fast, 0)).toBeLessThan(middle * 0.8);
    expect(depth(fast, wall)).toBeGreaterThan(edge + 0.01);
    const [x, , z] = heapCentre(fast);
    expect(Math.hypot(x, z)).toBeLessThan(1e-6);
    expect(Math.abs(volume(fast) - sand) / sand).toBeLessThan(HAIR);
  });
});
