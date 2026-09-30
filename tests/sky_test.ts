// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, expect, it } from "vitest";

import {
  brightness,
  moonIlluminance,
  moonPhase,
  moonPosition,
  placeOfZone,
  sunIlluminance,
  sunPosition,
} from "../src/app/astronomy.ts";
import { bodiesFor, skyLookFor, SKY_CHOICES } from "../src/app/sky.ts";

const DEG = Math.PI / 180;
const STOCKHOLM = { lat: 59.3, lon: 18.1 };
const MADRID = { lat: 40.4, lon: -3.7 };

describe("the sun", () => {
  it("stands where the almanac has it", () => {
    // Stockholm's winter solstice noon: the sun about 7° up, due south.
    const winter = sunPosition(Date.UTC(2025, 11, 21, 10, 50), STOCKHOLM);
    expect(winter.altitude / DEG).toBeGreaterThan(6);
    expect(winter.altitude / DEG).toBeLessThan(8.5);
    expect(winter.azimuth / DEG).toBeGreaterThan(170);
    expect(winter.azimuth / DEG).toBeLessThan(190);
    // Its summer solstice noon: about 54° up.
    const summer = sunPosition(Date.UTC(2025, 5, 21, 10, 50), STOCKHOLM);
    expect(summer.altitude / DEG).toBeGreaterThan(52);
    expect(summer.altitude / DEG).toBeLessThan(56);
    // Midnight in winter: well under the horizon.
    const night = sunPosition(Date.UTC(2025, 11, 21, 23, 0), STOCKHOLM);
    expect(night.altitude / DEG).toBeLessThan(-40);
  });

  it("rises in the east and sets in the west", () => {
    const morning = sunPosition(Date.UTC(2025, 2, 20, 6, 30), MADRID);
    const evening = sunPosition(Date.UTC(2025, 2, 20, 18, 30), MADRID);
    expect(morning.azimuth / DEG).toBeGreaterThan(60);
    expect(morning.azimuth / DEG).toBeLessThan(120);
    expect(evening.azimuth / DEG).toBeGreaterThan(240);
    expect(evening.azimuth / DEG).toBeLessThan(300);
  });
});

describe("the moon", () => {
  it("is full and new when the calendar says so", () => {
    // A full moon: 2025-10-07; a new one: 2025-10-21.
    expect(moonPhase(Date.UTC(2025, 9, 7, 3, 48)).fraction).toBeGreaterThan(
      0.98,
    );
    expect(moonPhase(Date.UTC(2025, 9, 21, 12, 25)).fraction).toBeLessThan(
      0.02,
    );
  });

  it("is up at midnight when it is full", () => {
    const up = moonPosition(Date.UTC(2025, 9, 7, 0, 0), MADRID);
    expect(up.altitude / DEG).toBeGreaterThan(25);
  });
});

describe("the light", () => {
  it("follows the measured clear sky from noon to full night", () => {
    expect(sunIlluminance(70 * DEG)).toBeGreaterThan(90_000);
    expect(sunIlluminance(70 * DEG)).toBeLessThan(130_000);
    expect(sunIlluminance(0)).toBeGreaterThan(400);
    expect(sunIlluminance(0)).toBeLessThan(800);
    expect(sunIlluminance(-6 * DEG)).toBeCloseTo(3.4, 1);
    expect(sunIlluminance(-12 * DEG)).toBeCloseTo(0.008, 3);
    expect(sunIlluminance(-25 * DEG)).toBe(0);
    let last = Infinity;
    for (let deg = 90; deg >= -20; deg -= 0.5) {
      const e = sunIlluminance(deg * DEG);
      expect(e).toBeLessThanOrEqual(last + 1e-9);
      last = e;
    }
  });

  it("gives a full moon overhead a quarter of a lux, and a new one nothing much", () => {
    expect(moonIlluminance(90 * DEG, 0)).toBeCloseTo(0.27, 2);
    expect(moonIlluminance(90 * DEG, Math.PI / 2)).toBeLessThan(0.05);
    expect(moonIlluminance(-5 * DEG, 0)).toBe(0);
  });

  it("draws a darker scene darker, but never black", () => {
    expect(brightness(100_000)).toBeCloseTo(1, 3);
    expect(brightness(600)).toBeLessThan(brightness(20_000));
    expect(brightness(0.25)).toBeLessThan(brightness(3.4));
    expect(brightness(0)).toBeGreaterThan(0);
  });

  it("is dimmer at a northern winter noon than a southern summer one", () => {
    const north = skyLookFor(
      bodiesFor("now", Date.UTC(2025, 11, 21, 10, 50), STOCKHOLM),
    );
    const south = skyLookFor(
      bodiesFor("now", Date.UTC(2025, 5, 21, 12, 10), MADRID),
    );
    expect(north.lux).toBeLessThan(south.lux / 3);
    expect(north.brightness).toBeLessThan(south.brightness);
    // A low winter sun is gold; a high summer one nearly white.
    expect(north.sunColour[2]).toBeLessThan(south.sunColour[2]);
  });

  it("hands the key to the moon at night", () => {
    const night = skyLookFor(bodiesFor("night", 0, MADRID));
    expect(night.moonShare).toBeGreaterThan(0.5);
    expect(night.keyColour[2]).toBeGreaterThan(night.keyColour[0]);
    expect(night.stars).toBeGreaterThan(0);
    const day = skyLookFor(bodiesFor("day", 0, MADRID));
    expect(day.stars).toBe(0);
    expect(day.keyIntensity).toBeGreaterThan(night.keyIntensity * 4);
  });

  it("has every fixed sky in order", () => {
    for (const choice of SKY_CHOICES) {
      const look = skyLookFor(bodiesFor(choice, Date.UTC(2025, 0, 1), MADRID));
      for (const c of [...look.zenith, ...look.horizon, look.keyIntensity]) {
        expect(Number.isFinite(c)).toBe(true);
        expect(c).toBeGreaterThanOrEqual(0);
      }
    }
  });
});

describe("the place", () => {
  it("is the city a time zone is named for, old names included", () => {
    expect(placeOfZone("Europe/Stockholm", 60)).toEqual({
      lat: 59.3,
      lon: 18.1,
    });
    expect(placeOfZone("Asia/Calcutta", 330).lat).toBeCloseTo(22.5, 1);
  });

  it("falls back to the offset's longitude for a zone it does not know", () => {
    expect(placeOfZone("Nowhere/Special", 120).lon).toBe(30);
    expect(placeOfZone(undefined, -300).lon).toBe(-75);
  });
});
