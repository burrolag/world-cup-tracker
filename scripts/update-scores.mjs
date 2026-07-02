import { updateFinalScores } from "./serpapi-final-scores.mjs";

updateFinalScores().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
