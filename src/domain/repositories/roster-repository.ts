import { and, eq } from "drizzle-orm";
import { ulid } from "ulid";

import type { CwlRoster, CwlRosterMember } from "@/domain/models/entities.js";
import type { DbClient } from "@/infra/db/client.js";
import { cwlRosterMembers, cwlRosters } from "@/infra/db/schema/tables.js";

function now() {
  return new Date();
}

function toRoster(row: typeof cwlRosters.$inferSelect): CwlRoster {
  return {
    id: row.id,
    guildId: row.guildId,
    seasonId: row.seasonId,
    clanTag: row.clanTag,
    rosterName: row.rosterName,
    rosterSize: row.rosterSize,
    rosterOrder: row.rosterOrder,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}

function toRosterMember(row: typeof cwlRosterMembers.$inferSelect): CwlRosterMember {
  return {
    id: row.id,
    guildId: row.guildId,
    seasonId: row.seasonId,
    rosterId: row.rosterId,
    playerTag: row.playerTag,
    discordUserId: row.discordUserId ?? null,
    assignedByUserId: row.assignedByUserId,
    assignedAt: row.assignedAt,
    updatedAt: row.updatedAt
  };
}

export class RosterRepository {
  public constructor(private readonly db: DbClient["db"]) {}

  public async createRoster(params: {
    guildId: string;
    seasonId: string;
    clanTag: string;
    rosterName: string;
    rosterSize: number;
  }): Promise<CwlRoster> {
    const timestamp = now();
    const row: typeof cwlRosters.$inferInsert = {
      id: ulid(),
      guildId: params.guildId,
      seasonId: params.seasonId,
      clanTag: params.clanTag,
      rosterName: params.rosterName,
      rosterSize: params.rosterSize,
      rosterOrder: 0,
      createdAt: timestamp,
      updatedAt: timestamp
    };

    await this.db.insert(cwlRosters).values(row);
    return {
      ...row,
      rosterOrder: row.rosterOrder ?? 0
    };
  }

  public async listRosters(guildId: string, seasonId: string): Promise<CwlRoster[]> {
    const rows = await this.db.query.cwlRosters.findMany({
      where: and(eq(cwlRosters.guildId, guildId), eq(cwlRosters.seasonId, seasonId))
    });

    return rows.map(toRoster);
  }

  public async getRosterByName(
    guildId: string,
    seasonId: string,
    rosterName: string
  ): Promise<CwlRoster | null> {
    const row = await this.db.query.cwlRosters.findFirst({
      where: and(
        eq(cwlRosters.guildId, guildId),
        eq(cwlRosters.seasonId, seasonId),
        eq(cwlRosters.rosterName, rosterName)
      )
    });

    return row ? toRoster(row) : null;
  }

  public async assignMember(params: {
    guildId: string;
    seasonId: string;
    rosterId: string;
    playerTag: string;
    discordUserId: string | null;
    assignedByUserId: string;
  }): Promise<CwlRosterMember> {
    const timestamp = now();
    const existing = await this.db.query.cwlRosterMembers.findFirst({
      where: and(
        eq(cwlRosterMembers.rosterId, params.rosterId),
        eq(cwlRosterMembers.playerTag, params.playerTag)
      )
    });

    if (existing) {
      await this.db
        .update(cwlRosterMembers)
        .set({
          discordUserId: params.discordUserId,
          assignedByUserId: params.assignedByUserId,
          assignedAt: timestamp,
          updatedAt: timestamp
        })
        .where(eq(cwlRosterMembers.id, existing.id));

      return {
        ...toRosterMember(existing),
        discordUserId: params.discordUserId,
        assignedByUserId: params.assignedByUserId,
        assignedAt: timestamp,
        updatedAt: timestamp
      };
    }

    const row: typeof cwlRosterMembers.$inferInsert = {
      id: ulid(),
      guildId: params.guildId,
      seasonId: params.seasonId,
      rosterId: params.rosterId,
      playerTag: params.playerTag,
      discordUserId: params.discordUserId,
      assignedByUserId: params.assignedByUserId,
      assignedAt: timestamp,
      updatedAt: timestamp
    };

    await this.db.insert(cwlRosterMembers).values(row);
    return {
      ...row,
      discordUserId: row.discordUserId ?? null
    };
  }

  public async unassignMember(rosterId: string, playerTag: string): Promise<boolean> {
    const deleted = await this.db
      .delete(cwlRosterMembers)
      .where(and(eq(cwlRosterMembers.rosterId, rosterId), eq(cwlRosterMembers.playerTag, playerTag)));

    return deleted[0].affectedRows > 0;
  }

  public async listMembersByRoster(rosterId: string): Promise<CwlRosterMember[]> {
    const rows = await this.db.query.cwlRosterMembers.findMany({
      where: eq(cwlRosterMembers.rosterId, rosterId)
    });

    return rows.map(toRosterMember);
  }

  public async listMembersBySeason(guildId: string, seasonId: string): Promise<CwlRosterMember[]> {
    const rows = await this.db.query.cwlRosterMembers.findMany({
      where: and(eq(cwlRosterMembers.guildId, guildId), eq(cwlRosterMembers.seasonId, seasonId))
    });

    return rows.map(toRosterMember);
  }
}
