import { Client, Events, GatewayIntentBits } from "discord.js";

import { commandModules } from "@/commands/index.js";
import { loadEnv } from "@/config/env.js";
import {
  GuildConfigRepository,
  PlayerLinkRepository,
  RosterRepository,
  SeasonRepository,
  SignupRepository,
  StatsRepository,
  SyncJobRepository
} from "@/domain/repositories/index.js";
import { Scheduler } from "@/jobs/scheduler.js";
import { createDbClient } from "@/infra/db/client.js";
import { registerInteractionRouter } from "@/infra/discord/interaction-router.js";
import { SignupInteractionHandler } from "@/infra/discord/signup-interaction-handler.js";
import { SheetsClient } from "@/infra/google/sheets-client.js";
import { CocClient } from "@/infra/http/coc-client.js";
import { createLogger } from "@/infra/logger.js";
import type { BotRuntime } from "@/infra/discord/runtime.js";
import { CwlBotService } from "@/services/cwl-bot-service.js";
import { SignupFlowService } from "@/services/signup-flow-service.js";

export async function createApplication() {
  const env = loadEnv();
  const logger = createLogger(env);
  const { db, pool } = createDbClient();

  const guildConfigRepo = new GuildConfigRepository(db);
  const playerLinkRepo = new PlayerLinkRepository(db);
  const seasonRepo = new SeasonRepository(db);
  const signupRepo = new SignupRepository(db);
  const rosterRepo = new RosterRepository(db);
  const statsRepo = new StatsRepository(db);
  const syncJobRepo = new SyncJobRepository(db);

  const cocClient = new CocClient({
    token: env.COC_API_TOKEN,
    logger
  });
  const sheetsClient = new SheetsClient({
    serviceAccountJson: env.GOOGLE_SERVICE_ACCOUNT_JSON,
    defaultScopes: env.GOOGLE_SHEETS_DEFAULT_SCOPES.split(",").map((scope) => scope.trim()),
    logger
  });

  const cwlBotService = new CwlBotService({
    guildConfigRepo,
    playerLinkRepo,
    seasonRepo,
    signupRepo,
    rosterRepo,
    statsRepo,
    syncJobRepo,
    cocClient,
    sheetsClient,
    logger,
    defaultTimezone: env.APP_TIMEZONE_FALLBACK
  });

  const signupFlowService = new SignupFlowService(cwlBotService, logger);
  const signupInteractionHandler = new SignupInteractionHandler({
    cwlBotService,
    signupFlowService,
    logger
  });

  const runtime: BotRuntime = {
    logger,
    cwlBotService,
    signupFlowService,
    signupInteractionHandler
  };

  const client = new Client({
    intents: [GatewayIntentBits.Guilds]
  });
  registerInteractionRouter(client, commandModules, runtime);

  const scheduler = new Scheduler({
    cwlBotService,
    logger
  });

  client.once(Events.ClientReady, (readyClient) => {
    logger.info({ user: readyClient.user.tag }, "Discord client ready.");
    scheduler.start();
  });

  async function start() {
    await client.login(env.DISCORD_TOKEN);
  }

  async function stop() {
    scheduler.stop();
    await client.destroy();
    await pool.end();
  }

  return {
    start,
    stop
  };
}
