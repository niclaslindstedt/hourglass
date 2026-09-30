// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { useCallback, useEffect, useRef, useState } from "react";

import type { Place } from "./astronomy.ts";
import { layoutOf, type Layout } from "./glass.ts";
import { GLASS, SAND, type Look } from "./look.ts";
import { glassLight, grainPattern, paintHourglass } from "./paint.ts";
import {
  airborne,
  buzzFor,
  moving,
  setGravity,
  step as stepSand,
  streamPath,
  turnOver,
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
import { PITCH, YAW } from "./scene.ts";
import { bodiesFor, skyLookFor, type SkyChoice, type SkyLook } from "./sky.ts";
import { useSprites } from "./sprites.ts";
import {
  deviceToEarth,
  leanStops,
  type Gravity,
  type Motion,
  type Vec3,
} from "./useMotion.ts";
import { useT } from "./i18n/index.ts";
import {
  halt,
  isRunning,
  passed,
  resume,
  sizeFor,
  splitMinutes,
  stepMinutes,
  turn,
  type Run,
} from "./timer.ts";
import {
  createView,
  intoGlass,
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

/** Whether the page behind the glass is light, read off the theme's own
 *  background token: the flat painter's glass edges are drawn in shadow on
 *  a light page and in light on a dark one. */
export function pageIsLight(): boolean {
  try {
    const bg = getComputedStyle(document.documentElement)
      .getPropertyValue("--page-bg")
      .trim();
    const m = /^#([0-9a-f]{6})$/i.exec(bg);
    if (!m) return false;
    const n = parseInt(m[1]!, 16);
    const luma =
      (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
    return luma > 0.5;
  } catch {
    return false;
  }
}

/** How long a turn takes on screen, how far a drag goes between two
 *  lengths, and how long the length shows. */
const TURN_MS = 720;
const DRAG_STEP_PX = 44;
const LABEL_MS = 1600;

/** How far a sideways drag turns the glass, rad a pixel. */
const ORBIT_PER_PX = 0.012;

/** How much of a jerk of the orbit the sand feels, m/s² per rad/s²: the
 *  desk's shake, where there is no phone to shake. */
const SWING_ACCEL = 0.05;

/** The shortest gap between two buzzes, ms. */
const BUZZ_GAP_MS = 70;

/** How often the sky is worked out again: the sun moves a degree in four
 *  minutes, so every few seconds is far finer than the eye. */
const SKY_EVERY_MS = 5000;

type Props = {
  look: Look;
  run: Run;
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
  /** The glass was turned. */
  onTurn: () => void;
  /** The run was halted or set going by a tilt: the new run, to keep. */
  onRun: (run: Run) => void;
  /** The glass was dragged to another length. */
  onMinutes: (minutes: number) => void;
  /** The sand has run out. */
  onDone: () => void;
  className?: string;
};

type Flip = { start: number; from: Run };

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

export function Hourglass({
  look,
  run,
  motion,
  sky,
  place,
  haptics,
  onPress,
  onTurn,
  onRun,
  onMinutes,
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
  const callbacks = useRef({ onPress, onTurn, onRun, onMinutes, onDone });
  callbacks.current = { onPress, onTurn, onRun, onMinutes, onDone };
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
   *  go of its end and falls to the other. */
  const land = useCallback((nextRun: Run, now: number, mirror: boolean) => {
    const s = sim.current;
    if (!s) return;
    turnOver(s.source, s.sink, mirror);
    s.run = nextRun;
    s.flip = null;
    s.done = passed(nextRun, now) >= 1;
    s.glow = 0;
  }, []);

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

    // The phone: which way up, how it turns, how it is pushed.
    const reading = motionRef.current.current;
    const held = press.current?.orbiting ? press.current.orbit : null;
    stepView(s.view, reading.heard ? reading.spin : [0, 0, 0], dt, held);
    if (reading.heard && !s.heard) {
      // The sensor's first word says which way up the phone already is:
      // the glass is drawn that way, and nothing has been turned.
      s.heard = true;
      s.gravity = reading.gravity;
      setUpside(reading.gravity === -1);
    } else if (reading.heard && reading.gravity !== s.gravity) {
      // Turned over with the phone: the run turns, and the sand falls to
      // the other end. Nothing on the screen turns — it is the phone that
      // moved.
      if (s.flip) land(turn(s.flip.from, s.flip.start), now, true);
      s.gravity = reading.gravity;
      setUpside(reading.gravity === -1);
      land(turn(s.run, now), now, false);
      callbacks.current.onTurn();
    }

    // The gravity the sand feels, in the glass's own frame: the Earth's,
    // less the phone's own acceleration — and the desk's wiggle, where the
    // orbit's jerk stands in for it — turned into the glass as it hangs.
    let flipAngle = 0;
    if (s.flip) {
      const p = Math.min(1, (now - s.flip.start) / TURN_MS);
      if (p >= 1) {
        land(turn(s.flip.from, s.flip.start), now, true);
      } else {
        const e = p < 0.5 ? 2 * p * p : 1 - (-2 * p + 2) ** 2 / 2;
        flipAngle = Math.PI * e;
      }
    }
    const down: Vec3 = reading.heard ? reading.down : [0, -1, 0];
    const accel = reading.heard ? reading.accel : [0, 0, 0];
    const push: Vec3 = [
      down[0] - (accel[0]! - s.view.swing * SWING_ACCEL) / 9.81,
      down[1] - accel[1]! / 9.81,
      down[2] - accel[2]! / 9.81,
    ];
    const g = intoGlass(s.view, aboutZ(push, -flipAngle));
    const up = s.gravity;
    for (const bulb of [s.source, s.sink]) {
      setGravity(bulb, g[0], up * g[1], g[2]);
      // A shaken heap holds a flatter slope: the grains are loosened.
      bulb.give = Math.max(bulb.give * 0.9, reading.shake);
    }
    // Through a tap's half turn the heaps hold as they are — packed sand in
    // a narrow bulb does, for the moment a turn takes — and drop when the
    // glass lands.
    const holding = s.flip !== null;

    // Held on its side the hole is not fed: the run halts, and starts
    // again when the glass is stood up. Read off the steady orientation,
    // not the shake.
    const side = reading.heard ? reading.lean.x : 0;
    if (!s.flip) {
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
    // sand poured where the stream lands.
    let stream: StreamPath | null = null;
    if (!s.flip) {
      const f = passed(s.run, now);
      const target = s.sand * (1 - f);
      const d = volume(s.source) + airborne(s.source) - target;
      if (d > 1e-9) {
        // It lands where the stream reaches the heap: under the bore when
        // the glass stands straight, at the end of its run down the glass
        // when it leans.
        stream = streamPath(s.sink);
        pour(s.sink, drain(s.source, d), stream.landX, stream.landZ);
        // A big jump — the tab was asleep — settles at once.
        if (d > s.sand * 0.01) {
          settle(s.source);
          settle(s.sink);
        }
      }
      if (f >= 1 && !s.done) {
        s.done = true;
        s.glow = 1;
        if (s.run.startedAt !== null) callbacks.current.onDone();
      }
    }
    if (!holding) {
      stepSand(s.source, dt, s.frames);
      stepSand(s.sink, dt, s.frames + 0.5);
    }

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

    const running = !s.flip && isRunning(s.run, now) && volume(s.source) > 1e-9;
    if (s.glow > 0) s.glow = Math.max(0, s.glow - 0.004);
    const busy =
      moving(s.source) ||
      moving(s.sink) ||
      !viewStill(s.view) ||
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
    const share = (room * sizeFor(s.run.minutes)) / h;
    const angles = reading.heard ? reading.angles : null;
    if (stage.current) {
      stage.current.render({
        look: s.look,
        layout: s.layout,
        source: s.source,
        sink: s.sink,
        gravity: s.gravity,
        flip: flipAngle,
        view: s.view,
        orientation: angles
          ? deviceToEarth(angles.alpha, angles.beta, angles.gamma)
          : null,
        sky: s.skyLook,
        drift: seconds * 0.004,
        seconds,
        size: share,
        flow: running && !s.stopped ? 1 : 0,
        glow: s.glow,
        stream,
      });
    } else {
      paintFlat(el, s, w, h, dpr, flipAngle, share, running, seconds);
    }
    // Said once a frame is up, for whatever waits on the picture (the
    // screenshot skill); not read by the app.
    if (host.current && !host.current.dataset.drawn)
      host.current.dataset.drawn = "1";
    return (
      running || s.flip !== null || s.glow > 0 || busy || reading.shake > 0
    );
  }, [land]);

  /** The flat painter, where there is no WebGL: the picture the app drew
   *  before it had a stage, from the same heaps. */
  function paintFlat(
    el: HTMLCanvasElement,
    s: Sim,
    w: number,
    h: number,
    dpr: number,
    angle: number,
    share: number,
    running: boolean,
    seconds: number,
  ): void {
    const ctx = el.getContext("2d");
    if (!ctx) return;
    const scale = h * share;
    const light = pageIsLight();
    const sp = spritesRef.current;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.save();
    if (angle !== 0) {
      ctx.translate(w / 2, h / 2);
      ctx.rotate(angle);
      ctx.translate(-w / 2, -h / 2);
    }
    const lean = Math.cos(angle);
    paintHourglass(ctx, {
      cam: {
        pitch: PITCH * lean,
        yaw: YAW * lean,
        scale,
        cx: w / 2,
        cy: h / 2,
      },
      look: s.look,
      layout: s.layout,
      source: s.source,
      sink: s.sink,
      gravity: s.gravity,
      tilt: s.sink.tilt[0],
      shake: s.source.give,
      flow: running ? 1 : 0,
      t: seconds,
      glow: s.glow,
      dpr,
      grain: grainPattern(ctx, SAND[s.look.sand], dpr, sp?.grain ?? null),
      glassLight:
        angle === 0 && !(sp?.glassAdd && sp.glassMultiply)
          ? glassLight(s.layout, GLASS[s.look.glass], scale, PITCH, dpr, light)
          : null,
      light,
      sprites: sp,
    });
    ctx.restore();
  }

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

  // The glass changes: another look, or another length — both a new glass,
  // built cold from the clock. A run that changed under us in any other way
  // but a turn (the settings, a reload) is adopted cold as well.
  useEffect(() => {
    const s = sim.current;
    const now = Date.now();
    const turned =
      s !== null &&
      s.run !== run &&
      run.startedAt !== null &&
      Math.abs(passed(s.run, now) - (1 - run.fraction)) < 1e-6;
    const ours =
      s !== null &&
      s.run.fraction === run.fraction &&
      s.run.startedAt === run.startedAt;
    if (
      !s ||
      s.look !== look ||
      s.run.minutes !== run.minutes ||
      (!s.flip && !turned && !ours && s.run.startedAt !== run.startedAt)
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
      const rect = el.getBoundingClientRect();
      const dpr = Math.min(3, window.devicePixelRatio || 1);
      size.current = { w: rect.width, h: rect.height, dpr };
      if (stage.current) {
        stage.current.setSize(rect.width, rect.height, dpr);
      } else {
        c.width = Math.round(rect.width * dpr);
        c.height = Math.round(rect.height * dpr);
      }
      c.style.width = `${rect.width}px`;
      c.style.height = `${rect.height}px`;
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
    if (!s || s.flip) return;
    s.flip = { start: Date.now(), from: s.run };
    callbacks.current.onTurn();
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

  const press = useRef<{
    id: number;
    x: number;
    y: number;
    minutes: number;
    dragging: boolean;
    orbiting: boolean;
    orbitFrom: number;
    orbit: number;
  } | null>(null);
  const onPointerDown = (e: PointerEvent) => {
    if (e.button !== 0 && e.pointerType === "mouse") return;
    const s = sim.current;
    if (!s) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    press.current = {
      id: e.pointerId,
      x: e.clientX,
      y: e.clientY,
      minutes: s.run.minutes,
      dragging: false,
      orbiting: false,
      orbitFrom: s.view.orbit,
      orbit: s.view.orbit,
    };
    wake();
  };
  const onPointerMove = (e: PointerEvent) => {
    const p = press.current;
    if (!p || p.id !== e.pointerId) return;
    const dx = e.clientX - p.x;
    const dy = p.y - e.clientY;
    if (!p.dragging && !p.orbiting) {
      if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) p.dragging = true;
      else if (Math.abs(dx) > 8) p.orbiting = true;
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
  const onPointerUp = (e: PointerEvent) => {
    const p = press.current;
    if (!p || p.id !== e.pointerId) return;
    press.current = null;
    if (!p.dragging && !p.orbiting) turnOverNow();
    wake();
  };
  const onPointerCancel = () => {
    press.current = null;
  };
  // The end of a tap, which Safari counts as a gesture (a press's start is
  // not): where a phone's sensors are asked for.
  const onClick = () => {
    callbacks.current.onPress?.();
  };
  const onWheel = (e: WheelEvent) => {
    if (e.deltaY === 0) return;
    e.preventDefault();
    step(e.deltaY < 0 ? 1 : -1);
  };
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      turnOverNow();
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
      onWheel={onWheel}
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
