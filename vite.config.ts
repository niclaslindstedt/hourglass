// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { execSync } from "node:child_process";
import { readFileSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import preact from "@preact/preset-vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig, type Plugin } from "vite";

import { appPwa } from "./pwa-plugin.ts";

// The base path is injected by the deploy workflow via VITE_BASE, one per
// release channel on the custom domain (hourglass.niclaslindstedt.se): the
// released app at `/` and the rolling main build at `/preview/`. Defaults to
// `/` for local dev and preview builds.
const base = process.env.VITE_BASE ?? "/";

// Sibling release channels that live *under* this build's base and must be
// disowned by its service worker (see pwa-plugin.ts `ignorePaths`). Only the
// root release sets this — comma-separated absolute paths, e.g. `/preview/`.
const ignorePaths = (process.env.VITE_PWA_IGNORE_PATHS ?? "")
  .split(",")
  .map((p) => p.trim())
  .filter(Boolean);

// Build identity for the Settings → About grid.
const commit =
  process.env.GITHUB_SHA?.slice(0, 7) ??
  (() => {
    try {
      return execSync("git rev-parse --short HEAD", {
        encoding: "utf8",
      }).trim();
    } catch {
      return "unknown";
    }
  })();
const buildNumber = process.env.GITHUB_RUN_NUMBER ?? "dev";

const here = (p: string) => fileURLToPath(new URL(p, import.meta.url));

// The app's released version, the base of the About build label.
const appVersion = (
  JSON.parse(readFileSync(here("./package.json"), "utf8")) as {
    version: string;
  }
).version;

// The build identifier shown in Settings → About. Shape:
// `<version>[.<run>][-<slot>][+<commit>]` — `<run>` is the CI run number,
// `<slot>` is `pre` for the `/preview/` deploy (omitted for the production `/`
// build), and `<commit>` is the short commit hash as semver build metadata. A
// local build collapses to just `<version>`.
const buildSlot = base === "/preview/" ? "pre" : "";
const buildLabel =
  appVersion +
  (process.env.GITHUB_RUN_NUMBER ? `.${process.env.GITHUB_RUN_NUMBER}` : "") +
  (buildSlot ? `-${buildSlot}` : "") +
  (process.env.GITHUB_SHA ? `+${process.env.GITHUB_SHA.slice(0, 7)}` : "");

// The label the PWA update toast shows for the incoming build. It also lands
// in the generated `sw.js`, so the worker's bytes change every deploy and the
// browser reliably discovers the update; a CI build's label carries the run
// number and commit, so it is unique per deploy. A local build's label
// collapses to just `<version>`, so append a timestamp there to keep the
// per-build uniqueness the worker relies on.
const version = process.env.GITHUB_SHA
  ? buildLabel
  : `${buildLabel}+${new Date().toISOString()}`;

// A build for the DESKTOP SHELL (tauri/), set by `tauri/scripts/bundle-web.mjs`.
//
// It changes exactly one thing, and it is about the medium rather than the
// audience: the service worker is left out (`serviceWorker: false` below —
// everything else `appPwa` writes into the `<head>` still applies). A desktop
// build has no deployment to discover an update from — a new version arrives
// as a new binary — so a worker here would precache a copy of files already on
// local disk and then serve the page from ITS copy. `__SHELL_BUILD__` carries
// the same fact into the app, where it switches off the update prompt that has
// nothing left to prompt about.
const shellBuild = process.env.VITE_SHELL_BUILD === "on";

// Every build that is not the website: the desktop shell's, and the phone
// wrapper's, which `native/scripts/bundle-web.mjs` builds as the store edition
// (`VITE_EDITION=store`). An app from a store carries no link back to the
// source (by owner decision), and `websiteOnly` below leaves out what names
// the web edition.
const appBuild = shellBuild || process.env.VITE_EDITION === "store";

// The name the app shows (`src/app/appName.ts`). An app build is a deployment
// with a listing, and it says the listing's name — `APP_DISPLAY_NAME`, which
// `native/scripts/bundle-web.mjs` and the desktop packaging pass in, the name
// under the icon. The website keeps the project's own.
const appName = appBuild ? process.env.APP_DISPLAY_NAME?.trim() || "" : "";

// What only the website carries, left out of an app build (by owner decision): the Open
// Graph and Twitter tags in `index.html` that point at the web edition's
// address, and the two public files that exist for them and for Pages — the
// share card (`og.png`) and the custom-domain file (`CNAME`). The bundle
// scripts refuse a webroot that still names the site's owner.
function websiteOnly(): Plugin {
  let outDir = "";
  return {
    name: "website-only",
    apply: "build",
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir);
    },
    transformIndexHtml(html) {
      return html.replace(
        /[ \t]*<meta\b[^>]*\bcontent="https?:\/\/[^"]*"[^>]*>\n?/g,
        "",
      );
    },
    closeBundle() {
      for (const file of ["CNAME", "og.png"]) {
        rmSync(resolve(outDir, file), { force: true });
      }
    },
  };
}

export default defineConfig({
  base,
  // No size budgets, by owner decision: this only keeps Vite's warning quiet.
  build: { chunkSizeWarningLimit: 100_000 },
  define: {
    __SHELL_BUILD__: JSON.stringify(shellBuild),
    __APP_VERSION__: JSON.stringify(appVersion),
    __APP_NAME__: JSON.stringify(appName),
    __BUILD_LABEL__: JSON.stringify(buildLabel),
    __BUILD_COMMIT__: JSON.stringify(commit),
    __BUILD_NUMBER__: JSON.stringify(buildNumber),
  },
  // `appPwa` only applies on build, so dev keeps registering no worker (the
  // app passes `enabled: !import.meta.env.DEV` to `usePwaUpdate`).
  //
  // The runtime is Preact, not React: `@preact/preset-vite` compiles JSX
  // against `preact/jsx-runtime` and aliases `react` / `react-dom` (and the
  // `/jsx-runtime` + `/client` subpaths) onto `preact/compat`, so both this
  // app's `import … from "react"` lines and the pre-built framework chunks —
  // which import `react`, `react-dom`, and `react/jsx-runtime` as externals —
  // resolve to Preact. Nothing from React itself reaches the bundle; see
  // `docs/architecture.md`.
  plugins: [
    preact(),
    tailwindcss(),
    appPwa({ base, version, ignorePaths, serviceWorker: !shellBuild }),
    ...(appBuild ? [websiteOnly()] : []),
  ],
});
