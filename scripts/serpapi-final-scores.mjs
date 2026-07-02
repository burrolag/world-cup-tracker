import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const defaultResultsPath = path.resolve("public", "world-cup-results.json");

const finalStatuses = new Set(["final", "full-time", "full time", "ft", "complete", "completed", "finished"]);

const teamAliases = {
  "bosnia and herzegovina": "bosnia-herzegovina",
  bosnia: "bosnia-herzegovina",
  "cabo verde": "cabo-verde",
  "cape verde": "cabo-verde",
  "cote d ivoire": "ivory-coast",
  "cote d'ivoire": "ivory-coast",
  "ivory coast": "ivory-coast",
  "dr congo": "dr-congo",
  "congo dr": "dr-congo",
  "congo d r": "dr-congo",
  usa: "united-states",
  "united states": "united-states",
  "united states of america": "united-states",
  "south africa": "south-africa"
};

export function normalizeTeamName(value) {
  const normalized = String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9']+/g, " ")
    .trim();

  return teamAliases[normalized] ?? normalized.replace(/'/g, "").replace(/\s+/g, "-");
}

export function parseJsonContent(content) {
  return JSON.parse(String(content).replace(/^\uFEFF/, ""));
}

function normalizeStatus(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z]+/g, " ")
    .trim();
}

function isFinalStatus(value) {
  const normalized = normalizeStatus(value);
  return finalStatuses.has(normalized) || /\b(final|finished|complete|completed|full time|ft)\b/i.test(value ?? "");
}

function kickoffDate(match) {
  const value = match.kickoffUtc ?? match.date;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value ?? "")) {
    return new Date(`${value}T23:59:59Z`);
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function shouldCheckMatch(match, now = new Date()) {
  if (isFinalStatus(match.status) || match.status === "Complete") {
    return false;
  }

  if (match.homeScore !== null || match.awayScore !== null || match.winnerTeamId) {
    return false;
  }

  const kickoff = kickoffDate(match);
  if (!kickoff) {
    return false;
  }

  return now.getTime() - kickoff.getTime() >= 2 * 60 * 60 * 1000;
}

function asArray(value) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function numberFrom(value) {
  if (typeof value === "number") return value;
  const match = String(value ?? "").match(/\d+/);
  return match ? Number(match[0]) : null;
}

function extractStatus(result) {
  return (
    result.status ??
    result.game_status ??
    result.match_status ??
    result.status_detail ??
    result.game_spotlight?.status ??
    result.game_spotlight?.game_status ??
    ""
  );
}

function candidateTeamsFromObject(value) {
  return [
    ...asArray(value?.teams),
    ...asArray(value?.competitors),
    ...asArray(value?.participants),
    ...asArray(value?.game_spotlight?.teams),
    ...asArray(value?.game_spotlight?.competitors)
  ];
}

function teamNameFromEntry(entry) {
  return entry?.name ?? entry?.team ?? entry?.title ?? entry?.short_name ?? entry?.display_name ?? "";
}

function teamScoreFromEntry(entry) {
  return numberFrom(entry?.score ?? entry?.points ?? entry?.goals ?? entry?.result);
}

function teamPenaltyFromEntry(entry) {
  return numberFrom(entry?.penalty_score ?? entry?.penalties ?? entry?.shootout_score);
}

function extractFromTeamEntries(result, homeTeamId, awayTeamId) {
  const entries = candidateTeamsFromObject(result);
  const parsed = entries
    .map((entry) => ({
      teamId: normalizeTeamName(teamNameFromEntry(entry)),
      score: teamScoreFromEntry(entry),
      penaltyScore: teamPenaltyFromEntry(entry)
    }))
    .filter((entry) => entry.teamId && entry.score !== null);

  const home = parsed.find((entry) => entry.teamId === homeTeamId);
  const away = parsed.find((entry) => entry.teamId === awayTeamId);

  if (!home || !away) {
    return null;
  }

  return {
    homeScore: home.score,
    awayScore: away.score,
    homePenaltyScore: home.penaltyScore,
    awayPenaltyScore: away.penaltyScore
  };
}

function extractFromScoreText(result, homeTeamId, awayTeamId) {
  const text = [
    result.title,
    result.subtitle,
    result.snippet,
    result.score,
    result.game_spotlight?.title,
    result.game_spotlight?.subtitle,
    result.game_spotlight?.score
  ]
    .filter(Boolean)
    .join(" ");

  const scoreMatch = text.match(/(\d+)\s*(?:-|\u2013|\u2014)\s*(\d+)/);
  if (!scoreMatch) {
    return null;
  }

  const normalizedText = normalizeTeamName(text);
  if (!normalizedText.includes(homeTeamId) || !normalizedText.includes(awayTeamId)) {
    return null;
  }

  return {
    homeScore: Number(scoreMatch[1]),
    awayScore: Number(scoreMatch[2]),
    homePenaltyScore: null,
    awayPenaltyScore: null
  };
}

export function parseSerpApiFinalScore(payload, match) {
  const homeTeamId = normalizeTeamName(match.homeTeamId);
  const awayTeamId = normalizeTeamName(match.awayTeamId);
  const candidates = [
    ...asArray(payload?.sports_results),
    ...asArray(payload?.sports_result),
    payload?.sports_results,
    payload?.sports_result
  ].filter(Boolean);

  for (const candidate of candidates) {
    const status = extractStatus(candidate);
    if (!isFinalStatus(status)) {
      continue;
    }

    const score =
      extractFromTeamEntries(candidate, homeTeamId, awayTeamId) ??
      extractFromScoreText(candidate, homeTeamId, awayTeamId);

    if (!score || score.homeScore === null || score.awayScore === null) {
      continue;
    }

    let winnerTeamId = null;
    if (score.homeScore > score.awayScore) {
      winnerTeamId = match.homeTeamId;
    } else if (score.awayScore > score.homeScore) {
      winnerTeamId = match.awayTeamId;
    } else if (
      score.homePenaltyScore !== null &&
      score.awayPenaltyScore !== null &&
      score.homePenaltyScore !== score.awayPenaltyScore
    ) {
      winnerTeamId = score.homePenaltyScore > score.awayPenaltyScore ? match.homeTeamId : match.awayTeamId;
    }

    return {
      homeScore: score.homeScore,
      awayScore: score.awayScore,
      homePenaltyScore: score.homePenaltyScore,
      awayPenaltyScore: score.awayPenaltyScore,
      status: "Complete",
      winnerTeamId,
      updatedAt: new Date().toISOString()
    };
  }

  return null;
}

async function fetchSerpApiResult(match, apiKey) {
  const query = `2026 FIFA World Cup ${match.homeTeamId} vs ${match.awayTeamId} final score`;
  const url = new URL("https://serpapi.com/search.json");
  url.searchParams.set("engine", "google");
  url.searchParams.set("q", query);
  url.searchParams.set("api_key", apiKey);

  console.log(`[check] ${match.id}: ${query}`);
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`SerpApi request failed for ${match.id}: ${response.status} ${await response.text()}`);
  }

  return response.json();
}

function validCompletedOverwrite(existing, next) {
  if (!isFinalStatus(existing.status) && existing.status !== "Complete") {
    return true;
  }

  return (
    next.homeScore !== null &&
    next.awayScore !== null &&
    existing.homeScore === next.homeScore &&
    existing.awayScore === next.awayScore
  );
}

export async function updateFinalScores({ resultsPath = defaultResultsPath, apiKey = process.env.SERPAPI_KEY } = {}) {
  if (!apiKey) {
    throw new Error("SERPAPI_KEY is required.");
  }

  const current = parseJsonContent(await readFile(resultsPath, "utf8"));
  const now = new Date();
  const matchesToCheck = current.matches.filter((match) => shouldCheckMatch(match, now));
  const updatedMatches = current.matches.map((match) => ({ ...match }));
  const summary = { checked: 0, updated: 0, skipped: 0, issues: [] };

  console.log(`[start] Checking ${matchesToCheck.length} eligible matches.`);

  for (const match of matchesToCheck) {
    summary.checked += 1;

    try {
      const payload = await fetchSerpApiResult(match, apiKey);
      const finalScore = parseSerpApiFinalScore(payload, match);

      if (!finalScore) {
        summary.skipped += 1;
        console.log(`[skip] ${match.id}: SerpApi did not return a clear final result.`);
        continue;
      }

      if (!validCompletedOverwrite(match, finalScore)) {
        summary.skipped += 1;
        console.log(`[skip] ${match.id}: refusing to overwrite an existing completed score.`);
        continue;
      }

      const index = updatedMatches.findIndex((candidate) => candidate.id === match.id);
      updatedMatches[index] = { ...updatedMatches[index], ...finalScore };
      summary.updated += 1;
      console.log(
        `[update] ${match.id}: ${match.homeTeamId} ${finalScore.homeScore}-${finalScore.awayScore} ${match.awayTeamId}`
      );
    } catch (error) {
      summary.skipped += 1;
      summary.issues.push(`${match.id}: ${error instanceof Error ? error.message : String(error)}`);
      console.log(`[issue] ${match.id}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  const next = {
    ...current,
    lastUpdated: new Date().toISOString(),
    source: "SerpApi Google Sports Results",
    matches: updatedMatches
  };

  await writeFile(resultsPath, `${JSON.stringify(next, null, 2)}\n`);
  console.log(`[done] checked=${summary.checked} updated=${summary.updated} skipped=${summary.skipped}`);
  return summary;
}
