import { describe, expect, it } from "vitest";
import { currentRoundForDate } from "./currentRound";
import type { Match } from "../types";

const baseMatch: Match = {
  id: "m1",
  round: "round32",
  label: "Match 1",
  slot: 1,
  homeTeamId: "a",
  awayTeamId: "b",
  homeScore: null,
  awayScore: null,
  winnerTeamId: null,
  date: "2026-06-29"
};

function match(overrides: Partial<Match>): Match {
  return { ...baseMatch, ...overrides };
}

describe("currentRoundForDate", () => {
  it("defaults to the latest started round with unfinished matches", () => {
    expect(
      currentRoundForDate(
        [
          match({ id: "m74", round: "round32", date: "2026-06-29", winnerTeamId: "paraguay" }),
          match({ id: "m93", round: "round16", date: "2026-07-06" }),
          match({ id: "m97", round: "quarterfinal", date: "2026-07-09" })
        ],
        new Date("2026-07-06T12:00:00")
      )
    ).toBe("round16");
  });

  it("defaults to the next upcoming round between rounds", () => {
    expect(
      currentRoundForDate(
        [
          match({ id: "m93", round: "round16", date: "2026-07-06", winnerTeamId: "spain" }),
          match({ id: "m94", round: "round16", date: "2026-07-06", winnerTeamId: "belgium" }),
          match({ id: "m97", round: "quarterfinal", date: "2026-07-09" })
        ],
        new Date("2026-07-08T12:00:00")
      )
    ).toBe("quarterfinal");
  });

  it("uses the final round after all matches are complete", () => {
    expect(
      currentRoundForDate(
        [
          match({ id: "m101", round: "semifinal", date: "2026-07-14", winnerTeamId: "france" }),
          match({ id: "m104", round: "final", date: "2026-07-19", winnerTeamId: "france" })
        ],
        new Date("2026-07-20T12:00:00")
      )
    ).toBe("final");
  });
});
