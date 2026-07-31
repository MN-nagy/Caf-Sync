import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema.ts";
import "dotenv/config";

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL!,
});

pool.on("error", (err) => {
  console.error("Unexpected DB pool error:", err);
});

export const db = drizzle(pool, { schema });
