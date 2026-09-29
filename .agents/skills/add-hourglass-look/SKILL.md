---
name: add-hourglass-look
description: "Use when asked for a new hourglass, frame, glass shape, sand or preset — often from a photograph of a real hourglass. Walks the vocabulary in look.ts, the geometry in glass.ts and the paint in paint*.ts, keeps the name and the design free of any maker's trademarks, and photographs the result."
---

# Add an hourglass look

The glass on the screen is drawn from a _vocabulary_: every top, glass, sand
and preset is an id and a spec in `src/app/look.ts`, sized by the pure
geometry in `src/app/glass.ts`, painted once in `src/app/paint.ts`,
`paintGlass.ts` and `paintSand.ts`, and offered piece by piece under Custom in
`src/app/HourglassPicker.tsx`. A new look is an entry in each of those, in that
order — never a special case in a screen. This skill is the procedure, and the
things a real hourglass taught us that are not obvious from the code.

## When to run

- Someone asks for a new hourglass, frame, glass shape, sand or preset — with
  or without a photograph to work from.
- An option is to be offered under Custom that today only a preset has.
- Not for the timer, the size or the two themes: those are settings with
  their own tables, and none of them is part of a look.

## Tracking mechanism

`.agents/skills/add-hourglass-look/.last-updated` holds the commit this skill
last ran against. It is a per-change playbook rather than a periodic sync, so
the marker is a record of the last look added; the diff since it is what to
read first, because that is where the vocabulary last grew.

## Discovery process

1. Read the vocabulary as it stands, and what the last look added to it:

   ```sh
   BASELINE=$(cat .agents/skills/add-hourglass-look/.last-updated 2>/dev/null)
   git log --oneline "${BASELINE:-$(git rev-list --max-parents=0 HEAD)}"..HEAD -- src/app/look.ts src/app/glass.ts src/app/paint.ts src/app/paintGlass.ts src/app/paintSand.ts
   grep -n "^export const TOP\|^export const GLASS\|^export const SAND\|^export const LOOK_PRESET\|^export type" src/app/look.ts
   grep -n "^export function layoutOf\|POST_CLEARANCE\|POST_INSET" src/app/glass.ts
   ```

2. Read the hourglass, not its name. From a photograph, write down what it
   _is made of_ before touching code — each of these is one dimension of
   `Look`, and an hourglass that needs a dimension the vocabulary lacks is
   the moment to add one, as a table, rather than to special-case a preset:

   | On the hourglass                                                         | Dimension | Table   |
   | ------------------------------------------------------------------------ | --------- | ------- |
   | The plates: square or round, their thickness, wood or metal, the finials | `top`     | `TOP`   |
   | The posts: how many, rods or balusters or bands, how far in              | `top`     | `TOP`   |
   | The bulb's profile, the tint of the glass, the wall, the foot, the waist | `glass`   | `GLASS` |
   | The sand's colour, how steeply it piles, how coarse it is, its sparkle   | `sand`    | `SAND`  |

   Measure the profile as `[t, r]` points — `t` up the bulb from the plate,
   `r` the radius as a share of the widest — from a photograph taken square
   on, and read `docs/design.md` for the reference glass's numbers. The one
   thing a cartoon gets wrong is where the widest point sits: low, about a
   third of the way up, not in the middle.

3. Decide what is new. Most looks are a new _preset_ over existing options.
   Some need one new option in one table (a glass shape, a sand). Rarely one
   needs a new dimension. Add the smallest thing.

## Brand names and trademarked features

A look is named for where you would find one — a room, a place, a landscape
— **never for the hourglass or the maker it was drawn from**, and neither
name goes anywhere: not the preset id, not the strings in `en.ts`, not a
comment, not the commit message, not the PR title or body, not the changelog
fragment. Presets so far: study, harbor, midnight, desert, glacier, nordic,
library, loft, meadow, treasure. Say "the ship's glass", "a wooden thirty-minute
glass", "a Victorian brass one" — the _kind_, which nobody owns.

The same goes for the design. Take the _generic_ parts — turned wood, a brass
baluster, a teardrop bulb, an acorn nut, coloured sand — which are centuries of
common making. Do not copy the parts that identify one maker:

- A maker's logo, monogram, stamp or engraving, or any lettering.
- A distinctive frame that _is_ the brand — a patented stand, a named
  silhouette, a signature finial. `TOP` is a dimension, but only for shapes
  every workshop has made: a rod, a baluster, a band, a ball, an acorn.
- A trademarked colour pairing or a named sand.
- Any wording from the maker's marketing in the preset's hint or the docs.

If the request is "make it look like this one", the answer is the generic
hourglass underneath it: the plate shape, the post style, the bulb profile,
the sand. That is what the vocabulary can say, and it is all the app should.

## Mapping

| To add                                    | Change                                                                                                                                                                                                                                                                                |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A preset                                  | `LookPreset`, `LOOK_PRESETS`, `LOOK_PRESET` in `look.ts`; `settings.preset.<id>` and `settings.presetHint.<id>` in `en.ts`; the presets table in `docs/features/looks.md`; the count in `tests/look_test.ts` and the "ten" wording in `AGENTS.md`, the README and `en.ts`'s hint      |
| A top                                     | `Top`, `TOPS`, `TOP` (plate, thick, reach, finish, colours, posts, postR, postStyle, finial) in `look.ts`; `settings.tops.<id>`, `settings.topHint.<id>` in `en.ts`; the frame list in `looks.md`; a new `postStyle` or `finial` is drawn in `paint.ts`'s `paintPost` / `paintFinial` |
| A glass                                   | `Glass`, `GLASSES`, `GLASS` (profile points, tint, wall, foot, waist) in `look.ts`; `settings.shapes.<id>`, `settings.shapeHint.<id>` in `en.ts`; the glass list in `looks.md`; `tests/glass_test.ts` walks every glass against every top for post clearance                          |
| A sand                                    | `Sand`, `SANDS`, `SAND` (color, dark, light, repose, grain, sparkle) in `look.ts`; `settings.sands.<id>` in `en.ts`; the sand list in `looks.md`; `tests/sand_test.ts` checks a settled heap against every sand's repose                                                              |
| A new dimension of `Look`                 | The type and its table in `look.ts`; a value on every preset; `clampLook` with a fallback for a look stored before it; chips under Custom in `HourglassPicker.tsx`; `tests/settings_test.ts` for the fallback; `looks.md`'s Custom list                                               |
| The picture on the preset card            | Nothing — the card is a `MiniGlass` at `SHOWROOM` in `HourglassPicker.tsx`, so a preset previews itself                                                                                                                                                                               |
| A user-visible change of any of the above | A fragment under `.changes/unreleased/` (see `write-changeset`)                                                                                                                                                                                                                       |

## What the geometry has to hold

`layoutOf` in `glass.ts` sizes the frame to the glass, and
`tests/glass_test.ts` walks _every_ top against _every_ glass to assert that
the posts clear the bulb at its widest by `POST_CLEARANCE`, and that a frame
with no posts still reaches past the foot. So a new glass's profile must be
monotone where it needs to be — the interpolation never overshoots a point,
but a point placed wider than the widest one _becomes_ the widest one — and a
new top's `reach` is a minimum the layout may widen, never a promise.

The sand's model needs the profile read the other way round: `taper` (the
height at a radius on the waist side of the widest point) and `dome` (the
same on the plate side) both assume one widest point. A profile with two
bulges per bulb is not a glass this model can fill.

## Looking at it

A look is judged by eye, and `scripts/glass-shots.mjs` is how: it serves the
production build headless, seeds a run in a state and photographs the glass —
and lays more than one picture out on a contact sheet, `shots/sheet.png`, a
row per look and a column per state. `make shots ARGS="…"` builds first and
passes the options through. The ones that matter here:

```sh
make shots ARGS="--preset <id> --state full,running,done"          # the new preset, every state
make shots ARGS="--preset all"                                     # every preset beside it
make shots ARGS="--preset <id> --shell phone,desk --theme dark,light"
make shots ARGS="--look '{\"top\":\"steel\",\"glass\":\"bell\"}'"     # a custom combination
make shots ARGS="--preset <id> --settings"                         # the picker, with the new card
make shots ARGS="--preset <id> --minutes 1,120"                    # the smallest and the biggest
make shots ARGS="--preset <id> --upside"                           # turned over by the sensor
```

Look at the sheet for: the posts clear of the glass; the funnel and the cone
reading as sand in both themes; the glass's edges reading on a light page as
much as a dark one; the stream landing on the cone's apex; the card in
Settings reading at card size. Playwright is not a dependency of the app —
the script says how to install it outside the lockfile, and finds the Chromium
a web session already has.

## Update checklist

- [ ] Name the preset for where you would find one; check the id, the
      strings, the comments, the fragment and the commit message for any
      maker's or model's name — `git diff | grep -i` for the names you were
      shown
- [ ] Add the ids and specs in `look.ts`, and every preset gets a value for
      any new dimension
- [ ] Paint it, if a new post style or finial needs drawing — the drawing
      only; colours come from the spec
- [ ] Offer it under Custom in `HourglassPicker.tsx`: a new option in an
      existing table appears by itself; a new dimension needs chips
- [ ] Clamp it in `look.ts`'s `clampLook` if it is a new dimension, with a
      fallback for a look stored before it
- [ ] Strings in `en.ts` for every new id; a hint for a preset, a top or a
      glass
- [ ] Tests: the counts and the walks in `tests/look_test.ts`; the clearance
      walk in `tests/glass_test.ts` and the repose walk in `tests/sand_test.ts`
      still pass
- [ ] Docs: `docs/features/looks.md` (the tables), `AGENTS.md`'s `look.ts`
      line, the README's What and Settings rows
- [ ] A changelog fragment
- [ ] Look at it, per "Looking at it" above: every state, both themes, both
      shells, the smallest and the biggest, and the picker
- [ ] Record the marker:

      git rev-parse HEAD > .agents/skills/add-hourglass-look/.last-updated

## Verification

1. `make lint && make test && make fmt-check` pass; the clearance walk in
   `tests/glass_test.ts` is the test that catches a frame that does not fit
   its glass.
2. `make shots ARGS="--preset all"` — every preset card still reads, and the
   new one reads in both themes and on both shells.
3. `grep -rniE "<the maker>|<the model>" src tests docs .changes README.md AGENTS.md`
   finds nothing, and neither does the commit message or the PR.
4. Under Settings → The hourglass → Custom, the new option can be combined
   with every other one without a drawing that breaks — try the extremes: the
   widest glass in the tightest frame, no frame at all, the coarsest sand at
   one minute.

## Skill self-improvement

If an hourglass needed a dimension the table above does not name, add the row
and the table it became. If a geometric rule bit you that the section above
does not state, state it. If a brand feature slipped through review, add it
to the list. Commit the skill edit with the look.
