import type { Match } from "../types";
import { winnerFromScore } from "./scoring";

function destinationField(side: "home" | "away") {
  return side === "home" ? "homeTeamId" : "awayTeamId";
}

export function advanceBracket(matches: Match[], changedMatchId: string): Match[] {
  const nextMatches = matches.map((match) => ({ ...match }));
  const queue = [changedMatchId];

  while (queue.length > 0) {
    const matchId = queue.shift()!;
    const source = nextMatches.find((match) => match.id === matchId);

    if (!source?.nextMatchId || !source.nextMatchSide) {
      continue;
    }

    const target = nextMatches.find((match) => match.id === source.nextMatchId);

    if (!target) {
      continue;
    }

    const field = destinationField(source.nextMatchSide);
    const nextTeamId = source.winnerTeamId ?? "";

    if (target[field] === nextTeamId) {
      continue;
    }

    target[field] = nextTeamId;

    if (target.winnerTeamId && ![target.homeTeamId, target.awayTeamId].includes(target.winnerTeamId)) {
      target.winnerTeamId = null;
    }

    target.winnerTeamId = winnerFromScore(target);
    queue.push(target.id);
  }

  return nextMatches;
}

export function advanceAllKnownWinners(matches: Match[]) {
  return matches.reduce((currentMatches, match) => advanceBracket(currentMatches, match.id), matches);
}
