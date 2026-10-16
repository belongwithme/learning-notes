import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { scheduleFor, shiftDay } from "../src/lib/english/model.ts";
import { blank, clozeFor, target } from "../src/lib/english/cloze.ts";
import { dailyPlan, studyOrderFor } from "../src/lib/english/plan.ts";
import { emptyProgress } from "../src/lib/english/model.ts";

const at = (day, result, hour = 4) => ({
  result,
  studiedAt: `${day}T0${hour}:00:00Z`,
});

test("forgot is due tomorrow, vague in two days, both stay learning", () => {
  assert.deepEqual(scheduleFor([at("2026-10-16", "forgot")]), {
    dueDate: "2026-10-17",
    status: "learning",
  });
  assert.equal(scheduleFor([at("2026-10-16", "vague")]).dueDate, "2026-10-18");
});

test("one remembered is not mastered; intervals grow 3, 7, 14, 30", () => {
  const one = scheduleFor([at("2026-10-01", "remembered")]);
  assert.deepEqual(one, { dueDate: "2026-10-04", status: "learning" });
  const days = ["2026-10-01", "2026-10-04", "2026-10-11", "2026-10-25", "2026-11-24"];
  const due = days.map((_, i) =>
    scheduleFor(days.slice(0, i + 1).map((d) => at(d, "remembered"))),
  );
  assert.deepEqual(
    due.map((s) => s.dueDate),
    ["2026-10-04", "2026-10-11", "2026-10-25", "2026-11-24", "2026-12-24"],
  );
  assert.deepEqual(
    due.map((s) => s.status),
    ["learning", "mastered", "mastered", "mastered", "mastered"],
  );
});

test("several ratings on one day count once; the last one wins", () => {
  const s = scheduleFor([
    at("2026-10-01", "remembered", 1),
    at("2026-10-01", "remembered", 2),
  ]);
  assert.equal(s.status, "learning");
  assert.equal(s.dueDate, "2026-10-04");
  assert.equal(
    scheduleFor([at("2026-10-01", "remembered", 1), at("2026-10-01", "forgot", 2)])
      .dueDate,
    "2026-10-02",
  );
});

test("a miss resets the streak; order of input does not matter", () => {
  const s = scheduleFor([
    at("2026-10-03", "remembered"),
    at("2026-10-01", "remembered"),
    at("2026-10-02", "vague"),
  ]);
  assert.equal(s.status, "learning");
  assert.equal(s.dueDate, "2026-10-06", "3 days after the only remembered day in a row");
  assert.equal(scheduleFor([]), null);
});

test("learning days follow Beijing time and months roll over", () => {
  // 17:00 UTC on the 31st is already the 1st in Beijing.
  assert.equal(
    scheduleFor([{ result: "forgot", studiedAt: "2026-10-31T17:00:00Z" }]).dueDate,
    "2026-11-02",
  );
  assert.equal(shiftDay("2026-12-31", 1), "2027-01-01");
});

const catalog = JSON.parse(readFileSync("src/data/english.json", "utf8"));
const dialogues = JSON.parse(readFileSync("src/data/english-dialogues.json", "utf8"));
const byWord = new Map(dialogues.flatMap((d) => d.wordIds.map((id) => [id, d])));

test("a blank hides the term or the last fixed word of an expression", () => {
  assert.equal(target({ term: "read A from B", kind: "phrases" }), "from");
  assert.equal(target({ term: "until something completes", kind: "phrases" }), "completes");
  assert.deepEqual(blank("Read the token from the header.", { term: "read A from B", kind: "phrases" }), {
    text: "Read the token _____ the header.",
    answer: "from",
  });
  assert.deepEqual(blank("Resolve the dependency now.", { term: "read", kind: "words" }), null);
  assert.equal(blank("The cache expires.", { term: "expire", kind: "words" }).answer, "expires");
});

test("every entry can be asked, and a word has a second context", () => {
  let none = 0,
    noDialogue = 0;
  for (const item of catalog.entries) {
    const first = clozeFor(item, byWord.get(item.id), false);
    const again = clozeFor(item, byWord.get(item.id), true);
    if (!first || !again) none++;
    else assert.ok(first.text.includes("_____") && again.text.includes("_____"));
    if (item.kind === "words" && again?.context !== "dialogue") noDialogue++;
  }
  assert.equal(none, 0, `${none} entries cannot be turned into a blank`);
  assert.equal(noDialogue, 0, `${noDialogue} words lack a dialogue blank`);
});

const order = studyOrderFor(catalog.albums, catalog.entries);
const plan = (data, limits = { review: 8, fresh: 4 }, today = "2026-10-16") =>
  dailyPlan({ entries: catalog.entries, data, today, limits, order });
const empty = { progress: {}, reviews: [] };
const rev = (wordId, day, result = "remembered", id = `${wordId}-${day}`) => ({
  id,
  wordId,
  result,
  studiedAt: `${day}T04:00:00Z`,
});

test("new items follow one album: an expression, then two words", () => {
  const { queue } = plan(empty, { review: 8, fresh: 6 });
  const kinds = queue.map((id) => catalog.entries.find((e) => e.id === id).kind);
  assert.deepEqual(kinds, ["phrases", "words", "words", "phrases", "words", "words"]);
  const albums = new Set(queue.map((id) => catalog.entries.find((e) => e.id === id).album));
  assert.deepEqual([...albums], [1]);
});

test("a high-priority word is introduced before study order", () => {
  const data = { progress: { W700: { ...emptyProgress("W700"), priority: "high" } }, reviews: [] };
  assert.equal(plan(data).queue[0], "W700");
});

test("reviews come first, oldest due first, and stop at the daily limit", () => {
  const ids = Array.from({ length: 12 }, (_, i) => `W${String(i + 1).padStart(3, "0")}`);
  // Each word was last rated "forgot" on a different day, so each is due the next day.
  const reviews = ids.map((id, i) => rev(id, `2026-09-${String(i + 1).padStart(2, "0")}`, "forgot"));
  const out = plan({ progress: {}, reviews });
  assert.equal(out.dueTotal, 12);
  assert.deepEqual(out.queue.slice(0, 8), ids.slice(0, 8));
  assert.equal(out.moreDue, true);
  assert.equal(out.queue.length, 8 + 4);
});

test("words rated before automatic scheduling still come back", () => {
  // Old rule: one "remembered" made the word mastered and gave it no due date.
  const data = {
    progress: { W010: { ...emptyProgress("W010"), status: "mastered" } },
    reviews: [rev("W010", "2026-10-10")],
  };
  assert.equal(plan(data).dueTotal, 1);
  assert.equal(plan(data, { review: 8, fresh: 0 }).queue[0], "W010");
  assert.equal(plan(data, undefined, "2026-10-12").dueTotal, 0, "due on the 13th");
});

test("today's ratings count as done and leave the queue", () => {
  const data = {
    progress: {},
    reviews: [
      rev("W001", "2026-10-16"),
      rev("W002", "2026-10-10", "forgot"),
      rev("W002", "2026-10-16", "remembered", "W002-today"),
    ],
  };
  const out = plan(data);
  assert.deepEqual([out.doneFresh, out.doneReview], [1, 1]);
  assert.ok(!out.queue.includes("W001") && !out.queue.includes("W002"));
  assert.equal(out.queue.length, 3, "one of four new items is already done");
});

test("a future due date or plan keeps a word out of today", () => {
  const data = {
    progress: {
      W003: { ...emptyProgress("W003"), dueDate: "2026-10-20" },
      W004: { ...emptyProgress("W004"), plannedDate: "2026-10-16" },
    },
    reviews: [],
  };
  const out = plan(data, { review: 8, fresh: 0 });
  assert.deepEqual(out.queue, ["W004"]);
});
