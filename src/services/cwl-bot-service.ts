import { ResultAsync } from "neverthrow";
import { ulid } from "ulid";

import { AppError, toAppError } from "@/domain/errors.js";
import type {
  CwlRoster,
  CwlSignup,
  GuildClan,
  GuildSettings,
  PlayerLink,
  SignupAnswer
} from "@/domain/models/entities.js";
import { DEFAULT_SCORING_WEIGHTS, type ScoringWeights } from "@/domain/models/scoring.js";
import { NOTE_MAX_LENGTH } from "@/domain/models/signup-question.js";
import type {
  GuildConfigRepository,
  PlayerLinkRepository,
  RosterRepository,
  SeasonRepository,
  SignupRepository,
  StatsRepository,
  SyncJobRepository
} from "@/domain/repositories/index.js";
import type { SheetsClient } from "@/infra/google/sheets-client.js";
import type { CocClient, CocWar } from "@/infra/http/coc-client.js";
import type { Logger } from "@/infra/logger.js";
import { computeStatsForPlayers } from "@/services/metrics-service.js";
import { normalizeClanTag } from "@/utils/clash.js";
import { dateDaysAgo, getSeasonDisplayName, getSeasonKey } from "@/utils/time.js";

type ServiceDeps = {
  guildConfigRepo: GuildConfigRepository;
  playerLinkRepo: PlayerLinkRepository;
  seasonRepo: SeasonRepository;
  signupRepo: SignupRepository;
  rosterRepo: RosterRepository;
  statsRepo: StatsRepository;
  syncJobRepo: SyncJobRepository;
  cocClient: CocClient;
  sheetsClient: SheetsClient;
  logger: Logger;
  defaultTimezone: string;
};

type SignupSubmission = {
  answers: SignupAnswer[];
  note: string | null;
};

type SyncResult = {
  syncedPlayers: number;
  syncedWars: number;
  updatedAt: Date;
};

type SuggestedRosterEntry = {
  discordUserId: string;
  playerTag: string;
  playerName: string;
  townHall: number;
  score: number;
  warHitrate: number | null;
  cwlHitrate: number | null;
  availability: string;
  competitiveness: string;
};

type GuildState = {
  guild: GuildSettings;
  seasonId: string;
  seasonKey: string;
  seasonDisplayName: string;
};

function formatRatio(value: number | null): string {
  return value === null ? "N/A" : value.toFixed(2);
}

function formatMetric(value: number | null): string {
  return value === null ? "N/A" : value.toFixed(2);
}

function chunkArray<T>(items: T[], size: number): T[][] {
  if (size <= 0) {
    return [items];
  }

  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
}

function toResultAsync<T>(promiseFactory: () => Promise<T>, code: string): ResultAsync<T, AppError> {
  return ResultAsync.fromPromise(promiseFactory(), (error) => toAppError(error, code));
}

type WarEventRow = {
  playerTag: string;
  attacksUsed: number;
  attacksAllowed: number;
  stars: number;
  destruction: number;
  triples: number;
  twos: number;
  ones: number;
  zeroes: number;
  missed: boolean;
  defenseStars: number;
  defenseDestruction: number;
};

function pickWarSide(war: CocWar, clanTag: string): CocWar["clan"] | null {
  const normalized = normalizeClanTag(clanTag);
  if (normalizeClanTag(war.clan.tag) === normalized) {
    return war.clan;
  }

  if (normalizeClanTag(war.opponent.tag) === normalized) {
    return war.opponent;
  }

  return null;
}

function extractWarEventsForClan(war: CocWar, clanTag: string, warType: "war" | "cwl"): WarEventRow[] {
  const side = pickWarSide(war, clanTag);
  if (!side) {
    return [];
  }

  const attacksAllowed = warType === "cwl" ? 1 : 2;

  return side.members.map((member) => {
    const attacks = member.attacks ?? [];
    const stars = attacks.reduce((sum, attack) => sum + attack.stars, 0);
    const destruction = attacks.reduce((sum, attack) => sum + attack.destructionPercentage, 0);
    const triples = attacks.filter((attack) => attack.stars === 3).length;
    const twos = attacks.filter((attack) => attack.stars === 2).length;
    const ones = attacks.filter((attack) => attack.stars === 1).length;
    const zeroes = attacks.filter((attack) => attack.stars === 0).length;
    const defenseStars = member.bestOpponentAttack?.stars ?? 0;
    const defenseDestruction = member.bestOpponentAttack?.destructionPercentage ?? 0;

    return {
      playerTag: member.tag,
      attacksUsed: attacks.length,
      attacksAllowed,
      stars,
      destruction,
      triples,
      twos,
      ones,
      zeroes,
      missed: attacks.length === 0,
      defenseStars,
      defenseDestruction
    };
  });
}

export class CwlBotService {
  public constructor(private readonly deps: ServiceDeps) {}

  public ensureGuildSetup(guildId: string): ResultAsync<GuildState, AppError> {
    return toResultAsync(async () => {
      const guild = await this.deps.guildConfigRepo.ensureGuild(guildId);
      const now = new Date();
      const seasonKey = getSeasonKey(now);
      const seasonDisplayName = getSeasonDisplayName(now);
      const season = await this.deps.seasonRepo.getOrCreate(guildId, seasonKey, seasonDisplayName, now);

      if (guild.activeSeasonId !== season.id) {
        await this.deps.guildConfigRepo.updateGuildSettings(guildId, {
          activeSeasonId: season.id
        });
      }

      return {
        guild,
        seasonId: season.id,
        seasonKey: season.seasonKey,
        seasonDisplayName: season.displayName
      };
    }, "GUILD_SETUP_FAILED");
  }

  public registerPlayer(
    guildId: string,
    discordUserId: string,
    rawTag: string
  ): ResultAsync<{ link: PlayerLink; playerName: string }, AppError> {
    return toResultAsync(async () => {
      await this.deps.guildConfigRepo.ensureGuild(guildId);
      const playerTag = normalizeClanTag(rawTag);
      const player = await this.deps.cocClient.getPlayer(playerTag);
      const link = await this.deps.playerLinkRepo.upsertLink(
        guildId,
        discordUserId,
        normalizeClanTag(player.tag),
        player.name
      );

      return {
        link,
        playerName: player.name
      };
    }, "PLAYER_REGISTER_FAILED");
  }

  public getRegisteredPlayer(
    guildId: string,
    discordUserId: string
  ): ResultAsync<PlayerLink | null, AppError> {
    return toResultAsync(
      async () => this.deps.playerLinkRepo.getByDiscordUser(guildId, discordUserId),
      "PLAYER_GET_FAILED"
    );
  }

  public getGuildSettings(guildId: string): ResultAsync<GuildSettings, AppError> {
    return toResultAsync(async () => this.deps.guildConfigRepo.ensureGuild(guildId), "GUILD_GET_FAILED");
  }

  public addClan(guildId: string, clanTag: string, alias: string): ResultAsync<GuildClan, AppError> {
    return toResultAsync(
      async () => this.deps.guildConfigRepo.addGuildClan(guildId, normalizeClanTag(clanTag), alias),
      "CLAN_ADD_FAILED"
    );
  }

  public removeClan(guildId: string, clanTag: string): ResultAsync<boolean, AppError> {
    return toResultAsync(
      async () => this.deps.guildConfigRepo.removeGuildClan(guildId, normalizeClanTag(clanTag)),
      "CLAN_REMOVE_FAILED"
    );
  }

  public async listClans(guildId: string): Promise<GuildClan[]> {
    return this.deps.guildConfigRepo.listGuildClans(guildId);
  }

  public setSheetConnection(guildId: string, spreadsheetId: string): ResultAsync<string, AppError> {
    return toResultAsync(async () => {
      await this.deps.guildConfigRepo.setGuildSheetConfig(guildId, spreadsheetId);
      return spreadsheetId;
    }, "SHEET_CONFIG_FAILED");
  }

  public setSignupChannel(guildId: string, channelId: string): ResultAsync<string, AppError> {
    return toResultAsync(async () => {
      await this.deps.guildConfigRepo.updateGuildSettings(guildId, {
        signupChannelId: channelId
      });
      return channelId;
    }, "CHANNEL_CONFIG_FAILED");
  }

  public setTimezone(guildId: string, timezone: string): ResultAsync<string, AppError> {
    return toResultAsync(async () => {
      await this.deps.guildConfigRepo.updateGuildSettings(guildId, {
        timezone
      });
      return timezone;
    }, "TIMEZONE_CONFIG_FAILED");
  }

  public setSyncSchedule(guildId: string, intervalHours: number): ResultAsync<number, AppError> {
    return toResultAsync(async () => {
      const safeValue = Math.max(1, Math.min(24, Math.floor(intervalHours)));
      await this.deps.guildConfigRepo.updateGuildSettings(guildId, {
        syncIntervalHours: safeValue
      });
      return safeValue;
    }, "SCHEDULE_CONFIG_FAILED");
  }

  public listQuestions(guildId: string) {
    return toResultAsync(
      async () => this.deps.guildConfigRepo.listSignupQuestions(guildId),
      "QUESTION_LIST_FAILED"
    );
  }

  public editQuestion(guildId: string, index: number, prompt: string, optionsCsv: string) {
    return toResultAsync(async () => {
      const options = optionsCsv
        .split(",")
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0);
      if (options.length === 0) {
        throw new AppError("INVALID_OPTIONS", "At least one option is required.");
      }

      return this.deps.guildConfigRepo.setSignupQuestion(guildId, index, prompt, options);
    }, "QUESTION_EDIT_FAILED");
  }

  public resetQuestions(guildId: string) {
    return toResultAsync(
      async () => this.deps.guildConfigRepo.resetSignupQuestions(guildId),
      "QUESTION_RESET_FAILED"
    );
  }

  public setScoring(guildId: string, weights: Partial<ScoringWeights>) {
    return toResultAsync(async () => {
      const current = await this.deps.guildConfigRepo.getScoringConfig(guildId).catch(() => null);
      const merged = {
        ...(current?.weights ?? DEFAULT_SCORING_WEIGHTS),
        ...weights
      };

      return this.deps.guildConfigRepo.setScoringConfig(guildId, merged);
    }, "SCORING_CONFIG_FAILED");
  }

  public initTemplate(guildId: string, seasonKey?: string): ResultAsync<string, AppError> {
    return toResultAsync(async () => {
      const guildState = await this.requireGuildSetup(guildId);

      const sheetConfig = await this.deps.guildConfigRepo.getGuildSheetConfig(guildId);
      if (!sheetConfig) {
        throw new AppError(
          "SHEET_NOT_CONFIGURED",
          "Spreadsheet is not connected yet. Use /config sheet connect first."
        );
      }

      const seasonName =
        seasonKey === undefined
          ? guildState.seasonDisplayName
          : getSeasonDisplayName(new Date(`${seasonKey}-01T00:00:00.000Z`));

      await this.deps.sheetsClient.initTemplate(
        sheetConfig.spreadsheetId,
        sheetConfig.coverSheetName,
        seasonName
      );

      return seasonName;
    }, "TEMPLATE_INIT_FAILED");
  }

  public refreshTemplate(guildId: string, seasonKey?: string): ResultAsync<string, AppError> {
    return this.initTemplate(guildId, seasonKey);
  }

  public openSignups(guildId: string): ResultAsync<string, AppError> {
    return toResultAsync(async () => {
      const guildState = await this.requireGuildSetup(guildId);
      await this.deps.seasonRepo.setSignupLocked(guildState.seasonId, false);
      await this.deps.guildConfigRepo.updateGuildSettings(guildId, {
        signupLocked: false
      });
      return guildState.seasonDisplayName;
    }, "SIGNUP_OPEN_FAILED");
  }

  public lockSignups(guildId: string): ResultAsync<string, AppError> {
    return toResultAsync(async () => {
      const guildState = await this.requireGuildSetup(guildId);
      await this.deps.seasonRepo.setSignupLocked(guildState.seasonId, true);
      await this.deps.guildConfigRepo.updateGuildSettings(guildId, {
        signupLocked: true
      });
      return guildState.seasonDisplayName;
    }, "SIGNUP_LOCK_FAILED");
  }

  public unlockSignups(guildId: string): ResultAsync<string, AppError> {
    return this.openSignups(guildId);
  }

  public signupStatus(guildId: string): ResultAsync<{ season: string; locked: boolean }, AppError> {
    return toResultAsync(async () => {
      const state = await this.requireGuildSetup(guildId);
      const season = await this.deps.seasonRepo.getById(state.seasonId);
      if (!season) {
        throw new AppError("SEASON_NOT_FOUND", "Active season could not be found.");
      }
      return {
        season: season.displayName,
        locked: season.signupLocked
      };
    }, "SIGNUP_STATUS_FAILED");
  }

  public getSignupQuestionsWithDynamicOptions(
    guildId: string
  ): ResultAsync<Array<{ index: number; prompt: string; options: string[] }>, AppError> {
    return toResultAsync(async () => {
      const questions = await this.deps.guildConfigRepo.listSignupQuestions(guildId);
      const clans = await this.deps.guildConfigRepo.listGuildClans(guildId);
      const state = await this.requireGuildSetup(guildId);
      const rosters = await this.deps.rosterRepo.listRosters(guildId, state.seasonId);

      return questions.map((question) => {
        if (question.index !== 5) {
          return question;
        }

        const merged = new Set<string>(question.options);
        for (const clan of clans) {
          merged.add(clan.alias);
        }
        for (const roster of rosters) {
          merged.add(roster.rosterName);
        }

        return {
          index: question.index,
          prompt: question.prompt,
          options: [...merged]
        };
      });
    }, "SIGNUP_QUESTIONS_FAILED");
  }

  public submitSignup(
    guildId: string,
    discordUserId: string,
    submission: SignupSubmission
  ): ResultAsync<CwlSignup, AppError> {
    return toResultAsync(async () => {
      const state = await this.requireGuildSetup(guildId);
      const season = await this.deps.seasonRepo.getById(state.seasonId);
      if (!season) {
        throw new AppError("SEASON_NOT_FOUND", "No active season found.");
      }

      if (season.signupLocked) {
        throw new AppError(
          "SIGNUPS_LOCKED",
          "Signups are currently locked. Ask a leader to unlock signups."
        );
      }

      const playerLink = await this.deps.playerLinkRepo.getByDiscordUser(guildId, discordUserId);
      if (!playerLink) {
        throw new AppError(
          "PLAYER_NOT_LINKED",
          "You need to link your account first with /player register."
        );
      }

      const [player, clans, questions] = await Promise.all([
        this.deps.cocClient.getPlayer(playerLink.playerTag),
        this.deps.guildConfigRepo.listGuildClans(guildId),
        this.requireSignupQuestions(guildId)
      ]);

      const inFamily = clans.some(
        (clan) => normalizeClanTag(clan.clanTag) === normalizeClanTag(player.clan?.tag ?? "")
      );
      if (!inFamily) {
        throw new AppError(
          "PLAYER_NOT_IN_FAMILY",
          "Your linked player must be in one of the configured family clans to sign up."
        );
      }

      const questionByIndex = new Map(questions.map((question) => [question.index, question]));
      for (const answer of submission.answers) {
        const question = questionByIndex.get(answer.questionIndex);
        if (!question) {
          throw new AppError("QUESTION_NOT_FOUND", `Question ${answer.questionIndex} is invalid.`);
        }

        if (!question.options.includes(answer.answerValue)) {
          throw new AppError(
            "INVALID_ANSWER",
            `Answer '${answer.answerValue}' is not allowed for question ${answer.questionIndex}.`
          );
        }
      }

      if (submission.note && submission.note.length > NOTE_MAX_LENGTH) {
        throw new AppError(
          "NOTE_TOO_LONG",
          `Notes must be ${NOTE_MAX_LENGTH} characters or fewer.`
        );
      }

      const saved = await this.deps.signupRepo.upsertSignup({
        guildId,
        seasonId: season.id,
        discordUserId,
        playerTag: playerLink.playerTag,
        note: submission.note,
        answers: submission.answers
      });

      await this.syncForGuild(guildId, {
        jobType: "signup-immediate",
        targetPlayerTags: [playerLink.playerTag]
      }).mapErr((error) => {
        this.deps.logger.warn({ err: error }, "Immediate signup sync failed.");
        return error;
      });

      return saved;
    }, "SIGNUP_SUBMIT_FAILED");
  }

  public createRoster(
    guildId: string,
    clanTag: string,
    rosterName: string,
    rosterSize: number
  ): ResultAsync<CwlRoster, AppError> {
    return toResultAsync(async () => {
      const state = await this.requireGuildSetup(guildId);
      const normalizedClanTag = normalizeClanTag(clanTag);
      const clans = await this.deps.guildConfigRepo.listGuildClans(guildId);
      const clanExists = clans.some(
        (clan) => normalizeClanTag(clan.clanTag) === normalizeClanTag(normalizedClanTag)
      );

      if (!clanExists) {
        throw new AppError(
          "CLAN_NOT_CONFIGURED",
          "Clan tag is not configured for this guild. Add it first with /config clan add."
        );
      }

      return this.deps.rosterRepo.createRoster({
        guildId,
        seasonId: state.seasonId,
        clanTag: normalizedClanTag,
        rosterName,
        rosterSize
      });
    }, "ROSTER_CREATE_FAILED");
  }

  public assignRosterMember(params: {
    guildId: string;
    rosterName: string;
    playerTag: string;
    assignedByUserId: string;
  }): ResultAsync<string, AppError> {
    return toResultAsync(async () => {
      const state = await this.requireGuildSetup(params.guildId);
      const roster = await this.deps.rosterRepo.getRosterByName(
        params.guildId,
        state.seasonId,
        params.rosterName
      );
      if (!roster) {
        throw new AppError("ROSTER_NOT_FOUND", "Roster not found.");
      }

      const normalizedTag = normalizeClanTag(params.playerTag);
      const link = await this.deps.playerLinkRepo.getByPlayerTag(params.guildId, normalizedTag);
      await this.deps.rosterRepo.assignMember({
        guildId: params.guildId,
        seasonId: state.seasonId,
        rosterId: roster.id,
        playerTag: normalizedTag,
        discordUserId: link?.discordUserId ?? null,
        assignedByUserId: params.assignedByUserId
      });

      await this.syncForGuild(params.guildId, {
        jobType: "manual",
        targetPlayerTags: [normalizedTag]
      }).mapErr((error) => {
        this.deps.logger.warn({ err: error }, "Sync after roster assignment failed.");
        return error;
      });

      return normalizedTag;
    }, "ROSTER_ASSIGN_FAILED");
  }

  public unassignRosterMember(
    guildId: string,
    rosterName: string,
    playerTag: string
  ): ResultAsync<boolean, AppError> {
    return toResultAsync(async () => {
      const state = await this.requireGuildSetup(guildId);
      const roster = await this.deps.rosterRepo.getRosterByName(guildId, state.seasonId, rosterName);
      if (!roster) {
        throw new AppError("ROSTER_NOT_FOUND", "Roster not found.");
      }

      const removed = await this.deps.rosterRepo.unassignMember(roster.id, normalizeClanTag(playerTag));
      await this.syncForGuild(guildId, { jobType: "manual" }).mapErr((error) => error);
      return removed;
    }, "ROSTER_UNASSIGN_FAILED");
  }

  public suggestRoster(guildId: string, rosterName?: string): ResultAsync<SuggestedRosterEntry[], AppError> {
    return toResultAsync(async () => {
      const state = await this.requireGuildSetup(guildId);
      const signups = await this.deps.signupRepo.listBySeason(guildId, state.seasonId);
      const suggestions = await this.computeSuggestions(guildId, state.seasonId, signups);

      if (!rosterName) {
        return suggestions;
      }

      const roster = await this.deps.rosterRepo.getRosterByName(guildId, state.seasonId, rosterName);
      if (!roster) {
        throw new AppError("ROSTER_NOT_FOUND", "Roster not found.");
      }

      return suggestions.slice(0, roster.rosterSize);
    }, "ROSTER_SUGGEST_FAILED");
  }

  public exportRoster(guildId: string, rosterName?: string): ResultAsync<string, AppError> {
    return toResultAsync(async () => {
      const state = await this.requireGuildSetup(guildId);

      const rosters = await this.deps.rosterRepo.listRosters(guildId, state.seasonId);
      if (rosters.length === 0) {
        return "No rosters are configured for this season yet.";
      }

      const selected = rosterName
        ? rosters.filter((roster) => roster.rosterName === rosterName)
        : rosters;

      if (selected.length === 0) {
        throw new AppError("ROSTER_NOT_FOUND", "Roster not found.");
      }

      const parts: string[] = [];
      for (const roster of selected) {
        const members = await this.deps.rosterRepo.listMembersByRoster(roster.id);
        const lines = members.map((member, index) => `${index + 1}. ${member.playerTag}`);
        parts.push(`# ${roster.rosterName} (${members.length}/${roster.rosterSize})`, ...lines, "");
      }

      return ["```txt", ...parts, "```"].join("\n");
    }, "ROSTER_EXPORT_FAILED");
  }

  public runSyncNow(
    guildId: string,
    options?: { seasonKey?: string; clanTag?: string }
  ): ResultAsync<SyncResult, AppError> {
    const syncParams: { jobType: string; seasonKey?: string; clanTag?: string } = {
      jobType: "manual"
    };
    if (options?.seasonKey) {
      syncParams.seasonKey = options.seasonKey;
    }
    if (options?.clanTag) {
      syncParams.clanTag = options.clanTag;
    }

    return this.syncForGuild(guildId, {
      ...syncParams
    });
  }

  public listGuildsForScheduler(): ResultAsync<GuildSettings[], AppError> {
    return toResultAsync(async () => this.deps.guildConfigRepo.listGuilds(), "GUILD_LIST_FAILED");
  }

  public ensureSeasonForCurrentMonth(guildId: string): ResultAsync<string, AppError> {
    return toResultAsync(async () => {
      const state = await this.requireGuildSetup(guildId);
      return state.seasonId;
    }, "SEASON_ROLLOVER_FAILED");
  }

  private syncForGuild(
    guildId: string,
    params: {
      jobType: string;
      seasonKey?: string;
      clanTag?: string;
      targetPlayerTags?: string[];
    }
  ): ResultAsync<SyncResult, AppError> {
    return toResultAsync(async () => {
      const setup = await this.requireGuildSetup(guildId);
      const season =
        params.seasonKey === undefined
          ? await this.deps.seasonRepo.getById(setup.seasonId)
          : await this.deps.seasonRepo.getByKey(guildId, params.seasonKey);

      if (!season) {
        throw new AppError("SEASON_NOT_FOUND", "Requested season was not found.");
      }

      const correlationId = ulid();
      const job = await this.deps.syncJobRepo.startJob({
        guildId,
        seasonId: season.id,
        jobType: params.jobType,
        correlationId
      });

      try {
        const signups = await this.deps.signupRepo.listBySeason(guildId, season.id);
        const targetSignups =
          params.targetPlayerTags && params.targetPlayerTags.length > 0
            ? signups.filter((signup) =>
                params.targetPlayerTags?.includes(normalizeClanTag(signup.playerTag))
              )
            : signups;

        const playerTags = [...new Set(targetSignups.map((signup) => normalizeClanTag(signup.playerTag)))];

        const playerChunks = chunkArray(playerTags, 20);
        for (const chunk of playerChunks) {
          await Promise.all(
            chunk.map(async (playerTag) => {
              const player = await this.deps.cocClient.getPlayer(playerTag);
              const heroesCombined = (player.heroes ?? []).reduce(
                (sum, hero) => sum + (hero.level ?? 0),
                0
              );

              await this.deps.statsRepo.insertSnapshot({
                guildId,
                seasonId: season.id,
                playerTag: normalizeClanTag(player.tag),
                playerName: player.name,
                clanTag: player.clan?.tag ? normalizeClanTag(player.clan.tag) : null,
                townHall: player.townHallLevel,
                heroesCombined,
                warStarsTotal: player.warStars,
                attackWins: player.attackWins,
                defenseWins: player.defenseWins,
                trophies: player.trophies,
                donations: player.donations,
                donationsReceived: player.donationsReceived,
                capturedAt: new Date()
              });
            })
          );
        }

        const configuredClans = await this.deps.guildConfigRepo.listGuildClans(guildId);
        const clansToSync =
          params.clanTag === undefined
            ? configuredClans
            : configuredClans.filter(
                (clan) => normalizeClanTag(clan.clanTag) === normalizeClanTag(params.clanTag ?? "")
              );

        let syncedWars = 0;
        for (const clan of clansToSync) {
          const currentWar = await this.deps.cocClient.getCurrentWar(clan.clanTag);
          if (currentWar) {
            const warId = currentWar.startTime
              ? `${normalizeClanTag(clan.clanTag)}:${currentWar.startTime}`
              : `${normalizeClanTag(clan.clanTag)}:current:${Date.now()}`;
            const events = extractWarEventsForClan(currentWar, clan.clanTag, "war");
            if (events.length > 0) {
              await this.deps.statsRepo.replaceWarEventsForWar({
                guildId,
                seasonId: season.id,
                warId,
                warType: "war",
                warDay: new Date(),
                events
              });
              syncedWars += 1;
            }
          }

          const leagueWars = await this.deps.cocClient.getLeagueWars(clan.clanTag);
          for (const [index, leagueWar] of leagueWars.entries()) {
            const events = extractWarEventsForClan(leagueWar, clan.clanTag, "cwl");
            if (events.length === 0) {
              continue;
            }

            const warId = leagueWar.startTime
              ? `${normalizeClanTag(clan.clanTag)}:cwl:${leagueWar.startTime}`
              : `${normalizeClanTag(clan.clanTag)}:cwl:${index}`;

            await this.deps.statsRepo.replaceWarEventsForWar({
              guildId,
              seasonId: season.id,
              warId,
              warType: "cwl",
              warDay: new Date(),
              events
            });
            syncedWars += 1;
          }
        }

        await this.writeGuildSheet(guildId, season.id, season.displayName, setup.guild, signups);
        await this.deps.syncJobRepo.finishJob(
          job.id,
          "success",
          `Synced ${playerTags.length} players and ${syncedWars} wars.`
        );

        return {
          syncedPlayers: playerTags.length,
          syncedWars,
          updatedAt: new Date()
        };
      } catch (error) {
        await this.deps.syncJobRepo.finishJob(job.id, "error", "Sync failed.");
        throw error;
      }
    }, "SYNC_FAILED");
  }

  private async writeGuildSheet(
    guildId: string,
    seasonId: string,
    seasonDisplayName: string,
    guild: GuildSettings,
    signups: CwlSignup[]
  ): Promise<void> {
    const sheetConfig = await this.deps.guildConfigRepo.getGuildSheetConfig(guildId);
    if (!sheetConfig) {
      this.deps.logger.warn({ guildId }, "Skipping sheet update because spreadsheet is not configured.");
      return;
    }

    await this.deps.sheetsClient.initTemplate(
      sheetConfig.spreadsheetId,
      sheetConfig.coverSheetName,
      seasonDisplayName
    );

    const playerTags = [...new Set(signups.map((signup) => normalizeClanTag(signup.playerTag)))];
    const [snapshotsByTag, events, scoringConfig, clans, rosters] = await Promise.all([
      this.deps.statsRepo.latestSnapshotsForPlayers(guildId, playerTags),
      this.deps.statsRepo.listEventsInWindow(guildId, playerTags, dateDaysAgo(90)),
      this.deps.guildConfigRepo.getScoringConfig(guildId),
      this.deps.guildConfigRepo.listGuildClans(guildId),
      this.deps.rosterRepo.listRosters(guildId, seasonId)
    ]);

    const eventsByTag = new Map<string, typeof events>();
    for (const playerTag of playerTags) {
      eventsByTag.set(
        playerTag,
        events.filter((event) => normalizeClanTag(event.playerTag) === normalizeClanTag(playerTag))
      );
    }

    const answersByTag = new Map<string, Map<number, string>>();
    for (const signup of signups) {
      answersByTag.set(
        normalizeClanTag(signup.playerTag),
        new Map(signup.answers.map((answer) => [answer.questionIndex, answer.answerValue]))
      );
    }

    const computed = computeStatsForPlayers({
      snapshotsByTag,
      eventsByTag,
      answersByTag,
      weights: scoringConfig.weights
    });

    const rows = signups
      .map((signup) => {
        const tag = normalizeClanTag(signup.playerTag);
        const stats = computed.get(tag);
        const answers = answersByTag.get(tag) ?? new Map<number, string>();
        if (!stats) {
          return null;
        }

        const availability = answers.get(1) ?? "N/A";
        const discordDisplay = `<@${signup.discordUserId}>`;
        const currentClanAlias = clans.find(
          (clan) => normalizeClanTag(clan.clanTag) === normalizeClanTag(stats.currentClan)
        )?.alias;

        return [
          availability === "No" ? "NO" : "YES",
          stats.playerName,
          tag,
          currentClanAlias ?? stats.currentClan,
          discordDisplay,
          stats.townHall,
          stats.combinedHeroes,
          formatRatio(stats.warHitrate),
          formatRatio(stats.cwlHitrate),
          stats.lastCwl,
          signup.note ?? "",
          stats.totalAttacks,
          stats.stars,
          formatMetric(stats.avgStars),
          stats.destruction,
          formatMetric(stats.avgDestruction),
          stats.threeStars,
          stats.twoStars,
          stats.oneStars,
          stats.zeroStars,
          stats.missed,
          stats.defenseStars,
          formatMetric(stats.defenseAvgStars),
          stats.defenseDestruction,
          formatMetric(stats.defenseAvgDestruction)
        ] as Array<string | number>;
      })
      .filter((row): row is Array<string | number> => row !== null);

    await this.deps.sheetsClient.clearSeasonRows(sheetConfig.spreadsheetId, seasonDisplayName);
    await this.deps.sheetsClient.writeSeasonRows(sheetConfig.spreadsheetId, seasonDisplayName, rows);

    const rosterMembers = await this.deps.rosterRepo.listMembersBySeason(guildId, seasonId);
    const rosterBlocks = await Promise.all(
      rosters.map(async (roster) => {
        const members = rosterMembers.filter((member) => member.rosterId === roster.id);
        const enrichedRows = members
          .map((member) => {
            const stats = computed.get(normalizeClanTag(member.playerTag));
            if (!stats) {
              return null;
            }

            const signup = signups.find(
              (entry) => normalizeClanTag(entry.playerTag) === normalizeClanTag(member.playerTag)
            );

            return {
              signupStatus: signup?.status === "active" ? "YES" : "NO",
              playerName: stats.playerName,
              playerTag: normalizeClanTag(member.playerTag),
              currentClan: stats.currentClan,
              discordName: member.discordUserId ? `<@${member.discordUserId}>` : "",
              th: stats.townHall,
              heroesCombined: stats.combinedHeroes,
              warHitrate: formatRatio(stats.warHitrate),
              cwlHitrate: formatRatio(stats.cwlHitrate),
              lastCwl: stats.lastCwl,
              note: signup?.note ?? ""
            };
          })
          .filter((row): row is NonNullable<typeof row> => row !== null);

        const clanAlias =
          clans.find((clan) => normalizeClanTag(clan.clanTag) === normalizeClanTag(roster.clanTag))
            ?.alias ?? roster.clanTag;

        return {
          rosterName: roster.rosterName,
          clanAlias,
          rosterSize: roster.rosterSize,
          rows: enrichedRows
        };
      })
    );

    await this.deps.sheetsClient.writeRosterBlocks(
      sheetConfig.spreadsheetId,
      seasonDisplayName,
      rosterBlocks
    );

    await this.deps.sheetsClient.updateCoverSheet({
      spreadsheetId: sheetConfig.spreadsheetId,
      coverSheetName: sheetConfig.coverSheetName,
      guildName: guild.guildId,
      clanAliases: clans.map((clan) => clan.alias),
      activeSeasonName: seasonDisplayName,
      signupStatus: guild.signupLocked ? "Locked" : "Open",
      syncStatus: "Healthy",
      lastSyncIso: new Date().toISOString()
    });
  }

  private async computeSuggestions(
    guildId: string,
    _seasonId: string,
    signups: CwlSignup[]
  ): Promise<SuggestedRosterEntry[]> {
    const playerTags = [...new Set(signups.map((signup) => normalizeClanTag(signup.playerTag)))];
    const [snapshotsByTag, events, scoringConfig] = await Promise.all([
      this.deps.statsRepo.latestSnapshotsForPlayers(guildId, playerTags),
      this.deps.statsRepo.listEventsInWindow(guildId, playerTags, dateDaysAgo(90)),
      this.deps.guildConfigRepo.getScoringConfig(guildId)
    ]);

    const eventsByTag = new Map<string, typeof events>();
    for (const playerTag of playerTags) {
      eventsByTag.set(
        playerTag,
        events.filter((event) => normalizeClanTag(event.playerTag) === normalizeClanTag(playerTag))
      );
    }

    const answersByTag = new Map<string, Map<number, string>>();
    for (const signup of signups) {
      answersByTag.set(
        normalizeClanTag(signup.playerTag),
        new Map(signup.answers.map((answer) => [answer.questionIndex, answer.answerValue]))
      );
    }

    const computed = computeStatsForPlayers({
      snapshotsByTag,
      eventsByTag,
      answersByTag,
      weights: scoringConfig.weights
    });

    const output: SuggestedRosterEntry[] = signups
      .map((signup) => {
        const tag = normalizeClanTag(signup.playerTag);
        const stats = computed.get(tag);
        if (!stats) {
          return null;
        }

        const answers = answersByTag.get(tag) ?? new Map<number, string>();
        return {
          discordUserId: signup.discordUserId,
          playerTag: tag,
          playerName: stats.playerName,
          townHall: stats.townHall,
          score: stats.rosterScore,
          warHitrate: stats.warHitrate,
          cwlHitrate: stats.cwlHitrate,
          availability: answers.get(1) ?? "N/A",
          competitiveness: answers.get(2) ?? "N/A"
        };
      })
      .filter((entry): entry is SuggestedRosterEntry => entry !== null);

    return output.sort((left, right) => right.score - left.score || right.townHall - left.townHall);
  }

  private async requireGuildSetup(guildId: string): Promise<GuildState> {
    const result = await this.ensureGuildSetup(guildId);
    if (result.isErr()) {
      throw new AppError("GUILD_SETUP_FAILED", "Failed to prepare guild setup.");
    }

    return result.value;
  }

  private async requireSignupQuestions(
    guildId: string
  ): Promise<Array<{ index: number; prompt: string; options: string[] }>> {
    const result = await this.getSignupQuestionsWithDynamicOptions(guildId);
    if (result.isErr()) {
      throw new AppError("SIGNUP_QUESTIONS_FAILED", "Failed to load signup questions.");
    }

    return result.value;
  }
}
