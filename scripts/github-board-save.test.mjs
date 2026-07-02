import { describe, expect, it } from "vitest";
import { officialResultsFromState, validateTournamentState } from "./github-board-save.mjs";

const state = {
  teams: [{ id: "mexico", name: "Mexico", code: "MEX" }],
  matches: [
    {
      id: "m1",
      round: "final",
      label: "Final",
      slot: 1,
      homeTeamId: "mexico",
      awayTeamId: "canada",
      homeScore: 2,
      awayScore: 1,
      winnerTeamId: "mexico",
      date: "2026-07-19"
    }
  ],
  participants: [{ id: "ana", name: "Ana", predictions: [{ matchId: "m1", winnerTeamId: "mexico" }] }]
};

describe("officialResultsFromState", () => {
  it("builds the hosted results file from the current board matches", () => {
    expect(officialResultsFromState(state, new Date("2026-07-20T00:00:00.000Z"))).toEqual({
      lastUpdated: "2026-07-20T00:00:00.000Z",
      source: "Manual GitHub save",
      matches: [
        {
          id: "m1",
          homeTeamId: "mexico",
          awayTeamId: "canada",
          homeScore: 2,
          awayScore: 1,
          winnerTeamId: "mexico",
          date: "2026-07-19",
          status: "Complete",
          updatedAt: "2026-07-20T00:00:00.000Z"
        }
      ]
    });
  });
});

describe("validateTournamentState", () => {
  it("accepts the board shape saved by the app", () => {
    expect(validateTournamentState(state)).toBe(state);
  });

  it("rejects missing board collections", () => {
    expect(() => validateTournamentState({ matches: [] })).toThrow("teams, matches, and participants");
  });
});
