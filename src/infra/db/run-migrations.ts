import { migrate } from "drizzle-orm/mysql2/migrator";

import { createDbClient } from "@/infra/db/client.js";

async function runMigrations() {
  const { db, pool } = createDbClient();

  try {
    await migrate(db, { migrationsFolder: "./drizzle/migrations" });
  } finally {
    await pool.end();
  }
}

void runMigrations();
