# espn-api

![CI](https://github.com/LeSingh1/espn-api/actions/workflows/test.yml/badge.svg) ![license](https://img.shields.io/badge/license-MIT-blue.svg) ![node](https://img.shields.io/badge/node-%E2%89%A518-brightgreen.svg) ![dependencies](https://img.shields.io/badge/dependencies-0-success.svg)

An unofficial Node client for ESPN's hidden API. One client that covers every
sport, with retry/timeout transport and parsers that hand back clean data
instead of ESPN's deeply nested JSON.

I built this as the data layer under EdgeBoard and the edge-models projects.
Those models project player props from game logs, and the game logs come from
here.

## Why one repo and not one per sport

ESPN's endpoints are identical for every sport. Only the path changes:

```
/sports/{sport}/{league}/scoreboard
/sports/{sport}/{league}/teams/{id}/roster
/sports/{sport}/{league}/athletes/{id}/gamelog
```

So "nba", "nfl", "mlb" and the rest are the same code with a different
`{sport}/{league}` string. (This is the opposite of swar/nba_api, which is NBA
only because NBA.com runs its own separate stats API.) There are also focused
single-sport repos if you only want one league: nba-api, nfl-api, and so on.

## Install and run

No dependencies. Node 18+ (built-in fetch).

```
git clone https://github.com/LeSingh1/espn-api
cd espn-api
node examples/scoreboard.js
node examples/gamelog.js
npm test
```

## Use it

```js
import { sport, espn } from "./src/index.js";

const nba = sport("nba");
await nba.scoreboardClean();              // tidy array of games
await nba.gamelogClean("4278039");        // [{ date, opponent, atVs, stats: { PTS, REB, ... } }]
await espn.nfl.teamsClean();              // namespace style
await sport("soccer", "usa.1").scoreboard();   // override the league for soccer
```

### Raw endpoints

`scoreboard`, `teams`, `team`, `roster`, `athlete`, `athletes` (paginated),
`gamelog`, `splits`, `news`, `summary`, `standings`, `odds`, `plays`. Each
returns ESPN's JSON unchanged. Every call takes an options object
`{ timeout, retries }`.

### Parsed helpers

`scoreboardClean`, `teamsClean`, `rosterClean`, `gamelogClean` fetch and
normalize in one call. The gamelog parser is the useful one: it zips ESPN's
label array with the per-game stat rows and joins the date and opponent, so you
get `{ date, opponent, atVs, stats: { PTS, REB, AST, ... } }` instead of parallel
arrays.

## Daily data

A scheduled GitHub Action runs once a day, pulls that day's games for a handful
of core leagues (NBA, WNBA, NFL, MLB, NHL) from live ESPN, and commits them to
`data/latest.json` when anything is in season. Off-season days leave the last
snapshot in place, so the file is always the most recent day that actually had
games. The same run is a canary: if ESPN changes or breaks an endpoint the job
fails, so a red build is the early warning that the client needs a fix. Run it
yourself with `npm run snapshot:daily`.

## Transport

Every request has a 12 second timeout and retries up to 3 times on 429 and 5xx,
honoring `Retry-After` with exponential backoff. Failures throw an Error whose
`.status` and `.url` are set, so you can branch on the HTTP status (e.g. skip a
404, back off on a 429).

## Sports covered

NBA, WNBA, NCAA basketball (men and women), NFL, college football, MLB, NHL,
PGA, ATP and WTA tennis, UFC, F1, and soccer (any ESPN league slug). Add more by
editing `src/sports.js`.

## Honest notes

- Unofficial. ESPN does not document or support these endpoints, so they can
  change or break without warning. Cache responses and do not hammer it.
- No auth, no SLA. Be polite.
- Endpoint map credit: [this community gist](https://gist.github.com/nntrn/ee26cb2a0716de0947a0a4e9a157bc1c).

## License

MIT.
