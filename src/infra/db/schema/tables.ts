import {
  boolean,
  datetime,
  decimal,
  int,
  mysqlTable,
  uniqueIndex,
  varchar
} from "drizzle-orm/mysql-core";

const id = (name: string) => varchar(name, { length: 26 }).notNull();

export const guildSettings = mysqlTable(
  "guild_settings",
  {
    id: id("id").primaryKey(),
    guildId: varchar("guild_id", { length: 32 }).notNull(),
    timezone: varchar("timezone", { length: 64 }).notNull().default("UTC"),
    signupChannelId: varchar("signup_channel_id", { length: 32 }),
    activeSeasonId: varchar("active_season_id", { length: 26 }),
    signupLocked: boolean("signup_locked").notNull().default(false),
    syncIntervalHours: int("sync_interval_hours").notNull().default(6),
    createdAt: datetime("created_at", { mode: "date", fsp: 3 }).notNull(),
    updatedAt: datetime("updated_at", { mode: "date", fsp: 3 }).notNull()
  },
  (table) => ({
    guildIdUnique: uniqueIndex("guild_settings_guild_id_uq").on(table.guildId)
  })
);

export const guildClans = mysqlTable(
  "guild_clans",
  {
    id: id("id").primaryKey(),
    guildId: varchar("guild_id", { length: 32 }).notNull(),
    clanTag: varchar("clan_tag", { length: 16 }).notNull(),
    alias: varchar("alias", { length: 64 }).notNull(),
    createdAt: datetime("created_at", { mode: "date", fsp: 3 }).notNull()
  },
  (table) => ({
    guildClanUnique: uniqueIndex("guild_clans_guild_tag_uq").on(table.guildId, table.clanTag)
  })
);

export const guildSheetConfig = mysqlTable(
  "guild_sheet_config",
  {
    id: id("id").primaryKey(),
    guildId: varchar("guild_id", { length: 32 }).notNull(),
    spreadsheetId: varchar("spreadsheet_id", { length: 128 }).notNull(),
    coverSheetName: varchar("cover_sheet_name", { length: 64 }).notNull().default("COVER SHEET"),
    updatedAt: datetime("updated_at", { mode: "date", fsp: 3 }).notNull()
  },
  (table) => ({
    guildSheetUnique: uniqueIndex("guild_sheet_config_guild_uq").on(table.guildId)
  })
);

export const guildScoringWeights = mysqlTable(
  "guild_scoring_weights",
  {
    id: id("id").primaryKey(),
    guildId: varchar("guild_id", { length: 32 }).notNull(),
    thWeight: decimal("th_weight", { precision: 6, scale: 3 }).notNull().default("0.250"),
    heroWeight: decimal("hero_weight", { precision: 6, scale: 3 }).notNull().default("0.250"),
    warWeight: decimal("war_weight", { precision: 6, scale: 3 }).notNull().default("0.200"),
    cwlWeight: decimal("cwl_weight", { precision: 6, scale: 3 }).notNull().default("0.200"),
    missedPenalty: decimal("missed_penalty", { precision: 6, scale: 3 }).notNull().default("0.100"),
    competitiveBonus: decimal("competitive_bonus", { precision: 6, scale: 3 }).notNull().default("0.050"),
    availabilityBonus: decimal("availability_bonus", { precision: 6, scale: 3 }).notNull().default("0.050"),
    updatedAt: datetime("updated_at", { mode: "date", fsp: 3 }).notNull()
  },
  (table) => ({
    guildScoringUnique: uniqueIndex("guild_scoring_weights_guild_uq").on(table.guildId)
  })
);

export const guildSignupQuestions = mysqlTable(
  "guild_signup_questions",
  {
    id: id("id").primaryKey(),
    guildId: varchar("guild_id", { length: 32 }).notNull(),
    questionIndex: int("question_index").notNull(),
    prompt: varchar("prompt", { length: 180 }).notNull(),
    optionsJson: varchar("options_json", { length: 1000 }).notNull(),
    isActive: boolean("is_active").notNull().default(true),
    updatedAt: datetime("updated_at", { mode: "date", fsp: 3 }).notNull()
  },
  (table) => ({
    guildQuestionUnique: uniqueIndex("guild_signup_questions_guild_idx_uq").on(
      table.guildId,
      table.questionIndex
    )
  })
);

export const discordPlayers = mysqlTable(
  "discord_players",
  {
    id: id("id").primaryKey(),
    guildId: varchar("guild_id", { length: 32 }).notNull(),
    discordUserId: varchar("discord_user_id", { length: 32 }).notNull(),
    playerTag: varchar("player_tag", { length: 16 }).notNull(),
    playerName: varchar("player_name", { length: 64 }),
    linkedAt: datetime("linked_at", { mode: "date", fsp: 3 }).notNull(),
    updatedAt: datetime("updated_at", { mode: "date", fsp: 3 }).notNull()
  },
  (table) => ({
    guildDiscordUserUnique: uniqueIndex("discord_players_guild_user_uq").on(
      table.guildId,
      table.discordUserId
    ),
    guildPlayerTagUnique: uniqueIndex("discord_players_guild_player_tag_uq").on(
      table.guildId,
      table.playerTag
    )
  })
);

export const cwlSeasons = mysqlTable(
  "cwl_seasons",
  {
    id: id("id").primaryKey(),
    guildId: varchar("guild_id", { length: 32 }).notNull(),
    seasonKey: varchar("season_key", { length: 16 }).notNull(),
    displayName: varchar("display_name", { length: 32 }).notNull(),
    status: varchar("status", { length: 16 }).notNull().default("open"),
    signupLocked: boolean("signup_locked").notNull().default(false),
    startedAt: datetime("started_at", { mode: "date", fsp: 3 }).notNull(),
    lockedAt: datetime("locked_at", { mode: "date", fsp: 3 }),
    createdAt: datetime("created_at", { mode: "date", fsp: 3 }).notNull(),
    updatedAt: datetime("updated_at", { mode: "date", fsp: 3 }).notNull()
  },
  (table) => ({
    guildSeasonUnique: uniqueIndex("cwl_seasons_guild_key_uq").on(table.guildId, table.seasonKey)
  })
);

export const cwlSignups = mysqlTable(
  "cwl_signups",
  {
    id: id("id").primaryKey(),
    guildId: varchar("guild_id", { length: 32 }).notNull(),
    seasonId: varchar("season_id", { length: 26 }).notNull(),
    discordUserId: varchar("discord_user_id", { length: 32 }).notNull(),
    playerTag: varchar("player_tag", { length: 16 }).notNull(),
    note: varchar("note", { length: 240 }),
    status: varchar("status", { length: 16 }).notNull().default("active"),
    submittedAt: datetime("submitted_at", { mode: "date", fsp: 3 }).notNull(),
    updatedAt: datetime("updated_at", { mode: "date", fsp: 3 }).notNull()
  },
  (table) => ({
    guildSeasonSignupUnique: uniqueIndex("cwl_signups_guild_season_user_uq").on(
      table.guildId,
      table.seasonId,
      table.discordUserId
    )
  })
);

export const cwlSignupAnswers = mysqlTable(
  "cwl_signup_answers",
  {
    id: id("id").primaryKey(),
    signupId: varchar("signup_id", { length: 26 }).notNull(),
    questionIndex: int("question_index").notNull(),
    answerValue: varchar("answer_value", { length: 128 }).notNull(),
    updatedAt: datetime("updated_at", { mode: "date", fsp: 3 }).notNull()
  },
  (table) => ({
    signupQuestionUnique: uniqueIndex("cwl_signup_answers_signup_question_uq").on(
      table.signupId,
      table.questionIndex
    )
  })
);

export const cwlRosters = mysqlTable(
  "cwl_rosters",
  {
    id: id("id").primaryKey(),
    guildId: varchar("guild_id", { length: 32 }).notNull(),
    seasonId: varchar("season_id", { length: 26 }).notNull(),
    clanTag: varchar("clan_tag", { length: 16 }).notNull(),
    rosterName: varchar("roster_name", { length: 64 }).notNull(),
    rosterSize: int("roster_size").notNull(),
    rosterOrder: int("roster_order").notNull().default(0),
    createdAt: datetime("created_at", { mode: "date", fsp: 3 }).notNull(),
    updatedAt: datetime("updated_at", { mode: "date", fsp: 3 }).notNull()
  },
  (table) => ({
    rosterUnique: uniqueIndex("cwl_rosters_guild_season_name_uq").on(
      table.guildId,
      table.seasonId,
      table.rosterName
    )
  })
);

export const cwlRosterMembers = mysqlTable(
  "cwl_roster_members",
  {
    id: id("id").primaryKey(),
    guildId: varchar("guild_id", { length: 32 }).notNull(),
    seasonId: varchar("season_id", { length: 26 }).notNull(),
    rosterId: varchar("roster_id", { length: 26 }).notNull(),
    playerTag: varchar("player_tag", { length: 16 }).notNull(),
    discordUserId: varchar("discord_user_id", { length: 32 }),
    assignedByUserId: varchar("assigned_by_user_id", { length: 32 }).notNull(),
    assignedAt: datetime("assigned_at", { mode: "date", fsp: 3 }).notNull(),
    updatedAt: datetime("updated_at", { mode: "date", fsp: 3 }).notNull()
  },
  (table) => ({
    rosterMemberUnique: uniqueIndex("cwl_roster_members_roster_player_uq").on(
      table.rosterId,
      table.playerTag
    )
  })
);

export const cocPlayerSnapshots = mysqlTable("coc_player_snapshots", {
  id: id("id").primaryKey(),
  guildId: varchar("guild_id", { length: 32 }).notNull(),
  seasonId: varchar("season_id", { length: 26 }),
  playerTag: varchar("player_tag", { length: 16 }).notNull(),
  playerName: varchar("player_name", { length: 64 }).notNull(),
  clanTag: varchar("clan_tag", { length: 16 }),
  townHall: int("town_hall").notNull(),
  heroesCombined: int("heroes_combined").notNull(),
  warStarsTotal: int("war_stars_total").notNull(),
  attackWins: int("attack_wins").notNull(),
  defenseWins: int("defense_wins").notNull(),
  trophies: int("trophies").notNull(),
  donations: int("donations").notNull(),
  donationsReceived: int("donations_received").notNull(),
  capturedAt: datetime("captured_at", { mode: "date", fsp: 3 }).notNull()
});

export const cocWarAttackEvents = mysqlTable(
  "coc_war_attack_events",
  {
    id: id("id").primaryKey(),
    guildId: varchar("guild_id", { length: 32 }).notNull(),
    seasonId: varchar("season_id", { length: 26 }),
    warType: varchar("war_type", { length: 16 }).notNull(),
    warId: varchar("war_id", { length: 64 }).notNull(),
    warDay: datetime("war_day", { mode: "date", fsp: 3 }).notNull(),
    playerTag: varchar("player_tag", { length: 16 }).notNull(),
    attacksUsed: int("attacks_used").notNull(),
    attacksAllowed: int("attacks_allowed").notNull(),
    stars: int("stars").notNull(),
    destruction: decimal("destruction", { precision: 6, scale: 2 }).notNull(),
    triples: int("triples").notNull(),
    twos: int("twos").notNull(),
    ones: int("ones").notNull(),
    zeroes: int("zeroes").notNull(),
    missed: boolean("missed").notNull(),
    defenseStars: int("defense_stars").notNull(),
    defenseDestruction: decimal("defense_destruction", { precision: 6, scale: 2 }).notNull(),
    capturedAt: datetime("captured_at", { mode: "date", fsp: 3 }).notNull()
  },
  (table) => ({
    warPlayerUnique: uniqueIndex("coc_war_attack_events_guild_war_player_uq").on(
      table.guildId,
      table.warId,
      table.playerTag
    )
  })
);

export const syncJobRuns = mysqlTable("sync_job_runs", {
  id: id("id").primaryKey(),
  guildId: varchar("guild_id", { length: 32 }).notNull(),
  seasonId: varchar("season_id", { length: 26 }),
  jobType: varchar("job_type", { length: 32 }).notNull(),
  status: varchar("status", { length: 16 }).notNull(),
  correlationId: varchar("correlation_id", { length: 26 }).notNull(),
  summary: varchar("summary", { length: 1024 }),
  startedAt: datetime("started_at", { mode: "date", fsp: 3 }).notNull(),
  finishedAt: datetime("finished_at", { mode: "date", fsp: 3 })
});

export const schema = {
  guildSettings,
  guildClans,
  guildSheetConfig,
  guildScoringWeights,
  guildSignupQuestions,
  discordPlayers,
  cwlSeasons,
  cwlSignups,
  cwlSignupAnswers,
  cwlRosters,
  cwlRosterMembers,
  cocPlayerSnapshots,
  cocWarAttackEvents,
  syncJobRuns
};

export type DbSchema = typeof schema;
