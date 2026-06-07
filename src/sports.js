// Sport + league mapping for ESPN's hidden API.
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
  if (!s) throw new Error(`unknown sport "${sportKey}". known: ${Object.keys(SPORTS).join(", ")}`);
  return s;
}
