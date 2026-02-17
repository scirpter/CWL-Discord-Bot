import { and, eq } from "drizzle-orm";
import { ulid } from "ulid";

import type { CwlSignup, SignupAnswer } from "@/domain/models/entities.js";
import type { DbClient } from "@/infra/db/client.js";
import { cwlSignupAnswers, cwlSignups } from "@/infra/db/schema/tables.js";

function now() {
  return new Date();
}

type SignupRow = typeof cwlSignups.$inferSelect;

async function loadAnswers(db: DbClient["db"], signupId: string): Promise<SignupAnswer[]> {
  const answerRows = await db.query.cwlSignupAnswers.findMany({
    where: eq(cwlSignupAnswers.signupId, signupId)
  });

  return answerRows
    .map((answer) => ({
      questionIndex: answer.questionIndex,
      answerValue: answer.answerValue
    }))
    .sort((left, right) => left.questionIndex - right.questionIndex);
}

async function toSignup(db: DbClient["db"], row: SignupRow): Promise<CwlSignup> {
  const answers = await loadAnswers(db, row.id);
  return {
    id: row.id,
    guildId: row.guildId,
    seasonId: row.seasonId,
    discordUserId: row.discordUserId,
    playerTag: row.playerTag,
    note: row.note ?? null,
    status: row.status,
    submittedAt: row.submittedAt,
    updatedAt: row.updatedAt,
    answers
  };
}

export class SignupRepository {
  public constructor(private readonly db: DbClient["db"]) {}

  public async getByUser(
    guildId: string,
    seasonId: string,
    discordUserId: string
  ): Promise<CwlSignup | null> {
    const row = await this.db.query.cwlSignups.findFirst({
      where: and(
        eq(cwlSignups.guildId, guildId),
        eq(cwlSignups.seasonId, seasonId),
        eq(cwlSignups.discordUserId, discordUserId)
      )
    });

    if (!row) {
      return null;
    }

    return toSignup(this.db, row);
  }

  public async listBySeason(guildId: string, seasonId: string): Promise<CwlSignup[]> {
    const rows = await this.db.query.cwlSignups.findMany({
      where: and(eq(cwlSignups.guildId, guildId), eq(cwlSignups.seasonId, seasonId))
    });

    const signups = await Promise.all(rows.map((row) => toSignup(this.db, row)));
    return signups;
  }

  public async upsertSignup(params: {
    guildId: string;
    seasonId: string;
    discordUserId: string;
    playerTag: string;
    note: string | null;
    answers: SignupAnswer[];
  }): Promise<CwlSignup> {
    const timestamp = now();

    const resultSignup = await this.db.transaction(async (tx) => {
      const existing = await tx.query.cwlSignups.findFirst({
        where: and(
          eq(cwlSignups.guildId, params.guildId),
          eq(cwlSignups.seasonId, params.seasonId),
          eq(cwlSignups.discordUserId, params.discordUserId)
        )
      });

      let signupId: string;

      if (existing) {
        signupId = existing.id;
        await tx
          .update(cwlSignups)
          .set({
            playerTag: params.playerTag,
            note: params.note,
            status: "active",
            updatedAt: timestamp
          })
          .where(eq(cwlSignups.id, signupId));
      } else {
        signupId = ulid();
        await tx.insert(cwlSignups).values({
          id: signupId,
          guildId: params.guildId,
          seasonId: params.seasonId,
          discordUserId: params.discordUserId,
          playerTag: params.playerTag,
          note: params.note,
          status: "active",
          submittedAt: timestamp,
          updatedAt: timestamp
        });
      }

      await tx.delete(cwlSignupAnswers).where(eq(cwlSignupAnswers.signupId, signupId));
      if (params.answers.length > 0) {
        await tx.insert(cwlSignupAnswers).values(
          params.answers.map((answer) => ({
            id: ulid(),
            signupId,
            questionIndex: answer.questionIndex,
            answerValue: answer.answerValue,
            updatedAt: timestamp
          }))
        );
      }

      return signupId;
    });

    const row = await this.db.query.cwlSignups.findFirst({
      where: eq(cwlSignups.id, resultSignup)
    });

    if (!row) {
      throw new Error("Signup not found after upsert.");
    }

    return toSignup(this.db, row);
  }
}
