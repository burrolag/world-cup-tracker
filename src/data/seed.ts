import defaultBoard from "./defaultBoard.json";
import { advanceAllKnownWinners } from "../lib/bracket";
import type { Round, TournamentState } from "../types";

export const roundLabels: Record<Round, string> = {
  round32: "Round of 32",
  round16: "Round of 16",
  quarterfinal: "Round of 8",
  semifinal: "Semifinals",
  final: "Final"
};

export const roundPoints: Record<Round, number> = {
  round32: 1,
  round16: 2,
  quarterfinal: 3,
  semifinal: 4,
  final: 5
};

export const seedState: TournamentState = {
  ...(defaultBoard as TournamentState),
  matches: advanceAllKnownWinners((defaultBoard as TournamentState).matches)
};

export const teams = seedState.teams;
export const matches = seedState.matches;
export const participants = seedState.participants;
