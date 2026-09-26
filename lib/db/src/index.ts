import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import * as schema from "./schema";

export function getDb(databaseUrl: string) {
  if (!databaseUrl) {
    throw new Error(
      "DATABASE_URL must be set. Did you forget to provision a database?",
    );
  }
  const sql = neon(databaseUrl);
  return drizzle(sql, { schema });
}

export * from "./schema";
