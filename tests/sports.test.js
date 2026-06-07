import assert from "node:assert";
import { resolve, SPORTS } from "../src/sports.js";

// Mapping resolves and is case-insensitive.
assert.deepStrictEqual(resolve("nba"), { sport: "basketball", league: "nba" });
assert.deepStrictEqual(resolve("NFL"), { sport: "football", league: "nfl" });
// Unknown sport throws with a helpful message.
assert.throws(() => resolve("quidditch"), /unknown sport/);
// Covers a real spread of leagues.
assert.ok(Object.keys(SPORTS).length >= 12, "should map 12+ sports");

console.log("ok: mapping resolves", Object.keys(SPORTS).length, "sports, unknowns throw");
