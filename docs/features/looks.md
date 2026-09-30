# The looks

Under **Settings → The hourglass**: ten hourglasses, and **Custom**, which
puts one together piece by piece. A look changes what the glass is made of
and nothing about how it runs — the same length is the same time in any of
them, and the only behaviour a look carries is its sand's angle of repose.

Every card is a still of the glass it picks, part way through a run, so the
choice previews itself. The cards are painted flat; the glass on the screen
is the same look in three dimensions.

## The presets

Named for where you would find one, never for who made one.

| Preset       | The frame                  | The glass | The sand   |
| ------------ | -------------------------- | --------- | ---------- |
| **Study**    | Walnut and black steel     | Teardrop  | Quartz     |
| **Harbor**   | Turned brass               | Sphere    | White      |
| **Midnight** | Black lacquer, a gold line | Slim      | Black      |
| **Desert**   | Copper                     | Bell      | Red        |
| **Glacier**  | Brushed steel              | Cone      | Blue beads |
| **Nordic**   | Blonde pine                | Sphere    | Black      |
| **Library**  | Turned oak                 | Antique   | Quartz     |
| **Loft**     | None — a bare glass        | Cone      | White      |
| **Meadow**   | Oak                        | Teardrop  | Green      |
| **Treasure** | Brass                      | Bell      | Gold       |

Study is the default: the measured glass in the frame it was measured in.

## Custom

The eleventh card opens the glass up piece by piece. It starts from the
preset you were looking at, so changing one thing about a preset is two taps,
and it is kept: going back to a preset and then to Custom again finds the
custom glass as it was left.

- **The frame.** Eight: **Walnut** (square plates, four black steel posts,
  acorn nuts), **Oak** (round turned plates, three turned spindles), **Pine**
  (square blonde plates, four pale dowels), **Ebony** (round black lacquer
  with a gold line, four slim brass posts with a ball on each), **Brass**
  (round turned plates, three balusters), **Copper** (round plates, three
  rods with a ball on each), **Steel** (square brushed plates, two flat
  bands on the diagonal), and **None** — the glass stands on its own thick
  ground ends. A frame follows the glass: its posts stand a finger's width
  clear of the bulb at its widest, whatever the shape.
- **The glass.** Six: **Teardrop** (a dome to the widest point a third of
  the way up, then a long taper to the waist — the measured shape),
  **Sphere** (two near-spheres and a short waist, the blown shape), **Cone**
  (two cones tip to tip, thick-walled and straight-sided), **Slim** (tall
  and narrow, in smoked grey glass), **Antique** (old glass with a faint
  green in it and a longer collar at the waist), and **Bell** (flat, wide
  ends that curve straight into the waist).
- **The sand.** Eight: **Quartz**, **White**, **Black**, **Red**, **Blue**
  (glass beads), **Gold**, **Rose** and **Green**. Each piles at its own
  angle — the beads flattest, black sand steepest — which is what shapes the
  funnel and the cone, and each has its own grain: coarse for the beads, fine
  for the rest, with a sparkle in the gold and the quartz.

Every combination is drawable: the geometry sizes the frame to the glass, and
the sand's model does not care what it is in.

## Adding one

A new frame, glass, sand or preset is a row in the tables in
`src/app/look.ts`, a name in `src/app/i18n/en.ts`, and a look at the result
with the `screenshot` skill — `make shots ARGS="--variant presets --screen
glass"` for every preset side by side, or `--settings
'{"preset":"custom","custom":{"top":"steel","glass":"bell","sand":"blue"}}'`
for one combination. The `add-hourglass-look` skill under `.agents/skills/` is
the procedure, and it keeps makers' names and trademarked features out: a
look is named for where you would find one.
