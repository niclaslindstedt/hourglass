#!/usr/bin/env node
// Screenshots of the hourglass app: one screen, or a matrix of devices ×
// themes × settings × screens laid out on contact sheets. See SKILL.md.
//
//   node .agents/skills/screenshot/shoot.mjs                       # the default set, three sheets
//   node .agents/skills/screenshot/shoot.mjs --screen player --device phone --theme dark
//   node .agents/skills/screenshot/shoot.mjs --device all --screen library --group screen
//   node .agents/skills/screenshot/shoot.mjs --list
//
// Speed: the demo build is skipped when nothing under src/ moved (`lib/build.mjs`),
// one browser serves every shot, and shots run `--jobs` at a time, each in its
// own context. A first run builds (a few seconds); the ones after start shooting
// at once. `warm.mjs` does the first run's slow parts ahead of time.

import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

import { parseArgs, pickSet } from "./lib/args.mjs";
import { ensureBuild } from "./lib/build.mjs";
import { DEVICES, DEVICE_SETS } from "./lib/devices.mjs";
import { OUT_DIR } from "./lib/paths.mjs";
import { launch, loadPlaywright } from "./lib/playwright.mjs";
import {
  SCREENS,
  SCREEN_SETS,
  helpers,
  ready,
  release,
} from "./lib/screens.mjs";
import { serveDir } from "./lib/serve.mjs";
import { composeSheet } from "./lib/sheet.mjs";
import {
  THEMES,
  THEME_SETS,
  VARIANTS,
  VARIANT_SETS,
  seedRun,
  seedSettings,
} from "./lib/variations.mjs";

const FACETS = ["device", "theme", "variant", "screen"];

const HELP = `shoot.mjs — screenshots of the hourglass app (see SKILL.md)

  --device   <ids|set>   ${Object.keys(DEVICE_SETS).join(", ")} — default: ${DEVICE_SETS.default.join(",")}
  --theme    <ids|set>   ${Object.keys(THEME_SETS).join(", ")} — default: ${THEME_SETS.default.join(",")}
  --variant  <ids|set>   ${Object.keys(VARIANT_SETS).join(", ")} — default: default
  --settings <json>      an ad-hoc settings patch, as one more variant ("custom")
  --screen   <ids|set>   ${Object.keys(SCREEN_SETS).join(", ")} — default: ${SCREEN_SETS.default.join(",")}
  --scale    <n>         device pixel ratio (default 1; 2 for a closer look)
  --jobs     <n>         shots in flight at once (default 2: WebGL on the CPU is slow)
  --out      <dir|png>   where to write (default ${OUT_DIR}/latest; a .png for a single shot)
  --group    <facet>     one sheet per value of this facet (default device); --no-sheet for none
  --cols     <facet>     the sheet's columns (default screen); the other facets are its rows
  --cell     <px>        a sheet cell's shorter side (default 360)
  --wrap     <n>         columns per band before a sheet wraps (default 6)
  --state    <s>         the run the page opens on: full | running | done (default running)
  --at       <fraction>  how far through a running glass (default 0.42)
  --url      <base>      shoot a running server (npm run dev: http://localhost:5173/) instead of building
  --build / --no-build   force the demo build / use the last one as it is
  --edition  web|store   build as the website (default) or as the store app (--name for its name)
  --motion               keep transitions and animations (off by default: faster, steadier)
  --timeout  <ms>        per-step timeout while staging (default 60000)
  --list                 print every device, theme, variant and screen
`;

const args = parseArgs(process.argv.slice(2), {
  lists: ["device", "theme", "variant", "screen"],
});
if (args.help || args.h) {
  console.log(HELP);
  process.exit(0);
}
if (args.list) {
  const table = (name, rows, describe) => {
    console.log(`${name}:`);
    for (const [id, row] of Object.entries(rows))
      console.log(`  ${id.padEnd(18)} ${describe(row)}`);
  };
  table(
    "devices",
    DEVICES,
    (d) => `${d.label} — ${d.width}×${d.height}, ${d.shape} shell`,
  );
  table("themes", THEMES, (t) => t.label);
  table(
    "variants",
    VARIANTS,
    (v) => `${v.label} ${JSON.stringify(v.settings)}`,
  );
  table("screens", SCREENS, (s) => s.label);
  console.log(
    `sets: device ${Object.keys(DEVICE_SETS).join("|")}; theme ${Object.keys(THEME_SETS).join("|")}; variant ${Object.keys(VARIANT_SETS).join("|")}; screen ${Object.keys(SCREEN_SETS).join("|")}`,
  );
  process.exit(0);
}

const devices = pickSet(args.device, DEVICE_SETS, DEVICES, "device");
const themes = pickSet(args.theme, THEME_SETS, THEMES, "theme");
const screens = pickSet(args.screen, SCREEN_SETS, SCREENS, "screen");
const variants = { ...VARIANTS };
let variantIds = pickSet(args.variant, VARIANT_SETS, VARIANTS, "variant");
if (typeof args.settings === "string") {
  variants.custom = {
    label: `Custom ${args.settings}`,
    settings: JSON.parse(args.settings),
  };
  variantIds =
    args.variant === undefined ? ["custom"] : [...variantIds, "custom"];
}
const scale = Number(args.scale ?? 1);
const jobs = Math.max(1, Number(args.jobs ?? 2));
const timeout = Number(args.timeout ?? 60_000);
// A cell's SHORTER side: a phone gets this wide, a laptop window this tall,
// so both stay legible on the sheet.
const cell = Number(args.cell ?? 360);
const wrap = Number(args.wrap ?? 6);
const cellWidthFor = (device) =>
  device.width > device.height
    ? Math.round((cell * device.width) / device.height)
    : Math.min(cell, device.width);
const groupBy = args.group ?? "device";
const colsBy = args.cols ?? "screen";
for (const facet of [groupBy, colsBy]) {
  if (!FACETS.includes(facet))
    throw new Error(`--group/--cols: one of ${FACETS.join(", ")}`);
}

const matrix = [];
for (const device of devices)
  for (const theme of themes)
    for (const variant of variantIds)
      for (const screen of screens)
        matrix.push({ device, theme, variant, screen });

const single = matrix.length === 1;
const outArg = args.out ? resolve(String(args.out)) : join(OUT_DIR, "latest");
const singleFile = single && outArg.endsWith(".png") ? outArg : null;
const outDir = singleFile ? dirname(singleFile) : outArg;
const wantSheet = args.sheet !== false && !single;

const log = (s) => console.error(s);
const t0 = Date.now();

// ---- the site --------------------------------------------------------------

let base = args.url ? String(args.url) : null;
let server = null;
if (!base) {
  const built = ensureBuild({
    force: args.build === true,
    skip: args.build === false,
    edition: args.edition ?? "web",
    name: args.name,
    log,
  });
  if (built.built) log(`built in ${built.ms} ms`);
  server = await serveDir(built.dir);
  base = server.url;
}

// ---- the browser -----------------------------------------------------------

const pw = await loadPlaywright();
const browser = await launch(pw.chromium);

if (wantSheet) {
  // A sheet run replaces the last one wholesale, so a stale frame never poses
  // as the current state. Only a directory this script wrote is emptied. A
  // single frame just lands beside what is there, so a full run's sheets
  // survive the one-screen iterations that follow it.
  if (existsSync(join(outDir, "manifest.json")))
    rmSync(outDir, { recursive: true, force: true });
}
mkdirSync(outDir, { recursive: true });

const NO_MOTION = `*, *::before, *::after { transition-duration: 0s !important; animation-duration: 0s !important; scroll-behavior: auto !important; }`;

async function shoot(shot) {
  const device = DEVICES[shot.device];
  const theme = THEMES[shot.theme];
  const variant = variants[shot.variant];
  const screen = SCREENS[shot.screen];
  const file =
    singleFile ??
    join(
      outDir,
      shot.device,
      shot.theme + (shot.variant === "default" ? "" : `+${shot.variant}`),
      `${shot.screen}.png`,
    );
  mkdirSync(dirname(file), { recursive: true });
  const errors = [];
  const started = Date.now();
  const context = await browser.newContext({
    viewport: { width: device.width, height: device.height },
    deviceScaleFactor: scale,
    isMobile: device.mobile,
    hasTouch: device.mobile,
    // The sandbox's own locale can be one Intl rejects ("en-US@posix"), which
    // takes the whole list screen down; a device always has a real one.
    locale: "en-US",
    colorScheme: theme.colorScheme,
    reducedMotion: args.motion ? "no-preference" : "reduce",
  });
  const seed = seedSettings({ ...theme.settings, ...variant.settings });
  await context.addInitScript(seed.script, seed.arg);
  const runSeed = seedRun(
    String(args.state ?? "running"),
    Number(args.at ?? 0.42),
  );
  await context.addInitScript(runSeed.script, runSeed.arg);
  const page = await context.newPage();
  page.setDefaultTimeout(timeout);
  page.on("pageerror", (e) => errors.push(String(e.message ?? e)));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  const result = { ...shot, file, errors };
  try {
    await page.goto(base, { waitUntil: "domcontentloaded" });
    if (!args.motion) await page.addStyleTag({ content: NO_MOTION });
    await ready(page);
    await screen.stage(
      page,
      helpers(page, device, { ready, seed: seedSettings, seedRun }),
    );
    await release(page);
    await page.screenshot({ path: file, type: "png" });
  } catch (error) {
    result.error = String(error?.message ?? error)
      .split("\n")
      .slice(0, 3)
      .join("\n");
    // Whatever was on screen when it went wrong, for the diagnosis.
    await page
      .screenshot({ path: file.replace(/\.png$/, ".failed.png"), type: "png" })
      .catch(() => {});
    result.file = null;
  } finally {
    await context.close();
  }
  result.ms = Date.now() - started;
  return result;
}

const queue = [...matrix];
const results = [];
await Promise.all(
  Array.from({ length: Math.min(jobs, queue.length) }, async () => {
    for (let shot = queue.shift(); shot; shot = queue.shift())
      results.push(await shoot(shot));
  }),
);
const shotsMs = Date.now() - t0;

// ---- the sheets ------------------------------------------------------------

const catalogue = {
  device: DEVICES,
  theme: THEMES,
  variant: variants,
  screen: SCREENS,
};
const chosen = {
  device: devices,
  theme: themes,
  variant: variantIds,
  screen: screens,
};
const sheets = [];
if (wantSheet) {
  const rowFacets = FACETS.filter((f) => f !== groupBy && f !== colsBy);
  for (const group of chosen[groupBy]) {
    const inGroup = results.filter((r) => r[groupBy] === group);
    const rowKey = (r) => rowFacets.map((f) => r[f]).join("/");
    const rows = [];
    for (const r of inGroup) {
      const id = rowKey(r);
      if (!rows.some((row) => row.id === id)) {
        rows.push({
          id,
          label:
            rowFacets.map((f) => catalogue[f][r[f]].label).join(" · ") || "—",
        });
      }
    }
    const cols = chosen[colsBy].map((id) => ({
      id,
      label: catalogue[colsBy][id].label,
    }));
    const out = join(outDir, `sheet-${group}.png`);
    const g = catalogue[groupBy][group];
    await composeSheet(browser, {
      title: `${g.label} — ${groupBy} ${group}`,
      meta: [
        g.width ? `${g.width}×${g.height} @${scale}x, ${g.shape} shell` : null,
        `${inGroup.length} shots`,
        new Date().toISOString().slice(0, 16).replace("T", " "),
      ]
        .filter(Boolean)
        .join(" · "),
      cols,
      rows,
      cell: (rowId, colId) => {
        const r = inGroup.find(
          (x) => rowKey(x) === rowId && x[colsBy] === colId,
        );
        if (!r) return undefined;
        if (r.error) return { error: r.error };
        const d = DEVICES[r.device];
        return {
          path: r.file,
          caption: `${r.device} · ${d.width}×${d.height} · ${r.theme}${r.variant === "default" ? "" : `+${r.variant}`} · ${r.screen}`,
        };
      },
      cellWidth: Math.max(
        ...inGroup.map((r) => cellWidthFor(DEVICES[r.device])),
      ),
      wrap,
      out,
    });
    sheets.push(out);
  }
}

await browser.close();
await server?.close();

// ---- the report ------------------------------------------------------------

const manifest = {
  base,
  scale,
  startedAt: new Date(t0).toISOString(),
  shots: results,
  sheets,
};
if (wantSheet)
  writeFileSync(
    join(outDir, "manifest.json"),
    JSON.stringify(manifest, null, 2),
  );

const failed = results.filter((r) => r.error);
const noisy = results.filter((r) => r.errors.length);
console.log(
  `${results.length - failed.length}/${results.length} shots in ${shotsMs} ms (${Date.now() - t0} ms with sheets), ${Math.min(jobs, results.length)} at a time`,
);
for (const s of sheets) console.log(`sheet  ${s}`);
if (singleFile) console.log(`shot   ${singleFile}`);
else if (!wantSheet || single)
  for (const r of results)
    if (r.file) console.log(`shot   ${r.file}`);
    else console.log(`shots  ${outDir}/<device>/<theme>/<screen>.png`);
for (const r of failed)
  console.log(`FAILED ${r.device}/${r.theme}/${r.screen}: ${r.error}`);
for (const r of noisy)
  console.log(
    `page errors in ${r.device}/${r.theme}/${r.screen}: ${[...new Set(r.errors)].join(" | ")}`,
  );
process.exit(failed.length ? 1 : 0);
