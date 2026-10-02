// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { useCallback, useEffect, useRef, useState } from "react";

import type { Place } from "./astronomy.ts";
import { layoutOf, type Layout } from "./glass.ts";
import { SAND, type Look } from "./look.ts";
import { paintFlat } from "./paintFlat.ts";
import {
  airborne,
  buzzFor,
  feedsHole,
  moving,
  setGravity,
  setSpin,
  step as stepSand,
  whirl,
  streamPath,
  type StreamPath,
} from "./physics.ts";
import { Stage } from "./render/stage.ts";
import {
  capacity,
  createBulb,
  drain,
  funnelFill,
  levelFill,
  pileFill,
  pour,
  settle,
  volume,
  type Bulb,
} from "./sand.ts";
import { bodiesFor, skyLookFor, type SkyChoice, type SkyLook } from "./sky.ts";
import { useSprites } from "./sprites.ts";
import { turnOver } from "./turnOver.ts";
import { KEY_ZOOM, useZoom } from "./useZoom.ts";
import { pageTurn, uprightDelta } from "./upright.ts";
import {
  deviceToEarth,
  leanStops,
  nextGravity,
  STOP_LEAN,
  type Gravity,
  type Motion,
  type Vec3,
} from "./useMotion.ts";
import { useT } from "./i18n/index.ts";
import {
  halt,
  isRunning,
  passed,
  reset,
  RESET_MS,
  resetting,
  resume,
  shownSize,
  splitMinutes,
  stepMinutes,
  turn,
  type Run,
} from "./timer.ts";
import {
  createView,
  follow,
  intoGlass,
  matOf,
  stepView,
  viewStill,
  type View,
} from "./view.ts";

// The hourglass on the screen: the one thing the app shows, and the one
// thing it is worked with.
//
// A tap turns it over. A drag up or down makes it a longer or a shorter
// glass — and a bigger or a smaller one, because a glass that runs longer
// holds more sand. A drag sideways turns it about its own axis, to see the
// sand from another side; let go, it spins on and comes back to face you.
// A pinch, or the wheel, makes it look bigger or smaller and leaves the
// time alone. A long press resets it: the sand is drawn down into the
// lower bulb, and the glass stands still until it is turned.
//
// The sand is the model in `sand.ts`, one heap per bulb, and what moves it
// is the wall clock through `timer.ts`: every frame the top bulb is drained
// down to the share the clock says has passed and the same amount lands in
// the bottom one, where the stream falls. A tab that was asleep for an
// hour wakes to the right amount of sand on the right side. Nothing here
// counts frames. Where the sand then LIES is physics (`physics.ts`): the
// heaps flow under the gravity the glass feels, grains fly when it is
// jerked, and a turned-over heap falls to the other end and lands — with a
// buzz, on a phone that has one, for the sand hitting the glass.
//
// The phone is the glass (`useMotion`): turned over, the sand falls to the
// other end and runs the other way with nothing on the screen turning;
// leaned to a side, or back, or forward, the heaps slide that way and the
// stream falls at that slant; held on its side, the hole is not fed and the
// run halts until it is stood up again; shaken, the grains jump. The glass
// hangs in the phone with a little give (`view.ts`), and the sky behind it
// (`sky.ts`, `render/stage.ts`) stays level with the world as the phone
// turns — the sun, the moon and the stars where they are outside.

/** How much of a bulb the sand fills. Measured: a little under half. */
export const FILL = 0.45;

/** How long a turn takes on screen, how far a drag goes between two
 *  lengths, and how long the length shows. */
const TURN_MS = 720;
const DRAG_STEP_PX = 44;
const LABEL_MS = 1600;

/** How long a press is held, still, before it resets the glass, ms. */
const LONG_PRESS_MS = 550;

/** How far a sideways drag turns the glass, rad a pixel. */
const ORBIT_PER_PX = 0.012;

/** The shortest gap between two buzzes, ms. */
const BUZZ_GAP_MS = 70;

/** How often the sky is worked out again: the sun moves a degree in four
 *  minutes, so every few seconds is far finer than the eye. */
const SKY_EVERY_MS = 5000;

type Props = {
  look: Look;
  run: Run;
  /** How much bigger or smaller than its length's own size the glass is
   *  shown (`shownSize`). */
  zoom: number;
  /** The phone's readings (`useMotion`). */
  motion: Motion;
  /** Which sky, and where the device is, for the sun and the moon. */
  sky: SkyChoice;
  place: Place;
  /** Whether sand hitting the glass buzzes the phone. */
  haptics: boolean;
  /** A tap landed on the glass — at its end, the moment a phone will grant
   *  its sensors from. */
  onPress?: () => void;
  /** The run the glass now has — turned, halted or set going by a tilt,
   *  or reset — to keep. Exactly the glass's own, so that the run coming
   *  back as a prop is recognised as it and the heaps are not built again
   *  from the clock. */
  onRun: (run: Run) => void;
  /** The glass was dragged to another length. */
  onMinutes: (minutes: number) => void;
  /** The glass was pinched to another size: the zoom, to keep. */
  onZoom: (zoom: number) => void;
  /** The sand has run out. */
  onDone: () => void;
  className?: string;
};

/** A tap's turn: when it began, the run it turned, and whether the sand
 *  has been handed to the other ends yet (at the half turn). */
type Flip = { start: number; from: Run; swapped: boolean };

/** A reset under way: when it began, and the share of the sand that was
 *  through then (`resetting`). */
type Reset = { start: number; from: number };

type Sim = {
  look: Look;
  layout: Layout;
  /** The bulb the sand runs out of, and the one it runs into. Which is
   *  the upper one on the screen depends on gravity. */
  source: Bulb;
  sink: Bulb;
  gravity: Gravity;
  /** Whether the sensor has said which way up the phone is yet. */
  heard: boolean;
  /** Whether the run was halted by a lean past `STOP_LEAN`. */
  stopped: boolean;
  frames: number;
  sand: number;
  run: Run;
  flip: Flip | null;
  reset: Reset | null;
  /** Whether the frame stands the other way up: a tap's turn turns the
   *  frame with it and leaves it so, where the glass, the same either way
   *  up, is drawn upright again. */
  upended: boolean;
  done: boolean;
  glow: number;
  view: View;
  /** The last frame's moment, ms of `performance.now()`. */
  last: number;
  lastBuzz: number;
  skyLook: SkyLook | null;
  skyAt: number;
  skyKey: string;
};

/** A vector turned about the axis into the screen. */
function aboutZ(v: Vec3, angle: number): Vec3 {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return [c * v[0] - s * v[1], s * v[0] + c * v[1], v[2]];
}

/** A vector in the glass's frame, into the frame the heaps are drawn in:
 *  half a turn round the glass's own axis once a tap's turn has handed the
 *  sand over. */
function halfTurned(v: Vec3, swapped: boolean): Vec3 {
  return swapped ? [-v[0], -v[1], v[2]] : v;
}

export function Hourglass({
  look,
  run,
  zoom,
  motion,
  sky,
  place,
  haptics,
  onPress,
  onRun,
  onMinutes,
  onZoom,
  onDone,
  className,
}: Props) {
  const t = useT();
  const host = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [label, setLabel] = useState<string | null>(null);
  const [upside, setUpside] = useState(false);
  // Three.js where the device has WebGL; the flat painter where it has not.
  const stage = useRef<Stage | null>(null);
  const [flat, setFlat] = useState(false);
  const sprites = useSprites(look, flat);
  const spritesRef = useRef(sprites);
  spritesRef.current = sprites;

  // The simulation, kept off React: refs, and a loop that draws straight
  // to the canvas. It is rebuilt cold when the glass changes — another
  // look, another length — and kept warm through a turn.
  const sim = useRef<Sim | null>(null);
  const size = useRef({ w: 0, h: 0, dpr: 1 });
  const frame = useRef<number | null>(null);
  const labelTimer = useRef<number | null>(null);
  const callbacks = useRef({
    onPress,
    onRun,
    onMinutes,
    onZoom,
    onDone,
  });
  callbacks.current = { onPress, onRun, onMinutes, onZoom, onDone };
  // The pinch's zoom (`useZoom`), which wakes the loop it is drawn by.
  const wakeRef = useRef<() => void>(() => {});
  const wakeSoon = useCallback(() => wakeRef.current(), []);
  const zoomer = useZoom(
    zoom,
    run.minutes,
    (z: number) => callbacks.current.onZoom(z),
    wakeSoon,
    host,
  );
  const zoomNow = zoomer.now;
  const options = useRef({ sky, place, haptics });
  options.current = { sky, place, haptics };

  /** Build both heaps for a run as the clock has it now. */
  const build = useCallback((nextLook: Look, nextRun: Run, now: number) => {
    const layout = layoutOf(nextLook);
    const repose = SAND[nextLook.sand].repose;
    const source = createBulb(layout.bulb, "waist", repose);
    const sink = createBulb(layout.bulb, "plate", repose);
    const previous = sim.current;
    const sand = capacity(source) * FILL;
    const f = passed(nextRun, now);
    if (f <= 0) levelFill(source, sand);
    else funnelFill(source, sand, sand * (1 - f));
    pileFill(sink, sand * f);
    sim.current = {
      look: nextLook,
      layout,
      source,
      sink,
      gravity: previous?.gravity ?? 1,
      heard: previous?.heard ?? false,
      stopped: previous?.stopped ?? false,
      frames: previous?.frames ?? 0,
      sand,
      run: nextRun,
      flip: null,
      reset: null,
      upended: previous?.upended ?? false,
      done: f >= 1,
      glow: 0,
      view: previous?.view ?? createView(),
      last: performance.now(),
      lastBuzz: previous?.lastBuzz ?? 0,
      skyLook: previous?.skyLook ?? null,
      skyAt: previous?.skyAt ?? 0,
      skyKey: previous?.skyKey ?? "",
    };
  }, []);

  /** The glass has been turned: the run turns with it, and each heap lets
   *  go of its end and falls to the other — unless a tap's turn already
   *  handed the sand over at its half turn (`swapped`). */
  const land = useCallback(
    (nextRun: Run, now: number, mirror: boolean, swapped = false) => {
      const s = sim.current;
      if (!s) return;
      if (!swapped) turnOver(s.source, s.sink, mirror);
      s.run = nextRun;
      s.flip = null;
      s.done = passed(nextRun, now) >= 1;
      s.glow = 0;
    },
    [],
  );

  /** A reset, finished at once: whatever is still in the upper bulb
   *  poured into the lower — for a glass turned over before the sand was
   *  all down. */
  const endReset = useCallback(() => {
    const s = sim.current;
    if (!s?.reset) return;
    s.reset = null;
    const rest = volume(s.source) + airborne(s.source);
    if (rest > 1e-12) {
      pour(s.sink, drain(s.source, rest));
      s.source.air.count = 0;
      settle(s.source);
      settle(s.sink);
    }
  }, []);

  /** A tap's turn, finished: the run turned as of the tap. */
  const endFlip = useCallback(
    (flip: Flip, now: number) => {
      const s = sim.current;
      if (s) s.upended = !s.upended;
      land(turn(flip.from, flip.start), now, true, flip.swapped);
    },
    [land],
  );

  /** One frame: the phone, the physics, the clock, the picture. Returns
   *  whether anything is still moving. */
  const paint = useCallback((): boolean => {
    const s = sim.current;
    const el = canvas.current;
    if (!s || !el) return false;
    const { w, h, dpr } = size.current;
    if (w === 0 || h === 0) return false;
    const now = Date.now();
    const clock = performance.now();
    const dt = Math.min(0.1, Math.max(0, (clock - s.last) / 1000));
    s.last = clock;
    const seconds = clock / 1000;
    s.frames++;

    // The phone: which way up, how it turns, how it is pushed — eased, so
    // the glass takes up a motion the way a heavy thing in a hand does
    // rather than copying the sensor's every tremor.
    const reading = motionRef.current.current;
    const held = press.current?.orbiting ? press.current.orbit : null;
    const angles = reading.heard ? reading.angles : null;
    const catching = follow(
      s.view,
      {
        down: reading.heard ? reading.down : [0, -1, 0],
        accel: reading.heard ? reading.accel : [0, 0, 0],
        spin: reading.heard ? reading.spin : [0, 0, 0],
        turn: angles
          ? deviceToEarth(angles.alpha, angles.beta, angles.gamma)
          : null,
      },
      dt,
    );
    stepView(s.view, s.view.gyro, dt, held);
    // Which way up the glass is, as the sand feels it: off the eased
    // gravity in the glass's own frame, with the sensor's hysteresis — so
    // the sand is handed to the other ends when gravity, as the heaps
    // feel it, has crossed to them, and not a moment before.
    const along = -intoGlass(s.view, s.view.down)[1];
    if (reading.heard && !s.heard) {
      // The sensor's first word says which way up the phone already is:
      // the glass is drawn that way, and nothing has been turned.
      s.heard = true;
      s.gravity = reading.gravity;
      s.view.down = [...reading.down];
      setUpside(reading.gravity === -1);
    } else if (reading.heard && nextGravity(s.gravity, along) !== s.gravity) {
      // Turned over with the phone: the run turns, and the sand at the
      // ends lets go and falls to the other — what lies along the side
      // wall stays where it is. Nothing on the screen turns: it is the
      // phone that moved.
      if (s.flip) endFlip(s.flip, now);
      endReset();
      s.gravity = s.gravity === 1 ? -1 : 1;
      setUpside(s.gravity === -1);
      land(turn(s.run, now), now, false);
      callbacks.current.onRun(s.run);
    }

    // The gravity the sand feels, in the glass's own frame: the Earth's,
    // less the phone's own acceleration — and the desk's wiggle, where the
    // orbit's jerk stands in for it — turned into the glass as it hangs.
    // A tap's half turn is eased in and out: its angle, and the speed and
    // the quickening of the turn, which the sand feels as the pulls of a
    // turning frame (`setSpin`). At the half turn — the glass on its side,
    // the moment gravity crosses from one end of each bulb to the other —
    // the sand is handed to the roles of the ends it now falls towards,
    // and drawn held half a turn round the glass's own axis, where it is.
    let flipAngle = 0;
    let spinRate = 0;
    let spinAccel = 0;
    if (s.flip) {
      const p = Math.min(1, (now - s.flip.start) / TURN_MS);
      if (p >= 1) {
        endFlip(s.flip, now);
      } else {
        const T = TURN_MS / 1000;
        const early = p < 0.5;
        const e = early ? 2 * p * p : 1 - (-2 * p + 2) ** 2 / 2;
        flipAngle = Math.PI * e;
        spinRate = (Math.PI * (early ? 4 * p : 4 * (1 - p))) / T;
        spinAccel = (Math.PI * (early ? 4 : -4)) / (T * T);
        if (!early && !s.flip.swapped) {
          turnOver(s.source, s.sink, true);
          s.flip.swapped = true;
        }
      }
    }
    const swapped = s.flip?.swapped ?? false;
    const down = s.view.down;
    const accel = s.view.accel;
    const push: Vec3 = [
      down[0] - accel[0]! / 9.81,
      down[1] - accel[1]! / 9.81,
      down[2] - accel[2]! / 9.81,
    ];
    const g = halfTurned(intoGlass(s.view, aboutZ(push, -flipAngle)), swapped);
    const up = s.gravity;
    // The turn, as the heaps' frames have it: the glass's own frame, half
    // a turn round once the sand has been handed over, and — upside down —
    // mirrored along the axis, which a turn (a pseudovector) takes as its
    // two other components changing sign.
    const spin = halfTurned(intoGlass(s.view, [0, 0, spinRate]), swapped);
    const alpha = halfTurned(intoGlass(s.view, [0, 0, spinAccel]), swapped);
    for (const bulb of [s.source, s.sink]) {
      // The finger's spin about the glass's own axis, taken up by the sand
      // as friction allows.
      whirl(bulb, s.view.orbitRate, dt);
      setSpin(bulb, s.flip ? [up * spin[0], spin[1], up * spin[2]] : null, [
        up * alpha[0],
        alpha[1],
        up * alpha[2],
      ]);
      setGravity(bulb, g[0], up * g[1], g[2]);
      // A shaken heap holds a flatter slope: the grains are loosened.
      bulb.give = Math.max(bulb.give * 0.9, reading.shake);
    }
    // Held on its side the hole is not fed: the run halts, and starts
    // again when the glass is stood up. Read off the steady orientation,
    // not the shake.
    const side = reading.heard ? reading.lean.x : 0;
    if (!s.flip && !s.reset) {
      if (leanStops(side) && s.run.startedAt !== null) {
        s.run = halt(s.run, now);
        s.stopped = true;
        callbacks.current.onRun(s.run);
      } else if (!leanStops(side) && s.stopped) {
        s.stopped = false;
        if (s.run.fraction < 1) {
          s.run = resume(s.run, now);
          callbacks.current.onRun(s.run);
        }
      }
    }

    // The clock: the top drained to what it says has passed, and the same
    // sand poured where the stream lands. In a tap's turn the run is the
    // one the turn makes, as of the tap; the sand runs by it once it has
    // been handed over, the glass is within `STOP_LEAN` of standing and
    // the sand has reached the hole — so the stream starts in the turn.
    // A reset draws the rest of the sand down quickly, by its own clock
    // (`resetting`), and is over when it all is.
    let stream: StreamPath | null = null;
    const flowing = s.flip
      ? s.flip.swapped && feedsHole(s.source, STOP_LEAN)
      : true;
    const run = s.flip ? turn(s.flip.from, s.flip.start) : s.run;
    const sucking = s.reset !== null;
    if (s.reset && now - s.reset.start >= RESET_MS) s.reset = null;
    if (flowing) {
      const f = s.reset
        ? resetting(s.reset.from, s.reset.start, now)
        : sucking
          ? 1
          : passed(run, now);
      const target = s.sand * (1 - f);
      const d = volume(s.source) + airborne(s.source) - target;
      if (d > 1e-9) {
        // It lands where the stream reaches the heap: under the bore when
        // the glass stands straight, at the end of its run down the glass
        // when it leans.
        stream = streamPath(s.sink);
        pour(s.sink, drain(s.source, d), stream.landX, stream.landZ);
        // A big jump — the tab was asleep — settles at once.
        if (!s.flip && d > s.sand * 0.01) {
          settle(s.source);
          settle(s.sink);
        }
      }
    }
    if (!s.flip) {
      const f = passed(s.run, now);
      if (f >= 1 && !s.done) {
        s.done = true;
        s.glow = 1;
        if (s.run.startedAt !== null) callbacks.current.onDone();
      }
    }
    stepSand(s.source, dt, s.frames);
    stepSand(s.sink, dt, s.frames + 0.5);

    // The sand on the glass, felt.
    const hits = s.source.hits + s.sink.hits;
    s.source.hits = 0;
    s.sink.hits = 0;
    const buzz = buzzFor(hits);
    if (
      buzz > 0 &&
      options.current.haptics &&
      clock - s.lastBuzz > BUZZ_GAP_MS
    ) {
      s.lastBuzz = clock;
      vibrate(buzz);
    }

    const running =
      (sucking && stream !== null) ||
      (flowing &&
        isRunning(run, now) &&
        volume(s.source) > 1e-9 &&
        (!s.flip || stream !== null));
    if (s.glow > 0) s.glow = Math.max(0, s.glow - 0.004);
    const busy =
      moving(s.source) ||
      moving(s.sink) ||
      !viewStill(s.view) ||
      catching ||
      press.current !== null;

    // The sky: the sun and the moon where they are, a few times a minute.
    const { sky: choice, place: where } = options.current;
    const skyKey = `${choice}@${where.lat},${where.lon}`;
    if (!s.skyLook || s.skyKey !== skyKey || now - s.skyAt > SKY_EVERY_MS) {
      s.skyLook = skyLookFor(bodiesFor(choice, now, where));
      s.skyAt = now;
      s.skyKey = skyKey;
    }

    const room = Math.min(h * 0.86, w * 2.1);
    const share = (room * shownSize(s.run.minutes, zoomNow.current)) / h;
    if (stage.current) {
      stage.current.render({
        look: s.look,
        layout: s.layout,
        source: s.source,
        sink: s.sink,
        gravity: s.gravity,
        flip: flipAngle,
        turned: swapped,
        upended: s.upended,
        view: s.view,
        orientation: s.view.turn ? matOf(s.view.turn) : null,
        sky: s.skyLook,
        drift: seconds * 0.004,
        seconds,
        size: share,
        flow: running && (!s.stopped || sucking) ? 1 : 0,
        glow: s.glow,
        stream,
      });
    } else {
      // The flat painter turns the whole picture: once the sand has been
      // handed over, the glass it is drawn in is the one half a turn back,
      // and so is its frame, the other way up.
      const angle = swapped ? flipAngle - Math.PI : flipAngle;
      const upended = s.upended !== swapped;
      paintFlat(el, s, spritesRef.current, {
        w,
        h,
        dpr,
        angle,
        upended,
        share,
        running,
        seconds,
      });
    }
    // Said once a frame is up, for whatever waits on the picture (the
    // screenshot skill); not read by the app.
    if (host.current && !host.current.dataset.drawn)
      host.current.dataset.drawn = "1";
    return (
      running ||
      s.flip !== null ||
      s.reset !== null ||
      s.glow > 0 ||
      busy ||
      reading.shake > 0
    );
  }, [land, endFlip, endReset, zoomNow]);

  // The loop: runs while something moves, and stops when nothing does.
  const loop = useCallback(
    function tick() {
      frame.current = null;
      if (paint()) frame.current = requestAnimationFrame(tick);
    },
    [paint],
  );
  const wake = useCallback(() => {
    if (frame.current === null) {
      const s = sim.current;
      if (s) s.last = performance.now();
      frame.current = requestAnimationFrame(loop);
    }
  }, [loop]);
  wakeRef.current = wake;

  // The glass changes: another look, or another length — both a new glass,
  // built cold from the clock. A run that changed under us in any other way
  // (the settings, a reload) is adopted cold as well; one that says the
  // same sand is through as ours does — ours, handed back (`onRun`), or
  // laid to rest as it runs out — is taken as it is, and the heaps stay
  // where they lie. In a tap's turn the run is already the turned one.
  useEffect(() => {
    const s = sim.current;
    const now = Date.now();
    const same =
      s !== null && Math.abs(passed(s.run, now) - passed(run, now)) < 1e-6;
    if (
      !s ||
      s.look !== look ||
      s.run.minutes !== run.minutes ||
      (!s.flip && !same)
    ) {
      build(look, run, now);
    } else if (!s.flip) {
      s.run = run;
    }
    wake();
  }, [look, run, build, wake]);

  // Another sky, or the modelled parts arriving, is a frame worth drawing;
  // and a still glass redraws now and then, for the sun and the clouds.
  useEffect(() => {
    wake();
  }, [sky, place, sprites, wake]);
  useEffect(() => {
    const id = window.setInterval(wake, SKY_EVERY_MS);
    return () => window.clearInterval(id);
  }, [wake]);

  // A reading from the phone wakes the loop; the loop reads it.
  const motionRef = useRef(motion);
  motionRef.current = motion;
  useEffect(() => motion.subscribe(wake), [motion, wake]);

  // The stage, made once for the canvas; the flat painter if it cannot be.
  useEffect(() => {
    const c = canvas.current;
    if (!c || flat) return;
    try {
      stage.current = new Stage(c);
      const { w, h, dpr } = size.current;
      if (w > 0) stage.current.setSize(w, h, dpr);
      wake();
    } catch {
      stage.current = null;
      setFlat(true);
    }
    const onLost = (e: Event) => {
      e.preventDefault();
    };
    c.addEventListener("webglcontextlost", onLost);
    return () => {
      c.removeEventListener("webglcontextlost", onLost);
      stage.current?.dispose();
      stage.current = null;
    };
  }, [flat, wake]);

  // The canvas follows its box, at the device's pixels.
  useEffect(() => {
    const el = host.current;
    const c = canvas.current;
    if (!el || !c) return;
    const fit = () => {
      // The box's own size, not its bounding rectangle: a page turned back
      // against the screen (`upright.ts`) has its sides swapped there.
      const width = el.clientWidth;
      const height = el.clientHeight;
      const dpr = Math.min(3, window.devicePixelRatio || 1);
      size.current = { w: width, h: height, dpr };
      if (stage.current) {
        stage.current.setSize(width, height, dpr);
      } else {
        c.width = Math.round(width * dpr);
        c.height = Math.round(height * dpr);
      }
      c.style.width = `${width}px`;
      c.style.height = `${height}px`;
      wake();
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    const onShow = () => {
      if (!document.hidden) wake();
    };
    document.addEventListener("visibilitychange", onShow);
    return () => {
      ro.disconnect();
      document.removeEventListener("visibilitychange", onShow);
      if (frame.current !== null) cancelAnimationFrame(frame.current);
      frame.current = null;
    };
  }, [wake, flat]);

  // ── What a press does ─────────────────────────────────────────────────

  const showLabel = useCallback(
    (minutes: number) => {
      const { hours, minutes: m } = splitMinutes(minutes);
      setLabel(
        hours === 0
          ? t("timer.minutes", { n: String(m) })
          : m === 0
            ? t("timer.hours", { n: String(hours) })
            : t("timer.hoursMinutes", { h: String(hours), m: String(m) }),
      );
      if (labelTimer.current !== null) window.clearTimeout(labelTimer.current);
      labelTimer.current = window.setTimeout(() => setLabel(null), LABEL_MS);
    },
    [t],
  );

  const turnOverNow = useCallback(() => {
    const s = sim.current;
    if (!s || s.flip || s.reset) return;
    const start = Date.now();
    s.flip = { start, from: s.run, swapped: false };
    callbacks.current.onRun(turn(s.run, start));
    wake();
  }, [wake]);

  /** Reset the glass: the sand drawn down into the lower bulb over
   *  `RESET_MS`, and the run standing still with all of it there. The run
   *  is kept at once, so a glass closed mid-reset opens reset. */
  const resetNow = useCallback(() => {
    const s = sim.current;
    if (!s || s.flip || s.reset) return;
    const now = Date.now();
    s.reset = { start: now, from: passed(s.run, now) };
    s.run = reset(s.run);
    s.stopped = false;
    s.done = true;
    s.glow = 0;
    callbacks.current.onRun(s.run);
    if (options.current.haptics) vibrate(12);
    wake();
  }, [wake]);

  const step = useCallback(
    (steps: number) => {
      const s = sim.current;
      if (!s) return;
      const next = stepMinutes(s.run.minutes, steps);
      showLabel(next);
      if (next !== s.run.minutes) callbacks.current.onMinutes(next);
    },
    [showLabel],
  );

  // Every finger on the glass, for the pinch; the first one is the press.
  const fingers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ from: number; zoom: number } | null>(null);
  const longPress = useRef<number | null>(null);
  const stopLongPress = () => {
    if (longPress.current !== null) window.clearTimeout(longPress.current);
    longPress.current = null;
  };
  const spread = (): number => {
    const [a, b] = [...fingers.current.values()];
    return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
  };
  const press = useRef<{
    id: number;
    x: number;
    y: number;
    minutes: number;
    dragging: boolean;
    orbiting: boolean;
    orbitFrom: number;
    orbit: number;
    /** Spent on something other than a tap: a pinch, or a reset. */
    spent: boolean;
  } | null>(null);
  const onPointerDown = (e: PointerEvent) => {
    if (e.button !== 0 && e.pointerType === "mouse") return;
    const s = sim.current;
    if (!s) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    fingers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (fingers.current.size === 2) {
      // A second finger: a pinch, and the press is no longer a tap, a
      // drag or a hold.
      stopLongPress();
      if (press.current) press.current.spent = true;
      const from = zoomer.begin("pointers");
      pinch.current = from === null ? null : { from: spread(), zoom: from };
      wake();
      return;
    }
    if (fingers.current.size > 2) return;
    press.current = {
      id: e.pointerId,
      x: e.clientX,
      y: e.clientY,
      minutes: s.run.minutes,
      dragging: false,
      orbiting: false,
      orbitFrom: s.view.orbit,
      orbit: s.view.orbit,
      spent: false,
    };
    stopLongPress();
    longPress.current = window.setTimeout(() => {
      longPress.current = null;
      const p = press.current;
      if (!p || p.dragging || p.orbiting || p.spent) return;
      p.spent = true;
      resetNow();
    }, LONG_PRESS_MS);
    wake();
  };
  const onPointerMove = (e: PointerEvent) => {
    if (fingers.current.has(e.pointerId)) {
      fingers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    }
    const pin = pinch.current;
    if (pin) {
      const d = spread();
      if (pin.from > 0 && d > 0) {
        zoomer.pinch("pointers", pin.zoom * (d / pin.from));
      }
      return;
    }
    const p = press.current;
    if (!p || p.id !== e.pointerId || p.spent) return;
    // In the page's own frame: a page turned back against the screen
    // (`upright.ts`) is dragged along its own length, not the screen's.
    const [dx, down] = uprightDelta(
      e.clientX - p.x,
      e.clientY - p.y,
      pageTurn(),
    );
    const dy = -down;
    if (!p.dragging && !p.orbiting) {
      if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) p.dragging = true;
      else if (Math.abs(dx) > 8) p.orbiting = true;
      if (p.dragging || p.orbiting) stopLongPress();
    }
    if (p.orbiting) {
      // Sideways: the glass turns about its own axis under the finger.
      p.orbit = p.orbitFrom + dx * ORBIT_PER_PX;
      wake();
      return;
    }
    if (!p.dragging) return;
    const next = stepMinutes(p.minutes, Math.round(dy / DRAG_STEP_PX));
    const s = sim.current;
    if (s && next !== s.run.minutes) callbacks.current.onMinutes(next);
    showLabel(next);
  };
  /** A finger off the glass: the end of a pinch (kept), or of a press —
   *  a tap if it was nothing else. */
  const lift = (id: number, tap: boolean) => {
    fingers.current.delete(id);
    if (pinch.current) {
      if (fingers.current.size < 2) {
        pinch.current = null;
        zoomer.end("pointers");
      }
    }
    const p = press.current;
    if (!p || (p.id !== id && fingers.current.size > 0)) return;
    press.current = null;
    stopLongPress();
    if (tap && !p.dragging && !p.orbiting && !p.spent) turnOverNow();
    wake();
  };
  const onPointerUp = (e: PointerEvent) => lift(e.pointerId, true);
  const onPointerCancel = (e: PointerEvent) => lift(e.pointerId, false);
  // The end of a tap, which Safari counts as a gesture (a press's start is
  // not): where a phone's sensors are asked for.
  const onClick = () => {
    callbacks.current.onPress?.();
  };
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      turnOverNow();
    } else if (e.key === "Backspace" || e.key === "Delete") {
      e.preventDefault();
      resetNow();
    } else if (e.key === "+" || e.key === "=" || e.key === "-") {
      e.preventDefault();
      zoomer.nudge(e.key === "-" ? 1 / KEY_ZOOM : KEY_ZOOM);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      step(1);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      step(-1);
    } else if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      e.preventDefault();
      const s = sim.current;
      if (s) s.view.orbitRate += e.key === "ArrowLeft" ? -2.5 : 2.5;
      wake();
    }
  };

  // Said without reading the clock — a render has to be pure — so a run
  // with a clock on it is "running" until the loop lays it to rest.
  const state =
    run.startedAt !== null
      ? t("glass.running")
      : run.fraction >= 1
        ? t("glass.done")
        : t("glass.paused");

  return (
    <div
      ref={host}
      role="button"
      tabIndex={0}
      aria-label={t("glass.aria", { state })}
      title={t("glass.hint")}
      data-area="glass"
      className={`app-glass relative touch-none select-none outline-none ${className ?? ""}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      onClick={onClick}
      onContextMenu={(e) => e.preventDefault()}
      onWheel={zoomer.onWheel}
      onKeyDown={onKeyDown}
    >
      <canvas
        key={flat ? "flat" : "stage"}
        ref={canvas}
        aria-hidden="true"
        className="block"
      />
      <div
        aria-live="polite"
        className={`app-label pointer-events-none absolute inset-x-0 text-center text-sm font-medium tabular-nums text-white/80 transition-opacity duration-300 ${
          upside ? "top-[5%] rotate-180" : "bottom-[5%]"
        } ${label ? "opacity-100" : "opacity-0"}`}
      >
        {label ?? ""}
      </div>
    </div>
  );
}

/** A buzz, where the device has one and the page may: Chrome ignores (and
 *  complains of) a vibration before the page has been touched. */
function vibrate(ms: number): void {
  try {
    const nav = navigator as Navigator & {
      userActivation?: { hasBeenActive: boolean };
    };
    if (!("vibrate" in nav)) return;
    if (nav.userActivation && !nav.userActivation.hasBeenActive) return;
    nav.vibrate(ms);
  } catch {
    // A device that will not.
  }
}
