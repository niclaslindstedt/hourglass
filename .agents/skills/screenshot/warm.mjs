#!/usr/bin/env node
// Do the slow parts of a first `shoot.mjs` run ahead of time, so the run that
// matters starts shooting at once:
//
//   1. a playwright-core, installed into the skill if none on the machine has
//      its Chromium (lib/playwright.mjs says where it looks);
//   2. that Chromium, fetched if it is missing;
//   3. the app's build, made if the sources moved since the last one;
//   4. one page of it, opened and ready — which is also the proof that the
//      three above work together.
//
// Run it once when a session starts (it is idempotent and quick when nothing
// is missing), then shoot.

import { spawnSync } from "node:child_process";

import { ensureBuild } from "./lib/build.mjs";
import { DEVICES } from "./lib/devices.mjs";
import { SKILL_DIR } from "./lib/paths.mjs";
import { installCommand, launch, loadPlaywright } from "./lib/playwright.mjs";
import { ready } from "./lib/screens.mjs";
import { serveDir } from "./lib/serve.mjs";

const t0 = Date.now();
const say = (s) => console.log(`warm  ${s}`);

function run(cmd, args, cwd) {
  const r = spawnSync(cmd, args, { cwd, stdio: "inherit" });
  if (r.status !== 0)
    throw new Error(`${cmd} ${args.join(" ")} failed (${r.status})`);
}

// 1 + 2: playwright-core and its Chromium.
let pw;
try {
  pw = await loadPlaywright();
} catch {
  say("no playwright-core anywhere — installing the skill's own");
  run("npm", ["install", "--no-audit", "--no-fund"], SKILL_DIR);
  pw = await loadPlaywright();
}
say(`playwright-core ${pw.version} from ${pw.from}`);
if (!pw.browser) {
  say(
    "its Chromium is missing — fetching the headless shell (needs the network)",
  );
  const [cmd, ...cmdArgs] = installCommand(pw.pkgDir);
  run(cmd, cmdArgs, SKILL_DIR);
  pw = await loadPlaywright();
  if (!pw.browser)
    throw new Error(
      "still no browser after the install — see the output above",
    );
}

// 3: the build.
const built = ensureBuild({ log: say });
say(built.built ? `app built in ${built.ms} ms` : "the build is current");

// 4: a page, opened.
const server = await serveDir(built.dir);
const browser = await launch(pw.chromium);
const d = DEVICES.phone;
const context = await browser.newContext({
  viewport: { width: d.width, height: d.height },
  isMobile: true,
  hasTouch: true,
  locale: "en-US",
});
const page = await context.newPage();
const t1 = Date.now();
await page.goto(server.url);
await ready(page);
say(`the glass is drawn in ${Date.now() - t1} ms`);
await browser.close();
await server.close();
say(`done in ${Date.now() - t0} ms — shoot away`);
