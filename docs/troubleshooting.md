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
the app. The `screenshot` skill looks for a `playwright-core` whose Chromium
is on disk in three places, in order: the skill's own `node_modules`
(`.agents/skills/screenshot/`), the checkout's, and the machine's global npm
tree. `make shots-warm` says which is missing and installs it — a
`playwright-core` into the skill, and its Chromium — then builds and opens
one page to prove the three work together.

**`make shots` is slow.** The glass is WebGL, and headless Chromium draws it
on the CPU (SwiftShader): about twenty seconds a frame, two at a time by
default (`--jobs`). Ask for the frames you need — a `--screen`, a
`--variant`, one `--device` — rather than the whole matrix.

## The glass

**Turning the phone does nothing.** **Settings → The timer → Turn with the
phone** must be on, and on an iPhone the motion sensors have to be allowed:
they are asked for the first time you tap the glass (or switch the setting
on) — Safari only grants them at the end of a tap, not while a finger is
still down. If it was refused, allow it under the browser's site settings
(or the phone's Settings for the app) and tap again. A desktop has no
sensor, and the glass turns by tap alone.

**The screen turns sideways for a moment when I turn the phone.** The page
never turns with the phone — it is turned back the moment the browser has
rotated it — but on an iPhone a web page, in Safari or added to the Home
Screen, cannot stop the browser from rotating it first: iOS ignores a web
app's portrait lock and offers a page no way to ask for one, so the
system's own rotation plays before the page hears of it. The App Store app
and an Android install are held to portrait and never do this. On an
iPhone, turn on **Portrait Orientation Lock** in Control Center: the screen
then stays put, and the glass still turns with the phone, because the
motion sensors do not depend on the screen turning.

**The sand stopped when I tilted the phone.** Past sixty degrees to a side
the hole is not fed, as in a real glass on its side; stand the phone up and
the run goes on from where it was, the pause not counted. A phone leaned
back or forward, or laid flat on a table, does not stop it: the sand leans
to the back or the front of the bulb and keeps running.

**Shaking does nothing.** The shake reads the motion sensor, which an iPhone
grants with the orientation sensor on the first tap; **Turn with the
phone** off turns both off. A gentle movement is under the threshold: the
sand is thrown up only by a jerk toward the end it rests on, faster than it
would fall. On a desk there is no phone to shake: a sideways drag spins
the glass about its own axis, and a fast one flings the sand up the walls.

**The phone does not buzz when the sand lands.** **Feel the sand** is off,
the page has not been tapped yet (a browser allows a buzz only after one),
or the device cannot buzz from a web page — Safari on an iPhone cannot.

**The glass looks flat, or plainer than on another device.** The glass is
drawn in 3D with WebGL; where the browser cannot start it, or loses it, the
app paints the glass flat instead. The flat picture's modelled frame and
glass are pictures the app fetches from its own files; until they arrive
the painter draws its own plainer version.

**The sky is dark, or the sun is in the wrong place.** **Settings → The
sky → Now** is the sky outside at this moment, where the device's time zone
says it is — the city the zone is named for, so a place far from that city
sees the sun a little off. Pick **Day**, **Dusk** or **Night** for a fixed
sky.

**The screen went to sleep mid-run.** **Keep the screen on** is off, or the
browser refused the wake lock (an iPhone in Low Power Mode does). The sand is
still right when the screen comes back: the run is read off the clock.

**The glass came back further on than it left.** That is the same clock: a
glass in a background tab, or on a locked phone, keeps running, and the first
frame back shows the sand where it is now.

**The buzz does not come.** The device has no vibration motor (a desk, an
iPhone in Safari), or **Buzz when it runs out** is off. The light behind the
glass comes up either way.

## Recovery

**The glass opened on a different length or look than I left it.** The
settings are in this browser's localStorage, so a different browser, a
private window, or the desktop app has settings of its own. Clearing site data
resets them to the study glass at five minutes.
