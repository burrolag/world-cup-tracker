import { describe, expect, it } from "vitest";
import type { Match, Participant } from "../types";
import { calculateScores, upsertPrediction, winnerFromScore } from "./scoring";

const matches: Match[] = [
  {
    id: "r32-1",
    round: "round32",
    label: "R32 Match 1",
    slot: 1,
    homeTeamId: "arg",
    awayTeamId: "fra",
    homeScore: 2,
    awayScore: 1,
    winnerTeamId: "arg",
    date: "2026-06-20"
  },
  {
    id: "r16-1",
    round: "round16",
    label: "R16 Match 1",
    slot: 1,
    homeTeamId: "arg",
    awayTeamId: "bra",
    homeScore: 0,
    awayScore: 1,
    winnerTeamId: "bra",
    date: "2026-06-28"
  },
  {
    id: "qf-1",
    round: "quarterfinal",
    label: "Quarterfinal 1",
    slot: 1,
    homeTeamId: "bra",
    awayTeamId: "esp",
    homeScore: 3,
    awayScore: 2,
    winnerTeamId: "bra",
    date: "2026-07-04"
  },
  {
    id: "sf-1",
    round: "semifinal",
    label: "Semifinal 1",
    slot: 1,
    homeTeamId: "bra",
    awayTeamId: "eng",
    homeScore: 1,
    awayScore: 0,
    winnerTeamId: "bra",
    date: "2026-07-14"
  },
  {
    id: "final",
    round: "final",
    label: "Final",
    slot: 1,
    homeTeamId: "bra",
    awayTeamId: "eng",
    homeScore: null,
    awayScore: null,
    winnerTeamId: null,
    date: "2026-07-19"
  }
];

const participants: Participant[] = [
  {
    id: "sam",
    name: "Sam",
    predictions: [
      { matchId: "r32-1", winnerTeamId: "arg" },
      { matchId: "r16-1", winnerTeamId: "bra" },
      { matchId: "qf-1", winnerTeamId: "bra" },
      { matchId: "sf-1", winnerTeamId: "bra" },
      { matchId: "final", winnerTeamId: "eng" }
    ]
  },
  {
    id: "taylor",
    name: "Taylor",
    predictions: [
      { matchId: "r32-1", winnerTeamId: "fra" },
      { matchId: "r16-1", winnerTeamId: "bra" }
    ]
  }
];

describe("calculateScores", () => {
  it("awards the requested point ladder by knockout round", () => {
    const [leader, second] = calculateScores(matches, participants);

    expect(leader.participant.name).toBe("Sam");
    expect(leader.score).toBe(10);
    expect(leader.correctByRound.round32).toBe(1);
    expect(leader.correctByRound.round16).toBe(1);
    expect(leader.correctByRound.quarterfinal).toBe(1);
    expect(leader.correctByRound.semifinal).toBe(1);
    expect(second.score).toBe(2);
  });

  it("does not award points before a result has a winner", () => {
    const scoreRows = calculateScores(matches, participants);

    expect(scoreRows[0].correctByRound.final).toBe(0);
  });
});

describe("winnerFromScore", () => {
  it("chooses the higher scoring team", () => {
    expect(winnerFromScore(matches[0])).toBe("arg");
    expect(winnerFromScore(matches[1])).toBe("bra");
  });
});

describe("upsertPrediction", () => {
  it("updates an existing prediction without dropping the rest", () => {
    const updated = upsertPrediction(participants[0], "final", "bra");

    expect(updated.predictions).toHaveLength(5);
    expect(updated.predictions.find((prediction) => prediction.matchId === "final")?.winnerTeamId).toBe("bra");
  });
});
