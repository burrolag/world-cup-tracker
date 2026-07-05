import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  displayTeamName,
  parseJsonContent,
  parseSerpApiFinalScore,
  shouldCheckMatch,
  updateFinalScores
} from "./serpapi-final-scores.mjs";

const match = {
  id: "m79",
  homeTeamId: "mexico",
  awayTeamId: "ecuador"
};

const tempDirs = [];

afterEach(async () => {
  vi.unstubAllGlobals();

  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

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

describe("shouldCheckMatch", () => {
  const scheduledDateOnlyMatch = {
    id: "m89",
    homeTeamId: "paraguay",
    awayTeamId: "france",
    homeScore: null,
    awayScore: null,
    winnerTeamId: null,
    date: "2026-07-04",
    status: "SCHEDULED"
  };

  it("checks date-only matches two hours after the match date starts", () => {
    expect(shouldCheckMatch(scheduledDateOnlyMatch, new Date("2026-07-04T02:00:00Z"))).toBe(true);
  });

  it("does not check date-only matches before the two-hour buffer", () => {
    expect(shouldCheckMatch(scheduledDateOnlyMatch, new Date("2026-07-04T01:59:59Z"))).toBe(false);
  });

  it("does not check matches that already have a score", () => {
    expect(
      shouldCheckMatch(
        {
          ...scheduledDateOnlyMatch,
          homeScore: 1
        },
        new Date("2026-07-04T12:00:00Z")
      )
    ).toBe(false);
  });
});

describe("displayTeamName", () => {
  it("turns stored team ids into readable SerpApi query names", () => {
    expect(displayTeamName("united-states")).toBe("United States");
    expect(displayTeamName("cabo-verde")).toBe("Cabo Verde");
    expect(displayTeamName("paraguay")).toBe("Paraguay");
  });
});

describe("updateFinalScores", () => {
  it("does not rewrite the results file when no match is updated", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "world-cup-scores-"));
    tempDirs.push(dir);
    const resultsPath = path.join(dir, "results.json");
    const content = JSON.stringify(
      {
        lastUpdated: "2026-07-04T00:00:00.000Z",
        matches: [
          {
            id: "m89",
            homeTeamId: "paraguay",
            awayTeamId: "france",
            homeScore: null,
            awayScore: null,
            winnerTeamId: null,
            date: "2000-01-01",
            status: "SCHEDULED",
            updatedAt: null
          }
        ]
      },
      null,
      2
    );

    await writeFile(resultsPath, content);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          sports_results: {
            status: "Live",
            teams: [
              { name: "Paraguay", score: "0" },
              { name: "France", score: "0" }
            ]
          }
        })
      }))
    );

    const summary = await updateFinalScores({ resultsPath, apiKey: "test-key" });

    expect(summary).toMatchObject({ checked: 1, updated: 0, skipped: 1 });
    expect(await readFile(resultsPath, "utf8")).toBe(content);
  });
});
