// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import {
  brightness,
  moonIlluminance,
  moonPhase,
  moonPosition,
  STARLIGHT_LUX,
  sunIlluminance,
  sunPosition,
  type Place,
  type SkyPosition,
} from "./astronomy.ts";

// The sky behind the glass, as numbers: where the sun and the moon stand,
// and what colour and how bright everything they light is — the dome's
// zenith and horizon, the glow round the sun, the sun's own colour through
// the air it crossed, the key light the glass is lit by, the cloud, the
// stars. The colour model is the sibling game4's clear sky (its `sky.ts`),
// cut to what a glass on a phone needs; the brightness is the measured
// light of a clear sky for the sun's height and the moon's
// (`astronomy.ts`), so a winter noon in the north is a paler, lower light
// than a summer one in the south, a sunset is dimmer than an afternoon, and
// a night is dark but for the moon.
//
// THREE-FREE ON PURPOSE, and clock-free: the moment and the place are
// parameters, handed in by `Hourglass.tsx`. `render/skyDome.ts` turns a
// `SkyLook` into uniforms and lights; nothing else decides what colour the
// air is.
//
// The clear day is a function of the sun's height alone:
//
//   * THE SUN'S COLOUR is the air it crossed: transmittance per channel is
//     `exp(-k · airmass)` with a Rayleigh-leaning extinction and the
//     Kasten–Young air mass, so a noon sun is a hair warm of white and a
//     sun ten degrees up is gold — without a table of hand-picked oranges.
//   * THE ZENITH DEEPENS as the sun climbs, and the horizon stays pale.
//   * THE NIGHT takes over as the sun goes under: a warm band low toward
//     where it set, a blue deepening to black overhead, the stars coming
//     out by nautical twilight — and the key light passes to the MOON, as
//     bright as its height and phase say, which lifts the night sky a
//     little toward a moonlit blue.
//
// Every colour is LINEAR RGB, what the shaders mix in.

export type Rgb = [number, number, number];

/** A unit vector in the sky's frame: x east, y up, z south. */
export type Dir = { x: number; y: number; z: number };

/** Which sky stands behind the glass: the one outside at this moment, or
 *  a fixed one. */
export type SkyChoice = "now" | "day" | "dusk" | "night";

export const SKY_CHOICES: readonly SkyChoice[] = [
  "now",
  "day",
  "dusk",
  "night",
];

export type SkyLook = {
  /** Toward the sun, and its altitude over the horizon, rad. */
  sun: Dir;
  elevation: number;
  /** Toward the moon, how much of it is lit (0..1), and how bright its
   *  light is next to the whole scene's, 0..1. */
  moon: Dir;
  moonLit: number;
  moonShare: number;
  /** The dome overhead and at the horizon. */
  zenith: Rgb;
  horizon: Rgb;
  /** The glow round the sun (and after it has set). */
  glow: Rgb;
  /** The sun's own colour through the air it crossed: its disc. */
  sunColour: Rgb;
  /** The key light: toward it (the sun by day, the moon by night), its
   *  colour, and its strength in the renderer's units. */
  key: Dir;
  keyColour: Rgb;
  keyIntensity: number;
  /** The light off the whole dome: its colour, and its strength. */
  skyLight: Rgb;
  ambient: number;
  /** The heaps of cloud: how much of the sky they cover, and their lit
   *  tops and shaded bases. */
  cover: number;
  cloudLit: Rgb;
  cloudShade: Rgb;
  /** How dark it is, 0 (day) … 1 (full night), and how many stars show. */
  night: number;
  stars: number;
  /** The scene's horizontal illuminance, lux, and how bright the picture
   *  is drawn for it, 0..1 (`brightness`). */
  lux: number;
  brightness: number;
};

/** Where the phone looks when it is held upright with no compass to say
 *  otherwise: a little west of south, so a noon sun stands over the glass
 *  and an evening one sets on the right of the picture. */
export const VIEW_HEADING = (200 * Math.PI) / 180;

/** Extinction per unit air mass, per channel — mostly Rayleigh (blue lost
 *  first), with a little aerosol so a low sun goes gold, not magenta. */
const EXTINCTION: Rgb = [0.06, 0.1, 0.19];

/** How much of the sky the fair-weather heaps cover. */
const COVER = 0.3;

/** Kasten–Young air mass, for the sun's tint. */
function airMass(elevation: number): number {
  const deg = Math.max(-2, (elevation * 180) / Math.PI);
  return (
    1 /
    (Math.sin(Math.max(elevation, -0.03)) +
      0.50572 * Math.pow(deg + 6.07995, -1.6364))
  );
}

/** The sky direction toward a body at `azimuth` (from north, clockwise)
 *  and `altitude`. */
export function skyDirection(azimuth: number, altitude: number): Dir {
  const c = Math.cos(altitude);
  return {
    x: Math.sin(azimuth) * c,
    y: Math.sin(altitude),
    z: -Math.cos(azimuth) * c,
  };
}

function mix(a: Rgb, b: Rgb, t: number): Rgb {
  const k = Math.min(1, Math.max(0, t));
  return [
    a[0] + (b[0] - a[0]) * k,
    a[1] + (b[1] - a[1]) * k,
    a[2] + (b[2] - a[2]) * k,
  ];
}

function scale(a: Rgb, k: number): Rgb {
  return [a[0] * k, a[1] * k, a[2] * k];
}

function smooth(e0: number, e1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
}

/** The colour of sunlight after `elevation`'s worth of air, normalised so
 *  its brightest channel is 1. */
export function sunTint(elevation: number): Rgb {
  const m = Math.min(airMass(elevation), 38);
  const t: Rgb = [
    Math.exp(-EXTINCTION[0] * m),
    Math.exp(-EXTINCTION[1] * m),
    Math.exp(-EXTINCTION[2] * m),
  ];
  const top = Math.max(t[0], t[1], t[2]);
  return [t[0] / top, t[1] / top, t[2] / top];
}

/** Moonlight: the sun's, bluer to the eye's night vision. */
const MOONLIGHT: Rgb = [0.62, 0.74, 1.0];
/** A moonlit night sky, where the moon's light lifts it. */
const MOONLIT_ZENITH: Rgb = [0.012, 0.024, 0.07];
const MOONLIT_HORIZON: Rgb = [0.03, 0.045, 0.1];

/** The renderer's key at a full-bright scene, and its dome light. */
const KEY = 3.2;
const AMBIENT = 1.1;

/** The sun and the moon, for `skyLookFor`. */
export type Bodies = {
  sun: SkyPosition;
  moon: SkyPosition;
  /** The moon's lit share (0..1) and phase angle (rad, 0 at full). */
  moonLit: number;
  moonAngle: number;
};

/** The whole look for the sun and the moon where they stand. */
export function skyLookFor(bodies: Bodies): SkyLook {
  const elevation = bodies.sun.altitude;
  const azimuth = bodies.sun.azimuth;
  const high = smooth(0.0, 0.8, elevation);
  const day = smooth(-0.21, 0.04, elevation);
  const night = 1 - day;
  const dusk =
    smooth(-0.2, -0.01, elevation) * (1 - smooth(0.02, 0.22, elevation));
  const tint = sunTint(elevation);

  // THE LIGHT: the sun's, the moon's and the stars', in lux.
  const sunLux = sunIlluminance(elevation);
  const moonLux = moonIlluminance(bodies.moon.altitude, bodies.moonAngle);
  const lux = sunLux + moonLux + STARLIGHT_LUX;
  const bright = brightness(lux);
  const moonShare = moonLux / lux;

  // THE CLEAR DAY, and the night after it.
  const zenithDay = mix([0.06, 0.19, 0.62], [0.022, 0.1, 0.46], high);
  const horizonCool: Rgb = [0.46, 0.64, 0.92];
  const horizonDay = mix(
    mix(horizonCool, [0.8, 0.78, 0.8], (1 - high) * 0.35),
    horizonCool,
    high,
  );
  const lightUp = Math.pow(day, 1.6);
  // A moonlit night is a deep blue rather than black.
  const moonlit = Math.min(1, moonLux / 0.2) * night;
  const nightZenith = mix([0.003, 0.006, 0.018], MOONLIT_ZENITH, moonlit);
  const nightHorizon = mix([0.012, 0.018, 0.04], MOONLIT_HORIZON, moonlit);
  // Brightness past what the colour model already dims: a low winter sun
  // is paler than a high summer one of the same hue.
  const dim = 0.55 + 0.45 * Math.min(1, bright / 0.75);
  const zenith = scale(mix(nightZenith, zenithDay, lightUp), dim);
  let horizon = mix(nightHorizon, horizonDay, lightUp);
  horizon = scale(
    mix(horizon, [0.55, 0.38, 0.42], dusk * 0.45 * (1 - high)),
    dim,
  );
  let glow = mix([1.0, 0.72, 0.45], [1.0, 0.95, 0.88], high);
  glow = scale(mix(glow, [1.0, 0.42, 0.16], dusk), 0.15 + 0.85 * day);

  // THE KEY: whichever of the two lights is the stronger, by its share of
  // the scene's light — as bright as the picture is drawn.
  const sunDirect = Math.max(0, sunLux - 600) / Math.max(1, sunLux);
  const byMoon = moonLux > sunLux;
  const key = byMoon
    ? skyDirection(bodies.moon.azimuth, bodies.moon.altitude)
    : skyDirection(azimuth, Math.max(elevation, 0.02));
  const keyShare = byMoon ? 0.85 : 0.25 + 0.75 * sunDirect;
  const keyIntensity = KEY * bright * keyShare;

  const skyLight = mix(
    mix([0.3, 0.42, 0.95], MOONLIGHT, moonlit),
    mix([0.42, 0.58, 0.95], [0.36, 0.55, 1.0], high),
    day,
  );
  const ambient = AMBIENT * bright;

  const cloudLit = mix(
    scale(zenith, 1.6),
    [1.05 * tint[0], 1.02 * tint[1], tint[2]],
    lightUp * 0.9,
  );
  const cloudShade = mix(
    scale(zenith, 1.2),
    mix(horizon, [0.6, 0.66, 0.76], 0.5),
    lightUp,
  );

  return {
    sun: skyDirection(azimuth, elevation),
    elevation,
    moon: skyDirection(bodies.moon.azimuth, bodies.moon.altitude),
    moonLit: bodies.moonLit,
    moonShare,
    zenith,
    horizon,
    glow,
    sunColour: tint,
    key,
    keyColour: byMoon ? MOONLIGHT : tint,
    keyIntensity,
    skyLight,
    ambient,
    cover: COVER,
    cloudLit,
    cloudShade,
    night,
    stars: smooth(0.1, 0.26, -elevation) * (1 - 0.6 * moonlit),
    lux,
    brightness: bright,
  };
}

const DEG = Math.PI / 180;

/** The fixed skies: a high afternoon, a sun just over the horizon, a night
 *  under a moon two days off full. */
const FIXED: Record<Exclude<SkyChoice, "now">, Bodies> = {
  day: {
    sun: { azimuth: 215 * DEG, altitude: 42 * DEG },
    moon: { azimuth: 90 * DEG, altitude: -20 * DEG },
    moonLit: 0.5,
    moonAngle: Math.PI / 2,
  },
  dusk: {
    sun: { azimuth: 238 * DEG, altitude: 1.5 * DEG },
    moon: { azimuth: 110 * DEG, altitude: 12 * DEG },
    moonLit: 0.35,
    moonAngle: 2.0,
  },
  night: {
    sun: { azimuth: 0, altitude: -34 * DEG },
    moon: { azimuth: 170 * DEG, altitude: 34 * DEG },
    moonLit: 0.94,
    moonAngle: 0.5,
  },
};

/** The sun and the moon for a sky choice: where they stand at `ms` from
 *  `place`, or a fixed sky. */
export function bodiesFor(choice: SkyChoice, ms: number, place: Place): Bodies {
  if (choice !== "now") return FIXED[choice];
  const phase = moonPhase(ms);
  return {
    sun: sunPosition(ms, place),
    moon: moonPosition(ms, place),
    moonLit: phase.fraction,
    moonAngle: phase.angle,
  };
}
