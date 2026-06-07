import { sport } from "../src/index.js";

// No IDs needed, so this is the safest thing to run first.
const board = await sport("nba").scoreboard();
const games = (board.events || []).map((e) => e.name);
console.log("NBA games on the board:", games.length);
for (const g of games.slice(0, 8)) console.log("  " + g);
