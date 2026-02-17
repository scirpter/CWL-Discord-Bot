import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  ModalBuilder,
  StringSelectMenuBuilder,
  TextInputBuilder,
  TextInputStyle
} from "discord.js";

export const SIGNUP_CUSTOM_IDS = {
  start: "cwl_signup:start",
  cancel: "cwl_signup:cancel",
  addNote: "cwl_signup:add-note",
  submit: "cwl_signup:submit",
  noteModal: "cwl_signup:note-modal",
  noteInput: "note"
} as const;

export function answerCustomId(questionIndex: number): string {
  return `cwl_signup:answer:${questionIndex}`;
}

export function parseAnswerCustomId(customId: string): number | null {
  const match = customId.match(/^cwl_signup:answer:(\d+)$/);
  return match ? Number(match[1]) : null;
}

export function buildSignupPanel() {
  const embed = new EmbedBuilder()
    .setTitle("CWL Signup")
    .setDescription(
      "Click **Sign Up** to complete this month's CWL signup wizard.\n\nYou can edit your signup any time until leaders lock it."
    )
    .setColor(0x4f46e5);

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(SIGNUP_CUSTOM_IDS.start)
      .setLabel("Sign Up")
      .setStyle(ButtonStyle.Primary)
  );

  return {
    embeds: [embed],
    components: [row]
  };
}

export function buildQuestionStep(params: {
  prompt: string;
  questionIndex: number;
  options: string[];
  answered: number;
  total: number;
}) {
  const select = new StringSelectMenuBuilder()
    .setCustomId(answerCustomId(params.questionIndex))
    .setPlaceholder("Choose one option")
    .addOptions(
      params.options.map((option) => ({
        label: option.slice(0, 100),
        value: option.slice(0, 100)
      }))
    );

  const selectRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select);
  const buttonRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(SIGNUP_CUSTOM_IDS.cancel)
      .setLabel("Cancel")
      .setStyle(ButtonStyle.Secondary)
  );

  return {
    content: `**Question ${params.questionIndex}/${params.total}**\n${params.prompt}\nProgress: ${params.answered}/${params.total}`,
    components: [selectRow, buttonRow]
  };
}

export function buildNoteStep() {
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(SIGNUP_CUSTOM_IDS.addNote)
      .setLabel("Add Note")
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(SIGNUP_CUSTOM_IDS.submit)
      .setLabel("Submit Without Note")
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(SIGNUP_CUSTOM_IDS.cancel)
      .setLabel("Cancel")
      .setStyle(ButtonStyle.Secondary)
  );

  return {
    content: "All questions answered. Add an optional note or submit now.",
    components: [row]
  };
}

export function buildNoteModal() {
  const textInput = new TextInputBuilder()
    .setCustomId(SIGNUP_CUSTOM_IDS.noteInput)
    .setLabel("Optional note")
    .setStyle(TextInputStyle.Paragraph)
    .setPlaceholder("Example: Can only play first 4 wars this month.")
    .setRequired(false)
    .setMaxLength(240);

  return new ModalBuilder()
    .setCustomId(SIGNUP_CUSTOM_IDS.noteModal)
    .setTitle("CWL Signup Note")
    .addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(textInput));
}
