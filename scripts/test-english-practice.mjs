import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import pg from "pg";
import {
  fixtureContent,
  fixtureWordIds,
  fixtureLessonWord,
} from "./english-practice-fixture.mjs";
import {
  readLearningContext,
  saveLearningContent,
  findSavedRequest,
} from "../src/lib/english/practice-server.ts";
import { db } from "../src/lib/english/server.ts";
import { learningDay } from "../src/lib/english/model.ts";
import { addDays, dayStart } from "../src/lib/english/practice-model.ts";
const base = process.env.ENGLISH_TEST_URL ?? "http://127.0.0.1:4322";
const connection = new URL(process.env.DATABASE_URL);
if (
  !["127.0.0.1", "localhost"].includes(connection.hostname) ||
  connection.pathname !== "/english_dev" ||
  !["127.0.0.1", "localhost"].includes(new URL(base).hostname)
)
  throw new Error(
    "Requires dedicated local english_dev database and local test website.",
  );
const database = new pg.Client({ connectionString: process.env.DATABASE_URL });
await database.connect();
let owned = false,
  checks = 0;
const ids = [],
  ops = [];
const operation = () => {
  const id = randomUUID();
  ops.push(id);
  return id;
};
const today = learningDay(),
  tomorrow = addDays(today, 1);
async function http(
  path,
  { method = "GET", body, cookie, expect = 200, origin = base } = {},
) {
  const response = await fetch(`${base}/api/english/${path}`, {
    method,
    headers: {
      ...(cookie ? { cookie } : {}),
      ...(body ? { "content-type": "application/json" } : {}),
      ...(method === "GET" ? {} : { origin }),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const value = await response.json();
  assert.equal(response.status, expect, JSON.stringify(value));
  assert.ok(response.headers.get("cache-control").includes("no-store"));
  checks++;
  return { value, cookie: response.headers.get("set-cookie")?.split(";")[0] };
}
const action = (bundleId, rest) => ({
  operationId: operation(),
  bundleId,
  ...rest,
});
const makeRequest = (context, extra = {}) => {
  const requestId = randomUUID();
  ids.push(requestId);
  return {
    schemaVersion: 2,
    requestId,
    context: context.input,
    contextHash: context.contextHash,
    content: fixtureContent(context),
    ...extra,
  };
};
try {
  assert.equal(
    (
      await database.query(
        "SELECT word_id FROM english_progress WHERE word_id=ANY($1)",
        [fixtureWordIds],
      )
    ).rowCount,
    0,
    "Refusing to touch existing fixture words.",
  );
  assert.equal(
    (await database.query("SELECT id FROM english_bundles LIMIT 1")).rowCount,
    0,
    "Use an empty isolated practice test database.",
  );
  owned = true;
  await database.query(
    "INSERT INTO english_progress(word_id,status,note,due_date) SELECT word_id,'learning','PRIVATE_NOTE_MUST_NOT_LEAK',$2 FROM unnest($1::text[]) word_id",
    [fixtureWordIds, tomorrow],
  );
  for (const wordId of fixtureWordIds)
    for (const day of [addDays(today, -1), today])
      await database.query(
        "INSERT INTO english_reviews(id,word_id,result,studied_at) VALUES($1,$2,$3,$4)",
        [
          randomUUID(),
          wordId,
          "vague",
          new Date(Date.parse(dayStart(day)) + 1000).toISOString(),
        ],
      );
  // Applying the complete schema twice also exercises the W1000 migration on an existing table.
  await database.query(
    await readFile(new URL("./english-schema.sql", import.meta.url), "utf8"),
  );
  await http("practice", { expect: 401 });
  const a = await http("session", {
      method: "POST",
      body: { passphrase: process.env.ENGLISH_PASSPHRASE },
    }),
    b = await http("session", {
      method: "POST",
      body: { passphrase: process.env.ENGLISH_PASSPHRASE },
    });
  await http("practice", {
    method: "POST",
    cookie: a.cookie,
    origin: "https://foreign.invalid",
    body: {},
    expect: 403,
  });
  let context = await readLearningContext({ kind: "day", date: today });
  assert.ok(!JSON.stringify(context).includes("PRIVATE_NOTE_MUST_NOT_LEAK"));
  assert.ok(!JSON.stringify(context).includes(process.env.ENGLISH_PASSPHRASE));
  assert.equal(context.facts.metrics.selfReviewWords, 3);
  assert.equal(context.facts.metrics.selfReviews, 3);
  assert.equal(
    (await database.query("SELECT id FROM english_bundles")).rowCount,
    0,
    "Read/draft must not publish.",
  );
  const raw = makeRequest(context);
  const invalid = structuredClone(raw);
  invalid.content.exercise.questions[0].answers = [];
  await assert.rejects(() => saveLearningContent(invalid));
  assert.equal(
    (await database.query("SELECT id FROM english_bundles")).rowCount,
    0,
    "Malformed report must leave no partial document.",
  );
  const [saved, retry] = await Promise.all([
    saveLearningContent(raw),
    saveLearningContent(raw),
  ]);
  assert.equal(saved.requestId, retry.requestId);
  assert.equal(saved.version, 1);
  assert.equal(saved.readbackVerified, true);
  assert.equal(
    (await database.query("SELECT id FROM english_bundles")).rowCount,
    1,
  );
  assert.equal(
    (await findSavedRequest(raw.requestId)).content.exercise.questions.length,
    3,
  );
  await assert.rejects(
    () =>
      saveLearningContent({
        ...raw,
        content: { ...raw.content, title: "different" },
      }),
    { status: 409 },
  );
  let view = (
    await http(`practice?report=${raw.requestId}`, { cookie: b.cookie })
  ).value;
  assert.deepEqual(view.bundle.content.exercise.questions[0].answers, []);
  assert.equal(view.bundle.content.exercise.questions[0].hint, "");
  assert.equal(view.bundle.content.exercise.translation, "");
  assert.equal(view.bundle.study.stage, "concepts");
  assert.equal(view.bundle.content.lesson.words.length, 3);
  await http("practice", {
    method: "POST",
    cookie: a.cookie,
    expect: 409,
    body: action(raw.requestId, {
      action: "answer",
      questionId: "q1",
      answer: "A",
      expectedAttempt: 0,
    }),
  });
  await http("practice", {
    method: "POST",
    cookie: a.cookie,
    expect: 409,
    body: action(raw.requestId, { action: "study", questionId: "reading" }),
  });
  const studied = action(raw.requestId, {
    action: "study",
    questionId: "concepts",
  });
  for (const body of [
    studied,
    studied,
    action(raw.requestId, { action: "study", questionId: "concepts" }),
  ])
    await http("practice", { method: "POST", cookie: a.cookie, body });
  view = (await http(`practice?report=${raw.requestId}`, { cookie: b.cookie }))
    .value;
  assert.equal(
    view.bundle.study.stage,
    "reading",
    "Study progress resumes in another session.",
  );
  assert.equal(
    view.overview.metrics.firstAccuracy.total,
    0,
    "Reading is not an answer.",
  );
  assert.equal(
    (
      await database.query(
        "SELECT id FROM english_practice_events WHERE bundle_id=$1 AND kind='study'",
        [raw.requestId],
      )
    ).rowCount,
    1,
  );
  view = (
    await http("practice", {
      method: "POST",
      cookie: b.cookie,
      body: action(raw.requestId, { action: "study", questionId: "reading" }),
    })
  ).value;
  assert.equal(view.bundle.study.stage, "practice");
  assert.equal(
    view.bundle.content.lesson,
    undefined,
    "Teaching content is closed during independent retrieval.",
  );
  const first = action(raw.requestId, {
    action: "answer",
    questionId: "q1",
    answer: "B",
    expectedAttempt: 0,
  });
  await Promise.all(
    [a, b].map((session) =>
      http("practice", { method: "POST", cookie: session.cookie, body: first }),
    ),
  );
  assert.equal(
    (
      await database.query(
        "SELECT id FROM english_practice_events WHERE kind='answer' AND bundle_id=$1",
        [raw.requestId],
      )
    ).rowCount,
    1,
  );
  await http("practice", {
    method: "POST",
    cookie: b.cookie,
    body: action(raw.requestId, {
      action: "answer",
      questionId: "q1",
      answer: "A",
      expectedAttempt: 0,
    }),
    expect: 409,
  });
  await http("practice", {
    method: "POST",
    cookie: a.cookie,
    body: action(raw.requestId, {
      action: "answer",
      questionId: "q1",
      answer: "A",
      expectedAttempt: 1,
    }),
  });
  const hint = action(raw.requestId, { action: "hint", questionId: "q2" });
  await http("practice", { method: "POST", cookie: a.cookie, body: hint });
  await http("practice", {
    method: "POST",
    cookie: b.cookie,
    body: action(raw.requestId, {
      action: "answer",
      questionId: "q2",
      answer: "B",
      expectedAttempt: 0,
    }),
  });
  view = (
    await http("practice", {
      method: "POST",
      cookie: a.cookie,
      body: action(raw.requestId, {
        action: "answer",
        questionId: "q3",
        answer: "B",
        expectedAttempt: 0,
      }),
    })
  ).value;
  assert.equal(
    view.bundle.content.exercise.questions[1].attempts[0].payload.assisted,
    true,
  );
  assert.deepEqual(view.overview.metrics.firstAccuracy, {
    correct: 1,
    total: 2,
  });
  assert.equal(view.bundle.suggestions.length, 2);
  const confirm = action(raw.requestId, {
    action: "schedule",
    wordId: "W001",
    decision: "accepted",
    scheduledDate: tomorrow,
    manualDate: tomorrow,
    manualChoice: "keep",
  });
  await http("practice", {
    method: "POST",
    cookie: a.cookie,
    body: { ...confirm, manualDate: "" },
    expect: 409,
  });
  await Promise.all(
    [a, b].map((session) =>
      http("practice", {
        method: "POST",
        cookie: session.cookie,
        body: confirm,
      }),
    ),
  );
  await http("practice", {
    method: "POST",
    cookie: b.cookie,
    body: { ...confirm, operationId: operation() },
  });
  assert.equal(
    (
      await database.query(
        "SELECT id FROM english_retests WHERE source_bundle_id=$1",
        [raw.requestId],
      )
    ).rowCount,
    1,
  );
  assert.equal(
    (
      await database.query(
        "SELECT due_date FROM english_progress WHERE word_id='W001'",
      )
    ).rows[0].due_date,
    tomorrow,
  );
  view = (await http(`practice?report=${raw.requestId}`, { cookie: b.cookie }))
    .value;
  assert.equal(view.bundle.content.exercise.questions[0].attempts.length, 2);
  assert.equal(view.retests[0].readyBundleId, null);
  assert.equal(view.summaries[0].hasNewRecords, true);
  // Flagging retains the answer but removes it from subsequent evidence and accuracy.
  await http("practice", {
    method: "POST",
    cookie: b.cookie,
    body: action(raw.requestId, {
      action: "flag",
      questionId: "q3",
      reason: "Test correction",
    }),
  });
  context = await readLearningContext({ kind: "day", date: today });
  assert.deepEqual(context.facts.metrics.firstAccuracy, {
    correct: 0,
    total: 1,
  });
  assert.equal(
    context.history[0].events.filter((e) => e.kind === "answer").length,
    4,
  );
  const updated = makeRequest(context, { regenerate: true });
  const v2 = await saveLearningContent(updated);
  assert.equal(v2.version, 2);
  view = (await http(`practice?report=${raw.requestId}`, { cookie: b.cookie }))
    .value;
  assert.equal(view.bundle.version, 1);
  assert.equal(view.bundle.content.exercise.questions[0].attempts.length, 2);
  const duplicate = makeRequest(context);
  assert.equal(
    (await saveLearningContent(duplicate)).bundleId,
    updated.requestId,
  );
  assert.equal(
    (await findSavedRequest(duplicate.requestId)).bundleId,
    updated.requestId,
  );
  await assert.rejects(
    () =>
      saveLearningContent({
        ...duplicate,
        content: { ...duplicate.content, title: "changed duplicate" },
      }),
    { status: 409 },
  );
  // Immutable version with a correction link; source answers remain unchanged.
  const corrected = makeRequest(context, { regenerate: true });
  corrected.content.replaces = [
    {
      bundleId: raw.requestId,
      questionId: "q3",
      reason: "Use a clearer instruction.",
    },
  ];
  assert.equal((await saveLearningContent(corrected)).version, 3);
  // A legacy report remains readable and answerable without invented learning progress.
  await database.query(
    "UPDATE english_bundles SET content=content-'lesson' WHERE id=$1",
    [corrected.requestId],
  );
  view = (
    await http(`practice?report=${corrected.requestId}`, { cookie: b.cookie })
  ).value;
  assert.equal(view.bundle.study.hasLesson, false);
  assert.equal(view.bundle.study.stage, "practice");
  // Reopening the lesson after starting practice is recorded as assistance.
  for (const questionId of ["concepts", "reading"])
    await http("practice", {
      method: "POST",
      cookie: a.cookie,
      body: action(updated.requestId, { action: "study", questionId }),
    });
  view = (
    await http("practice", {
      method: "POST",
      cookie: a.cookie,
      body: action(updated.requestId, { action: "hint", questionId: "*" }),
    })
  ).value;
  assert.equal(view.bundle.content.lesson.words.length, 3);
  view = (
    await http("practice", {
      method: "POST",
      cookie: a.cookie,
      body: action(updated.requestId, {
        action: "answer",
        questionId: "q1",
        answer: "A",
        expectedAttempt: 0,
      }),
    })
  ).value;
  assert.equal(
    view.bundle.content.exercise.questions[0].attempts[0].payload.assisted,
    true,
  );
  // Eight-target standard exercise: coverage in both contextual examples and questions.
  const extra = ["W002", "W003", "W004", "W005", "W006"];
  const all = [...fixtureWordIds, ...extra];
  const c8 = await readLearningContext({
    kind: "week",
    date: today,
    includeWordIds: all,
    mode: "standard",
  });
  const eight = makeRequest(c8);
  eight.content.exercise.mode = "standard";
  const catalog = JSON.parse(
    await readFile(
      new URL("../src/data/english.json", import.meta.url),
      "utf8",
    ),
  );
  for (const wordId of extra) {
    const w = catalog.entries.find((e) => e.id === wordId);
    eight.content.lesson.words.push(fixtureLessonWord(wordId));
    eight.content.exercise.targets.push({
      wordId,
      usage: w.term,
      meaning: w.meaning,
      extension: false,
      reason: "用户指定补练",
      evidenceIds: [],
    });
    eight.content.exercise.examples.push({
      wordIds: [wordId],
      english: w.example,
      translation: w.translation,
    });
  }
  eight.content.exercise.passage +=
    " During code review, a teammate should check the change and ask what each method does. Small examples make it easier to test assumptions. Keep the old input available while testing a new transformation. If a result is unexpected, compare the input with the output before changing another setting. This careful process helps the team discuss the behavior of a library using concrete evidence.";
  for (let i = 0; i < 2; i++) {
    const subset = extra.slice(i * 3, (i + 1) * 3);
    eight.content.exercise.questions.push({
      ...eight.content.exercise.questions[0],
      id: `extra${i}`,
      wordIds: subset,
      context: subset
        .map((id) => catalog.entries.find((e) => e.id === id).example)
        .join(" "),
    });
  }
  await saveLearningContent(eight);
  // Advance only synthetic fixture timestamps: next-day retest with unchanged usage/new context.
  await database.query(
    "UPDATE english_practice_events SET created_at=created_at-interval '1 day' WHERE bundle_id=$1",
    [raw.requestId],
  );
  await database.query(
    "UPDATE english_retests SET scheduled_date=$1,confirmed_at=$2 WHERE source_bundle_id=$3",
    [today, dayStart(addDays(today, -1)), raw.requestId],
  );
  context = await readLearningContext({ kind: "day", date: today });
  const retestRequest = makeRequest(context, { regenerate: true });
  const schedules = context.retests.filter((r) => !r.completedAt);
  retestRequest.content = fixtureContent(context, schedules);
  retestRequest.content.exercise.passage =
    retestRequest.content.exercise.passage.replace(
      "Before adding a library",
      "Before choosing a dependency",
    );
  retestRequest.content.exercise.questions[0].context =
    "Please read the setup instructions before you run this Java example.";
  retestRequest.content.exercise.questions[0].prompt =
    "Which action is requested by the setup instructions?";
  await saveLearningContent(retestRequest);
  view = (
    await http(`practice?report=${retestRequest.requestId}`, {
      cookie: b.cookie,
    })
  ).value;
  assert.equal(
    view.bundle.study.required,
    false,
    "Retests preserve retrieval before review.",
  );
  assert.equal(view.bundle.content.lesson, undefined);
  view = (
    await http("practice", {
      method: "POST",
      cookie: b.cookie,
      body: action(retestRequest.requestId, {
        action: "answer",
        questionId: "q1",
        answer: "A",
        expectedAttempt: 0,
      }),
    })
  ).value;
  assert.equal(
    view.retests.find((r) => r.wordId === "W001").completedBundleId,
    retestRequest.requestId,
  );
  assert.deepEqual(view.overview.metrics.retestAccuracy, {
    correct: 1,
    total: 1,
  });
  for (const [questionId, answer] of [
    ["q2", "B"],
    ["q3", "B"],
  ])
    view = (
      await http("practice", {
        method: "POST",
        cookie: a.cookie,
        body: action(retestRequest.requestId, {
          action: "answer",
          questionId,
          answer,
          expectedAttempt: 0,
        }),
      })
    ).value;
  assert.equal(
    view.bundle.suggestions.find((s) => s.wordId === "W001").suggestedDate,
    addDays(today, 3),
  );
  const direct = (
    await database.query(
      "SELECT payload FROM english_practice_events WHERE bundle_id=$1 AND kind=$2",
      [retestRequest.requestId, "answer"],
    )
  ).rows;
  assert.equal(direct.length, 3);
  // Fixed CLI read and recover also run without a live Codex/model service.
  const cli = spawnSync(
    process.execPath,
    [
      "--experimental-strip-types",
      "scripts/english-context.mjs",
      "--period",
      "month",
    ],
    { env: process.env, encoding: "utf8" },
  );
  assert.equal(cli.status, 0, cli.stderr);
  assert.equal(JSON.parse(cli.stdout).input.kind, "month");
  const recover = spawnSync(
    process.execPath,
    [
      "--experimental-strip-types",
      "scripts/english-save.mjs",
      "--request",
      retestRequest.requestId,
    ],
    { env: process.env, encoding: "utf8" },
  );
  assert.equal(recover.status, 0, recover.stderr);
  assert.equal(JSON.parse(recover.stdout).saved, true);
  console.log(
    `PASS: ${checks} HTTP checks; PostgreSQL readback; two sessions; study-before-practice and progress recovery; legacy reports; lesson review assistance; W001/W501/W1000; immutable versions; atomic save/retry; hints; correction; manual-date conflicts; cross-day retest; eight targets; CLI read/recovery.`,
  );
} finally {
  if (owned) {
    await database.query("DELETE FROM english_retests");
    await database.query("DELETE FROM english_practice_events");
    await database.query(
      "DELETE FROM english_operations WHERE bundle_id IS NOT NULL",
    );
    await database.query("DELETE FROM english_bundles");
    await database.query("DELETE FROM english_reviews WHERE word_id=ANY($1)", [
      fixtureWordIds,
    ]);
    await database.query("DELETE FROM english_progress WHERE word_id=ANY($1)", [
      fixtureWordIds,
    ]);
    await database.query(
      "DELETE FROM english_operations WHERE id=ANY($1::uuid[])",
      [ops],
    );
    await database.query("DELETE FROM english_login_attempts");
  }
  await database.end();
  await db().end();
}
