import { resolve } from "./sports.js";
import { parseScoreboard, parseTeams, parseRoster, parseGamelog } from "./parse.js";

const UA = "espn-api (github.com/LeSingh1/espn-api)";
const TRANSIENT = new Set([429, 500, 502, 503, 504]);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const backoff = (n) => Math.min(8000, 400 * 2 ** n) + Math.floor(Math.random() * 200);

function qs(params) {
  const e = Object.entries(params || {}).filter(([, v]) => v != null);
  return e.length ? "?" + e.map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join("&") : "";
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
      if (attempt >= retries) throw new Error(`request failed for ${url}: ${e.message}`);
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
    throw new Error(`ESPN ${res.status} ${res.statusText} for ${url}`);
  }
}

// Returns an object with every endpoint bound to one sport's path, plus *Clean
// helpers that fetch and parse in one call. Override the league for soccer:
// sport("soccer", "usa.1").
export function sport(sportKey, leagueOverride) {
  const r = resolve(sportKey);
  const s = r.sport, l = leagueOverride || r.league;
  const SITE = `https://site.api.espn.com/apis/site/v2/sports/${s}/${l}`;
  const WEB  = `https://site.web.api.espn.com/apis/common/v3/sports/${s}/${l}`;
  const CORE = `https://sports.core.api.espn.com/v2/sports/${s}/leagues/${l}`;
  const api = {
    sportKey, sport: s, league: l,
    // ── raw endpoints (return ESPN JSON) ──
    scoreboard: (params, o) => get(`${SITE}/scoreboard${qs(params)}`, o),   // ?dates=YYYYMMDD
    teams:      (o) => get(`${SITE}/teams`, o),
    team:       (id, o) => get(`${SITE}/teams/${id}`, o),
    roster:     (id, o) => get(`${SITE}/teams/${id}/roster`, o),
    athlete:    (id, o) => get(`${WEB}/athletes/${id}`, o),
    athletes:   ({ limit = 50, page = 1, active = true } = {}, o) => get(`${CORE}/athletes?limit=${limit}&page=${page}&active=${active}`, o),
    gamelog:    (id, o) => get(`${WEB}/athletes/${id}/gamelog`, o),
    splits:     (id, o) => get(`${WEB}/athletes/${id}/splits`, o),
    news:       (params, o) => get(`${SITE}/news${qs(params)}`, o),
    summary:    (eventId, o) => get(`${SITE}/summary${qs({ event: eventId })}`, o),
    standings:  (o) => get(`${SITE}/standings`, o),
    odds:       (eventId, o) => get(`${CORE}/events/${eventId}/competitions/${eventId}/odds`, o),
    plays:      (eventId, { limit = 300 } = {}, o) => get(`${CORE}/events/${eventId}/competitions/${eventId}/plays?limit=${limit}`, o),
    // ── parsed convenience (one call, clean data) ──
    scoreboardClean: async (params, o) => parseScoreboard(await api.scoreboard(params, o)),
    teamsClean:      async (o) => parseTeams(await api.teams(o)),
    rosterClean:     async (id, o) => parseRoster(await api.roster(id, o)),
    gamelogClean:    async (id, o) => parseGamelog(await api.gamelog(id, o)),
  };
  return api;
}
