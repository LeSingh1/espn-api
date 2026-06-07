import { sport } from "./client.js";
import { SPORTS } from "./sports.js";

export { SPORTS, resolve } from "./sports.js";
export { sport } from "./client.js";
export { parseScoreboard, parseTeams, parseRoster, parseGamelog } from "./parse.js";

// Convenience namespace: espn.nba.gamelogClean(id), espn.nfl.scoreboardClean().
export const espn = Object.fromEntries(Object.keys(SPORTS).map((k) => [k, sport(k)]));
