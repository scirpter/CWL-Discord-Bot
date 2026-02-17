import { eq } from "drizzle-orm";
import { ulid } from "ulid";

import type { SyncJobRun } from "@/domain/models/entities.js";
import type { DbClient } from "@/infra/db/client.js";
import { syncJobRuns } from "@/infra/db/schema/tables.js";

function toJobRun(row: typeof syncJobRuns.$inferSelect): SyncJobRun {
  return {
    id: row.id,
    guildId: row.guildId,
    seasonId: row.seasonId ?? null,
    jobType: row.jobType,
    status: row.status,
    correlationId: row.correlationId,
    summary: row.summary ?? null,
    startedAt: row.startedAt,
    finishedAt: row.finishedAt ?? null
  };
}

export class SyncJobRepository {
  public constructor(private readonly db: DbClient["db"]) {}

  public async startJob(params: {
    guildId: string;
    seasonId: string | null;
    jobType: string;
    correlationId: string;
  }): Promise<SyncJobRun> {
    const row: typeof syncJobRuns.$inferInsert = {
      id: ulid(),
      guildId: params.guildId,
      seasonId: params.seasonId,
      jobType: params.jobType,
      status: "running",
      correlationId: params.correlationId,
      summary: null,
      startedAt: new Date(),
      finishedAt: null
    };

    await this.db.insert(syncJobRuns).values(row);

    return {
      ...row,
      seasonId: row.seasonId ?? null,
      summary: null,
      finishedAt: null
    };
  }

  public async finishJob(jobId: string, status: "success" | "error", summary: string): Promise<SyncJobRun> {
    const finishedAt = new Date();
    await this.db
      .update(syncJobRuns)
      .set({
        status,
        summary,
        finishedAt
      })
      .where(eq(syncJobRuns.id, jobId));

    const row = await this.db.query.syncJobRuns.findFirst({
      where: eq(syncJobRuns.id, jobId)
    });

    if (!row) {
      throw new Error("Sync job missing after update");
    }

    return toJobRun(row);
  }
}
