import type { Match, TournamentState } from "../types";
import { advanceBracket } from "./bracket";

export type OfficialMatchResult = {
  id: string;
  homeTeamId: string;
  awayTeamId: string;
  homeScore: number | null;
  awayScore: number | null;
  winnerTeamId: string | null;
  date: string;
  status: string;
};

export type OfficialResultsFile = {
  lastUpdated: string;
  source: string;
  matches: OfficialMatchResult[];
};

export type OfficialScoreUpdateSummary = {
  checked: number;
  updated: number;
  skipped: number;
  issues: string[];
};

export type OfficialScoreUpdateResponse = {
  summary: OfficialScoreUpdateSummary;
  resultsFile: OfficialResultsFile | null;
};

function applyOfficialResult(match: Match, result: OfficialMatchResult): Match {
  return {
    ...match,
    homeTeamId: result.homeTeamId,
    awayTeamId: result.awayTeamId,
    homeScore: result.homeScore,
    awayScore: result.awayScore,
    winnerTeamId: result.winnerTeamId,
    date: result.date
  };
}

export function mergeOfficialResults(state: TournamentState, resultsFile: OfficialResultsFile): TournamentState {
  let nextMatches = state.matches.map((match) => {
    const result = resultsFile.matches.find((candidate) => candidate.id === match.id);
    return result ? applyOfficialResult(match, result) : match;
  });

  for (const result of resultsFile.matches) {
    nextMatches = advanceBracket(nextMatches, result.id);
  }

  return {
    ...state,
    matches: nextMatches
  };
}

export async function fetchOfficialResults(): Promise<OfficialResultsFile> {
  const response = await fetch(`${import.meta.env.BASE_URL}world-cup-results.json`, {
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(`Could not load hosted results: ${response.status}`);
  }

  return (await response.json()) as OfficialResultsFile;
}

export async function updateHostedFinalScores(
  endpoint = import.meta.env.VITE_SCORE_UPDATE_ENDPOINT ?? "/api/world-cup/update-final-scores"
): Promise<OfficialScoreUpdateResponse> {
  const response = await fetch(endpoint, {
    cache: "no-store"
  });
  const result = (await response.json().catch(() => null)) as
    | { ok?: boolean; summary?: OfficialScoreUpdateSummary; resultsFile?: OfficialResultsFile; error?: string }
    | null;

  if (!response.ok || result?.ok === false) {
    throw new Error(result?.error ?? `Score update failed with ${response.status}.`);
  }

  return {
    summary: result?.summary ?? { checked: 0, updated: 0, skipped: 0, issues: [] },
    resultsFile: result?.resultsFile ?? null
  };
}
