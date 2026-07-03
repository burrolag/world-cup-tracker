import { readFile } from "node:fs/promises";
import { defaultResultsPath, parseJsonContent, updateFinalScores } from "../../scripts/serpapi-final-scores.mjs";

export default async function handler(request, response) {
  if (request.method && request.method !== "GET") {
    response.statusCode = 405;
    response.setHeader("content-type", "application/json");
    response.end(JSON.stringify({ error: "Method not allowed" }));
    return;
  }

  try {
    const summary = await updateFinalScores();
    const resultsFile = parseJsonContent(await readFile(defaultResultsPath, "utf8"));
    response.statusCode = 200;
    response.setHeader("content-type", "application/json");
    response.end(JSON.stringify({ ok: true, summary, resultsFile }));
  } catch (error) {
    response.statusCode = 500;
    response.setHeader("content-type", "application/json");
    response.end(
      JSON.stringify({
        ok: false,
        error: error instanceof Error ? error.message : String(error)
      })
    );
  }
}
