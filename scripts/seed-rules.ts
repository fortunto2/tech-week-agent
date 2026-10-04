// Seed the owner's editing rules once. Re-running adds only rules whose text is not there yet.

import { db, schema } from "../src/db";
import { RULES_SEED } from "../src/lib/rules-seed";

async function main() {
  const existing = new Set((await db.select({ text: schema.rules.text }).from(schema.rules)).map((r) => r.text));
  const fresh = RULES_SEED.filter((r) => !existing.has(r.text));
  if (fresh.length) await db.insert(schema.rules).values(fresh);
  console.log(`COVERAGE rules total=${existing.size + fresh.length} added=${fresh.length}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
