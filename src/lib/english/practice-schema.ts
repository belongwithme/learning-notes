import { z } from "astro/zod";
import catalog from "../../data/english.json" with { type: "json" };
import { isDate } from "./model.ts";
import { HttpError } from "./server.ts";
import type { Analysis, Content, Snapshot } from "./practice-model.ts";

const ids = new Set(catalog.entries.map((e) => e.id));
export const wordId = z
  .string()
  .refine((id) => ids.has(id), "词条不在当前词库中");
const text = z.string().trim().min(1).max(4000);
const wordIds = z
  .array(wordId)
  .min(1)
  .max(8)
  .refine((a) => new Set(a).size === a.length, "词条不可重复");
const refs = z.array(z.string().max(120)).max(100);
export const date = z.string().refine((v) => !!v && isDate(v), "日期无效");
export const contextInputSchema = z
  .object({
    kind: z.enum(["day", "week", "month"]),
    date,
    cutoff: z.iso.datetime({ offset: true }).optional(),
    includeWordIds: z.array(wordId).max(8).default([]),
    excludeWordIds: z.array(wordId).max(1500).default([]),
    goal: z.enum(["java", "general"]).optional(),
    mode: z.enum(["short", "standard"]).optional(),
  })
  .strict();
export type ContextInput = z.infer<typeof contextInputSchema>;
const questionSchema = z
  .object({
    id: z.string().regex(/^[a-zA-Z0-9_-]{1,50}$/),
    type: z.enum(["meaning", "collocation", "comprehension"]),
    format: z.enum(["choice", "text"]),
    prompt: text,
    context: text,
    wordIds,
    options: z
      .array(
        z
          .object({ id: z.string().regex(/^[A-Za-z0-9_-]{1,30}$/), text })
          .strict(),
      )
      .max(6),
    answers: z.array(text).min(1).max(12),
    explanation: text,
    hint: text,
  })
  .strict();
const sourceSchema = z
  .object({
    kind: z.enum(["generated", "excerpt"]),
    url: z
      .url()
      .refine((v) => /^https?:\/\//.test(v))
      .optional(),
    title: text.optional(),
  })
  .strict();
const studyExample = z
  .object({ english: text, translation: text, note: text })
  .strict();
const lessonSchema = z
  .object({
    title: text,
    objectives: z.array(text).min(1).max(5),
    estimatedMinutes: z.number().int().min(1).max(60),
    words: z
      .array(
        z
          .object({
            wordId,
            explanation: text,
            usageNotes: z.array(text).min(1).max(5),
            examples: z.array(studyExample).min(2).max(4),
            contrast: z
              .object({
                left: studyExample,
                right: studyExample,
                explanation: text,
              })
              .strict(),
          })
          .strict(),
      )
      .min(1)
      .max(8),
    reading: z
      .object({
        title: text,
        passage: text,
        translation: text,
        sentences: z
          .array(
            z
              .object({
                sentence: text,
                translation: text,
                chunks: z
                  .array(z.object({ text, explanation: text }).strict())
                  .min(2)
                  .max(8),
                takeaway: text,
              })
              .strict(),
          )
          .min(2)
          .max(8),
        source: sourceSchema,
      })
      .strict(),
    takeaways: z.array(text).min(1).max(5),
  })
  .strict();
export const contentSchema = z
  .object({
    title: text,
    summary: text,
    findings: z
      .array(
        z
          .object({
            kind: z.enum(["fact", "hypothesis", "suggestion"]),
            text,
            wordIds: z.array(wordId).max(8),
            evidenceIds: refs,
          })
          .strict(),
      )
      .min(1)
      .max(20),
    nextSteps: z.array(text).min(1).max(10),
    lesson: lessonSchema,
    exercise: z
      .object({
        mode: z.enum(["short", "standard"]),
        goal: z.enum(["java", "general"]),
        difficulty: text,
        targets: z
          .array(
            z
              .object({
                wordId,
                usage: text,
                meaning: text,
                extension: z.boolean(),
                reason: text,
                evidenceIds: refs,
                retestId: z.uuid().optional(),
              })
              .strict(),
          )
          .min(1)
          .max(8),
        passage: text,
        translation: text,
        examples: z
          .array(
            z.object({ wordIds, english: text, translation: text }).strict(),
          )
          .min(1)
          .max(16),
        questions: z.array(questionSchema).min(3).max(5),
        source: sourceSchema,
      })
      .strict(),
    replaces: z
      .array(
        z
          .object({ bundleId: z.uuid(), questionId: text, reason: text })
          .strict(),
      )
      .max(5)
      .optional(),
  })
  .strict();
export const saveSchema = z
  .object({
    schemaVersion: z.literal(2),
    requestId: z.uuid(),
    context: contextInputSchema,
    contextHash: z.string().regex(/^[a-f0-9]{64}$/),
    regenerate: z.boolean().default(false),
    content: contentSchema,
  })
  .strict();
export const mutationSchema = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("study"),
      operationId: z.uuid(),
      bundleId: z.uuid(),
      questionId: z.enum(["concepts", "reading"]),
    })
    .strict(),
  z
    .object({
      action: z.literal("answer"),
      operationId: z.uuid(),
      bundleId: z.uuid(),
      questionId: text,
      answer: text,
      expectedAttempt: z.number().int().min(0),
    })
    .strict(),
  z
    .object({
      action: z.enum(["hint", "reveal", "flag"]),
      operationId: z.uuid(),
      bundleId: z.uuid(),
      questionId: text,
      reason: z.string().trim().min(1).max(1000).optional(),
    })
    .strict(),
  z
    .object({
      action: z.literal("feedback"),
      operationId: z.uuid(),
      bundleId: z.uuid(),
      questionId: z.string().max(50).default(""),
      difficulty: z.enum(["too-hard", "suitable", "too-easy"]).optional(),
      difficultyType: z
        .enum(["meaning", "collocation", "comprehension"])
        .optional(),
      vagueWordIds: z.array(wordId).max(8).optional(),
    })
    .strict(),
  z
    .object({
      action: z.literal("schedule"),
      operationId: z.uuid(),
      bundleId: z.uuid(),
      wordId,
      decision: z.enum(["accepted", "skipped"]),
      scheduledDate: date,
      manualDate: z.string().refine(isDate),
      manualChoice: z.enum(["keep", "suggested", "custom"]),
    })
    .strict(),
]);
export const normalizeAnswer = (s: string) =>
  s.normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase("en-US");
export function validateContent(
  content: Content,
  facts: Analysis,
  snapshot: Snapshot,
  input: ContextInput,
) {
  const fail = (message: string): never => {
    throw new HttpError(400, message);
  };
  const ex = content.exercise;
  const lesson =
    content.lesson ?? fail("请先提供完整学习讲解与精读内容，再保存随附练习。");
  const lessonIds = lesson.words.map((w) => w.wordId);
  if (
    lessonIds.length !== ex.targets.length ||
    new Set(lessonIds).size !== lessonIds.length ||
    ex.targets.some((t) => !lessonIds.includes(t.wordId))
  )
    fail("每个目标词都必须有一份对应的学习讲解。");
  const normalize = normalizeAnswer;
  if (normalize(lesson.reading.passage) === normalize(ex.passage))
    fail("精读语料与课后练习须使用不同语境。");
  for (const sentence of lesson.reading.sentences) {
    if (
      !normalize(lesson.reading.passage).includes(
        normalize(sentence.sentence),
      ) ||
      sentence.chunks.some(
        (chunk) =>
          !normalize(sentence.sentence).includes(normalize(chunk.text)),
      )
    )
      fail("句子拆解必须对应精读原文，分块必须来自所拆句子。");
  }
  const taughtContexts = [
    lesson.reading.passage,
    ...lesson.reading.sentences.map((s) => s.sentence),
    ...lesson.words.flatMap((w) =>
      [...w.examples, w.contrast.left, w.contrast.right].map((e) => e.english),
    ),
  ];
  if (
    ex.questions.some((q) =>
      taughtContexts.some((c) => normalize(c).includes(normalize(q.context))),
    )
  )
    fail("课后题必须换用未在讲解中直接出现的语境，不能照搬例句。");
  if (!facts.hasRecords) fail("暂无可用学习记录，请先学习后再生成个人分析。");
  if (
    ex.targets.length > (ex.mode === "short" ? 5 : 8) ||
    ex.questions.length !== (ex.mode === "short" ? 3 : 5)
  )
    fail("目标词数量或题量不符合所选练习模式。");
  if (
    (input.goal && input.goal !== ex.goal) ||
    (input.mode && input.mode !== ex.mode)
  )
    fail("内容与请求中的学习目标或练习模式不一致。");
  const words = ex.passage.match(/[A-Za-z]+(?:['’-][A-Za-z]+)*/g)?.length ?? 0;
  const [min, max] = ex.mode === "short" ? [80, 120] : [150, 220];
  if (words < min || words > max)
    fail(`短文须包含 ${min} 至 ${max} 个英文词，当前为 ${words}。`);
  const targetIds = new Set(ex.targets.map((t) => t.wordId));
  if (
    targetIds.size !== ex.targets.length ||
    new Set(ex.questions.map((q) => q.id)).size !== ex.questions.length
  )
    fail("目标词或题目编号重复。");
  if (
    input.excludeWordIds.some((id) => targetIds.has(id)) ||
    input.includeWordIds.some((id) => !targetIds.has(id))
  )
    fail("内容未遵守指定的补练或排除词条。");
  for (const source of [ex.source, lesson.reading.source]) {
    if (source.kind === "excerpt" && (!source.url || !source.title))
      fail("真实摘录必须附来源标题与 URL。");
    if (source.kind === "generated" && source.url)
      fail("生成材料不得包装成来源原文。");
  }
  const checkRefs = (refs: string[], words: string[], required: boolean) => {
    if (required && refs.length === 0) fail("事实结论和推荐必须引用学习证据。");
    for (const ref of refs) {
      const e = facts.evidence.find((e) => e.id === ref);
      if (!e || (words.length && !e.wordIds.some((id) => words.includes(id))))
        fail(`证据不存在、已被排除或与目标不匹配：${ref}`);
    }
    if (
      required &&
      words.some(
        (id) =>
          !refs.some((ref) =>
            facts.evidence.some((e) => e.id === ref && e.wordIds.includes(id)),
          ),
      )
    )
      fail("每个结论词条都必须有对应证据。");
  };
  for (const f of content.findings)
    checkRefs(f.evidenceIds, f.wordIds, f.kind === "fact");
  for (const t of ex.targets) {
    const word = catalog.entries.find((e) => e.id === t.wordId)!;
    checkRefs(
      t.evidenceIds,
      [t.wordId],
      !input.includeWordIds.includes(t.wordId),
    );
    if (!t.extension && t.meaning !== word.meaning)
      fail(`${t.wordId} 的目标含义须沿用词库，扩展含义须明确标记。`);
    const contexts = [
      ex.passage,
      ...ex.examples
        .filter((e) => e.wordIds.includes(t.wordId))
        .map((e) => e.english),
      ...ex.questions
        .filter((q) => q.wordIds.includes(t.wordId))
        .map((q) => q.context),
    ];
    const term = normalizeAnswer(word.term).replace(
      /[.*+?^${}()|[\]\\]/g,
      "\\$&",
    );
    const taught = lesson.words.find((w) => w.wordId === t.wordId)!;
    if (
      !taught.examples.every((example) =>
        new RegExp(`(^|[^a-z])${term}([^a-z]|$)`, "i").test(
          normalize(example.english),
        ),
      )
    )
      fail(`${t.wordId} 的学习例句须包含目标词。`);
    if (
      !contexts.some((c) =>
        new RegExp(`(^|[^a-z])${term}([^a-z]|$)`, "i").test(normalizeAnswer(c)),
      ) ||
      !ex.questions.some((q) => q.wordIds.includes(t.wordId))
    )
      fail(`${t.wordId} 缺少对应语境或考查题目。`);
    if (t.retestId) {
      const r = snapshot.retests.find((r) => r.id === t.retestId);
      const source = snapshot.bundles.find((b) => b.id === r?.sourceBundleId);
      if (
        !r ||
        !source ||
        r.decision !== "accepted" ||
        r.completedAt ||
        r.wordId !== t.wordId ||
        r.usage !== t.usage
      )
        fail("复测须对应未完成的已确认安排及相同目标用法。");
      const original = source!.content.exercise.targets.find(
        (old) => old.wordId === t.wordId,
      )!;
      if (original.meaning !== t.meaning || original.extension !== t.extension)
        fail("复测不得更换目标含义。");
      const qs = ex.questions.filter((q) => q.wordIds.includes(t.wordId));
      if (qs.some((q) => q.wordIds.length !== 1))
        fail("复测题须能定位单个目标词。");
      const seen = snapshot.bundles.filter(
        (b) =>
          b.id === source!.id ||
          (b.content.exercise.targets.some(
            (old) => old.wordId === t.wordId && old.usage === t.usage,
          ) &&
            snapshot.events.some(
              (e) => e.bundleId === b.id && e.kind === "answer",
            )),
      );
      if (
        normalizeAnswer(ex.passage) ===
          normalizeAnswer(source!.content.exercise.passage) ||
        qs.some((q) =>
          seen.some((b) =>
            b.content.exercise.questions.some(
              (old) =>
                old.wordIds.includes(t.wordId) &&
                normalizeAnswer(old.context) === normalizeAnswer(q.context),
            ),
          ),
        )
      )
        fail("复测必须更换短文和已练过的题目语境，不能重做原题。");
    }
  }
  for (const q of ex.questions) {
    if (q.wordIds.some((id) => !targetIds.has(id)))
      fail("题目引用了本练习目标以外的词。");
    if (
      q.format === "choice" &&
      (q.options.length < 2 ||
        q.answers.length !== 1 ||
        !q.options.some((o) => o.id === q.answers[0]) ||
        new Set(q.options.map((o) => o.id)).size !== q.options.length ||
        new Set(q.options.map((o) => normalizeAnswer(o.text))).size !==
          q.options.length)
    )
      fail("选择题须有不重复的选项和唯一标准答案。");
    if (q.format === "text" && q.options.length !== 0)
      fail("文本填空须使用预先声明的可接受答案，不能同时包含选项。");
    if (new Set(q.answers.map(normalizeAnswer)).size !== q.answers.length)
      fail("可接受答案存在重复。");
  }
  if (ex.examples.some((e) => e.wordIds.some((id) => !targetIds.has(id))))
    fail("例句引用了本练习目标以外的词。");
  for (const correction of content.replaces ?? []) {
    if (
      !snapshot.bundles.some(
        (b) =>
          b.id === correction.bundleId &&
          b.content.exercise.questions.some(
            (q) => q.id === correction.questionId,
          ),
      )
    )
      fail("待修正的原题版本不存在。");
  }
}
