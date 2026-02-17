import mysql from "mysql2/promise";
import { drizzle } from "drizzle-orm/mysql2";

import { loadEnv } from "@/config/env.js";
import { schema } from "@/infra/db/schema/tables.js";

export function createDbClient() {
  const env = loadEnv();
  const pool = mysql.createPool({
    uri: env.DATABASE_URL,
    connectionLimit: 10,
    dateStrings: false,
    decimalNumbers: true,
    supportBigNumbers: true
  });

  const db = drizzle(pool, { schema, mode: "default" });
  return { db, pool };
}

export type DbClient = ReturnType<typeof createDbClient>;
