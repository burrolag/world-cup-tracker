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

## Data

The app starts from editable seed data in `src/data/seed.ts` and keeps a browser cache for convenience.

The default seed is the July 1, 2026 knockout bracket snapshot, including completed Round of 32 results available at that point. Later-round teams automatically fill in when you enter a winner for the prior match.

To share the live board:

1. Click **Save JSON** to download the current board file.
2. Share that JSON file.
3. On another browser or later session, click **Upload JSON** and choose the shared file.
4. After making match, team, people, result, or prediction updates, click **Save JSON** again and share the updated file.

Browsers do not silently overwrite uploaded files, so saving creates a fresh downloaded copy with the latest results.
