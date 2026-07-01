import type { Match, Participant } from "../types";
import { upsertPrediction } from "./scoring";

function destinationField(side: "home" | "away") {
  return side === "home" ? "homeTeamId" : "awayTeamId";
}

function predictionFor(participant: Participant, matchId: string) {
  return participant.predictions.find((prediction) => prediction.matchId === matchId)?.winnerTeamId ?? null;
}

export function predictedMatchesForParticipant(matches: Match[], participant: Participant): Match[] {
  const predictedMatches = matches.map((match) => ({
    ...match,
    homeScore: null,
    awayScore: null,
    winnerTeamId: predictionFor(participant, match.id)
  }));

  for (const match of predictedMatches) {
    if (!match.nextMatchId || !match.nextMatchSide || !match.winnerTeamId) {
      continue;
    }

    const nextMatch = predictedMatches.find((candidate) => candidate.id === match.nextMatchId);

    if (nextMatch) {
      nextMatch[destinationField(match.nextMatchSide)] = match.winnerTeamId;
    }
  }

  return predictedMatches;
}

export function availablePredictionTeamIds(
  matches: Match[],
  participant: Participant,
  matchId: string
): string[] {
  const match = predictedMatchesForParticipant(matches, participant).find((candidate) => candidate.id === matchId);

  if (!match) {
    return [];
  }

  return [match.homeTeamId, match.awayTeamId].filter(Boolean);
}

export function isPredictionAllowed(
  matches: Match[],
  participant: Participant,
  matchId: string,
  teamId: string
) {
  return availablePredictionTeamIds(matches, participant, matchId).includes(teamId);
}

export function pruneInvalidPredictions(matches: Match[], participant: Participant): Participant {
  return participant.predictions.reduce<Participant>((currentParticipant, prediction) => {
    if (
      !prediction.winnerTeamId ||
      isPredictionAllowed(matches, currentParticipant, prediction.matchId, prediction.winnerTeamId)
    ) {
      return currentParticipant;
    }

    return upsertPrediction(currentParticipant, prediction.matchId, null);
  }, participant);
}

export function pruneAllInvalidPredictions(matches: Match[], participants: Participant[]) {
  return participants.map((participant) => pruneInvalidPredictions(matches, participant));
}
