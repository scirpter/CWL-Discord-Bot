import { and, eq } from "drizzle-orm";
import { ulid } from "ulid";

import type { ScoringWeights } from "@/domain/models/scoring.js";
import { DEFAULT_SCORING_WEIGHTS } from "@/domain/models/scoring.js";
import { DEFAULT_SIGNUP_QUESTIONS } from "@/domain/models/signup-question.js";
import type {
  GuildClan,
  GuildSettings,
  GuildSheetConfig,
  ScoringConfig,
  SignupQuestionConfig
} from "@/domain/models/entities.js";
import type { DbClient } from "@/infra/db/client.js";
import {
  guildClans,
  guildScoringWeights,
  guildSettings,
  guildSheetConfig,
  guildSignupQuestions
} from "@/infra/db/schema/tables.js";

function now() {
  return new Date();
}

function toGuildSettings(row: typeof guildSettings.$inferSelect): GuildSettings {
  return {
    id: row.id,
    guildId: row.guildId,
    timezone: row.timezone,
    signupChannelId: row.signupChannelId ?? null,
    activeSeasonId: row.activeSeasonId ?? null,
    signupLocked: row.signupLocked,
    syncIntervalHours: row.syncIntervalHours,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}

function toGuildClan(row: typeof guildClans.$inferSelect): GuildClan {
  return {
    id: row.id,
    guildId: row.guildId,
    clanTag: row.clanTag,
    alias: row.alias,
    createdAt: row.createdAt
  };
}

function toSheetConfig(row: typeof guildSheetConfig.$inferSelect): GuildSheetConfig {
  return {
    id: row.id,
    guildId: row.guildId,
    spreadsheetId: row.spreadsheetId,
    coverSheetName: row.coverSheetName,
    updatedAt: row.updatedAt
  };
}

function toScoringConfig(row: typeof guildScoringWeights.$inferSelect): ScoringConfig {
  return {
    id: row.id,
    guildId: row.guildId,
    weights: {
      thWeight: Number(row.thWeight),
      heroWeight: Number(row.heroWeight),
      warWeight: Number(row.warWeight),
      cwlWeight: Number(row.cwlWeight),
      missedPenalty: Number(row.missedPenalty),
      competitiveBonus: Number(row.competitiveBonus),
      availabilityBonus: Number(row.availabilityBonus)
    },
    updatedAt: row.updatedAt
  };
}

function toQuestionConfig(row: typeof guildSignupQuestions.$inferSelect): SignupQuestionConfig {
  return {
    id: row.id,
    guildId: row.guildId,
    index: row.questionIndex,
    prompt: row.prompt,
    options: JSON.parse(row.optionsJson) as string[],
    isActive: row.isActive,
    updatedAt: row.updatedAt
  };
}

export class GuildConfigRepository {
  public constructor(private readonly db: DbClient["db"]) {}

  public async ensureGuild(guildId: string): Promise<GuildSettings> {
    const existing = await this.db.query.guildSettings.findFirst({
      where: eq(guildSettings.guildId, guildId)
    });

    if (existing) {
      return toGuildSettings(existing);
    }

    const timestamp = now();
    const inserted = {
      id: ulid(),
      guildId,
      timezone: "UTC",
      signupChannelId: null,
      activeSeasonId: null,
      signupLocked: false,
      syncIntervalHours: 6,
      createdAt: timestamp,
      updatedAt: timestamp
    };

    await this.db.insert(guildSettings).values(inserted);

    const weights = DEFAULT_SCORING_WEIGHTS;
    await this.db.insert(guildScoringWeights).values({
      id: ulid(),
      guildId,
      thWeight: weights.thWeight.toFixed(3),
      heroWeight: weights.heroWeight.toFixed(3),
      warWeight: weights.warWeight.toFixed(3),
      cwlWeight: weights.cwlWeight.toFixed(3),
      missedPenalty: weights.missedPenalty.toFixed(3),
      competitiveBonus: weights.competitiveBonus.toFixed(3),
      availabilityBonus: weights.availabilityBonus.toFixed(3),
      updatedAt: timestamp
    });

    await this.db.insert(guildSignupQuestions).values(
      DEFAULT_SIGNUP_QUESTIONS.map((question) => ({
        id: ulid(),
        guildId,
        questionIndex: question.index,
        prompt: question.prompt,
        optionsJson: JSON.stringify(question.options),
        isActive: true,
        updatedAt: timestamp
      }))
    );

    return inserted;
  }

  public async getGuild(guildId: string): Promise<GuildSettings | null> {
    const row = await this.db.query.guildSettings.findFirst({
      where: eq(guildSettings.guildId, guildId)
    });

    return row ? toGuildSettings(row) : null;
  }

  public async listGuilds(): Promise<GuildSettings[]> {
    const rows = await this.db.query.guildSettings.findMany();
    return rows.map(toGuildSettings);
  }

  public async updateGuildSettings(
    guildId: string,
    patch: Partial<
      Pick<
        GuildSettings,
        "timezone" | "signupChannelId" | "syncIntervalHours" | "activeSeasonId" | "signupLocked"
      >
    >
  ): Promise<GuildSettings> {
    await this.ensureGuild(guildId);

    const timestamp = now();
    await this.db
      .update(guildSettings)
      .set({
        timezone: patch.timezone,
        signupChannelId: patch.signupChannelId,
        syncIntervalHours: patch.syncIntervalHours,
        activeSeasonId: patch.activeSeasonId,
        signupLocked: patch.signupLocked,
        updatedAt: timestamp
      })
      .where(eq(guildSettings.guildId, guildId));

    const row = await this.db.query.guildSettings.findFirst({
      where: eq(guildSettings.guildId, guildId)
    });

    if (!row) {
      throw new Error("Guild settings missing after update.");
    }

    return toGuildSettings(row);
  }

  public async listGuildClans(guildId: string): Promise<GuildClan[]> {
    const rows = await this.db.query.guildClans.findMany({
      where: eq(guildClans.guildId, guildId)
    });

    return rows.map(toGuildClan);
  }

  public async addGuildClan(guildId: string, clanTag: string, alias: string): Promise<GuildClan> {
    await this.ensureGuild(guildId);

    const existing = await this.db.query.guildClans.findFirst({
      where: and(eq(guildClans.guildId, guildId), eq(guildClans.clanTag, clanTag))
    });

    if (existing) {
      return toGuildClan(existing);
    }

    const row: typeof guildClans.$inferInsert = {
      id: ulid(),
      guildId,
      clanTag,
      alias,
      createdAt: now()
    };

    await this.db.insert(guildClans).values(row);
    return row;
  }

  public async removeGuildClan(guildId: string, clanTag: string): Promise<boolean> {
    const deleted = await this.db
      .delete(guildClans)
      .where(and(eq(guildClans.guildId, guildId), eq(guildClans.clanTag, clanTag)));

    return deleted[0].affectedRows > 0;
  }

  public async setGuildSheetConfig(guildId: string, spreadsheetId: string): Promise<GuildSheetConfig> {
    await this.ensureGuild(guildId);

    const timestamp = now();
    const existing = await this.db.query.guildSheetConfig.findFirst({
      where: eq(guildSheetConfig.guildId, guildId)
    });

    if (existing) {
      await this.db
        .update(guildSheetConfig)
        .set({
          spreadsheetId,
          updatedAt: timestamp
        })
        .where(eq(guildSheetConfig.guildId, guildId));
    } else {
      await this.db.insert(guildSheetConfig).values({
        id: ulid(),
        guildId,
        spreadsheetId,
        coverSheetName: "COVER SHEET",
        updatedAt: timestamp
      });
    }

    const row = await this.db.query.guildSheetConfig.findFirst({
      where: eq(guildSheetConfig.guildId, guildId)
    });

    if (!row) {
      throw new Error("Sheet config missing after update.");
    }

    return toSheetConfig(row);
  }

  public async getGuildSheetConfig(guildId: string): Promise<GuildSheetConfig | null> {
    const row = await this.db.query.guildSheetConfig.findFirst({
      where: eq(guildSheetConfig.guildId, guildId)
    });

    return row ? toSheetConfig(row) : null;
  }

  public async getScoringConfig(guildId: string): Promise<ScoringConfig> {
    await this.ensureGuild(guildId);

    const row = await this.db.query.guildScoringWeights.findFirst({
      where: eq(guildScoringWeights.guildId, guildId)
    });

    if (!row) {
      throw new Error("Scoring config not found.");
    }

    return toScoringConfig(row);
  }

  public async setScoringConfig(guildId: string, weights: ScoringWeights): Promise<ScoringConfig> {
    await this.ensureGuild(guildId);

    const timestamp = now();
    const existing = await this.db.query.guildScoringWeights.findFirst({
      where: eq(guildScoringWeights.guildId, guildId)
    });

    const payload = {
      thWeight: weights.thWeight.toFixed(3),
      heroWeight: weights.heroWeight.toFixed(3),
      warWeight: weights.warWeight.toFixed(3),
      cwlWeight: weights.cwlWeight.toFixed(3),
      missedPenalty: weights.missedPenalty.toFixed(3),
      competitiveBonus: weights.competitiveBonus.toFixed(3),
      availabilityBonus: weights.availabilityBonus.toFixed(3),
      updatedAt: timestamp
    };

    if (existing) {
      await this.db
        .update(guildScoringWeights)
        .set(payload)
        .where(eq(guildScoringWeights.guildId, guildId));
    } else {
      await this.db.insert(guildScoringWeights).values({
        id: ulid(),
        guildId,
        ...payload
      });
    }

    const row = await this.db.query.guildScoringWeights.findFirst({
      where: eq(guildScoringWeights.guildId, guildId)
    });

    if (!row) {
      throw new Error("Scoring config not found after update.");
    }

    return toScoringConfig(row);
  }

  public async listSignupQuestions(guildId: string): Promise<SignupQuestionConfig[]> {
    await this.ensureGuild(guildId);

    const rows = await this.db.query.guildSignupQuestions.findMany({
      where: and(eq(guildSignupQuestions.guildId, guildId), eq(guildSignupQuestions.isActive, true))
    });

    return rows.map(toQuestionConfig).sort((left, right) => left.index - right.index);
  }

  public async setSignupQuestion(
    guildId: string,
    index: number,
    prompt: string,
    options: string[]
  ): Promise<SignupQuestionConfig> {
    await this.ensureGuild(guildId);

    const timestamp = now();
    const existing = await this.db.query.guildSignupQuestions.findFirst({
      where: and(
        eq(guildSignupQuestions.guildId, guildId),
        eq(guildSignupQuestions.questionIndex, index)
      )
    });

    if (existing) {
      await this.db
        .update(guildSignupQuestions)
        .set({
          prompt,
          optionsJson: JSON.stringify(options),
          isActive: true,
          updatedAt: timestamp
        })
        .where(eq(guildSignupQuestions.id, existing.id));
    } else {
      await this.db.insert(guildSignupQuestions).values({
        id: ulid(),
        guildId,
        questionIndex: index,
        prompt,
        optionsJson: JSON.stringify(options),
        isActive: true,
        updatedAt: timestamp
      });
    }

    const row = await this.db.query.guildSignupQuestions.findFirst({
      where: and(
        eq(guildSignupQuestions.guildId, guildId),
        eq(guildSignupQuestions.questionIndex, index)
      )
    });

    if (!row) {
      throw new Error("Signup question not found after update.");
    }

    return toQuestionConfig(row);
  }

  public async resetSignupQuestions(guildId: string): Promise<SignupQuestionConfig[]> {
    await this.ensureGuild(guildId);

    const timestamp = now();
    await this.db.delete(guildSignupQuestions).where(eq(guildSignupQuestions.guildId, guildId));
    await this.db.insert(guildSignupQuestions).values(
      DEFAULT_SIGNUP_QUESTIONS.map((question) => ({
        id: ulid(),
        guildId,
        questionIndex: question.index,
        prompt: question.prompt,
        optionsJson: JSON.stringify(question.options),
        isActive: true,
        updatedAt: timestamp
      }))
    );

    return this.listSignupQuestions(guildId);
  }
}
