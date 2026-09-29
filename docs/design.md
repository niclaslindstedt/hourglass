# The design

How the hourglass on the screen was drawn: where its proportions come from,
how the sand is modelled, and how the picture is lit. The code is
`src/app/glass.ts`, `sand.ts`, `scene.ts` and the three `paint*.ts` files;
this is the reasoning behind them.

## The reference

The glass was measured off a real one — a plain wooden thirty-minute
hourglass, 25 cm tall, photographed square on — rather than drawn from
memory, because the memory of an hourglass is a cartoon: two triangles. The
measurements, as shares of the whole height so they scale to any size:

| Part                                     | Measured                                | Share of the height |
| ---------------------------------------- | --------------------------------------- | ------------------- |
| The whole, plates included               | 25 cm                                   | 1.00                |
| End plates                               | 9.6 cm square, 2.2 thick                | 0.38 wide, 0.09     |
| The glass, plate to plate                | 20.6 cm                                 | 0.82                |
| One bulb                                 | 10.3 cm                                 | 0.41                |
| A bulb at its widest                     | 8.5 cm across                           | 0.34                |
| Where the widest point sits              | a third of the bulb up                  | —                   |
| The foot, where the bulb meets the plate | 5.2 cm across                           | 0.21                |
| The waist                                | 0.7 cm across, 1 cm tall                | 0.03, 0.04          |
| The bore                                 | 2–3 mm                                  | ≈ 0.01              |
| Posts                                    | 0.5 cm, 1.2 cm in from the plate's edge | 0.02, 0.05          |
| Clearance, post to bulb at its widest    | 0.6 cm                                  | 0.024               |
| Sand                                     | about 45 % of a bulb                    | —                   |
| Angle of repose                          | about 32°                               | —                   |
| The stream                               | 1.5 mm wide                             | —                   |

Two things a cartoon gets wrong and the measurements put right. The widest
point of a bulb is **low** — a third of the way up from the plate, not half
— so a bulb is a teardrop: a dome from the foot out to the widest point, a
long gentle taper inward, then a concave flare into the waist. And the
frame is tighter than it looks: the posts stand a finger's width clear of
the glass, and a frame drawn with air around it reads as a lantern.

Every glass in `look.ts` is a **profile**: a few `[t, r]` points, `t` the
height along the bulb from the plate (0) to the waist (1) and `r` the radius
as a share of the widest, which `glass.ts` runs a monotone cubic through
(Fritsch–Carlson) — so the wall passes through every point and never bulges
past one between them. The teardrop is the measured glass; the sphere, the
cone, the slim, the antique and the bell are the other shapes the same
hourglass has been blown in over the centuries, each a different set of
points and nothing else.

The frame follows the glass, not the other way round: `layoutOf` puts the
posts where the bulb's widest point plus the measured clearance says, and
widens a top's plate when its own reach would not clear the glass — a square
plate's corner posts on the diagonal, a round plate's on the radius.

## The sand

An hourglass has no clock in it. It has a volume of sand and a hole, and the
flow through a hole is the same whether there is a lot of sand above it or a
little (Beverloo's law, the thing that makes an hourglass a clock at all). So
the app keeps time and sand apart:

- **Time** is `timer.ts`: a run is when the glass was last turned and how
  much had already run through; the share through at any moment is a function
  of the wall clock, never a count of frames. A glass that has been in a
  background tab is right the first frame back.
- **Sand** is `sand.ts`: each bulb is a radial heightfield — thirty-two
  rings from the axis to the wall, each a height above the end the sand rests
  against, which is the plate in the lower bulb and the waist in the upper.
  The heights are volume-exact: a ring's volume is its area times its
  height, and the area comes from the bulb's shape read the other way round
  (`taper` and `dome` in `glass.ts`, the height at which the wall stands at a
  given radius).

Each frame, `drain` takes from the axis of the upper bulb exactly the volume
the clock says has gone, `pour` lands it on the axis of the lower, and
`relax` walks every slope steeper than the sand's angle of repose back down to
it, moving volume outward ring by ring the way a real heap sheds. That is why
the upper surface is a funnel and the lower a cone, without either being
drawn as one, and why the two heaps together always hold the sand that was
put in, to a hair. Each sand has its own angle — glass beads flattest, black
sand steepest — so the funnel and the cone are a different shape in every
preset, and it is the only thing about the sand's behaviour a look changes.
The rate, the amount and the clock are the same for all of them.

A big jump (a turn, the tab coming back) settles the heaps in one go
(`settle`), because animating a landslide nobody watched is a lie in the
other direction.

## The picture

One camera and one light. The camera is orthographic, pitched a few degrees
so the plates show their top faces and the rims of the heaps are ellipses,
and yawed a little so the posts do not hide one another. The light stands
high, to the left and slightly in front — the one light everything on the
screen is lit by, so the frame's edges, the glass's reflections, the shading
of the sand and the shadow on the table agree about where it is.

Back to front: the shadow on the table; the glow behind the glass once the
sand has run out; the bottom plate; the posts behind the glass; the glass's
back wall, with those posts seen through it, bent by the bulb's curve and
dimmed by the tint; the sand in both bulbs; the stream; the glass's front
wall; the posts in front; the top plate and its finials.

**The sand** is its heightfield turned into facets — a quad per ring per
spoke — sorted far to near and shaded by how squarely each faces the light,
darker down a funnel where the light does not reach, then covered in a grain
pattern drawn one speck to a device pixel so it is as fine on the screen as
the screen is. A few grains cling to the glass above the rim, thinning
upward, the dusting a running glass leaves on its walls. A sand that sparkles
gets a handful of specks catching the light.

**The glass** is two layers. The back wall is the tint and the bent posts.
The front wall is rendered per pixel once per size (`glassLight`): a sharp
highlight from the light, a broad one under it, a fill from the other side, a
Fresnel brightening toward the silhouette where the wall is seen edge on, and
the thicker glass of the waist — on a dark page as light, on a light page
as shadow, because a reflection on a white background is a darker edge, not
a brighter one.

**The frame** is a cylinder or a box lit by the same light, with the wood's
grain lines or the metal's sheen drawn along it; the posts are lit round
their circumference and a baluster's width follows its turning.

Nothing moves on the screen but the sand, the stream and a turn. There is no
glint travelling round the glass and no pulse in the frame: the glass's whole
argument is quiet, and one thing moving — the sand — is what says it is
running.
