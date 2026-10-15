// The sample crowd from the leaderboard concept (Lade, 15 Oct 2026): put on the board once, the first
// time it's read, so the street isn't empty on day one. Real players climb past them as they fight.
// They can't sign in (no key) and are marked `bot`; POST { op: 'unseed' } with the admin token takes
// them all off again.
//   name, main fighter, wins, losses, KOs, streak, rep
export const SAMPLE = [
  ['YabaLeftHook', 'femi', 38, 4, 21, 5, 1825],
  ['MamaT_Ikorodu', 'bisi', 31, 6, 17, 5, 1355],
  ['IslandLandlord', 'chief', 29, 8, 16, 1, 1184],
  ['Okada_Oga', 'emeka', 27, 9, 17, 6, 1076],
  ['DanfoDriver99', 'dayo', 25, 7, 17, 1, 1050],
  ['Buka_Queen', 'bisi', 22, 8, 9, 3, 937],
  ['IronMushin', 'kola', 24, 10, 13, 3, 906],
  ['SurulereSlugger', 'chief', 23, 12, 10, 2, 882],
  ['HotfixHenry', 'femi', 20, 9, 12, 5, 861],
  ['NoChangeNoWahala', 'dayo', 19, 8, 10, 2, 618],
  ['SuyaSlugger42', 'kola', 12, 9, 9, 1, 524],
  ['Keke_King', 'emeka', 9, 7, 6, 2, 285],
  ['JollofJab', 'dayo', 6, 6, 2, 1, 162],
  ['ZoboBomber', 'bisi', 3, 5, 2, 0, 65],
];

// fights picked this week, for the Most Picked bars (19/18/17/16/15/15%)
export const SAMPLE_PICKS = { dayo: 79, bisi: 73, chief: 69, femi: 67, emeka: 61, kola: 60 };

export const sampleId = (name) => `s_${name.toLowerCase()}`;
