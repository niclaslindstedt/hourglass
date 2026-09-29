// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import {
  DEFAULT_THEME_APPEARANCE,
  type ThemeAppearance,
} from "@niclaslindstedt/oss-framework/theme";

import type { ThemeChoice } from "./useAppSettings.ts";

// The app's look, and the hourglass's vocabulary.
//
// The framework ships a dozen palettes and a full appearance picker; this
// app exposes exactly two — one light, one dark — plus "follow the device".
// The hourglass is not a theme: it is an object with colours of its own, the
// way a watch is, and a dark walnut frame is dark walnut on the light theme.
// Its wood, its glass and its sand never reach the UI around it.
//
// Everything an hourglass is made of is one of three choices, each an id and
// a spec so the settings can validate what they read back and the tests can
// walk every combination:
//
//   top    the frame — what the two end plates are made of and what shape
//          they are, how many posts hold them apart and what the posts look
//          like, and what sits on the top plate's corners
//   glass  the shape of the two bulbs and the tint of the glass
//   sand   the colour of the sand, how coarse it is, and — because it is a
//          real property of a real material — the angle it piles at
//
// Ten presets combine them; Custom takes them apart.

/** The framework preset behind each of the three choices. */
const PRESET = {
  light: "githubLight",
  dark: "githubDark",
  system: "system",
} as const;

/** Project the user's theme choice onto the framework's appearance shape. */
export function appearanceFor(choice: ThemeChoice): ThemeAppearance {
  return {
    ...DEFAULT_THEME_APPEARANCE,
    theme: PRESET[choice],
    fontFamily: "sans",
    ui: { ...DEFAULT_THEME_APPEARANCE.ui, radius: "lg" },
  };
}

/** The look the app boots in before the persisted settings have been read. */
export const APP_LOOK: ThemeAppearance = appearanceFor("system");

// ── The top ─────────────────────────────────────────────────────────────────
// The frame: two end plates and the posts between them. Measured off a real
// glass (see `docs/design.md`): the plates are each about nine hundredths of
// the whole height thick, a little under twice as wide as the bulbs, and the
// posts stand a finger's width outside the glass at its widest.

export type Top =
  "walnut" | "oak" | "pine" | "ebony" | "brass" | "copper" | "steel" | "bare";

/** How a material is painted: a wood shows its grain, a metal a bright band
 *  down its length, a lacquer a soft sheen, and glass its edges only. */
export type Finish = "wood" | "metal" | "lacquer" | "glass";

export type PostStyle = "rod" | "baluster" | "band";

export type TopSpec = {
  /** The end plates' outline, seen from above. */
  plate: "square" | "round";
  /** Half the plate's width (a square's half side, a disc's radius), as a
   *  share of the hourglass's height. */
  reach: number;
  /** How thick each plate is, the same share. */
  thick: number;
  /** The plates' material: the lit face, the side in shadow, a hairline
   *  along the edge, and how it is finished. */
  face: string;
  side: string;
  edge: string;
  finish: Finish;
  /** A line inlaid round the plate's edge, or none. */
  inlay?: string;
  /** How many posts, and what they are. Four stand at a square's corners,
   *  three round a disc, two on a square's diagonal; none is a frameless
   *  glass with thick ground ends. */
  posts: 0 | 2 | 3 | 4;
  post: PostStyle;
  /** A post's radius, and its two tones. */
  postR: number;
  postColor: string;
  postLight: string;
  /** What caps the posts on the top plate: an acorn nut, a ball, or nothing
   *  (the posts end in the plate). */
  finial: "acorn" | "ball" | "none";
  finialColor: string;
};

export const TOPS: readonly Top[] = [
  "walnut",
  "oak",
  "pine",
  "ebony",
  "brass",
  "copper",
  "steel",
  "bare",
];

export const TOP: Record<Top, TopSpec> = {
  // The study glass: square walnut plates, four slim black steel posts and
  // acorn nuts — the shape most hourglasses sold today have.
  walnut: {
    plate: "square",
    reach: 0.19,
    thick: 0.085,
    face: "#6e4430",
    side: "#43271b",
    edge: "#9a6a4d",
    finish: "wood",
    posts: 4,
    post: "rod",
    postR: 0.009,
    postColor: "#16161a",
    postLight: "#4a4a52",
    finial: "acorn",
    finialColor: "#26262c",
  },
  // The antique: round turned oak, three turned oak spindles, no finials.
  oak: {
    plate: "round",
    reach: 0.2,
    thick: 0.09,
    face: "#b8895a",
    side: "#7d5734",
    edge: "#d3a878",
    finish: "wood",
    posts: 3,
    post: "baluster",
    postR: 0.016,
    postColor: "#9c7247",
    postLight: "#d7ae7f",
    finial: "none",
    finialColor: "#9c7247",
  },
  // The Nordic one: blonde pine, four pale dowels.
  pine: {
    plate: "square",
    reach: 0.185,
    thick: 0.075,
    face: "#e2c39a",
    side: "#b8946b",
    edge: "#f0dcbf",
    finish: "wood",
    posts: 4,
    post: "rod",
    postR: 0.011,
    postColor: "#cfae84",
    postLight: "#f1dcc0",
    finial: "none",
    finialColor: "#cfae84",
  },
  // The deco piece: black lacquer with a gold line, four slim brass posts
  // and a ball on each.
  ebony: {
    plate: "round",
    reach: 0.19,
    thick: 0.07,
    face: "#1b1b20",
    side: "#0c0c10",
    edge: "#3a3a44",
    finish: "lacquer",
    inlay: "#d1a54a",
    posts: 4,
    post: "rod",
    postR: 0.007,
    postColor: "#9e7a2c",
    postLight: "#f0d58a",
    finial: "ball",
    finialColor: "#d1a54a",
  },
  // The ship's glass: turned brass, three brass balusters.
  brass: {
    plate: "round",
    reach: 0.195,
    thick: 0.06,
    face: "#c9a24a",
    side: "#8a6a24",
    edge: "#f1d98a",
    finish: "metal",
    posts: 3,
    post: "baluster",
    postR: 0.013,
    postColor: "#b08d3a",
    postLight: "#f3dc94",
    finial: "none",
    finialColor: "#b08d3a",
  },
  // Copper, warm and a little dark, three plain rods with balls.
  copper: {
    plate: "round",
    reach: 0.19,
    thick: 0.065,
    face: "#b8663a",
    side: "#7b3f22",
    edge: "#e6956a",
    finish: "metal",
    posts: 3,
    post: "rod",
    postR: 0.01,
    postColor: "#a55a33",
    postLight: "#e79a70",
    finial: "ball",
    finialColor: "#c46f43",
  },
  // Brushed steel: square plates, two flat bands on the diagonal.
  steel: {
    plate: "square",
    reach: 0.18,
    thick: 0.055,
    face: "#a7adb6",
    side: "#6c737d",
    edge: "#dfe4ea",
    finish: "metal",
    posts: 2,
    post: "band",
    postR: 0.014,
    postColor: "#8d949e",
    postLight: "#e3e8ee",
    finial: "none",
    finialColor: "#8d949e",
  },
  // No frame at all: the glass stands on its own thick ground ends.
  bare: {
    plate: "round",
    reach: 0.13,
    thick: 0.04,
    face: "rgba(255,255,255,0.22)",
    side: "rgba(255,255,255,0.08)",
    edge: "rgba(255,255,255,0.55)",
    finish: "glass",
    posts: 0,
    post: "rod",
    postR: 0,
    postColor: "transparent",
    postLight: "transparent",
    finial: "none",
    finialColor: "transparent",
  },
};

// ── The glass ───────────────────────────────────────────────────────────────
// Two bulbs joined at a waist. A shape is a profile — the radius of the bulb
// along its height, from the plate end to the neck — and every shape is the
// same profile twice, top and bottom, because a glass that ran a different
// time each way would not be an hourglass.

export type Glass =
  "teardrop" | "sphere" | "cone" | "slim" | "antique" | "bell";

export type GlassSpec = {
  /** The profile: `[t, r]` points from the plate end (t = 0) to the waist
   *  (t = 1), r as a share of the bulb's widest radius. Interpolated with a
   *  monotone cubic, so the curve never overshoots a point. */
  profile: readonly (readonly [number, number])[];
  /** The bulb's widest radius, as a share of the hourglass's height. */
  radius: number;
  /** The bore — the hole the sand runs through — as a share of the radius. */
  bore: number;
  /** The tint of the glass, over whatever is behind it. */
  tint: string;
  /** How thick the wall reads: the strength of the edge highlights, 0–1. */
  wall: number;
};

export const GLASSES: readonly Glass[] = [
  "teardrop",
  "sphere",
  "cone",
  "slim",
  "antique",
  "bell",
];

export const GLASS: Record<Glass, GlassSpec> = {
  // Measured off the study glass: a dome from the plate to the widest point
  // a third of the way down, convex to three quarters, then a concave flare
  // into the waist.
  teardrop: {
    profile: [
      [0, 0.6],
      [0.06, 0.82],
      [0.18, 0.96],
      [0.33, 1],
      [0.5, 0.93],
      [0.66, 0.74],
      [0.79, 0.48],
      [0.89, 0.26],
      [0.96, 0.14],
      [1, 0.085],
    ],
    radius: 0.17,
    bore: 0.03,
    tint: "rgba(220, 232, 240, 0.07)",
    wall: 0.6,
  },
  // Two near-spheres and a short waist, the blown shape.
  sphere: {
    profile: [
      [0, 0.52],
      [0.08, 0.82],
      [0.22, 0.97],
      [0.4, 1],
      [0.56, 0.95],
      [0.7, 0.8],
      [0.82, 0.55],
      [0.91, 0.3],
      [0.97, 0.14],
      [1, 0.085],
    ],
    radius: 0.175,
    bore: 0.03,
    tint: "rgba(220, 232, 240, 0.07)",
    wall: 0.6,
  },
  // Two cones tip to tip, thick-walled and straight-sided.
  cone: {
    profile: [
      [0, 0.94],
      [0.05, 1],
      [0.3, 0.78],
      [0.6, 0.47],
      [0.85, 0.22],
      [0.96, 0.11],
      [1, 0.08],
    ],
    radius: 0.16,
    bore: 0.035,
    tint: "rgba(220, 232, 240, 0.09)",
    wall: 0.9,
  },
  // Tall and narrow, smoked grey.
  slim: {
    profile: [
      [0, 0.55],
      [0.1, 0.86],
      [0.28, 0.99],
      [0.42, 1],
      [0.6, 0.9],
      [0.75, 0.68],
      [0.87, 0.4],
      [0.95, 0.18],
      [1, 0.09],
    ],
    radius: 0.125,
    bore: 0.04,
    tint: "rgba(40, 40, 52, 0.28)",
    wall: 0.5,
  },
  // Old glass: a faint green, rounder, a longer collar at the waist.
  antique: {
    profile: [
      [0, 0.5],
      [0.08, 0.8],
      [0.22, 0.96],
      [0.38, 1],
      [0.54, 0.94],
      [0.68, 0.78],
      [0.8, 0.52],
      [0.88, 0.3],
      [0.94, 0.16],
      [1, 0.1],
    ],
    radius: 0.17,
    bore: 0.03,
    tint: "rgba(150, 205, 170, 0.14)",
    wall: 0.75,
  },
  // Flat, wide ends that curve straight into the waist.
  bell: {
    profile: [
      [0, 0.98],
      [0.08, 1],
      [0.3, 0.9],
      [0.55, 0.62],
      [0.78, 0.32],
      [0.93, 0.14],
      [1, 0.085],
    ],
    radius: 0.165,
    bore: 0.035,
    tint: "rgba(220, 232, 240, 0.07)",
    wall: 0.7,
  },
};

// ── The sand ────────────────────────────────────────────────────────────────
// A colour, a grain and an angle. The angle of repose is the slope a heap of
// it settles at — about a third of a right angle for most sand, less for
// something round like glass beads — and it is what shapes the funnel in the
// top bulb and the cone in the bottom, so it belongs to the sand and not to
// the drawing.

export type Sand =
  "quartz" | "white" | "black" | "red" | "blue" | "gold" | "pink" | "green";

export type SandSpec = {
  /** The colour in full light, in shadow, and on a lit edge. */
  color: string;
  dark: string;
  light: string;
  /** How coarse the grains read: fine sand runs as a thread, coarse as
   *  grains you can count. */
  grain: "fine" | "coarse";
  /** Whether the grains catch the light (a metallic or crystal sand). */
  sparkle: boolean;
  /** The angle of repose, in degrees. */
  repose: number;
};

export const SANDS: readonly Sand[] = [
  "quartz",
  "white",
  "black",
  "red",
  "blue",
  "gold",
  "pink",
  "green",
];

export const SAND: Record<Sand, SandSpec> = {
  quartz: {
    color: "#d8c49b",
    dark: "#8f7a52",
    light: "#f4e6c4",
    grain: "fine",
    sparkle: false,
    repose: 33,
  },
  white: {
    color: "#ece8de",
    dark: "#a6a094",
    light: "#ffffff",
    grain: "fine",
    sparkle: false,
    repose: 34,
  },
  black: {
    color: "#2c2c31",
    dark: "#121215",
    light: "#5c5c66",
    grain: "fine",
    sparkle: false,
    repose: 35,
  },
  red: {
    color: "#b9502f",
    dark: "#6e2a16",
    light: "#e8865f",
    grain: "coarse",
    sparkle: false,
    repose: 32,
  },
  blue: {
    color: "#2f63b4",
    dark: "#1a3566",
    light: "#7fa6e6",
    grain: "coarse",
    sparkle: true,
    repose: 26,
  },
  gold: {
    color: "#d2a640",
    dark: "#7f5f1a",
    light: "#ffe58f",
    grain: "fine",
    sparkle: true,
    repose: 30,
  },
  pink: {
    color: "#e39bb2",
    dark: "#9a5b70",
    light: "#fbd2de",
    grain: "fine",
    sparkle: false,
    repose: 33,
  },
  green: {
    color: "#4f8a63",
    dark: "#2a4d36",
    light: "#8fc6a1",
    grain: "coarse",
    sparkle: false,
    repose: 34,
  },
};

// ── The hourglass ───────────────────────────────────────────────────────────

/** One hourglass: a top, a glass and a sand. */
export type Look = {
  top: Top;
  glass: Glass;
  sand: Sand;
};

/** The ten presets, named for where you would find one. */
export type LookPreset =
  | "study"
  | "harbor"
  | "midnight"
  | "desert"
  | "glacier"
  | "nordic"
  | "library"
  | "loft"
  | "meadow"
  | "treasure";

export const LOOK_PRESETS: readonly LookPreset[] = [
  "study",
  "harbor",
  "midnight",
  "desert",
  "glacier",
  "nordic",
  "library",
  "loft",
  "meadow",
  "treasure",
];

export const LOOK_PRESET: Record<LookPreset, Look> = {
  study: { top: "walnut", glass: "teardrop", sand: "quartz" },
  harbor: { top: "brass", glass: "sphere", sand: "white" },
  midnight: { top: "ebony", glass: "slim", sand: "black" },
  desert: { top: "copper", glass: "bell", sand: "red" },
  glacier: { top: "steel", glass: "cone", sand: "blue" },
  nordic: { top: "pine", glass: "sphere", sand: "black" },
  library: { top: "oak", glass: "antique", sand: "quartz" },
  loft: { top: "bare", glass: "cone", sand: "white" },
  meadow: { top: "oak", glass: "teardrop", sand: "green" },
  treasure: { top: "brass", glass: "bell", sand: "gold" },
};

export const DEFAULT_LOOK_PRESET: LookPreset = "study";

/** The hourglass a setting adds up to: a preset's, or the custom one. */
export function resolveLook(preset: LookPreset | "custom", custom: Look): Look {
  return preset === "custom" ? custom : LOOK_PRESET[preset];
}

/** One of a table's keys, or the fallback: what every stored choice is
 *  clamped to, so a value from an older build can never pick a top, a glass
 *  or a sand that does not exist. */
export function oneOf<K extends string>(
  table: Record<K, unknown>,
  value: unknown,
  fallback: K,
): K {
  return typeof value === "string" && value in table ? (value as K) : fallback;
}

/** A custom look, field by field, against the default preset. */
export function clampLook(value: unknown): Look {
  const base = LOOK_PRESET[DEFAULT_LOOK_PRESET];
  const raw = (
    typeof value === "object" && value !== null ? value : {}
  ) as Partial<Record<keyof Look, unknown>>;
  return {
    top: oneOf(TOP, raw.top, base.top),
    glass: oneOf(GLASS, raw.glass, base.glass),
    sand: oneOf(SAND, raw.sand, base.sand),
  };
}
