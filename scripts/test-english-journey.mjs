import test from "node:test";
import assert from "node:assert/strict";
import {
  analyze,
  periodFor,
  dayStart,
} from "../src/lib/english/practice-model.ts";
import {
  courseProgress,
  learningJourney,
  currentSuggestions,
  questionAccess,
} from "../src/lib/english/journey-model.ts";
const now = "2026-10-13T05:00:00Z",
  today = "2026-10-13";
const state = () => ({
  learning: { progress: {}, reviews: [] },
  bundles: [],
  events: [],
  retests: [],
});
const period = periodFor("day", today, now);
const lesson = {
  title: "学习",
  estimatedMinutes: 10,
  words: [{ wordId: "W001" }],
};
function bundle(
  id,
  { retestId, createdAt = "2026-10-10T01:00:00Z", withLesson = true } = {},
) {
  return {
    id,
    version: 1,
    createdAt,
    period,
    content: {
      title: id,
      ...(withLesson ? { lesson } : {}),
      exercise: {
        mode: "short",
        targets: [
          {
            wordId: "W001",
            usage: "read",
            evidenceIds: ["review:r"],
            ...(retestId ? { retestId } : {}),
          },
        ],
        questions: [
          { id: "q1", wordIds: ["W001"], type: "meaning" },
          { id: "q2", wordIds: ["W001"], type: "collocation" },
        ],
      },
    },
  };
}
function event(s, b, kind, q, payload = {}, at = now) {
  s.events.push({
    id: String(s.events.length),
    sequence: s.events.length + 1,
    bundleId: b,
    kind,
    questionId: q,
    payload,
    createdAt: at,
  });
}
function answer(s, b, q, correct = true, assisted = false) {
  event(s, b, "answer", q, { answer: "A", correct, assisted, attempt: 1 });
}
function schedule(s, id, source = "source", day = today) {
  const r = {
    id,
    sourceBundleId: source,
    wordId: "W001",
    usage: "read",
    stage: 0,
    decision: "accepted",
    scheduledDate: day,
    suggestedDate: day,
    manualDate: "",
    manualChoice: "suggested",
    confirmedAt: "2026-10-11T01:00:00Z",
    completedAt: null,
    completedBundleId: null,
  };
  s.retests.push(r);
  return r;
}
const overview = (s) => analyze(s, period, [{ id: "W001", album: 1 }]);
const journey = (s) => learningJourney(s, overview(s), now);

test("B01/B03/B06 independent courses and versions remain visible; one actionable recommendation per course", () => {
  const s = state();
  s.bundles = [
    bundle("old"),
    bundle("new", { createdAt: "2026-10-12T01:00:00Z" }),
  ];
  s.learning.reviews = [
    {
      id: "r",
      wordId: "W001",
      result: "vague",
      studiedAt: "2026-10-13T04:00:00Z",
    },
  ];
  let j = journey(s);
  assert.equal(j.summaries.length, 2);
  assert.deepEqual(j.home.actionIds, ["old", "new"]);
  assert.deepEqual(j.home.preparationWordIds, []);
  event(s, "new", "study", "concepts");
  j = journey(s);
  assert.equal(j.home.actionIds[0], "new");
  assert.equal(j.summaries[0].progress.stage, "reading");
});
test("B07/B08/B09/B25 reading completion and independent answers are separate facts", () => {
  const s = state(),
    b = bundle("course");
  s.bundles = [b];
  assert.equal(courseProgress(b, s, today).stage, "concepts");
  event(s, b.id, "study", "concepts");
  assert.equal(courseProgress(b, s, today).stage, "reading");
  event(s, b.id, "study", "reading");
  assert.equal(courseProgress(b, s, today).stage, "practice");
  answer(s, b.id, "q1");
  assert.equal(courseProgress(b, s, today).stage, "in-progress");
  answer(s, b.id, "q2", true, true);
  const p = courseProgress(b, s, today);
  assert.equal(p.complete, true);
  assert.equal(p.correctCount, 2);
  assert.deepEqual(p.independent, { correct: 1, total: 1 });
  assert.deepEqual(p.passedWordIds, []);
  assert.equal(p.pendingSuggestionCount, 1);
});
test("B10/B17 flagged questions cannot create empty completion or usable retest material", () => {
  const s = state(),
    b = bundle("retest", { retestId: "r1" });
  s.bundles = [b];
  schedule(s, "r1");
  event(s, b.id, "flag", "q1");
  assert.equal(journey(s).retests[0].readyBundleId, null);
  assert.deepEqual(journey(s).home.preparationRetestIds, ["r1"]);
  event(s, b.id, "flag", "q2");
  const p = courseProgress(b, s, today);
  assert.equal(p.stage, "checking");
  assert.equal(p.complete, false);
  assert.equal(p.validCount, 0);
  assert.equal(p.pendingSuggestionCount, 0);
});
test("B04/B05/B12/B15 retest chooses started material, groups cards and disables completed alternatives", () => {
  const s = state();
  s.bundles = [
    bundle("started", { retestId: "r1" }),
    bundle("fresh", { retestId: "r1", createdAt: "2026-10-12T01:00:00Z" }),
  ];
  const r = schedule(s, "r1");
  answer(s, "started", "q1");
  let j = journey(s);
  assert.equal(j.retests[0].readyBundleId, "started");
  assert.deepEqual(j.home.actionIds, ["started"]);
  r.completedAt = now;
  r.completedBundleId = "fresh";
  j = journey(s);
  assert.equal(
    j.summaries.find((x) => x.id === "started").progress.stage,
    "elsewhere",
  );
  assert.deepEqual(
    j.summaries.find((x) => x.id === "started").progress.completedElsewhereIds,
    ["fresh"],
  );
  assert.ok(!j.home.actionIds.includes("started"));
});
test("B11/B14 legacy practice and ordinary correct answers are not cross-day passes", () => {
  const s = state(),
    b = bundle("legacy", { withLesson: false });
  s.bundles = [b];
  assert.equal(courseProgress(b, s, today).stage, "practice");
  answer(s, b.id, "q1");
  answer(s, b.id, "q2");
  const p = courseProgress(b, s, today);
  assert.equal(p.complete, true);
  assert.deepEqual(p.passedWordIds, ["W001"]);
  assert.deepEqual(p.retestPassedWordIds, []);
  assert.equal(p.pendingSuggestionCount, 0);
});
test("B13/B21 old suggested dates roll forward; explicit schedules still retain their original dates", () => {
  const s = state(),
    b = bundle("course", { withLesson: false });
  s.bundles = [b];
  answer(s, b.id, "q1", false);
  answer(s, b.id, "q2");
  s.events.forEach((e) => (e.createdAt = "2026-10-10T01:00:00Z"));
  assert.equal(currentSuggestions(b, s, today)[0].suggestedDate, "2026-10-14");
  schedule(s, "confirmed", b.id, "2026-10-12");
  assert.equal(journey(s).retests[0].scheduledDate, "2026-10-12");
});
test("B19/B22 all uncovered words are retained and no answers means no invented accuracy", () => {
  const s = state();
  s.learning.reviews = Array.from({ length: 7 }, (_, i) => ({
    id: "r" + i,
    wordId: "W00" + (i + 1),
    result: "vague",
    studiedAt: "2026-10-13T04:00:00Z",
  }));
  const o = analyze(
    s,
    period,
    s.learning.reviews.map((r) => ({ id: r.wordId, album: 1 })),
  );
  const j = learningJourney(s, o, now);
  assert.equal(j.home.preparationWordIds.length, 7);
  assert.equal(j.summaries.length, 0);
  assert.equal(o.metrics.firstAccuracy.total, 0);
});
test("B28/B31 completed work with unprocessed suggestions remains actionable until confirmed or skipped", () => {
  const s = state(),
    b = bundle("course", { withLesson: false });
  s.bundles = [b];
  answer(s, b.id, "q1", false);
  answer(s, b.id, "q2");
  let j = journey(s);
  assert.equal(j.summaries[0].progress.complete, true);
  assert.deepEqual(j.home.actionIds, ["course"]);
  assert.equal(j.summaries[0].progress.action, "继续确认复习安排");
  schedule(s, "r1", b.id, "2026-10-14").decision = "skipped";
  j = journey(s);
  assert.deepEqual(j.home.actionIds, []);
  assert.equal(j.summaries[0].progress.complete, true);
});
test("B04/B15 future retest material is ready but not actionable until Beijing due date", () => {
  const s = state(),
    b = bundle("retest", { retestId: "r1" });
  s.bundles = [b];
  schedule(s, "r1", "source", "2026-10-14");
  let j = journey(s);
  assert.equal(j.retests[0].readyBundleId, b.id);
  assert.deepEqual(j.home.actionIds, []);
  assert.equal(j.summaries[0].progress.stage, "waiting");
  const tomorrow = dayStart("2026-10-14");
  j = learningJourney(s, overview(s), tomorrow);
  assert.deepEqual(j.home.actionIds, [b.id]);
});

test("B12 mixed course keeps the open schedule actionable and creates only its follow-up", () => {
  const s = state(),
    b = bundle("mixed", { retestId: "r1" });
  b.content.exercise.targets.push({
    wordId: "W002",
    usage: "write",
    retestId: "r2",
    evidenceIds: [],
  });
  b.content.exercise.questions.push({
    id: "q3",
    wordIds: ["W002"],
    type: "meaning",
  });
  s.bundles = [b];
  const done = schedule(s, "r1");
  done.completedAt = now;
  done.completedBundleId = "another";
  const open = schedule(s, "r2");
  open.wordId = "W002";
  assert.equal(courseProgress(b, s, today).nextQuestionId, "q3");
  assert.deepEqual(journey(s).home.actionIds, [b.id]);
  answer(s, b.id, "q3", false);
  open.completedAt = now;
  open.completedBundleId = b.id;
  assert.equal(courseProgress(b, s, today).complete, true);
  assert.deepEqual(
    currentSuggestions(b, s, today).map((x) => x.wordId),
    ["W002"],
  );
  assert.equal(courseProgress(b, s, today).pendingSuggestionCount, 1);
  assert.ok(
    questionAccess(b, b.content.exercise.questions[0], s, today).blocked,
  );
});

test("B15 missing or declined schedules never allow submission", () => {
  const s = state(),
    b = bundle("invalid", { retestId: "missing" });
  assert.equal(
    questionAccess(b, b.content.exercise.questions[0], s, today).blocked,
    "这项复测尚未确认。",
  );
  schedule(s, "missing").decision = "skipped";
  assert.equal(
    questionAccess(b, b.content.exercise.questions[0], s, today).blocked,
    "这项复测尚未确认。",
  );
});

test("B19 preparation uses latest self-review regardless of input ordering", () => {
  const s = state(),
    b = bundle("old");
  s.bundles = [b];
  s.learning.reviews = [
    {
      id: "latest",
      wordId: "W001",
      result: "vague",
      studiedAt: "2026-10-13T04:00:00Z",
    },
    {
      id: "r",
      wordId: "W001",
      result: "vague",
      studiedAt: "2026-10-12T04:00:00Z",
    },
  ];
  assert.deepEqual(journey(s).home.preparationWordIds, ["W001"]);
  b.content.exercise.targets[0].evidenceIds.push("review:latest");
  assert.deepEqual(journey(s).home.preparationWordIds, []);
});
