"""Build a Gbas Gbos fighter as a rigged, game-ready 3D character.

Run: bl/bin/python -I build.py <fighter_id> <out_dir>
"""
import sys, os, math, json, importlib
import bpy, bmesh, addon_utils
from mathutils import Vector, Matrix, Euler

HERE = os.path.dirname(os.path.abspath(__file__))
SCR = os.path.dirname(HERE)
MH = os.path.join(SCR, "mh/makehuman/data")
MPFB_DATA = os.path.join(SCR, "mpfb2/src/mpfb/data")

FIGHTERS = {
    "dayo": dict(
        macro={'gender': 1.0, 'age': 0.45, 'muscle': 1.0, 'weight': 0.5, 'proportions': 0.8,
               'height': 0.55, 'cupsize': 0.5, 'firmness': 0.5,
               'race': {'asian': 0.0, 'caucasian': 0.0, 'african': 1.0}},
        skin="#8D5A3B", trunks="#F5C518", gloves="#FF6B35", band="#13110F", hair="#1A1410",
        boots="#13110F", top=None, hairstyle="fade", headband=None, trim="#13110F",
    ),
    "bisi": dict(
        macro={'gender': 0.0, 'age': 0.55, 'muscle': 0.75, 'weight': 0.8, 'proportions': 0.7,
               'height': 0.5, 'cupsize': 0.55, 'firmness': 0.7,
               'race': {'asian': 0.0, 'caucasian': 0.0, 'african': 1.0}},
        skin="#6B4226", trunks="#E4572E", gloves="#F4EEE3", band="#F5C518", hair="#1A1410",
        boots="#F4EEE3", top="#E4572E", hairstyle="bun", headband="#F5C518", trim="#F5C518",
    ),
    # the referee: white short-sleeve shirt, black trousers and shoes, bow tie, grey hair, bare hands
    "ref": dict(
        macro={'gender': 1.0, 'age': 0.8, 'muscle': 0.5, 'weight': 0.62, 'proportions': 0.6,
               'height': 0.55, 'cupsize': 0.5, 'firmness': 0.5,
               'race': {'asian': 0.0, 'caucasian': 0.0, 'african': 1.0}},
        skin="#7A4E33", trunks="#1E1C1F", gloves=None, band="#2A231D", hair="#8E8A84",
        boots="#141214", top="#F4F4F0", hairstyle="fade", headband=None, trim="#141214",
        kind="ref", boot_h=0.055, bowtie="#13110F",
    ),
}


def srgb(hexs, a=1.0):
    h = hexs.lstrip('#')
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    lin = [x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c]
    return (*lin, a)


def mat(name, color, rough=0.6, metal=0.0, sheen=0.0, coat=0.0, image=None):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    p = m.node_tree.nodes["Principled BSDF"]
    p.inputs["Base Color"].default_value = srgb(color) if isinstance(color, str) else color
    p.inputs["Roughness"].default_value = rough
    p.inputs["Metallic"].default_value = metal
    if coat:
        p.inputs["Coat Weight"].default_value = coat
        p.inputs["Coat Roughness"].default_value = 0.25
    if sheen:
        p.inputs["Sheen Weight"].default_value = sheen
    if image:
        t = m.node_tree.nodes.new("ShaderNodeTexImage")
        t.image = bpy.data.images.load(image)
        m.node_tree.links.new(t.outputs["Color"], p.inputs["Base Color"])
    return m


def active(o):
    for x in bpy.context.view_layer.objects:
        x.select_set(False)
    bpy.context.view_layer.objects.active = o
    o.select_set(True)


def bake_shape_keys(o):
    if o.data.shape_keys:
        active(o)
        bpy.ops.object.shape_key_remove(all=True, apply_mix=True)


def vg_index(o, name):
    return o.vertex_groups[name].index


def verts_in_group(o, name, thr=0.5):
    gi = vg_index(o, name)
    out = set()
    for v in o.data.vertices:
        for g in v.groups:
            if g.group == gi and g.weight >= thr:
                out.add(v.index)
    return out


def bone_weight(o, v, names):
    if not hasattr(v, "groups"):
        v = o.data.vertices[v.index]
    s = 0.0
    for g in v.groups:
        if o.vertex_groups[g.group].name in names:
            s += g.weight
    return s


def dup(o, name):
    n = o.copy()
    n.data = o.data.copy()
    n.name = name
    bpy.context.collection.objects.link(n)
    return n


def keep_verts(o, keep):
    """Delete every vertex not in `keep`."""
    bm = bmesh.new()
    bm.from_mesh(o.data)
    bm.verts.ensure_lookup_table()
    kill = [v for v in bm.verts if v.index not in keep]
    bmesh.ops.delete(bm, geom=kill, context='VERTS')
    bm.to_mesh(o.data)
    bm.free()
    o.data.update()


def keep_faces(o, pred):
    """Keep faces whose all verts satisfy pred(vertex)."""
    bm = bmesh.new()
    bm.from_mesh(o.data)
    kill = [f for f in bm.faces if not all(pred(v) for v in f.verts)]
    bmesh.ops.delete(bm, geom=kill, context='FACES')
    loose = [v for v in bm.verts if not v.link_faces]
    bmesh.ops.delete(bm, geom=loose, context='VERTS')
    bm.to_mesh(o.data)
    bm.free()
    o.data.update()


def cut(o, z, keep_above=True):
    """Bisect at height z; drop the side not kept (None = split only)."""
    bm = bmesh.new()
    bm.from_mesh(o.data)
    geom = bm.verts[:] + bm.edges[:] + bm.faces[:]
    bmesh.ops.bisect_plane(bm, geom=geom, plane_co=(0, 0, z), plane_no=(0, 0, 1),
                           clear_inner=keep_above is True, clear_outer=keep_above is False)
    bm.to_mesh(o.data)
    bm.free()
    o.data.update()


def inflate(o, dist, weight_fn=None):
    """Push verts along their normals."""
    me = o.data
    me.update()
    for v in me.vertices:
        d = dist if weight_fn is None else dist * weight_fn(v)
        v.co = v.co + v.normal * d
    me.update()


def clean_mods(o):
    for m in list(o.modifiers):
        if m.type != 'ARMATURE':
            o.modifiers.remove(m)


def set_mats(o, mats):
    o.data.materials.clear()
    for m in mats:
        o.data.materials.append(m)


def apply_mod(o, m):
    active(o)
    bpy.ops.object.modifier_apply(modifier=m.name)



def remesh_cloth(o, voxel, smooth=10, faces=None, laplace=True):
    """Clean, blobby-free topology for a garment, then a polygon budget."""
    clean_mods(o)
    r = o.modifiers.new("r", 'REMESH'); r.mode = 'VOXEL'; r.voxel_size = voxel; r.use_smooth_shade = True
    apply_mod(o, r)
    if smooth:
        sm = o.modifiers.new("sm", 'SMOOTH'); sm.factor = 0.6; sm.iterations = smooth
        apply_mod(o, sm)
    if faces and len(o.data.polygons) > faces:
        d = o.modifiers.new("d", 'DECIMATE'); d.ratio = faces / len(o.data.polygons)
        apply_mod(o, d)


def skin_to(o, body, rig, k=4, drop=(), only=None):
    """Give a garment the body's bone weights (inverse-distance blend of nearest body verts)."""
    from mathutils.kdtree import KDTree
    kd = KDTree(len(body.data.vertices))
    for v in body.data.vertices:
        if only is None or v.index in only:
            kd.insert(v.co, v.index)
    kd.balance()
    bone_names = {b.name for b in rig.data.bones}
    for g in list(o.vertex_groups):
        o.vertex_groups.remove(g)
    groups = {}
    bw = [{body.vertex_groups[g.group].name: g.weight for g in v.groups
           if body.vertex_groups[g.group].name in bone_names} for v in body.data.vertices]
    acc = {}
    for v in o.data.vertices:
        hits = kd.find_n(v.co, k)
        tot = {}
        wsum = 0.0
        for co, idx, d in hits:
            w = 1.0 / max(d, 1e-4)
            wsum += w
            for n, x in bw[idx].items():
                tot[n] = tot.get(n, 0.0) + w * x
        tot = {n: x for n, x in tot.items() if not n.startswith(drop) or not drop}
        s = sum(tot.values()) or 1.0
        for n, x in tot.items():
            acc.setdefault(n, []).append((v.index, x / s))
    for n, lst in acc.items():
        vg = o.vertex_groups.new(name=n)
        for i, x in lst:
            if x > 0.01:
                vg.add([i], x, 'REPLACE')
    clean_mods(o)
    for m in list(o.modifiers):
        o.modifiers.remove(m)
    m = o.modifiers.new("Armature", 'ARMATURE'); m.object = rig
    o.parent = rig


def attach(o, rig, bone):
    """Rigid-attach a mesh to one bone via a full-weight vertex group (exports cleanly to glTF)."""
    clean_mods(o)
    for g in list(o.vertex_groups):
        o.vertex_groups.remove(g)
    vg = o.vertex_groups.new(name=bone)
    vg.add(list(range(len(o.data.vertices))), 1.0, 'REPLACE')
    m = o.modifiers.new("Armature", 'ARMATURE')
    m.object = rig
    o.parent = rig


def head_ring(body, name, z0, z1, off, n=56):
    """A clean band around the head between heights z0 and z1."""
    hv = [v.co for v in body.data.vertices if z0 - 0.01 <= v.co.z <= z1 + 0.01 and v.co.z > 1.2]
    cx = sum(v.x for v in hv) / len(hv)
    cy = sum(v.y for v in hv) / len(hv)
    def radius(ang, z):
        best = 0.0
        for v in hv:
            if abs(v.z - z) > 0.012:
                continue
            a = math.atan2(v.y - cy, v.x - cx)
            d = abs((a - ang + math.pi) % (2 * math.pi) - math.pi)
            if d < 0.12:
                best = max(best, math.hypot(v.x - cx, v.y - cy))
        return best
    bm = bmesh.new()
    rows = []
    for z in (z0, (z0 + z1) / 2, z1):
        row = []
        for i in range(n):
            ang = 2 * math.pi * i / n
            r = radius(ang, z) + off
            row.append(bm.verts.new((cx + r * math.cos(ang), cy + r * math.sin(ang), z)))
        rows.append(row)
    for a, b in zip(rows, rows[1:]):
        for i in range(n):
            bm.faces.new((a[i], a[(i + 1) % n], b[(i + 1) % n], b[i]))
    me = bpy.data.meshes.new(name)
    bm.normal_update()
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(o)
    sm = o.modifiers.new("sm", 'SMOOTH'); sm.factor = 0.5; sm.iterations = 3
    apply_mod(o, sm)
    sol = o.modifiers.new("s", 'SOLIDIFY'); sol.thickness = 0.006; sol.offset = 1
    apply_mod(o, sol)
    bv = o.modifiers.new("b", 'SUBSURF'); bv.levels = 1
    apply_mod(o, bv)
    me.validate()
    if any(p.normal.dot(p.center - Vector((cx, cy, p.center.z))) < 0 for p in me.polygons[:1]):
        active(o); bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT')
        bpy.ops.mesh.normals_make_consistent(inside=False); bpy.ops.object.mode_set(mode='OBJECT')
    return o


def make_glove(fid, side, P, F):
    """Boxing glove from metaballs, built in the hand's rest frame."""
    wrist = P["hand_" + side][0]
    knuck = P["middle_01_" + side][0]
    Y = (knuck - wrist).normalized()
    X = (P["index_01_" + side][0] - P["pinky_01_" + side][0])
    X = (X - Y * X.dot(Y)).normalized()
    Z = X.cross(Y).normalized()
    thumb_tip = P["thumb_03_" + side][1]
    palm = 1.0 if (thumb_tip - wrist).dot(Z) > 0 else -1.0
    Zp = Z * palm  # points to the palm side
    M = Matrix((X, Y, Zp)).transposed()

    mb = bpy.data.metaballs.new(fid + "_glove_" + side)
    mb.resolution = 0.007
    mb.render_resolution = 0.007
    ob = bpy.data.objects.new(fid + "_glove_" + side, mb)
    bpy.context.collection.objects.link(ob)

    def el(kind, c, r, rot=None, stiff=2.0):
        e = mb.elements.new(type=kind)
        e.co = c
        e.radius = 1.0
        e.size_x, e.size_y, e.size_z = r
        e.stiffness = stiff
        if rot:
            e.rotation = rot.to_quaternion()
        return e

    k = 1.0
    el('ELLIPSOID', (0.0, 0.10, -0.004), (0.085*k, 0.105*k, 0.075*k))   # fist
    el('ELLIPSOID', (0.0, 0.05, -0.01), (0.085*k, 0.08*k, 0.072*k))    # back of hand
    el('ELLIPSOID', (0.05, 0.07, 0.03), (0.036*k, 0.07*k, 0.036*k), Euler((0, 0, -0.3)), 2.0)  # thumb
    el('ELLIPSOID', (0.0, -0.035, -0.004), (0.068*k, 0.075*k, 0.064*k), None, 2.0)   # cuff
    active(ob)
    bpy.ops.object.convert(target='MESH')
    g = bpy.context.object
    g.name = fid + "_glove_" + side
    # mirror the thumb for the right hand frame is handled by X pointing to the index side
    for v in g.data.vertices:
        v.co = M @ Vector(v.co) + wrist
    dec = g.modifiers.new("dec", 'DECIMATE'); dec.ratio = 0.35
    apply_mod(g, dec)
    set_mats(g, [mat(fid + "_glove", F["gloves"], rough=0.3, coat=0.6),
                 mat(fid + "_gcuff", F["trim"], rough=0.45)])
    for p in g.data.polygons:
        local = M.transposed() @ (p.center - wrist)
        p.material_index = 1 if -0.06 < local.y < -0.025 else 0
    return g


def build(fid, out):
    F = FIGHTERS[fid]
    REF = F.get("kind") == "ref"
    bpy.ops.wm.read_factory_settings(use_empty=True)
    addon_utils.enable("bl_ext.user_default.mpfb", default_set=True)
    HS = importlib.import_module("bl_ext.user_default.mpfb.services.humanservice").HumanService

    human = HS.create_human(macro_detail_dict=F["macro"])
    rig = HS.add_builtin_rig(human, "game_engine")
    rig.name = fid + "_rig"
    rig.data.name = fid + "_rig"

    # eyes as an MHCLO body part, fitted and weighted by MPFB
    eyes = HS.add_mhclo_asset(os.path.join(MH, "eyes/low-poly/low-poly.mhclo"), human, asset_type="Eyes",
                              subdiv_levels=0, material_type="NONE")
    eyes.name = fid + "_eyes"

    # bake targets into plain geometry on everything
    for o in (human, eyes):
        bake_shape_keys(o)

    pose_pos = {b.name: (rig.matrix_world @ b.head_local, rig.matrix_world @ b.tail_local) for b in rig.data.bones}
    head_z = pose_pos["head"][0].z
    pelvis_z = pose_pos["pelvis"][0].z
    knee_z = pose_pos["calf_l"][0].z
    ankle_z = pose_pos["foot_l"][0].z
    top_z = max((human.matrix_world @ v.co).z for v in human.data.vertices)

    # ---------------- trunks from the tights helper ----------------
    tights_v = verts_in_group(human, "helper-tights")
    trunks = dup(human, fid + "_trunks")
    clean_mods(trunks)
    hem_z = pelvis_z - 0.42 * (pelvis_z - knee_z) if not REF else ankle_z + 0.035
    waist_z = pelvis_z + 0.10
    keep_verts(trunks, tights_v)
    cut(trunks, hem_z, keep_above=True)
    cut(trunks, waist_z, keep_above=False)
    # loose fit: more ease lower down, a flared hem
    if REF:  # straight-leg trousers
        inflate(trunks, 0.009, lambda v: 1.0 + 0.5 * max(0.0, (knee_z - v.co.z) / (knee_z - hem_z)))
    else:
        inflate(trunks, 0.006, lambda v: 0.7 + 0.7 * max(0.0, (pelvis_z - v.co.z) / (pelvis_z - hem_z)))
    trunks_band_z = waist_z - (0.045 if not REF else 0.03)
    cut(trunks, trunks_band_z, keep_above=None)
    set_mats(trunks, [mat(fid + "_trunks", F["trunks"], rough=0.38 if not REF else 0.75, sheen=0.15),
                      mat(fid + "_band", F["band"], rough=0.5)])
    for p in trunks.data.polygons:
        p.material_index = 1 if p.center.z > trunks_band_z else 0
    sol = trunks.modifiers.new("solid", 'SOLIDIFY'); sol.thickness = 0.014; sol.offset = 0
    apply_mod(trunks, sol)
    remesh_cloth(trunks, 0.006, 6, 5000)
    cut(trunks, hem_z + 0.004, keep_above=True)
    cut(trunks, waist_z - 0.003, keep_above=False)
    cut(trunks, trunks_band_z, keep_above=None)
    for p in trunks.data.polygons:
        p.material_index = 1 if p.center.z > trunks_band_z else 0

    # ---------------- hair from the scalp group ----------------
    scalp = verts_in_group(human, "scalp", 0.3)
    hair = dup(human, fid + "_hair")
    clean_mods(hair)
    keep_verts(hair, scalp)
    if F["hairstyle"] == "fade":
        inflate(hair, 0.004, lambda v: max(0.2, min(1.0, (v.co.z - (head_z + 0.06)) / 0.08)))
    else:
        inflate(hair, 0.006)
    set_mats(hair, [mat(fid + "_hair", F["hair"], rough=0.9, sheen=0.1)])

    # ---------------- body: drop helpers, hands go under gloves ----------------
    body_v = verts_in_group(human, "body")
    hand_names = {n for n in pose_pos if any(k in n for k in ("hand_", "index_", "middle_", "ring_", "pinky_", "thumb_"))}
    body = human
    body.name = fid + "_body"
    keep_verts(body, body_v)
    clean_mods(body)
    if not REF:  # fighters' hands go under gloves; the referee keeps his
        keep_faces(body, lambda v: bone_weight(body, body.data.vertices[v.index], hand_names) < 0.6)

    skin = mat(fid + "_skin", F["skin"], rough=0.52)
    p = skin.node_tree.nodes["Principled BSDF"]
    p.inputs["Subsurface Weight"].default_value = 0.08
    p.inputs["Subsurface Radius"].default_value = (0.9, 0.35, 0.2)
    p.inputs["Specular IOR Level"].default_value = 0.45
    lips = mat(fid + "_lips", tuple(c * 0.55 for c in srgb(F["skin"])[:3]) + (1,), rough=0.4)
    set_mats(body, [skin, lips])
    lips_v = verts_in_group(body, "lips", 0.5) if "lips" in body.vertex_groups else set()
    for poly in body.data.polygons:
        if sum(1 for i in poly.vertices if i in lips_v) >= 3:
            poly.material_index = 1

    set_mats(eyes, [mat(fid + "_eye", "#FFFFFF", rough=0.15, image=os.path.join(MH, "eyes/materials/brown_eye.png"))])


    body_ref = dup(body, fid + "_bodyref")  # full skin, used to weight garments
    # ---------------- face landmarks ----------------
    ev = [eyes.matrix_world @ v.co for v in eyes.data.vertices]
    eye_r = sum((v for v in ev if v.x > 0), Vector()) / max(1, sum(1 for v in ev if v.x > 0))
    eye_l = sum((v for v in ev if v.x < 0), Vector()) / max(1, sum(1 for v in ev if v.x < 0))
    eye_z = (eye_r.z + eye_l.z) / 2
    head_set = {"head", "neck_01"}

    # ---------------- eyebrows ----------------
    brows = dup(body, fid + "_brows")
    clean_mods(brows)
    bm_n = {v.index: v.normal.copy() for v in brows.data.vertices}
    def in_brow(v):
        co = v.co
        if bm_n[v.index].y > -0.35 or not (eye_z + 0.016 <= co.z <= eye_z + 0.027):
            return False
        for e in (eye_l, eye_r):
            dx = abs(co.x - e.x)
            if dx < 0.028 and co.z <= eye_z + 0.027 - 0.2 * max(0, dx - 0.01):
                return True
        return False
    keep_faces(brows, in_brow)
    inflate(brows, 0.0018)
    set_mats(brows, [mat(fid + "_brow", F["hair"], rough=0.9)])

    # ---------------- boots ----------------
    boot_top = ankle_z + F.get("boot_h", 0.16)
    boots = dup(body, fid + "_boots")
    clean_mods(boots)
    cut(boots, boot_top, keep_above=False)
    vgb = boots.vertex_groups.new(name="bootsmooth")
    vgb.add([v.index for v in boots.data.vertices if v.co.z < ankle_z + 0.02], 1.0, 'REPLACE')
    sm = boots.modifiers.new("sm", 'SMOOTH'); sm.factor = 1.0; sm.iterations = 30
    sm.vertex_group = "bootsmooth"
    apply_mod(boots, sm)
    inflate(boots, 0.003, lambda v: 1.0 + 0.6 * max(0.0, 1 - v.co.z / 0.03))
    sole_z = 0.022
    cut(boots, sole_z, keep_above=None)
    cut(boots, boot_top - 0.025, keep_above=None)
    set_mats(boots, [mat(fid + "_boot", F["boots"], rough=0.35, coat=0.3),
                     mat(fid + "_sole", "#2A231D" if F["boots"] != "#13110F" else "#F4EEE3", rough=0.7),
                     mat(fid + "_cuffboot", F["trim"], rough=0.5)])
    for p in boots.data.polygons:
        p.material_index = 1 if p.center.z < sole_z else (2 if p.center.z > boot_top - 0.025 else 0)
    sol = boots.modifiers.new("solid", 'SOLIDIFY'); sol.thickness = 0.016; sol.offset = 0
    apply_mod(boots, sol)
    remesh_cloth(boots, 0.007, 12, 3000)
    cut(boots, boot_top - 0.004, keep_above=False)
    cut(boots, sole_z, keep_above=None)
    cut(boots, boot_top - 0.025, keep_above=None)
    for p in boots.data.polygons:
        p.material_index = 1 if p.center.z < sole_z else (2 if p.center.z > boot_top - 0.025 else 0)
    # hide skin that the boots cover
    keep_faces(body, lambda v: v.co.z > boot_top - 0.05)

    # ---------------- sports top ----------------
    if REF:
        top = dup(body, fid + "_shirt")
        clean_mods(top)
        neck_z = pose_pos["neck_01"][0].z
        sh_lo = waist_z - 0.045
        armpit_z = pose_pos["upperarm_l"][0].z - 0.09
        up_names = {"upperarm_l", "upperarm_r"}
        low_names = {"lowerarm_l", "lowerarm_r"} | hand_names
        neck_names = {"neck_01", "head"}
        ua = {s: (pose_pos["upperarm_" + s][0], pose_pos["upperarm_" + s][1]) for s in ("l", "r")}
        src = [top]
        def in_top(v):
            co = v.co
            if co.z < sh_lo or co.z > neck_z + 0.03:
                return False
            o = src[0]
            if bone_weight(o, v, neck_names) > 0.25 or bone_weight(o, v, low_names) > 0.02:
                return False
            if bone_weight(o, v, up_names) > 0.05:
                s = "l" if co.x > 0 else "r"
                a, b = ua[s]
                ax = (b - a)
                t = (co - a).dot(ax) / ax.length_squared
                return t < 0.5  # short sleeve, half way down the upper arm
            return True
        keep_faces(top, in_top)
        sm = top.modifiers.new("sm", 'SMOOTH'); sm.factor = 0.5; sm.iterations = 8
        apply_mod(top, sm)
        inflate(top, 0.012, lambda v: 1.0 + 0.6 * max(0.0, min(1.0, (armpit_z - v.co.z) / 0.25)))
        sol = top.modifiers.new("solid", 'SOLIDIFY'); sol.thickness = 0.012; sol.offset = 0
        apply_mod(top, sol)
        remesh_cloth(top, 0.006, 8, 5000)
        cut(top, waist_z - 0.012, keep_above=True)  # straight hem just above the belt
        set_mats(top, [mat(fid + "_shirt", F["top"], rough=0.6, sheen=0.25)])
        # skin hidden by the shirt and trousers
        arm_any = up_names | low_names
        keep_faces(body, lambda v: not (
            (sh_lo + 0.03 < v.co.z < armpit_z - 0.02 and bone_weight(body, v, arm_any) < 0.01)
            or (boot_top + 0.02 < v.co.z < waist_z - 0.05 and bone_weight(body, v, low_names) < 0.01)))
        # bow tie at the collar
        nk = pose_pos["neck_01"][0]
        fy = min(v.co.y for v in top.data.vertices if abs(v.co.x) < 0.02 and abs(v.co.z - (nk.z - 0.035)) < 0.015)
        parts = []
        for sd in (-1, 1):
            bpy.ops.mesh.primitive_cone_add(vertices=4, radius1=0.022, radius2=0.004, depth=0.045,
                                            location=(0.022 * sd, fy - 0.006, nk.z - 0.035),
                                            rotation=(0, -math.pi / 2 * sd, math.pi / 4))
            parts.append(bpy.context.object)
        bpy.ops.mesh.primitive_cube_add(size=0.014, location=(0, fy - 0.008, nk.z - 0.035))
        parts.append(bpy.context.object)
        for o in parts:
            active(o); bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
            bv = o.modifiers.new("b", 'BEVEL'); bv.width = 0.002; bv.segments = 2
            apply_mod(o, bv)
            set_mats(o, [mat(fid + "_bow", F["bowtie"], rough=0.4, sheen=0.3)])
            o.name = fid + "_bowtie"
            attach(o, rig, "spine_03")
    elif F["top"]:
        top = dup(body, fid + "_top")
        clean_mods(top)
        neck_z = pose_pos["neck_01"][0].z
        under_z = pose_pos["spine_02"][0].z - 0.02
        arm_names = {"upperarm_l", "upperarm_r", "lowerarm_l", "lowerarm_r", "neck_01", "head"}
        tn = {v.index: v.normal.copy() for v in top.data.vertices}
        src = [top]
        nk = pose_pos["neck_01"][0]
        armpit_z = pose_pos["upperarm_l"][0].z - 0.09
        def in_top(v):
            co = v.co
            if co.z < under_z - 0.02 or co.z > neck_z + 0.02:
                return False
            aw = bone_weight(src[0], v, arm_names)
            if aw > 0.3 or (co.z > armpit_z + 0.02 and aw > 0.08):
                return False
            return True
        # flatten the chest detail before the garment copies it
        tips = verts_in_group(top, "nippleTip", 0.1) if "nippleTip" in top.vertex_groups else set()
        for side in (1, -1):
            pts = [top.data.vertices[i].co for i in tips if top.data.vertices[i].co.x * side > 0]
            if not pts:
                continue
            c = sum(pts, Vector()) / len(pts)
            for v in top.data.vertices:
                d = (v.co - c).length
                if d < 0.04:
                    v.co = v.co - v.normal * 0.014 * (1 - d / 0.04) ** 1.5
        top.data.update()
        keep_faces(top, in_top)
        sm = top.modifiers.new("sm", 'LAPLACIANSMOOTH'); sm.lambda_factor = 2.0; sm.iterations = 30
        sm.use_volume_preserve = True
        apply_mod(top, sm)
        inflate(top, 0.011)
        sol = top.modifiers.new("solid", 'SOLIDIFY'); sol.thickness = 0.014; sol.offset = 0
        apply_mod(top, sol)
        remesh_cloth(top, 0.006, 10, 4000)
        cut(top, under_z + 0.005, keep_above=True)
        top_pred = in_top

        set_mats(top, [mat(fid + "_topm", F["top"], rough=0.42, sheen=0.15)])

    # ---------------- headband ----------------
    if F["headband"]:
        hb_lo, hb_hi = eye_z + 0.04, eye_z + 0.068
        hb = head_ring(body, fid + "_headband", hb_lo, hb_hi, 0.008)
        set_mats(hb, [mat(fid + "_hb", F["headband"], rough=0.6)])
        # knot tails at the back
        for side in (-1, 1):
            bpy.ops.mesh.primitive_cube_add(size=1)
            t = bpy.context.object
            t.name = fid + "_hbtail"
            back = max(v.co.y for v in hb.data.vertices)
            t.scale = (0.012, 0.004, 0.055)
            t.location = (0.012 * side, back + 0.004, (hb_lo + hb_hi) / 2 - 0.045)
            t.rotation_euler = (0.35, 0, 0.35 * side)
            bv = t.modifiers.new("b", 'BEVEL'); bv.width = 0.003; bv.segments = 2
            apply_mod(t, bv)
            bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
            set_mats(t, [hb.data.materials[0]])
            attach(t, rig, "head")
        attach(hb, rig, "head")

    if F["hairstyle"] == "bun":
        bpy.ops.mesh.primitive_uv_sphere_add(radius=0.05, segments=20, ring_count=12)
        bun = bpy.context.object
        bun.name = fid + "_bun"
        hv = [hair.matrix_world @ v.co for v in hair.data.vertices]
        backmost = max(v.y for v in hv)
        bun.location = (0, backmost - 0.01, top_z - 0.035)
        bun.scale = (1.0, 0.85, 0.9)
        bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
        bpy.ops.object.shade_smooth()
        set_mats(bun, [hair.data.materials[0]])
        attach(bun, rig, "head")

    # ---------------- gloves ----------------
    for side in ("l", "r") if F["gloves"] else ():
        g = make_glove(fid, side, pose_pos, F)
        attach(g, rig, "hand_" + side)

    for o in (trunks, boots, hair, brows):
        skin_to(o, body_ref, rig)
    if F["top"]:
        src[0] = body_ref
        torso = {v.index for v in body_ref.data.vertices if in_top(v)}
        skin_to(top, body_ref, rig, k=6, only=torso)
    bpy.data.objects.remove(body_ref)
    # the boot shaft and the visible shin follow the calf, not the foot
    for o in (boots, body):
        for v in o.data.vertices:
            t = max(0.0, min(1.0, (v.co.z - (ankle_z + 0.01)) / 0.06))
            if t <= 0 or v.co.z > knee_z - 0.05:
                continue
            side = "l" if v.co.x > 0 else "r"
            moved = 0.0
            for g in v.groups:
                n = o.vertex_groups[g.group].name
                if n.startswith(("foot_", "ball_")):
                    moved += g.weight * t
                    g.weight *= (1 - t)
            if moved <= 0:
                continue
            cg = o.vertex_groups.get("calf_" + side) or o.vertex_groups.new(name="calf_" + side)
            cur = 0.0
            for g in v.groups:
                if g.group == cg.index:
                    cur = g.weight
            cg.add([v.index], cur + moved, 'REPLACE')
    for o in bpy.data.objects:
        if o.type == 'MESH':
            for poly in o.data.polygons:
                poly.use_smooth = True

    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(out, fid + ".blend"))
    json.dump({k: [list(a), list(b)] for k, (a, b) in pose_pos.items()}, open(os.path.join(out, fid + "_bones.json"), "w"))
    print("BUILT", fid, len(body.data.polygons), top_z)


if __name__ == "__main__":
    fid, out = sys.argv[1], sys.argv[2]
    os.makedirs(out, exist_ok=True)
    build(fid, out)
