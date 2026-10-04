import "server-only";
import { Mastra } from "@mastra/core";
import { PostgresStore } from "@mastra/pg";
import { director } from "./agents/director";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL missing");

// Memory, threads and traces live in the same Neon database as the footage (mastra_* tables, auto-created).
export const mastra = new Mastra({
  agents: { director },
  storage: new PostgresStore({ id: "neon", connectionString }),
});
