import { learningDay } from "./model.ts";
import {
  addDays,
  firstAnswers,
  studyFor,
  suggestionsFor,
  type Analysis,
  type Bundle,
  type Question,
  type Snapshot,
} from "./practice-model.ts";

export const courseStages = {
  concepts: "待学习",
  reading: "待精读",
  practice: "待练习",
  "in-progress": "练习中",
  completed: "练习已完成",
  checking: "待核对",
  elsewhere: "已在其他课程完成",
  waiting: "尚未到期",
} as const;

export function currentSuggestions(
  bundle: Bundle,
  state: Snapshot,
  today: string,
) {
  // An alternative version may contain both already-completed and still-open
  // schedules. Only the latter can create a new follow-up from this course.
  const completedElsewhere = new Set(
    bundle.content.exercise.targets
      .filter(
        (target) =>
          target.retestId &&
          state.retests.some(
            (schedule) =>
              schedule.id === target.retestId &&
              schedule.completedAt &&
              schedule.completedBundleId !== bundle.id,
          ),
      )
      .map((target) => target.wordId),
  );
  const eligible = completedElsewhere.size
    ? {
        ...bundle,
        content: {
          ...bundle.content,
          exercise: {
            ...bundle.content.exercise,
            targets: bundle.content.exercise.targets.filter(
              (target) => !completedElsewhere.has(target.wordId),
            ),
            questions: bundle.content.exercise.questions.filter(
              (question) =>
                !question.wordIds.some((id) => completedElsewhere.has(id)),
            ),
          },
        },
      }
    : bundle;
  return suggestionsFor(eligible, state).map((suggestion) => ({
    ...suggestion,
    suggestedDate:
      suggestion.suggestedDate <= today
        ? addDays(today, 1)
        : suggestion.suggestedDate,
  }));
}

/** One authoritative eligibility check for recommendation, rendering and submission. */
export function questionAccess(
  bundle: Bundle,
  question: Question,
  state: Snapshot,
  today: string,
) {
  const flagged = state.events.some(
    (event) =>
      event.bundleId === bundle.id &&
      event.questionId === question.id &&
      event.kind === "flag",
  );
  const schedules = bundle.content.exercise.targets
    .filter(
      (target) => target.retestId && question.wordIds.includes(target.wordId),
    )
    .map((target) =>
      state.retests.find((schedule) => schedule.id === target.retestId),
    );
  const elsewhere = schedules.find(
    (schedule) =>
      schedule?.completedAt && schedule.completedBundleId !== bundle.id,
  );
  const future = schedules.find(
    (schedule) => schedule && schedule.scheduledDate > today,
  );
  return {
    flagged,
    completedBundleId: elsewhere?.completedBundleId ?? null,
    blocked: flagged
      ? "这道题正在核对，原答案仍可回看。"
      : elsewhere
        ? "该安排已在其他课程完成。"
        : schedules.some(
              (schedule) => !schedule || schedule.decision !== "accepted",
            )
          ? "这项复测尚未确认。"
          : future
            ? `复测尚未到期，请在 ${future.scheduledDate} 再来。`
            : null,
  };
}

export function courseProgress(bundle: Bundle, state: Snapshot, today: string) {
  const events = state.events.filter((event) => event.bundleId === bundle.id);
  const study = studyFor(bundle, events);
  const questions = bundle.content.exercise.questions;
  const access = new Map(
    questions.map((q) => [q.id, questionAccess(bundle, q, state, today)]),
  );
  const valid = questions.filter((q) => !access.get(q.id)!.flagged);
  const available = valid.filter((q) => !access.get(q.id)!.blocked);
  const answers = firstAnswers(state).filter(
    (event) => event.bundleId === bundle.id,
  );
  const answered = new Map(
    answers.map((answer) => [answer.questionId, answer]),
  );
  const next = available.find((q) => !answered.has(q.id));
  const schedules = state.retests.filter(
    (schedule) => schedule.sourceBundleId === bundle.id,
  );
  const pendingSuggestions = currentSuggestions(bundle, state, today).filter(
    (suggestion) =>
      !schedules.some((schedule) => schedule.wordId === suggestion.wordId),
  );
  const complete =
    available.length > 0 &&
    available.every((q) => answered.has(q.id)) &&
    !valid.some(
      (q) => access.get(q.id)!.blocked && !access.get(q.id)!.completedBundleId,
    );
  const stage: keyof typeof courseStages = !valid.length
    ? "checking"
    : valid.every((q) => access.get(q.id)!.completedBundleId)
      ? "elsewhere"
      : study.stage !== "practice"
        ? study.stage
        : complete
          ? "completed"
          : next
            ? answers.length
              ? "in-progress"
              : "practice"
            : "waiting";
  const independent = answers.filter((answer) => !answer.payload.assisted);
  const vague =
    events
      .filter(
        (event) =>
          event.kind === "feedback" && event.payload.vagueWordIds !== undefined,
      )
      .at(-1)?.payload.vagueWordIds ?? [];
  const passedTargets = bundle.content.exercise.targets.filter((target) => {
    const targetQuestions = questions.filter((q) =>
      q.wordIds.includes(target.wordId),
    );
    return (
      !vague.includes(target.wordId) &&
      targetQuestions.length > 0 &&
      targetQuestions.every(
        (q) =>
          !access.get(q.id)!.blocked &&
          answered.get(q.id)?.payload.correct &&
          !answered.get(q.id)?.payload.assisted,
      )
    );
  });
  const lastActivity =
    [
      ...events
        .filter((event) => ["study", "answer"].includes(event.kind))
        .map((event) => event.createdAt),
      ...schedules.map((schedule) => schedule.confirmedAt),
    ]
      .sort()
      .at(-1) ?? "";
  return {
    stage,
    label:
      complete && valid.length < questions.length
        ? "有效题已完成，部分题待核对"
        : courseStages[stage],
    study,
    isRetest: bundle.content.exercise.targets.some((target) => target.retestId),
    validCount: valid.length,
    answeredCount: answers.length,
    flaggedCount: questions.length - valid.length,
    correctCount: answers.filter((answer) => answer.payload.correct).length,
    independent: {
      correct: independent.filter((answer) => answer.payload.correct).length,
      total: independent.length,
    },
    passedWordIds: passedTargets.map((target) => target.wordId),
    retestPassedWordIds: passedTargets
      .filter(
        (target) =>
          target.retestId &&
          state.retests.some(
            (schedule) =>
              schedule.id === target.retestId &&
              schedule.completedAt &&
              schedule.completedBundleId === bundle.id,
          ),
      )
      .map((target) => target.wordId),
    complete,
    lastActivity,
    pendingSuggestionCount: pendingSuggestions.length,
    nextQuestionId: next?.id ?? null,
    completedElsewhereIds: [
      ...new Set(
        valid.flatMap((q) => access.get(q.id)!.completedBundleId ?? []),
      ),
    ],
    action: pendingSuggestions.length
      ? "继续确认复习安排"
      : stage === "concepts"
        ? "开始学习"
        : stage === "reading"
          ? "继续精读"
          : next
            ? answers.length
              ? "继续练习"
              : "开始练习"
            : "查看结果",
  };
}

export function learningJourney(
  state: Snapshot,
  overview: Analysis,
  now: string,
) {
  const today = learningDay(now);
  const progress = new Map(
    state.bundles.map((bundle) => [
      bundle.id,
      courseProgress(bundle, state, today),
    ]),
  );
  const priority = (id: string) =>
    ({ high: 0, medium: 1, low: 2 })[
      state.learning.progress[id]?.priority ?? "medium"
    ];
  const retests = state.retests.map((schedule) => {
    const candidates = state.bundles
      .filter((bundle) => {
        if (schedule.completedAt || schedule.decision !== "accepted")
          return false;
        if (
          !bundle.content.exercise.targets.some(
            (target) => target.retestId === schedule.id,
          )
        )
          return false;
        const questions = bundle.content.exercise.questions.filter((q) =>
          q.wordIds.includes(schedule.wordId),
        );
        // A partially flagged target cannot be completed, even if another question is unanswered.
        return (
          questions.length > 0 &&
          questions.every(
            (q) => !questionAccess(bundle, q, state, today).flagged,
          ) &&
          questions.some(
            (q) =>
              !state.events.some(
                (event) =>
                  event.bundleId === bundle.id &&
                  event.questionId === q.id &&
                  event.kind === "answer",
              ),
          )
        );
      })
      .sort((a, b) => {
        const pa = progress.get(a.id)!,
          pb = progress.get(b.id)!;
        return (
          Number(!!pb.lastActivity) - Number(!!pa.lastActivity) ||
          pb.lastActivity.localeCompare(pa.lastActivity) ||
          b.createdAt.localeCompare(a.createdAt) ||
          a.id.localeCompare(b.id)
        );
      });
    return { ...schedule, readyBundleId: candidates[0]?.id ?? null };
  });
  const candidates = new Map(
    overview.candidates.map((candidate) => [candidate.wordId, candidate]),
  );
  const summaries = state.bundles
    .map((bundle) => {
      const p = progress.get(bundle.id)!;
      const targets = bundle.content.exercise.targets;
      const relevant = targets.flatMap(
        (target) => candidates.get(target.wordId) ?? [],
      );
      const due = retests.filter(
        (schedule) =>
          schedule.readyBundleId === bundle.id &&
          schedule.scheduledDate <= today,
      );
      const outstanding = retests.filter(
        (schedule) =>
          schedule.sourceBundleId === bundle.id &&
          schedule.decision === "accepted" &&
          !schedule.completedAt,
      );
      const group = due.length
        ? 0
        : p.pendingSuggestionCount ||
            (!p.isRetest &&
              p.lastActivity &&
              !p.complete &&
              p.stage !== "checking")
          ? 1
          : relevant.some((candidate) =>
                candidate.reasons.some((reason) =>
                  ["repeated", "recent"].includes(reason),
                ),
              )
            ? 2
            : 3;
      const actionable =
        p.pendingSuggestionCount > 0 ||
        due.length > 0 ||
        (!p.isRetest &&
          !p.complete &&
          ["concepts", "reading", "practice", "in-progress"].includes(p.stage));
      const reason = due.length
        ? `${due.length} 项已确认复测到期，已有新语境练习`
        : p.pendingSuggestionCount
          ? `${p.pendingSuggestionCount} 项复习建议尚未确认`
          : group === 1
            ? `上次已保存，${p.action}`
            : group === 2
              ? relevant.some((candidate) =>
                  candidate.reasons.includes("repeated"),
                )
                ? "目标词在不同日期反复不稳"
                : "目标词近期需要巩固"
              : "这门课程尚未学习";
      return {
        id: bundle.id,
        title: bundle.content.title,
        period: bundle.period,
        version: bundle.version,
        createdAt: bundle.createdAt,
        mode: bundle.content.exercise.mode,
        wordIds: targets.map((target) => target.wordId),
        targetCount: targets.length,
        questionCount: p.validCount,
        answeredCount: p.answeredCount,
        progress: p,
        actionable,
        reason,
        group,
        dueDate: due.map((schedule) => schedule.scheduledDate).sort()[0] ?? "",
        priority: Math.min(
          2,
          ...targets.map((target) => priority(target.wordId)),
        ),
        repeated: relevant.some((candidate) =>
          candidate.reasons.includes("repeated"),
        ),
        evidenceIds: [
          ...new Set(relevant.flatMap((candidate) => candidate.evidenceIds)),
        ],
        pendingRetestCount: outstanding.length,
        dueRetestCount: outstanding.filter(
          (schedule) => schedule.scheduledDate <= today,
        ).length,
        estimatedMinutes: bundle.content.lesson?.estimatedMinutes ?? null,
        practiceMinutes:
          bundle.content.exercise.estimatedMinutes ??
          (bundle.content.exercise.mode === "short" ? 5 : 15),
        replaces: bundle.content.replaces ?? [],
        replacedByIds: state.bundles
          .filter((other) =>
            other.content.replaces?.some(
              (replacement) => replacement.bundleId === bundle.id,
            ),
          )
          .map((other) => other.id),
      };
    })
    .sort(
      (a, b) =>
        b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id),
    );
  const actions = summaries
    .filter((summary) => summary.actionable)
    .sort(
      (a, b) =>
        a.group - b.group ||
        (a.group === 0
          ? a.dueDate.localeCompare(b.dueDate) || a.priority - b.priority
          : a.group === 1
            ? b.progress.lastActivity.localeCompare(a.progress.lastActivity)
            : a.group === 2
              ? Number(b.repeated) - Number(a.repeated) ||
                a.priority - b.priority
              : 0) ||
        a.createdAt.localeCompare(b.createdAt) ||
        a.id.localeCompare(b.id),
    );
  const latestReviews = new Map(
    [...state.learning.reviews]
      .sort(
        (a, b) =>
          a.studiedAt.localeCompare(b.studiedAt) || b.id.localeCompare(a.id),
      )
      .map((review) => [review.wordId, review]),
  );
  const preparationWordIds = overview.candidates
    .filter((candidate) =>
      candidate.reasons.some((reason) =>
        ["recent", "repeated"].includes(reason),
      ),
    )
    .filter(
      (candidate) =>
        !state.bundles.some((bundle) => {
          const target = bundle.content.exercise.targets.find(
            (target) => target.wordId === candidate.wordId,
          );
          const latest = latestReviews.get(candidate.wordId);
          const evidenceId =
            latest && ["forgot", "vague"].includes(latest.result)
              ? `review:${latest.id}`
              : candidate.evidenceIds.at(-1);
          return (
            target &&
            bundle.content.lesson?.words.some(
              (word) => word.wordId === candidate.wordId,
            ) &&
            (!evidenceId || target.evidenceIds.includes(evidenceId)) &&
            bundle.content.exercise.questions
              .filter((q) => q.wordIds.includes(candidate.wordId))
              .every((q) => !questionAccess(bundle, q, state, today).flagged)
          );
        }),
    )
    .map((candidate) => candidate.wordId);
  return {
    summaries,
    retests,
    home: {
      asOf: now,
      actionIds: actions.map((action) => action.id),
      continueId: actions.find((action) => action.group === 1)?.id ?? null,
      preparationWordIds,
      preparationRetestIds: retests
        .filter(
          (schedule) =>
            schedule.decision === "accepted" &&
            !schedule.completedAt &&
            !schedule.readyBundleId,
        )
        .map((schedule) => schedule.id),
      hasRecords: overview.hasRecords,
    },
  };
}
