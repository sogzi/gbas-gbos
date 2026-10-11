# Gbas Gbos!

Lagos Fight Night: a street and ring boxing game. The game opens on Mode Select:

- **VS CPU** (Quick Match): six fighters, a referee and a 3-round fight against the CPU.
- **Lagos Life Career** (Story mode, "Last Stop"): six chapters from Oshodi to Lagos Island.
- Online and Training show as coming soon.

There is no crowd and no crowd sound yet, and no sign-up.

## Play

```bash
npm install
npm run dev       # http://localhost:5173
npm run build     # static site in dist/
```

### Deploy on Vercel

Import the repo in Vercel. It detects Vite on its own: the build command is `npm run build` and the output directory is `dist`. There are no environment variables.

## The match

- Pick a fighter for each corner: tap a corner, then a fighter. Mirror matches are allowed. CPU difficulty can be Easy, Normal or Hard. All six are open in Quick Match; in the full game Femi, Kola and Chief are unlocked through Career and Lagos Life.

| # | Fighter | District | Style | Pow/Spd/Sta/Def | Signature |
|---|---|---|---|---|---|
| 01 | Dayo "Danfo" Adeyemi | Oshodi | Swarmer | 5/9/7/4 | **Last Stop**: five-punch flurry ending in a hook. Hard to block, can be slipped. |
| 02 | Bisi "Mama Put" Adebayo | Ojuelegba | Slugger | 9/4/8/6 | **Pepper Soup**: slow overhand right that stuns for 2 seconds. |
| 03 | Emeka "Okada" Nwosu | Ikeja | Out-boxer | 5/8/6/8 | **Express Lane**: a slip nothing can touch, carrying him in for a hook and a cross. |
| 04 | Femi "Yaba Bug" Ogunleye | Yaba | Counter-puncher | 5/7/5/9 | **Hotfix**: a 1.2 s parry; anything that lands in it is turned away, the attacker staggers, and Femi counters. |
| 05 | Kola "Iron Mushin" Bakare | Mushin | Tank | 7/3/10/7 | **No Shaking**: 3 s with no hit-stun while stamina refills. |
| 06 | Chief Adewale "The Landlord" | Lagos Island | Champion | 8/6/8/8 | **Quit Notice**: heavy overhand right; instant KO if the opponent is under 15% health. |

- There are 3 rounds of 60 seconds. When health runs out it's a knockdown, and the referee counts. You get up before 10 or you're counted out. Three knockdowns end the fight (T.K.O.). If both fighters are standing after round 3, three judges score it, 10-9 per round with a point off for each knockdown.
- Land punches (and make the other fighter miss) to fill the 3 signature pips, then fire the signature.
- A jab thrown right after a jab becomes a cross (the one-two). A punch that lands while the other fighter is punching, or just after they miss, is a counter, and it does extra damage (Femi's most of all). Stamina drains as you punch and refills when you rest. Tired fighters punch slower and softer.
- **Duck** bends you at the waist under the punch. While you're low, jabs, crosses and hooks to the head go over. Body shots still land, and an uppercut thrown at a ducking fighter hurts more. Like the slip, it's a read: a jab arrives in about a tenth of a second, so duck as the punch starts, not after.

### Controls

| Action | Keyboard | Touch |
|---|---|---|
| Move | A / D or ← / → | ◀ ▶ |
| Jab (twice for jab-cross) | J | JAB |
| Hook | K | HOOK |
| Uppercut | L | UPPER |
| Block (hold) | Space | BLOCK (hold) |
| Slip | Shift | SLIP |
| Duck | S or ↓ | DUCK |
| Signature | J + L together | SIG |
| Pause | Esc or P | ❚❚ |

When you're knocked down, mash any punch to get up sooner. Touch controls appear on phones and tablets. The game plays in portrait too, but landscape gives the best view. On iPhone, Share › Add to Home Screen runs it full screen without the browser bars.

### Boxing physics

Animation drives the bodies and physics layers on top. It is not a full ragdoll.

- **Contact:** a punch only counts when the glove actually touches. The glove's path each frame is swept against the opponent's head, body, and guard (when blocking). Two-bone arm IK aims the punch at the head, and the target locks halfway through, so slipping or stepping back makes it miss. Reach is measured, not made up: Dayo's jab lands at about 1.18 m, Bisi's at 0.94 m.
- **Hit reactions:** the head and torso are thrown by an angular impulse from where and how hard the glove landed (r × v). Damped springs then settle them back. There is a short hit-stop on impact, sweat spray, and dust when someone hits the canvas.
- **Weight:** footwork accelerates instead of snapping to speed. Fighters have mass, so knockback, clinch pushing and momentum all favour the heavier one. The ropes are springs that send you back in and visibly give.
- **Armour:** Bisi (slugger) and Kola (tank) walk through light shots, and through slightly heavier ones while they're punching.
- Reach for every fighter was measured the same way, from glove contact against Dayo (Dayo against Bisi). The shortest jab is Bisi's (0.94 m) and the longest is Emeka's (1.22 m).

## Story mode

Dayo, a danfo conductor, fights one champion per district to stop the Landlord's quit notices: Tunde (Oshodi), Bisi (Ojuelegba), Emeka (Ikeja), Femi (Yaba), Kola (Mushin) and Chief Adewale (Lagos Island).

- **Cold-open movies:** the first time through, each chapter opens with a short animated movie shot on a Lagos street set, redressed per district and lit for the time of day (Oshodi at dawn through to Lagos Island at night). Chapter 1 opens on Oshodi waking up, then Dayo hanging off a moving danfo. Skip (or Esc) jumps straight on. The movies live in `src/story/movie/`: `set.js` (the street, traffic, crowd, lighting), `actor.js` (fighter models posed with IK, with bare hands), `films.js` (blocking and camera for each chapter) and `player.js`.
- **A ring for every district:** each chapter's fight happens on that district's street. The ring and ropes stay the same, but the signs, sky, light and props change: danfos and a quit-notice board at Oshodi in the morning, the buka at Ojuelegba at noon, phone stalls at Ikeja, suya smoke at golden hour in Yaba, the boxing club at dusk in Mushin, and the towers at night on Lagos Island. This lives in `src/story/venues.js`. It only changes looks, never how the fight plays, and Quick Match always gets its usual street.
- **Scenes:** the face-off before a fight and the scenes after it are captioned panels over the live 3D fighters. Tap, Enter or Space moves on, and Skip (or Esc) jumps to the fight. A retry skips the movie and goes straight to the face-off.
- **Twists:** every chapter after Oshodi has one twist and one optional bonus goal for extra Street Rep:
  - Ojuelegba: land 10 body shots (hooks).
  - Ikeja: Emeka dodges more; land 3 punches straight off a duck.
  - Yaba: Femi's Hotfix meter refills on its own; get parried 2 times or fewer.
  - Mushin: Kola fires No Shaking every round and gets up fast; score a knockdown.
  - Lagos Island: Chief on Hard. A red line marks 15% on your health, below which Quit Notice ends the fight.
- **Oshodi** is the tutorial: one 90-second round against Tunde, a recoloured Dayo, on Easy. On the first try the tips walk through the controls, and Dayo can't be knocked out, so he can only lose on the cards.
- **Saving:** there is no account or server yet. Progress is one small JSON record in `localStorage` (`gbasgbos.story.v1`), written after every chapter fight. **SAVE CODE** on the route map copies it out as text and loads it back, which moves progress to another phone or browser. Street Rep is worked out from what's been cleared, so replays never pay twice. When Lagos Life links, this record gets uploaded once.
- **Unlocks are cosmetic for now:** all six fighters stay open in Quick Match.
- The script lives in `src/story/chapters.js`; the controller in `src/story/story.js`; the save in `src/story/save.js`.
- Story changes the fight only through opt-in `rules` and `hooks` on `Match` and a CPU tweak. Quick Match passes neither and plays exactly as before. The district dressing is looks-only and Quick Match never calls it.

## How it's built

- **Vite + three.js.** No game engine. Everything is in `src/`:
  - `main.js`: renderer, camera, menus, results
  - `match.js`: rounds, clock, knockdowns, the count, judges
  - `fighter.js`: model, animation and the combat state machine
  - `ai.js`: CPU
  - `referee.js`, `arena.js`: the ring and the Lagos street
  - `input.js`: keyboard and touch
  - `physics.js`: hit volumes, glove sweeps, arm IK, hit-reaction springs, impact particles
  - `hud.js`, `audio.js`: synthesised bell and punches
- Fighter numbers come from `design/fighters.json` in the handoff and live in `src/data.js`. Damage, reach and round length are tuned there too.
- **Models** are in `public/models/*.glb`. Each is about 2.3 MB, rigged on a 53-bone game skeleton with baked clips:
  - Fighters: Idle, Jab, Cross, Hook, Uppercut, Block, Slip, Duck, Hit, HitBody, Down, Victory.
  - Portraits for the select screen are `public/img/<id>.jpg`, cropped from `tools/blender/scene.py <out> <id>`.
  - Referee: Idle, Fight, Count, WinLeft, WinRight.
- `tools/blender/` has the scripts that build the models: Blender 5 as the `bpy` Python module, plus MPFB2 (CC0) for the base bodies. To add a fighter, add a `FIGHTERS` entry in `build.py` and a `STYLE` entry in `pose.py`, then a `FIGHTERS` entry in `src/data.js` with its measured `reach`, and an AI `STYLE` in `src/ai.js`.
- Fonts: Anton and Bricolage Grotesque, OFL. The licences are in `public/fonts/`.
- Open `/?autoplay` to have the CPU box for P1 as well. This is useful for watching a full fight or testing. In the console, `await __gg.pick('kola', 'femi')` sets both corners.
- For Story: `__gg.story.play(n)` starts chapter n (if it's unlocked), `__gg.story.skip()` skips a scene, and `__gg.story.save` is the save (`reset()`, `exportCode()`, `importCode(code)`).
