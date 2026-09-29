#!/usr/bin/env node
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
//
// Screenshots of the hourglass, for iterating on its look.
//
// The glass is drawn from the look, the length and the clock, and a change
// to how it draws is judged by eye — so this puts the production build in a
// headless browser, seeds a run in one of a few states, and takes a picture
// of the glass for each combination asked for — and, when there is more than
// one, lays them out on a contact sheet, `sheet.png`, a row per look and a
// column per state. Run it after `make build`, or through `make shots`,
// which builds first.
//
//   node scripts/glass-shots.mjs                          the default glass, running, phone, dark
//   node scripts/glass-shots.mjs --preset all             every preset
//   node scripts/glass-shots.mjs --preset harbor --state full,running,done
//   node scripts/glass-shots.mjs --look '{"top":"brass","sand":"gold"}'
//   node scripts/glass-shots.mjs --shell phone,desk --theme dark,light
//   node scripts/glass-shots.mjs --minutes 1,30,120
//   node scripts/glass-shots.mjs --preset study --settings
//
// Options (each list is comma-separated):
//   --preset  <ids|all>   a preset id from look.ts (default: the default preset)
//   --look    <json>      a custom look instead, as fields over the default preset
//   --state   <list>      full | running | done                (default: running)
//   --shell   <list>      phone | desk                         (default: phone)
//   --theme   <list>      dark | light                         (default: dark)
//   --minutes <list>      the length(s), from timer.ts's list  (default: 30)
//   --at      <fraction>  how far through the run (default: 0.42)
//   --settings            a picture of the Settings screen too
//   --upside              the phone turned over: the sensor reports gravity
//                         up the screen after the glass has settled
//   --tilt    <degrees>   the phone rolled to one side by that much (+ right)
//   --shake               the phone shaken hard, just before the picture
//   --full                the whole screen rather than the glass
//   --no-sheet            the pictures only, without the contact sheet
//   --out     <dir>       where the pictures go                 (default: shots/)
//   --url     <url>       a running server to use               (default: http://localhost:4173/)
//   --browser <path>      a Chromium to run; otherwise Playwright's own
//
// Playwright is not a dependency of the app — nothing shipped needs it — so
// it is installed on demand and outside the lockfile:
//
//   npm install --no-save playwright && npx playwright install chromium
//
// A Chromium already on the machine is used instead with --browser or the
// PLAYWRIGHT_CHROMIUM variable; Claude Code on the web has one at
// /opt/pw-browsers/chromium, and the script looks there by itself.
//
// Nothing here reaches the network: the page is the local build, served by
// vite preview, which the script starts if nothing answers at --url.

import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { spawn } from "node:child_process";
import { resolve } from "node:path";

import {
  DEFAULT_LOOK_PRESET,
  LOOK_PRESET,
  LOOK_PRESETS,
} from "../src/app/look.ts";
import { DURATIONS } from "../src/app/timer.ts";

const STATES = ["full", "running", "done"];
const SHELLS = {
  phone: { width: 393, height: 852 },
  desk: { width: 1280, height: 800 },
};
const THEMES = ["dark", "light"];

const args = parseArgs(process.argv.slice(2));
const url = args.url ?? "http://localhost:4173/";
const out = resolve(args.out ?? "shots");
const states = list(args.state, ["running"], STATES);
const tiltDeg = args.tilt ? Number(args.tilt) : 0;
if (!Number.isFinite(tiltDeg)) fail(`--tilt wants degrees, not "${args.tilt}"`);
const shells = list(args.shell, ["phone"], Object.keys(SHELLS));
const themes = list(args.theme, ["dark"], THEMES);
const minutesList = list(
  args.minutes,
  ["30"],
  DURATIONS.map((m) => String(m)),
).map(Number);
const at = Number(args.at ?? 0.42);

/** The looks to draw: presets by id, or one custom look. */
const looks = args.look
  ? [
      {
        name: "custom",
        preset: "custom",
        custom: { ...LOOK_PRESET[DEFAULT_LOOK_PRESET], ...json(args.look) },
      },
    ]
  : list(args.preset, [DEFAULT_LOOK_PRESET], LOOK_PRESETS, "all").map((id) => ({
      name: id,
      preset: id,
      custom: LOOK_PRESET[id],
    }));

const { chromium } = await loadPlaywright();
const server = (await answers(url)) ? null : await startPreview(url);
mkdirSync(out, { recursive: true });

/** Every picture taken, for the sheet. */
const taken = [];

try {
  const browser = await chromium.launch({ executablePath: chromiumPath() });
  for (const look of looks)
    for (const state of states)
      for (const minutes of minutesList)
        for (const shell of shells)
          for (const theme of themes) {
            const name = `${look.name}-${state}-${minutes}m-${shell}-${theme}${args.upside ? "-upside" : ""}${tiltDeg ? `-tilt${tiltDeg}` : ""}${args.shake ? "-shake" : ""}`;
            const context = await browser.newContext({
              viewport: SHELLS[shell],
              deviceScaleFactor: 2,
              colorScheme: theme,
            });
            const page = await context.newPage();
            await page.addInitScript(seed, {
              state,
              minutes,
              at,
              settings: {
                theme,
                preset: look.preset,
                custom: look.custom,
                minutes,
              },
            });
            await page.goto(url);
            // eslint-disable-next-line no-undef
            await page.evaluate(() => document.fonts.ready);
            // The heaps settle over the first frames.
            await page.waitForTimeout(1200);
            if (args.upside || tiltDeg) {
              // Upright first, so the second reading is a turn rather than
              // the sensor's first word on which way up the phone is.
              await tilt(page, 90, 0);
              await page.waitForTimeout(200);
              // An upright phone leaned to one side by θ reads a front-back
              // tilt of 90° − θ and a left-right tilt of ±90°: the sensor's
              // own way of saying it (`screenGravity`).
              await tilt(
                page,
                (90 - Math.abs(tiltDeg)) * (args.upside ? -1 : 1),
                tiltDeg > 0 ? 90 : tiltDeg < 0 ? -90 : 0,
              );
              await page.waitForTimeout(1600);
            }
            if (args.shake) {
              for (let k = 0; k < 6; k++) {
                await shake(page, 16);
                await page.waitForTimeout(60);
              }
              await page.waitForTimeout(80);
            }
            await page.screenshot({
              path: `${out}/${name}.png`,
              clip: args.full
                ? undefined
                : await glassClip(page, SHELLS[shell]),
            });
            console.log(`${name}.png`);
            taken.push({
              file: `${out}/${name}.png`,
              look: look.name,
              state: `${state} · ${minutes} min`,
              shell,
              theme,
            });

            if (args.settings) {
              await page
                .getByRole("button", { name: "Settings" })
                .first()
                .click();
              await page.waitForTimeout(600);
              await page.screenshot({ path: `${out}/${name}-settings.png` });
              console.log(`${name}-settings.png`);
            }
            await context.close();
          }
  if (taken.length > 1 && !args["no-sheet"]) {
    await sheet(browser, taken, `${out}/sheet.png`);
    console.log("sheet.png");
  }
  await browser.close();
} finally {
  server?.kill();
}

/** The pictures on one page: a row for each look, shell and theme, a column
 *  for each state, every cell labelled. */
async function sheet(browser, shots, file) {
  const columns = [...new Set(shots.map((s) => s.state))];
  const rows = [];
  for (const shot of shots) {
    const key = `${shot.look} · ${shot.shell} · ${shot.theme}`;
    let row = rows.find((r) => r.key === key);
    if (!row) rows.push((row = { key, cells: {} }));
    row.cells[shot.state] = shot.file;
  }
  const cell = 300;
  const html = `<!doctype html><meta charset="utf-8">
<style>
  body { margin: 0; padding: 24px; background: #15171a; color: #d7dae0;
         font: 13px/1.4 system-ui, sans-serif; }
  h1 { font-size: 15px; font-weight: 600; margin: 0 0 16px; color: #f2f3f5; }
  table { border-collapse: separate; border-spacing: 12px; }
  th { text-align: left; font-weight: 600; color: #f2f3f5; white-space: nowrap;
       vertical-align: top; padding-top: 6px; }
  thead th { text-transform: uppercase; letter-spacing: 0.08em; font-size: 11px;
             color: #9aa0a8; padding: 0 0 4px; }
  td { width: ${cell}px; vertical-align: top; background: #0b0c0e;
       border-radius: 12px; padding: 8px; }
  img { display: block; width: ${cell}px; height: auto; border-radius: 8px; }
</style>
<h1>${escape("Glass shots")}</h1>
<table>
  <thead><tr><th></th>${columns.map((c) => `<th>${escape(c)}</th>`).join("")}</tr></thead>
  <tbody>${rows
    .map(
      (r) =>
        `<tr><th>${escape(r.key)}</th>${columns
          .map((c) =>
            r.cells[c]
              ? `<td><img src="${dataUri(r.cells[c])}"></td>`
              : "<td></td>",
          )
          .join("")}</tr>`,
    )
    .join("")}</tbody>
</table>`;
  const page = await browser.newPage({
    viewport: { width: 220 + columns.length * (cell + 28) + 48, height: 800 },
  });
  await page.setContent(html);
  await page.screenshot({ path: file, fullPage: true });
  await page.close();
}

function dataUri(file) {
  return `data:image/png;base64,${readFileSync(file).toString("base64")}`;
}

function escape(text) {
  return String(text).replace(
    /[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c],
  );
}

/** The settings and the run a state is drawn from, written into
 *  localStorage before the app boots. Runs in the page. */
function seed({ state, minutes, at, settings }) {
  const now = Date.now();
  const run =
    state === "full"
      ? { minutes, fraction: 0, startedAt: null }
      : state === "done"
        ? { minutes, fraction: 1, startedAt: null }
        : { minutes, fraction: 0, startedAt: now - at * minutes * 60000 };
  localStorage.setItem("hourglass:settings", JSON.stringify(settings));
  localStorage.setItem("hourglass:run", JSON.stringify(run));
}

/** A reading from the phone's orientation sensor: `beta` is the
 *  front-back tilt, 90 for a phone held upright and −90 for one turned
 *  over. */
async function tilt(page, beta, gamma) {
  await page.evaluate(
    ([b, g]) => {
      /* eslint-disable no-undef -- runs in the page */
      const event = new DeviceOrientationEvent("deviceorientation", {
        alpha: 0,
        beta: b,
        gamma: g,
        absolute: false,
      });
      window.dispatchEvent(event);
      /* eslint-enable no-undef */
    },
    [beta, gamma],
  );
}

/** A reading from the phone's accelerometer with gravity taken out: a
 *  shake of `a` m/s² along the screen. */
async function shake(page, a) {
  await page.evaluate((x) => {
    /* eslint-disable no-undef -- runs in the page */
    const event = new DeviceMotionEvent("devicemotion", {
      acceleration: { x, y: 0, z: 0 },
      accelerationIncludingGravity: { x, y: 9.8, z: 0 },
      rotationRate: { alpha: 0, beta: 0, gamma: 0 },
      interval: 16,
    });
    window.dispatchEvent(event);
    /* eslint-enable no-undef */
  }, a);
}

/** The glass, as a clip inside the viewport. */
async function glassClip(page, viewport) {
  const box = await page.locator('[data-area="glass"]').boundingBox();
  if (!box) return undefined;
  return {
    x: Math.max(0, box.x),
    y: Math.max(0, box.y),
    width: Math.min(viewport.width - box.x, box.width),
    height: Math.min(viewport.height - box.y, box.height),
  };
}

// ── The machinery ──

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith("--")) fail(`unexpected argument: ${arg}`);
    const key = arg.slice(2);
    const next = argv[i + 1];
    if (
      key === "settings" ||
      key === "upside" ||
      key === "shake" ||
      key === "full" ||
      key === "no-sheet" ||
      next === undefined ||
      next.startsWith("--")
    ) {
      out[key] = true;
    } else {
      out[key] = next;
      i++;
    }
  }
  return out;
}

/** A comma-separated list, checked against what is on offer. */
function list(value, fallback, offered, all) {
  if (value === undefined || value === true) return fallback;
  if (all && value === all) return [...offered];
  const items = String(value)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  for (const item of items) {
    if (!offered.includes(item))
      fail(`unknown value "${item}"; one of ${offered.join(", ")}`);
  }
  return items;
}

function json(value) {
  if (value === undefined || value === true) return {};
  try {
    return JSON.parse(value);
  } catch {
    return fail(`not JSON: ${value}`);
  }
}

async function loadPlaywright() {
  try {
    return await import("playwright");
  } catch {
    return fail(
      "playwright is not installed. It is not a dependency of the app, so install it outside the lockfile:\n" +
        "  npm install --no-save playwright && npx playwright install chromium",
    );
  }
}

/** A Chromium to run: the one named, the one Claude Code on the web keeps,
 *  or Playwright's own. */
function chromiumPath() {
  const named = args.browser ?? process.env.PLAYWRIGHT_CHROMIUM;
  if (named) return named;
  const web = "/opt/pw-browsers/chromium";
  return existsSync(web) ? web : undefined;
}

async function answers(url) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(1500) });
    return res.ok;
  } catch {
    return false;
  }
}

/** `vite preview` on the port --url names, serving dist/. */
async function startPreview(url) {
  if (!existsSync(resolve("dist/index.html"))) {
    fail(
      `nothing answers at ${url} and there is no dist/ to serve — run \`make build\` first`,
    );
  }
  const port = new URL(url).port || "4173";
  const child = spawn(
    "npx",
    ["vite", "preview", "--port", port, "--strictPort"],
    { stdio: "ignore" },
  );
  for (let i = 0; i < 40; i++) {
    if (await answers(url)) return child;
    await new Promise((r) => setTimeout(r, 250));
  }
  child.kill();
  return fail(`vite preview did not come up at ${url}`);
}

function fail(message) {
  console.error(message);
  process.exit(2);
}
