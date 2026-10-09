// Integration checks against a running local Astro server and a dedicated Postgres database.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import pg from "pg";

const base = process.env.ENGLISH_TEST_URL ?? "http://127.0.0.1:4321";
const dbUrl = new URL(process.env.DATABASE_URL);
if (
  !["localhost", "127.0.0.1"].includes(dbUrl.hostname) ||
  dbUrl.pathname !== "/english_dev"
) {
  throw new Error("Tests require the dedicated local english_dev database.");
}
const database = new pg.Client({ connectionString: process.env.DATABASE_URL });
await database.connect();
const fixtureIds = ["W497", "W498", "W499", "W500"];
const operationIds = [];
const op = () => {
  const id = randomUUID();
  operationIds.push(id);
  return id;
};
const progress = (wordId) => ({
  wordId,
  status: "new",
  priority: "medium",
  plannedDate: "",
  dueDate: "",
  note: "",
  version: 0,
});
let checks = 0;
let ownFixtures = false;
async function request(
  path,
  { method = "GET", body, cookie, origin = base, expect = 200 } = {},
) {
  const response = await fetch(`${base}/api/english/${path}`, {
    method,
    headers: {
      ...(body ? { "content-type": "application/json" } : {}),
      ...(cookie ? { cookie } : {}),
      ...(method !== "GET" ? { origin } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const value = await response.json();
  assert.equal(response.status, expect, JSON.stringify(value));
  checks++;
  return { value, cookie: response.headers.get("set-cookie")?.split(";")[0] };
}
try {
  const existing = await database.query(
    "SELECT word_id FROM english_progress WHERE word_id=ANY($1)",
    [fixtureIds],
  );
  assert.equal(
    existing.rowCount,
    0,
    "Test fixture words already have data; refusing to replace it.",
  );
  ownFixtures = true;
  await request("data", { expect: 401 });
  await request("session", {
    method: "POST",
    body: { passphrase: "wrong-passphrase" },
    expect: 401,
  });
  const a = await request("session", {
    method: "POST",
    body: { passphrase: process.env.ENGLISH_PASSPHRASE },
  });
  const b = await request("session", {
    method: "POST",
    body: { passphrase: process.env.ENGLISH_PASSPHRASE },
  });
  assert.ok(a.cookie?.includes("english_session="));
  await request("data", { cookie: a.cookie + "tampered", expect: 401 });
  await request("data", {
    method: "POST",
    cookie: a.cookie,
    origin: "https://foreign.example",
    body: {},
    expect: 403,
  });
  await request("data", {
    method: "POST",
    cookie: a.cookie,
    body: {
      action: "update",
      operationId: op(),
      progress: { ...progress("W497"), plannedDate: "2026-02-30" },
    },
    expect: 400,
  });
  await request("data", {
    method: "POST",
    cookie: a.cookie,
    body: {
      action: "update",
      operationId: op(),
      progress: { ...progress("W497"), note: "x".repeat(2001) },
    },
    expect: 400,
  });
  const metadata = {
    action: "update",
    operationId: op(),
    progress: {
      ...progress("W497"),
      priority: "high",
      plannedDate: "2026-10-09",
      dueDate: "2026-10-12",
      note: "A note <script> is text.",
    },
  };
  await request("data", { method: "POST", cookie: a.cookie, body: metadata });
  const secondDevice = await request("data", { cookie: b.cookie });
  assert.equal(secondDevice.value.progress.W497.priority, "high");
  assert.equal(secondDevice.value.progress.W497.plannedDate, "2026-10-09");
  const review = {
    action: "review",
    operationId: op(),
    wordId: "W497",
    version: 1,
    result: "remembered",
    studiedAt: new Date().toISOString(),
  };
  await request("data", { method: "POST", cookie: a.cookie, body: review });
  await request("data", { method: "POST", cookie: a.cookie, body: review });
  const stored = await database.query(
    "SELECT id FROM english_reviews WHERE id=$1",
    [review.operationId],
  );
  assert.equal(
    stored.rowCount,
    1,
    "Retry must not create a second learning event.",
  );
  const readback = await request("data", { cookie: b.cookie });
  assert.equal(readback.value.progress.W497.version, 2);
  assert.equal(readback.value.progress.W497.status, "mastered");
  await request("data", {
    method: "POST",
    cookie: b.cookie,
    body: { ...metadata, operationId: op() },
    expect: 409,
  });
  await request("data", {
    method: "POST",
    cookie: a.cookie,
    body: { ...review, result: "forgot" },
    expect: 409,
  });
  const secondReview = {
    ...review,
    operationId: op(),
    version: 2,
    result: "forgot",
  };
  const forgotten = await request("data", {
    method: "POST",
    cookie: b.cookie,
    body: secondReview,
  });
  assert.equal(forgotten.value.progress.W497.status, "learning");
  assert.equal(
    forgotten.value.reviews.filter((r) => r.wordId === "W497").length,
    2,
    "Changing mastery must retain historical learning.",
  );
  const concurrent = [a, b].map((session) =>
    request("data", {
      method: "POST",
      cookie: session.cookie,
      body: {
        action: "update",
        operationId: op(),
        progress: progress(session === a ? "W498" : "W499"),
      },
    }),
  );
  await Promise.all(concurrent);
  const duplicate = {
    action: "review",
    operationId: op(),
    wordId: "W498",
    version: 1,
    result: "vague",
    studiedAt: new Date().toISOString(),
  };
  await Promise.all(
    [a, b].map((session) =>
      request("data", {
        method: "POST",
        cookie: session.cookie,
        body: duplicate,
      }),
    ),
  );
  const duplicateRows = await database.query(
    "SELECT id FROM english_reviews WHERE id=$1",
    [duplicate.operationId],
  );
  assert.equal(duplicateRows.rowCount, 1);
  const partial = await request("data?response=word", {
    method: "POST",
    cookie: a.cookie,
    body: duplicate,
  });
  assert.deepEqual(Object.keys(partial.value.progress), ["W498"]);
  assert.equal(partial.value.reviews.length, 1);
  assert.equal(partial.value.reviews[0].id, duplicate.operationId);
  const full = await request("data", { cookie: b.cookie });
  assert.equal(full.value.progress.W497.priority, "high");
  assert.equal(full.value.reviews.filter((r) => r.wordId === "W497").length, 2);
  const imported = {
    action: "import",
    operationId: op(),
    progress: [
      { ...progress("W497"), priority: "low" },
      { ...progress("W500"), status: "mastered" },
    ],
    reviews: [],
  };
  const merged = await request("data?response=word", {
    method: "POST",
    cookie: a.cookie,
    body: imported,
  });
  assert.equal(
    merged.value.progress.W497.priority,
    "high",
    "An old backup must not overwrite current cloud choices.",
  );
  assert.equal(merged.value.progress.W500.status, "mastered");
  assert.equal(
    merged.value.reviews.filter((r) => r.wordId === "W500").length,
    0,
    "Legacy states must not invent historical dates.",
  );
  const restore = {
    action: "import",
    operationId: op(),
    progress: Object.values(merged.value.progress),
    reviews: merged.value.reviews,
  };
  const restored = await request("data", {
    method: "POST",
    cookie: b.cookie,
    body: restore,
  });
  assert.equal(
    restored.value.reviews.length,
    merged.value.reviews.length,
    "A repeated backup must not duplicate history.",
  );
  await request("session", { method: "DELETE", cookie: a.cookie });
  console.log(
    `PASS: ${checks} HTTP checks plus database readback, two sessions, idempotency, conflict protection and import round-trip.`,
  );
} finally {
  if (ownFixtures) {
    await database.query("DELETE FROM english_reviews WHERE word_id=ANY($1)", [
      fixtureIds,
    ]);
    await database.query("DELETE FROM english_progress WHERE word_id=ANY($1)", [
      fixtureIds,
    ]);
    await database.query(
      "DELETE FROM english_operations WHERE id=ANY($1::uuid[])",
      [operationIds],
    );
    await database.query("DELETE FROM english_login_attempts");
  }
  await database.end();
}
