// Fighter data from design/fighters.json (stats run 1-10), plus the numbers the demo plays by.

export const FIGHTERS = {
  dayo: {
    id: 'dayo',
    firstName: 'Dayo',
    fullName: 'Dayo Adeyemi',
    nickname: 'Danfo',
    district: 'Oshodi',
    style: 'Swarmer',
    stats: { power: 5, speed: 9, stamina: 7, defence: 4 },
    signature: { name: 'Last Stop', effect: 'Five-punch flurry ending in a hook. Hard to block, can be slipped.' },
    // the distance this fighter likes to work at (metres between the two fighters)
    range: 0.92, // swarmer: gets in your chest and stays there
    // how far each punch actually lands, measured from glove contact in game (tools: ?autoplay + sim)
    reach: { jab: 1.18, cross: 1.18, hook: 1.0, uppercut: 0.98 },
  },
  bisi: {
    id: 'bisi',
    firstName: 'Bisi',
    fullName: 'Bisi Adebayo',
    nickname: 'Mama Put',
    district: 'Ojuelegba',
    style: 'Slugger',
    stats: { power: 9, speed: 4, stamina: 8, defence: 6 },
    signature: { name: 'Pepper Soup', effect: 'Slow overhand right; on hit, stuns for 2 seconds.' },
    range: 0.86, // shorter arms: she has to walk you down and work inside
    reach: { jab: 0.94, cross: 0.93, hook: 0.85, uppercut: 0.84 },
  },
};

// Punches. `hit` is roughly where the glove arrives as a fraction of the clip (the glove has to
// actually touch the head, body or guard to count). `hand` 0 = lead/left, 1 = rear/right.
export const MOVES = {
  jab:      { clip: 'Jab',      hit: 0.42, dmg: 2.0, stam: 5,  react: 'Hit',     chip: 0.12, hand: 0 },
  cross:    { clip: 'Cross',    hit: 0.42, dmg: 3.0, stam: 7,  react: 'Hit',     chip: 0.15, hand: 1 },
  hook:     { clip: 'Hook',     hit: 0.50, dmg: 4.2, stam: 9,  react: 'HitBody', chip: 0.2,  hand: 0 },
  uppercut: { clip: 'Uppercut', hit: 0.50, dmg: 4.8, stam: 10, react: 'Hit',     chip: 0.4,  hand: 1 },
};

export const RULES = {
  rounds: 3,
  roundSeconds: 60,     // quick match; the full game uses 3-minute rounds
  restSeconds: 4,
  knockdownsForKO: 3,   // three knockdowns in the fight ends it
  ringHalf: 2.55,       // fighters stay inside +/- this on x
  minGap: 0.66,         // bodies never get closer than this
};

export const COLORS = {
  ground: 0x13110f, panel: 0x1f1b17, line: 0x3a332b, chalk: 0xf4eee3,
  yellow: 0xf5c518, red: 0xff6b35, blue: 0x4c8dff, green: 0x2e9e6b,
};
