# World Cup Tracker

React app for tracking World Cup knockout results and scoring each person's predictions.

## Scoring

- Round of 32 correct winner: 1 point
- Round of 16 correct winner: 2 points
- Round of 8 correct winner: 3 points
- Semifinal correct winner: 4 points
- Final correct winner: 5 points

## Run locally

```powershell
npm.cmd install
npm.cmd run dev
```

Production check:

```powershell
npm.cmd run test
npm.cmd run build
```

## Automatic scores

The published app loads official scores from `public/world-cup-results.json` on startup. When **Refresh Scores** is clicked, the app first calls the backend endpoint `GET /api/world-cup/update-final-scores`, then applies the updated results returned by that endpoint. A scheduled GitHub Action can also refresh the JSON file from SerpApi Google Sports Results.

To enable automatic updates in GitHub:

1. Create a SerpApi API key.
2. In the GitHub repository, add a repository secret named `SERPAPI_KEY`.
3. Keep GitHub Actions enabled. The workflow in `.github/workflows/update-results.yml` runs every 30 minutes and can also be started manually.

Manual local refresh:

```powershell
$env:SERPAPI_KEY="your-serpapi-key"
npm.cmd run update-scores
```

The updater calls SerpApi with one query per eligible unfinished match:

```text
https://serpapi.com/search.json?engine=google&q=<QUERY>&api_key=<SERPAPI_KEY>
```

Only matches that started more than two hours ago and are not complete are checked. Scores are saved only when SerpApi returns a clear final status such as `Final`, `FT`, `Full-time`, `Complete`, or `Finished`. If a match has only a date and no `kickoffUtc`, the updater waits until the end of that UTC date before checking to avoid early polling.

## Saving manual board edits

The app has a **Save to GitHub** button for manual score and prediction changes. That button calls `POST /api/world-cup/save-board`, which creates one GitHub commit updating:

- `src/data/defaultBoard.json`
- `public/world-cup-results.json`

The API route must run on a backend/serverless host because the GitHub token must not be exposed in the Vite frontend. Configure these backend environment variables:

- `GITHUB_TOKEN` or `GH_TOKEN`: token with repository contents write access
- `GITHUB_REPOSITORY` or `GH_REPOSITORY`: owner/repo, for example `your-name/world-cup-tracker`
- `GITHUB_BRANCH`: branch to update, defaults to `main`

If the API route is hosted somewhere other than the same origin as the app, set the frontend env var `VITE_BOARD_SAVE_ENDPOINT` to that full endpoint URL before building.

If the score-update API route is hosted somewhere other than the same origin as the app, set `VITE_SCORE_UPDATE_ENDPOINT` to the full `GET /api/world-cup/update-final-scores` URL before building. A static GitHub Pages site cannot run this API route by itself; it needs a separate backend/serverless host for SerpApi calls because `SERPAPI_KEY` must stay server-side.

## Data

The app starts from editable seed data in `src/data/seed.ts` and keeps a browser cache for convenience.

The default seed is the July 1, 2026 knockout bracket snapshot, including completed Round of 32 results available at that point. Later-round teams automatically fill in when you enter a winner for the prior match.
