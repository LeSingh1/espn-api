import assert from "node:assert";
import { parseGamelog, parseScoreboard, parseRoster, parseTeams } from "../src/parse.js";

// gamelog: zip labels + stat rows, join the date/opponent by eventId.
const gl = {
  labels: ["PTS", "REB", "AST"],
  events: { "1": { gameDate: "2026-01-01T00:00Z", opponent: { abbreviation: "NY" }, atVs: "vs" } },
  seasonTypes: [{ categories: [{ events: [{ eventId: "1", stats: ["20", "5", "7"] }] }] }],
};
const rows = parseGamelog(gl);
assert.strictEqual(rows.length, 1);
assert.strictEqual(rows[0].stats.PTS, "20");
assert.strictEqual(rows[0].opponent, "NY");
assert.strictEqual(rows[0].atVs, "vs");

// scoreboard: pick out home/away cleanly.
const sb = { events: [{ id: "9", name: "A at B", competitions: [{ status: { type: { state: "pre", shortDetail: "8pm" } }, competitors: [{ homeAway: "home", score: "0", team: { id: "1", abbreviation: "B" } }, { homeAway: "away", score: "0", team: { id: "2", abbreviation: "A" } }] }] }] };
assert.strictEqual(parseScoreboard(sb)[0].home.abbr, "B");
assert.strictEqual(parseScoreboard(sb)[0].away.abbr, "A");

// roster handles both grouped and flat shapes.
assert.strictEqual(parseRoster({ athletes: [{ items: [{ id: "5", displayName: "X", position: { abbreviation: "G" } }] }] })[0].name, "X");
assert.strictEqual(parseRoster({ athletes: [{ id: "6", displayName: "Y" }] })[0].id, "6");

// teams pulls from the nested sports->leagues->teams shape.
assert.strictEqual(parseTeams({ sports: [{ leagues: [{ teams: [{ team: { id: "1", abbreviation: "AT", displayName: "Atl" } }] }] }] })[0].abbr, "AT");

console.log("ok: parsers produce clean rows for gamelog, scoreboard, roster, teams");
