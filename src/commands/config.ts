import { PermissionFlagsBits, SlashCommandBuilder } from "discord.js";

import { AppError } from "@/domain/errors.js";
import type { CommandModule } from "@/infra/discord/command-module.js";
import {
  deferEphemeral,
  requireGuild,
  requireManageGuildPermission
} from "@/infra/discord/command-utils.js";
import type { BotRuntime } from "@/infra/discord/runtime.js";
import { normalizeClanTag } from "@/utils/clash.js";

const data = new SlashCommandBuilder()
  .setName("config")
  .setDescription("Configure guild CWL bot settings.")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .addSubcommandGroup((group) =>
    group
      .setName("clan")
      .setDescription("Clan config")
      .addSubcommand((subcommand) =>
        subcommand
          .setName("add")
          .setDescription("Add a family clan.")
          .addStringOption((option) =>
            option.setName("tag").setDescription("Clan tag").setRequired(true)
          )
          .addStringOption((option) =>
            option.setName("alias").setDescription("Friendly name").setRequired(true)
          )
      )
      .addSubcommand((subcommand) =>
        subcommand
          .setName("remove")
          .setDescription("Remove a family clan.")
          .addStringOption((option) =>
            option.setName("tag").setDescription("Clan tag").setRequired(true)
          )
      )
  )
  .addSubcommandGroup((group) =>
    group
      .setName("sheet")
      .setDescription("Google Sheets config")
      .addSubcommand((subcommand) =>
        subcommand
          .setName("connect")
          .setDescription("Connect the guild spreadsheet.")
          .addStringOption((option) =>
            option
              .setName("spreadsheet_id")
              .setDescription("Google spreadsheet ID")
              .setRequired(true)
          )
      )
  )
  .addSubcommandGroup((group) =>
    group
      .setName("signup-channel")
      .setDescription("Signup panel channel config")
      .addSubcommand((subcommand) =>
        subcommand
          .setName("set")
          .setDescription("Set signup panel channel.")
          .addChannelOption((option) =>
            option.setName("channel").setDescription("Target channel").setRequired(true)
          )
      )
  )
  .addSubcommandGroup((group) =>
    group
      .setName("timezone")
      .setDescription("Timezone config")
      .addSubcommand((subcommand) =>
        subcommand
          .setName("set")
          .setDescription("Set guild timezone.")
          .addStringOption((option) =>
            option
              .setName("tz")
              .setDescription("IANA timezone name (e.g. UTC, America/New_York)")
              .setRequired(true)
          )
      )
  )
  .addSubcommandGroup((group) =>
    group
      .setName("schedule")
      .setDescription("Sync schedule config")
      .addSubcommand((subcommand) =>
        subcommand
          .setName("set")
          .setDescription("Set scheduled sync interval in hours.")
          .addIntegerOption((option) =>
            option.setName("hours").setDescription("1-24").setRequired(true)
          )
      )
  )
  .addSubcommandGroup((group) =>
    group
      .setName("scoring")
      .setDescription("Scoring weights config")
      .addSubcommand((subcommand) =>
        subcommand
          .setName("set")
          .setDescription("Set roster scoring weights.")
          .addNumberOption((option) => option.setName("th").setDescription("TH weight").setRequired(false))
          .addNumberOption((option) =>
            option.setName("heroes").setDescription("Heroes weight").setRequired(false)
          )
          .addNumberOption((option) =>
            option.setName("war").setDescription("War hitrate weight").setRequired(false)
          )
          .addNumberOption((option) =>
            option.setName("cwl").setDescription("CWL hitrate weight").setRequired(false)
          )
          .addNumberOption((option) =>
            option
              .setName("missed_penalty")
              .setDescription("Missed attacks penalty weight")
              .setRequired(false)
          )
          .addNumberOption((option) =>
            option
              .setName("competitive_bonus")
              .setDescription("Competitive answer bonus weight")
              .setRequired(false)
          )
          .addNumberOption((option) =>
            option
              .setName("availability_bonus")
              .setDescription("Availability answer bonus weight")
              .setRequired(false)
          )
      )
  )
  .addSubcommandGroup((group) =>
    group
      .setName("questions")
      .setDescription("Signup question config")
      .addSubcommand((subcommand) =>
        subcommand.setName("list").setDescription("List configured signup questions.")
      )
      .addSubcommand((subcommand) =>
        subcommand
          .setName("edit")
          .setDescription("Edit one signup question.")
          .addIntegerOption((option) =>
            option
              .setName("index")
              .setDescription("Question index 1-5")
              .setRequired(true)
              .setMinValue(1)
              .setMaxValue(5)
          )
          .addStringOption((option) =>
            option.setName("prompt").setDescription("Question prompt").setRequired(true)
          )
          .addStringOption((option) =>
            option
              .setName("options")
              .setDescription("Comma-separated options")
              .setRequired(true)
          )
      )
      .addSubcommand((subcommand) =>
        subcommand.setName("reset-defaults").setDescription("Reset questions to defaults.")
      )
  )
  .addSubcommandGroup((group) =>
    group
      .setName("template")
      .setDescription("Sheet template commands")
      .addSubcommand((subcommand) =>
        subcommand
          .setName("init")
          .setDescription("Initialize the sheet template.")
          .addStringOption((option) =>
            option
              .setName("season")
              .setDescription("Optional season key YYYY-MM")
              .setRequired(false)
          )
      )
      .addSubcommand((subcommand) =>
        subcommand
          .setName("refresh-format")
          .setDescription("Refresh template formatting.")
          .addStringOption((option) =>
            option
              .setName("season")
              .setDescription("Optional season key YYYY-MM")
              .setRequired(false)
          )
      )
  );

function toStringList(items: string[]): string {
  return items.map((item) => `- ${item}`).join("\n");
}

function compactObject<T extends Record<string, number | undefined>>(input: T) {
  const output: Partial<Record<keyof T, number>> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined) {
      output[key as keyof T] = value;
    }
  }
  return output;
}

export const configCommand: CommandModule = {
  data,
  async execute(interaction, runtime) {
    await deferEphemeral(interaction);
    requireManageGuildPermission(interaction);
    const guildId = requireGuild(interaction);

    const group = interaction.options.getSubcommandGroup(true);
    const subcommand = interaction.options.getSubcommand(true);

    if (group === "clan" && subcommand === "add") {
      const tag = interaction.options.getString("tag", true);
      const alias = interaction.options.getString("alias", true);
      const result = await runtime.cwlBotService.addClan(guildId, tag, alias);
      if (result.isErr()) {
        throw result.error;
      }

      await interaction.editReply(`Added clan **${result.value.alias}** (\`${result.value.clanTag}\`).`);
      return;
    }

    if (group === "clan" && subcommand === "remove") {
      const tag = interaction.options.getString("tag", true);
      const result = await runtime.cwlBotService.removeClan(guildId, normalizeClanTag(tag));
      if (result.isErr()) {
        throw result.error;
      }

      await interaction.editReply(
        result.value ? `Removed clan \`${normalizeClanTag(tag)}\`.` : `Clan not found.`
      );
      return;
    }

    if (group === "sheet" && subcommand === "connect") {
      const spreadsheetId = interaction.options.getString("spreadsheet_id", true);
      const result = await runtime.cwlBotService.setSheetConnection(guildId, spreadsheetId);
      if (result.isErr()) {
        throw result.error;
      }

      await interaction.editReply(`Spreadsheet connected: \`${result.value}\`.`);
      return;
    }

    if (group === "signup-channel" && subcommand === "set") {
      const channel = interaction.options.getChannel("channel", true);
      const result = await runtime.cwlBotService.setSignupChannel(guildId, channel.id);
      if (result.isErr()) {
        throw result.error;
      }

      await interaction.editReply(`Signup channel set to <#${result.value}>.`);
      return;
    }

    if (group === "timezone" && subcommand === "set") {
      const tz = interaction.options.getString("tz", true);
      const result = await runtime.cwlBotService.setTimezone(guildId, tz);
      if (result.isErr()) {
        throw result.error;
      }

      await interaction.editReply(`Timezone set to **${result.value}**.`);
      return;
    }

    if (group === "schedule" && subcommand === "set") {
      const hours = interaction.options.getInteger("hours", true);
      const result = await runtime.cwlBotService.setSyncSchedule(guildId, hours);
      if (result.isErr()) {
        throw result.error;
      }

      await interaction.editReply(`Scheduled sync interval set to **${result.value}h**.`);
      return;
    }

    if (group === "scoring" && subcommand === "set") {
      const weightPatch = compactObject({
        thWeight: interaction.options.getNumber("th", false) ?? undefined,
        heroWeight: interaction.options.getNumber("heroes", false) ?? undefined,
        warWeight: interaction.options.getNumber("war", false) ?? undefined,
        cwlWeight: interaction.options.getNumber("cwl", false) ?? undefined,
        missedPenalty: interaction.options.getNumber("missed_penalty", false) ?? undefined,
        competitiveBonus: interaction.options.getNumber("competitive_bonus", false) ?? undefined,
        availabilityBonus: interaction.options.getNumber("availability_bonus", false) ?? undefined
      });
      const result = await runtime.cwlBotService.setScoring(
        guildId,
        weightPatch as Partial<{
          thWeight: number;
          heroWeight: number;
          warWeight: number;
          cwlWeight: number;
          missedPenalty: number;
          competitiveBonus: number;
          availabilityBonus: number;
        }>
      );
      if (result.isErr()) {
        throw result.error;
      }

      const appliedWeights = result.value.weights;
      await interaction.editReply(
        `Scoring updated:\n` +
          toStringList([
            `TH: ${appliedWeights.thWeight.toFixed(3)}`,
            `Heroes: ${appliedWeights.heroWeight.toFixed(3)}`,
            `War: ${appliedWeights.warWeight.toFixed(3)}`,
            `CWL: ${appliedWeights.cwlWeight.toFixed(3)}`,
            `Missed penalty: ${appliedWeights.missedPenalty.toFixed(3)}`,
            `Competitive bonus: ${appliedWeights.competitiveBonus.toFixed(3)}`,
            `Availability bonus: ${appliedWeights.availabilityBonus.toFixed(3)}`
          ])
      );
      return;
    }

    if (group === "questions" && subcommand === "list") {
      const result = await runtime.cwlBotService.listQuestions(guildId);
      if (result.isErr()) {
        throw result.error;
      }

      const lines = result.value.map(
        (question) => `${question.index}. ${question.prompt} -> ${question.options.join(", ")}`
      );
      await interaction.editReply(["```txt", ...lines, "```"].join("\n"));
      return;
    }

    if (group === "questions" && subcommand === "edit") {
      const index = interaction.options.getInteger("index", true);
      const prompt = interaction.options.getString("prompt", true);
      const options = interaction.options.getString("options", true);
      const result = await runtime.cwlBotService.editQuestion(guildId, index, prompt, options);
      if (result.isErr()) {
        throw result.error;
      }

      await interaction.editReply(
        `Updated question ${result.value.index}: **${result.value.prompt}** -> ${result.value.options.join(", ")}`
      );
      return;
    }

    if (group === "questions" && subcommand === "reset-defaults") {
      const result = await runtime.cwlBotService.resetQuestions(guildId);
      if (result.isErr()) {
        throw result.error;
      }

      await interaction.editReply(`Reset ${result.value.length} questions to defaults.`);
      return;
    }

    if (group === "template" && subcommand === "init") {
      const season = interaction.options.getString("season", false) ?? undefined;
      const result = await runtime.cwlBotService.initTemplate(guildId, season);
      if (result.isErr()) {
        throw result.error;
      }

      await interaction.editReply(`Template initialized for **${result.value}**.`);
      return;
    }

    if (group === "template" && subcommand === "refresh-format") {
      const season = interaction.options.getString("season", false) ?? undefined;
      const result = await runtime.cwlBotService.refreshTemplate(guildId, season);
      if (result.isErr()) {
        throw result.error;
      }

      await interaction.editReply(`Template formatting refreshed for **${result.value}**.`);
      return;
    }

    throw new AppError("COMMAND_NOT_IMPLEMENTED", "That config command combination is not implemented.");
  }
};
