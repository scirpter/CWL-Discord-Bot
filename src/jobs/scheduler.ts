import type { Logger } from "@/infra/logger.js";
import type { CwlBotService } from "@/services/cwl-bot-service.js";

type SchedulerOptions = {
  cwlBotService: CwlBotService;
  logger: Logger;
};

export class Scheduler {
  private readonly cwlBotService: CwlBotService;
  private readonly logger: Logger;
  private readonly lastSyncByGuild = new Map<string, number>();
  private readonly runningGuilds = new Set<string>();
  private timer: NodeJS.Timeout | null = null;

  public constructor(options: SchedulerOptions) {
    this.cwlBotService = options.cwlBotService;
    this.logger = options.logger;
  }

  public start() {
    if (this.timer) {
      return;
    }

    this.timer = setInterval(() => {
      void this.tick();
    }, 5 * 60 * 1000);

    void this.tick();
  }

  public stop() {
    if (!this.timer) {
      return;
    }

    clearInterval(this.timer);
    this.timer = null;
  }

  private async tick() {
    const guilds = await this.cwlBotService.listGuildsForScheduler().unwrapOr([]);

    for (const guild of guilds) {
      if (this.runningGuilds.has(guild.guildId)) {
        continue;
      }

      const now = Date.now();
      const lastSync = this.lastSyncByGuild.get(guild.guildId) ?? 0;
      const intervalMs = Math.max(1, guild.syncIntervalHours) * 60 * 60 * 1000;
      const due = now - lastSync >= intervalMs;

      this.runningGuilds.add(guild.guildId);
      try {
        await this.cwlBotService.ensureSeasonForCurrentMonth(guild.guildId).unwrapOr(
          Promise.reject(new Error("Failed season rollover."))
        );

        if (due) {
          await this.cwlBotService.runSyncNow(guild.guildId).unwrapOr(
            Promise.reject(new Error("Scheduled sync failed."))
          );
          this.lastSyncByGuild.set(guild.guildId, now);
        }
      } catch (error) {
        this.logger.warn({ err: error, guildId: guild.guildId }, "Scheduler tick failed for guild.");
      } finally {
        this.runningGuilds.delete(guild.guildId);
      }
    }
  }
}
