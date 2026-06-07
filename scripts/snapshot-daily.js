import { writeFileSync, mkdirSync } from "node:fs";
import { sport } from "../src/index.js";

const KEYS = ["nba", "wnba", "nfl", "mlb", "nhl"];
const ymd = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit",
}).format(new Date()).replaceAll("-", "");

const sports = {};
let total = 0;
for (const k of KEYS) {
  const games = await sport(k).scoreboardClean({ dates: ymd });
  if (games.length) { sports[k] = games; total += games.length; }
}
if (total === 0) {
  console.log(`${ymd}: no games across ${KEYS.join(", ")} today; leaving snapshot unchanged`);
  process.exit(0);
}
mkdirSync("data", { recursive: true });
writeFileSync("data/latest.json", JSON.stringify({ date: ymd, sports }, null, 2) + "\n");
console.log(`${ymd}: wrote ${total} games across ${Object.keys(sports).length} sports -> data/latest.json`);
