# espn-api

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

## Transport

Every request has a 12 second timeout and retries up to 3 times on 429 and 5xx,
honoring `Retry-After` with exponential backoff. Real failures throw an error
with the status and the url.

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
