import type { Match, Round } from "../types";

export const orderedRounds: Round[] = ["round32", "round16", "quarterfinal", "semifinal", "final"];

function localDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function roundRank(round: Round) {
  return orderedRounds.indexOf(round);
}

export function currentRoundForDate(matches: Match[], now = new Date()): Round {
  const today = localDateKey(now);
  const roundsWithMatches = orderedRounds.filter((round) => matches.some((match) => match.round === round));

  const activeRounds = roundsWithMatches.filter((round) =>
    matches.some((match) => match.round === round && match.date <= today && !match.winnerTeamId)
  );

  if (activeRounds.length > 0) {
    return activeRounds.sort((a, b) => roundRank(b) - roundRank(a))[0];
  }

  const upcomingRound = roundsWithMatches.find((round) =>
    matches.some((match) => match.round === round && match.date >= today && !match.winnerTeamId)
  );

  return upcomingRound ?? roundsWithMatches.at(-1) ?? "round32";
}
