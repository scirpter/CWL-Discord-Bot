import {
  ChannelType,
  MessageFlags,
  PermissionFlagsBits,
  type ButtonInteraction,
  type ChatInputCommandInteraction,
  type ModalSubmitInteraction,
  type StringSelectMenuInteraction
} from "discord.js";

import { AppError } from "@/domain/errors.js";
import type { Logger } from "@/infra/logger.js";
import type { CwlBotService } from "@/services/cwl-bot-service.js";
import type { SignupFlowService } from "@/services/signup-flow-service.js";
import {
  SIGNUP_CUSTOM_IDS,
  buildNoteModal,
  buildNoteStep,
  buildQuestionStep,
  buildSignupPanel,
  parseAnswerCustomId
} from "@/ui/signup-ui.js";

type SignupInteractionHandlerOptions = {
  cwlBotService: CwlBotService;
  signupFlowService: SignupFlowService;
  logger: Logger;
};

export class SignupInteractionHandler {
  private readonly cwlBotService: CwlBotService;
  private readonly signupFlowService: SignupFlowService;
  private readonly logger: Logger;

  public constructor(options: SignupInteractionHandlerOptions) {
    this.cwlBotService = options.cwlBotService;
    this.signupFlowService = options.signupFlowService;
    this.logger = options.logger;
  }

  public async postSignupPanel(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.inGuild() || !interaction.guildId || !interaction.guild) {
      throw new AppError("GUILD_ONLY", "This command can only be used in a server.");
    }

    const guildResult = await this.cwlBotService.getGuildSettings(interaction.guildId);
    if (guildResult.isErr()) {
      throw guildResult.error;
    }

    const channelId = guildResult.value.signupChannelId;
    if (!channelId) {
      throw new AppError(
        "SIGNUP_CHANNEL_MISSING",
        "Signup channel is not configured. Use `/config signup-channel set` first."
      );
    }

    const targetChannel = await interaction.guild.channels.fetch(channelId);
    if (!targetChannel || !targetChannel.isTextBased()) {
      throw new AppError("SIGNUP_CHANNEL_INVALID", "Configured signup channel is not available.");
    }

    if (targetChannel.type === ChannelType.GuildVoice || targetChannel.type === ChannelType.GuildStageVoice) {
      throw new AppError("SIGNUP_CHANNEL_INVALID", "Signup channel must be a text channel.");
    }

    const botMember = interaction.guild.members.me;
    const permissions = botMember?.permissionsIn(targetChannel);
    if (
      !permissions?.has(PermissionFlagsBits.ViewChannel) ||
      !permissions.has(PermissionFlagsBits.SendMessages)
    ) {
      throw new AppError(
        "BOT_PERMISSION_MISSING",
        "Bot is missing View Channel or Send Messages permission in the signup channel."
      );
    }

    await targetChannel.send(buildSignupPanel());
    await interaction.editReply(`Signup panel posted in <#${targetChannel.id}>.`);
  }

  public async handleButton(interaction: ButtonInteraction): Promise<void> {
    if (!interaction.inGuild() || !interaction.guildId) {
      await this.safeReply(interaction, "This interaction can only be used in a server.");
      return;
    }

    try {
      if (interaction.customId === SIGNUP_CUSTOM_IDS.start) {
        const step = await this.signupFlowService.begin(interaction.guildId, interaction.user.id);
        await interaction.reply({
          ...buildQuestionStep({
            prompt: step.question.prompt,
            questionIndex: step.question.index,
            options: step.question.options,
            answered: step.answered,
            total: step.total
          }),
          flags: MessageFlags.Ephemeral
        });
        return;
      }

      if (interaction.customId === SIGNUP_CUSTOM_IDS.cancel) {
        this.signupFlowService.cancel(interaction.guildId, interaction.user.id);
        await interaction.update({
          content: "Signup flow canceled.",
          components: []
        });
        return;
      }

      if (interaction.customId === SIGNUP_CUSTOM_IDS.addNote) {
        await interaction.showModal(buildNoteModal());
        return;
      }

      if (interaction.customId === SIGNUP_CUSTOM_IDS.submit) {
        await this.signupFlowService.submitWithoutNote(interaction.guildId, interaction.user.id);
        await interaction.update({
          content: "Signup submitted successfully.",
          components: []
        });
        return;
      }
    } catch (error) {
      this.logger.warn({ err: error }, "Signup button interaction failed.");
      await this.safeReply(interaction, this.toMessage(error));
    }
  }

  public async handleSelect(interaction: StringSelectMenuInteraction): Promise<void> {
    if (!interaction.inGuild() || !interaction.guildId) {
      await this.safeReply(interaction, "This interaction can only be used in a server.");
      return;
    }

    const questionIndex = parseAnswerCustomId(interaction.customId);
    if (!questionIndex) {
      return;
    }

    try {
      const selectedValue = interaction.values[0];
      if (!selectedValue) {
        throw new AppError("INVALID_ANSWER", "Please choose one option.");
      }

      const next = await this.signupFlowService.answer(
        interaction.guildId,
        interaction.user.id,
        questionIndex,
        selectedValue
      );

      if (next.kind === "needs-note") {
        await interaction.update(buildNoteStep());
        return;
      }

      await interaction.update(
        buildQuestionStep({
          prompt: next.question.prompt,
          questionIndex: next.question.index,
          options: next.question.options,
          answered: next.answered,
          total: next.total
        })
      );
    } catch (error) {
      this.logger.warn({ err: error }, "Signup select interaction failed.");
      await this.safeReply(interaction, this.toMessage(error));
    }
  }

  public async handleModal(interaction: ModalSubmitInteraction): Promise<void> {
    if (!interaction.inGuild() || !interaction.guildId) {
      await this.safeReply(interaction, "This interaction can only be used in a server.");
      return;
    }

    if (interaction.customId !== SIGNUP_CUSTOM_IDS.noteModal) {
      return;
    }

    try {
      const note = interaction.fields.getTextInputValue(SIGNUP_CUSTOM_IDS.noteInput);
      await this.signupFlowService.submitWithNote(interaction.guildId, interaction.user.id, note || null);
      await interaction.reply({
        content: "Signup submitted successfully.",
        flags: MessageFlags.Ephemeral
      });
    } catch (error) {
      this.logger.warn({ err: error }, "Signup modal interaction failed.");
      await this.safeReply(interaction, this.toMessage(error));
    }
  }

  private toMessage(error: unknown): string {
    if (error instanceof AppError) {
      return error.publicMessage;
    }

    if (error instanceof Error) {
      return error.message;
    }

    return "Unexpected interaction error.";
  }

  private async safeReply(
    interaction: ButtonInteraction | StringSelectMenuInteraction | ModalSubmitInteraction,
    content: string
  ): Promise<void> {
    if (interaction.deferred || interaction.replied) {
      if ("editReply" in interaction) {
        await interaction.editReply({ content, components: [] }).catch(() => undefined);
      }
      return;
    }

    await interaction.reply({ content, flags: MessageFlags.Ephemeral }).catch(() => undefined);
  }
}
