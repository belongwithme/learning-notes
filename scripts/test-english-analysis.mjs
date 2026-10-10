import test from "node:test";
import assert from "node:assert/strict";
import {
  analyze,
  periodFor,
  dayStart,
  firstAnswers,
  evidenceFor,
  suggestionsFor,
  studyFor,
} from "../src/lib/english/practice-model.ts";
import { emptyProgress } from "../src/lib/english/model.ts";
import {
  normalizeAnswer,
  validateContent,
  saveSchema,
} from "../src/lib/english/practice-schema.ts";
import catalog from "../src/data/english.json" with { type: "json" };
import { fixtureContent } from "./english-practice-fixture.mjs";
const cutoff = "2026-10-10T04:00:00Z",
  period = () => periodFor("day", "2026-10-10", cutoff);
const state = () => ({
  learning: { progress: {}, reviews: [] },
  events: [],
  bundles: [],
  retests: [],
});
const review = (id, day, result = "vague", wordId = "W001") => ({
  id,
  wordId,
  result,
  studiedAt: `${day}T01:00:00Z`,
});
const analyzeDay = (s) => analyze(s, period(), catalog.entries);
function answer(
  s,
  {
    id = "a",
    bundleId = "b",
    questionId = "q",
    day = "2026-10-10",
    correct = false,
    assisted = false,
  } = {},
) {
  s.events.push({
    id,
    sequence: s.events.length + 1,
    bundleId,
    questionId,
    kind: "answer",
    payload: { correct, assisted, answer: correct ? "A" : "B", attempt: 1 },
    createdAt: `${day}T02:00:00Z`,
  });
}
function bundle(
  id = "b",
  targets = [{ wordId: "W001", usage: "read" }],
  wordIds = ["W001"],
) {
  return {
    id,
    version: 1,
    period: period(),
    createdAt: "2026-10-01T00:00:00Z",
    content: {
      exercise: { targets, questions: [{ id: "q", wordIds, type: "meaning" }] },
    },
  };
}
test("A01 distinct review words are separate from six clicks", () => {
  const s = state();
  s.learning.reviews = [
    ...Array.from({ length: 5 }, (_, i) => review(String(i), "2026-10-10")),
    review("other", "2026-10-10", "remembered", "W501"),
  ];
  assert.equal(analyzeDay(s).metrics.selfReviewWords, 2);
  assert.equal(analyzeDay(s).metrics.selfReviews, 6);
  assert.ok(!analyzeDay(s).candidates[0].reasons.includes("repeated"));
});
test("A02 different Beijing days count as repeated instability; old errors age out", () => {
  const s = state();
  s.learning.reviews = [
    review("a", "2026-10-09"),
    review("b", "2026-10-10"),
    review("old", "2026-08-01", "forgot", "W501"),
  ];
  assert.deepEqual(
    analyzeDay(s).candidates.map((c) => c.wordId),
    ["W001"],
  );
  assert.deepEqual(analyzeDay(s).candidates[0].unstableDays, [
    "2026-10-09",
    "2026-10-10",
  ]);
});
test("A03/A04 repeats and assistance cannot inflate first accuracy", () => {
  const s = state();
  s.bundles = [bundle(), bundle("help")];
  answer(s);
  answer(s, { id: "retry", correct: true });
  answer(s, { id: "hint", bundleId: "help", correct: true, assisted: true });
  assert.equal(firstAnswers(s).length, 2);
  assert.deepEqual(analyzeDay(s).metrics.firstAccuracy, {
    correct: 0,
    total: 1,
  });
});
test("practice coverage includes a repeat today while its first answer was yesterday", () => {
  const s = state();
  s.bundles = [bundle()];
  answer(s, { day: "2026-10-09" });
  answer(s, { id: "again", correct: true });
  assert.equal(analyzeDay(s).metrics.practiceWords, 1);
  assert.equal(analyzeDay(s).metrics.firstAccuracy.total, 0);
});
test("A05/A06 legacy mastered has unknown date and no invented evidence", () => {
  const s = state();
  s.learning.progress.W1000 = { ...emptyProgress("W1000"), status: "mastered" };
  const a = analyzeDay(s);
  assert.deepEqual(a.unknownDateWordIds, ["W1000"]);
  assert.equal(a.hasRecords, false);
  assert.equal(a.metrics.selfReviews, 0);
  assert.equal(a.candidates.length, 0);
});
test("A11 Beijing midnight, Monday and month boundaries use half-open intervals", () => {
  const s = state();
  s.learning.reviews = [
    { ...review("before", "2026-10-09"), studiedAt: "2026-10-09T15:59:59Z" },
    { ...review("on", "2026-10-09"), studiedAt: "2026-10-09T16:00:00Z" },
    { ...review("after", "2026-10-10"), studiedAt: "2026-10-10T16:00:00Z" },
  ];
  assert.equal(analyzeDay(s).metrics.selfReviews, 1);
  assert.equal(
    periodFor("week", "2026-10-12", "2026-10-12T02:00:00Z").start,
    "2026-10-11T16:00:00.000Z",
  );
  assert.equal(
    periodFor("month", "2026-11-01", "2026-11-01T03:00:00Z").start,
    "2026-10-31T16:00:00.000Z",
  );
  assert.equal(dayStart("2026-10-10"), "2026-10-09T16:00:00.000Z");
});
test("A12 incomplete periods compare the same elapsed duration and clamp shorter months", () => {
  const p = periodFor("month", "2026-03-31", "2026-03-31T04:00:00Z");
  assert.equal(p.comparison.end, "2026-02-28T16:00:00.000Z");
  const week = periodFor("week", "2026-10-10", cutoff);
  assert.equal(
    Date.parse(week.comparison.end) - Date.parse(week.comparison.start),
    Date.parse(cutoff) - Date.parse(week.start),
  );
  const full = periodFor("month", "2026-09-10", cutoff);
  assert.equal(full.complete, true);
  assert.equal(full.comparison.end, full.start);
});
test("A15 disputed question excludes every attempt but preserves raw records", () => {
  const s = state();
  s.bundles = [bundle()];
  answer(s);
  s.events.push({
    id: "flag",
    sequence: 2,
    bundleId: "b",
    questionId: "q",
    kind: "flag",
    payload: { reason: "ambiguous" },
    createdAt: "2026-10-10T03:00:00Z",
  });
  assert.equal(analyzeDay(s).metrics.firstAccuracy.total, 0);
  assert.equal(analyzeDay(s).candidates.length, 0);
  assert.equal(s.events.length, 2);
  assert.equal(
    evidenceFor(s, "2026-10-10T02:30:00Z").filter((e) => e.kind === "answer")
      .length,
    1,
  );
});
test("multi-target wrong answer is coverage, not evidence that every word is unstable", () => {
  const s = state();
  s.bundles = [
    bundle("b", [{ wordId: "W001" }, { wordId: "W501" }], ["W001", "W501"]),
  ];
  answer(s);
  const a = analyzeDay(s);
  assert.equal(a.metrics.practiceWords, 2);
  assert.equal(a.metrics.firstAccuracy.total, 1);
  assert.equal(a.candidates.length, 0);
});
test("A09 two later independent retest days, including seven-day interval, stabilize; relapse reopens", () => {
  const s = state();
  s.bundles = [bundle("initial")];
  answer(s, { bundleId: "initial", day: "2026-10-01" });
  for (const [i, day] of ["2026-10-02", "2026-10-08"].entries()) {
    const id = `r${i}`;
    s.retests.push({
      id,
      wordId: "W001",
      sourceBundleId: "initial",
      decision: "accepted",
      scheduledDate: day,
      confirmedAt: "2026-10-01T03:00:00Z",
      completedAt: day + "T02:00:00Z",
      completedBundleId: id,
    });
    s.bundles.push(
      bundle(id, [{ wordId: "W001", usage: "read", retestId: id }]),
    );
    answer(s, { id, bundleId: id, day, correct: true });
  }
  assert.equal(analyzeDay(s).stabilizing.length, 1);
  assert.equal(analyzeDay(s).candidates.length, 0);
  s.learning.reviews.push(review("relapse", "2026-10-10", "forgot"));
  assert.equal(analyzeDay(s).stabilizing.length, 0);
  assert.equal(analyzeDay(s).candidates.length, 1);
});
test("same-day or assisted retests never establish stability", () => {
  const s = state();
  s.bundles = [
    bundle("initial"),
    bundle("r", [{ wordId: "W001", retestId: "r" }]),
  ];
  s.retests = [
    {
      id: "r",
      wordId: "W001",
      sourceBundleId: "initial",
      decision: "accepted",
      scheduledDate: "2026-10-10",
      confirmedAt: "2026-10-09T03:00:00Z",
    },
  ];
  answer(s, { bundleId: "initial" });
  answer(s, { id: "r", bundleId: "r", correct: true });
  assert.equal(analyzeDay(s).metrics.retestAccuracy.total, 0);
});
test("due schedules outrank high priority instability; fewer than five words cannot rank a theme", () => {
  const s = state();
  s.learning.reviews = [review("a", "2026-10-10")];
  s.learning.progress.W001 = { ...emptyProgress("W001"), priority: "high" };
  s.retests = [
    {
      id: "due",
      wordId: "W1000",
      decision: "accepted",
      scheduledDate: "2026-10-09",
      confirmedAt: "2026-10-08T01:00:00Z",
    },
  ];
  assert.equal(analyzeDay(s).candidates[0].wordId, "W1000");
  assert.equal(analyzeDay(s).weakThemes.length, 0);
});
test("A10 suggestions retain manual date and do not mutate progress", () => {
  const s = state();
  const b = bundle();
  s.bundles = [b];
  s.learning.progress.W001 = {
    ...emptyProgress("W001"),
    dueDate: "2026-10-20",
  };
  answer(s);
  const suggestions = suggestionsFor(b, s);
  assert.equal(suggestions[0].suggestedDate, "2026-10-11");
  assert.equal(suggestions[0].manualDate, "2026-10-20");
  assert.equal(s.learning.progress.W001.dueDate, "2026-10-20");
});
test("text answers use only explicit accepted forms with case/space normalization", () => {
  assert.equal(normalizeAnswer("  READ\n the   file "), "read the file");
  assert.notEqual(normalizeAnswer("reads"), normalizeAnswer("read"));
});
test("A07 validation rejects missing target coverage, evidence and malformed answers", () => {
  const s = state();
  s.learning.reviews = ["W001", "W501", "W1000"].map((w, i) =>
    review(String(i), "2026-10-10", "vague", w),
  );
  const facts = analyzeDay(s),
    input = { includeWordIds: [], excludeWordIds: [] };
  const content = fixtureContent({ facts });
  assert.doesNotThrow(() => validateContent(content, facts, s, input));
  for (const mutate of [
    (c) => (c.exercise.questions[2].wordIds = ["W001"]),
    (c) => (c.exercise.targets[0].evidenceIds = ["review:missing"]),
    (c) => (c.exercise.questions[0].answers = ["missing"]),
    (c) => c.exercise.targets.push({ ...c.exercise.targets[0] }),
    (c) => (c.exercise.passage = "too short"),
  ]) {
    const invalid = structuredClone(content);
    mutate(invalid);
    assert.throws(() => validateContent(invalid, facts, s, input));
  }
});

test("a later remembered self-rating cannot erase the latest objective error", () => {
  const s = state();
  s.bundles = [bundle()];
  answer(s);
  s.learning.reviews.push({
    ...review("remembered", "2026-10-10", "remembered"),
    studiedAt: "2026-10-10T03:00:00Z",
  });
  assert.ok(analyzeDay(s).candidates[0].reasons.includes("recent"));
});

test("retest suggestions use the latest uncertainty feedback while retaining its history", () => {
  const s = state();
  const b = bundle();
  s.bundles = [b];
  answer(s, { correct: true });
  s.events.push({
    id: "uncertain",
    sequence: 2,
    bundleId: b.id,
    kind: "feedback",
    questionId: "",
    payload: { vagueWordIds: ["W001"] },
    createdAt: "2026-10-10T03:00:00Z",
  });
  assert.equal(suggestionsFor(b, s).length, 1);
  s.events.push({
    ...s.events[1],
    id: "revised",
    sequence: 3,
    payload: { vagueWordIds: [] },
    createdAt: "2026-10-10T03:01:00Z",
  });
  assert.equal(suggestionsFor(b, s).length, 0);
  assert.deepEqual(s.events[1].payload.vagueWordIds, ["W001"]);
});

test("new content requires a complete lesson with each target and faithful sentence breakdowns", () => {
  const s = state();
  s.learning.reviews = ["W001", "W501", "W1000"].map((w, i) =>
    review(String(i), "2026-10-10", "vague", w),
  );
  const facts = analyzeDay(s),
    input = { includeWordIds: [], excludeWordIds: [] };
  const content = fixtureContent({ facts });
  for (const mutate of [
    (c) => delete c.lesson,
    (c) => c.lesson.words.pop(),
    (c) => c.lesson.words.push(c.lesson.words[0]),
    (c) => (c.lesson.reading.sentences[0].chunks[0].text = "not in the source"),
    (c) =>
      (c.lesson.words[0].examples[0].english = c.exercise.questions[0].context),
    (c) => (c.lesson.reading.passage = c.exercise.passage),
  ]) {
    const invalid = structuredClone(content);
    mutate(invalid);
    assert.throws(() => validateContent(invalid, facts, s, input));
  }
  assert.equal(saveSchema.shape.schemaVersion.safeParse(1).success, false);
  assert.equal(
    saveSchema.shape.content.safeParse({ ...content, lesson: undefined })
      .success,
    false,
  );
  const incomplete = structuredClone(content);
  incomplete.lesson.words[0].examples = [];
  assert.equal(saveSchema.shape.content.safeParse(incomplete).success, false);
});

test("study progress is separate from assessment and old reports remain usable", () => {
  const s = state(),
    b = bundle();
  s.bundles = [b];
  assert.equal(studyFor(b, []).stage, "practice");
  b.content.lesson = fixtureContent({ facts: { evidence: [] } }).lesson;
  assert.equal(studyFor(b, []).stage, "concepts");
  s.events.push({
    id: "study",
    bundleId: b.id,
    kind: "study",
    questionId: "concepts",
    sequence: 1,
    createdAt: "2026-10-10T02:00:00Z",
    payload: {},
  });
  assert.equal(studyFor(b, s.events).stage, "reading");
  assert.equal(analyzeDay(s).metrics.firstAccuracy.total, 0);
  assert.equal(analyzeDay(s).metrics.practiceWords, 0);
});
