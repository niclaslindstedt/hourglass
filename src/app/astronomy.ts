// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { ZONES } from "./zones.ts";

// Where the sun and the moon stand, and how much light they give: what the
// sky behind the glass is drawn from, and what lights the glass itself.
//
// The positions are the standard low-precision formulas (the ones in
// Astronomy Answers' "Position of the Sun" and "Position of the Moon", as
// the suncalc library has them): good to a fraction of a degree, which is
// far finer than a sky on a phone can show. The light is the measured
// horizontal illuminance of a clear sky for the sun's height — about a
// hundred thousand lux at a high noon, four to six hundred at sunset, 3.4
// at the end of civil twilight, a hundredth of a lux by the end of nautical
// twilight — and the moon's by its height and its phase, a quarter of a lux
// for a full moon overhead. Season and place come in through the height
// alone: a Stockholm noon in December has the sun seven degrees up, and the
// light of a Madrid afternoon two hours before sunset.
//
// Pure and clock-free: the moment is a parameter (milliseconds since the
// epoch), handed in by the loop. The place is the city the device's time
// zone is named for (`placeOfZone`) — never a location lookup, and nothing
// is asked for or sent.

const RAD = Math.PI / 180;
const DAY_MS = 86_400_000;
const J1970 = 2440588;
const J2000 = 2451545;
/** The obliquity of the ecliptic. */
const OBLIQUITY = RAD * 23.4397;

/** A place on the Earth, in degrees. */
export type Place = { lat: number; lon: number };

/** Where a body stands in the sky: its azimuth from north, clockwise, and
 *  its altitude over the horizon, both in radians. */
export type SkyPosition = { azimuth: number; altitude: number };

/** Days since J2000 for a moment. */
function toDays(ms: number): number {
  return ms / DAY_MS - 0.5 + J1970 - J2000;
}

function rightAscension(l: number, b: number): number {
  return Math.atan2(
    Math.sin(l) * Math.cos(OBLIQUITY) - Math.tan(b) * Math.sin(OBLIQUITY),
    Math.cos(l),
  );
}

function declination(l: number, b: number): number {
  return Math.asin(
    Math.sin(b) * Math.cos(OBLIQUITY) +
      Math.cos(b) * Math.sin(OBLIQUITY) * Math.sin(l),
  );
}

/** Azimuth from north, clockwise, for an hour angle, a latitude and a
 *  declination. */
function azimuthOf(h: number, phi: number, dec: number): number {
  return (
    Math.atan2(
      Math.sin(h),
      Math.cos(h) * Math.sin(phi) - Math.tan(dec) * Math.cos(phi),
    ) + Math.PI
  );
}

function altitudeOf(h: number, phi: number, dec: number): number {
  return Math.asin(
    Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(h),
  );
}

function siderealTime(d: number, lw: number): number {
  return RAD * (280.16 + 360.9856235 * d) - lw;
}

function sunCoords(d: number): { dec: number; ra: number } {
  const m = RAD * (357.5291 + 0.98560028 * d);
  const c =
    RAD *
    (1.9148 * Math.sin(m) + 0.02 * Math.sin(2 * m) + 0.0003 * Math.sin(3 * m));
  const l = m + c + RAD * 102.9372 + Math.PI;
  return { dec: declination(l, 0), ra: rightAscension(l, 0) };
}

function moonCoords(d: number): { dec: number; ra: number; dist: number } {
  const l0 = RAD * (218.316 + 13.176396 * d);
  const m = RAD * (134.963 + 13.064993 * d);
  const f = RAD * (93.272 + 13.22935 * d);
  const l = l0 + RAD * 6.289 * Math.sin(m);
  const b = RAD * 5.128 * Math.sin(f);
  return {
    ra: rightAscension(l, b),
    dec: declination(l, b),
    dist: 385001 - 20905 * Math.cos(m),
  };
}

/** The sun's place in the sky at `ms` from `place`. */
export function sunPosition(ms: number, place: Place): SkyPosition {
  const lw = RAD * -place.lon;
  const phi = RAD * place.lat;
  const d = toDays(ms);
  const c = sunCoords(d);
  const h = siderealTime(d, lw) - c.ra;
  return {
    azimuth: azimuthOf(h, phi, c.dec),
    altitude: altitudeOf(h, phi, c.dec),
  };
}

/** The moon's place in the sky at `ms` from `place`, lifted by the
 *  refraction near the horizon. */
export function moonPosition(ms: number, place: Place): SkyPosition {
  const lw = RAD * -place.lon;
  const phi = RAD * place.lat;
  const d = toDays(ms);
  const c = moonCoords(d);
  const h = siderealTime(d, lw) - c.ra;
  let alt = altitudeOf(h, phi, c.dec);
  // Bennett's refraction, for an altitude over the horizon.
  const a = Math.max(alt, 0);
  alt += 0.0002967 / Math.tan(a + 0.00312536 / (a + 0.08901179));
  return { azimuth: azimuthOf(h, phi, c.dec), altitude: alt };
}

/** How much of the moon is lit at `ms` (0 new … 1 full), and its phase
 *  angle — the angle sun–moon–earth, 0 at full, π at new — in radians. */
export function moonPhase(ms: number): { fraction: number; angle: number } {
  const d = toDays(ms);
  const s = sunCoords(d);
  const m = moonCoords(d);
  const sdist = 149598000;
  const phi = Math.acos(
    Math.sin(s.dec) * Math.sin(m.dec) +
      Math.cos(s.dec) * Math.cos(m.dec) * Math.cos(s.ra - m.ra),
  );
  const inc = Math.atan2(sdist * Math.sin(phi), m.dist - sdist * Math.cos(phi));
  return { fraction: (1 + Math.cos(inc)) / 2, angle: Math.abs(inc) };
}

/** Kasten–Young relative optical air mass for a body `altitude` rad up. */
export function airMass(altitude: number): number {
  const deg = Math.max(-2, altitude / RAD);
  return (
    1 /
    (Math.sin(Math.max(altitude, -0.03)) +
      0.50572 * Math.pow(deg + 6.07995, -1.6364))
  );
}

/** The measured twilight: log10 of the horizontal illuminance, in lux, at
 *  the sun's altitude in degrees, from sunset down to full night. */
const TWILIGHT: readonly (readonly [number, number])[] = [
  [0, Math.log10(600)],
  [-3, Math.log10(60)],
  [-6, Math.log10(3.4)],
  [-9, Math.log10(0.2)],
  [-12, Math.log10(0.008)],
  [-15, Math.log10(0.0015)],
  [-18, Math.log10(0.0007)],
];

/** What the night sky gives with no sun and no moon: starlight and the
 *  air's own glow, about a thousandth of a lux. */
export const STARLIGHT_LUX = 0.001;

/**
 * The clear sky's horizontal illuminance, in lux, from the sun at
 * `altitude` rad: over the horizon the direct beam through the air it
 * crosses and the diffuse light of the dome; under it the measured
 * twilight, falling a decade every few degrees.
 */
export function sunIlluminance(altitude: number): number {
  const deg = altitude / RAD;
  if (deg >= 0) {
    const s = Math.sin(altitude);
    const direct = 127_500 * s * Math.exp(-0.21 * airMass(altitude));
    const diffuse = 15_500 * Math.sqrt(s);
    return 600 + direct + diffuse;
  }
  if (deg <= -18) return 0;
  for (let i = 0; i < TWILIGHT.length - 1; i++) {
    const [d0, l0] = TWILIGHT[i]!;
    const [d1, l1] = TWILIGHT[i + 1]!;
    if (deg <= d0 && deg >= d1) {
      const t = (d0 - deg) / (d0 - d1);
      return Math.pow(10, l0 + (l1 - l0) * t);
    }
  }
  return 0;
}

/** A full moon overhead, in lux. */
const FULL_MOON_LUX = 0.27;

/**
 * The moon's horizontal illuminance, in lux, at `altitude` rad and phase
 * `angle` rad: the full moon's quarter of a lux, dimmed by the phase the
 * way its magnitude falls (Allen's `0.026·φ + 4·10⁻⁹·φ⁴`, φ in degrees),
 * by the slant it lands at and the air it crosses.
 */
export function moonIlluminance(altitude: number, angle: number): number {
  if (altitude <= 0) return 0;
  const phi = Math.min(180, Math.abs(angle) / RAD);
  const mag = 0.026 * phi + 4e-9 * phi ** 4;
  const phase = Math.pow(10, -0.4 * mag);
  const air = Math.exp(-0.21 * (airMass(altitude) - 1));
  return FULL_MOON_LUX * phase * Math.sin(altitude) * air;
}

/** A high clear noon, in lux: what the brightness is measured against. */
export const NOON_LUX = 100_000;

/**
 * How bright the picture is for a scene lit by `lux`, 0..1: the eye (and a
 * camera) adapts, so a scene a million times darker is not drawn a million
 * times darker — it is drawn as a power of the light, which keeps a
 * moonlit glass readable and a starlit one a shape in the dark, and a
 * sunset visibly dimmer than a noon.
 */
export function brightness(lux: number): number {
  const rel = Math.max(1e-9, lux / NOON_LUX);
  return Math.min(1, Math.max(0.035, Math.pow(rel, 0.16)));
}

/** The place a time zone is named for, or — for a zone the table does not
 *  know — a place on the latitude most people live at and the longitude
 *  the zone's offset from UTC says (fifteen degrees an hour). */
export function placeOfZone(
  zone: string | undefined,
  offsetMinutes: number,
): Place {
  const known = zone ? ZONES[zone] : undefined;
  if (known) return { lat: known[0], lon: known[1] };
  return { lat: 40, lon: Math.max(-180, Math.min(180, offsetMinutes / 4)) };
}
