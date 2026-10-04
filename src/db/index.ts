import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL missing (see .env.example)");

// neon-http: one HTTP round-trip per query. Right for route handlers and tools; no pool to leak.
export const db = drizzle({ client: neon(url), schema });
export { schema };
