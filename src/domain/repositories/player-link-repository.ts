import { and, eq } from "drizzle-orm";
import { ulid } from "ulid";

import type { PlayerLink } from "@/domain/models/entities.js";
import type { DbClient } from "@/infra/db/client.js";
import { discordPlayers } from "@/infra/db/schema/tables.js";

function now() {
  return new Date();
}

function toPlayerLink(row: typeof discordPlayers.$inferSelect): PlayerLink {
  return {
    id: row.id,
    guildId: row.guildId,
    discordUserId: row.discordUserId,
    playerTag: row.playerTag,
    playerName: row.playerName ?? null,
    linkedAt: row.linkedAt,
    updatedAt: row.updatedAt
  };
}

export class PlayerLinkRepository {
  public constructor(private readonly db: DbClient["db"]) {}

  public async getByDiscordUser(guildId: string, discordUserId: string): Promise<PlayerLink | null> {
    const row = await this.db.query.discordPlayers.findFirst({
      where: and(eq(discordPlayers.guildId, guildId), eq(discordPlayers.discordUserId, discordUserId))
    });

    return row ? toPlayerLink(row) : null;
  }

  public async getByPlayerTag(guildId: string, playerTag: string): Promise<PlayerLink | null> {
    const row = await this.db.query.discordPlayers.findFirst({
      where: and(eq(discordPlayers.guildId, guildId), eq(discordPlayers.playerTag, playerTag))
    });

    return row ? toPlayerLink(row) : null;
  }

  public async upsertLink(
    guildId: string,
    discordUserId: string,
    playerTag: string,
    playerName?: string
  ): Promise<PlayerLink> {
    const timestamp = now();
    const existing = await this.getByDiscordUser(guildId, discordUserId);

    if (existing) {
      await this.db
        .update(discordPlayers)
        .set({
          playerTag,
          playerName,
          updatedAt: timestamp
        })
        .where(eq(discordPlayers.id, existing.id));

      return {
        ...existing,
        playerTag,
        playerName: playerName ?? null,
        updatedAt: timestamp
      };
    }

    const row: typeof discordPlayers.$inferInsert = {
      id: ulid(),
      guildId,
      discordUserId,
      playerTag,
      playerName,
      linkedAt: timestamp,
      updatedAt: timestamp
    };

    await this.db.insert(discordPlayers).values(row);
    return {
      ...row,
      playerName: row.playerName ?? null
    };
  }

  public async listByGuild(guildId: string): Promise<PlayerLink[]> {
    const rows = await this.db.query.discordPlayers.findMany({
      where: eq(discordPlayers.guildId, guildId)
    });

    return rows.map(toPlayerLink);
  }
}
