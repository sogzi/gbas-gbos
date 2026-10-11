"""Pose a built fighter, bake boxing animation clips and export a GLB.

Run: bl/bin/python -I pose.py <fighter_id> <out_dir>
"""
import sys, os, math
import bpy
from mathutils import Vector, Matrix, Quaternion

FPS = 30

STYLE = {
    # crouch (m), stance yaw (deg), stance width/length (m), bounce (m), tempo (x), guard height offset
    "dayo": dict(crouch=0.09, yaw=-32, width=0.34, length=0.42, bounce=0.022, tempo=1.25, guard=0.0, lean=8),
    "bisi": dict(crouch=0.06, yaw=-26, width=0.38, length=0.36, bounce=0.012, tempo=0.85, guard=-0.02, lean=5),
    "emeka": dict(crouch=0.05, yaw=-36, width=0.32, length=0.46, bounce=0.03, tempo=1.15, guard=-0.04, lean=4),
    "femi": dict(crouch=0.08, yaw=-30, width=0.34, length=0.40, bounce=0.015, tempo=1.05, guard=0.01, lean=10),
    "kola": dict(crouch=0.10, yaw=-20, width=0.42, length=0.34, bounce=0.008, tempo=0.8, guard=0.02, lean=9),
    "chief": dict(crouch=0.07, yaw=-28, width=0.36, length=0.40, bounce=0.014, tempo=1.0, guard=0.0, lean=6),
    "ref": dict(crouch=0.0, yaw=0, width=0.30, length=0.0, bounce=0.004, tempo=1.0, guard=0.0, lean=0),
}


def ease(t):
    t = max(0.0, min(1.0, t))
    return t * t * (3 - 2 * t)


def punch_curve(t, out=0.35, hold=0.15):
    """0 -> 1 fast, short hold, slower return. t in [0,1]."""
    if t < out:
        return ease(t / out)
    if t < out + hold:
        return 1.0
    return 1.0 - ease((t - out - hold) / (1 - out - hold))


def run(fid, out):
    bpy.ops.wm.open_mainfile(filepath=os.path.join(out, fid + ".blend"))
    st = STYLE[fid]
    rig = bpy.data.objects[fid + "_rig"]
    pb = rig.pose.bones
    for b in pb:
        b.rotation_mode = 'QUATERNION'
    R = {b.name: b.matrix_local.copy() for b in rig.data.bones}  # rest, armature space
    head = lambda n: R[n].to_translation()

    sh_l, sh_r = head("upperarm_l"), head("upperarm_r")
    arm_len = (head("lowerarm_l") - sh_l).length + (head("hand_l") - head("lowerarm_l")).length
    eye_z = head("head").z + 0.09
    yaw = math.radians(st["yaw"])
    Rz = Matrix.Rotation(yaw, 4, 'Z')

    # ---- controls ----
    def empty(name, loc=(0, 0, 0)):
        e = bpy.data.objects.new(name, None)
        bpy.context.scene.collection.objects.link(e)
        e.location = loc
        return e

    tgt = {k: empty("T_" + k) for k in ("hand_l", "hand_r", "foot_l", "foot_r")}
    pole = {k: empty("P_" + k) for k in ("hand_l", "hand_r", "foot_l", "foot_r")}
    aim = {k: empty("A_" + k) for k in ("hand_l", "hand_r")}

    def ik(bone, target, polet, chain=2):
        c = pb[bone].constraints.new('IK')
        c.target = target
        c.pole_target = polet
        c.chain_count = chain
        c.use_tail = True
        return c

    iks = {
        "hand_l": ik("lowerarm_l", tgt["hand_l"], pole["hand_l"]),
        "hand_r": ik("lowerarm_r", tgt["hand_r"], pole["hand_r"]),
        "foot_l": ik("calf_l", tgt["foot_l"], pole["foot_l"]),
        "foot_r": ik("calf_r", tgt["foot_r"], pole["foot_r"]),
    }
    for s in ("l", "r"):
        c = pb["hand_" + s].constraints.new('DAMPED_TRACK')
        c.target = aim["hand_" + s]
        c.track_axis = 'TRACK_Y'

    def set_world_rot(name, q_world, loc=None):
        """Set a bone's armature-space orientation = q_world @ rest orientation."""
        m = R[name]
        rot = (q_world.to_matrix().to_4x4() @ Matrix(m.to_3x3()).to_4x4())
        t = loc if loc is not None else pb[name].matrix.to_translation()
        pb[name].matrix = Matrix.Translation(t) @ rot
        bpy.context.view_layer.update()

    pel0 = head("pelvis")

    def body(yaw_add=0.0, drop=0.0, lean=None, sway=0.0, head_yaw=None, crunch=0.0,
             tilt=0.0, roll=0.0, back=0.0, pel_z=None, head_pitch=0.0):
        """Pelvis/spine/head pose. Angles in radians."""
        lean = math.radians(st["lean"]) if lean is None else lean
        for b in pb:
            if b.name in ("pelvis", "spine_01", "spine_02", "spine_03", "neck_01", "head", "Root"):
                b.rotation_quaternion = Quaternion()
                b.location = Vector()
        bpy.context.view_layer.update()
        y_p = yaw * 0.75 + yaw_add * 0.4
        TR = Quaternion((0, 1, 0), roll) @ Quaternion((1, 0, 0), tilt)
        q = TR @ Quaternion((0, 0, 1), y_p)
        ploc = pel0 + Vector((sway, back, -st["crouch"] - drop))
        if pel_z is not None:
            ploc.z = pel_z
        set_world_rot("pelvis", q, ploc)
        y_s = yaw + yaw_add
        for i, n in enumerate(("spine_01", "spine_02", "spine_03")):
            yy = y_p + (y_s - y_p) * (i + 1) / 3
            q = TR @ Quaternion((0, 0, 1), yy) @ Quaternion((1, 0, 0), -(lean + crunch) * (i + 1) / 3)
            set_world_rot(n, q, pb[n].matrix.to_translation())
        hy = 0.0 if head_yaw is None else head_yaw
        q = TR @ Quaternion((0, 0, 1), hy) @ Quaternion((1, 0, 0), -math.radians(6) + head_pitch)
        set_world_rot("neck_01", TR @ Quaternion((0, 0, 1), hy * 0.5 + y_s * 0.5) @ Quaternion((1, 0, 0), -lean * 0.3 + head_pitch * 0.4), pb["neck_01"].matrix.to_translation())
        set_world_rot("head", q, pb["head"].matrix.to_translation())

    def feet(bounce=0.0, step=0.0, lead=None, rear=None, knee_up=0.0):
        if lead is None:
            lead = Vector((st["width"] / 2 + 0.02, -st["length"] / 2 - step, 0))
        if rear is None:
            rear = Vector((-st["width"] / 2, st["length"] / 2, 0))
        fz = head("foot_l").z
        tgt["foot_l"].location = Vector((lead.x, lead.y, fz))
        tgt["foot_r"].location = Vector((rear.x, rear.y, fz + bounce * 0.5))
        for s, p in (("l", lead), ("r", rear)):
            pole["foot_" + s].location = Vector((p.x * 1.2, p.y - 0.6 + 0.4 * knee_up, 0.55 + 0.8 * knee_up))

    def shoulder(s):
        return pb["upperarm_" + s].matrix.to_translation()

    def arm(s, wrist, aim_dir, elbow_hint):
        tgt["hand_" + s].location = wrist
        aim["hand_" + s].location = wrist + aim_dir.normalized() * 0.3
        pole["hand_" + s].location = elbow_hint

    def guard_pos(s, raise_=0.0):
        # gloves at chin height, lead glove a bit forward
        chin = Vector((0, -0.05, eye_z - 0.2 + st["guard"] + raise_))
        if s == "l":
            p = chin + Vector((0.09, -0.24, 0.03))
        else:
            p = chin + Vector((-0.07, -0.12, 0.0))
        return Rz @ p + Vector((0, 0, -st["crouch"]))

    def elbow_down(s, w):
        side = 1 if s == "l" else -1
        return w + Rz @ Vector((0.35 * side, 0.2, -0.6))

    def pose_guard(phase=0.0, raise_=0.0, extra=None):
        b = st["bounce"] * (0.5 - 0.5 * math.cos(2 * math.pi * phase))
        body(drop=b)
        feet(bounce=b)
        for s in ("l", "r"):
            w = guard_pos(s, raise_) + Vector((0, 0, -b * 0.6))
            w += Rz @ Vector((0, 0, 0.012 * math.sin(2 * math.pi * phase + (0 if s == "l" else 1.7))))
            arm(s, w, Rz @ Vector((0.0, -0.45, 1.0)), elbow_down(s, w))

    # ---- calibrate IK pole angles so elbows/knees follow their pole empties ----
    def calibrate():
        pose_guard()
        for key, c in iks.items():
            mid = "lowerarm_" + key[-1] if key.startswith("hand") else "calf_" + key[-1]
            best = None
            for ang in range(-180, 180, 15):
                c.pole_angle = math.radians(ang)
                bpy.context.view_layer.update()
                d = (pb[mid].matrix.to_translation() - pole[key].location).length
                if best is None or d < best[0]:
                    best = (d, ang)
            c.pole_angle = math.radians(best[1])
            print("pole", key, best)

    calibrate()

    # ---- clips: each is a function of normalised time t in [0,1] ----
    reach = arm_len * 0.97

    def clip_idle(t):
        pose_guard(t)

    def straight(s, t, height=0.0, rot=0.0, step=0.0):
        k = punch_curve(t)
        body(yaw_add=rot * k, drop=0.015 * k, crunch=math.radians(4) * k)
        feet(step=step * k)
        for side in ("l", "r"):
            g = guard_pos(side)
            if side == s:
                shp = shoulder(side)
                hit = Vector((shp.x * 0.3, shp.y - reach, eye_z - 0.1 + height - st["crouch"]))
                w = g.lerp(hit, k)
                ad = (Rz @ Vector((0.0, -0.45, 1.0))).lerp(Vector((0, -1, 0.05)), k)
                sd = 1 if side == "l" else -1
                e = elbow_down(side, w).lerp(w + Vector((0.45 * sd, 0.35, -0.25)), k)
                arm(side, w, ad, e)
            else:
                arm(side, g, Rz @ Vector((0.0, -0.45, 1.0)), elbow_down(side, g))

    def clip_jab(t):
        straight("l", t, rot=math.radians(-8), step=0.05)

    def clip_cross(t):
        straight("r", t, rot=math.radians(48), step=0.0)

    def clip_hook(t):
        k = punch_curve(t, out=0.4, hold=0.12)
        body(yaw_add=math.radians(40) * k, drop=0.03 * k)
        feet()
        g = guard_pos("l")
        # arc: out to the side, then round to the target's head
        ang = math.radians(-60 + 80 * k)
        centre = Vector((0, -0.25, eye_z - 0.08 - st["crouch"]))
        rad = arm_len * 0.62
        p = centre + Vector((rad * math.cos(ang) * 0.9, rad * math.sin(ang) * 0.6 - 0.12 * k, 0.02))
        w = g.lerp(p, ease(min(1, k * 1.3)))
        e = elbow_down("l", w).lerp(w + Vector((0.45, 0.25, 0.05)), k)
        arm("l", w, (Rz @ Vector((0.0, -0.45, 1.0))).lerp(Vector((-1, -0.3, 0.0)), k), e)
        gr = guard_pos("r")
        arm("r", gr, Rz @ Vector((0.0, -0.45, 1.0)), elbow_down("r", gr))

    def clip_block(t):
        k = punch_curve(t, out=0.2, hold=0.55)
        body(drop=0.03 * k, crunch=math.radians(10) * k, head_yaw=None)
        feet()
        for s in ("l", "r"):
            g = guard_pos(s)
            sd = 1 if s == "l" else -1
            up = Rz @ Vector((0.075 * sd, -0.13, 0.0)) + Vector((0, 0, eye_z - 0.13 - st["crouch"]))
            up.x = 0.065 * sd + (Rz @ Vector((0, -0.13, 0))).x
            w = g.lerp(up, k)
            arm(s, w, (Rz @ Vector((0.0, -0.45, 1.0))).lerp(Vector((0, -0.1, 1)), k),
                elbow_down(s, w).lerp(w + Vector((0.12 * sd, -0.05, -0.6)), k))

    def clip_victory(t):
        k = ease(min(1, t * 2.5))
        bob = 0.02 * math.sin(2 * math.pi * t * 2) * k
        body(yaw_add=-yaw * k, lean=math.radians(st["lean"]) * (1 - k) - math.radians(6) * k, drop=-0.02 * k + bob)
        feet()
        for s in ("l", "r"):
            g = guard_pos(s)
            sd = 1 if s == "l" else -1
            up = Vector((0.3 * sd, -0.05, eye_z + arm_len * 0.85))
            w = g.lerp(up, k)
            arm(s, w, (Rz @ Vector((0.0, -0.45, 1.0))).lerp(Vector((0.2 * sd, 0, 1)), k),
                elbow_down(s, w).lerp(w + Vector((0.6 * sd, 0.2, -0.3)), k))


    def guard_shift(s, dx=0.0, dz=0.0, dy=0.0):
        return guard_pos(s) + Vector((dx, dy, dz))

    def guard_arm(s, dx=0.0, dz=0.0, dy=0.0):
        g = guard_shift(s, dx, dz, dy)
        arm(s, g, Rz @ Vector((0.0, -0.45, 1.0)), elbow_down(s, g))

    def clip_uppercut(t):
        k = punch_curve(t, out=0.42, hold=0.12)
        dip = math.sin(min(1.0, k * 1.6) * math.pi) * 0.05
        body(yaw_add=math.radians(38) * k, drop=dip + 0.01, crunch=math.radians(6) * k)
        feet()
        g = guard_pos("r")
        shp = shoulder("r")
        mid = Vector((-0.04, -0.22, eye_z - 0.45 - st["crouch"]))
        end = Vector((0.02, shp.y - reach * 0.62, eye_z - 0.02 - st["crouch"]))
        if k < 0.4:
            w = g.lerp(mid, ease(k / 0.4))
        else:
            w = mid.lerp(end, ease((k - 0.4) / 0.6))
        arm("r", w, (Rz @ Vector((0.0, -0.45, 1.0))).lerp(Vector((0, 0.35, 1.0)), k),
            w + Vector((-0.12, 0.25, -0.45)))
        guard_arm("l")

    def clip_slip(t):
        k = punch_curve(t, out=0.3, hold=0.3)
        sx, dz = -0.12 * k, 0.08 * k
        body(drop=dz, sway=sx, roll=-0.22 * k, crunch=math.radians(8) * k)
        feet()
        for s in ("l", "r"):
            guard_arm(s, dx=sx * 1.6, dz=-dz * 1.3)

    def clip_duck(t):
        # bob and weave: knees bend, waist folds, head drops under the line of the punch
        k = punch_curve(t, out=0.28, hold=0.26)
        sx = 0.05 * math.sin(math.pi * t)
        body(drop=0.21 * k, sway=sx, crunch=math.radians(30) * k, head_pitch=-math.radians(10) * k)
        feet()
        for s in ("l", "r"):
            guard_arm(s, dx=sx, dz=-0.3 * k, dy=-0.04 * k)

    def clip_hit(t):
        k = punch_curve(t, out=0.22, hold=0.08)
        body(lean=math.radians(st["lean"]) - math.radians(14) * k, back=0.05 * k, head_pitch=math.radians(28) * k,
             yaw_add=math.radians(-10) * k)
        feet()
        for s in ("l", "r"):
            sd = 1 if s == "l" else -1
            guard_arm(s, dx=0.06 * sd * k, dz=0.05 * k, dy=0.08 * k)

    def clip_hitbody(t):
        k = punch_curve(t, out=0.22, hold=0.1)
        body(crunch=math.radians(22) * k, drop=0.06 * k, back=0.04 * k, head_pitch=-math.radians(6) * k)
        feet()
        for s in ("l", "r"):
            guard_arm(s, dz=-0.14 * k, dy=0.04 * k)

    def clip_down(t):
        # stagger, knees go, fall flat on the back (head toward the fighter's own corner)
        s1 = ease(min(1.0, t / 0.3))
        s2 = ease(max(0.0, (t - 0.25) / 0.6))
        z_stand = pel0.z - st["crouch"] - 0.14 * s1
        pz = z_stand + (0.11 - z_stand) * s2
        body(yaw_add=-yaw * max(s1, s2), lean=math.radians(st["lean"]) * (1 - s2), tilt=-math.radians(86) * s2,
             back=0.06 * s1 + 0.12 * s2, pel_z=pz, head_pitch=math.radians(20) * s1 - math.radians(10) * s2,
             roll=math.radians(4) * s2)
        lead0 = Vector((st["width"] / 2 + 0.02, -st["length"] / 2, 0))
        rear0 = Vector((-st["width"] / 2, st["length"] / 2, 0))
        lead1 = Vector((0.2, -0.78, 0))
        rear1 = Vector((-0.17, -0.70, 0))
        feet(lead=lead0.lerp(lead1, s2), rear=rear0.lerp(rear1, s2), knee_up=s2)
        for s in ("l", "r"):
            sd = 1 if s == "l" else -1
            g = guard_pos(s)
            shp = shoulder(s)
            floor = Vector((shp.x + 0.42 * sd, shp.y + 0.08, 0.07))
            sag = g + Vector((0.1 * sd, 0.05, -0.25))
            w = g.lerp(sag, s1).lerp(floor, s2)
            arm(s, w, Vector((0.3 * sd, 0.3, -1)).lerp(Vector((sd, 0.2, 0)), s2),
                (shp + w) / 2 + Vector((0.2 * sd, 0.1, -0.4)))

    # ---- referee ----
    def ref_side(s, phase=0.0):
        sd = 1 if s == "l" else -1
        shp = shoulder(s)
        return shp + Vector((0.1 * sd, 0.01, -0.56 + 0.006 * math.sin(2 * math.pi * phase)))

    def ref_arm_down(s, phase=0.0):
        sd = 1 if s == "l" else -1
        w = ref_side(s, phase)
        arm(s, w, Vector((0.05 * sd, 0, -1)), w + Vector((0.15 * sd, 0.45, 0.25)))

    def ref_idle(t):
        b = st["bounce"] * math.sin(2 * math.pi * t)
        body(drop=abs(b), sway=0.012 * math.sin(2 * math.pi * t))
        feet()
        ref_arm_down("l", t)
        ref_arm_down("r", t + 0.5)

    def ref_fight(t):
        a = ease(min(1.0, t / 0.35))
        b = ease(max(0.0, (t - 0.35) / 0.3))
        c = ease(max(0.0, (t - 0.8) / 0.2))
        body(lean=math.radians(6) * a * (1 - c))
        feet()
        for s in ("l", "r"):
            sd = 1 if s == "l" else -1
            shp = shoulder(s)
            rest = ref_side(s)
            front = Vector((0.06 * sd, shp.y - 0.42, shp.z - 0.08))
            apart = Vector((shp.x + 0.62 * sd, shp.y - 0.15, shp.z - 0.02))
            w = rest.lerp(front, a).lerp(apart, b).lerp(rest, c)
            arm(s, w, Vector((0.4 * sd, -1, 0)).lerp(Vector((sd, 0, 0)), b),
                w + Vector((0.15 * sd, 0.4, -0.35)))

    def ref_count(t):
        # one count: arm up, chop down, back up
        k = math.sin(math.pi * t)
        body(lean=math.radians(10) * k, drop=0.02 * k)
        feet()
        shp = shoulder("r")
        up = Vector((shp.x + 0.05, shp.y - 0.2, shp.z + 0.32))
        dn = Vector((shp.x + 0.08, shp.y - 0.5, shp.z - 0.25))
        w = up.lerp(dn, k)
        arm("r", w, Vector((0, -0.2, 1)).lerp(Vector((0, -1, -0.3)), k), w + Vector((-0.3, 0.25, -0.2)))
        ref_arm_down("l")

    def ref_win(s):
        def f(t):
            k = ease(min(1.0, t / 0.4))
            sd = 1 if s == "l" else -1
            body(roll=0.06 * sd * k)
            feet()
            shp = shoulder(s)
            up = Vector((shp.x + 0.38 * sd, shp.y - 0.05, shp.z + 0.5))
            w = ref_side(s).lerp(up, k)
            arm(s, w, Vector((0.05 * sd, 0, -1)).lerp(Vector((0.5 * sd, 0, 1)), k), w + Vector((0.3 * sd, 0.3, -0.3)))
            ref_arm_down("r" if s == "l" else "l")
        return f

    tempo = st["tempo"]
    clips = [
        ("Idle", clip_idle, round(30 / tempo)),
        ("Jab", clip_jab, round(14 / tempo)),
        ("Cross", clip_cross, round(18 / tempo)),
        ("Hook", clip_hook, round(22 / tempo)),
        ("Block", clip_block, 20),
        ("Victory", clip_victory, 60),
        ("Uppercut", clip_uppercut, round(20 / tempo)),
        ("Slip", clip_slip, 16),
        ("Duck", clip_duck, 18),
        ("Hit", clip_hit, 12),
        ("HitBody", clip_hitbody, 14),
        ("Down", clip_down, 54),
    ]
    if fid == "ref":
        clips = [("Idle", ref_idle, 60), ("Fight", ref_fight, 40), ("Count", ref_count, 30),
                 ("WinLeft", ref_win("l"), 45), ("WinRight", ref_win("r"), 45)]

    order = [b.name for b in pb]
    feet_rest_rot = {s: R["foot_" + s].to_3x3() for s in ("l", "r")}

    def capture():
        bpy.context.view_layer.update()
        m = {n: pb[n].matrix.copy() for n in order}
        for s, k in (("l", 0.45), ("r", 1.25)):  # feet flat on the floor; lead toe forward, rear turned out
            fl = m["foot_" + s].to_translation()
            rz = Matrix.Rotation(yaw * k, 3, 'Z')
            m["foot_" + s] = Matrix.Translation(fl) @ (rz @ feet_rest_rot[s]).to_4x4()
        return m

    baked = {}
    for name, fn, n in clips:
        frames = []
        loop = name in ("Idle",)
        for i in range(n + 1):
            t = i / n
            fn(t if not loop else t % 1.0)
            frames.append(capture())
        baked[name] = frames
        print("baked", name, n)

    # drop the rig controls; write plain keyframes
    for b in pb:
        for c in list(b.constraints):
            b.constraints.remove(c)
    for e in list(tgt.values()) + list(pole.values()) + list(aim.values()):
        bpy.data.objects.remove(e)

    rig.animation_data_create()
    bpy.context.scene.render.fps = FPS
    for name, frames in baked.items():
        act = bpy.data.actions.new(name)
        act.use_fake_user = True
        rig.animation_data.action = act
        for fi, m in enumerate(frames):
            for b in pb:
                b.rotation_quaternion = Quaternion()
                b.location = Vector()
            for n in order:
                pb[n].matrix = m[n]
                if n != "pelvis":
                    pb[n].location = Vector()  # only the pelvis translates; keeps feet bones attached
                bpy.context.view_layer.update()
            for n in order:
                if n == "Root" or n.startswith(("index", "middle", "ring", "pinky", "thumb")):
                    continue
                pb[n].keyframe_insert("rotation_quaternion", frame=fi + 1)
                if n == "pelvis":
                    pb[n].keyframe_insert("location", frame=fi + 1)
        tr = rig.animation_data.nla_tracks.new()
        tr.name = name
        tr.strips.new(name, 1, act)
        tr.mute = True
        rig.animation_data.action = None

    # leave the rig in guard (Idle frame 1) for stills
    rig.animation_data.action = bpy.data.actions["Idle"]
    bpy.context.scene.frame_set(1)
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(out, fid + "_posed.blend"))

    # ---- export ----
    rig.animation_data.action = None
    for o in bpy.data.objects:
        o.select_set(o.type in ('MESH', 'ARMATURE'))
    bpy.ops.export_scene.gltf(
        filepath=os.path.join(out, fid + ".glb"), export_format='GLB', use_selection=True,
        export_animations=True, export_animation_mode='NLA_TRACKS', export_skins=True,
        export_morph=False, export_yup=True, export_apply=False,
        export_draco_mesh_compression_enable=False,
    )
    print("EXPORTED", fid)


if __name__ == "__main__":
    run(sys.argv[1], sys.argv[2])
