import { and, desc, eq } from "drizzle-orm";
import { ulid } from "ulid";

import type { CwlSeason } from "@/domain/models/entities.js";
import type { DbClient } from "@/infra/db/client.js";
import { cwlSeasons } from "@/infra/db/schema/tables.js";

function now() {
  return new Date();
}

function toSeason(row: typeof cwlSeasons.$inferSelect): CwlSeason {
  return {
    id: row.id,
    guildId: row.guildId,
    seasonKey: row.seasonKey,
    displayName: row.displayName,
    status: row.status,
    signupLocked: row.signupLocked,
    startedAt: row.startedAt,
    lockedAt: row.lockedAt ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}

export class SeasonRepository {
  public constructor(private readonly db: DbClient["db"]) {}

  public async getById(id: string): Promise<CwlSeason | null> {
    const row = await this.db.query.cwlSeasons.findFirst({
      where: eq(cwlSeasons.id, id)
    });

    return row ? toSeason(row) : null;
  }

  public async getByKey(guildId: string, seasonKey: string): Promise<CwlSeason | null> {
    const row = await this.db.query.cwlSeasons.findFirst({
      where: and(eq(cwlSeasons.guildId, guildId), eq(cwlSeasons.seasonKey, seasonKey))
    });

    return row ? toSeason(row) : null;
  }

  public async getLatestByGuild(guildId: string): Promise<CwlSeason | null> {
    const row = await this.db.query.cwlSeasons.findFirst({
      where: eq(cwlSeasons.guildId, guildId),
      orderBy: [desc(cwlSeasons.seasonKey)]
    });

    return row ? toSeason(row) : null;
  }

  public async getOrCreate(
    guildId: string,
    seasonKey: string,
    displayName: string,
    startedAt: Date
  ): Promise<CwlSeason> {
    const existing = await this.getByKey(guildId, seasonKey);
    if (existing) {
      return existing;
    }

    const timestamp = now();
    const insertRow: typeof cwlSeasons.$inferInsert = {
      id: ulid(),
      guildId,
      seasonKey,
      displayName,
      status: "open",
      signupLocked: false,
      startedAt,
      lockedAt: null,
      createdAt: timestamp,
      updatedAt: timestamp
    };

    await this.db.insert(cwlSeasons).values(insertRow);
    return {
      ...insertRow,
      status: insertRow.status ?? "open",
      signupLocked: insertRow.signupLocked ?? false,
      lockedAt: null
    };
  }

  public async setSignupLocked(seasonId: string, locked: boolean): Promise<CwlSeason> {
    const timestamp = now();

    await this.db
      .update(cwlSeasons)
      .set({
        signupLocked: locked,
        lockedAt: locked ? timestamp : null,
        status: locked ? "locked" : "open",
        updatedAt: timestamp
      })
      .where(eq(cwlSeasons.id, seasonId));

    const season = await this.getById(seasonId);
    if (!season) {
      throw new Error("Season not found after lock update.");
    }

    return season;
  }
}
