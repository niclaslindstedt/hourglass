# Agent guidance for hourglass

This file is the canonical source of truth for AI coding agents working in this
repo. `CLAUDE.md`, `.cursorrules`, `.windsurfrules`, `GEMINI.md`, and
`.github/copilot-instructions.md` are symlinks to this file.

Fleet guidelines: APP_GUIDELINES 1.2.0

## What this app is, and the one rule that follows from it

An hourglass: a glass of sand on the screen, turned over with a tap, sized to
the minutes it runs. There is no document — nothing is kept but the settings
and where the sand stood when the glass was last turned — and nothing about
the app needs a network.

**So: never add a network call.** No analytics, no error reporting service, no
font CDN, no "anonymous" telemetry, no third-party script — not behind a flag,
not in dev only. The app promises that it sends nothing anywhere, and the
sensor readings that turn the glass are used for the next frame and nothing
else (`src/app/useMotion.ts`). The sky behind the glass stands where the
device's time zone says (`placeOfZone`, off the table in `src/app/zones.ts`),
never where a location lookup or a network call would put it. A change that
would send a byte, or store a reading, is the wrong change however useful the
feature is.

Several parts of the fleet guidelines are about a document and where it is
kept — storage backends, cloud sync, backup and restore, the phone app's
iCloud store, the desktop shell's sign-in listener, the export share sheet
and the pairing-code scanner. **This app has none of them, deliberately**: an
hourglass is a thing you own rather than a record you keep, and a timer that
synced would be a stranger timer than one that did not. Where a guideline
names one of those, the deviation is this paragraph.

## Build and test commands

```sh
make install       # npm install (needs GitHub Packages auth — see below)
make build         # production build (vite build)
make demo          # dev server on the in-memory demo run (VITE_SEED=demo)
make test          # full test suite (vitest)
make lint          # eslint + tsc --noEmit
make fmt           # prettier --write
make fmt-check     # verify formatting (CI)
make icons         # regenerate the PWA icons, favicon, and og image
make shots         # the screenshot skill: contact sheets of devices × themes × variants × screens (ARGS="…" for shoot.mjs's options)
make shots-warm    # the first shots run's slow parts ahead of time: a playwright-core + Chromium, the build
make blender       # model every frame and glass in Blender off look.ts into public/models/ (needs bpy or Blender; ARGS="…")

make native-install    # install the native wrapper's own dependencies
make native-bundle     # build the web app into native/assets/webroot.zip
make native-typecheck  # tsc over native/
make native-prebuild   # regenerate native/ios + native/android from the config
```

The desktop shell in `tauri/` is a Rust project with its own toolchain; `make
test` and `make lint` stop at its edge:

```sh
make tauri                # bundle the site into the shell and run the desktop app
make tauri-test           # its decision layer (cargo test -p hourglass-shell — no GUI libs)
make tauri-lint           # clippy at zero warnings, both crates
make tauri-fmt            # rustfmt in place (tauri-fmt-check verifies)
make tauri-package        # this machine's installers
make tauri-package-debug  # …debug profile: minutes faster, much bigger
```

It is a **thin** wrapper: a window and the built site served from a private
`hourglass://` scheme, and nothing else — no loopback listener, because there
is no sign-in for one to finish. **The page is never told it is inside it** —
no injected global, no Tauri command. `tauri/shell/` holds every decision and
needs no GUI toolkit; `tauri/src-tauri/` holds every effect. One seam reaches
back into this tree, `VITE_SHELL_BUILD`, set by the shell's site build — and
by the phone wrapper's, which is the same shape of thing — which switches off
the service-worker half of `appPwa` and — through `__SHELL_BUILD__` — the
in-app update prompt. A desktop or phone build updates by being replaced, and
both bundle scripts refuse a webroot holding `sw.js`. The desktop build, and
the phone wrapper's store edition (`VITE_EDITION=store`), are builds that are
not the website: they carry no link back to the source (by owner decision) —
no Open Graph tags naming the web edition, no `CNAME` and no `og.png`
(`websiteOnly` in `vite.config.ts`) — and both bundle scripts refuse a webroot
that still contains `niclaslindstedt`. The package's name and identifier come
from `APP_DISPLAY_NAME` and `APP_BUNDLE_ID` at packaging time
(`tauri/scripts/package.mjs`), like the phone app's. See
[`tauri/README.md`](tauri/README.md).

The `@niclaslindstedt/oss-framework` dependency comes from the **GitHub
Packages** npm registry (see `.npmrc`). GitHub Packages requires auth even for
public packages, so local installs need a `read:packages` token in `~/.npmrc`
(`//npm.pkg.github.com/:_authToken=<token>`); CI authenticates with the
workflow's `GITHUB_TOKEN`.

### Dependency install in web sessions

Claude Code on the web runs `.claude/hooks/session-start.sh` on `SessionStart`
(wired up in `.claude/settings.json`), so **dependencies install automatically
in the background** — an agent shouldn't run `make install` by hand first. The
hook resolves a GitHub Packages token from the environment
(`NODE_AUTH_TOKEN` / `GITHUB_PAT` / `GH_TOKEN` / `GITHUB_TOKEN`, first wins),
writes it to `~/.npmrc`, and runs `npm install` — the committed project
`.npmrc` stays token-free. It runs in **async** mode, so `node_modules` may
still be populating for a moment after the session opens; if a `make` target
fails on a missing dependency, wait and retry. The hook is a no-op outside the
web environment (`CLAUDE_CODE_REMOTE`), so it never touches a local developer's
npm config.

## Commit and PR conventions

- All commits follow [Conventional Commits](https://www.conventionalcommits.org/).
- PRs are squash-merged; the **PR title** becomes the single commit on `main`,
  so it must follow conventional-commit format.
- Breaking changes use `<type>!:` or a `BREAKING CHANGE:` footer.

### Watching a PR after you open it

Don't babysit a PR with polling. **Do not** schedule `send_later`, cron jobs,
`ScheduleWakeup`, or timed self-check-ins to re-check CI or merge state — those
just burn turns. Open the PR, confirm the checks you can see are green, then
stop. CI failures and review comments are delivered to the session as webhook
events, so you'll be woken when there's actually something to act on.

## Architecture summary

This is a **frontend-only, local-first PWA** — there is no server. It is built
on [`oss-framework`](https://github.com/niclaslindstedt/oss-framework), the
same shared surface behind the sibling `time`, `contacts` and `period` apps.

The framework owns the UI kit and the generic mechanics: the settings layout
and its controls, the theme engine, the local-storage state hook, the i18n
runtime, logging, and the PWA update state machine. What
stays here is the hourglass: what a glass is made of, how sand rests and
runs, how the picture is painted, and what a press and a turn mean.

### The renderer is Preact

`preact` is the only UI renderer dependency — **never add `react` or
`react-dom` back.** (The glass itself is drawn by three.js on a canvas of its
own; see below.) `@preact/preset-vite` compiles JSX against
`preact/jsx-runtime` and aliases `react` / `react-dom` (and their `/jsx-runtime` + `/client` subpaths)
onto `preact/compat`; `tsconfig.json` `paths` and `package.json` `overrides`
mirror that for `tsc` and npm, so the framework — which is built against React
— resolves to Preact too. App code keeps importing hooks and types from
`"react"`, which is the supported compat path; only `src/main.tsx` uses
Preact's own `render`. Two differences bite in new code: use `e.currentTarget`
rather than `e.target` in event handlers, and spell string-valued attributes
like SVG's `focusable` as `"false"` rather than a JSX boolean.

### The app owns the hourglass

- `src/app/look.ts` — the vocabulary: eight **tops** (the frame a glass
  stands in: walnut, oak, pine, ebony, brass, copper, steel, or none — each a
  plate shape, a thickness, a finish, a number and style of posts, a finial),
  six **glasses** (teardrop, sphere, cone, slim, antique, bell — each a
  profile as points the geometry interpolates, a tint, a wall thickness, a
  foot), eight **sands** (quartz, white, black, red, blue, gold, rose, green —
  each a colour, an angle of repose, a grain size and whether it sparkles),
  and the ten **presets** they combine into. Every option is an id and a
  spec, so the settings can validate, the picker can offer, and the tests can
  walk them; `resolveLook` reads a preset or the custom look and `clampLook`
  reads a stored one. Also the app's two themes (`appearanceFor`).
- `src/app/glass.ts` — the geometry: `profileRadius`, a monotone cubic
  through a glass's profile points (Fritsch–Carlson, so the wall never bulges
  past a point it was not given), `bulbShape` — one bulb's radius along its
  height, and the same curve read the other way round (`taper`, `dome`),
  which is what the sand needs to know where it can rest — and `layoutOf`,
  which sizes the frame to clear the glass: the posts stand
  `POST_CLEARANCE` outside the bulb at its widest, whatever the top's own
  reach says. Everything is in one unit, the whole hourglass's height. Pure.
- `src/app/sand.ts` — the sand, as a **heightfield of cells** per bulb:
  rings from the axis out, each cut into spokes, each cell a height above
  the end the sand rests against (the plate in the lower bulb, the waist in
  the upper), volume-exact, with `relax` walking a slope steeper than the
  sand's angle of repose back down to it — read against gravity, which
  `setTilt` may lean across the bulb, so a tilted glass settles to a
  surface that leans with it — and `settle` running that to rest. `drain`
  takes sand from the axis of the upper bulb and `pour` lands it where the
  stream reaches the lower (on the axis, or at the end of its run down the
  glass when it leans — `streamPath` in `physics.ts`), which is
  why the upper surface is a funnel and the lower a cone; `jolt` is a
  shake, grains thrown cell to cell, and `give` how much flatter a shaken
  heap holds; `levelFill`, `pileFill` and `funnelFill` put a volume in at
  rest. Pure and clock-free — it knows nothing about time, only about
  volume, and nothing of chance: a shake's throws are a hash of a seed.
- `src/app/timer.ts` — the run: how long the glass runs (`DURATIONS`, the
  lengths on offer, and `clampMinutes` / `stepMinutes` over them), how big it
  is for that (`sizeFor`, on a log scale, because a minute is a lot at the
  short end and nothing at the long), and where a run stands — `Run` is the
  share of the sand already through when the glass was last turned and
  when that was, so `passed(run, now)` is a function of the wall clock and
  never a count of frames. `turn` and `halt` are the two edits. Pure and
  clock-free; `now` is a parameter.
- `src/app/physics.ts` — the sand **in motion**, in two layers (after the
  "shallow sand" height-field models and Savage–Hutter's depth-averaged
  avalanche equations). The dense layer is the heap's cells plus a flowing
  layer (`LAYER`, about fifteen grains deep) with a speed on every edge
  between cells: gravity along the slope drives it and Pouliquen and
  Forterre's measured friction law holds it (`muStart`, `muStop`,
  `muFlow`: start and stop angles about a degree apart, both steeper for a
  thin layer, friction rising with the Froude number), with the sand's
  angle of repose as the law's δ1; a shaken heap's friction drops (`give`).
  `streamPath` traces the stream: out of the bore at √(g·D), a projectile
  through the air, and on meeting the glass a rivulet down the inside of
  the wall under Coulomb wall friction (`WALL_FRICTION`) to the heap, where
  `pour` lands the sand. The dilute layer is grains in the
  air (`Bulb.air`, up to `AIR_CAP`), ballistic under the gravity the glass
  feels (`setGravity`: the Earth's less the phone's own acceleration),
  bouncing off the wall and landing volume-exactly; `toss` throws them up
  when the glass is jerked toward its resting end, `turnOver` turns each
  heap into grains that fall to the other end (mirrored for a tap, not for
  the phone). Hits on the glass count into `bulb.hits`, and `buzzFor` makes
  a vibration of them. `GLASS_METRES` sets gravity's scale. Pure and
  clock-free: `dt` is a parameter; the clock is not in here.
- `src/app/view.ts` — how the glass hangs in the phone: a spring-damper
  **lag** kicked by the phone's change of spin (a few degrees, swings back
  past centre and settles) and the finger's **orbit** about the glass's own
  axis (spins on, eases back to face the viewer); `follow` eases what the
  glass feels of the phone (gravity, the push, the spin, its stance in the
  world as a quaternion) toward each reading, so the sensor's tremor never
  reaches the picture; `intoGlass` takes gravity into the glass's frame;
  `swing` is a desk's shake. Pure and clock-free.
- `src/app/astronomy.ts` — the sun's and the moon's positions and the
  moon's phase (the standard low-precision formulas, as suncalc has them),
  clear-sky illuminance by the sun's altitude and the moon's by altitude and
  phase, `brightness(lux)` (a perceptual `(lux/100000)^0.16`, clamped), and
  `placeOfZone` — the IANA time zone's city from `zones.ts` (generated from
  the tz database's public-domain `zone.tab` plus link names), or lat 40 and
  the UTC offset's longitude. Pure and clock-free.
- `src/app/sky.ts` — the sky as numbers (`skyLookFor`): game4's clear-sky
  colour model (the sun's tint through Kasten–Young air mass, zenith
  deepening, a twilight band, night), the key light passing to the moon at
  night, stars by twilight; `bodiesFor(choice, ms, place)` for **Now** or a
  fixed **Day**, **Dusk** or **Night**; `VIEW_HEADING`. Three-free, pure and
  clock-free.
- `src/app/sandMesh.ts` — a heap as a mesh for the renderer: the surface grid
  (axis vertex, rings × spokes, a wall ring) with a per-vertex `presence` so
  bare glass is dropped, and `rimHeights`, where the heap meets the glass on
  each spoke — which cuts the **skin**, the sand's body seen through the
  side. Pure, tested.
- `src/app/render/stage.ts` — **the picture**, in three.js: the `Stage`
  (a WebGLRenderer with ACES tone mapping, sRGB, PCF soft shadows). The
  scene's axes are the sky's (x east, y up, z south); the camera and the
  glass hang together in a "phone" group turned by the phone's real
  orientation (`deviceToEarth`) and `VIEW_HEADING`, so the phone is a window
  onto the sky and the glass stays in front of the lens. A perspective
  camera, 30°, head on at the waist. The key light is the sun by day and
  the moon by night (it casts the frame's shadows on the sand), a
  hemisphere light is the sky's, a faint fill is the screen's glow, a point
  light is the done-glow; the environment is the sky dome through PMREM, so
  the glass and the metal reflect the real sky (`MIRROR_SUN` keeps a glint).
  The sand's bump is `public/models/grain.png`.
- `src/app/render/skyDome.ts` — the dome's shader, after game4's
  `sky-dome.ts` / `haze.ts`: gradient and aureole, a drifting fair-weather
  cloud layer projected onto a plane, stars sized in pixels, a faint Milky
  Way, the sun's disc and the moon's lit by its phase; tone-mapped like
  every surface.
- `src/app/render/parts.ts` — the frame and the glass as lathes and boxes off
  `look.ts` / `glass.ts` (round turned or rounded square plates, rod,
  baluster and band posts, acorn and ball finials, the inlay ring) with
  their materials — wood, metal, lacquer, and glass as a transmissive
  physical material with the spec's tint. A bare glass's plates are glass.
- `src/app/render/textures.ts` — the wood's grain and the sand's speckle,
  drawn from a deterministic hash, and the grains' dot. Nothing fetched.
- `src/app/scene.ts` — **the flat painter's** camera and light: an
  orthographic view with a slight pitch and yaw, `project` and `ellipseOf`
  for a point and a ring in it, `LIGHT`, `rimEdge` (also read by
  `sandMesh.ts`), and `surfaceFacets`, a bulb's cells as lit quads. Pure.
- `src/app/frame.ts` — what one flat-painted frame is made of.
- `src/app/paint.ts`, `paintGlass.ts`, `paintSand.ts` — **the flat
  picture**: the preset cards in Settings (`MiniGlass`) and the fallback
  where WebGL cannot start or is lost. Back to front: the shadow on the
  table, the bottom plate, the posts behind the glass, the glass's back
  wall, the sand (facets under a grain pattern one speck to a device
  pixel), the stream, the glass's front wall (`glassLight`), the posts in
  front, the top plate and its finials — with the modelled sprites where
  they have loaded, and the painter's own drawing as the fallback on every
  branch. Paint only, no vocabulary.
- `src/app/sprites.ts` — the modelled parts for the flat painter: sprites
  Blender rendered off the app's own data (`scripts/blender.mjs`, the
  `blender-assets` skill) under `public/models/`, with a manifest.
  `useSprites(look, enabled)` loads them only when the flat painter is in
  use; null until loaded, null for good on a build that ships no models.
  From this origin, precached by the worker, bundled into the apps.
- `src/app/Hourglass.tsx` — the glass on the screen, and everything a
  press means. Builds the two heaps for the run as the clock has it
  (`build`), and runs the `requestAnimationFrame` loop: reads the phone,
  steps the view, hands the heaps their gravity, drains and pours what the
  clock says, steps the physics, buzzes for the hits (at most every 70 ms,
  after a user activation, where `navigator.vibrate` exists and **Feel the
  sand** is on), works out the sky every few seconds, and draws on the
  `Stage` — or with the flat painter where WebGL cannot start. A tap turns
  the glass over — the picture half-turns over `TURN_MS` (720 ms) with the
  heaps held rigid, then they drop and land (`land`, `turnOver`); a drag up
  or down is a longer or a shorter glass, one length per `DRAG_STEP_PX`; a
  drag sideways is the orbit (and, on a desk, its jerk is the shake); the
  wheel and the arrow keys do the same. A turn of the phone turns the
  **run** without turning the picture; a lean past `STOP_LEAN` to a side
  halts it until the glass is stood up (`halt` / `resume`).
- `src/app/useMotion.ts` — the phone's readings: the full gravity vector in
  the phone's frame (`deviceDown`: x right, y up the screen, z out of it),
  which way up the glass is — flipped only past a wide hysteresis — the
  lean `{x, z}` (`leanOf`, to a side and back or forward, capped as a whole
  at 70°) and `leanStops` on x alone (past 60°, on its side); the
  acceleration with gravity taken out (for throwing sand, `shakeOf`), the
  rotation rate (for the view's lag), and the orientation angles
  (`deviceToEarth`, for turning the sky). A phone laid flat leans its sand
  the full way to the back and keeps running. On iOS, `requestMotion` makes
  both permission requests synchronously and awaits them together, called
  from the glass's `click` (Safari grants only at a tap's end, and only the
  first request in it) and from the Settings toggle; the listeners attach
  whenever the setting is on. **The readings never leave the frame they
  decide** — nothing is stored, nothing is sent — and they live in a ref
  rather than in state.
- `src/app/useRun.ts` — the run, persisted per device (`hourglass:run`) so
  the sand is where it was when the tab comes back; a new glass when the
  length changes.
- `src/app/useAppSettings.ts` — the settings: theme, which preset or the
  custom look, the length, the buzz, keeping the screen on, the sensor,
  `haptics` ("Feel the sand"), `sky` (`now` / `day` / `dusk` / `night`), and
  the developer switches. Per device, clamped on read.
- `src/app/HourglassPicker.tsx` — Settings' picker: the ten preset cards,
  each a still `MiniGlass` of its own, and under Custom the chips for the
  frame, the glass and the sand.
- `src/app/SettingsScreen.tsx`, `SidePanel.tsx`, `TopBar.tsx` — Settings, a
  screen on the phone and a panel over the right-hand edge on the desk, with
  the top bar the phone's Settings screen sits under. The hourglass screen
  itself has no bar: the cog floats in its corner.
- `src/app/UpdateGlyph.tsx`, `UpdateCheck.tsx` — a new version: the
  framework's `usePwaUpdate` looks for one by itself, and when one has landed
  a glyph floats beside the cog (turning corners with it) that reloads onto
  it; About in Settings checks now. The website only — a shell build updates
  by being replaced — and never a banner over the glass.
- `src/app/upright.ts` — the page never turns with the screen: on a
  touch screen whose browser rotated it, `#root` is turned back
  (`data-turned` on `<html>`, `styles.css`, with the safe-area insets turned
  as `--safe-*`) and a drag read in the page's frame (`uprightDelta`); the
  apps lock their windows to portrait, the right way up. Tested in
  `tests/upright_test.ts`.
- `src/app/shape.ts` / `useShape.ts` — phone or desk, the one thing the
  shell asks about a window; `useDesk` decides between the screen and the
  panel.
- `src/app/appName.ts` — the name the app shows: the listing's
  (`APP_DISPLAY_NAME`, handed in as `__APP_NAME__`) in an app build,
  `Hourglass` on the website.
- `src/app/dev/demo.ts` — the developer "Demo" seed (`VITE_SEED=demo`): a
  glass part way through a half-hour run, held in memory and never written
  to the browser. Behind `import()`, so a production user never downloads it.
- `src/app/i18n/en.ts` — every user-facing string.
- `src/output.ts` — the central output module (semantic log helpers over the
  in-app log store); no bare `console.*` outside it and the log store.
- `pwa-plugin.ts` — emits the service worker + version/precache manifests the
  framework's `usePwaUpdate` consumes.

Dependency direction: screens → hooks → the pure modules → framework. Nothing
imports from the framework's internals — only its published subpaths.

### The sand is volume, and the time is the clock

An hourglass has no clock in it — it has an amount of sand and a hole. So the
app keeps two things apart on purpose:

- **Where the run stands is read off the wall clock.** `passed(run, now)` is
  the share of the sand through at `now`, from when the glass was last turned.
  A tab that slept for ten minutes shows a glass ten minutes further on the
  first frame back, because the fraction is a function of `now` and never a
  count of frames. Do not advance the run in the animation loop.
- **Where the sand _lies_ is the heightfield.** Each frame drains from the
  upper bulb exactly the volume the clock says has gone (counting the sand in
  the air), pours it into the lower, and steps both heaps' physics
  (`physics.ts`: the flowing layer and the grains in the air) — which decides
  only where the sand lies, never how much has run. Volume is conserved to
  the last ring; a heap is never redrawn from a fraction. A big jump (the tab
  coming back) settles the heaps in one go.

A change that made the picture tell a different time from the clock — a
frame-counted drain, a pile drawn from a percentage — is the one failure this
split exists to make impossible.

### Keep the derivation clock-free

`timer.ts`, `sand.ts`, `physics.ts`, `sandMesh.ts`, `glass.ts`, `scene.ts`,
`view.ts`, `sky.ts`, `astronomy.ts` and `look.ts` never call `new Date()` or
`performance.now()`; `physics.ts` and `view.ts` take `dt`, `sky.ts` and
`astronomy.ts` take the moment. `now` is a parameter, supplied by
`Hourglass.tsx`'s loop. Keep it that way: it is what lets the tests pin real
moments without fake timers.

### Turning the glass over, two ways

A **tap** turns the picture: the frame rotates half a turn over `TURN_MS`
with the heaps held as they are, and the run turns with it, so the bulb that
was full is now on top and running. The **phone** turning over turns the run
only: the source is now the lower bulb on the screen and the stream runs up
it, and nothing on the screen rotates — it is the phone that moved. The sky
stays level with the world, so it is the right way up to the person holding
it, and the Settings cog fades out of its corner and back in at the opposite
one (bottom-left in screen terms, turned 180° so it reads the right way up —
`App.tsx`, `.app-cog-upside` in `styles.css`); the length label moves and
turns the same way. Either way the sand falls as grains to the other end and
lands (`turnOver` in `physics.ts` — mirrored left for right for a tap,
because the picture turned; not for the phone, the same glass in the same
place). Both go through `turn` in `timer.ts` and `land` in `Hourglass.tsx`;
do not add a third path.

### The phone is the glass

Held at a slant — to a side, or leaned back or forward — the heaps lean into
it toward that side, or the back or the front wall, and the stream bends
into the slant, meets the glass and runs down it to the heap (`setGravity`
and `streamPath` in `physics.ts`, and `pour` where it lands); held on
its side, the hole is not fed and the run halts (`STOP_LEAN` on the lean's
x, `halt`, `resume`) — a real one stops too. A phone laid flat on a table
leans its sand the full way to the back of the bulb and goes on running: the
run halts only on its side, the one place the physics gives way to the
timer, on purpose. Jerked toward the end the sand rests on, faster than a
fall, the heap is thrown into the air (`toss`), the grains hit the glass and
land, and shaken the heaps slump (`give`); the hits can be felt
(`buzzFor`, **Feel the sand**). The glass hangs in the phone with a little
inertia (`view.ts`): a quick swing leaves it a few degrees behind and it
swings back. And the phone is a window onto the sky: the stage is turned by
the phone's orientation (`deviceToEarth`), so the horizon stays level with
the real one and the sun and the moon stand where they stand outside. None
of it changes what the clock says has run through: a tilt onto its side
pauses the clock, a shake never touches it.

### The modelled parts are a picture, never a source of truth

The sprites under `public/models/` are rendered off `look.ts` and `glass.ts`
by `make blender` for the flat painter (the preset cards and the no-WebGL
fallback) — the 3D stage builds its own parts off the same data
(`render/parts.ts`) and takes only the grain — and the painter draws its own
plate, post, finial and glass light on every branch where one is missing. A number a sprite needs
is a number the driver hands Blender from the app's data, never one typed
in the builder; and the sprites are judged in the app (`make shots`), not in
Blender. See the `blender-assets` skill.

## The native wrapper (`native/`)

`native/` is a **thin** Expo / React Native shell that ships this web app to
the App Store and Google Play. It is a **separate npm project** with its own
`package.json`, its own lockfile and its own `node_modules` — `npm ci` at the
root does not touch it, and neither does `make install`. Reach it with
`--prefix native` (or the `make native-*` targets).

**Thin is a constraint, not an aspiration.** The wrapper does three things:

1. packs the built web app into `assets/webroot.zip` and serves it from a
   loopback HTTP server (`src/local-server.ts`);
2. points a `WebView` at that origin and otherwise gets out of the way;
3. injects one script into the page — `src/injected.ts`, which reports the
   resolved theme colours so the native chrome follows them and unregisters
   the service worker.

That is the whole list. This app has no document, so the wrapper offers no
iCloud store, no authentication session, no share sheet and no scanner — the
fleet's other wrappers do, and the reason is a document this app does not
have. What the wrapper adds, and what carries the App Store's minimum
functionality case (guideline 4.2), is being **self-contained** — the sand
runs with no network at all, ever — and the phone's own sensor turning the
glass, which the page reads through the ordinary browser API rather than
through the wrapper.

- **Nothing in `src/` may learn that the wrapper exists.** No `window.__native`
  feature detection, no native-only branch, no build flag. The wrapper reads
  the shipped app from the outside, the way a second reader would.
- **The wrapper may not reimplement the app.** It moves bytes: a zip out, a
  page up. What the sand does and what a turn means are `sand.ts` and
  `timer.ts`'s, and a Swift copy of either would drift the first week it
  existed.

### What breaks quietly

- **The theme reporter's names are two strings** (`hourglass-native/theme`
  and `__hourglassNativeReporter`, `native/src/injected.ts`); a mismatch
  leaves the status bar the wrong colour with nothing in a log to say why.
  `tests/native_theme_test.ts` pins them.
- **Nothing the root `tsc` can reach may import `expo`** (or any other
  `native/`-only dependency). A root `npm ci` does not install `native/`'s
  dependencies, so such an import passes on a fully-installed machine and
  fails only in CI. A **type-only** import is still an import here.
- **The loopback port is fixed** (`src/local-server.ts`). A web origin is
  scheme + host + port and `localStorage` is keyed by origin, so a random
  port hands the WebView fresh settings on every launch. The ladder falls
  back to another _deterministic_ port, and never to `0`.
- **`localhost`, never `127.0.0.1`.** App Transport Security blocks the literal
  address from `WKWebView` even with exception domains declared; the failure
  mode is a silent blank page on iOS.
- **There is no service worker, and any old one is unregistered.** The phone
  build is a shell build (`VITE_SHELL_BUILD=on`, `native/scripts/web-build.mts`),
  so its webroot carries no `sw.js` — `bundle-web.mjs` refuses one — and
  `src/injected.ts` still unregisters a worker an older build may have left.
- **`native/ios` and `native/android` are prebuild output.** Regenerated from
  `app.config.js` by `expo prebuild --clean`, gitignored, and the source of
  truth for nothing. A fix made there survives until the next build; make it
  in the config instead.
- **`native/tsconfig.json` must not `extend` Expo's base.** `native/` is not
  installed by a root `npm ci`, so `expo/tsconfig.base` is absent in CI. The
  base is inlined instead; re-check it against
  `node_modules/expo/tsconfig.base.json` when expo is upgraded.

Native builds run on **EAS** and are dispatch-only
(`.github/workflows/native.yml`) — every run costs build credits. CI's `native`
job only type-checks and runs `npx expo-doctor`. See `native/README.md` and
`native/RELEASING.md`.

## Where new code goes

| Change                                                                 | Goes in                                                                                                                                                                                                                                                                                                                                                                                    |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| A new top, glass, sand or preset                                       | Run the `add-hourglass-look` skill (`.agents/skills/add-hourglass-look/`): `src/app/look.ts` (id + spec, walked by `tests/look_test.ts`), a string in `en.ts`, a new post style, finial or finish in `render/parts.ts` and `paint.ts`, and the `screenshot` skill to look at it — named for where you would find one, never for a maker                                                    |
| A change to a glass's shape                                            | `src/app/look.ts` (the profile points) + `glass.ts` (the interpolation and the inverses, tested in `tests/glass_test.ts`) — never a second curve in the paint or the stage                                                                                                                                                                                                                 |
| A change to how sand rests or runs                                     | `src/app/sand.ts` (the heightfield, tested in `tests/sand_test.ts` at real volumes) and `physics.ts` (the flowing layer and the grains in the air, tested in `tests/physics_test.ts`) — never in the loop, never in the renderer, and never a fraction drawn as a pile                                                                                                                     |
| A change to how long a glass runs, or how big it is                    | `src/app/timer.ts` (`DURATIONS`, `sizeFor`, tested in `tests/timer_test.ts`) + the length chips in `SettingsScreen.tsx`                                                                                                                                                                                                                                                                    |
| A change to what a press or a drag on the glass does                   | `src/app/Hourglass.tsx` (the gestures) with the edit as a pure function in `timer.ts`, or in `view.ts` for the orbit (tested in `tests/view_test.ts`)                                                                                                                                                                                                                                      |
| A change to how the glass is drawn or lit                              | `src/app/render/stage.ts` (the camera, the lights, the environment, the sand's meshes), `render/parts.ts` (the frame and the glass, off `look.ts`), `render/textures.ts` (wood and sand, drawn from a hash), `sandMesh.ts` (the heap's mesh, tested in `tests/sandMesh_test.ts`) — colours come from the spec or the sky, never from a screen; nothing fetched but this origin's own files |
| A change to the flat picture (the preset cards, the no-WebGL fallback) | `src/app/scene.ts` (the camera and the light, tested), `paintGlass.ts` (the glass), `paintSand.ts` (the sand and the stream) or `paint.ts` (the frame and the order) — and the painter's own drawing stays the fallback under every sprite                                                                                                                                                 |
| A change to the sky                                                    | `src/app/astronomy.ts` (the sun, the moon, their light, `placeOfZone`), `sky.ts` (the colours and the lights, `SkyChoice`) — both tested in `tests/sky_test.ts` at real places and moments — and `render/skyDome.ts` (the shader); `zones.ts` is generated from the tz database's `zone.tab`, never hand-edited, and the place never comes from a location lookup or the network           |
| A better plate, post, finial, glass or grain for the flat picture      | Run the `blender-assets` skill (`.agents/skills/blender-assets/`): `scripts/blender/hourglass.py` and `lib.py`, off numbers the driver takes from `look.ts` / `glass.ts`, then `make blender` into `public/models/` (held to `look.ts` by `tests/sprites_test.ts`) — never a dimension typed in the builder                                                                                |
| A change to how the phone turns, tilts or shakes the glass             | `src/app/useMotion.ts` (the readings, the hysteresis, the lean and its cap, the shake, `deviceToEarth` — tested in `tests/motion_test.ts`) + `physics.ts` for what the sand does with it and `view.ts` for how the glass swings — never a second reading of the sensor, and never a reading kept                                                                                           |
| A change to what a tilt or a shake does to the sand                    | `src/app/physics.ts` (`setGravity`, `toss`, `give`, `turnOver`, `buzzFor` — tested in `tests/physics_test.ts` at real angles) + `Hourglass.tsx` for when the run halts — never in the renderer                                                                                                                                                                                             |
| A new setting                                                          | `src/app/useAppSettings.ts` (shape + clamping, tested in `tests/settings_test.ts`) + a `Section` in `SettingsScreen.tsx`                                                                                                                                                                                                                                                                   |
| Something only the desk does                                           | Behind `useDesk()` in `App.tsx`, or a `lg:` class / `@media (min-width: 64rem)` rule — the phone shell stays as it is                                                                                                                                                                                                                                                                      |
| A new developer-only affordance                                        | `src/app/dev/`, revealed behind `settings.devMode` in `SettingsScreen.tsx`                                                                                                                                                                                                                                                                                                                 |
| A change to what the demo shows                                        | `src/app/dev/demo.ts`, with tests in `tests/demo_test.ts`, which opens it at hours around the clock                                                                                                                                                                                                                                                                                        |
| A way to look at a change                                              | The `screenshot` skill (`.agents/skills/screenshot/`, `make shots` / `make shots-warm`): a new device in `lib/devices.mjs`, a settings variant in `lib/variations.mjs`, a staged screen in `lib/screens.mjs`                                                                                                                                                                               |
| Anything in the native wrapper                                         | `native/...` — and read "The native wrapper" above first                                                                                                                                                                                                                                                                                                                                   |
| Anything in the desktop shell                                          | `tauri/shell/` for a decision, `tauri/src-tauri/` for an effect — and read `tauri/README.md` first                                                                                                                                                                                                                                                                                         |
| Any user-facing string                                                 | `src/app/i18n/en.ts`, never inline in a component                                                                                                                                                                                                                                                                                                                                          |
| A shared UI primitive                                                  | The framework, if it is domain-free; `src/app/` only if it is hourglass-specific                                                                                                                                                                                                                                                                                                           |

## Test conventions

Tests live in `tests/` with a `_test` suffix and run under Vitest in the `node`
environment — they cover the pure modules (`look`, `glass`, `sand`, `timer`,
the sand's physics in `physics_test.ts`, the heap's mesh in
`sandMesh_test.ts`, the sun, the moon, their light and the time zone's place
in `sky_test.ts`, how the glass hangs in `view_test.ts`, `useMotion`'s pure
half in `motion_test.ts`, the settings parser, the demo seed, the app's
name),
the modelled parts' manifest against `look.ts` (`sprites_test.ts`), and the
strings the wrappers and the app have to agree on (`native_theme_test.ts`,
`native_bundle_test.ts`, `native_icon_test.ts`, `store_listing_test.ts`,
`store_preflight_test.ts`). No DOM, no testing-library, no mocked clock.
`tests/fixtures/` holds shared fixtures when a test needs one.

`make test` runs them all; run one file with `npx vitest run tests/sand_test.ts`.
Use the Node `.nvmrc` pins (from nvm). `tests/demo_test.ts` opens the demo at
hours from just after midnight to just before the next, so a demo that only
holds at the hour it was written fails.

A change to the sand, its physics, the sky or the timer without a test that
pins the new behaviour at real volumes, real angles or real moments is not
finished. The sand tests measure a heap's volume against what was put in
(`HAIR`, a fraction of a percent) and its steepest slope against the sand's
angle of repose; the physics tests hold a flowing heap between its start
and stop angles, pin the friction law's properties and the stream's fall
time and slide, grains in the air to the volume they left, and the buzz
to the hits; the sky tests pin the sun and the moon at known places and
moments. `physics.ts`, `view.ts`, `sky.ts` and `astronomy.ts` are clock-free
like the rest: `dt`, `now` and the place are parameters. UI changes should keep
the boot smoke path working: `npm run build && npm run preview`, tap the
glass, and check that the sand runs and the frame turns — and look at it
with the `screenshot` skill (`make shots`).

The desktop shell's tests are Rust: `make tauri-test` runs `tauri/shell/tests/`
and needs no GUI libraries.

## Source file size

Non-test source files stay under **1000 physical lines**; prefer splitting by
concern over relaxing the cap — the paint is three files for that reason. A
file may opt out with `guidelines:allow-large-file: <reason>` in a comment in
its first 20 lines, and the reason must be real.

## Changelog and feature docs

`CHANGELOG.md`'s released sections are **generated** — never hand-edit them.
Every user-visible change adds a fragment under `.changes/unreleased/`:

```
.changes/unreleased/$(date +%s)-short-slug.md
---
type: Added        # Added | Changed | Fixed | Removed | Security | Deprecated
title: Short bold title
breaking: true     # optional — forces a major release
---

One sentence a user will read in the changelog.
```

A fragment for a substantial feature links to its doc under `docs/features/`
with `[Learn more](feature:<slug>)`.

## Documentation sync points

| If you change…                                              | Update…                                                                                                                                           |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `sand.ts` or `glass.ts`                                     | `docs/design.md` (the model), `docs/features/hourglass.md`                                                                                        |
| `physics.ts` or `view.ts`                                   | `docs/design.md` (the two layers; turning, tilting and shaking), `docs/features/hourglass.md` (the gestures, the feel)                            |
| `astronomy.ts`, `sky.ts`, `zones.ts` or `render/skyDome.ts` | `docs/design.md` (the sky), `docs/features/hourglass.md` (the sky), the `sky` row in `docs/configuration.md`, the sky hint in `en.ts`             |
| `render/**` or `sandMesh.ts`                                | `docs/design.md` (the picture), the `blender-assets` skill if what the stage takes from `public/models/` changes                                  |
| `timer.ts`                                                  | `docs/features/hourglass.md` (the lengths and the size), the README's Usage table                                                                 |
| `look.ts`                                                   | `docs/features/looks.md` (the tables of tops, glasses, sands and presets), the README's Settings row, the counts in this file                     |
| `paint*.ts` or `scene.ts`                                   | `docs/design.md` (the flat picture)                                                                                                               |
| `useMotion.ts`                                              | `docs/features/hourglass.md` (turning, tilting and shaking it), `docs/troubleshooting.md` (the permission) and the sensor hint in `en.ts`         |
| `scripts/blender/**`, `sprites.ts`                          | `docs/design.md` (the modelled parts), the `blender-assets` skill's tables                                                                        |
| `useAppSettings.ts`                                         | `docs/configuration.md` (the runtime settings table)                                                                                              |
| A `VITE_*` variable                                         | `docs/configuration.md`, `src/vite-env.d.ts`, the README's Configuration table, and the workflows that pass it                                    |
| A screen's behaviour                                        | The matching `docs/features/*.md` and the README's Usage table                                                                                    |
| Anything under `native/`                                    | `docs/features/native-app.md`, `native/README.md`, `native/RELEASING.md`                                                                          |
| Anything under `tauri/`                                     | `docs/features/desktop-app.md`, `tauri/README.md`                                                                                                 |
| Module layout                                               | The "Where new code goes" table above and `docs/architecture.md`                                                                                  |
| A make target or script                                     | `CONTRIBUTING.md`, the README's Quick start, and this file's command list                                                                         |
| `.agents/skills/screenshot/**`                              | The `screenshot` skill's `SKILL.md`, the `make shots` examples in the `add-hourglass-look` and `blender-assets` skills, `docs/troubleshooting.md` |

## Parity and cross-cutting rules

- **Every string goes through `t()`.** English is the only catalog today; the
  runtime is in place so adding a language is one `loaders` entry.
- **Two themes only** — one light, one dark, plus "follow the device". The
  framework ships a dozen palettes; this app deliberately exposes none of them.
  The one deliberate exception is the hourglass itself (`look.ts`): a walnut
  frame is walnut on the light theme and a black sand black on the dark one,
  because an object has a colour the way a theme does not. Its colours are the
  spec's own and never reach the UI around it.
- **One screen, and the glass is the whole of it.** There are no tabs, no
  sidebar, no drawer and no bar over the glass: the cog floats in the corner
  and opens Settings, which is a screen on the phone and a panel on the desk,
  and that is the entire navigation. (The one other glyph is a new version's,
  beside the cog and only while one waits — `UpdateGlyph.tsx`.) A new _action_ is a gesture on the glass
  or a row in Settings, never a button beside the glass.
- **The glass is the switch, and the whole glass.** A tap anywhere on the
  hourglass turns it over. A drag on it sets the length. Do not add a start
  button, a reset button or a length field next to it.
- **No digits.** The glass says how far a run has come the way an hourglass
  does — by how much sand is left — and the only figure on the screen is the
  length, shown for a moment when it changes. A countdown ticking beside the
  glass is the thing this app is built not to be.
- **No toasts.** Nothing pops up over the glass to say what it already
  shows: the sand running out is an empty bulb, a soft light and a buzz,
  and a new version is the glyph beside the cog. The framework's toast
  viewport is not mounted.
- **The size is the length.** A longer glass is a bigger glass (`sizeFor`),
  and nothing else about the layout moves: the glass is centred and the room
  it takes is the only thing a length changes.
- **No dependency creep.** The framework, Preact, three.js (the glass's
  renderer and the only 3D dependency — approved by the owner; never a
  second one beside it), one font (Inter, an `@fontsource` package imported
  in `main.tsx` a weight at a time and bundled from this origin), and
  workbox-window. A new runtime dependency needs a reason that the framework
  can't serve. A font is never reached for over the network, and neither is
  a sprite or a texture: the modelled parts and the grain are files under
  `public/`, from this origin, the wood and the sand's speckle are drawn in
  the page, and Blender is a build tool that never runs in the app.

## Website staleness

The app _is_ the website — `pages.yml` builds it and deploys `dist/`. There is
no separate marketing site to drift out of date, but the `<head>` copy does:
when the app's description changes, update `index.html`'s title/description/OG
and the manifest copy in `pwa-plugin.ts` together.

The website is unlisted: it is a testing surface, and people install the app
from its store listing. Every page it emits carries a robots `noindex`, and it
ships no sitemap, structured data, `llms.txt`, SEO or Lighthouse workflow, and
no page-weight or chunk budget.

## Maintenance skills

Skills live under `.agents/skills/`; `.claude/skills` is a symlink into that
tree. Each has a `SKILL.md` with its discovery process, its source→output
mapping, and a `.last-updated` marker.

| Skill                | Runs when                                                                                                                                     |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `maintenance`        | The registry and run order for every other skill — start here                                                                                 |
| `write-changeset`    | Any user-visible change, before opening the PR                                                                                                |
| `update-docs`        | `src/app/` changed in a way a `docs/` topic describes                                                                                         |
| `update-readme`      | Commands, configuration, or the feature set changed                                                                                           |
| `add-hourglass-look` | A new top, glass, sand or preset is asked for — often from a photograph of a real hourglass; keeps makers' names and trademarked features out |
| `blender-assets`     | A frame, a glass or the grain is to be modelled better, or a new top or glass needs its sprites — `make blender` and everything around it     |
| `screenshot`         | Anything a person sees changed — the glass, the sand, the sky, a preset, a setting's effect, Settings — `make shots` and `make shots-warm`    |
