import { config } from "dotenv";
import { z } from "zod";

config();

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DISCORD_TOKEN: z.string().min(1),
  DISCORD_CLIENT_ID: z.string().min(1),
  DATABASE_URL: z.string().min(1),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
  COC_API_TOKEN: z.string().min(1),
  GOOGLE_SERVICE_ACCOUNT_JSON: z.string().min(1),
  GOOGLE_SHEETS_DEFAULT_SCOPES: z
    .string()
    .default("https://www.googleapis.com/auth/spreadsheets"),
  APP_TIMEZONE_FALLBACK: z.string().default("UTC")
});

export type Env = z.infer<typeof envSchema>;

let cachedEnv: Env | null = null;

function decodeServiceAccount(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.startsWith("{")) {
    return trimmed;
  }

  return Buffer.from(trimmed, "base64").toString("utf-8");
}

export function loadEnv(): Env {
  if (cachedEnv) {
    return cachedEnv;
  }

  const parsed = envSchema.parse(process.env);
  cachedEnv = {
    ...parsed,
    GOOGLE_SERVICE_ACCOUNT_JSON: decodeServiceAccount(parsed.GOOGLE_SERVICE_ACCOUNT_JSON)
  };

  return cachedEnv;
}
