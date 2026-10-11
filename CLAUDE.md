# Gbas Gbos: notes for Claude and other contributors

## Locked: boxing physics (signed off by Lade, 11 Oct 2026)

The boxing physics feel right. **Do not change them unless Lade explicitly asks for a physics change.** That covers both behaviour and tuning numbers.

Locked code:
- `src/physics.js`, the whole file: hit volumes, glove sweeps, arm IK, hit-reaction springs, impact particles.
- `src/match.js`:
  - `contact()`
  - the contact, impulse, hit-stop, knockback and camera-kick parts of `resolve()`
  - `_separate()` (mass-based pushing)
- `src/fighter.js`:
  - footwork momentum, rope springs, knockback scaling, and the weight-into-punch lean in `punch()`
  - `animate()` and its order: `restore`, then the mixer, then springs, then aim, then sample
- `src/arena.js`: the `ropes()` give.
- `RULES.minGap` and `RULES.ringHalf` in `src/data.js`.

Allowed without asking, as long as it doesn't alter how existing punches connect or react:
- New fighters and their measured `reach` table, plus new clips such as Duck.
- Signatures and other game rules layered on top: damage numbers, stun, armour. These live in `takeHit()` and the scoring part of `resolve()` (the duck window, the Hotfix parry, Quit Notice, counters).
- UI, audio and the arena look.

New fighters get their `reach` by measuring glove contact, not by guessing: place the two fighters at a range of gaps with `__gg.sim`, throw each punch, and record the largest gap where it still lands. The table in `src/data.js` is that gap plus about 0.06 m. Measure against Dayo (Dayo against Bisi) so the numbers compare.

If a feature truly needs a physics change, say so and ask first.

## Locked: Quick Match v0.3 (Lade, 11 Oct 2026)

"Lock this version. Its solid. Don't tamper with it." The snapshot is branch `release/v0.3-quick-match` (commit 7230fa0). New modes are built around Quick Match, not by changing it:
- Story mode changes a fight only through the opt-in `rules` and `hooks` on `Match`, `Fighter.minHp`, and a CPU tweak. Quick Match passes none of these.
- If a new mode needs Quick Match to behave differently, make it opt-in and say so in the PR.

## Story mode

- Script: `src/story/chapters.js`. Controller: `src/story/story.js`. Save: `src/story/save.js` (localStorage plus save codes; bump `VERSION` and extend `migrate()` if the format changes).
- The script was signed off by Lade from the "Gbas Gbos Story Mode: Draft Scripts" doc. Keep lines as written unless asked.

## Checking things

```bash
npm run build
npx vite preview --port 4173
```

- Open `/?autoplay` to watch a CPU-vs-CPU fight.
- In the console, `__gg.sim(seconds)` steps the game without rendering. This is useful for headless runs.

## 3D assets

Fighters are built from `tools/blender/build.py` (the `FIGHTERS` dict) and animated by `tools/blender/pose.py` (the `STYLE` dict). Both need Blender 5 as the `bpy` module and MPFB2. The export goes to `public/models/<id>.glb`.
