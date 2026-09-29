// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { useCallback, useEffect, useRef, useState } from "react";

import { layoutOf, type Layout } from "./glass.ts";
import { GLASS, SAND, type Look } from "./look.ts";
import { glassLight, grainPattern, paintHourglass } from "./paint.ts";
import {
  axisHeight,
  capacity,
  createBulb,
  drain,
  funnelFill,
  jolt,
  levelFill,
  pileFill,
  pour,
  relax,
  setTilt,
  settle,
  volume,
  type Bulb,
} from "./sand.ts";
import { PITCH, YAW, type Camera } from "./scene.ts";
import { useSprites } from "./sprites.ts";
import { leanStops, type Gravity, type Motion } from "./useMotion.ts";
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

// The hourglass on the screen: the one thing the app shows, and the one
// thing it is worked with.
//
// A tap turns it over. A drag up or down makes it a longer or a shorter
// glass — and a bigger or a smaller one, because a glass that runs longer
// holds more sand. That is all of it; the rest of what happens here is
// keeping the sand honest between frames.
//
// The sand is the model in `sand.ts`, one heap per bulb, and what moves it
// is the wall clock through `timer.ts`: every frame the top bulb is drained
// down to the share the clock says has passed, the same amount lands in the
// bottom one, and both settle to their angle of repose. A tab that was
// asleep for an hour wakes to the right amount of sand on the right side,
// and a few frames of settling. Nothing here counts frames.
//
// Turning is the one moment the sand is not the clock's: the glass is drawn
// turning over for a moment, with the heaps it had, and then both heaps are
// laid flat on their new floors — the way a real heap drops when the glass
// is upended — and the run carries on from the clock.
//
// The phone is the glass (`useMotion`): turned over, the sand runs the other
// way with nothing on the screen moving; held at a slant, the heaps lean
// into it and the stream falls at that slant; held on its side, the hole is
// not fed and the run halts until it is stood up again; shaken, the grains
// jump and the heaps slump. On a desk a quick sideways wiggle of the
// pointer is the shake.

/** How much of a bulb the sand fills. Measured: a little under half. */
export const FILL = 0.45;

/** Whether the page behind the glass is light, read off the theme's own
 *  background token: the glass's edges are drawn in shadow on a light page
 *  and in light on a dark one. */
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

/** How long a turn takes on screen, and how far a drag goes between two
 *  lengths. */
const TURN_MS = 720;
const DRAG_STEP_PX = 44;
const LABEL_MS = 1600;

/** How fast a shake dies down, a frame at a time, and how much of a shake
 *  a sideways wiggle of the pointer is worth per pixel. */
const SHAKE_DECAY = 0.9;
const WIGGLE_PER_PX = 1 / 90;

type Props = {
  look: Look;
  run: Run;
  /** The phone's readings (`useMotion`): which way up it is, how it leans,
   *  and how hard it is shaken. */
  motion: Motion;
  /** A press landed on the glass — before it is read as a tap or a drag.
   *  The one moment a phone will grant its sensors from. */
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
  /** The lean the heaps have been told, and how shaken they are. */
  tilt: number;
  shake: number;
  /** Whether the run was halted by a lean past `STOP_LEAN`. */
  stopped: boolean;
  /** A count of frames, the seed a shake's throws are drawn from. */
  frames: number;
  sand: number;
  run: Run;
  flip: Flip | null;
  done: boolean;
  glow: number;
  grain: CanvasPattern | null;
  grainKey: string | null;
  glassLight: HTMLCanvasElement | null;
  glassLightKey: string | null;
};

export function Hourglass({
  look,
  run,
  motion,
  onPress,
  onTurn,
  onRun,
  onMinutes,
  onDone,
  className,
}: Props) {
  const t = useT();
  // The modelled parts, as they load; the painter draws its own until
  // they have.
  const sprites = useSprites(look);
  const spritesRef = useRef(sprites);
  spritesRef.current = sprites;
  const host = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [label, setLabel] = useState<string | null>(null);

  // The simulation, kept off React: refs, and a loop that paints straight
  // to the canvas. It is rebuilt cold when the glass changes — another
  // look, another length — and kept warm through a turn.
  const sim = useRef<Sim | null>(null);
  const size = useRef({ w: 0, h: 0, dpr: 1 });
  const frame = useRef<number | null>(null);
  const labelTimer = useRef<number | null>(null);
  const callbacks = useRef({ onPress, onTurn, onRun, onMinutes, onDone });
  callbacks.current = { onPress, onTurn, onRun, onMinutes, onDone };

  /** Build both heaps for a run as the clock has it now. */
  const build = useCallback((nextLook: Look, nextRun: Run, now: number) => {
    const layout = layoutOf(nextLook);
    const repose = SAND[nextLook.sand].repose;
    const source = createBulb(layout.bulb, "waist", repose);
    const sink = createBulb(layout.bulb, "plate", repose);
    const previous = sim.current;
    const tilt = previous?.tilt ?? 0;
    setTilt(source, tilt, 0);
    setTilt(sink, tilt, 0);
    const sand = capacity(source) * FILL;
    const f = passed(nextRun, now);
    if (f <= 0) levelFill(source, sand);
    else funnelFill(source, sand, sand * (1 - f));
    pileFill(sink, sand * f, 40, tilt * layout.bulb.height * 0.5, 0);
    sim.current = {
      look: nextLook,
      layout,
      source,
      sink,
      gravity: previous?.gravity ?? 1,
      tilt,
      shake: previous?.shake ?? 0,
      stopped: previous?.stopped ?? false,
      frames: previous?.frames ?? 0,
      sand,
      run: nextRun,
      flip: null,
      done: f >= 1,
      glow: 0,
      grain: previous?.grain ?? null,
      grainKey: previous?.grainKey ?? null,
      glassLight: null,
      glassLightKey: null,
    };
  }, []);

  /** Lay both heaps flat on their new floors, after a turn. A heap that
   *  has just dropped is not at its angle yet; the loop's relaxing brings
   *  it there over the next frames. */
  const land = useCallback((nextRun: Run, now: number) => {
    const s = sim.current;
    if (!s) return;
    const f = passed(nextRun, now);
    levelFill(s.source, s.sand * (1 - f));
    levelFill(s.sink, s.sand * f);
    s.run = nextRun;
    s.flip = null;
    s.done = f >= 1;
    s.glow = 0;
  }, []);

  const paint = useCallback((): boolean => {
    const s = sim.current;
    const el = canvas.current;
    if (!s || !el) return false;
    const ctx = el.getContext("2d");
    if (!ctx) return false;
    const { w, h, dpr } = size.current;
    if (w === 0 || h === 0) return false;
    const now = Date.now();
    const seconds = performance.now() / 1000;
    s.frames++;

    // The phone: which way up, how it leans, how shaken. A turn of the
    // phone turns the run the way a tap does, and nothing on the screen
    // turns — it is the phone that moved.
    const reading = motionRef.current.current;
    if (reading.gravity !== s.gravity) {
      s.gravity = reading.gravity;
      if (s.flip) land(turn(s.flip.from, s.flip.start), now);
      const next = turn(s.run, now);
      land(next, now);
      callbacks.current.onTurn();
    }
    if (Math.abs(reading.lean - s.tilt) > 1e-3) {
      s.tilt = reading.lean;
      setTilt(s.source, s.tilt, 0);
      setTilt(s.sink, s.tilt, 0);
    }
    s.shake = Math.max(s.shake * SHAKE_DECAY, reading.shake);
    if (s.shake < 0.01) s.shake = 0;
    s.source.give = s.shake;
    s.sink.give = s.shake;
    // Held on its side the hole is not fed: the run halts, and starts
    // again when the glass is stood up.
    if (!s.flip) {
      if (leanStops(s.tilt) && s.run.startedAt !== null) {
        s.run = halt(s.run, now);
        s.stopped = true;
        callbacks.current.onRun(s.run);
      } else if (!leanStops(s.tilt) && s.stopped) {
        s.stopped = false;
        if (s.run.fraction < 1) {
          s.run = resume(s.run, now);
          callbacks.current.onRun(s.run);
        }
      }
    }

    // The sand, from the clock — or, through a turn, held as it was while
    // the picture turns over.
    let angle = 0;
    let lean = 1;
    if (s.flip) {
      const p = Math.min(1, (now - s.flip.start) / TURN_MS);
      if (p >= 1) {
        land(turn(s.flip.from, s.flip.start), now);
      } else {
        const e = p < 0.5 ? 2 * p * p : 1 - (-2 * p + 2) ** 2 / 2;
        angle = Math.PI * e;
        lean = Math.cos(Math.PI * e);
      }
    }
    if (!s.flip) {
      const f = passed(s.run, now);
      const target = s.sand * (1 - f);
      const d = volume(s.source) - target;
      if (d > 1e-9) {
        // The stream falls along gravity: at a slant, it lands off the axis
        // by the slant times the fall.
        const fall = s.layout.bulb.height - axisHeight(s.sink);
        pour(s.sink, drain(s.source, d), s.tilt * fall, 0);
      }
      if (s.shake > 0) {
        jolt(s.source, s.shake * 0.7, s.frames);
        jolt(s.sink, s.shake * 0.7, s.frames + 0.5);
      }
      // A big jump — the tab was asleep — settles at once rather than over
      // the next second of frames.
      if (d > s.sand * 0.01) {
        settle(s.source);
        settle(s.sink);
      } else {
        // A dozen sweeps a frame: enough for a heap to slump into a new
        // lean in well under a second, the way sand does.
        relax(s.source, 12);
        relax(s.sink, 12);
      }
      if (f >= 1 && !s.done) {
        s.done = true;
        s.glow = 1;
        if (s.run.startedAt !== null) callbacks.current.onDone();
      }
    }
    const running = !s.flip && isRunning(s.run, now);
    if (s.glow > 0) s.glow = Math.max(0, s.glow - 0.004);
    // A leaning heap keeps settling a while after the lean changes.
    const settling = relax(s.source, 4) + relax(s.sink, 4) > 1e-9;

    // The camera: the glass as tall as its length earns, the waist in the
    // middle, and — while it turns — the whole picture turning with it, the
    // camera's lean reversing so it lands the right way up.
    const room = Math.min(h * 0.86, w * 2.1);
    const scale = room * sizeFor(s.run.minutes);
    const cam: Camera = {
      pitch: PITCH * lean,
      yaw: YAW * lean,
      scale,
      cx: w / 2,
      cy: h / 2,
    };
    const light = pageIsLight();
    const sprites = spritesRef.current;
    const grainKey = `${s.look.sand}@${dpr}@${sprites?.grain ? "tex" : "spec"}`;
    if (!s.grain || s.grainKey !== grainKey) {
      s.grain = grainPattern(
        ctx,
        SAND[s.look.sand],
        dpr,
        sprites?.grain ?? null,
      );
      s.grainKey = grainKey;
    }
    // The light on the glass is rendered once for a size and kept; it is
    // not drawn while the glass turns over, where the size would be a
    // frame's worth of work for nothing.
    const lightKey = `${s.look.glass}/${s.look.top}@${Math.round(scale)}@${dpr}@${light}`;
    const modelledGlass = Boolean(sprites?.glassAdd && sprites.glassMultiply);
    if (
      !modelledGlass &&
      angle === 0 &&
      (!s.glassLight || s.glassLightKey !== lightKey)
    ) {
      s.glassLight = glassLight(
        s.layout,
        GLASS[s.look.glass],
        scale,
        PITCH,
        dpr,
        light,
      );
      s.glassLightKey = lightKey;
    }

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.save();
    if (angle !== 0) {
      ctx.translate(w / 2, h / 2);
      ctx.rotate(angle);
      ctx.translate(-w / 2, -h / 2);
    }
    paintHourglass(ctx, {
      cam,
      look: s.look,
      layout: s.layout,
      source: s.source,
      sink: s.sink,
      gravity: s.gravity,
      tilt: s.tilt,
      shake: s.shake,
      flow: running ? 1 : 0,
      t: seconds,
      glow: s.glow,
      dpr,
      grain: s.grain,
      glassLight: angle === 0 && !modelledGlass ? s.glassLight : null,
      light,
      sprites,
    });
    ctx.restore();
    return running || s.flip !== null || s.glow > 0 || s.shake > 0 || settling;
  }, [land]);

  // The loop: runs while something moves, and stops when nothing does.
  const loop = useCallback(
    function tick() {
      frame.current = null;
      if (paint()) frame.current = requestAnimationFrame(tick);
    },
    [paint],
  );
  const wake = useCallback(() => {
    if (frame.current === null) frame.current = requestAnimationFrame(loop);
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

  // The modelled parts arriving is a frame worth painting.
  useEffect(() => {
    if (sprites) wake();
  }, [sprites, wake]);

  // A reading from the phone wakes the loop; the loop reads it.
  const motionRef = useRef(motion);
  motionRef.current = motion;
  useEffect(() => motion.subscribe(wake), [motion, wake]);

  // The canvas follows its box, at the device's pixels.
  useEffect(() => {
    const el = host.current;
    const c = canvas.current;
    if (!el || !c) return;
    const fit = () => {
      const rect = el.getBoundingClientRect();
      const dpr = Math.min(3, window.devicePixelRatio || 1);
      size.current = { w: rect.width, h: rect.height, dpr };
      c.width = Math.round(rect.width * dpr);
      c.height = Math.round(rect.height * dpr);
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
  }, [wake]);

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

  const turnOver = useCallback(() => {
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
    wiggled?: boolean;
  } | null>(null);
  const onPointerDown = (e: PointerEvent) => {
    if (e.button !== 0 && e.pointerType === "mouse") return;
    const s = sim.current;
    if (!s) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    callbacks.current.onPress?.();
    press.current = {
      id: e.pointerId,
      x: e.clientX,
      y: e.clientY,
      minutes: s.run.minutes,
      dragging: false,
    };
  };
  const onPointerMove = (e: PointerEvent) => {
    const p = press.current;
    if (!p || p.id !== e.pointerId) return;
    // A sideways wiggle is a shake — the desk's, where there is no phone
    // to shake.
    const dx = e.clientX - p.x;
    p.x = e.clientX;
    if (Math.abs(dx) > 3) {
      const s = sim.current;
      if (s) {
        s.shake = Math.min(1, s.shake + Math.abs(dx) * WIGGLE_PER_PX);
        wake();
      }
    }
    const dy = p.y - e.clientY;
    if (!p.dragging && Math.abs(dy) > 10) p.dragging = true;
    if (!p.dragging && Math.abs(dx) > 3) p.wiggled = true;
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
    if (!p.dragging && !p.wiggled) turnOver();
  };
  const onPointerCancel = () => {
    press.current = null;
  };
  const onWheel = (e: WheelEvent) => {
    if (e.deltaY === 0) return;
    e.preventDefault();
    step(e.deltaY < 0 ? 1 : -1);
  };
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      turnOver();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      step(1);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      step(-1);
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
      onWheel={onWheel}
      onKeyDown={onKeyDown}
    >
      <canvas ref={canvas} aria-hidden="true" className="block" />
      <div
        aria-live="polite"
        className={`app-label pointer-events-none absolute inset-x-0 bottom-[5%] text-center text-sm font-medium tabular-nums text-muted transition-opacity duration-300 ${
          label ? "opacity-100" : "opacity-0"
        }`}
      >
        {label ?? ""}
      </div>
    </div>
  );
}
