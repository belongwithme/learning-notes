import { createHash, randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import catalog from "../../data/english.json" with { type: "json" };
import { db, HttpError } from "./server.ts";
import { learningDay } from "./model.ts";
import {
  analyze,
  firstAnswers,
  periodFor,
  suggestionsFor,
  type Bundle,
  type Snapshot,
  type PracticeEvent,
} from "./practice-model.ts";
import {
  contextInputSchema,
  mutationSchema,
  normalizeAnswer,
  saveSchema,
  validateContent,
  type ContextInput,
} from "./practice-schema.ts";

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object")
    return `{${Object.entries(value)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`)
      .join(",")}}`;
  return JSON.stringify(value);
}
const hash = (v: unknown) =>
  createHash("sha256").update(canonical(v)).digest("hex");
const retestSelect = `SELECT id, source_bundle_id AS "sourceBundleId", word_id AS "wordId", usage, stage, suggested_date AS "suggestedDate", scheduled_date AS "scheduledDate", decision, manual_date AS "manualDate", manual_choice AS "manualChoice", confirmed_at AS "confirmedAt", completed_bundle_id AS "completedBundleId", completed_at AS "completedAt" FROM english_retests`;
const iso = <T>(value: T): T => JSON.parse(JSON.stringify(value));
async function snapshot(
  client: PoolClient,
  cutoff = "9999-01-01T00:00:00Z",
): Promise<Snapshot> {
  const progress = await client.query(
    `SELECT word_id AS "wordId", status, priority, planned_date AS "plannedDate", due_date AS "dueDate", '' AS note, version FROM english_progress`,
  );
  const reviews = await client.query(
    `SELECT id, word_id AS "wordId", result, studied_at AS "studiedAt" FROM english_reviews WHERE studied_at < $1 ORDER BY studied_at,id`,
    [cutoff],
  );
  const bundles = await client.query(
    `SELECT id,version,content,context,created_at AS "createdAt" FROM english_bundles WHERE created_at < $1 ORDER BY created_at,id`,
    [cutoff],
  );
  const events = await client.query(
    `SELECT id,sequence,bundle_id AS "bundleId", kind, question_id AS "questionId",payload,created_at AS "createdAt" FROM english_practice_events WHERE created_at < $1 ORDER BY sequence`,
    [cutoff],
  );
  const retests = await client.query(
    `${retestSelect} WHERE confirmed_at < $1 ORDER BY confirmed_at,id`,
    [cutoff],
  );
  return iso({
    learning: {
      progress: Object.fromEntries(progress.rows.map((p) => [p.wordId, p])),
      reviews: reviews.rows,
    },
    bundles: bundles.rows.map((b) => ({
      id: b.id,
      version: b.version,
      content: b.content,
      period: b.context.facts.period,
      facts: b.context.facts,
      createdAt: b.createdAt,
    })),
    events: events.rows.map((e) => ({ ...e, sequence: Number(e.sequence) })),
    retests: retests.rows,
  });
}
async function transaction<T>(
  write: boolean,
  work: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await db().connect();
  try {
    await client.query(
      write ? "BEGIN" : "BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY",
    );
    // One personal learner; serialize short writes to make first answers and schedules deterministic.
    if (write) await client.query("SELECT pg_advisory_xact_lock(74812631)");
    const result = await work(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
function buildContext(input: ContextInput, state: Snapshot) {
  const cutoff = input.cutoff!;
  const period = periodFor(input.kind, input.date, cutoff);
  if (Date.parse(period.start) >= Date.parse(cutoff))
    throw new HttpError(400, "分析周期尚未开始。");
  const facts = analyze(state, period, catalog.entries);
  const selected = new Set([
    ...facts.evidence.flatMap((e) => e.wordIds),
    ...facts.unknownDateWordIds,
    ...input.includeWordIds,
    ...state.retests
      .filter((r) => r.decision === "accepted" && !r.completedAt)
      .map((r) => r.wordId),
  ]);
  const words = catalog.entries
    .filter((e) => selected.has(e.id))
    .map((e) => ({
      id: e.id,
      term: e.term,
      album: e.album,
      meaning: e.meaning,
      example: e.example,
      priority: state.learning.progress[e.id]?.priority ?? "medium",
      status: state.learning.progress[e.id]?.status ?? "new",
      plannedDate: state.learning.progress[e.id]?.plannedDate ?? "",
      dueDate: state.learning.progress[e.id]?.dueDate ?? "",
      assessment: facts.unknownDateWordIds.includes(e.id)
        ? "历史日期未知"
        : facts.assessedWordIds.includes(e.id)
          ? "已有学习证据；旧掌握状态为自评"
          : "尚未评估",
    }));
  const relevantBundles = state.bundles.filter((b) =>
    b.content.exercise.targets.some((t) => selected.has(t.wordId)),
  );
  const history = relevantBundles.map((b) => ({
    id: b.id,
    version: b.version,
    period: b.period,
    content: b.content,
    events: state.events.filter((e) => e.bundleId === b.id),
  }));
  const retests = state.retests.map((r) => ({
    ...r,
    completedAt:
      r.completedAt && Date.parse(r.completedAt) < Date.parse(cutoff)
        ? r.completedAt
        : null,
    completedBundleId:
      r.completedAt && Date.parse(r.completedAt) < Date.parse(cutoff)
        ? r.completedBundleId
        : null,
  }));
  const sourceHash = hash({
    evidence: facts.evidence,
    words,
    retests,
    include: input.includeWordIds,
    exclude: input.excludeWordIds,
    goal: input.goal,
    mode: input.mode,
  });
  const data = {
    schemaVersion: 1 as const,
    input,
    facts,
    words,
    history,
    retests,
    preferences: {
      goal: input.goal ?? state.bundles.at(-1)?.content.exercise.goal ?? "java",
      mode:
        input.mode ?? state.bundles.at(-1)?.content.exercise.mode ?? "short",
    },
    sourceHash,
    dataUse:
      "本次将选定词条、学习自评、客观题作答、提示与反馈、既有报告和复测安排交给 Codex 分析；不包含私人笔记、个人口令或数据库凭据。",
  };
  return { ...data, contextHash: hash(data) };
}
export async function readLearningContext(raw: unknown) {
  const input = contextInputSchema.parse(raw);
  input.cutoff = input.cutoff
    ? new Date(input.cutoff).toISOString()
    : new Date().toISOString();
  if (Date.parse(input.cutoff) > Date.now())
    throw new HttpError(400, "数据截止时间不能在未来。");
  if (input.includeWordIds.some((id) => input.excludeWordIds.includes(id)))
    throw new HttpError(400, "同一词条不能同时补练和排除。");
  return transaction(false, async (client) =>
    buildContext(input, await snapshot(client, input.cutoff)),
  );
}
const pathFor = (id: string) => `/english/?view=analysis&report=${id}`;
export async function findSavedRequest(requestId: string) {
  if (!/^[a-f0-9-]{36}$/i.test(requestId))
    throw new HttpError(400, "请求编号无效。");
  const result = await db().query(
    "SELECT id,version,content,context FROM english_bundles WHERE id=COALESCE((SELECT bundle_id FROM english_operations WHERE id=$1),$1::uuid)",
    [requestId],
  );
  const row = result.rows[0];
  return row
    ? {
        saved: true,
        requestId,
        bundleId: row.id,
        version: row.version,
        path: pathFor(row.id),
        content: row.content,
        facts: row.context.facts,
      }
    : { saved: false, requestId };
}
export async function saveLearningContent(raw: unknown) {
  const request = saveSchema.parse(raw),
    payloadHash = hash(request);
  if (
    !request.context.cutoff ||
    Date.parse(request.context.cutoff) > Date.now()
  )
    throw new HttpError(400, "保存必须使用读取工具返回的截止时间。");
  const saved = await transaction(true, async (client) => {
    // Check the same request before re-reading: an uncertain commit can be recovered unchanged.
    const prior = await client.query(
      "SELECT bundle_id AS id,payload_hash FROM english_operations WHERE id=$1",
      [request.requestId],
    );
    if (prior.rowCount) {
      if (prior.rows[0].payload_hash !== payloadHash || !prior.rows[0].id)
        throw new HttpError(
          409,
          "请求编号已对应不同内容，请使用新的请求编号。",
        );
      return { id: prior.rows[0].id as string, reused: true };
    }
    const state = await snapshot(client, request.context.cutoff);
    const context = buildContext(request.context, state);
    if (context.contextHash !== request.contextHash)
      throw new HttpError(
        409,
        "学习依据已变化，请重新读取上下文再生成；原内容尚未保存。",
      );
    validateContent(request.content, context.facts, state, request.context);
    // Recheck current correction and schedule state, even if generation used an older cutoff.
    const current = await snapshot(client);
    const flagged = new Set(
      current.events
        .filter((e) => e.kind === "flag")
        .map((e) => `${e.bundleId}/${e.questionId}`),
    );
    const validAnswerRefs = new Set(
      current.events
        .filter(
          (e) =>
            e.kind === "answer" &&
            !flagged.has(`${e.bundleId}/${e.questionId}`),
        )
        .map((e) => `answer:${e.id}`),
    );
    for (const item of [
      ...request.content.exercise.targets,
      ...request.content.findings,
    ]) {
      if (
        item.evidenceIds.some(
          (ref) => ref.startsWith("answer:") && !validAnswerRefs.has(ref),
        )
      )
        throw new HttpError(409, "引用题目已被标记待核对，请重新读取上下文。");
    }
    for (const target of request.content.exercise.targets) {
      if (
        target.retestId &&
        current.retests.find((r) => r.id === target.retestId)?.completedAt
      )
        throw new HttpError(409, "该复测已在另一设备完成，请重新读取上下文。");
    }
    if (!request.regenerate) {
      const duplicate = await client.query(
        `SELECT id FROM english_bundles WHERE period_kind=$1 AND period_start=$2 AND context->>'sourceHash'=$3 ORDER BY version DESC LIMIT 1`,
        [request.context.kind, context.facts.period.start, context.sourceHash],
      );
      if (duplicate.rowCount) {
        await client.query(
          "INSERT INTO english_operations(id,payload_hash,bundle_id) VALUES($1,$2,$3)",
          [request.requestId, payloadHash, duplicate.rows[0].id],
        );
        return { id: duplicate.rows[0].id as string, reused: true };
      }
    }
    const version = await client.query(
      "SELECT COALESCE(MAX(version),0)+1 AS version FROM english_bundles WHERE period_kind=$1 AND period_start=$2",
      [request.context.kind, context.facts.period.start],
    );
    await client.query(
      `INSERT INTO english_bundles(id,period_kind,period_start,period_end,cutoff,version,content,context) VALUES($1,$2,$3,$4,$5,$6,$7,$8)`,
      [
        request.requestId,
        request.context.kind,
        context.facts.period.start,
        context.facts.period.end,
        request.context.cutoff,
        version.rows[0].version,
        JSON.stringify(request.content),
        JSON.stringify({
          facts: context.facts,
          sourceHash: context.sourceHash,
          contextHash: context.contextHash,
        }),
      ],
    );
    await client.query(
      "INSERT INTO english_operations(id,payload_hash,bundle_id) VALUES($1,$2,$3)",
      [request.requestId, payloadHash, request.requestId],
    );
    return { id: request.requestId, reused: false };
  });
  const readback = await findSavedRequest(request.requestId);
  if (!readback.saved)
    throw new HttpError(503, "保存结果尚未确认，请按相同请求编号查询。");
  return { ...readback, reused: saved.reused, readbackVerified: true };
}
function publicBundle(bundle: Bundle, state: Snapshot) {
  const events = state.events.filter((e) => e.bundleId === bundle.id);
  const materialRevealed = events.some(
    (e) => e.kind === "hint" && e.questionId === "*",
  );
  const ex = bundle.content.exercise;
  return {
    ...bundle,
    content: {
      ...bundle.content,
      exercise: {
        ...ex,
        translation: materialRevealed ? ex.translation : "",
        examples: ex.examples.map((e) => ({
          ...e,
          translation: materialRevealed ? e.translation : "",
        })),
        questions: ex.questions.map((q) => {
          const history = events.filter((e) => e.questionId === q.id);
          const attempts = history.filter((e) => e.kind === "answer");
          const revealed =
            attempts.length > 0 || history.some((e) => e.kind === "reveal");
          return {
            ...q,
            answers: revealed ? q.answers : [],
            explanation: revealed ? q.explanation : "",
            hint: history.some((e) => e.kind === "hint") ? q.hint : "",
            attempts,
            assisted:
              materialRevealed ||
              history.some((e) => e.kind === "hint" || e.kind === "reveal"),
            flagged: history.some((e) => e.kind === "flag"),
          };
        }),
      },
    },
    feedback: events.filter((e) => e.kind === "feedback"),
    materialRevealed,
    suggestions: suggestionsFor(bundle, state),
    schedules: state.retests.filter((r) => r.sourceBundleId === bundle.id),
  };
}
export async function loadPractice(reportId?: string) {
  return transaction(false, async (client) => {
    const state = await snapshot(client),
      now = new Date().toISOString();
    const overview = analyze(
      state,
      periodFor("day", learningDay(now), now),
      catalog.entries,
    );
    const summaries = state.bundles
      .map((b) => ({
        id: b.id,
        version: b.version,
        title: b.content.title,
        period: b.period,
        createdAt: b.createdAt,
        mode: b.content.exercise.mode,
        targetCount: b.content.exercise.targets.length,
        questionCount: b.content.exercise.questions.length,
        answeredCount: new Set(
          state.events
            .filter((e) => e.bundleId === b.id && e.kind === "answer")
            .map((e) => e.questionId),
        ).size,
        hasNewRecords:
          state.learning.reviews.some(
            (r) =>
              Date.parse(r.studiedAt) >= Date.parse(b.period.start) &&
              Date.parse(r.studiedAt) < Date.parse(b.period.end) &&
              Date.parse(r.studiedAt) >= Date.parse(b.period.cutoff),
          ) ||
          state.events.some(
            (e) =>
              Date.parse(e.createdAt) >= Date.parse(b.period.cutoff) &&
              Date.parse(e.createdAt) >= Date.parse(b.period.start) &&
              Date.parse(e.createdAt) < Date.parse(b.period.end),
          ),
      }))
      .reverse();
    const retests = state.retests.map((r) => ({
      ...r,
      readyBundleId:
        r.completedAt || r.decision !== "accepted"
          ? null
          : (state.bundles.findLast(
              (b) =>
                b.content.exercise.targets.some((t) => t.retestId === r.id) &&
                b.content.exercise.questions
                  .filter((q) => q.wordIds.includes(r.wordId))
                  .some(
                    (q) =>
                      !state.events.some(
                        (e) =>
                          e.bundleId === b.id &&
                          e.questionId === q.id &&
                          ["answer", "flag"].includes(e.kind),
                      ),
                  ),
            )?.id ?? null),
    }));
    const bundle = reportId
      ? state.bundles.find((b) => b.id === reportId)
      : undefined;
    if (reportId && !bundle) throw new HttpError(404, "这份报告不存在。");
    return {
      summaries,
      retests,
      overview,
      bundle: bundle ? publicBundle(bundle, state) : null,
    };
  });
}
export async function mutatePractice(raw: unknown) {
  const action = mutationSchema.parse(raw),
    payloadHash = hash({ scope: "practice", ...action });
  await transaction(true, async (client) => {
    const op = await client.query(
      "INSERT INTO english_operations(id,payload_hash) VALUES($1,$2) ON CONFLICT DO NOTHING RETURNING id",
      [action.operationId, payloadHash],
    );
    if (!op.rowCount) {
      const prior = await client.query(
        "SELECT payload_hash FROM english_operations WHERE id=$1",
        [action.operationId],
      );
      if (prior.rows[0].payload_hash !== payloadHash)
        throw new HttpError(409, "操作编号已对应不同内容。");
      return;
    }
    const state = await snapshot(client);
    const bundle = state.bundles.find((b) => b.id === action.bundleId);
    if (!bundle) throw new HttpError(404, "练习不存在。");
    const events = state.events.filter((e) => e.bundleId === bundle.id);
    if (action.action === "schedule") {
      const existing = state.retests.find(
        (r) => r.sourceBundleId === bundle.id && r.wordId === action.wordId,
      );
      if (existing) {
        if (
          existing.decision === action.decision &&
          existing.scheduledDate === action.scheduledDate &&
          existing.manualChoice === action.manualChoice
        )
          return;
        throw new HttpError(409, "该建议已处理，请刷新查看已确认的安排。");
      }
      const proposal = suggestionsFor(bundle, state).find(
        (s) => s.wordId === action.wordId,
      );
      if (!proposal)
        throw new HttpError(400, "请先完成练习；当前没有这条有效复测建议。");
      const manual = await client.query(
        "SELECT due_date FROM english_progress WHERE word_id=$1 FOR UPDATE",
        [action.wordId],
      );
      proposal.manualDate = manual.rows[0]?.due_date ?? "";
      if (action.manualDate !== proposal.manualDate)
        throw new HttpError(409, "手工复习日期已变化，请刷新后重新选择。");
      if (
        action.decision === "accepted" &&
        action.scheduledDate <= learningDay()
      )
        throw new HttpError(400, "复测应安排在下一自然日或之后。");
      if (
        action.manualChoice === "keep" &&
        (!proposal.manualDate || action.scheduledDate !== proposal.manualDate)
      )
        throw new HttpError(400, "保留手工安排时必须使用原日期。");
      if (
        action.manualChoice === "suggested" &&
        action.scheduledDate !== proposal.suggestedDate
      )
        throw new HttpError(400, "建议日期已变化，请刷新。");
      await client.query(
        `INSERT INTO english_retests(id,source_bundle_id,word_id,usage,stage,suggested_date,scheduled_date,decision,manual_date,manual_choice) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [
          randomUUID(),
          bundle.id,
          proposal.wordId,
          proposal.usage,
          proposal.stage,
          proposal.suggestedDate,
          action.scheduledDate,
          action.decision,
          proposal.manualDate,
          action.manualChoice,
        ],
      );
      return;
    }
    const question = bundle.content.exercise.questions.find(
      (q) => q.id === action.questionId,
    );
    if (
      !question &&
      !(action.action === "hint" && action.questionId === "*") &&
      !(action.action === "feedback" && !action.questionId)
    )
      throw new HttpError(400, "题目不属于此练习版本。");
    let payload: PracticeEvent["payload"] = {};
    if (action.action === "answer") {
      if (
        events.some((e) => e.kind === "flag" && e.questionId === question!.id)
      )
        throw new HttpError(409, "此题正在核对，请完成其他题目。");
      const attempts = events.filter(
        (e) => e.kind === "answer" && e.questionId === question!.id,
      );
      if (attempts.length !== action.expectedAttempt)
        throw new HttpError(
          409,
          "此题已在另一设备作答，请刷新后查看已保存答案。",
        );
      const schedules = bundle.content.exercise.targets
        .filter((t) => question!.wordIds.includes(t.wordId) && t.retestId)
        .map((t) => state.retests.find((r) => r.id === t.retestId)!);
      if (
        schedules.some(
          (r) =>
            r.scheduledDate > learningDay() ||
            (r.completedAt && r.completedBundleId !== bundle.id),
        )
      )
        throw new HttpError(
          409,
          "复测尚未到期或已在另一份练习完成，请刷新安排。",
        );
      const assisted =
        attempts.length > 0 ||
        events.some(
          (e) =>
            (e.questionId === question!.id || e.questionId === "*") &&
            ["hint", "reveal"].includes(e.kind),
        );
      if (
        question!.format === "choice" &&
        !question!.options.some((o) => o.id === action.answer)
      )
        throw new HttpError(400, "请选择题目提供的选项。");
      payload = {
        answer: action.answer,
        correct: question!.answers.some((a) =>
          question!.format === "choice"
            ? a === action.answer
            : normalizeAnswer(a) === normalizeAnswer(action.answer),
        ),
        assisted,
        attempt: attempts.length + 1,
      };
    } else if (action.action === "flag") {
      if (!action.reason)
        throw new HttpError(400, "请说明题目有误或歧义的原因。");
      payload = { reason: action.reason };
    } else if (action.action === "feedback") {
      const allowed = new Set(
        bundle.content.exercise.targets.map((t) => t.wordId),
      );
      if (action.vagueWordIds?.some((id) => !allowed.has(id)))
        throw new HttpError(400, "反馈词条不属于本练习。");
      if (
        !action.difficulty &&
        !action.difficultyType &&
        !action.vagueWordIds?.length
      )
        throw new HttpError(400, "请选择反馈内容。");
      payload = {
        difficulty: action.difficulty,
        difficultyType: action.difficultyType,
        vagueWordIds: action.vagueWordIds,
      };
    }
    await client.query(
      `INSERT INTO english_practice_events(id,bundle_id,kind,question_id,payload) VALUES($1,$2,$3,$4,$5)`,
      [
        action.operationId,
        bundle.id,
        action.action,
        action.questionId,
        JSON.stringify(payload),
      ],
    );
    if (action.action === "flag") {
      for (const t of bundle.content.exercise.targets.filter(
        (t) => question!.wordIds.includes(t.wordId) && t.retestId,
      ))
        await client.query(
          "UPDATE english_retests SET completed_at=NULL,completed_bundle_id=NULL WHERE id=$1 AND completed_bundle_id=$2",
          [t.retestId, bundle.id],
        );
    }
    if (action.action === "answer") {
      const updated = await snapshot(client);
      const first = firstAnswers(updated).filter(
        (e) => e.bundleId === bundle.id,
      );
      for (const target of bundle.content.exercise.targets.filter(
        (t) => t.retestId,
      )) {
        const questions = bundle.content.exercise.questions.filter((q) =>
          q.wordIds.includes(target.wordId),
        );
        const schedule = updated.retests.find((r) => r.id === target.retestId)!;
        const sourceAnswers = firstAnswers(updated).filter(
          (e) => e.bundleId === schedule.sourceBundleId,
        );
        const source = updated.bundles.find(
          (b) => b.id === schedule.sourceBundleId,
        )!;
        const initial = sourceAnswers.filter((e) =>
          source.content.exercise.questions.some(
            (q) => q.id === e.questionId && q.wordIds.includes(target.wordId),
          ),
        );
        if (
          questions.every((q) => first.some((e) => e.questionId === q.id)) &&
          initial.length > 0 &&
          initial.every((e) => learningDay(e.createdAt) < learningDay())
        )
          await client.query(
            "UPDATE english_retests SET completed_at=now(),completed_bundle_id=$2 WHERE id=$1 AND completed_at IS NULL",
            [target.retestId, bundle.id],
          );
      }
    }
  });
  return loadPractice(action.bundleId);
}
export type PracticeData = Awaited<ReturnType<typeof loadPractice>>;
