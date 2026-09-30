#!/usr/bin/env node
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE BLENDER LAB — the hourglass's frames and glasses MODELLED in Blender
// off the app's own data (`look.ts`'s specs and `glass.ts`'s layouts) and
// photographed by the app's own camera onto transparent frames: the
// sprites `paint.ts` composites the picture from, under `public/models/`,
// and the manifest that says where each one lands.
//
// It never restates the app: every top's spec, every glass's profile as the
// app interpolates it, every frame's layout and even the spindle's turning
// (`balusterWidth`) are handed to Blender as one JSON file, and the builder
// under `scripts/blender/` models the parts from them in the app's own
// frame. So a plate stands exactly where `paint.ts` would have drawn it,
// and a rendered sprite lands on the canvas by a scale and an offset.
//
//   node scripts/blender.mjs                       every top and every glass
//   node scripts/blender.mjs --top walnut          one frame (every glass's plate)
//   node scripts/blender.mjs --glass sphere        one glass's overlays
//   node scripts/blender.mjs --grain               the sand's grain tile
//   node scripts/blender.mjs --samples 16 --ppu 800 --out previews/blender   a quick look
//
// The materials are photographed surfaces from ambientCG (CC0), fetched
// into `.cache/textures/` the first time and never committed; `TEXTURES`
// below is which. Blender is looked for as the `bpy` module of `python3`
// (`pip install bpy`), then at `BLENDER`, then as `blender` on the PATH.
// Nothing here runs in the app: the app fetches nothing and ships the
// sprites like any other file under `public/`.

import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";

import { layoutOf } from "../src/app/glass.ts";
import {
  GLASS,
  GLASSES,
  LOOK_PRESET,
  LOOK_PRESETS,
  SAND,
  TOP,
  TOPS,
} from "../src/app/look.ts";
import { balusterWidth } from "../src/app/paint.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

/** The photographed surface each top is dressed in (an ambientCG asset id),
 *  and the one the sand's grain is cut from. A top with none is a plain
 *  material — lacquer, glass. */
const TEXTURES = {
  walnut: "Wood051",
  oak: "Wood092",
  pine: "Wood095",
  ebony: null,
  brass: "Metal048A",
  copper: "Metal047A",
  steel: "Metal009",
  bare: null,
  sand: "Ground093C",
};

const args = parseArgs(process.argv.slice(2));
const out = resolve(root, args.out ?? "public/models");
const cache = resolve(root, ".cache/textures");
const samples = Number(args.samples ?? 48);
const ppu = Number(args.ppu ?? 1600);
const only = args.top || args.glass || args.grain;
const tops = args.top ? [args.top] : only ? [] : [...TOPS];
const glasses = args.glass ? [args.glass] : only ? [] : [...GLASSES];
const grain = args.grain || !only;
for (const t of tops) if (!TOPS.includes(t)) fail(`unknown top "${t}"`);
for (const g of glasses) if (!GLASSES.includes(g)) fail(`unknown glass "${g}"`);

mkdirSync(out, { recursive: true });
mkdirSync(cache, { recursive: true });

// ── The textures ──

for (const id of new Set(Object.values(TEXTURES).filter(Boolean))) {
  const dir = join(cache, id);
  if (existsSync(dir) && readdirSync(dir).some((f) => f.endsWith("_Color.jpg")))
    continue;
  console.log(`fetching ${id} from ambientCG (CC0)…`);
  const zip = join(cache, `${id}.zip`);
  const res = await fetch(`https://ambientcg.com/get?file=${id}_1K-JPG.zip`);
  if (!res.ok) fail(`could not fetch ${id}: ${res.status}`);
  writeFileSync(zip, Buffer.from(await res.arrayBuffer()));
  mkdirSync(dir, { recursive: true });
  const unzip = spawnSync("unzip", ["-qo", zip, "-d", dir], {
    stdio: "inherit",
  });
  if (unzip.status !== 0) fail(`could not unzip ${id}`);
  rmSync(zip);
}

// ── The data ──

/** One glass's profile as the app interpolates it, sampled up the bulb. */
function glassData(id) {
  const spec = GLASS[id];
  const look = { top: "walnut", glass: id, sand: "quartz" };
  const bulb = layoutOf(look).bulb;
  const n = 96;
  const radius = [];
  for (let k = 0; k <= n; k++) {
    const s = (bulb.height * k) / n;
    radius.push(bulb.radiusAt(s));
  }
  return {
    id,
    spec,
    height: bulb.height,
    foot: bulb.foot,
    bore: bulb.bore,
    radius,
  };
}

/** One top's spec, its texture, and its layout against every glass. */
function topData(id) {
  const spec = TOP[id];
  const layouts = {};
  for (const g of GLASSES) {
    const l = layoutOf({ top: id, glass: g, sand: "quartz" });
    layouts[g] = {
      reach: l.reach,
      thick: l.thick,
      postAt: l.postAt,
      height: l.bulb.height,
      foot: l.bulb.foot,
    };
  }
  // The glass the top is shown with in Settings: its preset's, or the
  // first that wears it.
  const preset = LOOK_PRESETS.find((p) => LOOK_PRESET[p].top === id);
  const shown = preset ? LOOK_PRESET[preset].glass : GLASSES[0];
  const baluster = [];
  for (let k = 0; k <= 80; k++) baluster.push(balusterWidth(k / 80));
  return {
    id,
    spec,
    texture: TEXTURES[id] ? join(cache, TEXTURES[id]) : null,
    layouts,
    shown,
    baluster,
    glass: glassData(shown),
  };
}

// ── Blender ──

const python = spawnSync("python3", ["-c", "import bpy"], { stdio: "ignore" });
const blender =
  python.status === 0
    ? ["python3"]
    : [
        [
          process.env.BLENDER,
          "/Applications/Blender.app/Contents/MacOS/Blender",
        ].find((c) => c && existsSync(c)) ?? "blender",
        "-b",
        "--factory-startup",
        "--python-use-system-env",
        "--python-exit-code",
        "1",
        "-P",
      ];

const manifestPath = join(out, "manifest.json");
const manifest = existsSync(manifestPath)
  ? JSON.parse(readFileSync(manifestPath, "utf8"))
  : { version: 1, ppu, tops: {}, glasses: {} };
manifest.ppu = ppu;

function run(job) {
  const data = join(out, `.${job.kind}-${job.id}.json`);
  writeFileSync(data, JSON.stringify({ ...job, ppu, sand: SAND }, null, 2));
  const t0 = Date.now();
  const script = join(root, "scripts", "blender", "hourglass.py");
  const cmd =
    blender[0] === "python3"
      ? ["python3", [script, "--", data, out, String(samples)]]
      : [
          blender[0],
          [...blender.slice(1), script, "--", data, out, String(samples)],
        ];
  const r = spawnSync(cmd[0], cmd[1], {
    cwd: root,
    env: { ...process.env, PYTHONDONTWRITEBYTECODE: "1" },
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  const lines = (r.stdout ?? "").split("\n");
  for (const l of lines)
    if (/^(SPRITE|WROTE|TRACEBACK|ERROR)/.test(l)) console.log("  " + l);
  if (r.status !== 0) {
    console.error(r.stderr?.split("\n").slice(-30).join("\n"));
    fail(`${job.kind} ${job.id} failed`);
  }
  const result = JSON.parse(
    readFileSync(join(out, `.${job.kind}-${job.id}.result.json`), "utf8"),
  );
  rmSync(data);
  rmSync(join(out, `.${job.kind}-${job.id}.result.json`));
  console.log(
    `${job.kind} ${job.id}: ${Object.keys(result).length} sprites in ${((Date.now() - t0) / 1000).toFixed(0)} s`,
  );
  return result;
}

for (const id of tops) manifest.tops[id] = run({ kind: "top", ...topData(id) });
for (const id of glasses)
  manifest.glasses[id] = run({ kind: "glass", ...glassData(id) });
if (grain)
  manifest.grain = run({
    kind: "grain",
    id: "sand",
    texture: join(cache, TEXTURES.sand),
  });
writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
console.log(`manifest: ${manifestPath}`);

// ── The machinery ──

function parseArgs(argv) {
  const o = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) fail(`unexpected argument: ${a}`);
    const key = a.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith("--")) o[key] = true;
    else {
      o[key] = next;
      i++;
    }
  }
  return o;
}

function fail(message) {
  console.error(message);
  process.exit(2);
}
