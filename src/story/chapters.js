// Story mode, "Last Stop": Dayo against the Landlord's quit notice, Oshodi to Lagos Island.
// Script source: the "Gbas Gbos Story Mode: Draft Scripts" doc (signed off by Lade, 11 Oct 2026).
//
// A panel is one beat of a scene: an optional caption (where and when), an optional speaker and line,
// which fighter the camera looks at (focus 'p1' | 'p2' | 'both') and poses to hold ({ p2: 'Down' }).
// Twists are opt-in hooks on the Match (see story.js); Quick Match never sees them.

// Tunde "Agbero" is Dayo's model in the Landlord's colours
export const EXTRA_FIGHTERS = {
  tunde: {
    base: 'dayo',
    firstName: 'Tunde',
    fullName: 'Tunde Bakare',
    nickname: 'Agbero',
    district: 'Oshodi',
    style: 'Tout',
    colors: { trunks: '#F4EEE3', band: '#7D5BD6', glove: '#D9A521', gcuff: '#D9A521', cuffboot: '#D9A521' },
  },
};

export const CHAPTERS = [
  {
    n: 1, district: 'Oshodi', title: 'Last Stop', opp: 'tunde', level: 'easy',
    rules: { rounds: 1, roundSeconds: 90 },
    rep: 20, tutorial: true,
    open: [
      { cap: 'Oshodi. Six in the morning. Nobody in Lagos is late like Oshodi is late.', focus: 'both' },
      { who: 'DAYO', line: 'CMS, Obalende! Enter with your change o, I no get change!', focus: 'p1' },
      { cap: 'QUIT NOTICE. This motor park is to be vacated in 30 days. ADEWALE HOLDINGS.', focus: 'both' },
      { who: 'TUNDE', line: 'From today, levy na double. Landlord’s orders.', focus: 'p2' },
    ],
    faceoff: [
      { who: 'DAYO', line: 'Put Baba’s money back.', focus: 'p1' },
      { who: 'TUNDE', line: 'Conductor wan fight? Your hand go tire before mine.', focus: 'p2' },
      { who: 'DAYO', line: 'My hand dey hang off bus since I was twelve. E no dey tire.', focus: 'p1' },
    ],
    win: [
      { who: 'BABA EKO', line: 'Dayo. You know whose boy that was?', focus: 'p2', pose: { p2: 'Down' } },
      { who: 'DAYO', line: 'Everybody knows. Chief Adewale. The Landlord.', focus: 'p1' },
      { who: 'BABA EKO', line: 'The Landlord no dey fight conductors. He fights champions. Every district get one. Beat all of them, and he go hear your name.', focus: 'both' },
      { who: 'DAYO', line: 'Then make I start from Ojuelegba. Last stop, Lagos Island.', focus: 'p1', pose: { p1: 'Victory' } },
    ],
    loss: [{ who: 'TUNDE', line: 'Go back to your bus, conductor.', focus: 'p2', pose: { p2: 'Victory' } }],
    retry: 'Oshodi no dey give up. Again?',
  },
  {
    n: 2, district: 'Ojuelegba', title: 'Mama Put', opp: 'bisi', level: 'normal',
    rep: 40, item: 'Pepper Soup recipe card',
    goal: { kind: 'body', label: 'BODY SHOTS (HOOKS)', target: 10, rep: 10 },
    coach: { absorbed: 'She no dey feel that one. Go downstairs.' },
    open: [
      { cap: 'Ojuelegba. If you never chop Mama Put, you never reach Ojuelegba.', focus: 'both' },
      { who: 'BISI', line: 'Thirty days. Twenty years of jollof, and they give me thirty days.', focus: 'p2' },
      { who: 'DAYO', line: 'Madam, I’m here about that paper.', focus: 'p1' },
      { who: 'BISI', line: 'Another one. Tell your oga I don’t move.', focus: 'p2' },
    ],
    faceoff: [
      { who: 'DAYO', line: 'I no be Landlord boy! I’m a conductor!', focus: 'p1' },
      { who: 'BISI', line: 'Then you’ll fight like one. Fast, and finished in one hit.', focus: 'p2' },
      { who: 'DAYO', line: 'Abeg, at least let me finish my food first.', focus: 'p1' },
    ],
    win: [
      { who: 'BISI', line: 'You no be Landlord boy. Landlord boys don’t hit that hard.', focus: 'p2' },
      { who: 'BISI', line: 'Eat. You’re going to the Island on an empty stomach?', focus: 'p2' },
      { who: 'DAYO', line: 'You’ll stand with me?', focus: 'p1' },
      { who: 'BISI', line: 'If they take Oshodi park today, they’ll take my buka tomorrow. Go to Ikeja. Emeka knows the roads, and he knows the Landlord’s trucks.', focus: 'both' },
    ],
    loss: [{ who: 'BISI', line: 'Come back when you’ve eaten something.', focus: 'p2', pose: { p2: 'Victory' } }],
    retry: 'Pot never done. Again?',
  },
  {
    n: 3, district: 'Ikeja', title: 'Express Lane', opp: 'emeka', level: 'normal',
    rep: 40,
    goal: { kind: 'duckCounter', label: 'PUNCHES OFF A DUCK', target: 3, rep: 10 },
    cpu: { slip: 0.45, duck: 0.35, defend: 0.15 },
    coach: { slips: 'Make him miss first. Duck, then come up with something.' },
    open: [
      { cap: 'Ikeja. Everybody here is selling something. Emeka is selling speed.', focus: 'both' },
      { who: 'EMEKA', line: 'Sign here, oga. No vex, na just delivery.', focus: 'p2' },
      { who: 'DAYO', line: 'You’re the one carrying the Landlord’s papers.', focus: 'p1' },
      { who: 'EMEKA', line: 'I carry whatever pays. Since they ban okada, na this pays.', focus: 'p2' },
    ],
    faceoff: [
      { who: 'EMEKA', line: 'You want to stop me? You first have to catch me.', focus: 'p2' },
      { who: 'DAYO', line: 'I catch moving buses every day.', focus: 'p1' },
      { who: 'EMEKA', line: 'Bus get one road. I get every road.', focus: 'p2' },
    ],
    win: [
      { who: 'EMEKA', line: 'You think I like delivering eviction letters? My mama’s shop is on that list too.', focus: 'p2' },
      { who: 'DAYO', line: 'Then stop carrying them.', focus: 'p1' },
      { who: 'EMEKA', line: 'Every notice comes from one app. RentPal, by Yaba Labs. The person who built it is in Yaba.', focus: 'p2' },
      { who: 'EMEKA', line: 'Climb on. I know a shortcut.', focus: 'both' },
    ],
    loss: [{ who: 'EMEKA', line: 'Too slow, conductor. Na why you dey stand for door.', focus: 'p2', pose: { p2: 'Victory' } }],
    retry: 'Traffic don clear. Again?',
  },
  {
    n: 4, district: 'Yaba', title: 'Hotfix', opp: 'femi', level: 'normal',
    rep: 50, item: 'RentPal leak', unlock: 'femi',
    goal: { kind: 'hotfixedMax', label: 'HOTFIXED', target: 2, rep: 10 },
    sigRefill: 0.2, // Femi's meter refills on its own, so the parry comes up more often
    coach: { hotfix: 'He’s waiting for you. Feint, wait for the parry to close, then go.' },
    open: [
      { cap: 'Yaba. Where Lagos writes its code, and fights about it after.', focus: 'both' },
      { who: 'FEMI', line: 'Four hundred and twelve sent, zero bugs. Clean deploy.', focus: 'p2' },
      { who: 'EMEKA', line: 'That’s him. Yaba Bug.', focus: 'both' },
      { who: 'FEMI', line: 'If you’re here about a bug report, there’s a form.', focus: 'p2' },
    ],
    faceoff: [
      { who: 'DAYO', line: 'Your app is throwing people out of their homes.', focus: 'p1' },
      { who: 'FEMI', line: 'My app sends reminders. What the client does with them isn’t my department.', focus: 'p2' },
      { who: 'DAYO', line: 'Then I’ll file my report by hand.', focus: 'p1' },
    ],
    win: [
      { who: 'FEMI', line: 'The district filter. Oshodi, Ojuelegba, Ikeja, Mushin. That’s not reminders, that’s a map.', focus: 'p2', pose: { p2: 'Down' } },
      { who: 'DAYO', line: 'A map of who he wants gone.', focus: 'p1' },
      { who: 'FEMI', line: 'I’m not deleting evidence. I’m saving it. Every notice, with its date and its seal.', focus: 'p2' },
      { who: 'FEMI', line: 'You’ll want Kola in Mushin. He trained the Landlord, back when the Landlord was nobody.', focus: 'both' },
    ],
    loss: [{ who: 'FEMI', line: 'Reproduced it. You drop your guard on the left after a hook.', focus: 'p2', pose: { p2: 'Victory' } }],
    retry: 'Patch your guard. Again?',
  },
  {
    n: 5, district: 'Mushin', title: 'No Shaking', opp: 'kola', level: 'normal',
    rep: 60, unlock: 'kola',
    goal: { kind: 'knockdown', label: 'KNOCKDOWN', target: 1, rep: 15 },
    ironEachRound: true, // fires No Shaking at the start of every round
    quickGetUp: true,
    coach: { iron: 'Don’t trade with him now. Move, and wait three seconds.' },
    open: [
      { cap: 'Mushin. Twenty years of fighters came through this door. Most of them left it lying down.', focus: 'both' },
      { who: 'KOLA', line: 'Femi called me. You want the Landlord.', focus: 'p2' },
      { who: 'DAYO', line: 'I want my motor park.', focus: 'p1' },
      { who: 'KOLA', line: 'Same thing. Glove up. If you can’t move me, you can’t move him.', focus: 'p2' },
    ],
    faceoff: [
      { who: 'KOLA', line: 'Hit me with your best one. I’ll wait.', focus: 'p2' },
      { who: 'DAYO', line: 'You’re not going to block?', focus: 'p1' },
      { who: 'KOLA', line: 'Blocking is for people who feel it.', focus: 'p2' },
    ],
    win: [
      { who: 'KOLA', line: 'Good. You hit like you’re angry at someone who isn’t here.', focus: 'p2' },
      { who: 'KOLA', line: 'Adewale. Bus conductor, CMS to Mushin. Best hands I ever trained.', focus: 'p2' },
      { who: 'DAYO', line: 'The Landlord was a conductor?', focus: 'p1' },
      { who: 'KOLA', line: 'Then he bought the bus. Then the park. Then the street. He forgot where he stood. Go and remind him. He fights Saturday night on the Island, and I’ll be in your corner.', focus: 'both' },
    ],
    loss: [{ who: 'KOLA', line: 'You fight like the bus is leaving without you. It isn’t. Slow down.', focus: 'p2', pose: { p2: 'Victory' } }],
    retry: 'Mushin no dey run. Again?',
  },
  {
    n: 6, district: 'Lagos Island', title: 'Quit Notice', opp: 'chief', level: 'hard',
    rep: 100, item: 'Oshodi Belt', unlock: 'chief',
    quitLine: true, // red line at 15% on Dayo's health, and a warning when the instant KO is armed
    corner: { round: 3, who: 'KOLA (CORNER)', line: 'He drops his right after the overhand. Every time. Since 2004.' },
    open: [
      { cap: 'Lagos Island. Last stop.', focus: 'both' },
      { who: 'CHIEF', line: 'The conductor from Oshodi. You’ve been collecting my champions like fares.', focus: 'p2' },
      { who: 'CHIEF', line: 'I’ll make you an offer. Come and work for me. Run the park for me. Your own bus, no levy.', focus: 'p2' },
      { who: 'DAYO', line: 'Four hundred and twelve families. Tear up the notices, or fight me.', focus: 'p1' },
    ],
    faceoff: [
      { who: 'CHIEF', line: 'I was standing at that same bus door before you were born.', focus: 'p2' },
      { who: 'DAYO', line: 'Kola told me. So you know what it costs to lose it.', focus: 'p1' },
      { who: 'CHIEF', line: 'Everything in Lagos costs something. Tonight, it costs you.', focus: 'p2' },
    ],
    win: [
      { who: 'CHIEF', line: 'Twenty years nobody has put me down. A conductor.', focus: 'p2', pose: { p2: 'Down' } },
      { who: 'CHIEF', line: 'The park is yours. All four hundred and twelve, cancelled.', focus: 'p2' },
      { cap: 'Back in Oshodi at dawn. Horns, drivers, Bisi serving jollof off the back of a bus.', who: 'BABA EKO', line: 'Last stop, Lagos Island. Who else could have done it?', focus: 'both', pose: { p1: 'Victory' } },
      { who: 'DAYO', line: 'Another notice?! … “Rent is still due on the first. Respectfully, the Landlord.”', focus: 'p1' },
    ],
    loss: [{ who: 'CHIEF', line: 'Consider this your quit notice. Thirty days. Use them well.', focus: 'p2', pose: { p2: 'Victory' } }],
    retry: 'The park is still standing. Again?',
    end: 'Story complete. Your Street Rep will carry over to Lagos Life when it links. Coming soon.',
  },
];

// three short lines per fighter, shown during story fights only
export const BARKS = {
  dayo: { scores: 'Oya, come down!', floored: 'I don hold worse door than this.', sig: 'Last stop!' },
  tunde: { scores: 'Levy don double!', floored: 'Landlord go hear this!' },
  bisi: { scores: 'You don chop belle-full?', floored: 'Who put pepper for my eye?', sig: 'Pepper Soup, hot hot!' },
  emeka: { scores: 'Shortcut!', floored: 'Na pothole, no be you.', sig: 'Express Lane!' },
  femi: { scores: 'Bug fixed.', floored: 'That’s a feature, not a bug.', sig: 'Pushing hotfix.' },
  kola: { scores: 'Mushin don land.', floored: 'I no feel am.', sig: 'No shaking!' },
  chief: { scores: 'Pay your rent.', floored: 'Twenty years…', sig: 'Quit notice served.' },
};

// the Oshodi tutorial: each tip shows while `when` holds and goes once `done` is true
export const TUTORIAL = [
  { key: 'move', keys: 'A / D to move. J to jab.', touch: '◀ ▶ to move. JAB to jab.', when: () => true, done: (s) => s.p1Landed >= 3 },
  { key: 'onetwo', keys: 'J twice for the one-two.', touch: 'JAB twice for the one-two.', when: (s) => s.p1Landed >= 3, done: (s) => s.p1Crosses >= 1 },
  { key: 'block', keys: 'SPACE to block.', touch: 'Hold BLOCK.', when: (s) => s.oppHook, done: (s) => s.p1Blocked >= 1 },
  { key: 'duck', keys: 'S to duck under it.', touch: 'DUCK under it.', when: (s) => s.oppStraight, done: (s) => s.p1Ducks >= 1 },
  { key: 'sig', keys: 'J + L together: Last Stop.', touch: 'SIG: Last Stop.', when: (s) => s.p1SigReady, done: (s) => s.p1Sigs >= 1 },
];
