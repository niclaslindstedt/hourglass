// Find a `playwright-core` and a Chromium to drive it, without insisting on
// where either came from.
//
// Three places are tried, in order: the skill's own node_modules (after
// `warm.mjs` or `npm install` here), the checkout's, and the machine's global
// npm tree (a `playwright` or `playwright-core` installed with -g — the web
// sandbox has one, with its browsers under PLAYWRIGHT_BROWSERS_PATH). The
// first copy whose browser is actually on disk wins, because a playwright-core
// is only as useful as the exact Chromium build it was released against.

import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { REPO_DIR, SKILL_DIR } from "./paths.mjs";

function globalRoots() {
  const roots = [];
  // node lives in <prefix>/bin/node; its global modules in <prefix>/lib/node_modules.
  const prefix = resolve(dirname(process.execPath), "..");
  roots.push(join(prefix, "lib", "node_modules"));
  try {
    roots.push(
      execSync("npm root -g", {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      }).trim(),
    );
  } catch {
    // No npm on the path; the prefix guess above still stands.
  }
  return roots;
}

function candidates() {
  const dirs = [
    join(SKILL_DIR, "node_modules"),
    join(REPO_DIR, "node_modules"),
    ...globalRoots(),
  ];
  const found = [];
  for (const dir of dirs) {
    for (const pkg of ["playwright-core", "playwright"]) {
      const manifest = join(dir, pkg, "package.json");
      if (!existsSync(manifest)) continue;
      try {
        // `playwright` re-exports playwright-core and carries it in its own
        // node_modules — resolve from inside the package so either name works.
        const require = createRequire(manifest);
        const entry = require.resolve("playwright-core");
        const pkgDir = dirname(require.resolve("playwright-core/package.json"));
        const version = require("playwright-core/package.json").version;
        found.push({ from: dir, entry, pkgDir, version });
      } catch {
        // A broken install; the next candidate may be whole.
      }
    }
  }
  return found;
}

/** Whether the Chromium this playwright-core was released against is on disk. */
function browserPresent(chromium) {
  try {
    return existsSync(chromium.executablePath());
  } catch {
    return false;
  }
}

/**
 * The `chromium` launcher, and where it came from.
 * @returns {Promise<{chromium: import("playwright-core").BrowserType, version: string, from: string, pkgDir: string, browser: boolean}>}
 */
export async function loadPlaywright() {
  const tried = [];
  let fallback = null;
  for (const c of candidates()) {
    const mod = await import(pathToFileURL(c.entry).href);
    const pw = mod.default ?? mod;
    const chromium = pw.chromium;
    const version = c.version;
    const browser = browserPresent(chromium);
    tried.push(
      `${c.from} (playwright-core ${version}, browser ${browser ? "present" : "missing"})`,
    );
    const found = {
      chromium,
      version,
      from: c.from,
      pkgDir: c.pkgDir,
      browser,
    };
    if (browser) return found;
    fallback ??= found;
  }
  if (fallback) return fallback;
  throw new Error(
    [
      "no playwright-core found. Fix: `node .agents/skills/screenshot/warm.mjs` (installs it into the skill),",
      "or `npm install -g playwright` for the whole machine.",
      ...(tried.length ? ["tried:", ...tried.map((t) => `  ${t}`)] : []),
    ].join("\n"),
  );
}

/** The command that fetches the Chromium a given playwright-core wants. */
export function installCommand(pkgDir) {
  return ["node", join(pkgDir, "cli.js"), "install", "chromium-headless-shell"];
}

/** Launch flags every shot uses: WebGL on the CPU (SwiftShader), since the
 *  glass is drawn by three.js and a headless machine has no GPU to give it. */
export const LAUNCH_ARGS = [
  "--use-angle=swiftshader",
  "--enable-unsafe-swiftshader",
  "--ignore-gpu-blocklist",
];

export async function launch(chromium) {
  try {
    return await chromium.launch({ headless: true, args: LAUNCH_ARGS });
  } catch (error) {
    const message = String(error?.message ?? error);
    if (
      /executable doesn't exist|Executable doesn't exist|ENOENT/.test(message)
    ) {
      throw new Error(
        `Chromium is not installed for this playwright-core.\n${message}\n\nFix: node .agents/skills/screenshot/warm.mjs`,
        { cause: error },
      );
    }
    throw error;
  }
}
