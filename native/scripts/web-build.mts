// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// What the phone wrapper's web build is, as data `bundle-web.mjs` acts on and
// `tests/native_bundle_test.ts` pins. Kept apart from the script because the
// script builds and zips when it is run, and a rule worth testing should not
// need a build to test it.

/** The environment the web build runs under: this process's, with the phone
 *  app's two build parameters on top.
 *
 *  `VITE_EDITION=store` is the channel: the build sold in the App Store, whose
 *  page carries no link back to the source. A caller may still set another
 *  edition explicitly.
 *
 *  `VITE_SHELL_BUILD=on` is the medium, and it is not negotiable: the site
 *  ships inside the binary, so there is no deploy for a service worker to
 *  discover and no update for the in-app prompt to announce — a new version
 *  arrives as a new build from the store. It is the flag the desktop shell
 *  builds with, and the phone app is the same shape of thing: a worker in the
 *  WebView would precache files already on the device and go on serving them
 *  after the store had delivered new ones.
 *
 *  `displayName` is the store listing's name, which the site shows wherever the
 *  app names itself, so the bar says what the icon says. */
export function webBuildEnv(
  env: Readonly<Record<string, string | undefined>>,
  displayName: string,
): Record<string, string | undefined> {
  return {
    ...env,
    VITE_EDITION: env.VITE_EDITION ?? "store",
    VITE_SHELL_BUILD: "on",
    APP_DISPLAY_NAME: displayName,
  };
}

/** The files that exist only to drive a website's update cycle: the worker
 *  (`sw.js`), the version it polls and the precache list its progress bar
 *  counts. The shell build emits none of them (`appPwa`'s
 *  `serviceWorker: false`). */
const UPDATE_FILES = new Set([
  "sw.js",
  "sw.mjs",
  "version.json",
  "precache-manifest.json",
]);

/** Which of a webroot's paths (forward-slash, relative to its root) belong to
 *  the update cycle — empty for a build made through `bundle-web.mjs`. Only the
 *  root is looked at: that is where the worker has to be to control the page. */
export function updateMachinery(paths: Iterable<string>): string[] {
  return [...paths].filter((path) => UPDATE_FILES.has(path)).sort();
}
