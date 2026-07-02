import { describe, expect, it } from "vitest";
import { parseJsonContent, parseSerpApiFinalScore } from "./serpapi-final-scores.mjs";

const match = {
  id: "m79",
  homeTeamId: "mexico",
  awayTeamId: "ecuador"
};

describe("parseSerpApiFinalScore", () => {
  it("extracts a final score from sports_results team entries", () => {
    const result = parseSerpApiFinalScore(
      {
        sports_results: {
          status: "Final",
          teams: [
            { name: "Mexico", score: "2" },
            { name: "Ecuador", score: "0" }
          ]
        }
      },
      match
    );

    expect(result).toMatchObject({
      homeScore: 2,
      awayScore: 0,
      status: "Complete",
      winnerTeamId: "mexico"
    });
  });

  it("skips non-final scores", () => {
    expect(
      parseSerpApiFinalScore(
        {
          sports_result: {
            status: "Live",
            teams: [
              { name: "Mexico", score: "1" },
              { name: "Ecuador", score: "0" }
            ]
          }
        },
        match
      )
    ).toBeNull();
  });

  it("uses penalty shootout scores to determine a winner after a draw", () => {
    const result = parseSerpApiFinalScore(
      {
        sports_results: {
          game_status: "FT",
          competitors: [
            { name: "Mexico", score: "1", penalty_score: "4" },
            { name: "Ecuador", score: "1", penalty_score: "3" }
          ]
        }
      },
      match
    );

    expect(result).toMatchObject({
      homeScore: 1,
      awayScore: 1,
      homePenaltyScore: 4,
      awayPenaltyScore: 3,
      winnerTeamId: "mexico"
    });
  });
});

describe("parseJsonContent", () => {
  it("parses JSON files with a UTF-8 BOM", () => {
    expect(parseJsonContent('\uFEFF{"matches":[]}')).toEqual({ matches: [] });
  });
});
