import { readFile } from "node:fs/promises";
import { createPool } from "../src/lib/english/database.ts";
if (!process.env.DATABASE_URL)
  throw new Error("Configure DATABASE_URL before running the migration.");
const pool = createPool(process.env.DATABASE_URL);
let client;
try {
  client = await pool.connect();
  await client.query("BEGIN");
  await client.query(
    await readFile(new URL("./english-schema.sql", import.meta.url), "utf8"),
  );
  await client.query("COMMIT");
  console.log("English learning schema is ready.");
} catch (error) {
  if (client) await client.query("ROLLBACK");
  throw error;
} finally {
  client?.release();
  await pool.end();
}
