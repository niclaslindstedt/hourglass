# Troubleshooting

## Install and build

**`npm install` fails with `401 Unauthorized` for `@niclaslindstedt/oss-framework`.**
The package comes from GitHub Packages, which requires a token even for public
packages. Put one with the `read:packages` scope in `~/.npmrc`:
`//npm.pkg.github.com/:_authToken=<token>`. The project's own `.npmrc` only
maps the scope to the registry and carries no token.

**`make lint` fails on types from `react`.** The app runs on Preact;
`tsconfig.json`'s `paths` point `react` at `preact/compat`. Don't add
`@types/react` — see `AGENTS.md`.

**`make shots` fails to find a browser.** Playwright is not a dependency of
the app. Install it outside the lockfile — the script's header says how — or
point the script at a Chromium with `--browser <path>`.

## The glass

**Turning the phone does nothing.** **Settings → The timer → Turn with the
phone** must be on, and on an iPhone the motion sensor has to be allowed: it is
asked for the first time you press the glass, and if it was refused, allow it
under the browser's site settings (or the phone's Settings for the app) and
press again. A desktop has no sensor, and the glass turns by tap alone.

**The sand stopped when I tilted the phone.** Past sixty degrees from
upright the hole is not fed, as in a real glass on its side; stand the phone
up and the run goes on from where it was, the pause not counted. A phone
laid flat on a table does not stop it.

**Shaking does nothing.** The shake reads the motion sensor, which an iPhone
grants with the orientation sensor on the first press; **Turn with the
phone** off turns both off. A gentle movement is under the threshold — a
shake is a shake.

**The frame looks plain, or changed after a moment.** The modelled frame
and glass are pictures the app fetches from its own files; until they
arrive the painter draws its own plainer version, and a build without
`public/models/` shows that version always.

**The screen went to sleep mid-run.** **Keep the screen on** is off, or the
browser refused the wake lock (an iPhone in Low Power Mode does). The sand is
still right when the screen comes back: the run is read off the clock.

**The glass came back further on than it left.** That is the same clock: a
glass in a background tab, or on a locked phone, keeps running, and the first
frame back shows the sand where it is now.

**The sand looks coarse or flat.** The grain is drawn one speck to a device
pixel, so a browser zoomed out, or a display at a fractional scale, draws it
softer. The light on the glass is rendered once per size; a resize redraws it.

**The buzz does not come.** The device has no vibration motor (a desk, an
iPhone in Safari), or **Buzz when it runs out** is off. The light behind the
glass comes up either way.

## Recovery

**The glass opened on a different length or look than I left it.** The
settings are in this browser's localStorage, so a different browser, a
private window, or the desktop app has settings of its own. Clearing site data
resets them to the study glass at five minutes.
