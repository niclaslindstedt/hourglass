# The design

How the hourglass on the screen was drawn: where its proportions come from,
how the sand is modelled and moves, what sky it stands under, and how the
picture is lit. The code is `src/app/glass.ts`, `sand.ts`, `physics.ts`,
`astronomy.ts`, `sky.ts`, the stage under `src/app/render/`, and — for the
preset cards and the fallback — `scene.ts` and the three `paint*.ts` files;
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
little (Beverloo's law, the thing that makes an hourglass a clock at all —
and the reason a drain driven by the clock is the physically right one). So
the app keeps time and sand apart:

- **Time** is `timer.ts`: a run is when the glass was last turned and how
  much had already run through; the share through at any moment is a function
  of the wall clock, never a count of frames. A glass that has been in a
  background tab is right the first frame back.
- **Sand** is `sand.ts`: each bulb is a heightfield of cells — thirty-two
  rings from the axis to the wall, each cut into twenty-four spokes, each
  cell a height above the end the sand rests against, which is the plate in
  the lower bulb and the waist in the upper. The heights are volume-exact:
  a cell's volume is its share of the ring's area times its height, and the
  area comes from the bulb's shape read the other way round (`taper` and
  `dome` in `glass.ts`, the height at which the wall stands at a given
  radius). The spokes are what let a heap lean.

Each frame, `drain` takes from the axis of the upper bulb exactly the volume
the clock says has gone — counting the sand in the air as still in the bulb
— and `pour` lands it where the stream falls in the lower. What the sand then
_does_ is physics (`physics.ts`), and the clock is not in it: physics only
decides where the sand that is in each bulb lies. That is why the upper
surface is a funnel and the lower a cone, without either being drawn as one,
and why the two heaps together always hold the sand that was put in, to a
hair.

### Two layers

Sand is two things at once, and the model keeps both — the two-layer split
of the "shallow sand" height-field models, after Savage and Hutter's
depth-averaged avalanche equations.

**The dense layer** is the heap: the cells, and on them a thin flowing layer
about fifteen grains deep (`LAYER`, a few millimetres on a desk glass) with
momentum. Every edge between two cells carries a speed. Gravity along the
slope drives it and basal friction holds it back — the friction law
Pouliquen and Forterre measured on real layers of glass beads ("Friction law
for dense granular flows", J. Fluid Mech. 2002):

- a static layer starts to move only past its **start** angle, and a moving
  one stops only below its **stop** angle, about a degree lower
  (δ3 − δ1 = 22.2° − 21° in their fit);
- both angles depend on how deep the layer is: a layer a few grains deep
  stands steeper than a thick one, the excess fading over L = 0.65 mm
  (δ2 − δ1 = 9.7° for a vanishing layer);
- a moving layer's friction depends on its Froude number, u/√(gh): past
  β = 0.136 it is the stop friction of the depth the flow rule
  u/√(gh) = β·h/h_stop gives, so a faster flow meets more friction and a
  flow settles at a speed; under β it is carried toward the start friction
  by a power γ = 10⁻³.

Each sand's own angle of repose stands for δ1 (it is measured on a heap, a
thick layer) and the other angles keep the paper's distances from it. So
the cone under the stream grows a little past its angle, lets go in a slump
and stops a little flatter, the way a real one does; and a flat bed tilted
by less than its start angle holds, as real sand does. Each sand has its own angle — glass beads flattest,
black sand steepest — so the funnel and the cone are a different shape in
every preset, and it is the only thing about the sand's behaviour a look
changes. The rate, the amount and the clock are the same for all of them.

**The dilute layer** is the grains in the air (`Bulb.air`, up to 2,400 a
bulb): thrown up by a jerk, or falling from one end of the bulb to the other
when the glass is turned over. Each is ballistic under the gravity the glass
feels — the Earth's, less the phone's own acceleration — bounces off the
glass wall (the surface the profile describes, keeping three tenths of its
speed into it) and off the far end, and joins the heap again where it lands,
volume-exactly: a grain thrown up is taken off its cell and put back where
it comes down.

Gravity's strength is set by how tall the glass is taken to be in the world
(`GLASS_METRES`, 22 cm — a hand and a half), so a fall down a bulb takes
about as long on the screen as it would on a desk. The model is pure and
clock-free: `dt` is a parameter, and what looks like chance is a hash of a
seed.

A big jump (the tab coming back after a sleep) settles the heaps in one go
(`settle`), because animating a landslide nobody watched is a lie in the
other direction.

### Turning, tilting and shaking

The phone is the glass. `useMotion.ts` reads gravity in the phone's own
frame — x to the right of the screen, y up it, z out of it — from the
orientation angles (`deviceDown`), and which way up the glass is flips only
past a wide margin either side of level. Gravity, less the phone's own
acceleration, is taken into the glass's frame as it hangs (`intoGlass`) and
handed to both heaps (`setGravity`), which read their lean off it: to a side,
the heaps slide that way; leaned back or forward, to the back or the front
wall of the bulb. The lean is capped as a whole at seventy degrees, where a
heap would stand against the wall and a heightfield cannot say so. The
stream follows the grains (`streamPath`): they leave the bore at about
√(g·D), falling freely from the "free-fall arch" that stands about a hole's
width over an orifice, and fly under the gravity the glass feels. Upright,
that is a straight thread onto the apex. Leaned, the thread bends toward
gravity and meets the glass just under the waist. A dense granular jet
that hits a surface turns along it, its speed into the surface spent
(granular-jet impact experiments; Johnson and Gray's jets on an incline,
J. Fluid Mech. 2011). So it runs down the inside of the wall as a rivulet,
driven by gravity along the wall and held by Coulomb friction against the
push into it (`WALL_FRICTION`, 0.2: dry glass beads on clear glass measure
about 0.16, and sand's grains are a little rougher; on a smooth wall a
constant friction describes a thin granular flow well). It speeds up where
the wall is steep, and stops and piles where the wall is flatter than the
friction angle. Where it reaches the heap is where `pour` lands the sand,
so the cone grows at the heap's edge on the downhill side.

Held on its **side**, past sixty degrees, the hole is no longer fed and the
run halts, as a real glass on its side stops; stood up, it goes on from
where it was. A phone laid **flat** on a table leans its sand the full way
to the back of the bulb and goes on running, on purpose: a timer that
stopped whenever the phone was put down would be a worse hourglass than one
that runs true.

**A jerk** of the phone toward the end the sand rests on, faster than a
fall, pulls the floor out from under the heap: the top of it is thrown into
the air (`toss`, once per stroke), and the grains fly, hit the glass and
land. While the phone is being shaken the heap's friction drops (`give`),
so it holds a flatter slope and slumps, and the flow brings it back when the
shaking stops. On a desk there is no phone to shake; the jerk of a
sideways drag's orbit stands in for it. None of this touches the clock: the
sand through is the sand the time says.

**Turning over** (`turnOver`) lets each heap go of the end it rested
against: its sand becomes grains, two a cell, that fall to the other end as a
body and land in a scatter the flow then brings to its angle. A tap turns
the picture half a turn about the axis into the screen, so the grains are
mirrored left for right; a phone turned over is the same glass in the same
place, and nothing crosses over. Through the tap's 720 ms half turn the heaps
are held as they are — packed sand in a narrow bulb does hold for the moment
a turn takes — and drop when the glass lands.

**What the glass feels.** Every grain that hits the glass counts into the
bulb's `hits`, as its volume times its speed squared over the bulb's
capacity, and `buzzFor` turns a frame's hits into a vibration: nothing for a
few stray grains, a tick for a shake's handful, a thud of up to 40 ms for a
whole heap landing. The loop buzzes at most every 70 ms, and only where the
device can (`navigator.vibrate` — Android; Safari on an iPhone has none),
the page has had a tap, and **Feel the sand** is on.

**The glass hangs in the phone** (`view.ts`) the way a heavy thing hangs in
a hand. It is held by a stiff spring with a damper: a quick turn of the
phone — its change of spin, from the gyroscope — leaves it a few degrees
behind, so you see a little of its side, and it swings a hair past and
settles. A finger dragged sideways turns it about its own axis (the
**orbit**); let go, it spins on, slows and eases back to face you. Both are
pure and clock-free, and both are handed to the sand as part of the gravity
it feels.

Under both, **the follow** (`follow`): the sensors report sixty times a
second with a tremor in every reading, and a glass moved by each raw one
jitters. So what the glass feels of the phone — gravity, the push, the spin
that kicks the lag, and the phone's stance in the world that turns the sky —
eases toward each reading over a few hundredths of a second (gravity
0.12 s, the push 0.05 s, the spin 0.08 s, the stance 0.09 s, the last as a
quaternion slerp). A turn or a shake still reads as one; the tremor does
not. The lag's spring is damped enough to go a little past centre once and
settle, rather than wobble.

**The page never turns** (`upright.ts`). The phone and desktop apps lock
their windows to portrait, the right way up; an installed web app asks in
its manifest; a browser tab, which cannot lock, is turned back against the
screen's rotation on a touch screen (`data-turned` on `<html>`, `#root`
rotated and its safe-area insets turned with it in `styles.css`), so it
stands in the phone's own frame — the frame the sensors report in. Held
upside down, only the cog changes corners, fading out slowly and back in.

## The sky

The glass stands under a sky, and the sky lights it. `astronomy.ts` works
out where the sun and the moon stand and the moon's phase from the standard
low-precision formulas (Astronomy Answers' positions of the sun and the
moon, as suncalc has them, with refraction) — good to a fraction of a
degree, far finer than a sky on a phone can show — and how much light they
give: the measured horizontal illuminance of a clear sky for the sun's
height, about 100,000 lux at a high noon, 400 to 600 at sunset, 3.4 at the
end of civil twilight, 0.008 at the end of nautical and nothing below
eighteen degrees, with 0.001 of starlight under it; and the moon's, 0.27 lux
for a full moon overhead, dimmed by its phase (Allen's magnitude law), its
height and the air it shines through. What the eye makes of that is
`brightness`, the lux over a noon's to the power 0.16, held between 0.035
and 1 — the way eyes adapt, so a night is dark but a moonlit glass is still
readable.

**The place** is the device's time zone. `Intl` names it, and
`placeOfZone` looks up the latitude and longitude of the city it is named
for in `zones.ts` — generated from the tz database's public-domain
`zone.tab`, with the older names a browser may still report, like
`Asia/Calcutta`. A zone the table does not know stands at latitude 40 on
the longitude its offset from UTC says. The app never asks where the device
is, needs no permission and sends nothing; season and place come in through
the sun's height alone, so a Stockholm noon in December, the sun seven
degrees up, is a paler, lower, golder light than a Madrid afternoon in June.

**The colour** is `sky.ts`, the sibling game4's clear-sky model cut to a
glass: the sun's colour is the air it crossed (per-channel extinction over
the Kasten–Young air mass, so a noon sun is a hair warm of white and a sun
ten degrees up is gold), the zenith deepens as the sun climbs, a warm band
lies low toward where it set through twilight, and at night the key light
passes to the moon, which lifts the night sky a little as it goes, and the
stars come out by nautical twilight. **Settings → The sky** picks this —
**Now**, the sky outside at this moment — or one of three fixed skies,
**Day**, **Dusk** and **Night**. Both files are pure and clock-free: the
moment and the place are parameters.

## The picture

The glass is drawn in three dimensions with three.js (`render/stage.ts`),
tone-mapped (ACES) into sRGB, with soft shadows.

**The phone is a window.** The scene's axes are the sky's — x east, y up, z
south — and the camera and the glass hang together in one group that is
turned by the phone's real orientation (`deviceToEarth`, the rotation the
orientation spec defines) and a fixed heading, west-south-west
(`VIEW_HEADING`). So tilting the phone turns the view of the sky the way a
window's view turns: the horizon stays level with the real one and the sun
and the moon stand where they stand outside, while the glass stays in front
of the lens, because it is the phone. Held upside down, nothing on the
screen turns and the sky is still the right way up to the person holding
it. The camera is a perspective one, thirty degrees across, looking at the
glass head on at the height of the waist — not from above.

**The dome** (`render/skyDome.ts`, after game4's `sky-dome.ts` and
`haze.ts`) is a sphere round the lens painted with the sky's gradient from
zenith to horizon and a glow round the sun; a layer of fair-weather cumulus
projected onto a plane over the lens, so a cloud near the horizon is
foreshortened into the band it is in a real sky, drifting slowly; stars
sized in pixels, and a faint band of the Milky Way; the sun's disc; and the
moon's, lit on its sun side as far as its phase says, with a halo. It goes
through the same tone mapping as every lit surface, so its reflection in the
glass meets it without a seam. Under the horizon it is the land, in the
haze's colour and only a little darker, reached gently over thirty degrees:
the glass mirrors it — the waist's downward-facing walls most of all, where
a tight curve squeezes a wide sweep of the dome into a sliver — and a dark
land with a hard edge made black blades there that flickered as the phone
moved.

**The light** is the sky's. The key is a directional light — the sun by day,
the moon by night — that casts the frame's shadows onto the sand; a
hemisphere light carries the dome's own colour; a faint fill from the phone
stands in for the screen's glow, so a glass at night is a shape and not a
hole; and a point light behind the glass is the glow once the sand has run
out. Everything the glass and the metal **reflect** is the dome itself,
rendered through a PMREM environment map (unblurred, 512 across) whenever
the sun or the brightness moves. The dome that draws the environment gives
the sun a larger, softer disc (`MIRROR_SUN`) than the one on the screen, so
a sharp glint of the sun survives the filtering; the sun's highlight
travels across the glass as the phone turns, and the glass at night holds
the moon.

**The frame and the glass** (`render/parts.ts`) are lathes and boxes built
off the same numbers everything else reads — the specs in `look.ts`, the
profile as `glass.ts` interpolates it, the frame as `layoutOf` fits it to
the glass: round turned plates or square boxes with rounded edges, rod,
baluster and band posts, acorn and ball finials, the inlay ring. Wood is a
procedural grain in the spec's own colours under a clearcoat; metal is
metal; lacquer is a clearcoat over the spec's colour; glass is a physical
material with transmission, an index of 1.5 and the spec's tint. A frameless
glass's thick ground ends are glass too. The textures (`render/textures.ts`)
are drawn from a deterministic hash, never fetched.

**The sand** is the heightfield turned into a mesh (`sandMesh.ts`, pure and
tested): a vertex over the axis, a ring of them for each ring of cells and
one more at the wall, each carrying a _presence_, so a cell that is bare
glass is dropped and an emptied funnel shows the glass through its middle.
Where the heap meets the glass on each spoke (`rimHeights`) cuts the
**skin** — the wall's own shape drawn a hair inside the glass, below that
line — which is the body of the sand pressed against the glass, what you
see of sand from the side. Its surface is a speckle in the sand's colours
with the photographed grain (`public/models/grain.png`, from the Blender
pipeline's CC0 sand) as its bump; the grains in the air are points, and the
stream is a tube along the path the grains take (`streamPath`), with grains
moving down it at the traced pace — quickening through the air, sliding at
the speed friction allows on the glass.

## The flat picture

Where WebGL cannot start, and on the preset cards in Settings (each a still
`MiniGlass`), the glass is painted on a 2D canvas instead — the painter
the 3D stage replaced, kept as the fallback.

One camera and one light. The camera (`scene.ts`) is orthographic, pitched
a few degrees so the plates show their top faces and the rims of the heaps
are ellipses, and yawed a little so the posts do not hide one another. The
light stands high, to the left and slightly in front.

Back to front: the shadow on the table; the glow behind the glass once the
sand has run out; the bottom plate; the posts behind the glass; the glass's
back wall, with those posts seen through it, bent by the bulb's curve and
dimmed by the tint; the sand in both bulbs; the stream; the glass's front
wall; the posts in front; the top plate and its finials.

**The sand** is its heightfield turned into facets — a quad per ring per
spoke — sorted far to near and shaded by how squarely each faces the light,
then covered in a grain pattern drawn one speck to a device pixel. A few
grains cling to the glass above the rim, thinning upward. A sand that
sparkles gets a handful of specks catching the light.

**The glass** is two layers. The back wall is the tint and the bent posts.
The front wall is rendered per pixel once per size (`glassLight`): a sharp
highlight, a broad one under it, a fill from the other side and a Fresnel
brightening toward the silhouette — on a dark page as light, on a light
page as shadow, because a reflection on a white background is a darker
edge, not a brighter one.

**The frame** is a cylinder or a box lit by the same light, with the wood's
grain lines or the metal's sheen drawn along it — or, where the build
carries them, the modelled parts below.

## The modelled parts

The flat picture's plates, posts, finials and the light on its glass are,
where the build carries them, pictures traced in Blender rather than drawn
on the canvas: `make blender` (`scripts/blender.mjs`, `scripts/blender/`)
models every top and every glass off the same numbers the painter reads —
the specs in `look.ts`, the profile as `glass.ts` interpolates it, the frame
as `layoutOf` sizes it to each glass, even the spindle's turning — under the
flat camera and light, and photographs each part on its own onto a
transparent frame. A sprite is a picture in screen space; the manifest
under `public/models/` says where its corner lands in units of the
hourglass's height from the waist, so the painter places it by a scale and
an offset. A post or a finial is rendered once and moved to each post by
the difference of two projections, which an orthographic camera allows.

The sprites serve only the flat picture — the preset cards and the fallback
— and are loaded only when it is in use (`useSprites(look, enabled)`). The
3D stage builds its own frame and glass from `look.ts` directly
(`render/parts.ts`) and takes one thing from the pipeline: the photographed
grain, as the sand's bump.

The materials are photographed surfaces (ambientCG's, CC0): a walnut, an
oak, a pine, a brass, a copper, a brushed steel, each tinted by the top's
own face colour so the look stays the look's; lacquer and glass are plain
surfaces. The glass is rendered twice over a solid core standing in for the
sand — its highlights over black, which the painter adds, and its darkening
over white, which the painter multiplies — so what is inside the glass is
still the painter's to draw, and both passes hold on a light page as on a
dark one.

Where a sprite is missing or has not loaded, the painter draws its own, so
a build without models, or the first frame before they arrive, is the same
hourglass a little plainer. The `blender-assets` skill is the loop.

## What moves

The sand, the stream, a turn, and — slowly — the sky: the clouds drift, the
sun and the moon keep their places as the phone turns, and the glass sways
a few degrees behind a quick swing and comes back. There is no glint
travelling round the glass on its own and no pulse in the frame: the
glass's whole argument is quiet, and the sand is what says it is running.
