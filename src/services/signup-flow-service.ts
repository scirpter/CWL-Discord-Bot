import type { CwlSignup, SignupAnswer } from "@/domain/models/entities.js";
import { AppError } from "@/domain/errors.js";
import type { Logger } from "@/infra/logger.js";
import type { CwlBotService } from "@/services/cwl-bot-service.js";

type SignupQuestion = {
  index: number;
  prompt: string;
  options: string[];
};

type Draft = {
  guildId: string;
  userId: string;
  createdAt: Date;
  questions: SignupQuestion[];
  answers: Map<number, string>;
};

export type FlowPrompt = {
  kind: "question";
  question: SignupQuestion;
  answered: number;
  total: number;
};

export type FlowNeedsNote = {
  kind: "needs-note";
};

export class SignupFlowService {
  private readonly drafts = new Map<string, Draft>();
  private readonly ttlMs = 10 * 60 * 1000;

  public constructor(
    private readonly cwlBotService: CwlBotService,
    private readonly logger: Logger
  ) {}

  public async begin(guildId: string, userId: string): Promise<FlowPrompt> {
    const questionsResult = await this.cwlBotService.getSignupQuestionsWithDynamicOptions(guildId);
    if (questionsResult.isErr()) {
      throw new AppError("FLOW_INIT_FAILED", "Unable to load signup questions.");
    }

    const questions = questionsResult.value;

    if (questions.length < 5) {
      throw new AppError("QUESTIONS_INCOMPLETE", "Signup questions are not configured correctly.");
    }

    const draft: Draft = {
      guildId,
      userId,
      createdAt: new Date(),
      questions,
      answers: new Map()
    };

    this.drafts.set(this.key(guildId, userId), draft);
    const firstQuestion = questions[0];
    if (!firstQuestion) {
      throw new AppError("QUESTIONS_INCOMPLETE", "No signup questions are configured.");
    }

    return {
      kind: "question",
      question: firstQuestion,
      answered: 0,
      total: questions.length
    };
  }

  public async answer(
    guildId: string,
    userId: string,
    questionIndex: number,
    answerValue: string
  ): Promise<FlowPrompt | FlowNeedsNote> {
    const draft = this.getDraft(guildId, userId);
    const question = draft.questions.find((entry) => entry.index === questionIndex);
    if (!question) {
      throw new AppError("QUESTION_NOT_FOUND", "Question could not be found in the signup flow.");
    }

    if (!question.options.includes(answerValue)) {
      throw new AppError("INVALID_ANSWER", "Selected answer is not valid for this question.");
    }

    draft.answers.set(questionIndex, answerValue);
    draft.createdAt = new Date();

    const nextQuestion = draft.questions.find((entry) => !draft.answers.has(entry.index));
    if (!nextQuestion) {
      return {
        kind: "needs-note"
      };
    }

    return {
      kind: "question",
      question: nextQuestion,
      answered: draft.answers.size,
      total: draft.questions.length
    };
  }

  public async submitWithoutNote(guildId: string, userId: string): Promise<CwlSignup> {
    return this.submit(guildId, userId, null);
  }

  public async submitWithNote(guildId: string, userId: string, note: string | null): Promise<CwlSignup> {
    return this.submit(guildId, userId, note);
  }

  public cancel(guildId: string, userId: string): void {
    this.drafts.delete(this.key(guildId, userId));
  }

  private async submit(guildId: string, userId: string, note: string | null): Promise<CwlSignup> {
    const draft = this.getDraft(guildId, userId);
    const missing = draft.questions.find((question) => !draft.answers.has(question.index));
    if (missing) {
      throw new AppError(
        "INCOMPLETE_FLOW",
        `Please complete question ${missing.index} before submitting your signup.`
      );
    }

    const answers: SignupAnswer[] = [...draft.answers.entries()]
      .map(([questionIndex, answerValue]) => ({
        questionIndex,
        answerValue
      }))
      .sort((left, right) => left.questionIndex - right.questionIndex);

    const submitResult = await this.cwlBotService.submitSignup(guildId, userId, {
      answers,
      note
    });
    if (submitResult.isErr()) {
      throw new AppError("SIGNUP_SUBMIT_FAILED", "Signup submission failed.");
    }

    this.drafts.delete(this.key(guildId, userId));
    return submitResult.value;
  }

  private getDraft(guildId: string, userId: string): Draft {
    const key = this.key(guildId, userId);
    const draft = this.drafts.get(key);
    if (!draft) {
      throw new AppError(
        "FLOW_NOT_FOUND",
        "Signup session expired or not found. Click the signup button again."
      );
    }

    if (Date.now() - draft.createdAt.getTime() > this.ttlMs) {
      this.drafts.delete(key);
      this.logger.info({ guildId, userId }, "Signup flow expired.");
      throw new AppError(
        "FLOW_EXPIRED",
        "Signup session expired. Click the signup button again."
      );
    }

    return draft;
  }

  private key(guildId: string, userId: string): string {
    return `${guildId}:${userId}`;
  }
}
