import { defineConfig } from "drizzle-kit";
import * as dotenv from "dotenv";

dotenv.config();

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is missing in .env file");
}

export default defineConfig({
  schema: "./src/db/schema.ts", // schema palce
  out: "./src/db/migrations", // SQL history
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
});
