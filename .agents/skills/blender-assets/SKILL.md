---
name: blender-assets
description: "Use when the hourglass's frames or glasses are to be MODELLED IN BLENDER off the app's own data — a better plate, post, finial or glass, a new top or glass shape's sprites, a photographed surface swapped, or the sand's grain — for the sprites paint.ts composites the flat picture from (the preset cards and the no-WebGL fallback; the 3D stage builds its own parts from look.ts and takes only the grain). Owns `make blender` (`scripts/blender.mjs`, the driver), the Blender shelf (`scripts/blender/lib.py`: materials from CC0 textures, lathes, boxes, the app's own light and camera, the cropped sprite render), the builder (`scripts/blender/hourglass.py`), THE MODELS IN THE APP (`public/models/` and its manifest, `src/app/sprites.ts`, the composite in `paint.ts` and `paintGlass.ts`, the painter's own drawing as the fallback), the texture sources and their licence, installing Blender headless, and what a photographed reference may and may not become."
---

# Blender assets

**Where the sprites are used.** The glass on the screen is drawn in 3D by
three.js (`src/app/render/stage.ts`), and its frame and glass are built
there straight from `look.ts` and `glass.ts` (`render/parts.ts`: lathes,
boxes and physical materials) — no sprite is involved. The sprites made
here serve the **flat picture**: the preset cards in Settings (each a
still `MiniGlass`) and the fallback the app paints where WebGL cannot
start. `useSprites(look, enabled)` loads them only when the flat painter is
in use. The one file the 3D stage does take from this pipeline is the
photographed grain, `public/models/grain.png`, as the sand's bump.

In the flat picture the app draws its **plates, posts, finials and the
light on the glass from sprites made here** — committed under
`public/models/` by `make blender` — and draws the sand, the stream, the
tint and the shadows itself, because those move. Where a sprite is missing
or has not loaded yet, the painter draws its own plate, post, finial and
glass light, so the picture is never empty and the build never depends on
Blender. The sprites are the better flat picture: a real photographed
walnut, a turned brass baluster lit by the same light the sand is lit by, a
glass whose reflections were traced rather than guessed.

Three rules make that possible, and every step below serves one of them:

1. **A model is built off the app's data, never off numbers of its own.**
   The driver hands Blender the very tables the painter reads — every
   top's spec (`TOP`), every glass's profile as `glass.ts` interpolates it
   and as `layoutOf` sizes the frame to it, even the spindle's turning
   (`balusterWidth`) — as one JSON file. A modelled plate therefore stands
   where `paintPlate` would have drawn it, and when a spec moves the
   sprite moves with it on the next run. A hand-typed dimension in the
   builder is the drift this rules out.
2. **The camera and the light are the flat painter's.** `lib.py`'s
   `camera()` is `scene.ts`'s orthographic view (`PITCH`, `YAW`) and `studio()` its
   `LIGHT`, so a sprite lands on the canvas by a scale and an offset and
   is lit as the sand beside it is lit. A sprite is a picture in SCREEN
   space; the manifest says where its top-left corner is in units of the
   hourglass's height from the waist.
3. **The lab's stills are not committed; the app's sprites are.** Quick
   passes go to the gitignored `previews/blender/`; `make blender` with no
   `--out` publishes to `public/models/`, and those files and the
   manifest are committed with the change that made them.

**Before starting, read this skill's lessons** (this skill's `.lessons/`
if any exist) and `docs/design.md`, which is the reasoning the models
follow.

## Where everything lives

| Piece                               | Role                                                                                                                                                                                                                                                                                                                                                                                                   |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `scripts/blender.mjs`               | THE DRIVER (`make blender`): fetches the CC0 textures into `.cache/textures/` once, writes each job's JSON (a top with its layouts against every glass, a glass's sampled profile, the grain), runs the builder under Blender, and merges what it wrote into `public/models/manifest.json`. `--top <id>`, `--glass <id>`, `--grain`, `--samples`, `--ppu`, `--out`                                     |
| `scripts/blender/lib.py`            | THE SHELF: the scene, `mat` (a plain surface, or glass), `tex_mat` (a photographed one: colour, roughness, normal, metalness maps, tinted by `tone`), `turn` (a solid of revolution off an `(r, z)` profile — a plate, a spindle, a finial, the bulbs), `box`, `cyl`, `studio` (the app's light), `camera` (the app's camera), `sprite` (one part rendered alone, cropped to where it lands, recorded) |
| `scripts/blender/hourglass.py`      | THE BUILDER: a TOP job (a plate per glass, the post — two for bands — and the finial), a GLASS job (the two bulbs as one hollow solid over a solid core, in an `add` pass and a `multiply` pass), a GRAIN job (the photographed sand's high-pass as a tile)                                                                                                                                            |
| `public/models/`                    | THE SPRITES and `manifest.json`: `<top>-plate-<glass>.webp`, `<top>-post.webp` (`-post-a`/`-post-b` for bands), `<top>-finial.webp`, `<glass>-add.webp`, `<glass>-multiply.webp`, `grain.png`. Committed                                                                                                                                                                                               |
| `src/app/sprites.ts`                | THE LOADER: the manifest fetched once, each picture once, `useSprites(look, enabled)` for what a look is drawn with, only while the flat painter is in use — null until loaded, null for good where a build ships no models                                                                                                                                                                            |
| `src/app/render/stage.ts`           | THE 3D STAGE: takes `grain.png` as the sand's bump map and nothing else from here; its frame and glass are `render/parts.ts`'s, built off `look.ts`                                                                                                                                                                                                                                                    |
| `src/app/paint.ts`, `paintGlass.ts` | THE COMPOSITE (the flat picture only): `drawSprite` / `drawSpriteAt` (a post or a finial moved to each place by the difference of two projections), the plate drawn twice (the top one lifted by the glass and a plate), the glass's `multiply` then `add` over the sand; the painter's own drawing on every branch where a sprite is missing                                                          |
| `.cache/textures/`                  | The photographed surfaces, fetched, never committed (CC0 — ambientCG); `TEXTURES` in the driver says which asset each top wears                                                                                                                                                                                                                                                                        |
| `previews/blender/`                 | Quick passes, gitignored                                                                                                                                                                                                                                                                                                                                                                               |

## The loop

1. **Look at what the app draws first**: the flat picture is what the
   sprites change, so look at the preset cards —
   `make shots ARGS="--screen settings --device phone"` — with the sprites
   removed (`rm -rf public/models` in a scratch branch, or `--out
previews/blender` for the new ones). The painter's own picture is the
   bar a model has to clear, and the fallback a reader without WebGL sees.
   (The `screenshot` skill's Chromium has WebGL, on SwiftShader, so its
   glass screens show the 3D stage, not the sprites.)
2. **Get references — locally.** A photograph of a real hourglass of the
   kind (a wooden thirty-minute glass, a ship's glass in brass). It goes
   in the session's scratchpad ONLY: never under the tree, never in an
   artifact, never named — not the maker, not the shop. Refer to it as "a
   wooden thirty-minute glass". `docs/design.md` carries the one set of
   measurements the shapes were taken from.
3. **Iterate fast at low resolution**, one top or one glass, few samples:
   `make blender ARGS="--top walnut --samples 16 --ppu 800 --out previews/blender"`
   — seconds a part on four cores. Compose and READ the sprites (the
   driver prints each one's file and place; a short PIL script over the
   manifest lays them out the way the painter will).
4. **Then the app**: `make blender ARGS="--top walnut"` (into
   `public/models/`), `make shots ARGS="--theme both --screen settings"` —
   the cards. The glass's two passes are judged over the sand, on both
   pages, and the plate against the painter's own on the shot beside it.
5. **Then everything**: `make blender` — every top, every glass, the grain
   — at the shipping resolution and samples, then `make shots
ARGS="--theme both --screen settings --device phone,desktop"`, every
   preset card in Settings; and, if the grain changed, `make shots
ARGS="--variant presets --screen glass"` for the 3D sand it bumps.
6. **Report** before and after with the pictures.

## The frame

The app's unit (the whole height is 1), the waist at the origin. The app's
x is Blender's x, the app's y (up) is Blender's z, the app's z (towards the
viewer) is Blender's −y. `camera()` stands where `project()` looks from:
pitched `PITCH` above the waist, yawed `YAW` round to the right — and
`sprite()` records each render's crop as the app's screen units, x right, y
down, from the waist. A part the app places more than once (a post, a
finial) is rendered at one place and carries `at`, the world point it stood
at, so `drawSpriteAt` shifts it to each post by the difference of the two
projections; being orthographic, the picture is the same at every place.

The painter's camera can LEAN — the turn animation reverses its pitch and
yaw as the picture turns — and a sprite cannot; for the half second of a
turn the plates keep their faces. Do not try to bake the lean.

## The two glass passes

What is inside the glass — the sand, the tint, the posts seen through the
back wall — is the app's to paint, so the glass sprite may carry nothing but
the front wall. A holdout inside the bulbs does not do it: a ray that has
refracted through glass and then meets a holdout is black, not transparent,
so the whole wall came out as an opaque grey band. Instead the bulbs are
rendered TWICE over a solid core standing in for the sand — the highlights
over a black world and a black core (`add`, which the app draws with
`lighter`: nothing where there is no light) and the darkening over a white
world and a white core (`multiply`: nothing where the glass takes nothing
away). Both are neutral outside the glass, so neither needs a clip, and
both hold on a light page as on a dark one, which is why the painter's
`glassLight` and its `light` flag are not needed once they load.

## Materials

Photographed surfaces are ambientCG's (CC0 — no attribution required, and
none is given in the app; the driver's header says where they came from).
A wood is its colour map multiplied by the top's own face colour taken
halfway to white (`warm`), so a walnut reads walnut and a pine pine on the
same photograph of grain; a metal is its maps with metalness 1 and the
face colour as a tint; lacquer and glass are plain Principled surfaces. A
new top that wants a photograph adds its asset id to `TEXTURES` in the
driver and, if it is not a wood or a metal, a branch in `plate_material`.

## Blender, headless

`pip install bpy` (Python 3.11 for Blender 5.0) gives `python3` the
`bpy` module, which is how a web session and CI would run it; the driver
looks for that first, then `BLENDER`, then `blender` on the PATH (the
release tarball on Linux, the app on macOS, run with
`--python-use-system-env` and `PYTHONDONTWRITEBYTECODE=1`). Cycles on the
CPU: seconds a part at 16 samples and 800 pixels a unit, under a minute
at the shipping 48 and 1400. The grain job needs `numpy`, which Blender's
own Python has and a bare `bpy` install may not (`pip install numpy`).

**API traps met (5.x):** `use_nodes` is deprecated (set it in a `try`);
Principled inputs are `Coat Weight`, `Transmission Weight`; the RGBA Mix
node's colours are inputs 6 and 7 and its result output 2; a part just
made has no world matrix until `bpy.context.view_layer.update()` — read
its vertices before that and the crop lands on the origin, and the sprite
is empty; a render border is fractions of the frame with y UP, and the
crop's size is the border rounded to pixels, so round the pixels first;
WebP with alpha is written by Cycles directly (`file_format = "WEBP"`).

## Adding a top or a glass

Nothing here is added by hand: a new id in `look.ts` is a new job the
next `make blender` runs (the driver reads `TOPS` and `GLASSES`), and the
loader asks the manifest by id. What the new top wears is `TEXTURES`'s
row; what its posts and finials are is `hourglass.py`'s branches on
`post`, `finial` and `finish` — a new post style or finial shape is a new
branch there, modelled off the spec's radii, and drawn by the painter's
own fallback too (`paint.ts`), never by the sprite alone.

## Update checklist

- [ ] The builder reads a number from the JSON, never types one; a new
      number is a new field the driver takes from `look.ts` / `glass.ts`
- [ ] The quick pass composed and read; the app's shot beside the
      painter's own
- [ ] `make blender` into `public/models/`; the manifest lists every top
      and every glass; the sprites' sizes are sane (`du -sh public/models`)
- [ ] `make shots ARGS="--theme both --screen settings"` — the plates, the
      posts, the finials and the glass on both pages, on the preset cards;
      `--variant presets --screen glass` too if the grain changed
- [ ] Docs: `docs/design.md` (the modelled parts), this skill's tables if
      a piece moved
- [ ] A changelog fragment when the picture changed
- [ ] Record the marker:

      git rev-parse HEAD > .agents/skills/blender-assets/.last-updated

## Verification

1. `make lint && make test && make fmt-check` pass; `tests/sprites_test.ts`
   holds the manifest to every top and glass in `look.ts`.
2. With `public/models` removed the app still draws every preset card (the
   painter's own fallback) and the 3D sand draws smooth —
   `make shots ARGS="--screen settings,glass"` in a scratch copy.
3. No reference photograph, maker or shop is named anywhere in the tree,
   the commit or the PR.

## Skill self-improvement

Load `skill-reflection`'s idea before a session that used this skill
commits: a Blender trap met, a material that read (or failed to), a
resolution or sample count measured, a part added — record it here or as a
lesson fragment under `.lessons/`.
