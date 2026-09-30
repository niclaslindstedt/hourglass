# Configuration

The app runs with no configuration at all. What follows is what a _deploy_ can
set at build time, what a _user_ can set at runtime, and where the app keeps
its state.

## Build-time variables

Read by Vite at build time through `import.meta.env` (declared in
`src/vite-env.d.ts`) or by `vite.config.ts` from the environment. All optional.

| Variable                | Effect                                                                                                                                                                                                                                                                                                          |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `VITE_BASE`             | The deploy base path. `pages.yml` sets `/` for the release and `/preview/` for the rolling main build.                                                                                                                                                                                                          |
| `VITE_PWA_IGNORE_PATHS` | Sibling deploy paths the root service worker must disown (`/preview/`). Only the root release sets it.                                                                                                                                                                                                          |
| `VITE_EDITION`          | Which build this is. `store` for the one in the App Store; anything else, including unset, is the web edition. A store build carries no link back to the website — no Open Graph tags naming it, no `CNAME`, no `og.png`.                                                                                       |
| `VITE_SHELL_BUILD`      | `on` when a wrapper's bundle script builds the site: no service worker is emitted and the in-app update prompt is off, because a phone or desktop build updates by being replaced. Set by `native/scripts/web-build.mts` and `tauri/scripts/bundle-web.mjs`, never by hand.                                     |
| `APP_DISPLAY_NAME`      | The name the app shows — in Settings and in the sentences that name it — in an **app build** only (the phone's store edition and the desktop shell): the listing's name, the same one under the icon. The wrappers' bundle scripts pass it from the environment or `native/.env`; the website says `Hourglass`. |
| `VITE_SEED`             | `demo` boots the app onto the demo run — a glass part way through a half-hour run, held in memory and never written to the browser (see `src/app/dev/demo.ts`). `make demo` and the store screenshots set it; a release never does, and the check folds away in any other build.                                |

Every setting the workflows read is a repository **secret**; the repository
keeps no Actions variables.

## The native wrapper's variables

`native/` is a separate project with a build of its own; these are read there,
never by the web app. See
[`../native/.env.example`](../native/.env.example) and
[`../native/RELEASING.md`](../native/RELEASING.md).

| Variable                    | Effect                                                                                                                          |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `EXPO_PUBLIC_HOURGLASS_URL` | Point the wrapper's WebView at a deployed slot instead of the copy bundled inside it. **Debugging only** — never a store build. |
| `EAS_PROJECT_ID`            | The EAS project a build runs under. `eas init` prints it but cannot write it into a dynamic config, so it is passed in.         |
| `EXPO_TOKEN`                | An Expo access token, so CI can drive EAS with no interactive login. A repository secret; treat it as a password.               |
| `APP_BUNDLE_ID`             | The store identifier the wrapper is built under; a plain checkout falls back to `dev.local.hourglass`.                          |

The desktop shell reads `HOURGLASS_APP_URL` and `HOURGLASS_WEBROOT` the same
way, for developing only — see [`../tauri/README.md`](../tauri/README.md).

## Runtime settings

Under the **⚙** in the corner. Persisted per device in localStorage
(`hourglass:settings`), never synced.

| Setting                | Key            | Values                                                   | Default  |
| ---------------------- | -------------- | -------------------------------------------------------- | -------- |
| Theme                  | `theme`        | Light / Dark / Device                                    | Device   |
| Hourglass              | `preset`       | one of ten presets / Custom                              | Study    |
| Custom: the frame      | `custom.top`   | Walnut, Oak, Pine, Ebony, Brass, Copper, Steel, None     | Walnut   |
| Custom: the glass      | `custom.glass` | Teardrop, Sphere, Cone, Slim, Antique, Bell              | Teardrop |
| Custom: the sand       | `custom.sand`  | Quartz, White, Black, Red, Blue, Gold, Rose, Green       | Quartz   |
| Length                 | `minutes`      | 1–10 min by the minute, 15, 20, 25, 30, 45, 60, 90, 120  | 5 min    |
| Buzz when it runs out  | `vibrate`      | on / off                                                 | on       |
| Keep the screen on     | `awake`        | on / off                                                 | on       |
| Turn with the phone    | `sensor`       | on / off                                                 | on       |
| Feel the sand          | `haptics`      | on / off                                                 | on       |
| The sky                | `sky`          | Now / Day / Dusk / Night (`now`, `day`, `dusk`, `night`) | Now      |
| Developer mode         | `devMode`      | on / off                                                 | off      |
| Capture console output | `captureLogs`  | on / off (developer mode)                                | off      |

The length is also set on the glass itself, by dragging; the two are one
setting. **Feel the sand** buzzes when the sand hits the glass, on a device
that can (`navigator.vibrate` — Android; not Safari on an iPhone). **The
sky** is the sky behind the glass and the light on it: **Now** is the sky
outside at this moment, placed by the device's time zone (never by asking
where the device is); the other three are fixed. Both the preset and the custom look are kept, so going back to a
preset and then to Custom again finds the custom glass as it was left.

## Storage keys

| Key                  | Holds                                                                                                    |
| -------------------- | -------------------------------------------------------------------------------------------------------- |
| `hourglass:settings` | The runtime settings above                                                                               |
| `hourglass:run`      | Where the sand stood when the glass was last turned, and when: the length, the share through, the moment |
| `hourglass:logs`     | The in-app log buffer                                                                                    |
| `hourglass:language` | The language choice (English only today)                                                                 |

That is everything. There is no document, no cache of a cloud copy and no
backup, because there is nothing to back up: a glass is the same glass on any
device once the same length is chosen.
