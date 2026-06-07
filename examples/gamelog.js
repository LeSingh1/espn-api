import { sport } from "../src/index.js";

// Discover a player from a roster, then pull a CLEAN game log.
const nba = sport("nba");
const teams = await nba.teamsClean();
const roster = await nba.rosterClean(teams[0].id);
const player = roster[0];
console.log(`${player.name} (${teams[0].abbr})`);
const log = await nba.gamelogClean(player.id);
console.log("games:", log.length);
for (const g of log.slice(0, 5)) {
  console.log(`  ${g.date?.slice(0, 10)} ${g.atVs} ${g.opponent}  PTS ${g.stats.PTS}  REB ${g.stats.REB}  AST ${g.stats.AST}`);
}
