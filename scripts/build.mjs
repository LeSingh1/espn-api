#!/usr/bin/env node
// Builds the espn-api repo: a small, unofficial Node client for ESPN's hidden
// API. The API is unified across sports (/sports/{sport}/{league}/...), so this
// is one client covering every sport, not one repo per sport.
//   node build-espn-api.mjs   ->   ~/Claude/projects/espn-api

import { mkdirSync, writeFileSync, existsSync, rmSync, copyFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { homedir } from "node:os";

const DIR = join(homedir(), "Claude", "projects", "espn-api");
const AUTHOR = "Shaurya Singh";
if (existsSync(DIR)) rmSync(DIR, { recursive: true, force: true });
const w = (rel, content) => { const f = join(DIR, rel); mkdirSync(dirname(f), { recursive: true }); writeFileSync(f, content); };

w("src/sports.js", `// Sport + league mapping for ESPN's hidden API.
// The API is unified: every endpoint is the same path, only {sport}/{league}
// changes. That is why this is one client instead of one repo per sport.
export const SPORTS = {
  nba:    { sport: "basketball", league: "nba" },
  wnba:   { sport: "basketball", league: "wnba" },
  ncaam:  { sport: "basketball", league: "mens-college-basketball" },
  ncaaw:  { sport: "basketball", league: "womens-college-basketball" },
  nfl:    { sport: "football",   league: "nfl" },
  ncaaf:  { sport: "football",   league: "college-football" },
  mlb:    { sport: "baseball",   league: "mlb" },
  nhl:    { sport: "hockey",     league: "nhl" },
  pga:    { sport: "golf",       league: "pga" },
  atp:    { sport: "tennis",     league: "atp" },
  wta:    { sport: "tennis",     league: "wta" },
  ufc:    { sport: "mma",        league: "ufc" },
  f1:     { sport: "racing",     league: "f1" },
  // Soccer has many leagues. Default is the Premier League; pass any ESPN slug
  // to sport("soccer") via the league override, e.g. "usa.1" (MLS),
  // "esp.1" (La Liga), "uefa.champions".
  soccer: { sport: "soccer",     league: "eng.1" },
};

export function resolve(sportKey) {
  const s = SPORTS[String(sportKey).toLowerCase()];
  if (!s) throw new Error(\`unknown sport "\${sportKey}". known: \${Object.keys(SPORTS).join(", ")}\`);
  return s;
}
`);

w("src/client.js", `import { resolve } from "./sports.js";

const SITE = "https://site.api.espn.com/apis/site/v2";
const WEB  = "https://site.web.api.espn.com/apis/common/v3";

function qs(params) {
  const entries = Object.entries(params || {}).filter(([, v]) => v != null);
  return entries.length ? "?" + entries.map(([k, v]) => \`\${k}=\${encodeURIComponent(v)}\`).join("&") : "";
}

async function get(url) {
  const res = await fetch(url, { headers: { "user-agent": "espn-api (github.com/LeSingh1/espn-api)" } });
  if (!res.ok) throw new Error(\`ESPN \${res.status} for \${url}\`);
  return res.json();
}

// Returns an object with every endpoint bound to one sport's path. You can
// override the league (useful for soccer): sport("soccer", "usa.1").
export function sport(sportKey, leagueOverride) {
  const r = resolve(sportKey);
  const s = r.sport, l = leagueOverride || r.league;
  const base = \`\${SITE}/sports/\${s}/\${l}\`;
  const web  = \`\${WEB}/sports/\${s}/\${l}\`;
  return {
    sportKey, sport: s, league: l,
    // scores for a date, e.g. scoreboard({ dates: "20260906" })
    scoreboard: (params) => get(\`\${base}/scoreboard\${qs(params)}\`),
    teams:      () => get(\`\${base}/teams\`),
    team:       (teamId) => get(\`\${base}/teams/\${teamId}\`),
    roster:     (teamId) => get(\`\${base}/teams/\${teamId}/roster\`),
    athlete:    (athleteId) => get(\`\${web}/athletes/\${athleteId}\`),
    // the one that matters for prop models: a player's per-game log
    gamelog:    (athleteId) => get(\`\${web}/athletes/\${athleteId}/gamelog\`),
    splits:     (athleteId) => get(\`\${web}/athletes/\${athleteId}/splits\`),
    news:       (params) => get(\`\${base}/news\${qs(params)}\`),
    summary:    (eventId) => get(\`\${base}/summary\${qs({ event: eventId })}\`),
    standings:  () => get(\`\${base}/standings\`),
  };
}
`);

w("src/index.js", `import { sport } from "./client.js";
import { SPORTS } from "./sports.js";

export { SPORTS, resolve } from "./sports.js";
export { sport } from "./client.js";

// Convenience namespace: espn.nba.gamelog(id), espn.nfl.scoreboard({ dates }).
export const espn = Object.fromEntries(Object.keys(SPORTS).map((k) => [k, sport(k)]));
`);

w("examples/scoreboard.js", `import { sport } from "../src/index.js";

// No IDs needed, so this is the safest thing to run first.
const board = await sport("nba").scoreboard();
const games = (board.events || []).map((e) => e.name);
console.log("NBA games on the board:", games.length);
for (const g of games.slice(0, 8)) console.log("  " + g);
`);

w("examples/gamelog.js", `import { sport } from "../src/index.js";

// Find an athlete id from a team roster, then pull their game log.
// (Pass an id directly if you already have one: sport("wnba").gamelog("4433403"))
const nba = sport("nba");
const teams = await nba.teams();
const firstTeam = teams.sports[0].leagues[0].teams[0].team;
const roster = await nba.roster(firstTeam.id);
const player = roster.athletes?.[0]?.items?.[0] || roster.athletes?.[0];
if (!player) { console.log("no roster returned, try another team"); process.exit(0); }
console.log(\`\${player.displayName} (\${firstTeam.displayName}) id=\${player.id}\`);
const log = await nba.gamelog(player.id);
const events = Object.values(log.events || {}).slice(0, 5);
console.log("last games:", events.map((e) => \`\${e.opponent?.abbreviation || "?"} \${e.gameDate?.slice(0, 10) || ""}\`));
`);

w("tests/sports.test.js", `import assert from "node:assert";
import { resolve, SPORTS } from "../src/sports.js";

// Mapping resolves and is case-insensitive.
assert.deepStrictEqual(resolve("nba"), { sport: "basketball", league: "nba" });
assert.deepStrictEqual(resolve("NFL"), { sport: "football", league: "nfl" });
// Unknown sport throws with a helpful message.
assert.throws(() => resolve("quidditch"), /unknown sport/);
// Covers a real spread of leagues.
assert.ok(Object.keys(SPORTS).length >= 12, "should map 12+ sports");

console.log("ok: mapping resolves", Object.keys(SPORTS).length, "sports, unknowns throw");
`);

w("package.json", JSON.stringify({
  name: "espn-api", version: "1.0.0", type: "module", private: false,
  description: "Small unofficial Node client for ESPN's hidden API. One client, every sport.",
  scripts: { test: "node tests/sports.test.js", scoreboard: "node examples/scoreboard.js", gamelog: "node examples/gamelog.js" },
  license: "MIT", author: AUTHOR,
}, null, 2) + "\n");

w(".gitignore", "node_modules/\n*.log\n.DS_Store\n.env\n");

w("LICENSE", `MIT License

Copyright (c) 2026 ${AUTHOR}

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED. IN NO EVENT SHALL THE AUTHORS BE LIABLE FOR ANY CLAIM, DAMAGES OR
OTHER LIABILITY ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
USE OR OTHER DEALINGS IN THE SOFTWARE.
`);

w("README.md", `# espn-api

A small, unofficial Node client for ESPN's hidden API. One client that covers
every sport, because ESPN's API is one API.

I built this as the data layer under EdgeBoard and the edge-models projects.
Those models project player props from game logs, and the game logs come from
here.

## Why one repo and not one per sport

ESPN's endpoints are the same for every sport. Only the path changes:

\`\`\`
/sports/{sport}/{league}/scoreboard
/sports/{sport}/{league}/teams/{id}/roster
/sports/{sport}/{league}/athletes/{id}/gamelog
\`\`\`

So "nba", "nfl", "mlb" and the rest are the same code with a different
\`{sport}/{league}\` string. Splitting that into 13 repos would just be 13 copies
of one file. (This is the opposite of swar/nba_api, which is NBA only because
NBA.com runs its own separate stats API.) The sport map is in
[src/sports.js](src/sports.js).

## Install and run

No dependencies. Node 18+ (it uses the built-in fetch).

\`\`\`
git clone https://github.com/LeSingh1/espn-api
cd espn-api
node examples/scoreboard.js     # NBA games on the board right now
node examples/gamelog.js        # pull a real player's game log
node tests/sports.test.js
\`\`\`

## Use it

\`\`\`js
import { sport, espn } from "./src/index.js";

await sport("nfl").scoreboard({ dates: "20260906" });
await sport("wnba").gamelog("4433403");        // a player's per-game log
await espn.nba.teams();                         // same thing, namespace style
await sport("soccer", "usa.1").scoreboard();    // override the league for soccer
\`\`\`

Each sport gives you: \`scoreboard\`, \`teams\`, \`team\`, \`roster\`, \`athlete\`,
\`gamelog\`, \`splits\`, \`news\`, \`summary\`, \`standings\`.

## Sports covered

NBA, WNBA, NCAA basketball (men and women), NFL, college football, MLB, NHL,
PGA, ATP and WTA tennis, UFC, F1, and soccer (any ESPN league slug). Add more by
editing the map in \`src/sports.js\`.

## Honest notes

- This is unofficial. ESPN does not document or support these endpoints, so they
  can change or break without warning. Pin nothing important to them.
- No auth, no key. That also means no SLA. Be polite: cache responses, do not
  hammer it, and do not use it for anything ESPN would call abuse.
- The endpoint list comes from [this community gist](https://gist.github.com/nntrn/ee26cb2a0716de0947a0a4e9a157bc1c),
  which is the best public map of ESPN's API. Credit there.

## License

MIT.
`);

// keep the generator in the repo as a real artifact
mkdirSync(join(DIR, "scripts"), { recursive: true });
copyFileSync(new URL(import.meta.url), join(DIR, "scripts", "build.mjs"));

console.log("built", DIR);
