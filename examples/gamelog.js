import { sport } from "../src/index.js";

// Find an athlete id from a team roster, then pull their game log.
// (Pass an id directly if you already have one: sport("wnba").gamelog("4433403"))
const nba = sport("nba");
const teams = await nba.teams();
const firstTeam = teams.sports[0].leagues[0].teams[0].team;
const roster = await nba.roster(firstTeam.id);
const player = roster.athletes?.[0]?.items?.[0] || roster.athletes?.[0];
if (!player) { console.log("no roster returned, try another team"); process.exit(0); }
console.log(`${player.displayName} (${firstTeam.displayName}) id=${player.id}`);
const log = await nba.gamelog(player.id);
const events = Object.values(log.events || {}).slice(0, 5);
console.log("last games:", events.map((e) => `${e.opponent?.abbreviation || "?"} ${e.gameDate?.slice(0, 10) || ""}`));
