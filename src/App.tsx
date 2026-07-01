import { Download, Plus, RotateCcw, Trash2, Trophy, Upload } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { roundLabels, roundPoints, seedState } from "./data/seed";
import { parseBoardFile, serializeBoardFile } from "./lib/boardFile";
import { advanceBracket } from "./lib/bracket";
import {
  availablePredictionTeamIds,
  isPredictionAllowed,
  predictedMatchesForParticipant,
  pruneAllInvalidPredictions,
  pruneInvalidPredictions
} from "./lib/predictionBracket";
import { calculateScores, upsertPrediction, winnerFromScore } from "./lib/scoring";
import type { Match, Participant, Round, Team, TournamentState } from "./types";

const storageKey = "world-cup-tracker-state-v2";
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

function teamSelectOptions(state: TournamentState, selectedId: string) {
  const hasSelectedTeam = state.teams.some((team) => team.id === selectedId);

  return hasSelectedTeam || !selectedId
    ? state.teams
    : [{ id: selectedId, name: selectedId, code: selectedId.slice(0, 3).toUpperCase() }, ...state.teams];
}

export function App() {
  const [state, setState] = useState<TournamentState>(readInitialState);
  const [selectedRound, setSelectedRound] = useState<Round>("round32");
  const [activeParticipantId, setActiveParticipantId] = useState(state.participants[0]?.id ?? "");
  const [newParticipant, setNewParticipant] = useState("");
  const [newTeamName, setNewTeamName] = useState("");
  const [newTeamCode, setNewTeamCode] = useState("");
  const [boardFileName, setBoardFileName] = useState("world-cup-tracker.json");
  const [hasUnsavedFileChanges, setHasUnsavedFileChanges] = useState(false);
  const [fileStatus, setFileStatus] = useState("Using browser cache. Upload or save a JSON board file to share.");
  const [fileError, setFileError] = useState<string | null>(null);
  const importRef = useRef<HTMLInputElement>(null);

  const scores = useMemo(() => calculateScores(state.matches, state.participants), [state]);
  const selectedMatches = state.matches.filter((match) => match.round === selectedRound);

  function updateState(nextState: TournamentState) {
    setState(nextState);
    window.localStorage.setItem(storageKey, JSON.stringify(nextState));
    setHasUnsavedFileChanges(true);
    setFileStatus(`Changed in browser. Save ${boardFileName} to share the latest board.`);
    setFileError(null);
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

  function addTeam() {
    const name = newTeamName.trim();

    if (!name) {
      return;
    }

    const code = (newTeamCode.trim() || name.slice(0, 3)).toUpperCase();
    const team: Team = {
      id: makeUniqueId(
        state.teams.map((candidate) => candidate.id),
        slugify(code || name)
      ),
      name,
      code
    };

    updateState({ ...state, teams: [...state.teams, team] });
    setNewTeamName("");
    setNewTeamCode("");
  }

  function updateTeam(teamId: string, patch: Partial<Team>) {
    updateState({
      ...state,
      teams: state.teams.map((team) => (team.id === teamId ? { ...team, ...patch } : team))
    });
  }

  function deleteTeam(teamId: string) {
    updateState({
      ...state,
      teams: state.teams.filter((team) => team.id !== teamId),
      matches: state.matches.map((match) => ({
        ...match,
        homeTeamId: match.homeTeamId === teamId ? "" : match.homeTeamId,
        awayTeamId: match.awayTeamId === teamId ? "" : match.awayTeamId,
        winnerTeamId: match.winnerTeamId === teamId ? null : match.winnerTeamId
      })),
      participants: state.participants.map((participant) => ({
        ...participant,
        predictions: participant.predictions.map((prediction) =>
          prediction.winnerTeamId === teamId ? { ...prediction, winnerTeamId: null } : prediction
        )
      }))
    });
  }

  function resetState() {
    updateState(seedState);
    setActiveParticipantId(seedState.participants[0]?.id ?? "");
    setBoardFileName("world-cup-tracker.json");
  }

  function exportState() {
    const blob = new Blob([serializeBoardFile(state)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = boardFileName;
    link.click();
    URL.revokeObjectURL(url);
    setHasUnsavedFileChanges(false);
    setFileStatus(`Downloaded ${boardFileName}. Share that file to carry these updates forward.`);
    setFileError(null);
  }

  async function importState(file: File) {
    try {
      const content = await file.text();
      const importedState = parseBoardFile(content);

      setState(importedState);
      setActiveParticipantId(importedState.participants[0]?.id ?? "");
      setBoardFileName(file.name || "world-cup-tracker.json");
      setHasUnsavedFileChanges(false);
      setFileStatus(`Loaded ${file.name}. Edits will stay in browser until you save the JSON file again.`);
      setFileError(null);
      window.localStorage.setItem(storageKey, JSON.stringify(importedState));
    } catch (error) {
      setFileError(error instanceof Error ? error.message : "The selected file could not be imported.");
      setFileStatus("Import failed");
    }
  }

  return (
    <main className="app-shell">
      <section className="hero">
        <div>
          <p className="eyebrow">Accela Gateway Services</p>
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
        <button type="button" onClick={exportState}>
          <Download size={18} aria-hidden="true" />
          Save JSON
        </button>
        <button type="button" onClick={() => importRef.current?.click()}>
          <Upload size={18} aria-hidden="true" />
          Upload JSON
        </button>
        <button type="button" onClick={resetState}>
          <RotateCcw size={18} aria-hidden="true" />
          Reset
        </button>
        <input
          ref={importRef}
          className="hidden-input"
          type="file"
          accept="application/json"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) {
              void importState(file);
            }
          }}
        />
        <div className={`sync-status ${fileError ? "error" : ""}`} role="status">
          <strong>{hasUnsavedFileChanges ? "Unsaved JSON changes" : "JSON file ready"}</strong>
          <span>{fileStatus}</span>
        </div>
      </section>

      {fileError ? <p className="sync-error">File issue: {fileError}</p> : null}

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
                <div className="match-teams">
                  <label>
                    Team 1
                    <select
                      value={match.homeTeamId}
                      onChange={(event) =>
                        updateMatch(match.id, {
                          homeTeamId: event.target.value,
                          winnerTeamId: match.winnerTeamId === match.homeTeamId ? null : match.winnerTeamId
                        })
                      }
                    >
                      <option value="">Select team</option>
                      {teamSelectOptions(state, match.homeTeamId).map((team) => (
                        <option key={team.id} value={team.id}>
                          {team.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Team 2
                    <select
                      value={match.awayTeamId}
                      onChange={(event) =>
                        updateMatch(match.id, {
                          awayTeamId: event.target.value,
                          winnerTeamId: match.winnerTeamId === match.awayTeamId ? null : match.winnerTeamId
                        })
                      }
                    >
                      <option value="">Select team</option>
                      {teamSelectOptions(state, match.awayTeamId).map((team) => (
                        <option key={team.id} value={team.id}>
                          {team.name}
                        </option>
                      ))}
                    </select>
                  </label>
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
                      <p className="empty-state">Set teams for this match before assigning predictions.</p>
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

      <section className="panel team-editor">
        <div className="panel-heading">
          <h2>Teams</h2>
          <span className="muted">Add or rename teams used in match pairings</span>
        </div>
        <div className="add-team">
          <input
            aria-label="New team name"
            placeholder="Team name"
            value={newTeamName}
            onChange={(event) => setNewTeamName(event.target.value)}
          />
          <input
            aria-label="New team code"
            placeholder="Code"
            value={newTeamCode}
            onChange={(event) => setNewTeamCode(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                addTeam();
              }
            }}
          />
          <button type="button" onClick={addTeam}>
            <Plus size={18} aria-hidden="true" />
            Add
          </button>
        </div>
        <div className="team-list">
          {state.teams.map((team) => (
            <article className="team-row" key={team.id}>
              <input
                aria-label={`${team.name} name`}
                value={team.name}
                onChange={(event) => updateTeam(team.id, { name: event.target.value })}
              />
              <input
                aria-label={`${team.name} code`}
                value={team.code}
                onChange={(event) => updateTeam(team.id, { code: event.target.value.toUpperCase() })}
              />
              <button
                className="icon-button danger"
                type="button"
                aria-label={`Remove ${team.name}`}
                onClick={() => deleteTeam(team.id)}
              >
                <Trash2 size={16} aria-hidden="true" />
              </button>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
