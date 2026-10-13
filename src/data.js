// Fighter data from design/fighters.json (stats run 1-10), plus the numbers the demo plays by.

export const FIGHTERS = {
  dayo: {
    id: 'dayo',
    firstName: 'Dayo',
    fullName: 'Dayo Adeyemi',
    nickname: 'Danfo',
    district: 'Oshodi',
    style: 'Swarmer',
    tagline: 'relentless pressure',
    stats: { power: 5, speed: 9, stamina: 7, defence: 4 },
    signature: { name: 'Last Stop', effect: 'Five-punch flurry ending in a hook. Hard to block, can be slipped.' },
    bio: 'Bus conductor who has never let a passenger ride free. Hanging off a moving danfo all day gave him balance and hands nobody can follow.',
    unlock: 'starter',
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
    tagline: 'one heavy hand',
    stats: { power: 9, speed: 4, stamina: 8, defence: 6 },
    signature: { name: 'Pepper Soup', effect: 'Slow overhand right; on hit, stuns for 2 seconds.' },
    bio: 'Runs the busiest buka on the street. Lifts pots of jollof that would break your back, and punches the same way.',
    unlock: 'starter',
    range: 0.86, // shorter arms: she has to walk you down and work inside
    reach: { jab: 0.94, cross: 0.93, hook: 0.85, uppercut: 0.84 },
    torso: 0.19, // thicker through the middle (torso hit capsule radius, metres)
    // walks through light shots: below this damage she takes it without flinching (higher while punching)
    armour: { light: 2.2, punching: 3.5, recover: 0.55 },
  },
  emeka: {
    id: 'emeka',
    firstName: 'Emeka',
    fullName: 'Emeka Nwosu',
    nickname: 'Okada',
    district: 'Ikeja',
    style: 'Out-boxer',
    tagline: 'in and out',
    stats: { power: 5, speed: 8, stamina: 6, defence: 8 },
    signature: { name: 'Express Lane', effect: 'Dash past an incoming punch and counter from the side.' },
    bio: 'Dispatch rider who knows every shortcut in Ikeja. Never where you threw the punch.',
    unlock: 'starter',
    range: 1.05, // long and lean: lives at the end of his jab
    reach: { jab: 1.22, cross: 1.14, hook: 1.06, uppercut: 1.02 },
  },
  femi: {
    id: 'femi',
    firstName: 'Femi',
    fullName: 'Femi Ogunleye',
    nickname: 'Yaba Bug',
    district: 'Yaba',
    style: 'Counter-puncher',
    tagline: 'reads you',
    stats: { power: 5, speed: 7, stamina: 5, defence: 9 },
    signature: { name: 'Hotfix', effect: 'Opens a parry window; anything landing in it is countered automatically.' },
    bio: 'Software engineer by day. Fights like he debugs: watch quietly, find the pattern, fix it.',
    unlock: 'career:yaba',
    counterMul: 1.6, // counters hit much harder than anyone else's (default 1.25)
    range: 0.94, // stays just outside, waiting for you to miss
    reach: { jab: 1.1, cross: 1.02, hook: 0.94, uppercut: 0.9 },
  },
  kola: {
    id: 'kola',
    firstName: 'Kola',
    fullName: 'Kola Bakare',
    nickname: 'Iron Mushin',
    district: 'Mushin',
    style: 'Tank',
    tagline: 'walks through punches',
    stats: { power: 7, speed: 3, stamina: 10, defence: 7 },
    signature: { name: 'No Shaking', effect: 'Shrugs off hit-stun for 3 seconds and refills stamina while doing it.' },
    bio: 'Twenty years in the Mushin gyms. Slow to get going, almost impossible to put down.',
    unlock: 'career:mushin',
    range: 0.88,
    reach: { jab: 1.06, cross: 1.06, hook: 0.9, uppercut: 0.94 },
    torso: 0.19,
    armour: { light: 1.8, punching: 3.0, recover: 0.6 },
  },
  chief: {
    id: 'chief',
    firstName: 'Chief',
    fullName: 'Chief Adewale',
    nickname: 'The Landlord',
    district: 'Lagos Island',
    style: 'Champion',
    tagline: 'does everything well',
    stats: { power: 8, speed: 6, stamina: 8, defence: 8 },
    signature: { name: 'Quit Notice', effect: 'A heavy overhand right. Instant KO when the opponent is under 15% health.' },
    bio: 'Former champion who now owns half the street. Final boss of Career mode, and he does not like late rent.',
    unlock: 'lagos-life:street-rep',
    range: 0.96,
    reach: { jab: 1.18, cross: 1.1, hook: 0.98, uppercut: 0.98 },
    torso: 0.17,
  },
};

export const ROSTER = ['dayo', 'bisi', 'emeka', 'femi', 'kola', 'chief'];

// where each fighter unlocks in the full game; Quick Match has them all open for the demo
export const UNLOCK_NOTE = {
  starter: 'Starter fighter',
  'career:yaba': 'Beat Yaba in Career',
  'career:mushin': 'Beat Mushin in Career',
  'lagos-life:street-rep': 'Street Rep unlock in Lagos Life',
};

// Punches. `hit` is roughly where the glove arrives as a fraction of the clip (the glove has to
// actually touch the head, body or guard to count). `hand` 0 = lead/left, 1 = rear/right.
export const MOVES = {
  jab:      { clip: 'Jab',      hit: 0.42, dmg: 2.0, stam: 5,  react: 'Hit',     chip: 0.12, hand: 0 },
  cross:    { clip: 'Cross',    hit: 0.42, dmg: 3.0, stam: 7,  react: 'Hit',     chip: 0.15, hand: 1 },
  hook:     { clip: 'Hook',     hit: 0.50, dmg: 4.2, stam: 9,  react: 'HitBody', chip: 0.2,  hand: 0 },
  uppercut: { clip: 'Uppercut', hit: 0.50, dmg: 4.8, stam: 10, react: 'Hit',     chip: 0.4,  hand: 1 },
};

// Every punch plays this much faster than its clip (signatures too, keeping their own pace relative to it).
export const PUNCH_SPEED = 1.25;

// Moves review, tier 1 (Lade, 13 Oct 2026)
export const PARRY = {
  window: 0.15,  // block pressed this soon before the punch lands turns it away
  stagger: 0.45, // the attacker is knocked off balance this long
  counterFor: 0.9, counterMul: 1.5, // the parrier's next punch inside this window hits harder
  missIfReleasedBy: 0.2, missOpen: 0.25, // a tap of block that parried nothing leaves you open this long
};
export const BODY = { dmgMul: 0.75, drain: 8, guardDmg: 0.5 }; // body shots: less damage, more stamina gone; a high guard only halves them
export const DASH = { speed: 3.4, stamina: 8, cooldown: 0.45, doubleTap: 0.26 };
export const PIN = { edge: 0.18, gap: 1.25, dmgMul: 1.2, regen: 0.5 }; // on the ropes: within `edge` of your own ropes with the opponent close

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
