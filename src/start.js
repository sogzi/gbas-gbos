// The page's entry point. Saves need a home before the game reads them (src/store.js), so the game loads once
// that's settled: at once on our own site, after CrazyGames' SDK is ready inside CrazyGames.
import { openStore } from './store.js';

openStore().then(() => import('./main.js'));
