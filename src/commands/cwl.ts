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
  .setName("cwl")
  .setDescription("Manage CWL signups, sync, and rosters.")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .addSubcommandGroup((group) =>
    group
      .setName("signup-panel")
      .setDescription("Signup panel commands.")
      .addSubcommand((subcommand) =>
        subcommand.setName("post").setDescription("Post a signup panel in the configured channel.")
      )
  )
  .addSubcommandGroup((group) =>
    group
      .setName("signup")
      .setDescription("Signup state commands.")
      .addSubcommand((subcommand) => subcommand.setName("open").setDescription("Open CWL signups."))
      .addSubcommand((subcommand) => subcommand.setName("lock").setDescription("Lock CWL signups."))
      .addSubcommand((subcommand) =>
        subcommand.setName("unlock").setDescription("Unlock CWL signups.")
      )
      .addSubcommand((subcommand) =>
        subcommand.setName("status").setDescription("Show current signup lock status.")
      )
  )
  .addSubcommandGroup((group) =>
    group
      .setName("sync")
      .setDescription("Sync commands.")
      .addSubcommand((subcommand) =>
        subcommand
          .setName("now")
          .setDescription("Run an immediate CWL sync.")
          .addStringOption((option) =>
            option
              .setName("season")
              .setDescription("Optional season key, e.g. 2026-02")
              .setRequired(false)
          )
          .addStringOption((option) =>
            option.setName("clan").setDescription("Optional clan tag filter").setRequired(false)
          )
      )
  )
  .addSubcommandGroup((group) =>
    group
      .setName("roster")
      .setDescription("Roster commands.")
      .addSubcommand((subcommand) =>
        subcommand
          .setName("create")
          .setDescription("Create a roster block.")
          .addStringOption((option) =>
            option.setName("name").setDescription("Roster name (e.g. Champ 2A)").setRequired(true)
          )
          .addIntegerOption((option) =>
            option
              .setName("size")
              .setDescription("Roster size")
              .setRequired(true)
              .addChoices({ name: "15v15", value: 15 }, { name: "30v30", value: 30 })
          )
          .addStringOption((option) =>
            option.setName("clan").setDescription("Clan tag for this roster").setRequired(true)
          )
      )
      .addSubcommand((subcommand) =>
        subcommand
          .setName("assign")
          .setDescription("Assign a player to roster.")
          .addStringOption((option) =>
            option.setName("roster").setDescription("Roster name").setRequired(true)
          )
          .addStringOption((option) =>
            option
              .setName("player")
              .setDescription("Player tag or @mention with linked account")
              .setRequired(true)
          )
      )
      .addSubcommand((subcommand) =>
        subcommand
          .setName("unassign")
          .setDescription("Remove player from roster.")
          .addStringOption((option) =>
            option.setName("roster").setDescription("Roster name").setRequired(true)
          )
          .addStringOption((option) =>
            option.setName("player").setDescription("Player tag").setRequired(true)
          )
      )
      .addSubcommand((subcommand) =>
        subcommand
          .setName("suggest")
          .setDescription("Show suggested roster ordering.")
          .addStringOption((option) =>
            option
              .setName("roster")
              .setDescription("Optional roster name to limit output")
              .setRequired(false)
          )
      )
      .addSubcommand((subcommand) =>
        subcommand
          .setName("export")
          .setDescription("Export roster list in copy/paste format.")
          .addStringOption((option) =>
            option
              .setName("roster")
              .setDescription("Optional roster name to export only one")
              .setRequired(false)
          )
      )
  );

function parseMentionId(input: string): string | null {
  const match = input.trim().match(/^<@!?(\d+)>$/);
  return match?.[1] ?? null;
}

function formatRatio(value: number | null): string {
  return value === null ? "N/A" : value.toFixed(2);
}

async function resolvePlayerTag(input: string, guildId: string, runtime: BotRuntime): Promise<string> {
  const mentionId = parseMentionId(input);
  if (!mentionId) {
    return normalizeClanTag(input);
  }

  const linked = await runtime.cwlBotService.getRegisteredPlayer(guildId, mentionId);
  if (linked.isErr()) {
    throw linked.error;
  }

  if (!linked.value) {
    throw new AppError(
      "PLAYER_NOT_LINKED",
      "That user does not have a linked player. Ask them to run `/player register` first."
    );
  }

  return normalizeClanTag(linked.value.playerTag);
}

export const cwlCommand: CommandModule = {
  data,
  async execute(interaction, runtime) {
    await deferEphemeral(interaction);
    requireManageGuildPermission(interaction);
    const guildId = requireGuild(interaction);

    const group = interaction.options.getSubcommandGroup(true);
    const subcommand = interaction.options.getSubcommand(true);

    if (group === "signup-panel" && subcommand === "post") {
      await runtime.signupInteractionHandler.postSignupPanel(interaction);
      return;
    }

    if (group === "signup" && subcommand === "open") {
      const result = await runtime.cwlBotService.openSignups(guildId);
      if (result.isErr()) {
        throw result.error;
      }

      await interaction.editReply(`Signups opened for **${result.value}**.`);
      return;
    }

    if (group === "signup" && subcommand === "lock") {
      const result = await runtime.cwlBotService.lockSignups(guildId);
      if (result.isErr()) {
        throw result.error;
      }

      await interaction.editReply(`Signups locked for **${result.value}**.`);
      return;
    }

    if (group === "signup" && subcommand === "unlock") {
      const result = await runtime.cwlBotService.unlockSignups(guildId);
      if (result.isErr()) {
        throw result.error;
      }

      await interaction.editReply(`Signups unlocked for **${result.value}**.`);
      return;
    }

    if (group === "signup" && subcommand === "status") {
      const result = await runtime.cwlBotService.signupStatus(guildId);
      if (result.isErr()) {
        throw result.error;
      }

      await interaction.editReply(
        `Season: **${result.value.season}**\nSignups: **${result.value.locked ? "Locked" : "Open"}**`
      );
      return;
    }

    if (group === "sync" && subcommand === "now") {
      const season = interaction.options.getString("season", false) ?? undefined;
      const clan = interaction.options.getString("clan", false) ?? undefined;
      const syncOptions: { seasonKey?: string; clanTag?: string } = {};
      if (season) {
        syncOptions.seasonKey = season;
      }
      if (clan) {
        syncOptions.clanTag = clan;
      }

      const result = await runtime.cwlBotService.runSyncNow(guildId, {
        ...syncOptions
      });
      if (result.isErr()) {
        throw result.error;
      }

      await interaction.editReply(
        `Sync complete. Players: **${result.value.syncedPlayers}**, wars: **${result.value.syncedWars}**.`
      );
      return;
    }

    if (group === "roster" && subcommand === "create") {
      const name = interaction.options.getString("name", true);
      const size = interaction.options.getInteger("size", true);
      const clan = interaction.options.getString("clan", true);
      const result = await runtime.cwlBotService.createRoster(guildId, clan, name, size);
      if (result.isErr()) {
        throw result.error;
      }

      await interaction.editReply(
        `Created roster **${result.value.rosterName}** (${result.value.rosterSize}v${result.value.rosterSize}) for \`${result.value.clanTag}\`.`
      );
      return;
    }

    if (group === "roster" && subcommand === "assign") {
      const rosterName = interaction.options.getString("roster", true);
      const playerInput = interaction.options.getString("player", true);
      const playerTag = await resolvePlayerTag(playerInput, guildId, runtime);
      const result = await runtime.cwlBotService.assignRosterMember({
        guildId,
        rosterName,
        playerTag,
        assignedByUserId: interaction.user.id
      });
      if (result.isErr()) {
        throw result.error;
      }

      await interaction.editReply(`Assigned \`${result.value}\` to **${rosterName}**.`);
      return;
    }

    if (group === "roster" && subcommand === "unassign") {
      const rosterName = interaction.options.getString("roster", true);
      const playerTag = normalizeClanTag(interaction.options.getString("player", true));
      const result = await runtime.cwlBotService.unassignRosterMember(guildId, rosterName, playerTag);
      if (result.isErr()) {
        throw result.error;
      }

      await interaction.editReply(
        result.value
          ? `Removed \`${playerTag}\` from **${rosterName}**.`
          : `No assignment found for \`${playerTag}\` in **${rosterName}**.`
      );
      return;
    }

    if (group === "roster" && subcommand === "suggest") {
      const rosterName = interaction.options.getString("roster", false) ?? undefined;
      const result = await runtime.cwlBotService.suggestRoster(guildId, rosterName);
      if (result.isErr()) {
        throw result.error;
      }

      if (result.value.length === 0) {
        await interaction.editReply("No signup data available for suggestions.");
        return;
      }

      const lines = result.value.slice(0, 50).map((entry, index) => {
        return `${index + 1}. ${entry.playerName} (${entry.playerTag}) | TH${entry.townHall} | score ${entry.score.toFixed(3)} | war ${formatRatio(entry.warHitrate)} | cwl ${formatRatio(entry.cwlHitrate)}`;
      });
      await interaction.editReply(["```txt", ...lines, "```"].join("\n"));
      return;
    }

    if (group === "roster" && subcommand === "export") {
      const rosterName = interaction.options.getString("roster", false) ?? undefined;
      const result = await runtime.cwlBotService.exportRoster(guildId, rosterName);
      if (result.isErr()) {
        throw result.error;
      }

      await interaction.editReply(result.value);
      return;
    }

    throw new AppError("COMMAND_NOT_IMPLEMENTED", "That CWL command combination is not implemented.");
  }
};
