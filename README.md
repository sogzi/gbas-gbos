# Gbas Gbos!

Lagos Fight Night: a street and ring boxing game. This is the **quick match demo**: two fighters, a referee and a 3-round fight against the CPU. There is no crowd and no crowd sound yet.

## Play

```bash
npm install
npm run dev       # http://localhost:5173
npm run build     # static site in dist/
```

### Deploy on Vercel

Import the repo in Vercel. It detects Vite on its own: the build command is `npm run build` and the output directory is `dist`. There are no environment variables.

## The match

- Pick **Dayo "Danfo"** (Oshodi swarmer: fast, light hands) or **Bisi "Mama Put"** (Ojuelegba slugger: slow, heavy hands). The CPU boxes as the other one. CPU difficulty can be Easy, Normal or Hard.
- There are 3 rounds of 60 seconds. When health runs out it's a knockdown, and the referee counts. You get up before 10 or you're counted out. Three knockdowns end the fight (T.K.O.). If both fighters are standing after round 3, three judges score it, 10-9 per round with a point off for each knockdown.
- Land punches to fill the 3 signature pips, then fire the signature:
  - **Last Stop** (Dayo): five-punch flurry ending in a hook. Hard to block, can be slipped.
  - **Pepper Soup** (Bisi): slow overhand right that stuns for 2 seconds.
- A jab thrown right after a jab becomes a cross (the one-two). A punch that lands while the other fighter is punching is a counter, and it does extra damage. Stamina drains as you punch and refills when you rest. Tired fighters punch slower and softer.

### Controls

| Action | Keyboard | Touch |
|---|---|---|
| Move | A / D or ← / → | ◀ ▶ |
| Jab (twice for jab-cross) | J | JAB |
| Hook | K | HOOK |
| Uppercut | L | UPPER |
| Block (hold) | Space | BLOCK (hold) |
| Slip | Shift | SLIP |
| Signature | J + L together | SIG |
| Pause | Esc or P | ❚❚ |

When you're knocked down, mash any punch to get up sooner. Touch controls appear on phones and tablets. The game plays in portrait too, but landscape gives the best view.

## How it's built

- **Vite + three.js.** No game engine. Everything is in `src/`:
  - `main.js`: renderer, camera, menus, results
  - `match.js`: rounds, clock, knockdowns, the count, judges
  - `fighter.js`: model, animation and the combat state machine
  - `ai.js`: CPU
  - `referee.js`, `arena.js`: the ring and the Lagos street
  - `input.js`: keyboard and touch
  - `hud.js`, `audio.js`: synthesised bell and punches
- Fighter numbers come from `design/fighters.json` in the handoff and live in `src/data.js`. Damage, reach and round length are tuned there too.
- **Models** are in `public/models/*.glb`. Each is about 2.3 MB, rigged on a 53-bone game skeleton with baked clips:
  - Fighters: Idle, Jab, Cross, Hook, Uppercut, Block, Slip, Hit, HitBody, Down, Victory.
  - Referee: Idle, Fight, Count, WinLeft, WinRight.
- `tools/blender/` has the scripts that build the models: Blender 5 as the `bpy` Python module, plus MPFB2 (CC0) for the base bodies. To add a fighter, add a `FIGHTERS` entry in `build.py` and a `STYLE` entry in `pose.py`.
- Fonts: Anton and Bricolage Grotesque, OFL. The licences are in `public/fonts/`.
- Open `/?autoplay` to have the CPU box for P1 as well. This is useful for watching a full fight or testing.
