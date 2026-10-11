// The cold-open movies, one per chapter. Lines come from the signed-off script in chapters.js; each
// film adds the blocking: where people stand, how they move, and what the camera does.
//
// frame(ctx) runs every frame with ctx.t (seconds) and must set everything from t alone.
// light(t) returns [preset, nextPreset, blend] from the presets in set.js.
import * as THREE from 'three';
import { seg, ease, V, walkPath } from './player.js';
import { EXTRA_FIGHTERS } from '../chapters.js';

const { PI, sin, cos } = Math;
const lerp = THREE.MathUtils.lerp;
const TUNDE = { model: 'dayo', colors: EXTRA_FIGHTERS.tunde.colors };
const yawTo = (from, to) => Math.atan2(to.x - from.x, to.z - from.z);
const lerpAngle = (a, b, k) => a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * k;

// stand at a spot, turning from one facing to another between t0 and t1
function turn(actor, pos, from, to, t, t0, t1) {
  actor.place(pos, lerpAngle(yawTo(pos, from), yawTo(pos, to), ease(seg(t, t0, t1))));
}
// hands loose, with a little talking movement while `talking`
function talk(actor, t, talking, side = 1) {
  const k = talking ? 1 : 0;
  Object.assign(actor.pose, {
    l: [-0.21, 0.97 + k * 0.04 * sin(t * 5.3), 0.03 + k * 0.12],
    r: [0.21 + k * 0.05, 0.97 + k * (0.1 + 0.07 * sin(t * 6.1 + 1)), 0.03 + k * 0.28],
    headPitch: k * 0.04 * sin(t * 4.4),
    tilt: side * k * 0.03 * sin(t * 2.3),
  });
}
// sit on a seat whose top is at `seatY` (world), feet out in front
function sit(actor, pos, yaw, seatY) {
  actor.place(pos, yaw);
  Object.assign(actor.pose, { drop: actor.hipY - (seatY - pos.y) - 0.04, lf: [-0.16, 0.07, 0.42], rf: [0.16, 0.07, 0.42], lean: 0.12 });
}
// over the shoulder of whoever is at `a`, looking at the face of whoever is at `b`
function ots(cam, a, b, { back = 1.3, side = 0.5, h = 1.66, lookH = 1.55, fov = 30 } = {}) {
  const f = V(b.x - a.x, 0, b.z - a.z).normalize();
  const right = V(-f.z, 0, f.x);
  cam(a.clone().addScaledVector(f, -back).addScaledVector(right, side).setY(h + a.y), V(b.x, b.y + lookH, b.z), fov);
}
// both of them in profile, from the road side of the line between them
function two(cam, a, b, { dist = 3.2, h = 1.6, lookH = 1.4, fov = 32, along = 0 } = {}) {
  const f = V(b.x - a.x, 0, b.z - a.z).normalize();
  let n = V(-f.z, 0, f.x);
  if (n.z < 0) n.negate();
  const mid = a.clone().lerp(b, 0.5).addScaledVector(f, along);
  cam(mid.clone().addScaledVector(n, dist).setY(h + mid.y), mid.clone().setY(mid.y + lookH), fov);
}
const handAt = (actor, s) => actor.bones[`hand_${s}`].getWorldPosition(new THREE.Vector3());
const speaking = (film, who, t) => film.lines.some(([a, b, w]) => w === who && t >= a && t < b);

// Dayo hanging off the danfo's door: left hand on the rail, leaning out, one foot on the step
function hang(dayo, bus, t, wave = true) {
  const step = bus.localToWorld(bus.userData.step.clone());
  dayo.place(step, bus.rotation.y + PI / 2);
  dayo.root.position.y -= 0.02;
  const P = dayo.pose;
  P.l = dayo.toBody(bus.localToWorld(bus.userData.grip.clone()));
  dayo.root.position.z += 0.12;
  P.tilt = 0.42 + sin(t * 3.1) * 0.03;
  P.lean = 0.1;
  P.headYaw = 0.5;
  P.lf = [-0.14, 0.06, 0.05];
  P.rf = [0.5, 0.36 + sin(t * 4) * 0.05, -0.08];
  P.r = wave ? [0.62, 1.52 + sin(t * 9) * 0.12, 0.35 + cos(t * 9) * 0.08] : [0.45, 1.0, 0.25];
}

const OSHODI_SHOPS = [
  ['PURE WATER ₦20', '#4C8DFF', '#F4EEE3'], ['OSHODI • OBALENDE • CMS', '#13110F', '#F5C518'], ['CHARGE YOUR PHONE ₦200', '#2E9E6B', '#F4EEE3'],
  ['GOD’S TIME IS THE BEST STORES', '#F5C518', '#13110F'], ['MAMA ALAKARA', '#E4572E', '#F4EEE3'], ['NO PARKING · LASTMA', '#F4EEE3', '#B3261E'],
];

export const FILMS = {
  1: {
    title: 'LAST STOP',
    district: 1,
    length: 34,
    names: { bridge: 'OSHODI', shops: OSHODI_SHOPS },
    cast: { dayo: { model: 'dayo' }, tunde: TUNDE },
    caps: [
      [1.2, 6.8, 'Oshodi. Six in the morning. Nobody in Lagos is late like Oshodi is late.'],
      [22.2, 26.8, 'QUIT NOTICE. This motor park is to be vacated in 30 days. ADEWALE HOLDINGS.'],
    ],
    lines: [
      [11.2, 17.2, 'DAYO', 'CMS, Obalende! Enter with your change o, I no get change!', 'p1'],
      [29.0, 33.4, 'TUNDE', 'From today, levy na double. Landlord’s orders.', 'p2'],
    ],
    setOpts: (t) => ({ clear: t > 17 ? [{ x: 13, z: 5.5, r: 5 }] : [], hideLane: t > 6.5 ? 'near' : null }),
    light: (t) => (t < 9 ? ['predawn', 'dawn', ease(seg(t, 0, 9))] : ['dawn', 'morning', seg(t, 9, 34) * 0.7]),
    frame({ t, cast, dress, move, cam }) {
      const { dayo, tunde } = cast;
      const bus = dress.hero;
      // the hero danfo: comes in fast, brakes at the park, then pulls off again
      const busX = t < 18 ? -36 + 48.6 * (1 - (1 - seg(t, 6, 18)) ** 2) : 12.6 + Math.max(0, t - 20.5) ** 2 * 1.4;
      bus.position.set(busX, Math.abs(sin(t * 11)) * 0.03 * (t < 18 ? 1 : 0), 2);
      const hop = seg(t, 18.1, 18.7);
      if (t < 18.1) hang(dayo, bus, t, t > 8.5);
      else if (t < 18.7) {
        // the hop down from the step to the kerb
        const a = V(11, 0.45, 3.2), b = V(11.2, 0.12, 4.7);
        const p = a.lerp(b, hop);
        p.y += sin(hop * PI) * 0.35;
        dayo.place(p, PI * 0.15);
        dayo.pose = { drop: sin(hop * PI) * 0.12, l: [-0.3, 1.2, 0.2], r: [0.3, 1.25, 0.2], lean: 0.15 };
      } else if (t < 27.6) {
        walkPath(dayo, t, 18.9, 21.2, [V(11.2, 0.12, 4.7), V(13.2, 0.12, 5.5), V(14.3, 0.12, 6.0)], V(15.5, 0.12, 6.84));
        if (t > 21.2) Object.assign(dayo.pose, { headPitch: 0.12, l: [-0.2, 0.98, 0.02], r: [0.2, 0.98, 0.02] });
      } else {
        // he turns to Tunde
        const turn = ease(seg(t, 27.6, 28.4));
        dayo.place(V(14.3, 0.12, 6.0), lerp(Math.atan2(15.5 - 14.3, 6.84 - 6.0), Math.atan2(12.9 - 14.3, 7.1 - 6.0), turn));
        Object.assign(dayo.pose, { l: [-0.2, 0.98, 0.02], r: [0.2, 0.98, 0.02], headYaw: 0 });
      }
      // Tunde walks out through the arch, then lays down the new law
      walkPath(tunde, t, 25.4, 29.0, [V(12.3, 0.13, 14), V(12.4, 0.12, 9), V(12.9, 0.12, 7.1)], V(14.3, 0.12, 6.0));
      if (t < 25.4) tunde.place(V(12.3, 0.13, 14), PI);
      if (t > 29) {
        const k = ease(seg(t, 29.6, 30.3)) * (1 - ease(seg(t, 32.2, 32.9)));
        Object.assign(tunde.pose, {
          l: [-0.18, 1.0, 0.05], r: [lerp(0.2, 0.1, k), lerp(0.98, 1.42, k), lerp(0.04, 0.5, k)], lean: -0.05, tilt: -0.04,
        });
      }

      // ---- camera ----
      // a crane down the road into the sunrise, over the footbridge
      if (t < 7) move(t, 0, 7, [V(-60, 15, 1.5), V(-22, 4, -1), 40], [V(-46, 3.4, 3.2), V(-14, 3.6, 0), 38]);
      else if (t < 11.5) {
        // roadside: the danfo comes at us, and we pan as it goes past
        const at = bus.position.clone().add(V(-1.2, 1.6, 0.6));
        move(t, 7, 11.5, [V(-3, 1.45, 5.4), at, 34], [V(-4, 1.6, 5.6), at, 30], (u) => u);
      } else if (t < 17.6) {
        // riding alongside the door, above the heads on the pavement
        const d = dayo.root.position;
        cam(V(d.x + 2.5, 2.25, 5.4), V(d.x, 1.7, 3.2), 32);
      } else if (t < 21.8) move(t, 17.6, 21.8, [V(7.6, 1.0, 5.9), V(11.5, 0.9, 4.5)], [V(9.4, 1.25, 4.5), V(14.2, 1.3, 6.3)]);
      else if (t < 26.6) move(t, 21.8, 26.6, [V(16.1, 1.85, 4.6), V(15.5, 1.7, 6.84), 30], [V(15.75, 1.78, 5.75), V(15.5, 1.75, 6.84), 24]);
      else move(t, 26.6, 34, [V(11.6, 1.55, 4.6), V(13.4, 1.45, 6.8), 34], [V(11.9, 1.58, 4.9), V(13.3, 1.5, 6.8), 30]);
    },
  },

  2: {
    title: 'MAMA PUT',
    district: 2,
    length: 23,
    names: {
      bridge: 'OJUELEGBA',
      shops: [['OJUELEGBA ROUNDABOUT', '#13110F', '#F5C518'], ['FAITH TAILORING', '#9B6BD6', '#F4EEE3'], ['BEST BOLE & FISH', '#E4572E', '#F4EEE3'], ['POS · TRANSFER ₦100', '#2E9E6B', '#F4EEE3'], ['FRESH ZOBO', '#B3261E', '#F4EEE3'], ['VULCANISER', '#F4EEE3', '#13110F']],
    },
    cast: { bisi: { model: 'bisi' }, dayo: { model: 'dayo' } },
    caps: [[1.2, 6.2, 'Ojuelegba. If you never chop Mama Put, you never reach Ojuelegba.']],
    lines: [
      [6.6, 11.2, 'BISI', 'Thirty days. Twenty years of jollof, and they give me thirty days.', 'p2'],
      [13.6, 16.4, 'DAYO', 'Madam, I’m here about that paper.', 'p1'],
      [17.0, 22.3, 'BISI', 'Another one. Tell your oga I don’t move.', 'p2'],
    ],
    light: () => ['noon', 'noon', 0],
    setOpts: (t) => ({ hideLane: t > 6.4 ? 'far' : null, clear: [{ x: 4, z: -4.5, r: 4 }] }),
    frame({ t, cast, dress, move, cam }) {
      const { bisi, dayo } = cast;
      const buka = dress.buka;
      const spot = buka.localToWorld(V(1.3, 0, -0.62));
      const pot = buka.localToWorld(V(1.3, 0.9, 0.2));
      const dayoAt = V(3.4, 0.12, -3.5);
      // stirring until Dayo speaks, then she turns on him with the ladle
      const facing = ease(seg(t, 16.6, 17.4));
      bisi.place(spot, lerpAngle(0, yawTo(spot, dayoAt), facing * 0.7));
      if (t < 16.8) {
        const a = t * 2.4;
        const stir = bisi.toBody(pot.clone().add(V(cos(a) * 0.16, 0.42, sin(a) * 0.12)));
        Object.assign(bisi.pose, { r: stir, l: [-0.24, 1.0, 0.18], lean: 0.18, headPitch: 0.15 });
      } else {
        const jab = sin(t * 3) * 0.04;
        Object.assign(bisi.pose, { r: [0.22, 1.32 + jab, 0.45], l: [-0.2, 0.98, 0.1], lean: 0.02 });
      }
      walkPath(dayo, t, 10.6, 14.0, [V(-6, 0.12, -4.4), V(1.5, 0.12, -4.0), dayoAt], spot);
      if (t >= 14) talk(dayo, t, speaking(FILMS[2], 'DAYO', t));

      if (t < 6.4) move(t, 0, 6.4, [V(-14, 2.6, 4.6), V(2, 2.2, -6), 36], [V(-2, 1.9, 3.6), V(4.5, 1.5, -5.4), 34]);
      else if (t < 11.2) move(t, 6.4, 11.2, [spot.clone().add(V(-1.0, 1.95, 4.2)), spot.clone().add(V(0, 1.35, 0)), 32], [spot.clone().add(V(-0.7, 1.9, 3.5)), spot.clone().add(V(0, 1.42, 0)), 28]);
      else if (t < 14) {
        const d = dayo.root.position;
        cam(V(d.x - 0.4, 1.6, -0.9), V(d.x + 1.8, 1.3, -4.6), 34);
      } else if (t < 16.6) two(cam, dayoAt, spot, { dist: 3.8, fov: 32 });
      else ots(cam, dayoAt, spot, { fov: 28 });
    },
    after({ cast, dress }) {
      // the ladle sits in her right hand, pointing down into the pot (or at Dayo)
      const h = handAt(cast.bisi, 'r');
      dress.ladle.position.copy(h);
      dress.ladle.lookAt(h.clone().add(V(0, -1, 0)));
      dress.ladle.rotateX(PI / 2);
    },
  },
  3: {
    title: 'EXPRESS LANE',
    district: 3,
    length: 25,
    names: {
      bridge: 'IKEJA · COMPUTER VILLAGE',
      shops: [['COMPUTER VILLAGE', '#4C8DFF', '#F4EEE3'], ['OTIGBA STREET', '#13110F', '#F5C518'], ['UK USED PHONES', '#E4572E', '#F4EEE3'], ['FIX AM FAST', '#F5C518', '#13110F'], ['ALLEN AVENUE →', '#2E9E6B', '#F4EEE3'], ['NO LOITERING', '#F4EEE3', '#B3261E']],
    },
    cast: { emeka: { model: 'emeka' }, dayo: { model: 'dayo' } },
    caps: [[1.2, 6.2, 'Ikeja. Everybody here is selling something. Emeka is selling speed.']],
    lines: [
      [12.6, 15.8, 'EMEKA', 'Sign here, oga. No vex, na just delivery.', 'p2'],
      [16.2, 19.2, 'DAYO', 'You’re the one carrying the Landlord’s papers.', 'p1'],
      [19.6, 24.4, 'EMEKA', 'I carry whatever pays. Since they ban okada, na this pays.', 'p2'],
    ],
    light: () => ['afternoon', 'afternoon', 0],
    setOpts: (t) => ({ hideLane: t > 10.2 ? 'far' : null, clear: [{ x: 0, z: -5, r: 3.5 }] }),
    frame({ t, cast, dress, move, cam }) {
      const { emeka, dayo } = cast;
      const bike = dress.bike;
      // in along the far lane, braking hard at the kerb
      const u = seg(t, 3.0, 9.5);
      const bx = 30 - 29 * (1 - (1 - u) ** 2.2);
      const bz = lerp(-2.0, -3.3, ease(seg(t, 7.5, 9.5)));
      bike.position.set(bx, Math.abs(sin(t * 13)) * 0.02 * (u < 1 ? 1 : 0), bz);
      bike.rotation.y = PI - (u < 1 ? 0.12 * sin(seg(t, 7.5, 9.5) * PI) : 0);
      bike.rotation.z = 0;
      const dayoAt = V(-0.6, 0.12, -5.3);
      if (t < 10) {
        // riding: on the seat, hands on the bars, feet on the pegs
        const seat = bike.localToWorld(V(-0.15, 0.92, 0));
        emeka.place(V(seat.x, 0, seat.z), bike.rotation.y + PI / 2);
        const P = emeka.pose;
        P.drop = emeka.hipY - seat.y + 0.02;
        P.lf = [-0.2, 0.42, 0.25];
        P.rf = [0.2, 0.42, 0.25];
        P.l = emeka.toBody(bike.localToWorld(V(0.55, 1.05, 0.3)));
        P.r = emeka.toBody(bike.localToWorld(V(0.55, 1.05, -0.3)));
        P.lean = 0.35;
      } else {
        walkPath(emeka, t, 10.4, 12.4, [V(1.4, 0.12, -4.4), V(0.4, 0.12, -4.8)], dayoAt);
        if (t < 10.4) emeka.place(V(1.4, 0.12, -4.4), dayoAt);
        const giving = t > 12.4 && t < 18.5;
        talk(emeka, t, speaking(FILMS[3], 'EMEKA', t), -1);
        if (giving) emeka.pose.r = [0.12, 1.15, 0.42];
        if (t > 19.6) Object.assign(emeka.pose, { l: [-0.3, 1.05 + 0.08 * sin(t * 3), 0.2], r: [0.3, 1.05 + 0.08 * sin(t * 3 + 1), 0.2] }); // the shrug
      }
      // Dayo is at the phone stall, then turns round to the delivery
      const stall = V(-0.6, 0.12, -6.4);
      turn(dayo, dayoAt, stall, V(0.4, 0.12, -4.8), t, 11.4, 12.2);
      talk(dayo, t, speaking(FILMS[3], 'DAYO', t));
      if (t > 13.4 && t < 18.5) dayo.pose.l = [-0.08, 1.12, 0.36];
      if (t < 11.4) Object.assign(dayo.pose, { headPitch: 0.25, l: [-0.12, 1.1, 0.25] });

      if (t < 6.2) move(t, 0, 6.2, [V(-16, 3.4, 3.8), V(-2, 2.4, -6.5), 36], [V(-6, 2.2, 3.4), V(0, 1.8, -6.2), 34]);
      else if (t < 10.2) {
        const at = bike.position.clone().add(V(0, 1.0, 0));
        cam(V(-3.5, 1.3, -0.5), at, 30);
      } else if (t < 16) two(cam, dayoAt, V(0.4, 0.12, -4.8), { dist: 3.0, fov: 32 });
      else if (t < 19.5) ots(cam, V(0.4, 0.12, -4.8), dayoAt, { fov: 28 });
      else ots(cam, dayoAt, V(0.4, 0.12, -4.8), { fov: 28 });
    },
    after({ t, cast, dress }) {
      const env = dress.envelope;
      env.visible = t > 10 && t < 18.5;
      if (env.visible) {
        env.position.copy(handAt(cast.emeka, 'r')).add(V(0, -0.02, 0));
        env.rotation.set(0, cast.emeka.root.rotation.y, 0.3);
      }
    },
  },
  4: {
    title: 'HOTFIX',
    district: 4,
    length: 24,
    names: {
      bridge: 'YABA · HERBERT MACAULAY WAY',
      shops: [['UNILAG GATE →', '#13110F', '#F5C518'], ['FAST WIFI · CO-WORKING', '#45B8AC', '#13110F'], ['TECH BRO SUYA', '#E4572E', '#F4EEE3'], ['PRINTING & BINDING', '#F4EEE3', '#13110F'], ['YABA MARKET', '#9B6BD6', '#F4EEE3'], ['GADGETS', '#4C8DFF', '#F4EEE3']],
    },
    cast: { femi: { model: 'femi' }, emeka: { model: 'emeka' }, dayo: { model: 'dayo' } },
    caps: [[1.2, 6.2, 'Yaba. Where Lagos writes its code, and fights about it after.']],
    lines: [
      [6.6, 10.8, 'FEMI', 'Four hundred and twelve sent, zero bugs. Clean deploy.', 'p2'],
      [14.2, 16.6, 'EMEKA', 'That’s him. Yaba Bug.', ''],
      [17.4, 23.2, 'FEMI', 'If you’re here about a bug report, there’s a form.', 'p2'],
    ],
    light: (t) => ['golden', 'golden', 0],
    setOpts: (t) => ({ hideLane: t > 6.4 ? 'far' : null, clear: [{ x: 4.5, z: -4.5, r: 3.5 }] }),
    frame({ t, cast, dress, move, cam }) {
      const { femi, emeka, dayo } = cast;
      const table = dress.table;
      const stool = table.localToWorld(V(0, 0, -0.85));
      const keys = table.localToWorld(V(0, 0.83, -0.08));
      const lookUp = ease(seg(t, 16.8, 17.5));
      sit(femi, V(stool.x, 0.12, stool.z), 0, 0.58);
      if (lookUp < 1) {
        // typing
        femi.pose.l = femi.toBody(keys.clone().add(V(0.09, 0.03 + Math.abs(sin(t * 17)) * 0.03, 0)));
        femi.pose.r = femi.toBody(keys.clone().add(V(-0.09, 0.03 + Math.abs(sin(t * 15 + 1)) * 0.03, 0)));
        femi.pose.headPitch = 0.3 * (1 - lookUp);
      }
      if (lookUp > 0) {
        femi.pose.lean = 0.12 - 0.15 * lookUp;
        femi.pose.headYaw = 0.35 * lookUp;
        if (lookUp >= 1) Object.assign(femi.pose, { l: [-0.15, 0.68, 0.32], r: [0.18, 0.82 + 0.04 * sin(t * 5), 0.38] });
      }
      walkPath(emeka, t, 9.8, 13.6, [V(-6, 0.12, -3.2), V(2, 0.12, -3.4), V(3.6, 0.12, -3.5)], V(stool.x, 0.12, stool.z));
      walkPath(dayo, t, 10.2, 14.2, [V(-6.6, 0.12, -2.6), V(2.6, 0.12, -2.6), V(4.6, 0.12, -2.8)], V(stool.x, 0.12, stool.z));
      if (t > 13.6) talk(emeka, t, speaking(FILMS[4], 'EMEKA', t));
      if (t > 14.2 && t < 16.6) emeka.pose.r = [0.25, 1.35, 0.5]; // pointing him out
      if (t > 14.2) talk(dayo, t, false);

      if (t < 6.4) move(t, 0, 6.4, [V(-12, 3.0, 3.2), V(4, 3.2, -8), 38], [V(0, 1.8, 2.2), V(4.8, 1.5, -6.4), 34]);
      else if (t < 10.8) move(t, 6.4, 10.8, [V(stool.x + 0.5, 1.55, stool.z + 2.9), V(stool.x, 0.95, stool.z), 30], [V(stool.x + 0.35, 1.5, stool.z + 2.3), V(stool.x, 1.0, stool.z), 26]);
      else if (t < 16.8) move(t, 10.8, 16.8, [V(9.5, 1.7, -0.6), V(3.6, 1.3, -3.4), 36], [V(8.8, 1.7, -0.9), V(4.4, 1.15, -4.8), 34]);
      else ots(cam, V(4.6, 0.12, -2.8), V(stool.x, 0.12, stool.z), { lookH: 1.0, h: 1.62, fov: 28 });
    },
  },
  5: {
    title: 'NO SHAKING',
    district: 5,
    length: 24,
    names: {
      bridge: 'MUSHIN',
      shops: [['IDI-ARABA →', '#13110F', '#F5C518'], ['AGEGE BREAD', '#F5C518', '#13110F'], ['OLUWASEUN BARBING SALOON', '#4C8DFF', '#F4EEE3'], ['MUSHIN MARKET', '#E4572E', '#F4EEE3'], ['GOD DEY PATENT MEDICINE', '#2E9E6B', '#F4EEE3'], ['NO URINATING HERE', '#F4EEE3', '#B3261E']],
    },
    cast: { kola: { model: 'kola', hands: false }, dayo: { model: 'dayo' } },
    caps: [[1.2, 6.6, 'Mushin. Twenty years of fighters came through this door. Most of them left it lying down.']],
    lines: [
      [11.4, 14.0, 'KOLA', 'Femi called me. You want the Landlord.', 'p2'],
      [14.4, 16.4, 'DAYO', 'I want my motor park.', 'p1'],
      [16.8, 23.4, 'KOLA', 'Same thing. Glove up. If you can’t move me, you can’t move him.', 'p2'],
    ],
    light: (t) => ['golden', 'dusk', 0.55 + seg(t, 0, 24) * 0.45],
    setOpts: (t) => ({ hideLane: t > 6.8 ? 'far' : null, clear: [{ x: 4.5, z: -5, r: 3.5 }] }),
    frame({ t, cast, dress, move, cam }) {
      const { kola, dayo } = cast;
      const bag = dress.bag;
      const bagAt = dress.frame.localToWorld(V(0, 1.6, 0));
      const kolaAt = V(bagAt.x - 0.75, 0.12, bagAt.z + 0.1);
      const dayoAt = V(bagAt.x + 1.5, 0.12, bagAt.z + 1.5);
      // Kola works the bag until Dayo is close, then turns to him
      const stop = ease(seg(t, 10.6, 11.4));
      kola.place(kolaAt, lerpAngle(PI / 2 - 0.15, yawTo(kolaAt, dayoAt), stop));
      let hit = 0;
      if (stop < 1) {
        const beat = (t * 1.6) % 1, hand = Math.floor(t * 1.6) % 2;
        const ext = beat < 0.35 ? sin((beat / 0.35) * PI) : 0;
        hit = beat < 0.35 ? Math.max(0, ext - 0.8) : 0;
        const tgt = kola.toBody(bagAt.clone().add(V(0.05, 0.1, 0)));
        const guard = (s) => [s * 0.13, 1.42, 0.24];
        Object.assign(kola.pose, { l: guard(-1), r: guard(1), lean: 0.12, drop: 0.06 });
        const s = hand ? 'r' : 'l';
        const g0 = guard(hand ? 1 : -1);
        kola.pose[s] = g0.map((v, i) => lerp(v, tgt[i], ext * (1 - stop)));
        kola.pose.twist = (hand ? -1 : 1) * 0.25 * ext;
      } else talk(kola, t, speaking(FILMS[5], 'KOLA', t), -1);
      // the bag swings from the last punch
      bag.rotation.z = sin(t * 3.2) * 0.08 * (1 - seg(t, 11, 16)) + hit * 0.1;
      bag.rotation.x = cos(t * 2.1) * 0.03;
      walkPath(dayo, t, 6.2, 10.8, [V(12, 0.12, -3.0), V(6, 0.12, -3.6), dayoAt], kolaAt);
      if (t > 10.8) talk(dayo, t, speaking(FILMS[5], 'DAYO', t));

      if (t < 6.8) move(t, 0, 6.8, [V(-10, 3.2, 3.6), V(3, 2.6, -7.5), 36], [V(1, 1.6, 0.4), V(3.6, 1.5, -6.2), 32]);
      else if (t < 11.2) move(t, 6.8, 11.2, [V(5.6, 1.35, -2.5), V(3.1, 1.4, -5.9), 30], [V(5.2, 1.45, -2.9), V(3.0, 1.4, -5.9), 27]);
      else if (t < 16.6) two(cam, kolaAt, dayoAt, { dist: 3.2, fov: 32 });
      else ots(cam, dayoAt, kolaAt, { fov: 27 });
    },
  },
  6: {
    title: 'QUIT NOTICE',
    district: 6,
    length: 30,
    names: {
      bridge: 'LAGOS ISLAND · MARINA',
      shops: [['BROAD STREET', '#13110F', '#F5C518'], ['CMS BUS STOP', '#F5C518', '#13110F'], ['BUREAU DE CHANGE', '#2E9E6B', '#F4EEE3'], ['ISALE EKO →', '#4C8DFF', '#F4EEE3'], ['MARINA', '#13110F', '#F4EEE3'], ['NO PARKING', '#F4EEE3', '#B3261E']],
    },
    cast: { chief: { model: 'chief' }, dayo: { model: 'dayo' } },
    caps: [[1.2, 5.8, 'Lagos Island. Last stop.']],
    lines: [
      [12.4, 17.2, 'CHIEF', 'The conductor from Oshodi. You’ve been collecting my champions like fares.', 'p2'],
      [17.6, 23.6, 'CHIEF', 'I’ll make you an offer. Come and work for me. Run the park for me. Your own bus, no levy.', 'p2'],
      [24.2, 29.4, 'DAYO', 'Four hundred and twelve families. Tear up the notices, or fight me.', 'p1'],
    ],
    setOpts: (t) => ({ hideLane: t > 6 ? 'far' : null, clear: [{ x: 1.5, z: -4.6, r: 3.5 }] }),
    light: () => ['night', 'night', 0],
    frame({ t, cast, dress, move, cam }) {
      const { chief, dayo } = cast;
      const suv = dress.suv;
      // the Landlord's car glides in along the far lane and stops at his building
      const u = seg(t, 3.5, 9.5);
      suv.position.set(lerp(34, 4.2, 1 - (1 - u) ** 2), 0, -2.0);
      suv.rotation.y = PI;
      const dayoAt = V(0.2, 0.12, -5.0);
      const chiefStop = V(2.3, 0.12, -4.4);
      // he gets out on the road side and walks round the bonnet to Dayo
      if (t < 9.8) chief.root.visible = false;
      else {
        chief.root.visible = true;
        walkPath(chief, t, 9.8, 12.6, [V(3.8, 0, -0.75), V(0.9, 0, -0.8), V(1.3, 0.12, -3.7), chiefStop], dayoAt);
        if (t > 12.6) talk(chief, t, speaking(FILMS[6], 'CHIEF', t), -1);
        if (t > 17.6 && t < 23.6) chief.pose.r = [0.3, 1.1, 0.42]; // the open hand: an offer
      }
      dayo.place(dayoAt, t < 9.5 ? yawTo(dayoAt, V(0.2, 0.12, -9)) : yawTo(dayoAt, V(suv.position.x, 0, -2)));
      if (t > 11.6) turn(dayo, dayoAt, V(0.9, 0, -0.8), chiefStop, t, 11.6, 12.6);
      talk(dayo, t, speaking(FILMS[6], 'DAYO', t));
      if (t < 9.5) Object.assign(dayo.pose, { headPitch: -0.35 }); // looking up at the tower

      if (t < 6) move(t, 0, 6, [V(-30, 18, 3.5), V(10, 20, -30), 42], [V(-12, 3, 3.5), V(2, 6, -8), 38]);
      else if (t < 10.4) move(t, 6, 10.4, [V(-3.2, 1.3, -2.6), V(6, 1.4, -2.4), 34], [V(-2.8, 1.35, -2.8), V(3.5, 1.2, -2.2), 32]);
      else if (t < 17.4) {
        const c = chief.root.position;
        if (t < 12.4) cam(V(-1.2, 1.6, 0.6), V(c.x, 1.5, c.z), 34);
        else two(cam, dayoAt, chiefStop, { dist: 3.4, fov: 32 });
      } else if (t < 23.8) ots(cam, dayoAt, chiefStop, { fov: 27, lookH: 1.62 });
      else ots(cam, chiefStop, dayoAt, { fov: 27 });
    },
  },
};
