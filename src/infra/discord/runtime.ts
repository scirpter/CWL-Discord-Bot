import type { Logger } from "@/infra/logger.js";
import type { CwlBotService } from "@/services/cwl-bot-service.js";
import type { SignupFlowService } from "@/services/signup-flow-service.js";
import type { SignupInteractionHandler } from "@/infra/discord/signup-interaction-handler.js";

export type BotRuntime = {
  logger: Logger;
  cwlBotService: CwlBotService;
  signupFlowService: SignupFlowService;
  signupInteractionHandler: SignupInteractionHandler;
};
