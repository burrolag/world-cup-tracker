import { CheckCircle2, ChevronDown, Medal, RotateCcw, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { roundLabels, roundPoints, seedState } from "./data/seed";
import { fetchOfficialResults, mergeOfficialResults } from "./lib/officialResults";
import { calculateScores } from "./lib/scoring";
import type { Match, Round, TournamentState } from "./types";

const orderedRounds: Round[] = ["round32", "round16", "quarterfinal", "semifinal", "final"];

function teamName(state: TournamentState, teamId: string | null): string {
  if (!teamId) {
    return "No pick";
  }

  return state.teams.find((team) => team.id === teamId)?.name ?? teamId;
}

function teamCode(state: TournamentState, teamId: string | null): string {
  if (!teamId) {
    return "TBD";
  }

  const team = state.teams.find((candidate) => candidate.id === teamId);
  return team?.code ?? teamId.slice(0, 3).toUpperCase();
}

function matchOptions(state: TournamentState, match: Match) {
  return [
    { id: match.homeTeamId, code: teamCode(state, match.homeTeamId), label: teamName(state, match.homeTeamId) },
    { id: match.awayTeamId, code: teamCode(state, match.awayTeamId), label: teamName(state, match.awayTeamId) }
  ];
}

export function App() {
  const [state, setState] = useState<TournamentState>(seedState);
  const [selectedRound, setSelectedRound] = useState<Round>("round32");
  const [isRefreshingScores, setIsRefreshingScores] = useState(false);
  const [officialResultsStatus, setOfficialResultsStatus] = useState("Official scores not loaded yet.");
  const [officialResultsError, setOfficialResultsError] = useState<string | null>(null);
  const [expandedPredictionCards, setExpandedPredictionCards] = useState<Record<string, boolean>>({});

  const scores = useMemo(() => calculateScores(state.matches, state.participants), [state]);
  const selectedMatches = state.matches.filter((match) => match.round === selectedRound);
  const completedMatches = state.matches.filter((match) => match.winnerTeamId).length;
  const leader = scores[0];
  const leaders = leader ? scores.filter((row) => row.score === leader.score) : [];
  const leaderNames = leaders.map((row) => row.participant.name).join(", ");

  function applyOfficialResults(nextState: TournamentState) {
    setState(nextState);
  }

  async function loadOfficialResults() {
    try {
      setOfficialResultsStatus("Loading official scores...");
      const resultsFile = await fetchOfficialResults();
      const nextState = mergeOfficialResults(state, resultsFile);

      applyOfficialResults(nextState);
      setOfficialResultsStatus(`Official scores updated ${new Date(resultsFile.lastUpdated).toLocaleString()}.`);
      setOfficialResultsError(null);
    } catch (error) {
      setOfficialResultsStatus("Official scores could not be loaded.");
      setOfficialResultsError(error instanceof Error ? error.message : "Unknown official results error.");
    }
  }

  async function refreshOfficialResults() {
    try {
      setIsRefreshingScores(true);
      setOfficialResultsStatus("Loading official scores...");
      setOfficialResultsError(null);

      const resultsFile = await fetchOfficialResults();
      const nextState = mergeOfficialResults(state, resultsFile);

      applyOfficialResults(nextState);
      setOfficialResultsStatus(`Official scores updated ${new Date(resultsFile.lastUpdated).toLocaleString()}.`);
    } catch (error) {
      setOfficialResultsStatus("Official scores could not be refreshed.");
      setOfficialResultsError(error instanceof Error ? error.message : "Unknown official results error.");
    } finally {
      setIsRefreshingScores(false);
    }
  }

  useEffect(() => {
    void loadOfficialResults();
  }, []);

  function participantPick(participant: TournamentState["participants"][number], matchId: string) {
    return participant.predictions.find((prediction) => prediction.matchId === matchId)?.winnerTeamId ?? null;
  }

  function togglePredictionCard(matchId: string) {
    setExpandedPredictionCards((current) => ({ ...current, [matchId]: !current[matchId] }));
  }

  function renderMatchCard(match: Match) {
    return (
      <article className={`match-card ${match.winnerTeamId ? "complete" : ""}`} key={match.id}>
        <div className="bracket-meta">
          <span className={`status-pill ${match.winnerTeamId ? "complete" : ""}`}>
            {match.winnerTeamId ? "Full time" : "Scheduled"}
          </span>
          <span className="match-label-text">{match.label}</span>
          <span className="match-date-text">{match.date}</span>
        </div>
        <div className="score-entry">
          {matchOptions(state, match).map((option, index) => (
            <div
              className={`team-score ${match.winnerTeamId === option.id ? "winner" : ""}`}
              key={`${match.id}-${index}-${option.id}`}
            >
              <div className="team-pick read-only" aria-label={option.label}>
                <span className="team-code">{option.code}</span>
                <span className="team-name">{option.label}</span>
              </div>
              <span className="score-value" aria-label={`${option.label} score`}>
                {(index === 0 ? match.homeScore : match.awayScore) ?? ""}
              </span>
            </div>
          ))}
        </div>
      </article>
    );
  }

  return (
    <main className="app-shell">
      <section className="hero">
        <div className="hero-main">
          <p className="eyebrow">2026 knockout pool</p>
          <h1>World Cup Pool</h1>
          <p className="hero-copy">
            Track knockout results, capture everyone&apos;s predictions, and score the pool round by round.
          </p>
          <div className="hero-stats" aria-label="Pool summary">
            <div className="stat-tile">
              <Users size={18} aria-hidden="true" />
              <span>{state.participants.length}</span>
              <small>Players</small>
            </div>
            <div className="stat-tile">
              <CheckCircle2 size={18} aria-hidden="true" />
              <span>
                {completedMatches}/{state.matches.length}
              </span>
              <small>Results</small>
            </div>
            <div className="stat-tile">
              <Medal size={18} aria-hidden="true" />
              <span>{leader ? leader.score : 0}</span>
              <small>{leaders.length === 1 ? "Leader" : "Leaders"}</small>
            </div>
          </div>
          {leader ? (
            <div className="hero-leaders" aria-label="Current leader">
              <span>{leaders.length === 1 ? "Current leader" : "Current leaders"}</span>
              <strong>{leaderNames}</strong>
              <small>{leader.score} pts</small>
            </div>
          ) : null}
        </div>
      </section>

      <section className="toolbar" aria-label="Tracker actions">
        <button type="button" onClick={() => void refreshOfficialResults()} disabled={isRefreshingScores}>
          <RotateCcw size={18} aria-hidden="true" />
          {isRefreshingScores ? "Refreshing..." : "Refresh Scores"}
        </button>
      </section>

      <p className={`results-status ${officialResultsError ? "error" : ""}`}>
        {officialResultsStatus}
        {officialResultsError ? ` ${officialResultsError}` : ""}
      </p>

      <section className="layout-grid">
        <aside className="panel leaderboard">
          <div className="panel-heading">
            <h2>Leaderboard</h2>
            <span className="muted">{state.participants.length} people</span>
          </div>
          <div className="leader-list">
            {scores.map((row, index) => (
              <div className={`leader-row ${index < 3 ? "podium" : ""}`} key={row.participant.id}>
                <span className="rank">{index + 1}</span>
                <span className="leader-name">{row.participant.name}</span>
                <strong className="score-pill">{row.score}</strong>
              </div>
            ))}
          </div>
        </aside>

        <section className="panel matches-panel">
          <div className="panel-heading">
            <h2>Matches</h2>
            <span className="muted">
              {selectedMatches.filter((match) => match.winnerTeamId).length}/{selectedMatches.length} complete
            </span>
          </div>
          <div className="round-tabs" role="tablist" aria-label="Rounds">
            {orderedRounds.map((round) => (
              <button
                className={selectedRound === round ? "selected" : ""}
                key={round}
                type="button"
                onClick={() => setSelectedRound(round)}
              >
                {roundLabels[round]}
                <span>{roundPoints[round]} pt{roundPoints[round] === 1 ? "" : "s"}</span>
              </button>
            ))}
          </div>
          <div className="match-list">{selectedMatches.map(renderMatchCard)}</div>
        </section>

        <section className="panel predictions">
          <div className="panel-heading">
            <h2>Predictions</h2>
            <span className="muted">Picks for {roundLabels[selectedRound]}</span>
          </div>
          {state.participants.length > 0 ? (
            <div className="prediction-list">
              {selectedMatches.map((match) => {
                const predictionOptions = matchOptions(state, match).filter((option) => option.id);
                const isExpanded = Boolean(expandedPredictionCards[match.id]);

                return (
                  <article className={`prediction-card ${isExpanded ? "expanded" : ""}`} key={match.id}>
                    <button
                      className="prediction-card-toggle"
                      type="button"
                      aria-expanded={isExpanded}
                      aria-controls={`${match.id}-prediction-picks`}
                      onClick={() => togglePredictionCard(match.id)}
                    >
                      <span className="prediction-card-title">
                        <strong>{match.label}</strong>
                        <span className="muted">
                          {match.winnerTeamId ? `Winner: ${teamName(state, match.winnerTeamId)}` : "Awaiting result"}
                        </span>
                      </span>
                      <span className="prediction-summary" aria-label={`${match.label} pick summary`}>
                        {predictionOptions.length > 0
                          ? `Picks: ${predictionOptions
                              .map((option) => {
                                const count = state.participants.filter(
                                  (participant) => participantPick(participant, match.id) === option.id
                                ).length;
                                return `${option.code} ${count}`;
                              })
                              .join(", ")}`
                          : "Teams pending"}
                      </span>
                      <ChevronDown className="prediction-chevron" size={16} aria-hidden="true" />
                    </button>
                    {isExpanded && predictionOptions.length > 0 ? (
                      <div className="pick-group-list" id={`${match.id}-prediction-picks`}>
                        {predictionOptions.map((option) => {
                          const selectedParticipants = state.participants.filter(
                            (participant) => participantPick(participant, match.id) === option.id
                          );
                          return (
                            <section className="pick-group" key={`${match.id}-${option.id}`}>
                              <div className="pick-group-heading">
                                <span>{option.label}</span>
                                <strong>{selectedParticipants.length}</strong>
                              </div>
                              <div className="pick-tabs" role="list" aria-label={`${option.label} picks`}>
                                {selectedParticipants.length > 0 ? (
                                  selectedParticipants.map((participant) => (
                                    <span
                                      className="pick-tab selected"
                                      key={`${match.id}-${option.id}-${participant.id}`}
                                    >
                                      {participant.name}
                                    </span>
                                  ))
                                ) : (
                                  <span className="pick-empty">No picks yet</span>
                                )}
                              </div>
                            </section>
                          );
                        })}
                      </div>
                    ) : isExpanded ? (
                      <p className="empty-state">Teams are not available for this match yet.</p>
                    ) : null}
                  </article>
                );
              })}
            </div>
          ) : (
            <p className="empty-state">No predictions are available.</p>
          )}
        </section>
      </section>
    </main>
  );
}
