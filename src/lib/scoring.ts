import type { Match, Participant, Round, ScoreRow } from "../types";

const rounds: Round[] = ["round32", "round16", "quarterfinal", "semifinal", "final"];
const roundPoints: Record<Round, number> = {
  round32: 1,
  round16: 2,
  quarterfinal: 3,
  semifinal: 4,
  final: 5
};

export function calculateScores(matches: Match[], participants: Participant[]): ScoreRow[] {
  return participants
    .map((participant) => {
      const correctByRound = rounds.reduce(
        (acc, round) => ({ ...acc, [round]: 0 }),
        {} as Record<Round, number>
      );

      const score = participant.predictions.reduce((total, prediction) => {
        const match = matches.find((candidate) => candidate.id === prediction.matchId);

        if (!match?.winnerTeamId || !prediction.winnerTeamId) {
          return total;
        }

        if (match.winnerTeamId !== prediction.winnerTeamId) {
          return total;
        }

        correctByRound[match.round] += 1;
        return total + roundPoints[match.round];
      }, 0);

      return { participant, correctByRound, score };
    })
    .sort((a, b) => b.score - a.score || a.participant.name.localeCompare(b.participant.name));
}

export function winnerFromScore(match: Match): string | null {
  if (match.homeScore === null || match.awayScore === null || match.homeScore === match.awayScore) {
    return match.winnerTeamId;
  }

  return match.homeScore > match.awayScore ? match.homeTeamId : match.awayTeamId;
}

export function upsertPrediction(
  participant: Participant,
  matchId: string,
  winnerTeamId: string | null
): Participant {
  const existing = participant.predictions.some((prediction) => prediction.matchId === matchId);

  return {
    ...participant,
    predictions: existing
      ? participant.predictions.map((prediction) =>
          prediction.matchId === matchId ? { ...prediction, winnerTeamId } : prediction
        )
      : [...participant.predictions, { matchId, winnerTeamId }]
  };
}
