import type { TournamentState } from "../types";

function hasArrayProperty(value: unknown, property: keyof TournamentState) {
  return typeof value === "object" && value !== null && Array.isArray((value as TournamentState)[property]);
}

export function parseBoardFile(content: string): TournamentState {
  const parsed = JSON.parse(content) as unknown;

  if (
    !hasArrayProperty(parsed, "teams") ||
    !hasArrayProperty(parsed, "matches") ||
    !hasArrayProperty(parsed, "participants")
  ) {
    throw new Error("This JSON file is not a World Cup tracker board file.");
  }

  return parsed as TournamentState;
}

export function serializeBoardFile(state: TournamentState) {
  return JSON.stringify(state, null, 2);
}
