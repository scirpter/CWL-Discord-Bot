import pino from "pino";

import type { Env } from "@/config/env.js";

export function createLogger(env: Env) {
  return pino({
    level: env.LOG_LEVEL,
    redact: {
      paths: [
        "discordToken",
        "databaseUrl",
        "cocApiToken",
        "googleServiceAccount",
        "req.headers.authorization"
      ],
      censor: "[REDACTED]"
    }
  });
}

export type Logger = ReturnType<typeof createLogger>;
