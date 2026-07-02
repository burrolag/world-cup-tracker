const boardPath = "src/data/defaultBoard.json";
const resultsPath = "public/world-cup-results.json";

function requiredEnv(name, fallbackName) {
  const value = process.env[name] ?? (fallbackName ? process.env[fallbackName] : undefined);
  if (!value) {
    throw new Error(`${name}${fallbackName ? ` or ${fallbackName}` : ""} is required.`);
  }
  return value;
}

function encodeBase64Json(value) {
  return JSON.stringify(value, null, 2) + "\n";
}

export function officialResultsFromState(state, now = new Date()) {
  return {
    lastUpdated: now.toISOString(),
    source: "Manual GitHub save",
    matches: state.matches.map((match) => ({
      id: match.id,
      homeTeamId: match.homeTeamId,
      awayTeamId: match.awayTeamId,
      homeScore: match.homeScore,
      awayScore: match.awayScore,
      winnerTeamId: match.winnerTeamId,
      date: match.date,
      status: match.winnerTeamId ? "Complete" : "SCHEDULED",
      updatedAt: match.winnerTeamId ? now.toISOString() : null
    }))
  };
}

export function validateTournamentState(value) {
  if (!value || typeof value !== "object") {
    throw new Error("Request body must include a tournament state object.");
  }

  if (!Array.isArray(value.teams) || !Array.isArray(value.matches) || !Array.isArray(value.participants)) {
    throw new Error("Tournament state must include teams, matches, and participants arrays.");
  }

  for (const match of value.matches) {
    if (!match.id || !match.round || typeof match.slot !== "number") {
      throw new Error("Every match must include id, round, and slot.");
    }
  }

  return value;
}

async function githubJsonRequest(path, { method = "GET", token, body } = {}) {
  const response = await fetch(`https://api.github.com${path}`, {
    method,
    headers: {
      accept: "application/vnd.github+json",
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      "x-github-api-version": "2022-11-28"
    },
    body: body ? JSON.stringify(body) : undefined
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(payload?.message ?? `GitHub API request failed with ${response.status}.`);
  }

  return payload;
}

export async function saveBoardToGitHub(state, options = {}) {
  const token = options.token ?? requiredEnv("GITHUB_TOKEN", "GH_TOKEN");
  const repository = options.repository ?? requiredEnv("GITHUB_REPOSITORY", "GH_REPOSITORY");
  const branch = options.branch ?? process.env.GITHUB_BRANCH ?? "main";
  const [owner, repo] = repository.split("/");

  if (!owner || !repo) {
    throw new Error("GITHUB_REPOSITORY must use owner/repo format.");
  }

  const validState = validateTournamentState(state);
  const now = new Date();
  const boardContent = encodeBase64Json(validState);
  const resultsContent = encodeBase64Json(officialResultsFromState(validState, now));
  const message = options.message ?? `Update World Cup tracker board ${now.toISOString()}`;

  const ref = await githubJsonRequest(`/repos/${owner}/${repo}/git/ref/heads/${branch}`, { token });
  const baseCommitSha = ref.object.sha;
  const baseCommit = await githubJsonRequest(`/repos/${owner}/${repo}/git/commits/${baseCommitSha}`, { token });
  const tree = await githubJsonRequest(`/repos/${owner}/${repo}/git/trees`, {
    method: "POST",
    token,
    body: {
      base_tree: baseCommit.tree.sha,
      tree: [
        { path: boardPath, mode: "100644", type: "blob", content: boardContent },
        { path: resultsPath, mode: "100644", type: "blob", content: resultsContent }
      ]
    }
  });
  const commit = await githubJsonRequest(`/repos/${owner}/${repo}/git/commits`, {
    method: "POST",
    token,
    body: {
      message,
      tree: tree.sha,
      parents: [baseCommitSha]
    }
  });

  await githubJsonRequest(`/repos/${owner}/${repo}/git/refs/heads/${branch}`, {
    method: "PATCH",
    token,
    body: { sha: commit.sha }
  });

  return {
    commitSha: commit.sha,
    commitUrl: commit.html_url ?? `https://github.com/${owner}/${repo}/commit/${commit.sha}`,
    files: [boardPath, resultsPath]
  };
}
