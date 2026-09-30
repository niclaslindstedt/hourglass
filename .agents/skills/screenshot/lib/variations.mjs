// What varies besides the window: the theme, and the settings the app
// offers — which hourglass, which sky. Both reach the app the way a person's
// choices do — through the settings key it keeps in localStorage
// (`src/app/useAppSettings.ts`), seeded before the page loads — and so does
// the run, the one other thing the app keeps (`src/app/useRun.ts`). Nothing
// else is injected.

export const SETTINGS_KEY = "hourglass:settings";
export const RUN_KEY = "hourglass:run";

/** The theme choice (Settings → Appearance), and for "Device" which way the
 *  device leans. The glass fills the screen with its sky either way; the
 *  theme is Settings' and the cog's. */
export const THEMES = {
  dark: { label: "Dark", settings: { theme: "dark" }, colorScheme: "dark" },
  light: { label: "Light", settings: { theme: "light" }, colorScheme: "light" },
  "system-light": {
    label: "Device (light)",
    settings: { theme: "system" },
    colorScheme: "light",
  },
  "system-dark": {
    label: "Device (dark)",
    settings: { theme: "system" },
    colorScheme: "dark",
  },
};

export const THEME_SETS = {
  default: ["dark"],
  both: ["dark", "light"],
  all: Object.keys(THEMES),
};

/** The ten presets (`src/app/look.ts`), each on a fixed afternoon sky so
 *  the glass is what differs between them. */
const PRESETS = [
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

/** Settings presets, each a patch over the defaults — the knobs a frame can
 *  look different under. Add one here when a feature adds a setting. */
export const VARIANTS = {
  default: { label: "Defaults (sky now)", settings: { sky: "day" } },
  ...Object.fromEntries(
    PRESETS.map((id) => [
      id,
      { label: `Preset ${id}`, settings: { preset: id, sky: "day" } },
    ]),
  ),
  "sky-now": { label: "Sky: now", settings: { sky: "now" } },
  "sky-day": { label: "Sky: day", settings: { sky: "day" } },
  "sky-dusk": { label: "Sky: dusk", settings: { sky: "dusk" } },
  "sky-night": { label: "Sky: night", settings: { sky: "night" } },
  "one-minute": { label: "1 minute", settings: { minutes: 1, sky: "day" } },
  "two-hours": { label: "2 hours", settings: { minutes: 120, sky: "day" } },
  dev: { label: "Developer mode", settings: { devMode: true, sky: "day" } },
};

export const VARIANT_SETS = {
  default: ["default"],
  presets: PRESETS,
  skies: ["sky-day", "sky-dusk", "sky-night", "sky-now"],
  sizes: ["one-minute", "default", "two-hours"],
  all: Object.keys(VARIANTS),
};

/** The init script that seeds a settings patch. It runs before any app
 *  module and again on every reload, merging its patch over whatever the key
 *  holds — so a later script (a screen's own `setting()`) wins, and a reload
 *  keeps it. */
export function seedSettings(patch) {
  return {
    script: (arg) => {
      const current = JSON.parse(localStorage.getItem(arg.key) ?? "{}");
      localStorage.setItem(
        arg.key,
        JSON.stringify({ ...current, ...arg.patch }),
      );
    },
    arg: { key: SETTINGS_KEY, patch },
  };
}

/** The init script that seeds a run: `full` (turned, not started),
 *  `running` (`at` of the way through), or `done`. The length is the
 *  settings' own. */
export function seedRun(state, at = 0.42) {
  return {
    script: (arg) => {
      const settings = JSON.parse(
        localStorage.getItem(arg.settingsKey) ?? "{}",
      );
      const minutes = settings.minutes ?? arg.defaultMinutes;
      const now = Date.now();
      const run =
        arg.state === "full"
          ? { minutes, fraction: 0, startedAt: null }
          : arg.state === "done"
            ? { minutes, fraction: 1, startedAt: null }
            : {
                minutes,
                fraction: 0,
                startedAt: now - arg.at * minutes * 60000,
              };
      localStorage.setItem(arg.key, JSON.stringify(run));
    },
    arg: {
      key: RUN_KEY,
      settingsKey: SETTINGS_KEY,
      state,
      at,
      defaultMinutes: 5,
    },
  };
}
