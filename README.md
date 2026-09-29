# Hourglass

> A local-first hourglass PWA — a glass of sand you turn over with a tap, sized to the minutes you want, with sand that piles the way sand does. No account, no server.

[![ci](https://github.com/niclaslindstedt/hourglass/actions/workflows/ci.yml/badge.svg)](https://github.com/niclaslindstedt/hourglass/actions/workflows/ci.yml)
[![pages](https://github.com/niclaslindstedt/hourglass/actions/workflows/pages.yml/badge.svg)](https://github.com/niclaslindstedt/hourglass/actions/workflows/pages.yml)
[![license](https://img.shields.io/badge/license-PolyForm--Noncommercial--1.0.0-blue.svg)](LICENSE)

## What

**Hourglass** is a timer that is an hourglass. The screen is the glass: two
bulbs in a frame, sand in the upper one, a stream running through the waist
and a cone growing in the lower one. Tap it and it turns over. Drag up or down
on it and it becomes a longer or a shorter glass — a longer one is a bigger
one, the way a real half-hour glass is bigger than a three-minute egg timer —
from one minute to two hours. Turn the phone upside down and the sand runs the
other way, without the picture moving: it is the phone that moved.

The sand is sand rather than a bar: each bulb keeps a heightfield of rings,
the volume that has run through is exactly the volume the clock says has, and
every heap relaxes toward its own angle of repose — glass beads flatter, black
sand steeper — so the upper surface is a funnel and the lower a cone, and a
glass that has been in a background tab for ten minutes is ten minutes further
on when it comes back. The picture is lit by one light: the frame, the glass's
reflections and the grain of the sand all come from it.

Ten hourglasses come built in — walnut and black steel, a ship's glass in
turned brass, black lacquer with a tall smoked glass, copper and red sand,
brushed steel and blue beads — and **Custom** puts one together from eight
frames, six glasses and eight sands, every combination drawable.

The same app ships to the **App Store** and **Google Play** through a thin
native wrapper in [`native/`](native/README.md) — the whole web build packed
inside the download and served from the device, so it runs with no network at
all — and as a desktop download for Windows, macOS and Linux through the
[Tauri shell](tauri/README.md).

It is built on [`@niclaslindstedt/oss-framework`](https://github.com/niclaslindstedt/oss-framework),
the shared React/Preact surface behind the sibling
[time](https://github.com/niclaslindstedt/time),
[contacts](https://github.com/niclaslindstedt/contacts) and
[period](https://github.com/niclaslindstedt/period) apps — same settings
layout, same theme engine, same PWA update lifecycle.

## Why

- **Nothing leaves the device.** There is nothing to leave: the app keeps
  its settings and where the sand stood, in the browser's localStorage, and
  sends nothing anywhere — no analytics, no telemetry, no requests at
  runtime. The sensor reading that turns the glass is used for the next frame
  and thrown away.
- **One gesture.** Tap to turn. There is no start button, no reset and no
  countdown: the glass says how far along it is by how much sand is left.
- **Honest sand.** The run is read off the wall clock and the sand off the
  volume, so the picture and the time can never disagree.
- **Works offline, installs as an app.** A PWA with a self-updating service
  worker; the network is never on the critical path.

## Prerequisites

- Node.js ≥ 22 (CI pins 24 — see `.nvmrc`), npm ≥ 10
- A GitHub personal access token with `read:packages` in `~/.npmrc` — the
  `@niclaslindstedt/oss-framework` dependency resolves from GitHub Packages

## Install

```sh
npm config set //npm.pkg.github.com/:_authToken <your-token>
git clone https://github.com/niclaslindstedt/hourglass.git
cd hourglass
npm install
```

## Quick start

```sh
npm run dev
```

Open the printed URL. The glass stands there with its sand run out. Tap it
and it turns over; the sand starts through. Drag up on it for a longer glass,
down for a shorter one — the length shows for a moment while you drag. The
cog in the corner opens Settings, where the other nine hourglasses are.

To open it on the demo instead — a glass part way through a half-hour run,
held in memory and never written to the browser — run `make demo`
(`VITE_SEED=demo`).

To try the production build the way it deploys:

```sh
npm run build && npm run preview
```

To photograph the glass in a few states, for iterating on its look:

```sh
make shots ARGS="--preset all --theme dark,light"
```

The native wrapper is a separate project with its own dependencies — a root
`npm install` does not touch it:

```sh
make native-install      # install the wrapper's dependencies
make native-bundle       # build the web app into native/assets/webroot.zip
make native-typecheck
```

See [`native/README.md`](native/README.md) for running it on a device, and
[`native/RELEASING.md`](native/RELEASING.md) for a store build.

## Usage

One screen, and the glass is all of it:

| Gesture                   | What it does                                                                                                                                                                                                                                                                                         |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Tap** the glass         | Turns it over. The frame rotates half a turn, the heaps drop onto their new floors, and the sand runs from the bulb now on top. Tapping a running glass turns it over too — what had run through is what is now left to run.                                                                         |
| **Drag** up or down on it | A longer or a shorter glass: one length per step along the list — 1 to 10 minutes by the minute, then 15, 20, 25, 30, 45, 60, 90 and 120 — and the glass grows or shrinks to match. The wheel and the arrow keys do the same on a desk. A new length is a new glass, standing with its sand run out. |
| **Turn the phone** over   | The sand runs the other way and the picture stays where it is; a change of length or a tap works exactly as before. Under **Settings → The timer → Turn with the phone**; an iPhone asks for the motion sensor the first time the glass is pressed.                                                  |
| When the sand has run out | A soft light comes up behind the glass, and the device buzzes if it can and the setting is on.                                                                                                                                                                                                       |

…and one button, the cog in the corner:

| Button | What it does                                                                                                                                                                                                                                                          |
| ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **⚙**  | Settings: theme; the hourglass — ten presets or Custom, which combines eight frames, six glasses and eight sands; the timer's length, a buzz when it runs out, keeping the screen on while the sand runs, and turning with the phone; developer tools; and the build. |

## Configuration

The app needs no configuration to run. Every variable is optional:

| Variable           | Effect                                                                                                  |
| ------------------ | ------------------------------------------------------------------------------------------------------- |
| `VITE_BASE`        | Deploy base path (default `/`).                                                                         |
| `VITE_EDITION`     | `store` for the App Store build, which carries no link back to the website. Default: the web edition.   |
| `APP_DISPLAY_NAME` | An app build's name, shown in the app: the listing's. The website always says `Hourglass`.              |
| `VITE_SEED`        | `demo` boots onto the in-memory demo run (`make demo`, the store screenshots). Never set for a release. |

See [`docs/configuration.md`](docs/configuration.md) for the details, the
runtime settings and the storage keys.

## Examples

Run a glass and read the sand back — the model is pure, so it runs anywhere,
no DOM required:

```ts
import { bulbShape, layoutOf } from "./src/app/glass.ts";
import { LOOK_PRESET, SAND } from "./src/app/look.ts";
import {
  capacity,
  createBulb,
  drain,
  levelFill,
  pour,
  settle,
  volume,
} from "./src/app/sand.ts";
import { newRun, passed, turn } from "./src/app/timer.ts";

const look = LOOK_PRESET.study;
const layout = layoutOf(look);
const repose = SAND[look.sand].repose;

// A five-minute glass, turned over at noon.
const noon = Date.UTC(2026, 8, 29, 12);
const run = turn(newRun(5), noon);
passed(run, noon + 2 * 60_000); // → 0.4 — two of the five minutes through

// The sand: an upper bulb resting on the waist, a lower one on its plate.
const upper = createBulb(layout.bulb, "waist", repose);
const lower = createBulb(layout.bulb, "plate", repose);
const sand = capacity(upper) * 0.45;
levelFill(upper, sand);
pour(lower, drain(upper, sand * 0.4)); // the two minutes' worth
settle(upper);
settle(lower);
volume(upper) + volume(lower); // → sand, to a hair: nothing is lost
```

Every number is a function of the volumes and `now`, which is always passed
in — nothing here reads the clock. See [`docs/design.md`](docs/design.md).

## Troubleshooting

| Symptom                                     | Fix                                                                                                                                       |
| ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `npm install` fails with `401 Unauthorized` | The framework comes from GitHub Packages — see Prerequisites.                                                                             |
| Turning the phone does nothing              | **Settings → The timer → Turn with the phone** is off, or an iPhone has not been asked: press the glass once and allow the motion sensor. |
| The screen went to sleep mid-run            | **Keep the screen on** is off, or the browser refused the wake lock; the sand is still right when the screen comes back.                  |
| The glass came back further on than it left | That is the wall clock: the run is read off it, not counted in frames, so a glass in a background tab keeps running.                      |

More in [`docs/troubleshooting.md`](docs/troubleshooting.md).

## Documentation

- [Getting started](docs/getting-started.md)
- [Configuration](docs/configuration.md)
- [Architecture](docs/architecture.md)
- [The design](docs/design.md) — the measurements the glass was drawn from, the sand model and the picture
- [The hourglass](docs/features/hourglass.md) — the screen and its gestures
- [The looks](docs/features/looks.md) — the presets and Custom
- [The app on a phone](docs/features/native-app.md) — the native wrapper
- [The desktop app](docs/features/desktop-app.md)
- [Troubleshooting](docs/troubleshooting.md)
- [`AGENTS.md`](AGENTS.md) — conventions for humans and coding agents

## Contributing

Bugs and feature requests go to
[Issues](https://github.com/niclaslindstedt/hourglass/issues); open-ended
questions to [Discussions](https://github.com/niclaslindstedt/hourglass/discussions).
See [`CONTRIBUTING.md`](CONTRIBUTING.md) for the workflow, and
[`SECURITY.md`](SECURITY.md) for private vulnerability reporting.

## License

[PolyForm Noncommercial 1.0.0](LICENSE) © Niclas Lindstedt.
