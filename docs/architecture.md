# Architecture

A frontend-only PWA. No server, no API, no build-time data source. Everything
below runs in the browser tab.

```
index.html
  └── src/main.tsx            mounts <App> inside the i18n LanguageRoot
       └── src/App.tsx        theme, settings, the run, the sensor, the wake lock, the cog
            ├── Hourglass         the glass — the whole screen, every gesture on it, and the phone's readings
            ├── TopBar            the bar the phone's Settings screen sits under (never over the glass)
            ├── SettingsScreen    settings, developer tools, about — a screen on the phone
            └── SidePanel         the same on the desk, over the right-hand edge

src/app/
  look.ts           the vocabulary: tops, glasses, sands, the ten presets; the two themes
  glass.ts          a glass's profile as a curve, and a bulb's shape read both ways        (pure)
  sand.ts           a bulb's sand as cells: fill, drain, pour, relax, settle; a lean, a shake (pure, clock-free)
  timer.ts          how long a glass runs, how big it is, and where a run stands           (pure, clock-free)
  scene.ts          the camera, the light, and a heap's surface as lit facets              (pure)
  frame.ts          what one painted frame is made of
  sprites.ts        the modelled parts (public/models/, made by `make blender`), loaded once each
  paint.ts          the picture, back to front: the table, the plates, the posts, the order
  paintGlass.ts     the glass: its outline, its back wall, its front wall and the light on it
  paintSand.ts      the sand: the facets, the grain, the clinging grains, the stream
  Hourglass.tsx     the glass on the screen: the loop, the turn, the drag, the phone's turn, lean and shake
  HourglassPicker.tsx  the preset cards and the Custom chips in Settings
  useMotion.ts      the phone's readings: which way is down, how it leans, how hard it is shaken
  useRun.ts         the run, persisted per device
  useAppSettings.ts the settings blob, clamped on read
  shape.ts          phone or desk — the one edge the shell is cut at
  useShape.ts       the same, live: useDesk
  appName.ts        the name the app shows: the listing's in an app build, Hourglass on the website
  dev/              the demo run (VITE_SEED=demo): a glass part way through a half hour
  i18n/             the catalog and the runtime

native/             the thin Expo wrapper — a separate npm project (see below)
  App.tsx           a WebView over the bundled build, and nothing else
  src/local-server.ts   unpacks the packed build and serves it on a fixed loopback port
  src/injected.ts   the theme reporter, and the service-worker teardown

public/models/      the frames and the glasses modelled in Blender off look.ts (scripts/blender/), with their manifest

tauri/              the thin desktop shell — a Rust project (see below)
  shell/            every decision: the origin, the window, what a request resolves to
  src-tauri/        every effect: the process, the window, the private scheme
```

## The framework's share

[`@niclaslindstedt/oss-framework`](https://github.com/niclaslindstedt/oss-framework)
supplies the UI kit (the settings layout and its sections, toggles and
choices, the toast viewport, the update toast), the theme engine, the
local-storage state hook, the i18n runtime, the log store and viewer, and the
PWA update state machine. The app imports only published subpaths.

The renderer is **Preact** through `preact/compat`: the framework is built
against React, and `@preact/preset-vite` plus `tsconfig.json`'s `paths` alias
`react` onto Preact for the bundle and the type-checker alike.

## The model

There is no document. The app keeps two small things per device, both in
localStorage and both clamped on read:

```ts
type AppSettings = {
  theme: "light" | "dark" | "system";
  preset: LookPreset | "custom"; // which of the ten, or the custom one below
  custom: Look; // { top, glass, sand } — ids from look.ts
  minutes: number; // one of DURATIONS; also the glass's size
  vibrate: boolean;
  awake: boolean;
  sensor: boolean;
  devMode: boolean;
  captureLogs: boolean;
};

type Run = {
  minutes: number;
  fraction: number; // the share of the sand in the lower bulb at startedAt: 1 is run out
  startedAt: number | null; // ms since the epoch when last turned; null standing still
};
```

Everything else is derived, every frame: `passed(run, now)` says how much of
the sand is through, and the two heaps in `sand.ts` say where it lies. Nothing
about a heap is stored — a glass that is reopened rebuilds both heaps for the
run as the clock has it and settles them (`Hourglass.tsx`'s `build`). See
[`design.md`](design.md) for the sand and the picture.

## The render loop

`Hourglass.tsx` owns one `requestAnimationFrame` loop. Each frame it reads the
clock, drains from the upper bulb exactly the volume the clock says has gone
since the last frame, pours it into the lower, relaxes both heaps a few
sweeps toward their angle of repose, and paints. A large jump — the tab coming
back, a turn — settles the heaps in one go rather than animating what nobody
saw. The loop sleeps when nothing moves: a glass standing still is painted
once.

React never writes a pixel: the canvas is painted from the loop, and the
component re-renders only when the look, the run or gravity changes.

## The service worker

`pwa-plugin.ts` emits `sw.js`, `version.json`, `precache-manifest.json` and
the web manifest at build time — a "prompt to update" worker that precaches
the build, parks in `waiting`, and applies on the framework's `UpdateToast`.
Per deploy base (`/`, `/preview/`) the cache id (`src/app/pwa.ts`) and the
manifest identity differ, so the channels install as separate apps.

Only the website has one. The desktop and phone builds are shell builds
(`VITE_SHELL_BUILD=on`): the site ships inside the binary, so they emit no
worker and show no update prompt, and both bundle scripts refuse a webroot
that holds `sw.js`.

## The native wrapper's share

`native/` ships the same web app to the App Store and Google Play. It is a
**separate npm project** — its own `package.json`, lockfile and
`node_modules`, reached with `--prefix native` — and it is thin on purpose: a
loopback HTTP server serving the packed web build, a `WebView` over it, and a
theme reporter so the status bar follows the page. Nothing in `src/` knows it
exists. The phone's sensor reaches the page through the ordinary
`deviceorientation` event, not through the wrapper. See
[`features/native-app.md`](features/native-app.md) and
[`../native/README.md`](../native/README.md).

## The desktop shell's share

`tauri/` is the same site in a window, served from the private `hourglass://`
scheme, with no capability beyond the window. See
[`features/desktop-app.md`](features/desktop-app.md) and
[`../tauri/README.md`](../tauri/README.md).
