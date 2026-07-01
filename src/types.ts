export type Round = "round32" | "round16" | "quarterfinal" | "semifinal" | "final";

export type Team = {
  id: string;
  name: string;
  code: string;
};

export type Match = {
  id: string;
  round: Round;
  label: string;
  slot: number;
  homeTeamId: string;
  awayTeamId: string;
  homeScore: number | null;
  awayScore: number | null;
  winnerTeamId: string | null;
  date: string;
  nextMatchId?: string;
  nextMatchSide?: "home" | "away";
};

export type Prediction = {
  matchId: string;
  winnerTeamId: string | null;
};

export type Participant = {
  id: string;
  name: string;
  predictions: Prediction[];
};

export type TournamentState = {
  teams: Team[];
  matches: Match[];
  participants: Participant[];
};

export type ScoreRow = {
  participant: Participant;
  correctByRound: Record<Round, number>;
  score: number;
};
