# espn-api

A small, unofficial Node client for ESPN's hidden API. One client that covers
every sport, because ESPN's API is one API.

I built this as the data layer under EdgeBoard and the edge-models projects.
Those models project player props from game logs, and the game logs come from
here.

## Why one repo and not one per sport

ESPN's endpoints are the same for every sport. Only the path changes:

```
/sports/{sport}/{league}/scoreboard
/sports/{sport}/{league}/teams/{id}/roster
/sports/{sport}/{league}/athletes/{id}/gamelog
```

So "nba", "nfl", "mlb" and the rest are the same code with a different
`{sport}/{league}` string. Splitting that into 13 repos would just be 13 copies
of one file. (This is the opposite of swar/nba_api, which is NBA only because
NBA.com runs its own separate stats API.) The sport map is in
[src/sports.js](src/sports.js).

## Install and run

No dependencies. Node 18+ (it uses the built-in fetch).

```
git clone https://github.com/LeSingh1/espn-api
cd espn-api
node examples/scoreboard.js     # NBA games on the board right now
node examples/gamelog.js        # pull a real player's game log
node tests/sports.test.js
```

## Use it

```js
import { sport, espn } from "./src/index.js";

await sport("nfl").scoreboard({ dates: "20260906" });
await sport("wnba").gamelog("4433403");        // a player's per-game log
await espn.nba.teams();                         // same thing, namespace style
await sport("soccer", "usa.1").scoreboard();    // override the league for soccer
```

Each sport gives you: `scoreboard`, `teams`, `team`, `roster`, `athlete`,
`gamelog`, `splits`, `news`, `summary`, `standings`.

## Sports covered

NBA, WNBA, NCAA basketball (men and women), NFL, college football, MLB, NHL,
PGA, ATP and WTA tennis, UFC, F1, and soccer (any ESPN league slug). Add more by
editing the map in `src/sports.js`.

## Honest notes

- This is unofficial. ESPN does not document or support these endpoints, so they
  can change or break without warning. Pin nothing important to them.
- No auth, no key. That also means no SLA. Be polite: cache responses, do not
  hammer it, and do not use it for anything ESPN would call abuse.
- The endpoint list comes from [this community gist](https://gist.github.com/nntrn/ee26cb2a0716de0947a0a4e9a157bc1c),
  which is the best public map of ESPN's API. Credit there.

## License

MIT.
