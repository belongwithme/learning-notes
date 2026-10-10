import { learningDay, type LearningData } from "./model.ts";

export type PeriodKind = "day" | "week" | "month";
export interface Period {
  kind: PeriodKind;
  start: string;
  end: string;
  cutoff: string;
  complete: boolean;
  comparison: { start: string; end: string };
}
export interface Target {
  wordId: string;
  usage: string;
  meaning: string;
  extension: boolean;
  reason: string;
  evidenceIds: string[];
  retestId?: string;
}
export interface Question {
  id: string;
  type: "meaning" | "collocation" | "comprehension";
  format: "choice" | "text";
  prompt: string;
  context: string;
  wordIds: string[];
  options: { id: string; text: string }[];
  answers: string[];
  explanation: string;
  hint: string;
}
export interface StudyExample {
  english: string;
  translation: string;
  note: string;
}
export interface Lesson {
  title: string;
  objectives: string[];
  estimatedMinutes: number;
  words: {
    wordId: string;
    explanation: string;
    usageNotes: string[];
    examples: StudyExample[];
    contrast: { left: StudyExample; right: StudyExample; explanation: string };
  }[];
  reading: {
    title: string;
    passage: string;
    translation: string;
    sentences: {
      sentence: string;
      translation: string;
      chunks: { text: string; explanation: string }[];
      takeaway: string;
    }[];
    source: { kind: "generated" | "excerpt"; url?: string; title?: string };
  };
  takeaways: string[];
}
export interface Content {
  title: string;
  summary: string;
  findings: {
    kind: "fact" | "hypothesis" | "suggestion";
    text: string;
    wordIds: string[];
    evidenceIds: string[];
  }[];
  nextSteps: string[];
  // Older immutable reports predate the guided lesson. New saves require it.
  lesson?: Lesson;
  exercise: {
    mode: "short" | "standard";
    goal: "java" | "general";
    difficulty: string;
    targets: Target[];
    passage: string;
    translation: string;
    examples: { wordIds: string[]; english: string; translation: string }[];
    questions: Question[];
    source: { kind: "generated" | "excerpt"; url?: string; title?: string };
  };
  replaces?: { bundleId: string; questionId: string; reason: string }[];
}
export interface PracticeEvent {
  id: string;
  sequence: number;
  bundleId: string;
  kind: "answer" | "hint" | "reveal" | "flag" | "feedback" | "study";
  questionId: string;
  payload: {
    answer?: string;
    correct?: boolean;
    assisted?: boolean;
    attempt?: number;
    difficulty?: "too-hard" | "suitable" | "too-easy";
    difficultyType?: "meaning" | "collocation" | "comprehension";
    vagueWordIds?: string[];
    reason?: string;
  };
  createdAt: string;
}
export interface Retest {
  id: string;
  sourceBundleId: string;
  wordId: string;
  usage: string;
  stage: number;
  suggestedDate: string;
  scheduledDate: string;
  decision: "accepted" | "skipped";
  manualDate: string;
  manualChoice: "keep" | "suggested" | "custom";
  confirmedAt: string;
  completedBundleId: string | null;
  completedAt: string | null;
}
export interface Bundle {
  id: string;
  version: number;
  period: Period;
  content: Content;
  facts: Analysis;
  createdAt: string;
}
export interface Evidence {
  id: string;
  kind: "self-review" | "answer" | "feedback" | "retest";
  wordIds: string[];
  at: string;
  result: string;
  questionType?: Question["type"];
  bundleId?: string;
  questionId?: string;
  independent?: boolean;
  retest?: boolean;
  initialAt?: string;
}
export interface Snapshot {
  learning: LearningData;
  bundles: Bundle[];
  events: PracticeEvent[];
  retests: Retest[];
}
export function studyFor(bundle: Bundle, events: PracticeEvent[]) {
  const lesson = bundle.content.lesson;
  const required =
    !!lesson && !bundle.content.exercise.targets.some((t) => t.retestId);
  const progress = events.filter(
    (e) => e.bundleId === bundle.id && e.kind === "study",
  );
  const conceptsAt =
    progress.find((e) => e.questionId === "concepts")?.createdAt ?? null;
  const completedAt =
    progress.find((e) => e.questionId === "reading")?.createdAt ?? null;
  return {
    hasLesson: !!lesson,
    title: lesson?.title ?? "",
    estimatedMinutes: lesson?.estimatedMinutes ?? 0,
    required,
    conceptsAt,
    completedAt,
    stage: (!required || completedAt
      ? "practice"
      : conceptsAt
        ? "reading"
        : "concepts") as "concepts" | "reading" | "practice",
  };
}
export interface Metrics {
  selfReviewWords: number;
  selfReviews: number;
  practiceWords: number;
  firstAccuracy: { correct: number; total: number };
  retestAccuracy: { correct: number; total: number };
  coveredDays: string[];
  questionTypes: { type: Question["type"]; correct: number; total: number }[];
}
export interface Candidate {
  wordId: string;
  reasons: ("due" | "repeated" | "recent" | "stabilizing")[];
  unstableDays: string[];
  lastAt: string;
  evidenceIds: string[];
  priority: string;
}
export interface Analysis {
  period: Period;
  observationStart: string;
  metrics: Metrics;
  previousMetrics: Metrics;
  candidates: Candidate[];
  stabilizing: Candidate[];
  unknownDateWordIds: string[];
  assessedWordIds: string[];
  evidence: Evidence[];
  weakThemes: { album: number; wordIds: string[] }[];
  retestCohort: {
    wordIds: string[];
    sampleCount: number;
    intervalsDays: number[];
  };
  hasRecords: boolean;
}
export interface Suggestion {
  wordId: string;
  usage: string;
  stage: number;
  suggestedDate: string;
  manualDate: string;
  reason: string;
}

const DAY = 86_400_000;
export const addDays = (day: string, days: number) =>
  new Date(Date.parse(`${day}T00:00:00Z`) + days * DAY)
    .toISOString()
    .slice(0, 10);
export const dayStart = (day: string) =>
  new Date(`${day}T00:00:00+08:00`).toISOString();
const before = (at: string, limit: string) =>
  Date.parse(at) < Date.parse(limit);
const within = (at: string, start: string, end: string) =>
  !before(at, start) && before(at, end);
export function periodFor(
  kind: PeriodKind,
  day: string,
  cutoff: string,
): Period {
  let startDay = day,
    endDay = addDays(day, 1),
    previousDay = addDays(day, -1);
  if (kind === "week") {
    const weekday = new Date(`${day}T00:00:00Z`).getUTCDay();
    startDay = addDays(day, -((weekday + 6) % 7));
    endDay = addDays(startDay, 7);
    previousDay = addDays(startDay, -7);
  } else if (kind === "month") {
    startDay = `${day.slice(0, 7)}-01`;
    const date = new Date(`${startDay}T00:00:00Z`);
    date.setUTCMonth(date.getUTCMonth() + 1);
    endDay = date.toISOString().slice(0, 10);
    date.setUTCMonth(date.getUTCMonth() - 2);
    previousDay = date.toISOString().slice(0, 10);
  }
  const start = dayStart(startDay),
    end = dayStart(endDay),
    previous = dayStart(previousDay);
  const elapsed = Math.max(
    0,
    Math.min(Date.parse(end), Date.parse(cutoff)) - Date.parse(start),
  );
  const complete = !before(cutoff, end);
  return {
    kind,
    start,
    end,
    cutoff,
    complete,
    comparison: {
      start: previous,
      end: complete
        ? start
        : new Date(
            Math.min(Date.parse(start), Date.parse(previous) + elapsed),
          ).toISOString(),
    },
  };
}
export function firstAnswers(
  snapshot: Snapshot,
  cutoff = "9999-01-01T00:00:00Z",
) {
  const flagged = new Set(
    snapshot.events
      .filter((e) => e.kind === "flag" && before(e.createdAt, cutoff))
      .map((e) => `${e.bundleId}/${e.questionId}`),
  );
  const seen = new Set<string>();
  return snapshot.events
    .filter((e) => e.kind === "answer" && before(e.createdAt, cutoff))
    .sort((a, b) => a.sequence - b.sequence)
    .filter((e) => {
      const key = `${e.bundleId}/${e.questionId}`;
      if (seen.has(key) || flagged.has(key)) return false;
      seen.add(key);
      return true;
    });
}
export function evidenceFor(snapshot: Snapshot, cutoff: string): Evidence[] {
  const bundles = new Map(snapshot.bundles.map((b) => [b.id, b]));
  const first = firstAnswers(snapshot, cutoff);
  const firstIds = new Set(first.map((e) => e.id));
  const flagged = new Set(
    snapshot.events
      .filter((e) => e.kind === "flag" && before(e.createdAt, cutoff))
      .map((e) => `${e.bundleId}/${e.questionId}`),
  );
  const evidence: Evidence[] = snapshot.learning.reviews
    .filter((r) => before(r.studiedAt, cutoff))
    .map((r) => ({
      id: `review:${r.id}`,
      kind: "self-review",
      wordIds: [r.wordId],
      at: r.studiedAt,
      result: r.result,
    }));
  for (const e of snapshot.events.filter(
    (e) =>
      e.kind === "answer" &&
      before(e.createdAt, cutoff) &&
      !flagged.has(`${e.bundleId}/${e.questionId}`),
  )) {
    const bundle = bundles.get(e.bundleId),
      q = bundle?.content.exercise.questions.find((q) => q.id === e.questionId);
    if (!bundle || !q) continue;
    const targets = bundle.content.exercise.targets.filter((t) =>
      q.wordIds.includes(t.wordId),
    );
    const schedules = targets.map((t) =>
      snapshot.retests.find((r) => r.id === t.retestId),
    );
    // A retest item has one unambiguous target, a confirmed schedule and a later Beijing day.
    const r = q.wordIds.length === 1 ? schedules[0] : undefined;
    const sourceAnswers = r
      ? first.filter((a) => a.bundleId === r.sourceBundleId)
      : [];
    const sourceQuestions = r
      ? (bundles
          .get(r.sourceBundleId)
          ?.content.exercise.questions.filter((q) =>
            q.wordIds.includes(r.wordId),
          )
          .map((q) => q.id) ?? [])
      : [];
    const source = sourceAnswers
      .filter((a) => sourceQuestions.includes(a.questionId))
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))[0];
    const retest = !!(
      firstIds.has(e.id) &&
      r &&
      r.decision === "accepted" &&
      source &&
      learningDay(source.createdAt) < learningDay(e.createdAt) &&
      learningDay(e.createdAt) >= r.scheduledDate
    );
    evidence.push({
      id: `answer:${e.id}`,
      kind: "answer",
      wordIds: q.wordIds,
      at: e.createdAt,
      result: e.payload.correct ? "correct" : "incorrect",
      independent: firstIds.has(e.id) && !e.payload.assisted,
      questionType: q.type,
      bundleId: e.bundleId,
      questionId: q.id,
      retest,
      ...(retest ? { initialAt: source!.createdAt } : {}),
    });
  }
  for (const e of snapshot.events.filter(
    (e) => e.kind === "feedback" && before(e.createdAt, cutoff),
  )) {
    const q = bundles
      .get(e.bundleId)
      ?.content.exercise.questions.find((q) => q.id === e.questionId);
    evidence.push({
      id: `feedback:${e.id}`,
      kind: "feedback",
      wordIds:
        e.payload.vagueWordIds ??
        q?.wordIds ??
        bundles
          .get(e.bundleId)
          ?.content.exercise.targets.map((t) => t.wordId) ??
        [],
      at: e.createdAt,
      result: JSON.stringify(e.payload),
      bundleId: e.bundleId,
      questionId: e.questionId,
    });
  }
  for (const r of snapshot.retests.filter((r) => before(r.confirmedAt, cutoff)))
    evidence.push({
      id: `retest:${r.id}`,
      kind: "retest",
      wordIds: [r.wordId],
      at: r.confirmedAt,
      result: `${r.decision}:${r.scheduledDate}`,
    });
  return evidence.sort(
    (a, b) => Date.parse(a.at) - Date.parse(b.at) || a.id.localeCompare(b.id),
  );
}
function metrics(evidence: Evidence[], start: string, end: string): Metrics {
  const rows = evidence.filter((e) => within(e.at, start, end));
  const reviews = rows.filter((e) => e.kind === "self-review");
  const answers = rows.filter((e) => e.kind === "answer");
  const independent = answers.filter((e) => e.independent);
  const retests = independent.filter((e) => e.retest);
  const accuracy = (rows: Evidence[]) => ({
    correct: rows.filter((e) => e.result === "correct").length,
    total: rows.length,
  });
  return {
    selfReviewWords: new Set(reviews.flatMap((r) => r.wordIds)).size,
    selfReviews: reviews.length,
    practiceWords: new Set(answers.flatMap((r) => r.wordIds)).size,
    firstAccuracy: accuracy(independent),
    retestAccuracy: accuracy(retests),
    coveredDays: [
      ...new Set([...reviews, ...answers].map((e) => learningDay(e.at))),
    ].sort(),
    questionTypes: (["meaning", "collocation", "comprehension"] as const).map(
      (type) => ({
        type,
        ...accuracy(independent.filter((e) => e.questionType === type)),
      }),
    ),
  };
}
export function analyze(
  snapshot: Snapshot,
  period: Period,
  catalog: { id: string; album: number }[],
): Analysis {
  const evidence = evidenceFor(snapshot, period.cutoff);
  // Historical reports observe the 30 natural days ending in that period, not today's date.
  const effectiveEnd = new Date(
    Math.min(Date.parse(period.end), Date.parse(period.cutoff)),
  ).toISOString();
  const lastDay = learningDay(new Date(Date.parse(effectiveEnd) - 1));
  const observationStart = dayStart(addDays(lastDay, -29));
  const observed = evidence.filter((e) =>
    within(e.at, observationStart, effectiveEnd),
  );
  const candidates: Candidate[] = [],
    stabilizing: Candidate[] = [];
  const priorityOrder = { high: 0, medium: 1, low: 2 };
  for (const entry of catalog) {
    const rows = observed.filter((e) => e.wordIds.includes(entry.id));
    const valid = rows.filter(
      (e) =>
        e.kind === "self-review" ||
        (e.kind === "answer" && e.independent && e.wordIds.length === 1),
    );
    const unstable = valid.filter((e) =>
      ["forgot", "vague", "incorrect"].includes(e.result),
    );
    const lastBad = unstable.at(-1);
    const successful = valid.filter(
      (e) =>
        e.kind === "answer" &&
        e.retest &&
        e.result === "correct" &&
        lastBad &&
        before(lastBad.at, e.at),
    );
    const stable = !!(
      lastBad &&
      new Set(successful.map((e) => learningDay(e.at))).size >= 2 &&
      successful.some(
        (e) =>
          Date.parse(learningDay(e.at)) - Date.parse(learningDay(lastBad.at)) >=
          7 * DAY,
      )
    );
    const days = [...new Set(unstable.map((e) => learningDay(e.at)))];
    const due = snapshot.retests.some(
      (r) =>
        r.wordId === entry.id &&
        r.decision === "accepted" &&
        before(r.confirmedAt, effectiveEnd) &&
        r.scheduledDate <= lastDay &&
        (!r.completedAt || !before(r.completedAt, effectiveEnd)),
    );
    const reasons: Candidate["reasons"] = [];
    if (due) reasons.push("due");
    if (stable) reasons.push("stabilizing");
    else if (days.length >= 2) reasons.push("repeated");
    else if (
      ["forgot", "vague"].includes(
        valid.filter((e) => e.kind === "self-review").at(-1)?.result ?? "",
      ) ||
      valid.filter((e) => e.kind === "answer").at(-1)?.result === "incorrect"
    )
      reasons.push("recent");
    const candidate = {
      wordId: entry.id,
      reasons,
      unstableDays: days,
      lastAt: valid.at(-1)?.at ?? "",
      evidenceIds: rows.map((e) => e.id),
      priority: snapshot.learning.progress[entry.id]?.priority ?? "medium",
    };
    if (stable) stabilizing.push(candidate);
    if (reasons.some((r) => r !== "stabilizing")) candidates.push(candidate);
  }
  candidates.sort((a, b) => {
    const group = (c: Candidate) =>
      c.reasons.includes("due") ? 0 : c.reasons.includes("repeated") ? 1 : 2;
    return (
      group(a) - group(b) ||
      priorityOrder[a.priority as keyof typeof priorityOrder] -
        priorityOrder[b.priority as keyof typeof priorityOrder] ||
      b.unstableDays.length - a.unstableDays.length ||
      a.lastAt.localeCompare(b.lastAt) ||
      a.wordId.localeCompare(b.wordId)
    );
  });
  const assessedWordIds = [
    ...new Set(
      evidence
        .filter(
          (e) =>
            ["self-review", "answer"].includes(e.kind) &&
            before(e.at, effectiveEnd),
        )
        .flatMap((e) => e.wordIds),
    ),
  ];
  const themes = [...new Set(catalog.map((e) => e.album))]
    .map((album) => ({
      album,
      wordIds: candidates
        .filter(
          (c) =>
            c.reasons.some((r) => r === "repeated" || r === "recent") &&
            catalog.some((e) => e.id === c.wordId && e.album === album),
        )
        .map((c) => c.wordId),
    }))
    .filter((t) => t.wordIds.length >= 5);
  const retestRows = evidence.filter(
    (e) =>
      e.kind === "answer" &&
      e.independent &&
      e.retest &&
      within(e.at, period.start, effectiveEnd),
  );
  return {
    period,
    observationStart,
    metrics: metrics(evidence, period.start, effectiveEnd),
    previousMetrics: metrics(
      evidence,
      period.comparison.start,
      period.comparison.end,
    ),
    candidates,
    stabilizing,
    unknownDateWordIds: Object.values(snapshot.learning.progress)
      .filter((p) => p.status !== "new" && !assessedWordIds.includes(p.wordId))
      .map((p) => p.wordId),
    assessedWordIds,
    evidence: evidence.filter(
      (e) =>
        before(e.at, effectiveEnd) &&
        (!before(e.at, observationStart) ||
          within(e.at, period.comparison.start, period.comparison.end)),
    ),
    weakThemes: themes,
    retestCohort: {
      wordIds: [...new Set(retestRows.flatMap((e) => e.wordIds))],
      sampleCount: retestRows.length,
      intervalsDays: retestRows.map(
        (e) =>
          (Date.parse(learningDay(e.at)) -
            Date.parse(learningDay(e.initialAt!))) /
          DAY,
      ),
    },
    hasRecords: evidence.some(
      (e) =>
        ["self-review", "answer"].includes(e.kind) &&
        before(e.at, effectiveEnd),
    ),
  };
}
export function suggestionsFor(
  bundle: Bundle,
  snapshot: Snapshot,
): Suggestion[] {
  const first = firstAnswers(snapshot).filter((e) => e.bundleId === bundle.id);
  const flagged = new Set(
    snapshot.events
      .filter((e) => e.bundleId === bundle.id && e.kind === "flag")
      .map((e) => e.questionId),
  );
  if (
    bundle.content.exercise.questions.some(
      (q) => !flagged.has(q.id) && !first.some((e) => e.questionId === q.id),
    )
  )
    return [];
  const vague = new Set(
    snapshot.events
      .filter(
        (e) =>
          e.bundleId === bundle.id &&
          e.kind === "feedback" &&
          e.payload.vagueWordIds !== undefined,
      )
      .at(-1)?.payload.vagueWordIds ?? [],
  );
  const completionDay = first.length
    ? learningDay(
        new Date(Math.max(...first.map((e) => Date.parse(e.createdAt)))),
      )
    : "";
  if (!completionDay) return [];
  return bundle.content.exercise.targets.flatMap((t) => {
    const questions = bundle.content.exercise.questions.filter((q) =>
      q.wordIds.includes(t.wordId),
    );
    if (questions.some((q) => flagged.has(q.id))) return [];
    const answers = first.filter((e) =>
      questions.some((q) => q.id === e.questionId),
    );
    const uncertain =
      vague.has(t.wordId) ||
      answers.some(
        (e) =>
          e.payload.assisted ||
          (!e.payload.correct &&
            questions.some(
              (q) => q.id === e.questionId && q.wordIds.length === 1,
            )),
      );
    const previous = snapshot.retests.find((r) => r.id === t.retestId);
    const passed =
      previous?.completedBundleId === bundle.id &&
      answers.length > 0 &&
      answers.every((e) => e.payload.correct && !e.payload.assisted) &&
      !uncertain;
    if (!uncertain && !passed) return [];
    const stage = passed ? previous!.stage + 1 : 0;
    if (stage > 2) return [];
    return [
      {
        wordId: t.wordId,
        usage: t.usage,
        stage,
        suggestedDate: addDays(completionDay, [1, 3, 7][stage]),
        manualDate: snapshot.learning.progress[t.wordId]?.dueDate ?? "",
        reason: passed
          ? "新语境复测通过，建议继续跨日检验。"
          : vague.has(t.wordId)
            ? "你反馈仍然模糊。"
            : "本次存在单词级错误或使用提示，建议换语境复测。",
      },
    ];
  });
}
