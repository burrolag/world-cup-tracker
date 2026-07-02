import { Plus, RotateCcw, Save, Trash2, Trophy } from "lucide-react";
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

function matchOptions(state: TournamentState, match: Match) {
  return [
    { id: match.homeTeamId, label: teamName(state, match.homeTeamId) },
    { id: match.awayTeamId, label: teamName(state, match.awayTeamId) }
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
  const [hasUnsavedGitHubChanges, setHasUnsavedGitHubChanges] = useState(false);
  const [saveStatus, setSaveStatus] = useState("Loaded from hosted board. Save changes to GitHub when edits are ready.");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSavingToGitHub, setIsSavingToGitHub] = useState(false);
  const [officialResultsStatus, setOfficialResultsStatus] = useState("Official scores not loaded yet.");
  const [officialResultsError, setOfficialResultsError] = useState<string | null>(null);

  const scores = useMemo(() => calculateScores(state.matches, state.participants), [state]);
  const selectedMatches = state.matches.filter((match) => match.round === selectedRound);

  function applyOfficialResults(nextState: TournamentState, markUnsaved = false) {
    setState(nextState);
    window.localStorage.setItem(storageKey, JSON.stringify(nextState));
    if (markUnsaved) {
      setHasUnsavedGitHubChanges(true);
      setSaveStatus("Official scores changed the board. Save to GitHub to publish the latest board.");
    }
  }

  async function refreshOfficialResults() {
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

  useEffect(() => {
    void refreshOfficialResults();
  }, []);

  function updateState(nextState: TournamentState) {
    setState(nextState);
    window.localStorage.setItem(storageKey, JSON.stringify(nextState));
    setHasUnsavedGitHubChanges(true);
    setSaveStatus("Changed in browser. Save to GitHub to publish this board.");
    setSaveError(null);
  }

  async function saveBoardToGitHub() {
    try {
      setIsSavingToGitHub(true);
      setSaveStatus("Saving board to GitHub...");
      setSaveError(null);

      const response = await fetch(
        import.meta.env.VITE_BOARD_SAVE_ENDPOINT ?? "/api/world-cup/save-board",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ state })
        }
      );
      const result = (await response.json().catch(() => null)) as { error?: string; commitUrl?: string } | null;

      if (!response.ok) {
        throw new Error(result?.error ?? `GitHub save failed with ${response.status}.`);
      }

      setHasUnsavedGitHubChanges(false);
      setSaveStatus(result?.commitUrl ? `Saved to GitHub: ${result.commitUrl}` : "Saved to GitHub.");
    } catch (error) {
      setSaveStatus("GitHub save failed.");
      setSaveError(error instanceof Error ? error.message : "Unknown GitHub save error.");
    } finally {
      setIsSavingToGitHub(false);
    }
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

  function togglePrediction(participant: Participant, matchId: string, winnerTeamId: string, checked: boolean) {
    const currentPick =
      participant.predictions.find((prediction) => prediction.matchId === matchId)?.winnerTeamId ?? null;

    if (!checked && currentPick !== winnerTeamId) {
      return;
    }

    updatePrediction(participant, matchId, checked ? winnerTeamId : null);
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

  return (
    <main className="app-shell">
      <section className="hero">
        <div>
          <p className="eyebrow"></p>
          <h1>World Cup Tracker</h1>
          <p className="hero-copy">
            Track knockout results, capture everyone&apos;s predictions, and score the pool round by round.
          </p>
        </div>
        <div className="score-card">
          <Trophy aria-hidden="true" />
          <span>Final pick is worth</span>
          <strong>5 pts</strong>
        </div>
      </section>

      <section className="toolbar" aria-label="Tracker actions">
        <button type="button" onClick={() => void saveBoardToGitHub()} disabled={isSavingToGitHub}>
          <Save size={18} aria-hidden="true" />
          {isSavingToGitHub ? "Saving..." : "Save to GitHub"}
        </button>
        <button type="button" onClick={() => void refreshOfficialResults()}>
          <RotateCcw size={18} aria-hidden="true" />
          Refresh Scores
        </button>
        <div className={`sync-status ${saveError ? "error" : ""}`} role="status">
          <strong>{hasUnsavedGitHubChanges ? "Unsaved GitHub changes" : "GitHub board current"}</strong>
          <span>{saveStatus}</span>
        </div>
      </section>

      {saveError ? <p className="sync-error">GitHub save issue: {saveError}</p> : null}
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
                className={`leader-row ${row.participant.id === activeParticipantId ? "active" : ""}`}
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
                <strong>{row.score}</strong>
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

        <section className="panel">
          <div className="panel-heading">
            <h2>Matches</h2>
            <span className="muted">Set scores or choose the winner</span>
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
          <div className="match-list">
            {selectedMatches.map((match) => (
              <article className="match-card" key={match.id}>
                <div className="match-topline">
                  <input
                    aria-label={`${match.label} label`}
                    value={match.label}
                    onChange={(event) => updateMatch(match.id, { label: event.target.value })}
                  />
                  <input
                    aria-label={`${match.label} date`}
                    value={match.date}
                    onChange={(event) => updateMatch(match.id, { date: event.target.value })}
                  />
                </div>
                <div className="match-teams locked">
                  <div>
                    <span>Team 1</span>
                    <strong>{teamName(state, match.homeTeamId)}</strong>
                  </div>
                  <div>
                    <span>Team 2</span>
                    <strong>{teamName(state, match.awayTeamId)}</strong>
                  </div>
                </div>
                <div className="score-entry">
                  {matchOptions(state, match).map((option, index) => (
                    <div className="team-score" key={`${match.id}-${index}-${option.id}`}>
                      <button
                        className={match.winnerTeamId === option.id ? "winner" : ""}
                        type="button"
                        disabled={!option.id}
                        onClick={() => updateMatch(match.id, { winnerTeamId: option.id })}
                      >
                        {option.label}
                      </button>
                      <input
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
            ))}
          </div>
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

                return (
                  <article className="prediction-card" key={match.id}>
                    <div className="prediction-card-heading">
                      <strong>{match.label}</strong>
                      <span className="muted">
                        {match.winnerTeamId ? `Winner: ${teamName(state, match.winnerTeamId)}` : "Awaiting result"}
                      </span>
                    </div>
                    {predictionOptions.length > 0 ? (
                      <div className="pick-group-list">
                        {predictionOptions.map((option) => (
                          <section className="pick-group" key={`${match.id}-${option.id}`}>
                            <div className="pick-group-heading">{option.label}</div>
                            <div className="pick-people">
                              {state.participants.map((participant) => {
                                const pick =
                                  participant.predictions.find((prediction) => prediction.matchId === match.id)
                                    ?.winnerTeamId ?? null;
                                const allowed = isPredictionAllowed(
                                  state.matches,
                                  participant,
                                  match.id,
                                  option.id
                                );
                                const availableTeams = availablePredictionTeamIds(
                                  state.matches,
                                  participant,
                                  match.id
                                );
                                const predictedMatch = predictedMatchesForParticipant(
                                  state.matches,
                                  participant
                                ).find((candidate) => candidate.id === match.id);

                                return (
                                  <label
                                    className={`pick-person ${!allowed ? "disabled" : ""}`}
                                    key={`${match.id}-${option.id}-${participant.id}`}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={pick === option.id}
                                      disabled={!allowed}
                                      onChange={(event) =>
                                        togglePrediction(participant, match.id, option.id, event.target.checked)
                                      }
                                    />
                                    <span>{participant.name}</span>
                                    {!allowed ? (
                                      <small>
                                        {availableTeams.length === 0 || !predictedMatch?.homeTeamId
                                          ? "waiting on prior picks"
                                          : "not in their bracket"}
                                      </small>
                                    ) : null}
                                  </label>
                                );
                              })}
                            </div>
                          </section>
                        ))}
                      </div>
                    ) : (
                      <p className="empty-state">Teams are not available for this match yet.</p>
                    )}
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
