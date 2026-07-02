import { describe, expect, it } from "vitest";
import type { TournamentState } from "../types";
import { mergeOfficialResults } from "./officialResults";

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
