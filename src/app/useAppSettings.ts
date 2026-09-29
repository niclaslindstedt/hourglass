// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { useCallback } from "react";

import { useLocalStorageState } from "@niclaslindstedt/oss-framework/hooks";

import {
  DEFAULT_LOOK_PRESET,
  LOOK_PRESET,
  clampLook,
  oneOf,
  type Look,
  type LookPreset,
} from "./look.ts";
import { DEFAULT_MINUTES, clampMinutes } from "./timer.ts";

// The app's settings: which of the two themes is on, which hourglass is on
// the screen, how long it runs, and what happens when it runs out. Per
// device, in localStorage — there is no document here, and nothing to sync:
// an hourglass is a thing you own rather than a record you keep.

/** The theme choice. Deliberately three values and no more — one light,
 *  one dark, and "follow the device". */
export type ThemeChoice = "light" | "dark" | "system";

export type AppSettings = {
  theme: ThemeChoice;
  /** Which hourglass is on screen: one of the presets, or the custom one
   *  below, piece by piece. Both are kept, so going back to a preset and
   *  then to Custom again finds the custom glass as it was left. */
  preset: LookPreset | "custom";
  custom: Look;
  /** How long the glass runs, in minutes. Also how big it is. */
  minutes: number;
  /** A buzz when the sand has run out, where the device can. */
  vibrate: boolean;
  /** Keep the screen from sleeping while the sand runs. */
  awake: boolean;
  /** Turn the glass over by turning the phone over: the sensor decides
   *  which way is down. On iOS the first press on the glass asks for it. */
  sensor: boolean;
  /** Surface the developer affordances in Settings. */
  devMode: boolean;
  /** Mirror console output into the in-app log buffer. */
  captureLogs: boolean;
};

export const DEFAULT_SETTINGS: AppSettings = {
  theme: "system",
  preset: DEFAULT_LOOK_PRESET,
  custom: LOOK_PRESET[DEFAULT_LOOK_PRESET],
  minutes: DEFAULT_MINUTES,
  vibrate: true,
  awake: true,
  sensor: true,
  devMode: false,
  captureLogs: false,
};

export const STORAGE_KEY = "hourglass:settings";

/** Stored bytes → settings, every field clamped. Exported for the tests;
 *  the app reads it through `useAppSettings`. */
export function parseSettings(raw: string): AppSettings {
  const parsed = JSON.parse(raw) as unknown;
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return DEFAULT_SETTINGS;
  }
  const merged = { ...DEFAULT_SETTINGS, ...(parsed as object) } as Record<
    keyof AppSettings,
    unknown
  >;
  return {
    theme:
      merged.theme === "light" || merged.theme === "dark"
        ? merged.theme
        : "system",
    preset:
      merged.preset === "custom"
        ? "custom"
        : oneOf(LOOK_PRESET, merged.preset, DEFAULT_LOOK_PRESET),
    custom: clampLook(merged.custom),
    minutes: clampMinutes(merged.minutes),
    vibrate: merged.vibrate !== false,
    awake: merged.awake !== false,
    sensor: merged.sensor !== false,
    devMode: merged.devMode === true,
    captureLogs: merged.captureLogs === true,
  };
}

export function useAppSettings() {
  const [settings, setSettings] = useLocalStorageState<AppSettings>(
    STORAGE_KEY,
    DEFAULT_SETTINGS,
    { parse: parseSettings },
  );
  const update = useCallback(
    <K extends keyof AppSettings>(key: K, value: AppSettings[K]) =>
      setSettings((prev) => ({ ...prev, [key]: value })),
    [setSettings],
  );
  return { settings, update, setSettings };
}
