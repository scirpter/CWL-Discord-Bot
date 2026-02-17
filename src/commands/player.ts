import { SlashCommandBuilder } from "discord.js";

import { AppError } from "@/domain/errors.js";
import type { CommandModule } from "@/infra/discord/command-module.js";
import { deferEphemeral, requireGuild } from "@/infra/discord/command-utils.js";
import type { BotRuntime } from "@/infra/discord/runtime.js";

const data = new SlashCommandBuilder()
  .setName("player")
  .setDescription("Manage your linked Clash of Clans player.")
  .addSubcommand((subcommand) =>
    subcommand
      .setName("register")
      .setDescription("Register your primary Clash of Clans player tag.")
      .addStringOption((option) =>
        option
          .setName("tag")
          .setDescription("Your player tag (e.g. #ABC123)")
          .setRequired(true)
      )
  )
  .addSubcommand((subcommand) =>
    subcommand.setName("me").setDescription("Show your currently linked player tag.")
  );

async function executeRegister(interaction: Parameters<CommandModule["execute"]>[0], runtime: BotRuntime) {
  const guildId = requireGuild(interaction);
  const tag = interaction.options.getString("tag", true);
  const userId = interaction.user.id;

  const result = await runtime.cwlBotService.registerPlayer(guildId, userId, tag);
  if (result.isErr()) {
    throw result.error;
  }

  await interaction.editReply(
    `Linked ${result.value.playerName} to <@${userId}> as \`${result.value.link.playerTag}\`.`
  );
}

async function executeMe(interaction: Parameters<CommandModule["execute"]>[0], runtime: BotRuntime) {
  const guildId = requireGuild(interaction);
  const userId = interaction.user.id;

  const result = await runtime.cwlBotService.getRegisteredPlayer(guildId, userId);
  if (result.isErr()) {
    throw result.error;
  }

  const link = result.value;
  if (!link) {
    throw new AppError(
      "PLAYER_NOT_LINKED",
      "No linked player found. Register one with `/player register tag:<#TAG>`."
    );
  }

  await interaction.editReply(
    `Linked player: \`${link.playerTag}\`${link.playerName ? ` (${link.playerName})` : ""}`
  );
}

export const playerCommand: CommandModule = {
  data,
  async execute(interaction, runtime) {
    await deferEphemeral(interaction);

    const subcommand = interaction.options.getSubcommand(true);
    switch (subcommand) {
      case "register":
        await executeRegister(interaction, runtime);
        return;
      case "me":
        await executeMe(interaction, runtime);
        return;
      default:
        throw new AppError("COMMAND_NOT_IMPLEMENTED", "That subcommand is not implemented.");
    }
  }
};
