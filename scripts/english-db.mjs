import { readFile } from "node:fs/promises";
import pg from "pg";
if (!process.env.DATABASE_URL)
  throw new Error("Configure DATABASE_URL before running the migration.");
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
try {
  await client.query("BEGIN");
  await client.query(
    await readFile(new URL("./english-schema.sql", import.meta.url), "utf8"),
  );
  await client.query("COMMIT");
  console.log("English learning schema is ready.");
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  await client.end();
}
