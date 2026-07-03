import { CheckCircle2, ChevronDown, Medal, Plus, RotateCcw, Trash2, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { roundLabels, roundPoints, seedState } from "./data/seed";
import { advanceBracket } from "./lib/bracket";
import { fetchOfficialResults, mergeOfficialResults } from "./lib/officialResults";
import {
  availablePredictionTeamIds,
  isPredictionAllowed,
  predictedMatchesForParticipant,
  pruneAllInvalidPredictions,
  pruneInvalidPredictions
} from "./lib/predictionBracket";
import { calculateScores, upsertPrediction, winnerFromScore } from "./lib/scoring";
import type { Match, Participant, Round, TournamentState } from "./types";

const storageKey = "world-cup-tracker-state-v3";
const orderedRounds: Round[] = ["round32", "round16", "quarterfinal", "semifinal", "final"];

function readInitialState(): TournamentState {
  const saved = window.localStorage.getItem(storageKey);

  if (!saved) {
    return seedState;
  }

  try {
    return JSON.parse(saved) as TournamentState;
  } catch {
    return seedState;
  }
}

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

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function makeUniqueId(existingIds: string[], base: string) {
  const fallback = base || "item";
  return existingIds.includes(fallback) ? `${fallback}-${Date.now()}` : fallback;
}

export function App() {
  const [state, setState] = useState<TournamentState>(readInitialState);
  const [selectedRound, setSelectedRound] = useState<Round>("round32");
  const [activeParticipantId, setActiveParticipantId] = useState(state.participants[0]?.id ?? "");
  const [newParticipant, setNewParticipant] = useState("");
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
    window.localStorage.setItem(storageKey, JSON.stringify(nextState));
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

  function updateState(nextState: TournamentState) {
    setState(nextState);
    window.localStorage.setItem(storageKey, JSON.stringify(nextState));
  }

  function updateMatch(matchId: string, patch: Partial<Match>) {
    const nextMatches = state.matches.map((match) => {
      if (match.id !== matchId) {
        return match;
      }

      const updated = { ...match, ...patch };
      return { ...updated, winnerTeamId: patch.winnerTeamId ?? winnerFromScore(updated) };
    });

    const advancedMatches = advanceBracket(nextMatches, matchId);

    updateState({
      ...state,
      matches: advancedMatches,
      participants: pruneAllInvalidPredictions(advancedMatches, state.participants)
    });
  }

  function updatePrediction(participant: Participant, matchId: string, winnerTeamId: string | null) {
    const nextParticipant = pruneInvalidPredictions(
      state.matches,
      upsertPrediction(participant, matchId, winnerTeamId)
    );

    updateState({
      ...state,
      participants: state.participants.map((candidate) =>
        candidate.id === participant.id ? nextParticipant : candidate
      )
    });
  }

  function participantPick(participant: Participant, matchId: string) {
    return participant.predictions.find((prediction) => prediction.matchId === matchId)?.winnerTeamId ?? null;
  }

  function togglePredictionCard(matchId: string) {
    setExpandedPredictionCards((current) => ({ ...current, [matchId]: !current[matchId] }));
  }

  function addParticipant() {
    const trimmed = newParticipant.trim();

    if (!trimmed) {
      return;
    }

    const uniqueId = makeUniqueId(
      state.participants.map((participant) => participant.id),
      slugify(trimmed)
    );

    const participant = {
      id: uniqueId,
      name: trimmed,
      predictions: state.matches.map((match) => ({ matchId: match.id, winnerTeamId: null }))
    };

    updateState({ ...state, participants: [...state.participants, participant] });
    setActiveParticipantId(uniqueId);
    setNewParticipant("");
  }

  function updateParticipantName(participantId: string, name: string) {
    updateState({
      ...state,
      participants: state.participants.map((participant) =>
        participant.id === participantId ? { ...participant, name } : participant
      )
    });
  }

  function deleteParticipant(participantId: string) {
    const nextParticipants = state.participants.filter((participant) => participant.id !== participantId);

    updateState({ ...state, participants: nextParticipants });
    if (activeParticipantId === participantId) {
      setActiveParticipantId(nextParticipants[0]?.id ?? "");
    }
  }

  function renderMatchCard(match: Match) {
    return (
      <article className={`match-card ${match.winnerTeamId ? "complete" : ""}`} key={match.id}>
        <div className="bracket-meta">
          <span className={`status-pill ${match.winnerTeamId ? "complete" : ""}`}>
            {match.winnerTeamId ? "Full time" : "Scheduled"}
          </span>
          <input
            className="match-label-input"
            aria-label={`${match.label} label`}
            value={match.label}
            onChange={(event) => updateMatch(match.id, { label: event.target.value })}
          />
          <input
            className="match-date-input"
            aria-label={`${match.label} date`}
            value={match.date}
            onChange={(event) => updateMatch(match.id, { date: event.target.value })}
          />
        </div>
        <div className="score-entry">
          {matchOptions(state, match).map((option, index) => (
            <div
              className={`team-score ${match.winnerTeamId === option.id ? "winner" : ""}`}
              key={`${match.id}-${index}-${option.id}`}
            >
              <button
                className="team-pick"
                type="button"
                disabled={!option.id}
                onClick={() => updateMatch(match.id, { winnerTeamId: option.id })}
              >
                <span className="team-code">{option.code}</span>
                <span className="team-name">{option.label}</span>
              </button>
              <input
                className="score-input"
                aria-label={`${option.label} score`}
                min="0"
                type="number"
                value={(index === 0 ? match.homeScore : match.awayScore) ?? ""}
                onChange={(event) =>
                  updateMatch(match.id, {
                    [index === 0 ? "homeScore" : "awayScore"]:
                      event.target.value === "" ? null : Number(event.target.value)
                  })
                }
              />
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
              <div
                className={`leader-row ${row.participant.id === activeParticipantId ? "active" : ""} ${
                  index < 3 ? "podium" : ""
                }`}
                key={row.participant.id}
              >
                <button className="rank" type="button" onClick={() => setActiveParticipantId(row.participant.id)}>
                  {index + 1}
                </button>
                <input
                  aria-label={`Rename ${row.participant.name}`}
                  value={row.participant.name}
                  onChange={(event) => updateParticipantName(row.participant.id, event.target.value)}
                  onFocus={() => setActiveParticipantId(row.participant.id)}
                />
                <strong className="score-pill">{row.score}</strong>
                <button
                  className="icon-button danger"
                  type="button"
                  aria-label={`Remove ${row.participant.name}`}
                  onClick={() => deleteParticipant(row.participant.id)}
                >
                  <Trash2 size={16} aria-hidden="true" />
                </button>
              </div>
            ))}
          </div>
          <div className="add-person">
            <input
              aria-label="New participant name"
              placeholder="Add person"
              value={newParticipant}
              onChange={(event) => setNewParticipant(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  addParticipant();
                }
              }}
            />
            <button type="button" aria-label="Add participant" onClick={addParticipant}>
              <Plus size={18} aria-hidden="true" />
            </button>
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
            <span className="muted">Assign picks for {roundLabels[selectedRound]}</span>
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
                          const assignableParticipants = state.participants.filter(
                            (participant) =>
                              participantPick(participant, match.id) !== option.id &&
                              isPredictionAllowed(state.matches, participant, match.id, option.id)
                          );
                          const unavailableCount = state.participants.filter((participant) => {
                            const predictedMatch = predictedMatchesForParticipant(state.matches, participant).find(
                              (candidate) => candidate.id === match.id
                            );
                            const availableTeams = availablePredictionTeamIds(state.matches, participant, match.id);

                            return (
                              participantPick(participant, match.id) !== option.id &&
                              availableTeams.length > 0 &&
                              Boolean(predictedMatch?.homeTeamId) &&
                              !isPredictionAllowed(state.matches, participant, match.id, option.id)
                            );
                          }).length;

                          return (
                            <section className="pick-group" key={`${match.id}-${option.id}`}>
                              <div className="pick-group-heading">
                                <span>{option.label}</span>
                                <strong>{selectedParticipants.length}</strong>
                              </div>
                              <div className="pick-tabs" role="list" aria-label={`${option.label} picks`}>
                                {selectedParticipants.length > 0 ? (
                                  selectedParticipants.map((participant) => (
                                    <button
                                      className="pick-tab selected"
                                      key={`${match.id}-${option.id}-${participant.id}`}
                                      type="button"
                                      aria-label={`Clear ${participant.name}'s ${option.label} pick`}
                                      onClick={() => updatePrediction(participant, match.id, null)}
                                    >
                                      {participant.name}
                                      <span aria-hidden="true">x</span>
                                    </button>
                                  ))
                                ) : (
                                  <span className="pick-empty">No picks yet</span>
                                )}
                              </div>
                              <select
                                aria-label={`Assign ${option.label} pick for ${match.label}`}
                                value=""
                                disabled={assignableParticipants.length === 0}
                                onChange={(event) => {
                                  const participant = state.participants.find(
                                    (candidate) => candidate.id === event.target.value
                                  );

                                  if (participant) {
                                    updatePrediction(participant, match.id, option.id);
                                  }
                                }}
                              >
                                <option value="">
                                  {assignableParticipants.length > 0 ? "Add player" : "No eligible players"}
                                </option>
                                {assignableParticipants.map((participant) => (
                                  <option key={`${match.id}-${option.id}-${participant.id}`} value={participant.id}>
                                    {participant.name}
                                  </option>
                                ))}
                              </select>
                              {unavailableCount > 0 ? (
                                <small className="pick-note">
                                  {unavailableCount} not in this bracket path
                                </small>
                              ) : null}
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
            <p className="empty-state">Add a person to start tracking predictions.</p>
          )}
        </section>
      </section>
    </main>
  );
}
