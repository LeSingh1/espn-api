import { sport } from "./client.js";
import { SPORTS } from "./sports.js";

export { SPORTS, resolve } from "./sports.js";
export { sport } from "./client.js";

// Convenience namespace: espn.nba.gamelog(id), espn.nfl.scoreboard({ dates }).
export const espn = Object.fromEntries(Object.keys(SPORTS).map((k) => [k, sport(k)]));
