// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, expect, it } from "vitest";

import { LOOK_PRESET } from "../src/app/look.ts";
import { DEFAULT_SETTINGS, parseSettings } from "../src/app/useAppSettings.ts";

// Every stored choice is clamped on the way in, so a build that has lost a
// top, a glass or a length still boots on what it has.

describe("stored settings", () => {
  it("come back as they went in", () => {
    const stored = {
      ...DEFAULT_SETTINGS,
      theme: "dark",
      preset: "custom",
      custom: { top: "brass", glass: "cone", sand: "gold" },
      minutes: 45,
      vibrate: false,
      awake: false,
      sensor: false,
      devMode: true,
      captureLogs: true,
    };
    expect(parseSettings(JSON.stringify(stored))).toEqual(stored);
  });

  it("fall back field by field", () => {
    const parsed = parseSettings(
      JSON.stringify({
        theme: "sepia",
        preset: "boudoir",
        custom: { top: "marble", glass: "cone" },
        minutes: 17,
        vibrate: "yes",
      }),
    );
    expect(parsed.theme).toBe("system");
    expect(parsed.preset).toBe("study");
    expect(parsed.custom).toEqual({ ...LOOK_PRESET.study, glass: "cone" });
    expect(parsed.minutes).toBe(15);
    expect(parsed.vibrate).toBe(true);
    expect(parsed.awake).toBe(true);
    expect(parsed.sensor).toBe(true);
  });

  it("are the defaults for anything that is not an object", () => {
    expect(parseSettings("null")).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings("[1]")).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings('"x"')).toEqual(DEFAULT_SETTINGS);
  });
});
