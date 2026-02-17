import { MessageFlags, PermissionFlagsBits, type ChatInputCommandInteraction } from "discord.js";

import { AppError } from "@/domain/errors.js";

export function requireGuild(interaction: ChatInputCommandInteraction): string {
  if (!interaction.inGuild() || !interaction.guildId) {
    throw new AppError("GUILD_ONLY", "This command can only be used in a server.");
  }

  return interaction.guildId;
}

export function requireManageGuildPermission(interaction: ChatInputCommandInteraction): void {
  if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
    throw new AppError(
      "MISSING_PERMISSION",
      "You need the Manage Server permission to run this command."
    );
  }
}

export async function deferEphemeral(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.deferred && !interaction.replied) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  }
}
