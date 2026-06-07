import { resolve } from "./sports.js";

const SITE = "https://site.api.espn.com/apis/site/v2";
const WEB  = "https://site.web.api.espn.com/apis/common/v3";

function qs(params) {
  const entries = Object.entries(params || {}).filter(([, v]) => v != null);
  return entries.length ? "?" + entries.map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join("&") : "";
}

async function get(url) {
  const res = await fetch(url, { headers: { "user-agent": "espn-api (github.com/LeSingh1/espn-api)" } });
  if (!res.ok) throw new Error(`ESPN ${res.status} for ${url}`);
  return res.json();
}

// Returns an object with every endpoint bound to one sport's path. You can
// override the league (useful for soccer): sport("soccer", "usa.1").
export function sport(sportKey, leagueOverride) {
  const r = resolve(sportKey);
  const s = r.sport, l = leagueOverride || r.league;
  const base = `${SITE}/sports/${s}/${l}`;
  const web  = `${WEB}/sports/${s}/${l}`;
  return {
    sportKey, sport: s, league: l,
    // scores for a date, e.g. scoreboard({ dates: "20260906" })
    scoreboard: (params) => get(`${base}/scoreboard${qs(params)}`),
    teams:      () => get(`${base}/teams`),
    team:       (teamId) => get(`${base}/teams/${teamId}`),
    roster:     (teamId) => get(`${base}/teams/${teamId}/roster`),
    athlete:    (athleteId) => get(`${web}/athletes/${athleteId}`),
    // the one that matters for prop models: a player's per-game log
    gamelog:    (athleteId) => get(`${web}/athletes/${athleteId}/gamelog`),
    splits:     (athleteId) => get(`${web}/athletes/${athleteId}/splits`),
    news:       (params) => get(`${base}/news${qs(params)}`),
    summary:    (eventId) => get(`${base}/summary${qs({ event: eventId })}`),
    standings:  () => get(`${base}/standings`),
  };
}
