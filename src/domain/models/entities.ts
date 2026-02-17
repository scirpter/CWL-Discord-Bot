import type { ScoringWeights } from "@/domain/models/scoring.js";
import type { SignupQuestion } from "@/domain/models/signup-question.js";

export type GuildSettings = {
  id: string;
  guildId: string;
  timezone: string;
  signupChannelId: string | null;
  activeSeasonId: string | null;
  signupLocked: boolean;
  syncIntervalHours: number;
  createdAt: Date;
  updatedAt: Date;
};

export type GuildClan = {
  id: string;
  guildId: string;
  clanTag: string;
  alias: string;
  createdAt: Date;
};

export type GuildSheetConfig = {
  id: string;
  guildId: string;
  spreadsheetId: string;
  coverSheetName: string;
  updatedAt: Date;
};

export type PlayerLink = {
  id: string;
  guildId: string;
  discordUserId: string;
  playerTag: string;
  playerName: string | null;
  linkedAt: Date;
  updatedAt: Date;
};

export type CwlSeason = {
  id: string;
  guildId: string;
  seasonKey: string;
  displayName: string;
  status: string;
  signupLocked: boolean;
  startedAt: Date;
  lockedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type SignupAnswer = {
  questionIndex: number;
  answerValue: string;
};

export type CwlSignup = {
  id: string;
  guildId: string;
  seasonId: string;
  discordUserId: string;
  playerTag: string;
  note: string | null;
  status: string;
  submittedAt: Date;
  updatedAt: Date;
  answers: SignupAnswer[];
};

export type CwlRoster = {
  id: string;
  guildId: string;
  seasonId: string;
  clanTag: string;
  rosterName: string;
  rosterSize: number;
  rosterOrder: number;
  createdAt: Date;
  updatedAt: Date;
};

export type CwlRosterMember = {
  id: string;
  guildId: string;
  seasonId: string;
  rosterId: string;
  playerTag: string;
  discordUserId: string | null;
  assignedByUserId: string;
  assignedAt: Date;
  updatedAt: Date;
};

export type ScoringConfig = {
  id: string;
  guildId: string;
  weights: ScoringWeights;
  updatedAt: Date;
};

export type SignupQuestionConfig = SignupQuestion & {
  id: string;
  guildId: string;
  isActive: boolean;
  updatedAt: Date;
};

export type PlayerSnapshot = {
  id: string;
  guildId: string;
  seasonId: string | null;
  playerTag: string;
  playerName: string;
  clanTag: string | null;
  townHall: number;
  heroesCombined: number;
  warStarsTotal: number;
  attackWins: number;
  defenseWins: number;
  trophies: number;
  donations: number;
  donationsReceived: number;
  capturedAt: Date;
};

export type WarAttackEvent = {
  id: string;
  guildId: string;
  seasonId: string | null;
  warType: string;
  warId: string;
  warDay: Date;
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
  capturedAt: Date;
};

export type SyncJobRun = {
  id: string;
  guildId: string;
  seasonId: string | null;
  jobType: string;
  status: string;
  correlationId: string;
  summary: string | null;
  startedAt: Date;
  finishedAt: Date | null;
};
