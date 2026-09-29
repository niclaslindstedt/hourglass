// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { useEffect, useRef } from "react";

import { layoutOf } from "./glass.ts";
import { useT } from "./i18n/index.ts";
import {
  GLASS,
  GLASSES,
  LOOK_PRESET,
  LOOK_PRESETS,
  SAND,
  SANDS,
  TOPS,
  resolveLook,
  type Glass,
  type Look,
  type LookPreset,
  type Sand,
  type Top,
} from "./look.ts";
import { glassLight, grainPattern, paintHourglass } from "./paint.ts";
import { capacity, createBulb, funnelFill, pileFill } from "./sand.ts";
import { PITCH, YAW } from "./scene.ts";
import { FILL, pageIsLight } from "./Hourglass.tsx";

// The settings' hourglass picker: ten presets and an eleventh card, Custom,
// that takes the glass apart.
//
// Every preset card is a drawing of the hourglass it picks, part way
// through a run — the choice previews itself, because the glass is on
// another screen and a name says nothing about what it looks like. Under
// Custom the same drawing is the live preview of what the three pickers
// below it add up to.
//
// The pickers read and write the caller's settings; nothing here is state.

/** How far through its run a card's glass stands: enough in both bulbs
 *  for the funnel and the cone to read. */
const SHOWROOM = 0.42;

type Props = {
  preset: LookPreset | "custom";
  custom: Look;
  onPreset: (next: LookPreset | "custom") => void;
  onCustom: (next: Look) => void;
};

export function HourglassPicker({ preset, custom, onPreset, onCustom }: Props) {
  const t = useT();
  const current = resolveLook(preset, custom);
  const set = <K extends keyof Look>(key: K, value: Look[K]) =>
    onCustom({ ...current, [key]: value });

  return (
    <div className="flex flex-col gap-3">
      <div
        role="radiogroup"
        aria-label={t("settings.glassPreset")}
        className="grid grid-cols-3 gap-2 sm:grid-cols-4"
      >
        {LOOK_PRESETS.map((id) => (
          <PresetCard
            key={id}
            look={LOOK_PRESET[id]}
            name={t(`settings.preset.${id}`)}
            hint={t(`settings.presetHint.${id}`)}
            on={preset === id}
            onPick={() => onPreset(id)}
          />
        ))}
        <PresetCard
          look={custom}
          name={t("settings.glassCustom")}
          hint={t("settings.glassCustomHint")}
          on={preset === "custom"}
          onPick={() => {
            // Custom starts from the glass you are looking at, not from
            // the one you left there last time.
            if (preset !== "custom") onCustom(current);
            onPreset("custom");
          }}
        />
      </div>

      {preset === "custom" && (
        <div className="flex flex-col gap-3 rounded-xl border border-line bg-surface-3 p-3">
          <Labelled label={t("settings.top")}>
            <Chips<Top>
              label={t("settings.top")}
              value={current.top}
              options={TOPS.map((id) => ({
                value: id,
                label: t(`settings.tops.${id}`),
              }))}
              onChange={(id) => set("top", id)}
            />
            <p className="text-xs text-muted">
              {t(`settings.topHint.${current.top}`)}
            </p>
          </Labelled>
          <Labelled label={t("settings.shape")}>
            <Chips<Glass>
              label={t("settings.shape")}
              value={current.glass}
              options={GLASSES.map((id) => ({
                value: id,
                label: t(`settings.shapes.${id}`),
              }))}
              onChange={(id) => set("glass", id)}
            />
            <p className="text-xs text-muted">
              {t(`settings.shapeHint.${current.glass}`)}
            </p>
          </Labelled>
          <Labelled label={t("settings.sand")}>
            <div
              role="radiogroup"
              aria-label={t("settings.sand")}
              className="flex flex-wrap gap-2"
            >
              {SANDS.map((id) => (
                <Swatch
                  key={id}
                  sand={id}
                  name={t(`settings.sands.${id}`)}
                  on={current.sand === id}
                  onPick={() => set("sand", id)}
                />
              ))}
            </div>
            <p className="text-xs text-muted">{t("settings.sandHint")}</p>
          </Labelled>
        </div>
      )}
    </div>
  );
}

function PresetCard({
  look,
  name,
  hint,
  on,
  onPick,
}: {
  look: Look;
  name: string;
  hint: string;
  on: boolean;
  onPick: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={on}
      aria-label={`${name}. ${hint}`}
      title={hint}
      onClick={onPick}
      className={`flex flex-col items-center gap-1.5 overflow-hidden rounded-xl border p-2 transition-colors ${
        on
          ? "border-accent bg-accent/10"
          : "border-line bg-surface-3 hover:bg-surface-2"
      }`}
    >
      <MiniGlass look={look} />
      <span
        className={`text-xs font-semibold ${on ? "text-fg-bright" : "text-fg"}`}
      >
        {name}
      </span>
    </button>
  );
}

/** A small still of one hourglass, painted once per look. */
export function MiniGlass({
  look,
  className,
}: {
  look: Look;
  className?: string;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const el = canvas.current;
    if (!el) return;
    const w = el.clientWidth || 96;
    const h = el.clientHeight || 120;
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    el.width = Math.round(w * dpr);
    el.height = Math.round(h * dpr);
    const ctx = el.getContext("2d");
    if (!ctx) return;
    const layout = layoutOf(look);
    const repose = SAND[look.sand].repose;
    const source = createBulb(layout.bulb, "waist", repose);
    const sink = createBulb(layout.bulb, "plate", repose);
    const sand = capacity(source) * FILL;
    funnelFill(source, sand, sand * (1 - SHOWROOM));
    pileFill(sink, sand * SHOWROOM);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    paintHourglass(ctx, {
      cam: { pitch: PITCH, yaw: YAW, scale: h * 0.88, cx: w / 2, cy: h / 2 },
      look,
      layout,
      source,
      sink,
      gravity: 1,
      flow: 1,
      t: 0,
      glow: 0,
      dpr,
      grain: grainPattern(ctx, SAND[look.sand], dpr),
      glassLight: glassLight(
        layout,
        GLASS[look.glass],
        h * 0.88,
        PITCH,
        dpr,
        pageIsLight(),
      ),
      light: pageIsLight(),
    });
  }, [look]);
  return (
    <canvas
      ref={canvas}
      aria-hidden="true"
      className={className ?? "block aspect-[4/5] w-full"}
    />
  );
}

/** A sand, as a disc of its own colour: the one picker here that is about
 *  a colour, drawn as the colour rather than named. */
function Swatch({
  sand,
  name,
  on,
  onPick,
}: {
  sand: Sand;
  name: string;
  on: boolean;
  onPick: () => void;
}) {
  const spec = SAND[sand];
  return (
    <button
      type="button"
      role="radio"
      aria-checked={on}
      aria-label={name}
      title={name}
      onClick={onPick}
      className={`h-9 w-9 rounded-full border-2 transition-transform ${
        on ? "scale-110 border-accent" : "border-line hover:scale-105"
      }`}
      style={{
        background: `radial-gradient(circle at 40% 35%, ${spec.light}, ${spec.color} 55%, ${spec.dark})`,
      }}
    />
  );
}

/** A wrapping row of choices, for pickers with more words than a segmented
 *  control could fit on a phone. */
function Chips<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (next: T) => void;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="flex flex-wrap gap-1.5"
    >
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.value)}
            className={`min-h-8 rounded-full border px-3 text-sm transition-colors ${
              on
                ? "border-accent bg-accent/15 text-fg-bright"
                : "border-line bg-surface-2 text-fg hover:bg-surface-1"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function Labelled({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-medium text-fg">{label}</span>
      {children}
    </div>
  );
}
