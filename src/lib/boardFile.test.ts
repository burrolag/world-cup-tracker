import { describe, expect, it } from "vitest";
import { seedState } from "../data/seed";
import { parseBoardFile, serializeBoardFile } from "./boardFile";

describe("board file helpers", () => {
  it("round-trips tracker state through JSON", () => {
    const parsed = parseBoardFile(serializeBoardFile(seedState));

    expect(parsed.teams.length).toBeGreaterThan(0);
    expect(parsed.matches.length).toBeGreaterThan(0);
    expect(parsed.participants.length).toBeGreaterThan(0);
  });

  it("rejects JSON that is not a tracker board", () => {
    expect(() => parseBoardFile(JSON.stringify({ hello: "world" }))).toThrow(
      "This JSON file is not a World Cup tracker board file."
    );
  });
});
