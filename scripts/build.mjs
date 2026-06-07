#!/usr/bin/env node
// Builds the espn-api repo: an unofficial Node client for ESPN's hidden API.
// One client for every sport, with retry/timeout transport and parsers that
// turn ESPN's nested JSON into usable data.
//   node build-espn-api.mjs   ->   ~/Claude/projects/espn-api
// Re-running overwrites the source files but leaves .git in place.

import { mkdirSync, writeFileSync, copyFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { homedir } from "node:os";

const DIR = join(homedir(), "Claude", "projects", "espn-api");
const AUTHOR = "Shaurya Singh";
const w = (rel, content) => { const f = join(DIR, rel); mkdirSync(dirname(f), { recursive: true }); writeFileSync(f, content); };

const PARSE = `// Turn ESPN's raw JSON into clean, usable shapes. ESPN responses are deeply
// nested and inconsistent across endpoints; these pull out the parts you
// actually want so you are not spelunking through competitions[0].competitors.

export function parseScoreboard(raw) {
  return (raw?.events || []).map((e) => {
    const c = e.competitions?.[0] || {};
    const side = (ha) => {
      const x = (c.competitors || []).find((m) => m.homeAway === ha);
      return x ? { id: x.team?.id, abbr: x.team?.abbreviation, name: x.team?.displayName, score: x.score, winner: x.winner } : null;
    };
    return {
      id: e.id, name: e.name, shortName: e.shortName, date: e.date,
      state: c.status?.type?.state, status: c.status?.type?.shortDetail, completed: !!c.status?.type?.completed,
      home: side("home"), away: side("away"),
    };
  });
}

export function parseTeams(raw) {
  return (raw?.sports?.[0]?.leagues?.[0]?.teams || []).map((t) => {
    const x = t.team || t;
    return { id: x.id, abbr: x.abbreviation, name: x.displayName, location: x.location, color: x.color, logo: x.logos?.[0]?.href };
  });
}

export function parseRoster(raw) {
  const out = [];
  for (const g of raw?.athletes || []) {
    const players = Array.isArray(g.items) ? g.items : [g];
    for (const p of players) {
      if (!p?.id) continue;
      out.push({ id: p.id, name: p.displayName, position: p.position?.abbreviation, jersey: p.jersey, age: p.age, height: p.displayHeight, weight: p.displayWeight });
    }
  }
  return out;
}

// The important one. ESPN stores game logs as a labels array plus rows of stat
// strings keyed by eventId, with the date/opponent in a separate events map.
// This zips them into [{ date, opponent, atVs, stats: { PTS, REB, ... } }].
export function parseGamelog(raw) {
  const labels = raw?.labels || [];
  const meta = raw?.events || {};
  const rows = [];
  for (const st of raw?.seasonTypes || []) {
    for (const cat of st.categories || []) {
      for (const ev of cat.events || []) {
        const m = meta[ev.eventId] || {};
        const stats = {};
        (ev.stats || []).forEach((v, i) => { if (labels[i]) stats[labels[i]] = v; });
        rows.push({ eventId: ev.eventId, date: m.gameDate, opponent: m.opponent?.abbreviation, atVs: m.atVs, result: m.gameResult, score: m.score, stats });
      }
    }
  }
  return rows;
}
`;

const TRANSPORT = `const TRANSIENT = new Set([429, 500, 502, 503, 504]);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const backoff = (n) => Math.min(8000, 400 * 2 ** n) + Math.floor(Math.random() * 200);

function qs(params) {
  const e = Object.entries(params || {}).filter(([, v]) => v != null);
  return e.length ? "?" + e.map(([k, v]) => \`\${k}=\${encodeURIComponent(v)}\`).join("&") : "";
}

// fetch with a timeout and retries on transient errors (429/5xx), honoring
// Retry-After. Throws a clear error with the status and url on real failures.
async function get(url, { timeout = 12000, retries = 3 } = {}) {
  for (let attempt = 0; ; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeout);
    let res;
    try {
      res = await fetch(url, { headers: { "user-agent": UA }, signal: ctrl.signal });
    } catch (e) {
      clearTimeout(timer);
      if (attempt >= retries) throw Object.assign(new Error(\`request failed for \${url}: \${e.message}\`), { url, cause: e });
      await sleep(backoff(attempt));
      continue;
    }
    clearTimeout(timer);
    if (res.ok) return res.json();
    if (TRANSIENT.has(res.status) && attempt < retries) {
      const ra = Number(res.headers.get("retry-after"));
      await sleep(Number.isFinite(ra) && ra > 0 ? ra * 1000 : backoff(attempt));
      continue;
    }
    throw Object.assign(new Error(\`ESPN \${res.status} \${res.statusText} for \${url}\`), { status: res.status, url });
  }
}`;

w("src/parse.js", PARSE);

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
  soccer: { sport: "soccer",     league: "eng.1" }, // pass any league slug to sport("soccer", "usa.1")
};

export function resolve(sportKey) {
  const s = SPORTS[String(sportKey).toLowerCase()];
  if (!s) throw new Error(\`unknown sport "\${sportKey}". known: \${Object.keys(SPORTS).join(", ")}\`);
  return s;
}
`);

w("src/client.js", `import { resolve } from "./sports.js";
import { parseScoreboard, parseTeams, parseRoster, parseGamelog } from "./parse.js";

const UA = "espn-api (github.com/LeSingh1/espn-api)";
${TRANSPORT}

// Returns an object with every endpoint bound to one sport's path, plus *Clean
// helpers that fetch and parse in one call. Override the league for soccer:
// sport("soccer", "usa.1").
export function sport(sportKey, leagueOverride) {
  const r = resolve(sportKey);
  const s = r.sport, l = leagueOverride || r.league;
  const SITE = \`https://site.api.espn.com/apis/site/v2/sports/\${s}/\${l}\`;
  const WEB  = \`https://site.web.api.espn.com/apis/common/v3/sports/\${s}/\${l}\`;
  const CORE = \`https://sports.core.api.espn.com/v2/sports/\${s}/leagues/\${l}\`;
  const api = {
    sportKey, sport: s, league: l,
    // ── raw endpoints (return ESPN JSON) ──
    scoreboard: (params, o) => get(\`\${SITE}/scoreboard\${qs(params)}\`, o),   // ?dates=YYYYMMDD
    teams:      (o) => get(\`\${SITE}/teams\`, o),
    team:       (id, o) => get(\`\${SITE}/teams/\${id}\`, o),
    roster:     (id, o) => get(\`\${SITE}/teams/\${id}/roster\`, o),
    athlete:    (id, o) => get(\`\${WEB}/athletes/\${id}\`, o),
    athletes:   ({ limit = 50, page = 1, active = true } = {}, o) => get(\`\${CORE}/athletes?limit=\${limit}&page=\${page}&active=\${active}\`, o),
    gamelog:    (id, o) => get(\`\${WEB}/athletes/\${id}/gamelog\`, o),
    splits:     (id, o) => get(\`\${WEB}/athletes/\${id}/splits\`, o),
    news:       (params, o) => get(\`\${SITE}/news\${qs(params)}\`, o),
    summary:    (eventId, o) => get(\`\${SITE}/summary\${qs({ event: eventId })}\`, o),
    standings:  (o) => get(\`\${SITE}/standings\`, o),
    odds:       (eventId, o) => get(\`\${CORE}/events/\${eventId}/competitions/\${eventId}/odds\`, o),
    plays:      (eventId, { limit = 300 } = {}, o) => get(\`\${CORE}/events/\${eventId}/competitions/\${eventId}/plays?limit=\${limit}\`, o),
    // ── parsed convenience (one call, clean data) ──
    scoreboardClean: async (params, o) => parseScoreboard(await api.scoreboard(params, o)),
    teamsClean:      async (o) => parseTeams(await api.teams(o)),
    rosterClean:     async (id, o) => parseRoster(await api.roster(id, o)),
    gamelogClean:    async (id, o) => parseGamelog(await api.gamelog(id, o)),
  };
  return api;
}
`);

w("src/index.js", `import { sport } from "./client.js";
import { SPORTS } from "./sports.js";

export { SPORTS, resolve } from "./sports.js";
export { sport } from "./client.js";
export { parseScoreboard, parseTeams, parseRoster, parseGamelog } from "./parse.js";

// Convenience namespace: espn.nba.gamelogClean(id), espn.nfl.scoreboardClean().
export const espn = Object.fromEntries(Object.keys(SPORTS).map((k) => [k, sport(k)]));
`);

w("examples/scoreboard.js", `import { sport } from "../src/index.js";

// scoreboardClean returns a tidy array instead of ESPN's nested JSON.
const games = await sport("nba").scoreboardClean();
console.log("NBA games:", games.length);
for (const g of games.slice(0, 8)) {
  console.log(\`  \${g.away?.abbr || "?"} @ \${g.home?.abbr || "?"}  \${g.status || g.date}\`);
}
`);

w("examples/gamelog.js", `import { sport } from "../src/index.js";

// Discover a player from a roster, then pull a CLEAN game log.
const nba = sport("nba");
const teams = await nba.teamsClean();
const roster = await nba.rosterClean(teams[0].id);
const player = roster[0];
console.log(\`\${player.name} (\${teams[0].abbr})\`);
const log = await nba.gamelogClean(player.id);
console.log("games:", log.length);
for (const g of log.slice(0, 5)) {
  console.log(\`  \${g.date?.slice(0, 10)} \${g.atVs} \${g.opponent}  PTS \${g.stats.PTS}  REB \${g.stats.REB}  AST \${g.stats.AST}\`);
}
`);

w("tests/parse.test.js", `import assert from "node:assert";
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
`);

w("tests/sports.test.js", `import assert from "node:assert";
import { resolve, SPORTS } from "../src/sports.js";

assert.deepStrictEqual(resolve("nba"), { sport: "basketball", league: "nba" });
assert.deepStrictEqual(resolve("NFL"), { sport: "football", league: "nfl" });
assert.throws(() => resolve("quidditch"), /unknown sport/);
assert.ok(Object.keys(SPORTS).length >= 12, "should map 12+ sports");

console.log("ok: mapping resolves", Object.keys(SPORTS).length, "sports, unknowns throw");
`);

// Daily snapshot across a handful of core sports. Pulls today's games from the
// live API and writes data/latest.json only when something is in season, so the
// repo refreshes with real data daily and holds otherwise. No try/catch: an
// off-season sport returns an empty array (not an error), so the only way this
// throws is a genuine ESPN breakage — which is exactly when the scheduled run
// should go red.
w("scripts/snapshot-daily.js", `import { writeFileSync, mkdirSync } from "node:fs";
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
  console.log(\`\${ymd}: no games across \${KEYS.join(", ")} today; leaving snapshot unchanged\`);
  process.exit(0);
}
mkdirSync("data", { recursive: true });
writeFileSync("data/latest.json", JSON.stringify({ date: ymd, sports }, null, 2) + "\\n");
console.log(\`\${ymd}: wrote \${total} games across \${Object.keys(sports).length} sports -> data/latest.json\`);
`);

w(".github/workflows/daily-data.yml", `name: daily-data

on:
  schedule:
    - cron: "17 12 * * *"   # 12:17 UTC daily
  workflow_dispatch:

permissions:
  contents: write

concurrency:
  group: daily-data
  cancel-in-progress: false

jobs:
  snapshot:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - name: Fetch today's games from live ESPN
        run: node scripts/snapshot-daily.js
      - name: Commit refreshed snapshot if it changed
        run: |
          if [ -n "$(git status --porcelain data/)" ]; then
            git config user.name "github-actions[bot]"
            git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
            git add data/
            git commit -m "data: daily snapshot $(date -u +%Y-%m-%d)"
            git push
          else
            echo "No new data; nothing to commit."
          fi
`);

w("package.json", JSON.stringify({
  name: "espn-api", version: "1.2.0", type: "module", private: false,
  description: "Unofficial Node client for ESPN's hidden API. One client for every sport, with retry transport and JSON parsers.",
  scripts: {
    test: "node tests/sports.test.js && node tests/parse.test.js",
    scoreboard: "node examples/scoreboard.js",
    gamelog: "node examples/gamelog.js",
    "snapshot:daily": "node scripts/snapshot-daily.js",
  },
  license: "MIT", author: AUTHOR,
}, null, 2) + "\n");

w(".gitignore", "node_modules/\n*.log\n.DS_Store\n.env\n");

w("LICENSE", `MIT License

Copyright (c) 2026 ${AUTHOR}

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction. The Software is provided "as is", without
warranty of any kind.
`);

w("README.md", `# espn-api

An unofficial Node client for ESPN's hidden API. One client that covers every
sport, with retry/timeout transport and parsers that hand back clean data
instead of ESPN's deeply nested JSON.

I built this as the data layer under EdgeBoard and the edge-models projects.
Those models project player props from game logs, and the game logs come from
here.

## Why one repo and not one per sport

ESPN's endpoints are identical for every sport. Only the path changes:

\`\`\`
/sports/{sport}/{league}/scoreboard
/sports/{sport}/{league}/teams/{id}/roster
/sports/{sport}/{league}/athletes/{id}/gamelog
\`\`\`

So "nba", "nfl", "mlb" and the rest are the same code with a different
\`{sport}/{league}\` string. (This is the opposite of swar/nba_api, which is NBA
only because NBA.com runs its own separate stats API.) There are also focused
single-sport repos if you only want one league: nba-api, nfl-api, and so on.

## Install and run

No dependencies. Node 18+ (built-in fetch).

\`\`\`
git clone https://github.com/LeSingh1/espn-api
cd espn-api
node examples/scoreboard.js
node examples/gamelog.js
npm test
\`\`\`

## Use it

\`\`\`js
import { sport, espn } from "./src/index.js";

const nba = sport("nba");
await nba.scoreboardClean();              // tidy array of games
await nba.gamelogClean("4278039");        // [{ date, opponent, atVs, stats: { PTS, REB, ... } }]
await espn.nfl.teamsClean();              // namespace style
await sport("soccer", "usa.1").scoreboard();   // override the league for soccer
\`\`\`

### Raw endpoints

\`scoreboard\`, \`teams\`, \`team\`, \`roster\`, \`athlete\`, \`athletes\` (paginated),
\`gamelog\`, \`splits\`, \`news\`, \`summary\`, \`standings\`, \`odds\`, \`plays\`. Each
returns ESPN's JSON unchanged. Every call takes an options object
\`{ timeout, retries }\`.

### Parsed helpers

\`scoreboardClean\`, \`teamsClean\`, \`rosterClean\`, \`gamelogClean\` fetch and
normalize in one call. The gamelog parser is the useful one: it zips ESPN's
label array with the per-game stat rows and joins the date and opponent, so you
get \`{ date, opponent, atVs, stats: { PTS, REB, AST, ... } }\` instead of parallel
arrays.

## Daily data

A scheduled GitHub Action runs once a day, pulls that day's games for a handful
of core leagues (NBA, WNBA, NFL, MLB, NHL) from live ESPN, and commits them to
\`data/latest.json\` when anything is in season. Off-season days leave the last
snapshot in place, so the file is always the most recent day that actually had
games. The same run is a canary: if ESPN changes or breaks an endpoint the job
fails, so a red build is the early warning that the client needs a fix. Run it
yourself with \`npm run snapshot:daily\`.

## Transport

Every request has a 12 second timeout and retries up to 3 times on 429 and 5xx,
honoring \`Retry-After\` with exponential backoff. Failures throw an Error whose
\`.status\` and \`.url\` are set, so you can branch on the HTTP status (e.g. skip a
404, back off on a 429).

## Sports covered

NBA, WNBA, NCAA basketball (men and women), NFL, college football, MLB, NHL,
PGA, ATP and WTA tennis, UFC, F1, and soccer (any ESPN league slug). Add more by
editing \`src/sports.js\`.

## Honest notes

- Unofficial. ESPN does not document or support these endpoints, so they can
  change or break without warning. Cache responses and do not hammer it.
- No auth, no SLA. Be polite.
- Endpoint map credit: [this community gist](https://gist.github.com/nntrn/ee26cb2a0716de0947a0a4e9a157bc1c).

## License

MIT.
`);

mkdirSync(join(DIR, "scripts"), { recursive: true });
copyFileSync(new URL(import.meta.url), join(DIR, "scripts", "build.mjs"));
console.log("rebuilt", DIR);
