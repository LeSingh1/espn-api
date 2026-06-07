import { sport } from "../src/index.js";

// scoreboardClean returns a tidy array instead of ESPN's nested JSON.
const games = await sport("nba").scoreboardClean();
console.log("NBA games:", games.length);
for (const g of games.slice(0, 8)) {
  console.log(`  ${g.away?.abbr || "?"} @ ${g.home?.abbr || "?"}  ${g.status || g.date}`);
}
