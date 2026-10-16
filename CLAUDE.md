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

Lade approved one physics change on 13 Oct 2026, from the moves review: punches 25% faster (`PUNCH_SPEED` in `src/data.js`), plus dash and rope pinning. Their tuning lives in `PUNCH_SPEED`, `PARRY`, `BODY`, `DASH` and `PIN` in `src/data.js`. Everything else above stays locked.

## Locked: Quick Match v0.3 (Lade, 11 Oct 2026)

"Lock this version. Its solid. Don't tamper with it." The snapshot is branch `release/v0.3-quick-match` (commit 7230fa0). New modes are built around Quick Match, not by changing it:
- Story mode changes a fight only through the opt-in `rules` and `hooks` on `Match`, `Fighter.minHp`, and a CPU tweak. Quick Match passes none of these.
- If a new mode needs Quick Match to behave differently, make it opt-in and say so in the PR.

## Story mode

- Script: `src/story/chapters.js`. Controller: `src/story/story.js`. Save: `src/story/save.js` (localStorage plus save codes; bump `VERSION` and extend `migrate()` if the format changes).
- Cold-open movies: `src/story/movie/`. They use their own scene and posable copies of the fighter models (`Actor`), never `Fighter`, so they can't touch the fight physics. Every film's `frame(ctx)` must set everything from `ctx.t` alone, so seek and skip stay exact.
- District rings: `src/story/venues.js` dresses the street around the ring for each chapter (signs, sky, lights, props) through `createVenues(arena).dress(n)`. It changes looks only. Never move the ring, ropes, posts or floor there. `dress(0)` restores the exact Quick Match street, and Quick Match and Mode Select always call it.
- The script was signed off by Lade from the "Gbas Gbos Story Mode: Draft Scripts" doc. Keep lines as written unless asked.

## Fight Night look

- `src/look/fightnight.js` is the game's look (Lade, 13 Oct 2026): night street, lighting rig, crowd, branded ring, sweat, glossy gloves, named trunks, bloom and grade. `?look=day` shows the original daylight look.
- Looks only. It dresses the arena and the fighters' materials after they load and renders through its own composer. It never moves the ring, ropes, posts or floor, and never touches fight logic or physics.

## Lagos Life

- `src/lagoslife.js` wraps the Vatar Games SDK (docs: https://lagoslife.app/developers/docs). It does nothing unless the page is framed, so direct visits never load it.
- Never trust the client for anything of value. Purchases (and any future cloud save or reward) must be verified by a server holding the `vtr_test_…`/`vtr_live_…` secret, via `POST /session/verify` and `GET /purchases/{id}`. Never put a secret in `src/`.
- Products live in `PRODUCTS` in `api/_vatar.js` and must match the dashboard's product ids. Today there is one: `naija-gloves`, a one-off, Story-only cosmetic. Quick Match never shows it. Ownership is remembered per Lagos Life player in localStorage (`gbasgbos.owned.v1`), because the API can't list what a player owns. It's cosmetic only, so nothing of value rests on that.
- Other portals frame the game too. CrazyGames (`*.crazygames.com` and its app origins) is in `frame-ancestors` in `vercel.json`, and the SDK isn't loaded when the parent is visibly not Lagos Life.
- Inside CrazyGames, saves go through their SDK's Data module instead of localStorage (`src/store.js`), because CrazyGames requires it for iframe games. The entry point `src/start.js` waits for it before loading `main.js`. Read and write saves through `store`, never `localStorage` directly, and add any new save key to `KEYS` there.
- Lagos Life's review needs: play at 375×812 portrait by touch, honouring `onPause`/`onResume`, sound only after the first tap, no logins, no outside payments or ads.

## Street Rep leaderboard

- One shared board for every player, with no sign-up. Server: `api/lb.js` (one function, all actions) on Upstash Redis through `api/_store.js` (REST, no package). Client: `src/rank.js`.
- Needs an Upstash Redis store connected to the Vercel project (it sets `KV_REST_API_URL`/`KV_REST_API_TOKEN`). Without it the API answers 503 `no_store` and fights just go unranked. Off Vercel, an in-memory store stands in for local tests. `LB_ADMIN_TOKEN` (optional) enables `op: 'remove'` to take a cheat off the boards.
- The first fight (Quick Match or Story) asks for a fight name once; "Not now" skips it for the visit. The server returns a player id and secret key, kept in localStorage (`gbasgbos.player.v1`). The Player Code (`GGP1-<id>.<key>`) moves a player, and the copy of their Story save the server keeps, to another device.
- Never trust the client for rep: the game reports what happened (win/loss/draw, method, round) against a one-use token from `op: 'start'`, and the server works out the rep, checks the fight lasted long enough, and rate-limits. Rep values live in `WIN` in `api/lb.js`.
- Story's own chapter rep (`save.rep()`, the Lagos Life score) is separate from leaderboard rep.
- A sample crowd (`api/_sample.js`, Lade 15 Oct 2026) goes on the boards once, the first time a board is read on a store (`seeded:v1`). Its players are marked `bot` and can't sign in; `op: 'unseed'` with the admin token takes them off.

## Checking things

```bash
npm run build
npx vite preview --port 4173
```

- Open `/?autoplay` to watch a CPU-vs-CPU fight.
- In the console, `__gg.sim(seconds)` steps the game without rendering. This is useful for headless runs.

## 3D assets

Fighters are built from `tools/blender/build.py` (the `FIGHTERS` dict) and animated by `tools/blender/pose.py` (the `STYLE` dict). Both need Blender 5 as the `bpy` module and MPFB2. The export goes to `public/models/<id>.glb`.
