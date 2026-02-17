import type { Config } from "drizzle-kit";

export default {
  schema: "./src/infra/db/schema/*.ts",
  out: "./drizzle/migrations",
  dialect: "mysql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? ""
  },
  strict: true,
  verbose: true
} satisfies Config;
