// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SCRIPT THE WRAPPER INJECTS TO WATCH THE PAGE'S CHROME.
//
// The web app is shipped unchanged — nothing in `src/` knows it is running
// inside a native shell, and that is the whole point of a thin wrapper. So
// the one thing native needs from the page is read from the *outside*, by this
// script, over `window.ReactNativeWebView.postMessage`: the RESOLVED THEME
// COLOURS, so the status bar and the safe-area bands match whichever theme
// the reader picked instead of being guessed at.
//
// Nothing else crosses this way. The wrapper copies nothing out of
// `localStorage` and has no use for it.
//
// It also unregisters the service worker (see `SW_TEARDOWN`).
//
// This file exports STRINGS, not behaviour: `react-native-webview` takes the
// script as source text. Keep it dependency-free ES5-ish — it runs in the
// page, not in Metro's bundle, so nothing here is transpiled or polyfilled.

/** The message channel. Namespaced so a stray `postMessage` from the page (or
 *  from a future framework feature) is never mistaken for a report. */
export const REPORT_TYPE = "hourglass-native/theme";

/** How long a burst of theme reads is allowed to settle before a report goes
 *  out. The theme engine repaints a handful of times while a preset is being
 *  picked, and the status bar has no use for the intermediate frames. */
const REPORT_DEBOUNCE_MS = 200;

/**
 * Take the service worker out of the picture, once, at startup.
 *
 * The wrapper serves the app off local disk, so the worker's offline cache
 * buys nothing here — and it actively hurts: the origin is a fixed
 * `http://localhost:<port>`, so a worker registered by version N of the app
 * keeps answering from its precache after a store update has already unpacked
 * version N+1 into the webroot. The visible symptom is an App Store update
 * that changes nothing until the app is deleted and reinstalled.
 *
 * Everything is guarded: an older WebView with no `caches` or no
 * `serviceWorker` simply skips it.
 */
const SW_TEARDOWN = `
  try {
    if (navigator.serviceWorker && navigator.serviceWorker.getRegistrations) {
      navigator.serviceWorker.getRegistrations().then(function (regs) {
        regs.forEach(function (reg) { reg.unregister(); });
      }).catch(function () {});
    }
    if (window.caches && caches.keys) {
      caches.keys().then(function (keys) {
        keys.forEach(function (key) { caches.delete(key); });
      }).catch(function () {});
    }
  } catch (e) {}
`;

/**
 * The script injected BEFORE the page loads.
 *
 * Of this file's work only the service-worker teardown goes here (`App.tsx`
 * puts the save-file descriptor beside it), and it has to: a worker that has
 * already claimed the page is answering fetches by the time the document
 * fires `load`, so unregistering it after the fact leaves this launch on the
 * stale bundle. Reporting waits for the page, since there is no theme to read
 * until the app has mounted.
 */
export const BEFORE_LOAD_SCRIPT = `(function () {${SW_TEARDOWN}})(); true;`;

/**
 * The script injected once the page has loaded.
 *
 * Reports immediately and then whenever the resolved theme could have moved:
 * the reader picked a theme in Settings (a class or attribute on `<html>`),
 * the device switched between light and dark under "follow the device", or
 * the app came back to the foreground having done so while away.
 */
export const AFTER_LOAD_SCRIPT = `(function () {
  if (window.__hourglassNativeReporter) return;
  window.__hourglassNativeReporter = true;

  function colours() {
    try {
      var style = getComputedStyle(document.documentElement);
      var read = function (name) { return (style.getPropertyValue(name) || "").trim(); };
      return {
        background: read("--page-bg"),
        foreground: read("--fg"),
        muted: read("--muted"),
        accent: read("--accent")
      };
    } catch (e) { return {}; }
  }

  var last = "";
  function report() {
    try {
      if (!window.ReactNativeWebView) return;
      var theme = colours();
      var signature = JSON.stringify(theme);
      if (signature === last) return;
      last = signature;
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: ${JSON.stringify(REPORT_TYPE)},
        theme: theme
      }));
    } catch (e) {}
  }

  var timer = null;
  function schedule() {
    if (timer) clearTimeout(timer);
    timer = setTimeout(function () { timer = null; report(); }, ${REPORT_DEBOUNCE_MS});
  }

  // The theme engine paints by setting a class and a data attribute on
  // <html>, so watching those two is watching the theme itself — no polling,
  // and no knowledge of which attribute the framework happens to use.
  try {
    var observer = new MutationObserver(schedule);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class", "style", "data-theme"]
    });
  } catch (e) {}

  try {
    var media = window.matchMedia("(prefers-color-scheme: dark)");
    if (media.addEventListener) media.addEventListener("change", schedule);
    else if (media.addListener) media.addListener(schedule);
  } catch (e) {}

  document.addEventListener("visibilitychange", function () {
    if (!document.hidden) schedule();
  });

  // The theme engine paints on the frame after mount, so the very first read
  // can land on an unstyled document. Report now and once again shortly after.
  report();
  setTimeout(report, 400);
})(); true;`;

/** Narrow an arbitrary parsed `postMessage` body to a theme report. */
export function isThemeReport(value: unknown): value is {
  type: string;
  theme: Record<string, string>;
} {
  const message = value as { type?: unknown; theme?: unknown } | null;
  return (
    typeof message === "object" &&
    message !== null &&
    message.type === REPORT_TYPE &&
    typeof message.theme === "object" &&
    message.theme !== null
  );
}

/** A status-bar content style `expo-status-bar` takes. */
export type StatusBarStyle = "light" | "dark" | "auto";

/**
 * The status-bar style for a reported page background: light icons over a
 * dark page, dark icons over a light one, from the colour's perceived
 * luminance (Rec. 601 luma, as checklist and notes decide it).
 *
 * The page's background — not the phone's light or dark setting — is what
 * sits under the bar: on iOS the WebView runs edge to edge, and on Android the
 * band behind the bar is painted in the same colour. `"auto"` follows the
 * phone's setting, so it drew dark icons over a dark theme whenever the phone
 * was in light mode. It is kept only for "nothing to go on": no report yet, or
 * a colour this cannot read (it takes hex and `rgb()`, which is what the theme
 * engine writes).
 */
export function statusBarStyleFor(
  background: string | null | undefined,
): StatusBarStyle {
  const rgb = background ? parseColour(background) : null;
  if (!rgb) return "auto";
  const luma = (0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2]) / 255;
  return luma < 0.5 ? "light" : "dark";
}

/** `#rgb`, `#rgba`, `#rrggbb`, `#rrggbbaa` or `rgb()`/`rgba()` (comma or
 *  space separated) to its red, green and blue channels, 0..255; null for
 *  anything else. Alpha is ignored — the bar sits on the opaque page. */
function parseColour(value: string): [number, number, number] | null {
  const text = value.trim().toLowerCase();
  const hex = /^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/.exec(text);
  if (hex) {
    const short = hex[1] ?? "";
    const digits =
      short.length <= 4 ? short.replace(/./g, (d) => d + d) : short;
    return [
      parseInt(digits.slice(0, 2), 16),
      parseInt(digits.slice(2, 4), 16),
      parseInt(digits.slice(4, 6), 16),
    ];
  }
  const rgb =
    /^rgba?\(\s*([\d.]+)(?:\s*,\s*|\s+)([\d.]+)(?:\s*,\s*|\s+)([\d.]+)\s*(?:[,/][^)]*)?\)$/.exec(
      text,
    );
  if (rgb) {
    const channels = rgb.slice(1, 4).map(Number);
    if (channels.every((n) => Number.isFinite(n) && n >= 0 && n <= 255)) {
      return channels as [number, number, number];
    }
  }
  return null;
}
