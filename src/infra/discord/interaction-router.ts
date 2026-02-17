import {
  MessageFlags,
  type Client,
  type Interaction,
  type InteractionReplyOptions
} from "discord.js";

import type { CommandModule } from "@/infra/discord/command-module.js";
import type { BotRuntime } from "@/infra/discord/runtime.js";
import { AppError } from "@/domain/errors.js";

function toPublicErrorMessage(error: unknown): string {
  if (error instanceof AppError) {
    return error.publicMessage;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Unexpected interaction error.";
}

async function replyEphemeral(interaction: Interaction, content: string): Promise<void> {
  const payload: InteractionReplyOptions = {
    content,
    flags: MessageFlags.Ephemeral
  };

  if (interaction.isRepliable()) {
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply({ content }).catch(() => undefined);
      return;
    }

    await interaction.reply(payload).catch(() => undefined);
  }
}

export function registerInteractionRouter(
  client: Client,
  commandModules: CommandModule[],
  runtime: BotRuntime
): void {
  const modulesByName = new Map(commandModules.map((module) => [module.data.name, module]));

  client.on("interactionCreate", (interaction) => {
    void handleInteraction(interaction, modulesByName, runtime);
  });
}

async function handleInteraction(
  interaction: Interaction,
  modulesByName: Map<string, CommandModule>,
  runtime: BotRuntime
) {
  try {
    if (interaction.isChatInputCommand()) {
      const command = modulesByName.get(interaction.commandName);
      if (!command) {
        await replyEphemeral(interaction, "Unknown command.");
        return;
      }

      await command.execute(interaction, runtime);
      return;
    }

    if (interaction.isButton() && interaction.customId.startsWith("cwl_signup:")) {
      await runtime.signupInteractionHandler.handleButton(interaction);
      return;
    }

    if (interaction.isStringSelectMenu() && interaction.customId.startsWith("cwl_signup:")) {
      await runtime.signupInteractionHandler.handleSelect(interaction);
      return;
    }

    if (interaction.isModalSubmit() && interaction.customId.startsWith("cwl_signup:")) {
      await runtime.signupInteractionHandler.handleModal(interaction);
    }
  } catch (error) {
    runtime.logger.error(
      {
        err: error,
        interactionType: interaction.type,
        interactionId: interaction.id
      },
      "Interaction handler failed."
    );
    await replyEphemeral(interaction, toPublicErrorMessage(error));
  }
}
