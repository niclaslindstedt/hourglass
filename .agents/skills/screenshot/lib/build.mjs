// The demo build the shots are taken of, made only when the sources moved.
//
// Not the in-memory demo (`VITE_SEED=demo` holds its own settings and run and
// ignores the ones a shot seeds): the app as it ships, with the settings and
// the run seeded into localStorage the way a person's own are kept.
// `VITE_SHELL_BUILD=on` is the build the shells ship — no service worker to
// cache a stale copy, no update prompt over the frame. The build lands in the
// skill's own `.build/`, never in `dist/`.
//
// The build itself takes a couple of seconds; skipping it when nothing changed
// is what makes the second run instant. The stamp is a hash over the name,
// size and mtime of every file the build reads (tracked or not, ignored
// excluded), plus the build's environment — cheaper than hashing contents, and
// an editor that rewrites a file untouched only costs one extra build.

import { spawnSync, execSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";

import { BUILD_DIR, REPO_DIR } from "./paths.mjs";

const INPUTS = [
  "src",
  "public",
  "index.html",
  "vite.config.ts",
  "pwa-plugin.ts",
  "tsconfig.json",
  "package.json",
  "package-lock.json",
];

function stampFor(env) {
  const hash = createHash("sha1");
  hash.update(JSON.stringify(env));
  const list = execSync(
    `git ls-files -co --exclude-standard -z -- ${INPUTS.join(" ")}`,
    {
      cwd: REPO_DIR,
      encoding: "utf8",
    },
  )
    .split("\0")
    .filter(Boolean);
  for (const file of list) {
    try {
      const s = statSync(join(REPO_DIR, file));
      hash.update(`${file}\0${s.size}\0${s.mtimeMs}\n`);
    } catch {
      // Deleted between the listing and the stat: the next run sees it gone.
    }
  }
  return hash.digest("hex");
}

/**
 * Build unless the last build was of these same inputs.
 * @param {{ force?: boolean, skip?: boolean, edition?: "web"|"store", name?: string, log?: (s: string) => void }} opts
 * @returns {{ built: boolean, dir: string, ms: number }}
 */
export function ensureBuild({
  force = false,
  skip = false,
  edition = "web",
  name,
  log = () => {},
} = {}) {
  const env = {
    VITE_SHELL_BUILD: "on",
    ...(edition === "store"
      ? { VITE_EDITION: "store", APP_DISPLAY_NAME: name ?? "Hourglass" }
      : {}),
  };
  const stampFile = join(BUILD_DIR, ".stamp");
  const index = join(BUILD_DIR, "index.html");
  if (skip) {
    if (!existsSync(index))
      throw new Error(`--no-build, but there is no build in ${BUILD_DIR}`);
    return { built: false, dir: BUILD_DIR, ms: 0 };
  }
  const stamp = stampFor(env);
  if (
    !force &&
    existsSync(index) &&
    existsSync(stampFile) &&
    readFileSync(stampFile, "utf8") === stamp
  ) {
    return { built: false, dir: BUILD_DIR, ms: 0 };
  }
  const t0 = Date.now();
  log(`building the app (${edition}) into ${BUILD_DIR} …`);
  const run = spawnSync(
    "npx",
    [
      "vite",
      "build",
      "--outDir",
      BUILD_DIR,
      "--emptyOutDir",
      "--logLevel",
      "warn",
    ],
    {
      cwd: REPO_DIR,
      env: { ...process.env, ...env },
      stdio: ["ignore", "pipe", "pipe"],
      encoding: "utf8",
    },
  );
  if (run.status !== 0 || !existsSync(index)) {
    throw new Error(`demo build failed:\n${run.stdout}\n${run.stderr}`);
  }
  mkdirSync(BUILD_DIR, { recursive: true });
  writeFileSync(stampFile, stamp);
  return { built: true, dir: BUILD_DIR, ms: Date.now() - t0 };
}
