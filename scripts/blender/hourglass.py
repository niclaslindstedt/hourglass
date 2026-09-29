# SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
# THE HOURGLASS BUILDER: a top's plates, posts and finials, or a glass's two
# bulbs, modelled off the app's own numbers (handed over by
# `scripts/blender.mjs` as one JSON file) and photographed part by part by
# the app's camera into the sprites `paint.ts` composites the picture from.
#
# THE FRAME is `lib.py`'s: the app's unit, the waist at the origin, the
# app's y up as Blender's z, the app's z (towards the viewer) as Blender's
# −y. Every sprite is recorded with where it lands in the app's screen
# units from the waist, and — for a part the app places more than once, a
# post or a finial — with the world point it was rendered at, so the app
# shifts it to each post by the difference of two projections.
#
# A TOP job renders: one plate for every glass (the plates widen to clear a
# wider glass), one post (two, for bands, which face two ways), one finial.
# A GLASS job renders the two bulbs twice — lit for a dark page and for a
# light one — with a holdout inside them, so what is seen is the front
# wall's reflections and the rim of the glass, over nothing: the sand and
# the tint behind are the app's to paint.

import math, os, sys, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import lib as L
from lib import *

data, OUT, SAMPLES = args()
L.PPU = data["ppu"]
cycles(SAMPLES)
cam = camera()

# Materials a top is dressed in.
def warm(color):
    """A wood's own face colour, halfway to white: what the photographed
    grain is tinted by, so a walnut reads walnut and a pine pine."""
    r, g, b, _ = hex_rgb(color)
    to_srgb = lambda c: 12.92 * c if c <= 0.0031308 else 1.055 * c ** (1 / 2.4) - 0.055
    return "#%02x%02x%02x" % tuple(int(round(255 * (0.55 + 0.45 * to_srgb(c)))) for c in (r, g, b))

def plate_material(spec, tex):
    finish = spec["finish"]
    if finish == "wood" and tex:
        return tex_mat("plate", tex, scale=1.3, metal=0.0, coat=0.25, bump=0.4, tone=warm(spec["face"]))
    if finish == "metal" and tex:
        return tex_mat("plate", tex, scale=2.0, metal=1.0, rough=0.28, bump=0.15, tone=spec["face"])
    if finish == "lacquer":
        return mat("plate", spec["face"], rough=0.12, coat=1.0)
    if finish == "glass":
        return mat("plate", "#ffffff", glass=True, tint="rgba(220,232,240,0.06)")
    return mat("plate", spec["face"], rough=0.5)

def post_material(spec, tex):
    finish = spec["finish"]
    if spec["post"] == "baluster" and tex:
        return tex_mat("post", tex, scale=1.6, metal=1.0 if finish == "metal" else 0.0,
                       rough=0.3 if finish == "metal" else None, coat=0.2, tone=spec["face"] if finish == "metal" else None)
    if finish == "wood" and tex and spec["id"] == "pine":
        return tex_mat("post", tex, scale=2.0, coat=0.2, tone=warm(spec["face"]))
    if finish == "metal" and tex and spec["post"] in ("band", "rod"):
        return tex_mat("post", tex, scale=2.0, metal=1.0, rough=0.3, bump=0.15, tone=spec["postColor"] if spec["id"] != "steel" else None)
    return mat("post", spec["postColor"], metal=1.0 if finish in ("metal", "lacquer", "wood") else 0.0, rough=0.35, coat=0.3)

def finial_material(spec):
    return mat("finial", spec["finialColor"], metal=1.0, rough=0.22 if spec["finial"] == "ball" else 0.4)

def rounded_square(reach, corner, z0, z1, m, n=10):
    """A square plate seen from above with its corners eased, `reach` half
    a side, extruded from z0 to z1, its top and bottom edges bevelled."""
    pts = []
    for cx, cy, a0 in ((reach - corner, reach - corner, 0), (-(reach - corner), reach - corner, math.pi / 2),
                       (-(reach - corner), -(reach - corner), math.pi), (reach - corner, -(reach - corner), 3 * math.pi / 2)):
        for k in range(n + 1):
            a = a0 + (math.pi / 2) * k / n
            pts.append((cx + corner * math.cos(a), cy + corner * math.sin(a)))
    verts = [(x, y, z0) for x, y in pts] + [(x, y, z1) for x, y in pts]
    N = len(pts)
    faces = [tuple(range(N)), tuple(range(2 * N - 1, N - 1, -1))]
    for k in range(N):
        faces.append((k, (k + 1) % N, N + (k + 1) % N, N + k))
    ob = mesh_obj("plate", verts, faces, m, smooth=False)
    bv = ob.modifiers.new("bevel", "BEVEL")
    bv.width = min(0.006, (z1 - z0) * 0.25)
    bv.segments = 4
    bv.limit_method = "ANGLE"
    bv.angle_limit = math.radians(60)
    shade_smooth(ob, math.radians(35))
    return ob

def round_plate(reach, z0, z1, m, turned=False):
    e = min(0.006, (z1 - z0) * 0.25)
    prof = [(0, z0), (reach - e, z0), (reach, z0 + e), (reach, z1 - e), (reach - e, z1)]
    if turned:
        # A shallow groove turned into the top face, the way a lathe leaves
        # one, and a soft step down inside it.
        g = reach * 0.84
        prof += [(g + 0.006, z1), (g + 0.002, z1 - 0.004), (g - 0.002, z1 - 0.004), (g - 0.006, z1)]
    prof += [(0, z1)]
    return turn("plate", prof, m, seg=160)

def build_top():
    spec = data["spec"]
    spec = dict(spec, id=data["id"])
    tex = data["texture"]
    result = {}
    plate_m = plate_material(spec, tex)
    sq = spec["plate"] == "square"
    turned = spec["finish"] in ("wood", "metal") and not sq
    # One plate for every glass, at the bottom: the app shifts the same
    # picture up for the top plate.
    for g, lay in data["layouts"].items():
        B, T, reach = lay["height"], lay["thick"], lay["reach"]
        z0, z1 = -B - T, -B
        if sq:
            ob = rounded_square(reach, reach * 0.12, z0, z1, plate_m)
        else:
            ob = round_plate(reach, z0, z1, plate_m, turned)
        parts = [ob]
        if spec.get("inlay"):
            ring = turn("inlay", [(reach * 0.86, z1 - 0.0005), (reach * 0.86, z1 + 0.0006), (reach * 0.9, z1 + 0.0006), (reach * 0.9, z1 - 0.0005)],
                        mat("inlay", spec["inlay"], metal=1.0, rough=0.25), seg=160, closed=True)
            parts.append(ring)
        studio()
        result[f"plate-{g}"] = sprite(os.path.join(OUT, f"{data['id']}-plate-{g}.webp"), parts)
        for o in parts:
            bpy.data.objects.remove(o, do_unlink=True)
    # The posts, at the layout of the glass the top is shown with.
    lay = data["layouts"][data["shown"]]
    B, T, inset, r = lay["height"], lay["thick"], lay["postAt"], spec["postR"]
    if spec["posts"] > 0:
        post_m = post_material(spec, tex)
        positions = [(-inset, inset)] if spec["post"] != "band" else [(-inset, inset), (inset, -inset)]
        for k, (x, z_app) in enumerate(positions):
            y = -z_app  # the app's z (to the viewer) is Blender's −y
            z0, z1 = -B - T * 0.5, B + T * 0.5
            if spec["post"] == "rod":
                ob = cyl("post", x, y, z0, z1, r, post_m, seg=64)
            elif spec["post"] == "baluster":
                prof = []
                n = len(data["baluster"]) - 1
                for i, w in enumerate(data["baluster"]):
                    f = i / n
                    prof.append((r * w, z1 - (z1 - z0) * f))
                ob = turn("post", prof, post_m, seg=96)
                ob.location = (x, y, 0)
            else:
                ob = box("post", (x, y, (z0 + z1) / 2), (r * 2.6, r * 0.5, z1 - z0), post_m, rot_z=math.pi / 4, bevel=r * 0.12, seg=2)
            studio()
            name = "post" if spec["post"] != "band" else ("post-a", "post-b")[k]
            rec = sprite(os.path.join(OUT, f"{data['id']}-{name}.webp"), [ob])
            rec["at"] = dict(x=x, y=-B, z=z_app)
            result[name] = rec
            bpy.data.objects.remove(ob, do_unlink=True)
        if spec["finial"] != "none":
            fm = finial_material(spec)
            x, z_app = positions[0]
            y = -z_app
            top = B + T
            if spec["finial"] == "acorn":
                nut = r * 1.6
                nut_ob = turn("nut", [(nut, top), (nut, top + nut * 1.1)], fm, seg=6, smooth=False)
                nut_ob.location = (x, y, 0)
                dome_r, dome_h = r * 1.5, r * 1.9
                prof = []
                for k in range(0, 13):
                    a = (math.pi / 2) * k / 12
                    prof.append((dome_r * math.cos(a), top + nut * 1.1 + dome_h * math.sin(a)))
                dome = turn("dome", prof, fm, seg=64)
                dome.location = (x, y, 0)
                parts = [nut_ob, dome]
            else:
                ball = r * 2
                prof = []
                for k in range(0, 25):
                    a = -math.pi / 2 + math.pi * k / 24
                    prof.append((ball * math.cos(a), top + ball * 0.95 + ball * math.sin(a)))
                sph = turn("ball", prof, fm, seg=64)
                sph.location = (x, y, 0)
                parts = [sph]
            studio()
            rec = sprite(os.path.join(OUT, f"{data['id']}-finial.webp"), parts)
            rec["at"] = dict(x=x, y=top, z=z_app)
            result["finial"] = rec
    return result

def build_glass():
    spec = data["spec"]
    B = data["height"]
    radius = data["radius"]
    n = len(radius) - 1
    wall = 0.005 + 0.007 * spec["wall"]
    bore = data["bore"]
    outer = [(radius[k], B * k / n) for k in range(n + 1)]  # from the waist up
    inner = [(max(bore, r - wall), z) for r, z in outer]
    # The closed profile of both bulbs as one hollow solid: down the outer
    # wall from the top plate to the bottom, back up the inner wall.
    prof = []
    for r, z in reversed(outer):
        prof.append((r, z))
    for r, z in outer[1:]:
        prof.append((r, -z))
    for r, z in reversed(inner[1:]):
        prof.append((r, -z))
    for r, z in inner:
        prof.append((r, z))
    glass_m = mat("glass", "#ffffff", glass=True, tint=spec["tint"])
    bulbs = turn("glass", prof, glass_m, seg=160, closed=True)
    shade_smooth(bulbs, math.radians(60))
    # What is inside the glass is the app's to paint — the sand, the tint
    # — so the overlay is made in two passes with a solid core inside the
    # bulbs standing in for it: the highlights over a black world and a
    # black core, which the app ADDS (nothing where there is no light), and
    # the darkening over a white world and a white core, which it
    # MULTIPLIES (nothing where the glass takes nothing away). The back
    # wall is hidden by the core either way, as the sand hides it.
    core_prof = [(max(0.0, r - 0.0008), z) for r, z in inner]
    core_m = mat("core", "#000000", rough=1.0)
    core = turn("core", [(r, -z) for r, z in reversed(core_prof)] + [(r, z) for r, z in core_prof[1:]], core_m, seg=120)
    result = {}
    p = core_m.node_tree.nodes.get("Principled BSDF")
    for variant, level in (("add", 0.0), ("multiply", 1.0)):
        studio(dark=level < 0.5)
        p.inputs["Base Color"].default_value = (level, level, level, 1)
        result[variant] = sprite(os.path.join(OUT, f"{data['id']}-{variant}.webp"), [bulbs], keep=[core], transparent=False, world=level)
    return result

def build_grain():
    """The sand's grain: the photographed sand's colour map with its own
    lighting taken out — each pixel's difference from the local mean, as a
    grey the app lays over every sand's colour — tiled, so it repeats
    without a seam."""
    import numpy as np
    folder = data["texture"]
    src = None
    for f in sorted(os.listdir(folder)):
        if f.endswith("_Color.jpg"):
            src = bpy.data.images.load(os.path.join(folder, f))
    px = np.array(src.pixels[:]).reshape(src.size[1], src.size[0], 4)
    lum = 0.2126 * px[:, :, 0] + 0.7152 * px[:, :, 1] + 0.0722 * px[:, :, 2]
    n = 256
    tile = lum[:n, :n]
    # The local mean over a wide window, by a box blur that wraps, so the
    # tile's edges meet.
    def blur(a, k):
        out = np.zeros_like(a)
        for dy in range(-k, k + 1):
            for dx in range(-k, k + 1):
                out += np.roll(np.roll(a, dy, 0), dx, 1)
        return out / (2 * k + 1) ** 2
    mean = blur(tile, 4)
    high = tile - mean
    # Blend the tile's edges with their wrap so the seam vanishes.
    ramp = np.minimum(1, np.minimum(np.arange(n), n - 1 - np.arange(n)) / 24.0)
    w = np.minimum.outer(ramp, ramp)
    rolled = np.roll(np.roll(high, n // 2, 0), n // 2, 1)
    high = high * w + rolled * (1 - w)
    grey = np.clip(0.5 + high * 3.0, 0, 1)
    out = bpy.data.images.new("grain", n, n, alpha=False)
    rgba = np.stack([grey, grey, grey, np.ones_like(grey)], axis=-1).reshape(-1)
    out.pixels = rgba.tolist()
    out.file_format = "PNG"
    out.filepath_raw = os.path.join(OUT, "grain.png")
    out.save()
    print("WROTE grain.png")
    return {"file": "grain.png", "size": n}

result = {"top": build_top, "glass": build_glass, "grain": build_grain}[data["kind"]]()
with open(os.path.join(OUT, f".{data['kind']}-{data['id']}.result.json"), "w") as f:
    json.dump(result, f)
print("WROTE", len(result), "sprites")
