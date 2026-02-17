import { describe, expect, it } from "vitest";

import type { PlayerSnapshot, WarAttackEvent } from "@/domain/models/entities.js";
import { DEFAULT_SCORING_WEIGHTS } from "@/domain/models/scoring.js";
import { computeStatsForPlayers } from "@/services/metrics-service.js";

describe("computeStatsForPlayers", () => {
  it("computes war/cwl metrics and score", () => {
    const snapshots = new Map<string, PlayerSnapshot>();
    snapshots.set("#ABC123", {
      id: "01",
      guildId: "1",
      seasonId: "season",
      playerTag: "#ABC123",
      playerName: "Alpha",
      clanTag: "#CLAN1",
      townHall: 18,
      heroesCombined: 430,
      warStarsTotal: 2000,
      attackWins: 1000,
      defenseWins: 200,
      trophies: 5600,
      donations: 500,
      donationsReceived: 350,
      capturedAt: new Date("2026-02-01T00:00:00.000Z")
    });

    const eventsByTag = new Map<string, WarAttackEvent[]>();
    eventsByTag.set("#ABC123", [
      {
        id: "war-1",
        guildId: "1",
        seasonId: "season",
        warType: "war",
        warId: "war-1",
        warDay: new Date("2026-02-02T00:00:00.000Z"),
        playerTag: "#ABC123",
        attacksUsed: 2,
        attacksAllowed: 2,
        stars: 5,
        destruction: 185,
        triples: 1,
        twos: 1,
        ones: 0,
        zeroes: 0,
        missed: false,
        defenseStars: 3,
        defenseDestruction: 95,
        capturedAt: new Date("2026-02-02T01:00:00.000Z")
      },
      {
        id: "cwl-1",
        guildId: "1",
        seasonId: "season",
        warType: "cwl",
        warId: "cwl-1",
        warDay: new Date("2026-02-03T00:00:00.000Z"),
        playerTag: "#ABC123",
        attacksUsed: 1,
        attacksAllowed: 1,
        stars: 3,
        destruction: 100,
        triples: 1,
        twos: 0,
        ones: 0,
        zeroes: 0,
        missed: false,
        defenseStars: 2,
        defenseDestruction: 88,
        capturedAt: new Date("2026-02-03T01:00:00.000Z")
      }
    ]);

    const answersByTag = new Map<string, Map<number, string>>();
    answersByTag.set(
      "#ABC123",
      new Map([
        [1, "Yes all wars"],
        [2, "Competitive"]
      ])
    );

    const result = computeStatsForPlayers({
      snapshotsByTag: snapshots,
      eventsByTag,
      answersByTag,
      weights: DEFAULT_SCORING_WEIGHTS
    });

    const stats = result.get("#ABC123");
    expect(stats).toBeDefined();
    expect(stats?.totalAttacks).toBe(3);
    expect(stats?.warHitrate).toBe(0.83);
    expect(stats?.cwlHitrate).toBe(1);
    expect(stats?.stars).toBe(8);
    expect(stats?.missed).toBe(0);
    expect(stats?.rosterScore).toBeGreaterThan(0.8);
  });
});
