"""Hero renders of the fighters in a Lagos street ring.

Run: bl/bin/python -I scene.py <out_dir> <shot> [samples]
shot: versus | dayo | bisi
"""
import sys, os, math, random
import bpy
from mathutils import Vector

out, shot = sys.argv[1], sys.argv[2]
samples = int(sys.argv[3]) if len(sys.argv) > 3 else 64
random.seed(7)
bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
sc.render.engine = 'CYCLES'
sc.cycles.device = 'CPU'
sc.cycles.samples = samples
sc.cycles.use_denoising = True
sc.view_settings.view_transform = 'Standard'
sc.view_settings.look = 'None'
sc.view_settings.exposure = -0.75
sc.render.fps = 30


def srgb(h):
    h = h.lstrip('#')
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple((x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4) for x in c) + (1,)


def mat(name, hexs, rough=0.7, emit=0.0, bricks=None):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    p = nt.nodes["Principled BSDF"]
    p.inputs["Base Color"].default_value = srgb(hexs)
    p.inputs["Roughness"].default_value = rough
    if emit:
        p.inputs["Emission Color"].default_value = srgb(hexs)
        p.inputs["Emission Strength"].default_value = emit
    if bricks:
        # painted walls with a grid of dark windows
        tc = nt.nodes.new("ShaderNodeTexCoord")
        b = nt.nodes.new("ShaderNodeTexBrick")
        b.inputs["Color1"].default_value = srgb(hexs)
        b.inputs["Color2"].default_value = srgb(hexs)
        b.inputs["Mortar"].default_value = srgb(bricks)
        b.inputs["Scale"].default_value = 0.45
        b.inputs["Mortar Size"].default_value = 0.08
        b.inputs["Brick Width"].default_value = 1.2
        b.inputs["Row Height"].default_value = 1.0
        b.offset = 0.0
        nt.links.new(tc.outputs["Object"], b.inputs["Vector"])
        nt.links.new(b.outputs["Color"], p.inputs["Base Color"])
    return m


def box(name, loc, size, m, rot=0.0):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    o = bpy.context.object
    o.name = name
    o.scale = size
    o.rotation_euler.z = rot
    o.data.materials.append(m)
    return o


def cyl(loc, r, h, m, rot=None):
    bpy.ops.mesh.primitive_cylinder_add(radius=r, depth=h, location=loc, vertices=24)
    o = bpy.context.object
    if rot:
        o.rotation_euler = rot
    o.data.materials.append(m)
    bpy.ops.object.shade_smooth()
    return o


# ---------- fighters ----------
def bring(fid):
    path = os.path.join(out, fid + "_posed.blend")
    with bpy.data.libraries.load(path) as (src, dst):
        dst.objects = [n for n in src.objects if n.startswith(fid)]
    for o in dst.objects:
        sc.collection.objects.link(o)
    return bpy.data.objects[fid + "_rig"]


def play(rig, name, frame):
    act = bpy.data.actions[name]
    rig.animation_data.action = act
    try:
        rig.animation_data.action_slot = act.slots[0]
    except Exception:
        pass
    for tr in rig.animation_data.nla_tracks:
        tr.mute = True
    # hold one pose: shift the action so `frame` lands on scene frame 1
    for fc in getattr(act, "fcurves", []):
        pass
    return frame


rigs = {}
if shot in ("versus", "dayo"):
    rigs["dayo"] = bring("dayo")
if shot in ("versus", "bisi"):
    rigs["bisi"] = bring("bisi")

# ---------- ring and street ----------
canvas = mat("canvas", "#2A231D", 0.85)
yellow = mat("yellow", "#F5C518", 0.5)
redc = mat("red", "#FF6B35", 0.4)
bluec = mat("blue", "#4C8DFF", 0.4)
white = mat("white", "#F4EEE3", 0.5)
asphalt = mat("asphalt", "#57504A", 0.95)

box("canvas", (0, 0, -0.05), (6.4, 6.4, 0.1), canvas)
for x, y, sx, sy in ((0, -3.25, 6.6, 0.12), (0, 3.25, 6.6, 0.12), (-3.25, 0, 0.12, 6.6), (3.25, 0, 0.12, 6.6)):
    box("apron", (x, y, -0.05), (sx, sy, 0.11), yellow)
box("street", (0, 0, -0.2), (60, 60, 0.2), asphalt)
posts = {(-3.1, 3.1): redc, (3.1, 3.1): bluec, (-3.1, -3.1): bluec, (3.1, -3.1): redc}
for (x, y), m in posts.items():
    cyl((x, y, 0.65), 0.07, 1.3, m)
ropes = [(0.45, redc), (0.8, white), (1.15, bluec)]
for z, m in ropes:
    for (a, b) in (((-3.1, 3.1), (3.1, 3.1)), ((-3.1, -3.1), (-3.1, 3.1)), ((3.1, -3.1), (3.1, 3.1))):
        mid = Vector(((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, z))
        ln = math.dist(a, b)
        ang = math.atan2(b[1] - a[1], b[0] - a[0])
        cyl(mid, 0.022, ln, m, (0, math.pi / 2, ang))

# Lagos block of flats behind, Monkey Post palette
palette = ["#E86A92", "#5FB36B", "#F5C518", "#4C8DFF", "#FF8A3D", "#F2E6C9", "#9B6BD6", "#45B8AC"]
x = -16
while x < 16:
    w = random.uniform(2.5, 4.5)
    h = random.uniform(5, 12)
    d = random.uniform(3, 5)
    y = random.uniform(9, 11)
    m = mat("wall", random.choice(palette), 0.9, bricks="#2B2B33")
    box("bldg", (x + w / 2, y + d / 2, h / 2 - 0.1), (w, d, h), m)
    x += w + random.uniform(0.05, 0.4)
# wall mural banner
banner = mat("banner", "#F5C518", 0.6)
box("banner", (0, 7.5, 1.6), (9, 0.2, 2.2), banner)
box("bannerstripe1", (0, 7.38, 2.55), (9, 0.05, 0.12), mat("blk", "#13110F", 0.6))
box("bannerstripe2", (0, 7.38, 0.65), (9, 0.05, 0.12), mat("blk2", "#13110F", 0.6))
# light poles / bulbs strung across
for i in range(9):
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.06, location=(-4 + i, 3.6, 3.3 + 0.25 * math.cos(i * 0.8)))
    bpy.context.object.data.materials.append(mat("bulb", "#FFE7A8", 0.3, emit=6))

# ---------- light ----------
world = bpy.data.worlds.new("w")
sc.world = world
world.use_nodes = True
sky = world.node_tree.nodes.new("ShaderNodeTexSky")
try:
    sky.sky_type = 'NISHITA'
except Exception:
    pass
try:
    sky.sun_elevation = math.radians(35)
    sky.sun_rotation = math.radians(200)
except Exception:
    pass
world.node_tree.links.new(sky.outputs[0], world.node_tree.nodes["Background"].inputs[0])
world.node_tree.nodes["Background"].inputs[1].default_value = 0.09

def light(kind, loc, energy, size=2.0, color=(1, 1, 1), target=(0, 0, 1)):
    d = bpy.data.lights.new("l", kind)
    d.energy = energy
    d.color = color
    if kind == 'AREA':
        d.size = size
    if kind == 'SUN':
        d.angle = math.radians(3)
    o = bpy.data.objects.new("l", d)
    sc.collection.objects.link(o)
    o.location = loc
    o.rotation_euler = (Vector(target) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()

light('SUN', (-4, -5, 8), 3.0, color=(1.0, 0.93, 0.8))
light('AREA', (4, -4, 3), 250, 4, (0.85, 0.9, 1.0))
light('AREA', (0, 3, 4), 250, 3, (1.0, 0.8, 0.6))

# ---------- shots ----------
cam_d = bpy.data.cameras.new("c")
cam = bpy.data.objects.new("c", cam_d)
sc.collection.objects.link(cam)
sc.camera = cam

def aim(loc, target, lens):
    cam.location = loc
    cam.rotation_euler = (Vector(target) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
    cam_d.lens = lens

if shot == "versus":
    d, b = rigs["dayo"], rigs["bisi"]
    d.location = (-0.62, 0, 0)
    d.rotation_euler.z = math.radians(90)   # faces +X
    b.location = (0.62, 0, 0)
    b.rotation_euler.z = math.radians(-90)  # faces -X
    play(d, "Jab", 0)
    play(b, "Block", 0)
    sc.frame_set(6)
    sc.render.resolution_x, sc.render.resolution_y = 1920, 1080
    aim((0.35, -4.6, 1.35), (0, 0, 1.05), 38)
else:
    r = rigs[shot]
    play(r, "Idle", 0)
    sc.frame_set(1)
    sc.render.resolution_x, sc.render.resolution_y = 1080, 1350
    aim((1.7, -2.5, 1.5), (0, 0, 1.0), 45)

sc.render.filepath = os.path.join(out, "render_" + shot + ".png")
bpy.ops.render.render(write_still=True)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(out, "scene_" + shot + ".blend"))
