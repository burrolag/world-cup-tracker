import { afterEach, describe, expect, it, vi } from "vitest";
import type { TournamentState } from "../types";
import { mergeOfficialResults, updateHostedFinalScores } from "./officialResults";

const state: TournamentState = {
  teams: [],
  participants: [],
  matches: [
    {
      id: "m73",
      round: "round32",
      label: "Match 73",
      slot: 1,
      homeTeamId: "south-africa",
      awayTeamId: "canada",
      homeScore: null,
      awayScore: null,
      winnerTeamId: null,
      date: "2026-06-28",
      nextMatchId: "m90",
      nextMatchSide: "home"
    },
    {
      id: "m90",
      round: "round16",
      label: "Match 90",
      slot: 1,
      homeTeamId: "",
      awayTeamId: "",
      homeScore: null,
      awayScore: null,
      winnerTeamId: null,
      date: "2026-07-04"
    }
  ]
};

describe("mergeOfficialResults", () => {
  it("applies hosted scores and advances the bracket", () => {
    const nextState = mergeOfficialResults(state, {
      lastUpdated: "2026-07-02T00:00:00.000Z",
      source: "test",
      matches: [
        {
          id: "m73",
          homeTeamId: "south-africa",
          awayTeamId: "canada",
          homeScore: 0,
          awayScore: 1,
          winnerTeamId: "canada",
          date: "2026-06-28",
          status: "FINISHED"
        }
      ]
    });

    expect(nextState.matches.find((match) => match.id === "m73")).toMatchObject({
      homeScore: 0,
      awayScore: 1,
      winnerTeamId: "canada"
    });
    expect(nextState.matches.find((match) => match.id === "m90")?.homeTeamId).toBe("canada");
  });
});

describe("updateHostedFinalScores", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("calls the backend score update endpoint and returns the updated results file", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        ok: true,
        summary: { checked: 2, updated: 1, skipped: 1, issues: [] },
        resultsFile: {
          lastUpdated: "2026-07-02T00:00:00.000Z",
          source: "SerpApi Google Sports Results",
          matches: []
        }
      })
    });

    vi.stubGlobal("fetch", fetchMock);

    const result = await updateHostedFinalScores("/api/world-cup/update-final-scores");

    expect(fetchMock).toHaveBeenCalledWith("/api/world-cup/update-final-scores", { cache: "no-store" });
    expect(result.summary).toMatchObject({ checked: 2, updated: 1 });
    expect(result.resultsFile?.source).toBe("SerpApi Google Sports Results");
  });

  it("reports backend score update failures", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({ ok: false, error: "SERPAPI_KEY is required." })
      })
    );

    await expect(updateHostedFinalScores("/api/world-cup/update-final-scores")).rejects.toThrow(
      "SERPAPI_KEY is required."
    );
  });
});
