# SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
# THE BLENDER SHELF: what every modelled part of the hourglass is built from
# — the scene, the materials (a real photographed surface, or a plain one),
# the solids of revolution a plate, a post or a bulb is turned from, the
# boxes, the studio light that is the app's own light, the camera that is
# the app's own camera, and the render of one part on its own onto a
# transparent frame. `hourglass.py` is the builder; `scripts/blender.mjs`
# runs it; the `blender-assets` skill owns the loop.
#
# THE FRAME. Everything is stated in the app's own unit — the whole
# hourglass's height is 1 — and in the app's own axes turned to Blender's:
# the app's x (across the screen) is Blender's x, the app's y (up) is
# Blender's z, and the app's z (towards the viewer) is Blender's −y. The
# waist is the origin. So a part built here stands exactly where
# `paint.ts` would draw it, and a rendered layer lands on the canvas by a
# scale and an offset and nothing else (§ "The camera").
#
# THE LIGHT is `scene.ts`'s `LIGHT`, as a sun, with a soft sky round it for
# the reflections a metal and a glass are made of; the app's ambient floor
# is the sky's share.

import json, math, os, sys
import bpy
from mathutils import Vector

# ---------------------------------------------------------------- scene reset
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
COL = scene.collection

# The app's camera (`scene.ts`): an orthographic view pitched this much
# above the glass and yawed this much round to one side.
PITCH = 8.0
YAW = -11.0
# Pixels a unit of the app's height is rendered at, and the frame around
# the origin the camera covers (units across and up).
PPU = 2000
FRAME_W = 0.70
FRAME_H = 1.20

def _set(node, key, val):
    if key in node.inputs:
        node.inputs[key].default_value = val

# ---------------------------------------------------------------- materials
def hex_rgb(text):
    """A CSS colour to linear RGB (0..1): `#rgb`, `#rrggbb` or rgba()."""
    t = text.strip().lower()
    if t.startswith("#"):
        h = t[1:]
        if len(h) == 3:
            h = "".join(c * 2 for c in h)
        r, g, b = (int(h[i:i + 2], 16) / 255 for i in (0, 2, 4))
        a = 1.0
    elif t.startswith("rgb"):
        parts = [float(p) for p in t[t.index("(") + 1:t.index(")")].replace(",", " ").split()]
        r, g, b = (p / 255 for p in parts[:3])
        a = parts[3] if len(parts) > 3 else 1.0
    else:
        r = g = b = 0.5
        a = 1.0
    srgb = lambda c: c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4
    return (srgb(r), srgb(g), srgb(b), a)

def mat(name, color, metal=0.0, rough=0.5, coat=0.0, glass=False, tint=None, alpha=1.0):
    """A plain material: a colour, how metallic, how rough, a coat."""
    m = bpy.data.materials.new(name)
    try:
        m.use_nodes = True
    except Exception:
        pass
    p = m.node_tree.nodes.get("Principled BSDF")
    rgba = hex_rgb(color) if isinstance(color, str) else (*color, 1.0)
    _set(p, "Base Color", (rgba[0], rgba[1], rgba[2], 1.0))
    _set(p, "Metallic", metal)
    _set(p, "Roughness", rough)
    _set(p, "Coat Weight", coat)
    _set(p, "Coat Roughness", 0.03)
    if glass:
        _set(p, "Transmission Weight", 1.0)
        _set(p, "IOR", 1.5)
        _set(p, "Roughness", 0.05)
        if tint:
            t = hex_rgb(tint)
            # A tint is a faint colour in the glass: mostly white, the tint's
            # hue by its own alpha.
            k = t[3]
            _set(p, "Base Color", (1 - k * (1 - t[0]), 1 - k * (1 - t[1]), 1 - k * (1 - t[2]), 1.0))
        else:
            _set(p, "Base Color", (1, 1, 1, 1))
    if alpha < 1.0:
        _set(p, "Alpha", alpha)
    return m

def tex_mat(name, folder, scale=1.0, metal=None, rough=None, coat=0.0, tone=None, bump=0.35):
    """A photographed surface from a CC0 material folder (ambientCG's
    layout: `*_Color.jpg`, `*_Roughness.jpg`, `*_NormalGL.jpg`, and for a
    metal `*_Metalness.jpg`), mapped by the object's generated
    coordinates at `scale` repeats a unit. `tone` multiplies the colour —
    the way the look's own face colour tunes a wood or a metal — and
    `metal` / `rough` override the maps."""
    m = bpy.data.materials.new(name)
    try:
        m.use_nodes = True
    except Exception:
        pass
    nodes = m.node_tree.nodes
    links = m.node_tree.links
    p = nodes.get("Principled BSDF")
    coords = nodes.new("ShaderNodeTexCoord")
    mapping = nodes.new("ShaderNodeMapping")
    mapping.inputs["Scale"].default_value = (scale, scale, scale)
    links.new(coords.outputs["Object"], mapping.inputs["Vector"])

    def image(suffix, non_color=False):
        for f in sorted(os.listdir(folder)):
            if f.endswith(f"_{suffix}.jpg") or f.endswith(f"_{suffix}.png"):
                img = bpy.data.images.load(os.path.join(folder, f))
                if non_color:
                    img.colorspace_settings.name = "Non-Color"
                node = nodes.new("ShaderNodeTexImage")
                node.image = img
                node.projection = "BOX"
                node.projection_blend = 0.3
                links.new(mapping.outputs["Vector"], node.inputs["Vector"])
                return node
        return None

    color = image("Color")
    if color:
        if tone:
            mix = nodes.new("ShaderNodeMix")
            mix.data_type = "RGBA"
            mix.blend_type = "MULTIPLY"
            mix.inputs[0].default_value = 1.0
            t = hex_rgb(tone)
            links.new(color.outputs["Color"], mix.inputs[6])
            mix.inputs[7].default_value = (t[0], t[1], t[2], 1.0)
            links.new(mix.outputs[2], p.inputs["Base Color"])
        else:
            links.new(color.outputs["Color"], p.inputs["Base Color"])
    if rough is None:
        r = image("Roughness", True)
        if r:
            links.new(r.outputs["Color"], p.inputs["Roughness"])
    else:
        _set(p, "Roughness", rough)
    if metal is None:
        mt = image("Metalness", True)
        if mt:
            links.new(mt.outputs["Color"], p.inputs["Metallic"])
    else:
        _set(p, "Metallic", metal)
    nrm = image("NormalGL", True)
    if nrm and bump > 0:
        nm = nodes.new("ShaderNodeNormalMap")
        nm.inputs["Strength"].default_value = bump
        links.new(nrm.outputs["Color"], nm.inputs["Color"])
        links.new(nm.outputs["Normal"], p.inputs["Normal"])
    _set(p, "Coat Weight", coat)
    _set(p, "Coat Roughness", 0.05)
    return m

# ---------------------------------------------------------------- geometry
def link(ob):
    COL.objects.link(ob)
    return ob

def mesh_obj(name, verts, faces, m, smooth=True):
    me = bpy.data.meshes.new(name)
    me.from_pydata([Vector(v) for v in verts], [], faces)
    me.update()
    if m:
        me.materials.append(m)
    if smooth:
        for poly in me.polygons:
            poly.use_smooth = True
    ob = bpy.data.objects.new(name, me)
    return link(ob)

def turn(name, profile, m, seg=96, smooth=True, cap=True, closed=False):
    """A solid of revolution about the z axis: `profile` is `[(r, z), …]`
    from one end to the other, in the app's units. A point at r = 0 closes
    that end; otherwise `cap` closes it flat. A `closed` profile is a loop
    — a hollow shape, a wall with two faces — and takes no caps."""
    pts = [(max(0.0, r), z) for r, z in profile]
    if closed:
        cap = False
    if cap and pts[0][0] > 0:
        pts.insert(0, (0.0, pts[0][1]))
    if cap and pts[-1][0] > 0:
        pts.append((0.0, pts[-1][1]))
    verts = []
    rings = []
    for r, z in pts:
        ring = []
        if r <= 1e-9:
            ring = [len(verts)]
            verts.append((0.0, 0.0, z))
        else:
            for k in range(seg):
                a = 2 * math.pi * k / seg
                ring.append(len(verts))
                verts.append((r * math.cos(a), r * math.sin(a), z))
        rings.append(ring)
    faces = []
    pairs = list(zip(rings, rings[1:]))
    if closed:
        pairs.append((rings[-1], rings[0]))
    for a, b in pairs:
        if len(a) == 1 and len(b) == 1:
            continue
        if len(a) == 1:
            for k in range(seg):
                faces.append((a[0], b[(k + 1) % seg], b[k]))
        elif len(b) == 1:
            for k in range(seg):
                faces.append((a[k], a[(k + 1) % seg], b[0]))
        else:
            for k in range(seg):
                faces.append((a[k], a[(k + 1) % seg], b[(k + 1) % seg], b[k]))
    return mesh_obj(name, verts, faces, m, smooth)

def box(name, center, size, m, rot_z=0.0, bevel=0.0, seg=3):
    """A box centred at `center` (x, y, z) of `size` (w, d, h), turned
    `rot_z` radians about z, its edges bevelled by `bevel` units."""
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=center)
    ob = bpy.context.active_object
    ob.name = name
    ob.scale = (size[0], size[1], size[2])
    ob.rotation_euler = (0, 0, rot_z)
    bpy.ops.object.transform_apply(scale=True, rotation=True)
    if m:
        ob.data.materials.append(m)
    if bevel > 0:
        bv = ob.modifiers.new("bevel", "BEVEL")
        bv.width = bevel
        bv.segments = seg
        bv.limit_method = "NONE"
    for poly in ob.data.polygons:
        poly.use_smooth = False
    return ob

def cyl(name, x, y, z0, z1, r, m, seg=48):
    """A vertical cylinder at (x, y) from z0 to z1."""
    ob = turn(name, [(r, z0), (r, z1)], m, seg=seg)
    ob.location = (x, y, 0)
    return ob

def shade_smooth(ob, angle=math.radians(40)):
    """Smooth shading with sharp edges kept past `angle`."""
    for poly in ob.data.polygons:
        poly.use_smooth = True
    try:
        with bpy.context.temp_override(object=ob, selected_editable_objects=[ob]):
            bpy.ops.object.shade_smooth_by_angle(angle=angle)
    except Exception:
        pass
    return ob

# ---------------------------------------------------------------- the light
def studio(sky=0.55, sun=3.0, dark=False):
    for o in [o for o in COL.objects if o.type == "LIGHT"]:
        bpy.data.objects.remove(o, do_unlink=True)
    """The app's own light — high on the left and a little in front — as a
    sun, under a soft grey sky that is the reflection every metal and glass
    carries, and a broad key on the light's side. `dark` is a studio for
    a light page: a darker sky, so glass edges read as shadow on white."""
    world = bpy.data.worlds.new("sky")
    scene.world = world
    try:
        world.use_nodes = True
    except Exception:
        pass
    bg = world.node_tree.nodes.get("Background")
    level = 0.12 if dark else sky
    bg.inputs[0].default_value = (level, level * 1.02, level * 1.06, 1)
    bg.inputs[1].default_value = 1.0
    # `LIGHT` in the app's axes is (−0.45, 0.8, 0.5): x left, y up, z to the
    # viewer. In Blender's: (−0.45, −0.5, 0.8).
    d = Vector((-0.45, -0.5, 0.8)).normalized()
    lamp = bpy.data.lights.new("sun", "SUN")
    lamp.energy = sun * 1.6
    lamp.angle = math.radians(4)
    lamp.color = (1.0, 0.97, 0.93)
    so = link(bpy.data.objects.new("sun", lamp))
    so.rotation_euler = (-d).to_track_quat("-Z", "Y").to_euler()
    key = bpy.data.lights.new("key", "AREA")
    key.energy = 45 if dark else 55
    key.size = 1.6
    key.shape = "RECTANGLE"
    key.size_y = 2.4
    ko = link(bpy.data.objects.new("key", key))
    ko.location = d * 2.4
    ko.rotation_euler = (-d).to_track_quat("-Z", "Y").to_euler()
    # A fill from the other side, low and soft, so the shadowed faces are
    # not black — the app's ambient floor.
    fill = bpy.data.lights.new("fill", "AREA")
    fill.energy = 8 if dark else 14
    fill.size = 3.0
    fo = link(bpy.data.objects.new("fill", fill))
    f = Vector((0.7, -0.6, 0.15)).normalized()
    fo.location = f * 2.6
    fo.rotation_euler = (-f).to_track_quat("-Z", "Y").to_euler()

# ---------------------------------------------------------------- the camera
def camera():
    """The app's camera: orthographic, pitched `PITCH` above the waist and
    yawed `YAW` round to the right, centred on the origin, covering
    `FRAME_W` by `FRAME_H` units at `PPU` pixels a unit. A rendered pixel
    (px, py) is the screen point (px − W/2, py − H/2) / PPU in units from
    the waist, x right and y down — exactly `project()`'s output scaled."""
    cd = bpy.data.cameras.new("app")
    cd.type = "ORTHO"
    cd.ortho_scale = max(FRAME_W, FRAME_H)
    cd.clip_start = 0.01
    cd.clip_end = 20
    cam = link(bpy.data.objects.new("app", cd))
    pitch = math.radians(PITCH)
    yaw = math.radians(-YAW)
    cam.rotation_euler = (math.pi / 2 - pitch, 0, yaw)
    # The camera looks down its −z; stand it back along +z of its own frame.
    from mathutils import Euler
    back = Euler(cam.rotation_euler).to_matrix() @ Vector((0, 0, 1))
    cam.location = back * 6.0
    scene.camera = cam
    scene.render.resolution_x = int(round(FRAME_W * PPU))
    scene.render.resolution_y = int(round(FRAME_H * PPU))
    scene.render.resolution_percentage = 100
    scene.render.film_transparent = True
    return cam

def cycles(samples=48):
    scene.render.engine = "CYCLES"
    scene.cycles.device = "CPU"
    scene.cycles.samples = samples
    scene.cycles.use_denoising = True
    scene.cycles.max_bounces = 8
    scene.cycles.transmission_bounces = 8
    scene.cycles.transparent_max_bounces = 12
    scene.view_settings.view_transform = "Standard"
    scene.view_settings.look = "None"
    scene.render.image_settings.file_format = "WEBP"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.image_settings.quality = 92
    scene.cycles.film_transparent_glass = True
    scene.cycles.film_transparent_roughness = 0.1

def sprite(path, show, margin=0.01, keep=(), transparent=True, world=None):
    """Render only the objects in `show` (and the `keep` ones, such as a
    holdout) onto the transparent frame, cropped to where they land, and
    say where that is: the sprite's left, top, width and height in the
    app's screen units from the waist (x right, y down), and its file."""
    from bpy_extras.object_utils import world_to_camera_view
    meshes = [o for o in COL.objects if o.type == "MESH"]
    for o in meshes:
        o.hide_render = o not in show and o not in keep
    cam = scene.camera
    # A part just made has no world matrix until the view layer catches up.
    bpy.context.view_layer.update()
    xs, ys = [], []
    for o in show:
        for v in o.data.vertices:
            p = world_to_camera_view(scene, cam, o.matrix_world @ v.co)
            xs.append(p.x)
            ys.append(p.y)
    W = scene.render.resolution_x
    H = scene.render.resolution_y
    aspect = W / H
    # A camera's ortho scale spans its larger side; the fractions from
    # world_to_camera_view are of the frame already.
    mx = margin * PPU / W
    my = margin * PPU / H
    x0 = max(0, math.floor((min(xs) - mx) * W))
    x1 = min(W, math.ceil((max(xs) + mx) * W))
    y0 = max(0, math.floor((min(ys) - my) * H))
    y1 = min(H, math.ceil((max(ys) + my) * H))
    scene.render.film_transparent = transparent
    scene.render.image_settings.color_mode = "RGBA" if transparent else "RGB"
    if world is not None:
        bg = scene.world.node_tree.nodes.get("Background")
        bg.inputs[0].default_value = (world, world, world, 1)
    scene.render.use_border = True
    scene.render.use_crop_to_border = True
    scene.render.border_min_x = x0 / W
    scene.render.border_max_x = x1 / W
    scene.render.border_min_y = y0 / H
    scene.render.border_max_y = y1 / H
    scene.render.filepath = path
    bpy.ops.render.render(write_still=True)
    for o in meshes:
        o.hide_render = False
    # Blender's y runs up the frame; the app's runs down it.
    left = (x0 - W / 2) / PPU
    top = (H - y1 - H / 2) / PPU
    rec = dict(file=os.path.basename(path), x=left, y=top, w=(x1 - x0) / PPU, h=(y1 - y0) / PPU)
    print("SPRITE", json.dumps(rec))
    return rec

def args():
    """The data file and the output directory the driver hands over after
    `--`, and the samples."""
    argv = sys.argv
    tail = argv[argv.index("--") + 1:] if "--" in argv else argv[1:]
    data = json.load(open(tail[0]))
    out = tail[1]
    samples = int(tail[2]) if len(tail) > 2 else 48
    os.makedirs(out, exist_ok=True)
    return data, out, samples
