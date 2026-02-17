import type {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  SlashCommandSubcommandsOnlyBuilder
} from "discord.js";

import type { BotRuntime } from "@/infra/discord/runtime.js";

export type CommandModule = {
  data: SlashCommandBuilder | SlashCommandSubcommandsOnlyBuilder;
  execute: (interaction: ChatInputCommandInteraction, runtime: BotRuntime) => Promise<void>;
};
