# The native wrapper

A **thin** Expo / React Native shell around the hourglass, so it can ship to
the App Store and Google Play — and so it can do the one thing a PWA cannot:
run entirely from inside its own download.

Thin is the design, not an aspiration. The wrapper:

- packs the built web app into `assets/webroot.zip`, unpacks it on first
  launch and serves it from a **loopback HTTP server** (`src/local-server.ts`);
- points a `WebView` at that origin, and gets out of the way — on iOS the
  WebView runs edge to edge and the page pads itself with
  `env(safe-area-inset-*)`, as the installed PWA does; on Android the
  safe-area bands are painted in the page's own background; on both, the
  status bar's clock and icons are light or dark from the background the page
  reports (`src/injected.ts`), never from the phone's appearance; off-origin
  links go to the system browser, and Android's back button drives the
  WebView's history.

That is the entire list. **App Store guideline 4.2 rejects a build that is
only a viewer for a website**, so the wrapper has to do something the browser
cannot, and being self-contained is that thing: the sand runs with no network
at all, ever. The fleet's other wrappers add an iCloud store, a sign-in
sheet, a share sheet and a camera; this one does not, because this app has no
document, no account, no export and no pairing code. Adding a capability is
allowed; adding one that makes `src/` aware of this wrapper is not.

**Nothing in the repo's `src/` knows this exists.** The phone's motion sensor,
which turns the glass, reaches the page through the browser's own
`deviceorientation` event, exactly as it would on the website. The wrapper
also decides nothing about the glass: what the sand does and what a turn
means are the web app's, in `src/app/sand.ts` and `timer.ts`.

## Layout

| Path                     | What it is                                                                                                                                                                                                                                                                                     |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `App.tsx`                | The whole app: a WebView, a spinner, and a failure screen.                                                                                                                                                                                                                                     |
| `src/local-server.ts`    | Unpacks `assets/webroot.zip` and serves it on a **fixed** loopback port.                                                                                                                                                                                                                       |
| `src/injected.ts`        | The theme reporter injected into the page, the status-bar style chosen from its report, and the service-worker teardown. Tested from the root.                                                                                                                                                 |
| `src/config.ts`          | The one developer knob: `EXPO_PUBLIC_HOURGLASS_URL`.                                                                                                                                                                                                                                           |
| `scripts/bundle-web.mjs` | Builds the web app as the store edition (`VITE_EDITION=store`) and as a shell (`VITE_SHELL_BUILD=on`: no service worker, no update prompt), named `APP_DISPLAY_NAME` (env, then `.env`, then `Hourglass`), and packs `dist/` into `assets/webroot.zip`, refusing a webroot with `sw.js` in it. |
| `store/`                 | The listing's rules (committed) and its words (not) — see `store/README.md`.                                                                                                                                                                                                                   |

`ios/` and `android/` are **prebuild output**: regenerated from `app.config.js`
by `expo prebuild --clean`, gitignored, and the source of truth for nothing.
Never edit them.

## Working on it

```sh
make native-install      # or: npm --prefix native install
make native-bundle       # build the web app into assets/webroot.zip
make native-typecheck
make native-prebuild     # inspect what the config generates
```

Then run it on a device or simulator (needs Xcode / Android Studio):

```sh
cd native
npm run ios        # bundles the web app first, then expo run:ios
npm run android
```

`npm run bundle` must have run at least once before any native build — the
wrapper serves that zip, and without it the app launches to a blank screen.

To point a build at a deployed slot instead of the bundled copy (debugging
only — a store build must never do this):

```sh
EXPO_PUBLIC_HOURGLASS_URL=https://hourglass.niclaslindstedt.se/preview/ npm run ios
```

## Things that will bite you

- **The port in `src/local-server.ts` is fixed on purpose.** A web origin is
  scheme + host + port, and `localStorage` is keyed by origin — so a random
  port would hand the WebView fresh settings on every launch, and the glass
  would forget its look and its length.
- **`localhost`, not `127.0.0.1`.** App Transport Security blocks the literal
  address from `WKWebView` even with exception domains declared. The failure
  mode is a silent blank page on iOS.
- **There is no service worker, and any old one is unregistered.** The site
  is built as a shell (`scripts/web-build.mts`), so the webroot has no
  `sw.js`, and `src/injected.ts` still unregisters a worker an older build may
  have left. The origin is stable across app updates, so such a worker would
  keep answering from its precache after a store update had already unpacked
  the new one.
- **The screen stays portrait.** `app.config.js` locks the orientation: the
  glass stands up, and turning the phone is how the sand is turned — a screen
  that rotated with the phone would undo the one gesture the sensor is for.

## Releasing

See [`RELEASING.md`](RELEASING.md).
