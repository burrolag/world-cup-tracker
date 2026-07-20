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

## Final results

The published GitHub Pages app loads final scores from `public/world-cup-results.json` on startup and when **Refresh Scores** is clicked. The 2026 tournament is complete, so the scheduled SerpApi score search has been disabled.

The final is saved as Spain 1-0 Argentina, with Spain as the World Cup winner.

Manual local refresh remains available for archival/debugging only:

```powershell
$env:SERPAPI_KEY="your-serpapi-key"
npm.cmd run update-scores
```

The updater calls SerpApi with one query per eligible unfinished match:

```text
https://serpapi.com/search.json?engine=google&q=<QUERY>&api_key=<SERPAPI_KEY>
```

Only matches that started more than two hours ago and are not complete are checked. Scores are saved only when SerpApi returns a clear final status such as `Final`, `FT`, `Full-time`, `Complete`, or `Finished`. If a match has only a date and no `kickoffUtc`, the updater treats the match as eligible two hours after that UTC date starts; the final-status check still prevents saving live or unclear results.

## Data

The app starts from the checked-in seed data in `src/data/seed.ts` and applies hosted results from `public/world-cup-results.json`.

The default seed and hosted results now include the completed knockout bracket through the final.
