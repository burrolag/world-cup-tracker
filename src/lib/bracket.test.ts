import { describe, expect, it } from "vitest";
import type { Match } from "../types";
import { advanceBracket } from "./bracket";

const matches: Match[] = [
  {
    id: "m73",
    round: "round32",
    label: "Match 73",
    slot: 1,
    homeTeamId: "south-africa",
    awayTeamId: "canada",
    homeScore: 0,
    awayScore: 1,
    winnerTeamId: "canada",
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
    homeScore: 1,
    awayScore: 1,
    winnerTeamId: "morocco",
    date: "2026-06-29",
    nextMatchId: "m90",
    nextMatchSide: "away"
  },
  {
    id: "m90",
    round: "round16",
    label: "Match 90",
    slot: 2,
    homeTeamId: "",
    awayTeamId: "",
    homeScore: null,
    awayScore: null,
    winnerTeamId: null,
    date: "2026-07-04"
  }
];

describe("advanceBracket", () => {
  it("moves a winning team into its configured next match side", () => {
    const afterCanada = advanceBracket(matches, "m73");
    const afterMorocco = advanceBracket(afterCanada, "m75");

    expect(afterMorocco.find((match) => match.id === "m90")).toMatchObject({
      homeTeamId: "canada",
      awayTeamId: "morocco"
    });
  });

  it("clears a downstream side when the source winner is removed", () => {
    const withWinner = advanceBracket(matches, "m73");
    const changed = withWinner.map((match) =>
      match.id === "m73" ? { ...match, winnerTeamId: null, homeScore: null, awayScore: null } : match
    );

    expect(advanceBracket(changed, "m73").find((match) => match.id === "m90")?.homeTeamId).toBe("");
  });
});
