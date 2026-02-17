import { okAsync } from "neverthrow";
import { describe, expect, it, vi } from "vitest";

import type { CwlSignup } from "@/domain/models/entities.js";
import type { Logger } from "@/infra/logger.js";
import { SignupFlowService } from "@/services/signup-flow-service.js";

const questions = [
  { index: 1, prompt: "Availability this CWL?", options: ["Yes all wars", "Partial", "No"] },
  {
    index: 2,
    prompt: "Competitiveness preference?",
    options: ["Competitive", "Relaxed", "Either"]
  },
  { index: 3, prompt: "Roster size preference?", options: ["15v15", "30v30", "Either"] },
  { index: 4, prompt: "Hero readiness?", options: ["Ready", "Almost ready", "Not ready"] },
  { index: 5, prompt: "Preferred clan/tier?", options: ["Any", "Champ 2A"] }
];

function createSignupFixture(): CwlSignup {
  return {
    id: "signup",
    guildId: "guild",
    seasonId: "season",
    discordUserId: "user",
    playerTag: "#ABC123",
    note: "optional",
    status: "active",
    submittedAt: new Date(),
    updatedAt: new Date(),
    answers: []
  };
}

function createLoggerMock(): Logger {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    trace: vi.fn(),
    fatal: vi.fn(),
    level: "info"
  } as unknown as Logger;
}

describe("SignupFlowService", () => {
  it("runs flow and submits answers", async () => {
    const submitMock = vi.fn().mockReturnValue(okAsync(createSignupFixture()));
    const service = {
      getSignupQuestionsWithDynamicOptions: vi.fn().mockReturnValue(okAsync(questions)),
      submitSignup: submitMock
    };

    const flow = new SignupFlowService(service as never, createLoggerMock());
    const guildId = "guild";
    const userId = "user";

    const first = await flow.begin(guildId, userId);
    expect(first.kind).toBe("question");
    expect(first.question.index).toBe(1);

    await flow.answer(guildId, userId, 1, "Yes all wars");
    await flow.answer(guildId, userId, 2, "Competitive");
    await flow.answer(guildId, userId, 3, "15v15");
    await flow.answer(guildId, userId, 4, "Ready");
    const finalQuestion = await flow.answer(guildId, userId, 5, "Any");
    expect(finalQuestion.kind).toBe("needs-note");

    await flow.submitWithoutNote(guildId, userId);
    expect(submitMock).toHaveBeenCalledTimes(1);
    const firstCall = submitMock.mock.calls[0];
    expect(firstCall?.[2]?.answers).toHaveLength(5);
  });
});
