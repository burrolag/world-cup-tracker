import { saveBoardToGitHub, validateTournamentState } from "../../scripts/github-board-save.mjs";

async function readJsonBody(request) {
  if (typeof request.body === "string") {
    return JSON.parse(request.body.replace(/^\uFEFF/, ""));
  }

  if (request.body && typeof request.body === "object" && !(Symbol.asyncIterator in request.body)) {
    return request.body;
  }

  const chunks = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  if (chunks.length === 0) {
    return {};
  }

  return JSON.parse(Buffer.concat(chunks).toString("utf8").replace(/^\uFEFF/, ""));
}

export default async function handler(request, response) {
  if (request.method && request.method !== "POST") {
    response.statusCode = 405;
    response.setHeader("content-type", "application/json");
    response.end(JSON.stringify({ error: "Method not allowed" }));
    return;
  }

  try {
    const body = await readJsonBody(request);
    const state = validateTournamentState(body.state);
    const result = await saveBoardToGitHub(state);

    response.statusCode = 200;
    response.setHeader("content-type", "application/json");
    response.end(JSON.stringify({ ok: true, ...result }));
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
