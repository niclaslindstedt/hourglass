# The app on a phone

Hourglass is a PWA first: open it in a browser, add it to the home screen, and
it is an app. `native/` is the other way in — the same web app, wrapped thinly
enough to ship through the **App Store** and **Google Play**.

## What the wrapper is

A `WebView` and a loopback HTTP server, and very little else.

The whole web build is packed into the download (`assets/webroot.zip`),
unpacked on first launch, and served from `http://localhost:<fixed port>`.
Nothing is fetched. The app works on a plane, in a tunnel, and on a phone that
has never had a network — and it changes only when a new build ships to the
store, not when the website deploys.

Around that, the wrapper keeps the native chrome in step: the status bar and
the safe-area bands take the page's own theme, so a dark glass does not sit
under a white bar. Links out of the app open in the system browser. On Android
the hardware back button drives the WebView's history.

There is **no native UI**. Everything you see is the web app, unchanged, down
to the last grain of the sand.

## Turning the phone

The phone's motion sensors reach the page the way they reach any web page,
through the browser's own `deviceorientation` and `devicemotion` events — the
wrapper does nothing for them. On an iPhone they ask for permission the first
time the glass is tapped, and the app says so in Settings. A reading is used
for the next frame and thrown away. The sky behind the glass is placed by the
device's time zone, not its location, so the wrapper asks for no location
permission either.

## What the wrapper does not do

The fleet's other wrappers offer the page an iCloud store, a sign-in sheet, a
share sheet and a camera. This one offers none of them, because this app has
no document to keep, no account to sign in to, no file to export and no code
to scan. It is the web app served from inside the download, and that — the
sand running with no network at all, on a phone in a pocket — is what it adds
over the website.

Two rules keep the app and the website the same product:

- **Nothing in `src/` knows the wrapper exists.** The web app does not check
  whether it is native.
- **The wrapper decides nothing about the glass.** It moves bytes. What the
  sand does and what a turn means are the web app's, in `sand.ts` and
  `timer.ts`.

## Building it

See [`../../native/README.md`](../../native/README.md) for the day-to-day, and
[`../../native/RELEASING.md`](../../native/RELEASING.md) for what a store build
needs.
