// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Builds the web app and packs its `dist/` into one asset —
// `native/assets/webroot.zip` — that the wrapper bundles, unpacks on first
// launch and serves over a loopback HTTP server (src/local-server.ts). That is
// what makes the app self-contained: the hourglass runs entirely on-device,
// and changes only when a new build ships to the store.
//
// The web build is `npm run build` at the repo root — base `/`, which is
// exactly what a localhost origin wants — with two build parameters
// (`webBuildEnv` in `web-build.mts`). `VITE_EDITION=store` is the channel:
// this is the build sold in the App Store, and, as a build that is not the
// website, it carries no link back to the source (by owner decision):
// `vite.config.ts` leaves the web edition's address out of the page. `VITE_SHELL_BUILD=on` is the medium, and is the
// desktop shell's flag: the site ships inside the binary, so it has no service
// worker and no in-app update prompt — a new version arrives from the store.
// Nothing else in `src/` changes for the app. If the wrapper ever needs the web
// app to behave differently, that is a sign it has stopped being thin.
//
// It also passes the listing's name, `APP_DISPLAY_NAME`, which the web build
// shows wherever the app names itself (`src/app/appName.ts`) — so the bar
// says what the icon says. The process environment wins (CI takes
// it from the secret), then `native/.env`, then the project's own name
// (`identifiers.js`), which is what a fresh checkout builds under.
//
// The parameters are build-time, so `--skip-build` re-zips whatever the last
// build left in `dist/` — and a website build there names the web edition and
// carries the worker. The zip is refused when it does (`assertNoSourceLink`,
// `assertNoUpdateCycle`).
//
// Usage:
//   node scripts/bundle-web.mjs                 # build the site, then zip it
//   node scripts/bundle-web.mjs --skip-build    # re-zip an existing dist/
//   node scripts/bundle-web.mjs --profile production
//
// `--profile` is accepted (and echoed) so the release scripts and the CI
// workflow can pass the EAS profile through uniformly. It does not change the
// build today — the web app has no profile-dependent output — but the seam is
// where a "strip the developer menu from store builds" knob would land, and
// having the plumbing already correct is cheaper than retrofitting it.
//
// The zip is a build artifact (gitignored). Generate it before `eas build`;
// the root `.easignore` is what keeps it in the EAS upload despite that.

import { execFileSync } from "node:child_process";
import {
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { zipSync } from "fflate";

import { nativeEnv } from "../../scripts/lib/store-env.mjs";
import identifiers from "../identifiers.js";
import { updateMachinery, webBuildEnv } from "./web-build.mts";

const APP_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const REPO_DIR = resolve(APP_DIR, "..");
const DIST_DIR = join(REPO_DIR, "dist");
const OUT_ZIP = join(APP_DIR, "assets", "webroot.zip");
const WINDOWS = process.platform === "win32";
const NPM = WINDOWS ? "npm.cmd" : "npm";

const skipBuild = process.argv.includes("--skip-build");
const profileArg = process.argv.indexOf("--profile");
const profile =
  (profileArg >= 0 ? process.argv[profileArg + 1] : undefined) ??
  process.env.EAS_BUILD_PROFILE ??
  "preview";

/** The name under the icon, and so the name the app shows. */
const displayName =
  nativeEnv(REPO_DIR).value("APP_DISPLAY_NAME").trim() ||
  identifiers.PROJECT_NAME;

if (!skipBuild) {
  console.log(
    `• building the web app (npm run build) — profile ${profile}, ` +
      `named "${displayName}"…`,
  );
  execFileSync(NPM, ["run", "build"], {
    cwd: REPO_DIR,
    env: webBuildEnv(process.env, displayName),
    stdio: "inherit",
    // npm on Windows is a batch shim, which Node cannot execute directly.
    shell: WINDOWS,
  });
}

/** Collect `dist/` into the flat `{ "index.html": bytes }` shape fflate wants,
 *  with forward-slash paths relative to the dist root. */
function collect(dir, files = {}) {
  for (const entry of readdirSync(dir)) {
    const abs = join(dir, entry);
    if (statSync(abs).isDirectory()) {
      collect(abs, files);
    } else {
      files[relative(DIST_DIR, abs).split("\\").join("/")] = new Uint8Array(
        readFileSync(abs),
      );
    }
  }
  return files;
}

let files;
try {
  files = collect(DIST_DIR);
} catch (error) {
  console.error(
    `\n✗ could not read ${DIST_DIR} — build the web app first ` +
      `(drop --skip-build, or run 'npm run build' at the repo root).\n`,
  );
  throw error;
}

const count = Object.keys(files).length;
if (count === 0 || !files["index.html"]) {
  throw new Error(
    `dist/ has no index.html (${count} files) — the web build looks empty.`,
  );
}

/** Refuse a webroot that links back to the source (by owner decision): no
 *  GitHub repository, issues, releases or sponsor link, and not the author's
 *  handle anywhere — web-edition address, package name or meta tag included.
 *  The website keeps those; the app has none. Every file but a binary asset is
 *  read, extensionless ones too, so nothing slips past on its suffix. */
const BINARY = /\.(png|ico|jpe?g|webp|gif|woff2?|ttf|otf)$/i;
function assertNoSourceLink(files) {
  const decoder = new TextDecoder();
  for (const [path, bytes] of Object.entries(files)) {
    if (BINARY.test(path)) continue;
    if (decoder.decode(bytes).toLowerCase().includes("niclaslindstedt")) {
      throw new Error(
        `dist/${path} carries a link back to the source ("niclaslindstedt") — ` +
          `the phone app must not. Rebuild through this script (drop ` +
          `--skip-build) so VITE_EDITION=store compiles it out.`,
      );
    }
  }
}

assertNoSourceLink(files);

/** Refuse a webroot that carries the website's update cycle — the service
 *  worker (`sw.js`), the `version.json` it polls, its precache list. In the app
 *  a worker would serve the page from its own cache of files already on the
 *  device, so an app updated from the store could go on showing the old site,
 *  and the update prompt would announce a version nobody can install from
 *  inside it. `VITE_SHELL_BUILD=on` is what leaves them out; this is the check
 *  that the build honoured it. */
function assertNoUpdateCycle(files) {
  const found = updateMachinery(Object.keys(files));
  if (found.length) {
    throw new Error(
      `dist/ carries the website's update cycle (${found.join(", ")}) — the ` +
        `phone app must not. Rebuild through this script (drop --skip-build) ` +
        `so VITE_SHELL_BUILD=on leaves it out.`,
    );
  }
}

assertNoUpdateCycle(files);

// Deterministic zip: every entry pinned to the ZIP epoch (1980-01-01), so the
// artifact is reproducible instead of drifting with the clock.
const zipped = zipSync(files, { mtime: new Date("1980-01-01T00:00:00Z") });
mkdirSync(dirname(OUT_ZIP), { recursive: true });
writeFileSync(OUT_ZIP, zipped);

console.log(
  `✓ wrote ${OUT_ZIP} — ${count} files, ${(zipped.length / 1024).toFixed(0)} KB`,
);
