import { describe, expect, it } from "vitest";
import type { Match, Participant } from "../types";
import {
  availablePredictionTeamIds,
  predictedMatchesForParticipant,
  pruneInvalidPredictions
} from "./predictionBracket";

const matches: Match[] = [
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
    id: "m75",
    round: "round32",
    label: "Match 75",
    slot: 2,
    homeTeamId: "netherlands",
    awayTeamId: "morocco",
    homeScore: null,
    awayScore: null,
    winnerTeamId: null,
    date: "2026-06-29",
    nextMatchId: "m90",
    nextMatchSide: "away"
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
];

const canadaMorocco: Participant = {
  id: "alex",
  name: "Alex",
  predictions: [
    { matchId: "m73", winnerTeamId: "canada" },
    { matchId: "m75", winnerTeamId: "morocco" },
    { matchId: "m90", winnerTeamId: "canada" }
  ]
};

describe("predictedMatchesForParticipant", () => {
  it("advances round of 32 picks into a player round of 16 bracket", () => {
    const predictedRound16 = predictedMatchesForParticipant(matches, canadaMorocco).find(
      (match) => match.id === "m90"
    );

    expect(predictedRound16).toMatchObject({
      homeTeamId: "canada",
      awayTeamId: "morocco"
    });
  });

  it("allows different players to have different teams available in the same future match", () => {
    const southAfricaNetherlands: Participant = {
      id: "sam",
      name: "Sam",
      predictions: [
        { matchId: "m73", winnerTeamId: "south-africa" },
        { matchId: "m75", winnerTeamId: "netherlands" }
      ]
    };

    expect(availablePredictionTeamIds(matches, canadaMorocco, "m90")).toEqual(["canada", "morocco"]);
    expect(availablePredictionTeamIds(matches, southAfricaNetherlands, "m90")).toEqual([
      "south-africa",
      "netherlands"
    ]);
  });
});

describe("pruneInvalidPredictions", () => {
  it("clears future picks that no longer fit after an earlier pick changes", () => {
    const changedEarlyPick: Participant = {
      ...canadaMorocco,
      predictions: canadaMorocco.predictions.map((prediction) =>
        prediction.matchId === "m73" ? { ...prediction, winnerTeamId: "south-africa" } : prediction
      )
    };

    const pruned = pruneInvalidPredictions(matches, changedEarlyPick);

    expect(pruned.predictions.find((prediction) => prediction.matchId === "m90")?.winnerTeamId).toBeNull();
  });
});
