---
name: screenshot
description: "Use while developing anything a person sees — the glass, its sand, the sky, the frame, a preset, a setting's effect, Settings, a layout at another width. Shoots the real app in headless Chromium (WebGL on SwiftShader) and lays the frames out on contact sheets: phone, iPad, desktop, light and dark, every preset and sky, the glass running, turned over, leaned, shaken, or turned by a finger. Write code, shoot, look, iterate."
---

# Screenshot

Look at the change, not at the code that should have made it. This skill
shoots the real app — the production build, in a real Chromium, at real
viewports — and puts the frames where you can read them: one PNG per frame,
and contact sheets that hold a whole matrix on one image.

The loop is: **write code → `make shots` → look at the sheet → fix what is
wrong → shoot again.** Every visual change ends with a look, on more than
one preset and sky, before the PR.

It came from the sibling `recorder` app's skill of the same name; the
machinery is the same, the screens and settings are the hourglass's.

## Commands

```sh
make shots-warm                                   # once per session: a browser, the build
make shots                                        # the default set: the glass running, full, done, upside down, leaned right and back
make shots ARGS="--screen glass --device phone"   # one frame
make shots ARGS="--variant presets --screen glass --group screen --cols variant --wrap 5"   # every preset, one sheet
make shots ARGS="--variant skies --screen glass --group screen --cols variant"             # day, dusk, night, now
make shots ARGS="--screen sensors"                # upside down, leaned, laid flat, shaken
make shots ARGS="--screen around --variant sky-day"   # the phone turned: the sun's glint in the glass
make shots ARGS="--device phone,desktop --screen glass,settings"
make shots ARGS="--settings '{\"preset\":\"custom\",\"custom\":{\"top\":\"steel\",\"glass\":\"bell\",\"sand\":\"gold\"}}'"
make shots ARGS="--screen glass --scale 2 --out /tmp/glass.png"   # one frame, close up
make shots ARGS="--list"                          # every device, theme, variant, screen
```

`node .agents/skills/screenshot/shoot.mjs --help` prints every option.
Output lands in `.agents/skills/screenshot/out/latest/` (gitignored; a run
replaces the last one): `sheet-<group>.png` per sheet and
`<device>/<theme>[+variant]/<screen>.png` per frame, plus `manifest.json`.
`--out <dir>` keeps a run elsewhere; `--out <file>.png` names a single
frame. The command prints where everything went and exits non-zero if a
frame failed, with the failing step and a `<screen>.failed.png` of what was
on screen.

**Read the frames with the Read tool** — a sheet first, to compare; then a
single frame (`--scale 2`) when a grain, a glint or an edge needs judging.

## What varies

| Axis      | Values                                                                                                                                                                                                                             | Default                |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- |
| `device`  | `phone` 440×956 · `phone-small` 375×667 · `phone-landscape` · `tablet-mini` · `tablet` · `tablet-landscape` · `desktop` 1440×900 · `desktop-small` · `desktop-wide`                                                                | `phone,tablet,desktop` |
| `theme`   | `dark` · `light` · `system-light` · `system-dark` (sets: `both`, `all`) — Settings' and the cog's; the glass fills the screen with its sky either way                                                                              | `dark`                 |
| `variant` | `default` (the default preset on a fixed day sky) · a preset id (`study` … `treasure`) · `sky-day` · `sky-dusk` · `sky-night` · `sky-now` · `one-minute` · `two-hours` · `dev` (sets: `presets`, `skies`, `sizes`, `all`)          | `default`              |
| `screen`  | `glass` (running) · `full` · `done` · `turning` · `turned` · `upside` · `lean-right` · `lean-back` · `flat` · `shake` · `orbit` · `turned-left` · `turned-right` · `settings` (sets: `states`, `sensors`, `turn`, `around`, `all`) | `default` set          |

`--state full|running|done` and `--at <fraction>` set the run every frame
opens on (default running, 0.42 of the way). `sky-now` draws the sky at the
moment of the shot, from the time zone the browser reports — so it differs
from run to run; the fixed skies are what to compare against.

A sheet is one per value of `--group` (default `device`), its columns
`--cols` (default `screen`), its rows whatever else varies; more than
`--wrap` columns (6) continue in a band below.

## How a frame is made

- **The subject is the app as it ships**, built with `VITE_SHELL_BUILD=on`
  (no service worker, no update prompt) into the skill's `.build/` (never
  `dist/`), and rebuilt only when something under `src/`, `public/`,
  `index.html` or the Vite config moved. `--build` forces one, `--no-build`
  uses what is there. Not the in-memory demo (`VITE_SEED=demo`): the demo
  keeps its own settings and ignores the ones a shot seeds.
- **Every frame is a fresh browser context.** The theme, the variant and
  the run reach the app the way a person's own do — the settings key and the
  run key in localStorage, seeded before the page loads. Then the screen's
  `stage` in `lib/screens.mjs` does what a person does: taps the glass, taps
  the cog, drags a finger, or turns the phone — a `deviceorientation`
  reading as the sensor gives it (beta 90 upright, −90 upside down, gamma a
  lean to the side, alpha a turn about the vertical), or a `devicemotion`
  jolt. Nothing else is injected: no DOM surgery, no fake state.
- **The glass says when it has drawn** (`data-drawn` on `[data-area=glass]`),
  and a frame waits for it. The sand is physics and has no state to wait
  on: a heap falling or settling is given the time it takes.
- **WebGL runs on the CPU** (SwiftShader, `--use-angle=swiftshader`), which is
  slow — about twenty seconds a frame, two frames at a time by default
  (`--jobs`). A frame that has to catch something mid-motion (`turning`)
  may land late for that reason; judge motion on a device.
- **The locale is pinned to `en-US`**: the sandbox's own is one Intl rejects.
  Any page error a frame logs is printed under the summary — read those
  lines; a blank region on a frame usually has one.

## Adding to it

- **A new screen** — a `stage` in `lib/screens.mjs`. Wait for the state an
  action makes where there is one (a dialog, a radio); use roles.
- **A new setting** — a preset in `lib/variations.mjs`, the same shape the
  app stores (`src/app/useAppSettings.ts`).
- **A new width** — a row in `lib/devices.mjs`. It is a CSS viewport;
  `mobile` turns on touch.

## Rules

- Never commit `out/`, `.build/` or the skill's `node_modules/` — all three
  are gitignored here.
- Frame nothing the app cannot do itself. A frame that needs DOM surgery to
  look right is a picture that needs fixing.
- A visual change is not finished until it has been looked at on more than
  one preset and more than one sky, on a phone and on the desk. Put the
  sheet's path, or the sheet, in the PR when the change is visual.
- This is a development tool. The store's screenshots are the store
  harness's, not this.

## If it does not run

`make shots-warm` says what is missing. It looks for `playwright-core` in the
skill's `node_modules`, the checkout's, then the machine's global npm tree
(`npm root -g`), and takes the first whose Chromium is on disk
(`PLAYWRIGHT_BROWSERS_PATH` is honoured). With none, it installs the pinned
`playwright-core` into the skill and fetches the headless shell — both need
the network. Bumping `package.json`'s pin means fetching the matching browser
again; the fetch command is what warm prints.
