import { and, desc, eq, gte, inArray } from "drizzle-orm";
import { ulid } from "ulid";

import type { PlayerSnapshot, WarAttackEvent } from "@/domain/models/entities.js";
import type { DbClient } from "@/infra/db/client.js";
import { cocPlayerSnapshots, cocWarAttackEvents } from "@/infra/db/schema/tables.js";

function now() {
  return new Date();
}

function toSnapshot(row: typeof cocPlayerSnapshots.$inferSelect): PlayerSnapshot {
  return {
    id: row.id,
    guildId: row.guildId,
    seasonId: row.seasonId ?? null,
    playerTag: row.playerTag,
    playerName: row.playerName,
    clanTag: row.clanTag ?? null,
    townHall: row.townHall,
    heroesCombined: row.heroesCombined,
    warStarsTotal: row.warStarsTotal,
    attackWins: row.attackWins,
    defenseWins: row.defenseWins,
    trophies: row.trophies,
    donations: row.donations,
    donationsReceived: row.donationsReceived,
    capturedAt: row.capturedAt
  };
}

function toWarEvent(row: typeof cocWarAttackEvents.$inferSelect): WarAttackEvent {
  return {
    id: row.id,
    guildId: row.guildId,
    seasonId: row.seasonId ?? null,
    warType: row.warType,
    warId: row.warId,
    warDay: row.warDay,
    playerTag: row.playerTag,
    attacksUsed: row.attacksUsed,
    attacksAllowed: row.attacksAllowed,
    stars: row.stars,
    destruction: Number(row.destruction),
    triples: row.triples,
    twos: row.twos,
    ones: row.ones,
    zeroes: row.zeroes,
    missed: row.missed,
    defenseStars: row.defenseStars,
    defenseDestruction: Number(row.defenseDestruction),
    capturedAt: row.capturedAt
  };
}

export class StatsRepository {
  public constructor(private readonly db: DbClient["db"]) {}

  public async insertSnapshot(snapshot: Omit<PlayerSnapshot, "id">): Promise<PlayerSnapshot> {
    const row: typeof cocPlayerSnapshots.$inferInsert = {
      id: ulid(),
      ...snapshot
    };

    await this.db.insert(cocPlayerSnapshots).values(row);
    return {
      ...row,
      seasonId: row.seasonId ?? null,
      clanTag: row.clanTag ?? null
    };
  }

  public async latestSnapshotsForPlayers(
    guildId: string,
    playerTags: string[]
  ): Promise<Map<string, PlayerSnapshot>> {
    if (playerTags.length === 0) {
      return new Map();
    }

    const rows = await this.db.query.cocPlayerSnapshots.findMany({
      where: and(
        eq(cocPlayerSnapshots.guildId, guildId),
        inArray(cocPlayerSnapshots.playerTag, playerTags)
      ),
      orderBy: [desc(cocPlayerSnapshots.capturedAt)]
    });

    const byTag = new Map<string, PlayerSnapshot>();
    for (const row of rows) {
      if (!byTag.has(row.playerTag)) {
        byTag.set(row.playerTag, toSnapshot(row));
      }
    }

    return byTag;
  }

  public async replaceWarEventsForWar(params: {
    guildId: string;
    warId: string;
    seasonId: string | null;
    warType: string;
    warDay: Date;
    events: Array<
      Omit<
        WarAttackEvent,
        "id" | "guildId" | "seasonId" | "warType" | "warId" | "warDay" | "capturedAt"
      >
    >;
  }): Promise<void> {
    await this.db
      .delete(cocWarAttackEvents)
      .where(and(eq(cocWarAttackEvents.guildId, params.guildId), eq(cocWarAttackEvents.warId, params.warId)));

    if (params.events.length === 0) {
      return;
    }

    const capturedAt = now();
    await this.db.insert(cocWarAttackEvents).values(
      params.events.map((event) => ({
        id: ulid(),
        guildId: params.guildId,
        seasonId: params.seasonId,
        warType: params.warType,
        warId: params.warId,
        warDay: params.warDay,
        playerTag: event.playerTag,
        attacksUsed: event.attacksUsed,
        attacksAllowed: event.attacksAllowed,
        stars: event.stars,
        destruction: event.destruction.toFixed(2),
        triples: event.triples,
        twos: event.twos,
        ones: event.ones,
        zeroes: event.zeroes,
        missed: event.missed,
        defenseStars: event.defenseStars,
        defenseDestruction: event.defenseDestruction.toFixed(2),
        capturedAt
      }))
    );
  }

  public async listEventsInWindow(
    guildId: string,
    playerTags: string[],
    since: Date
  ): Promise<WarAttackEvent[]> {
    if (playerTags.length === 0) {
      return [];
    }

    const rows = await this.db.query.cocWarAttackEvents.findMany({
      where: and(
        eq(cocWarAttackEvents.guildId, guildId),
        inArray(cocWarAttackEvents.playerTag, playerTags),
        gte(cocWarAttackEvents.warDay, since)
      )
    });

    return rows.map(toWarEvent);
  }
}
