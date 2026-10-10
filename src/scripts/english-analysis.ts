import catalog from "../data/english.json";
import { learningDay } from "../lib/english/model";
import {
  periodFor,
  type Evidence,
  type Metrics,
  type PeriodKind,
} from "../lib/english/practice-model";
import type { PracticeData } from "../lib/english/practice-server";

type Api = (path: string, method?: string, body?: unknown) => Promise<any>;
const e = (v: unknown) =>
  String(v ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
const words = new Map(catalog.entries.map((w) => [w.id, w]));
const periodNames = { day: "日分析", week: "周分析", month: "月分析" };
const reasons = {
  due: "待复测",
  repeated: "反复不稳",
  recent: "近期需巩固",
  stabilizing: "近期趋稳",
};
const types = {
  meaning: "词义辨析",
  collocation: "搭配或选词",
  comprehension: "句子与短文理解",
};
const dateTime = (v: string) =>
  new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(v));
const wordButton = (id: string) =>
  `<button type="button" class="analysis-word" data-open="${e(id)}">${e(words.get(id)?.term ?? id)}</button>`;
const accuracy = (a: { correct: number; total: number }) =>
  a.total ? `${a.correct} / ${a.total}` : "—";
function metrics(m: Metrics) {
  return `<div class="analysis-metrics"><div><span>自评词条</span><strong>${m.selfReviewWords}</strong><small>${m.selfReviews} 次自评 · 按词去重</small></div><div><span>练习词条</span><strong>${m.practiceWords}</strong><small>提交答案覆盖的目标词</small></div><div><span>无提示首次正确</span><strong>${accuracy(m.firstAccuracy)}</strong><small>${m.firstAccuracy.total ? `${Math.round((m.firstAccuracy.correct / m.firstAccuracy.total) * 100)}% · 正确 / 总题数` : "暂无可计算数据"}</small></div><div><span>跨日复测正确</span><strong>${accuracy(m.retestAccuracy)}</strong><small>${m.retestAccuracy.total ? `${Math.round((m.retestAccuracy.correct / m.retestAccuracy.total) * 100)}% · 独立新语境作答` : "暂无可计算数据"}</small></div></div>`;
}
function evidenceLine(v: Evidence) {
  const results: Record<string, string> = {
    forgot: "忘了",
    vague: "模糊",
    remembered: "记得",
    correct: "答对",
    incorrect: "答错",
  };
  let result = results[v.result] ?? v.result;
  if (v.kind === "feedback") {
    const feedback = JSON.parse(v.result);
    result = [
      feedback.difficulty
        ? (
            {
              "too-hard": "太难",
              suitable: "合适",
              "too-easy": "太简单",
            } as Record<string, string>
          )[feedback.difficulty]
        : "",
      feedback.difficultyType
        ? types[feedback.difficultyType as keyof typeof types]
        : "",
      feedback.vagueWordIds?.length ? "自述仍模糊" : "",
    ]
      .filter(Boolean)
      .join(" / ");
  }
  if (v.kind === "retest") {
    const [decision, day] = v.result.split(":");
    result = `${decision === "accepted" ? "已确认" : "已跳过"} ${day}`;
  }
  return `<li>${e(dateTime(v.at))} · ${e(v.wordIds.map((id) => words.get(id)?.term ?? id).join("、"))} · ${v.kind === "self-review" ? "自评" : v.kind === "answer" ? `${v.retest ? "跨日复测" : "客观题"} / ${v.independent ? "无提示首次" : "辅助作答"}` : v.kind === "feedback" ? "用户自述反馈" : "已处理的复测安排"} · ${e(result)}${v.wordIds.length > 1 && v.result === "incorrect" ? "（多词理解题，无法定位单个词）" : ""}${v.bundleId ? ` <button type="button" class="text-button" data-report="${e(v.bundleId)}">查看原练习</button>` : ""}</li>`;
}
function lessonHtml(
  b: NonNullable<PracticeData["bundle"]>,
  selected: "concepts" | null,
) {
  const lesson = b.content.lesson;
  const stage = b.study.stage;
  if (!b.study.hasLesson)
    return `<div class="analysis-banner">这份旧版内容没有完整学习讲解。可以在 Codex 请求补充学习材料并保存新版，原题与作答会保留。</div>`;
  const step = selected ?? stage;
  const source = lesson?.reading.source;
  const example = (x: { english: string; translation: string; note: string }) =>
    `<div class="lesson-example"><blockquote lang="en">${e(x.english)}</blockquote><p>${e(x.translation)}</p><p class="analysis-meta">${e(x.note)}</p></div>`;
  const concepts = lesson
    ? `<p class="eyebrow">01 · UNDERSTAND THE WORDS</p><h3>先把词和用法学明白</h3>
    <ul class="analysis-next">${lesson.objectives.map((o) => `<li>${e(o)}</li>`).join("")}</ul>
    ${lesson.words.map((w) => `<article class="lesson-word"><h4>${e(words.get(w.wordId)?.term)} <span class="tag">${e(b.content.exercise.targets.find((t) => t.wordId === w.wordId)?.meaning)}</span></h4><p>${e(w.explanation)}</p><h5>怎样使用</h5><ul>${w.usageNotes.map((n) => `<li>${e(n)}</li>`).join("")}</ul><h5>放进句子里理解</h5>${w.examples.map(example).join("")}<h5>容易混淆的地方</h5><div class="lesson-contrast">${example(w.contrast.left)}${example(w.contrast.right)}</div><p class="lesson-note">${e(w.contrast.explanation)}</p></article>`).join("")}`
    : "";
  const reading = lesson
    ? `<p class="eyebrow">02 · READ WITH GUIDANCE</p><h3>${e(lesson.reading.title)}</h3><p class="analysis-meta">${source?.kind === "excerpt" ? `真实摘录 · <a href="${e(source.url)}" target="_blank" rel="noopener noreferrer">${e(source.title)}</a>` : "Codex 生成的教学语料"} · 先通读，再对照句子拆解</p><p class="analysis-material" lang="en">${e(lesson.reading.passage)}</p><details class="lesson-translation"><summary>对照全文译文</summary><p>${e(lesson.reading.translation)}</p></details><h4>一句一句，读清关系</h4>${lesson.reading.sentences.map((s, i) => `<article class="lesson-sentence"><p class="eyebrow">SENTENCE ${i + 1}</p><blockquote lang="en">${e(s.sentence)}</blockquote><p>${e(s.translation)}</p><dl>${s.chunks.map((c) => `<div><dt lang="en">${e(c.text)}</dt><dd>${e(c.explanation)}</dd></div>`).join("")}</dl><p class="lesson-note">${e(s.takeaway)}</p></article>`).join("")}<h4>带着这几条去练习</h4><ul class="analysis-next">${lesson.takeaways.map((t) => `<li>${e(t)}</li>`).join("")}</ul>`
    : "";
  return `<section class="analysis-card lesson" id="analysis-lesson">
    <p class="eyebrow">LEARN FIRST · THEN APPLY</p><h3>${e(b.study.title)}</h3>
    <p class="analysis-meta">词汇讲解由 Codex 编写。讲解与精读约 ${b.study.estimatedMinutes} 分钟，练习时间另计。学习阶段可自由查看译文与解释；学习进度与答题成绩分别保存。</p>
    ${b.study.required ? `<ol class="lesson-steps" aria-label="本课进度"><li ${stage === "concepts" ? 'aria-current="step"' : ""}>01 学习讲解${b.study.conceptsAt ? " ✓" : ""}</li><li ${stage === "reading" ? 'aria-current="step"' : ""}>02 语料精读${b.study.completedAt ? " ✓" : ""}</li><li ${stage === "practice" ? 'aria-current="step"' : ""}>03 课后练习</li></ol>` : '<p class="analysis-banner">本次含跨日复测，先在新语境中独立回忆。提前回看学习材料可继续作答，但未答题会记为辅助学习。</p>'}
    ${stage === "practice" ? (lesson ? `<details class="lesson-review"><summary>回看本课讲解与精读</summary>${concepts}${reading}</details>` : `<p>学习内容已收起。用新的语境检查自己能否回忆和理解。</p><button type="button" data-help="hint" data-question="*">回看讲解与精读（未答题记为辅助）</button>`) : step === "concepts" ? `${concepts}<div class="analysis-actions"><button type="button" class="primary" data-study-complete="concepts">${b.study.conceptsAt ? "返回语料精读" : "讲解已学完，去精读"} →</button></div><p class="analysis-meta">点击后保存讲解进度，可以换设备继续。</p>` : `<button type="button" class="text-button" data-study-view="concepts">← 回看词汇讲解</button>${reading}<div class="analysis-actions"><button type="button" class="primary" data-study-complete="reading">精读已完成，开始课后练习 →</button></div><p class="analysis-meta">开始后将收起讲解；答题时再回看会记录辅助学习。完成学习不等于已掌握。</p>`}
  </section>`;
}

export function initAnalysis(api: Api, authFailure: (error: unknown) => void) {
  const el = <T extends HTMLElement = HTMLElement>(id: string) =>
    document.getElementById(id) as T;
  const root = el("analysis-view"),
    body = el("analysis-content");
  let authenticated = false,
    active = false,
    busy = false,
    dirty = false,
    loading = false;
  let data: PracticeData | null = null;
  let period: PeriodKind | "history" = "day";
  let lessonStep: "concepts" | null = null;
  let reportId = new URL(location.href).searchParams.get("report") ?? "";
  let pending: Record<string, unknown> | null = null;
  const drafts = new Map<string, [string, string][]>();
  const formKey = (form: HTMLFormElement) =>
    form.dataset.answerForm
      ? `answer:${form.dataset.answerForm}`
      : form.dataset.flagForm
        ? `flag:${form.dataset.flagForm}`
        : form.dataset.questionFeedback
          ? `feedback:${form.dataset.questionFeedback}`
          : form.dataset.scheduleForm
            ? `schedule:${form.dataset.scheduleForm}`
            : "feedback:";
  function rememberDraft(form: HTMLFormElement) {
    drafts.set(
      formKey(form),
      [...new FormData(form)].map(([k, v]) => [k, String(v)]),
    );
    dirty = drafts.size > 0;
  }
  function restoreDrafts() {
    body.querySelectorAll<HTMLFormElement>("form").forEach((form) => {
      const values = drafts.get(formKey(form));
      if (!values) return;
      form
        .querySelectorAll<
          HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
        >("[name]")
        .forEach((field) => {
          const matches = values
            .filter(([name]) => name === field.name)
            .map(([, value]) => value);
          if (
            field instanceof HTMLInputElement &&
            ["radio", "checkbox"].includes(field.type)
          )
            field.checked = matches.includes(field.value);
          else if (matches.length) field.value = matches[0];
        });
    });
    syncCustomDates();
  }
  function syncCustomDates() {
    body
      .querySelectorAll<HTMLFormElement>("[data-schedule-form]")
      .forEach((form) => {
        const custom =
          form.querySelector<HTMLSelectElement>("[name=manualChoice]")!
            .value === "custom";
        const input = form.querySelector<HTMLInputElement>(
          "[name=scheduledDate]",
        )!;
        input.disabled = !custom;
        input.closest("label")!.hidden = !custom;
      });
  }
  const key = "english-practice-pending-v1";
  try {
    pending = JSON.parse(sessionStorage.getItem(key) ?? "null");
  } catch {
    /* Keep in-memory recovery available. */
  }
  function persist() {
    try {
      pending
        ? sessionStorage.setItem(key, JSON.stringify(pending))
        : sessionStorage.removeItem(key);
    } catch {
      /* Recover in this tab. */
    }
  }
  function status(message: string, error = false) {
    el("analysis-status").textContent = message;
    el("analysis-status").parentElement!.dataset.error = String(error);
    el("analysis-retry").hidden = !pending;
    el("analysis-reconcile").hidden = !pending;
  }
  function url() {
    const url = new URL(location.href);
    url.searchParams.set("view", "analysis");
    reportId
      ? url.searchParams.set("report", reportId)
      : url.searchParams.delete("report");
    history.replaceState(null, "", url);
  }
  function requestCopy() {
    const label =
      period === "history"
        ? "最近一个已结束周期"
        : period === "day"
          ? "今天"
          : period === "week"
            ? "本周"
            : "本月";
    const request = `请使用 learning-notes 项目的 scripts/english-context.mjs 和 scripts/english-save.mjs（流程见 README），分析我${label}的英语学习记录，结合最近 30 个自然日的反复遗忘与已确认复测，生成并保存一份先学后练的 Java 技术英语课程：先讲解含义、搭配、易混用法和双语例句，再提供带全文译文与句子拆解的精读语料，最后附约 5 分钟的新语境客观题。学习与练习时长分别标注，不要只给题目。先说明将读取的数据范围，不包含私人笔记。沿用现有报告时给出入口；需要更新时保留旧版本。保存后读回确认，并返回网站入口。`;
    return `<div class="analysis-card analysis-empty"><p class="eyebrow">PREPARED IN CODEX · PRACTISED HERE</p><h3>本期尚未生成</h3><p>${data?.overview.hasRecords ? "让最近的学习记录，成为下一次练习的起点。" : "暂无可用学习记录。先去词库学习，再回来准备第一份巩固练习。"}</p><p class="analysis-meta">复制下面的请求到 Codex。报告保存后会出现在这里，不会自动调用模型。</p><label for="analysis-prompt" class="sr-only">可复制到 Codex 的请求</label><textarea id="analysis-prompt" class="analysis-copy" readonly>${e(request)}</textarea><div class="analysis-actions"><button type="button" class="primary" id="analysis-copy">复制请求</button><button type="button" data-view="library">去词库学习 →</button></div></div>`;
  }
  function retests() {
    const schedules = data!.retests.filter(
      (r) => r.decision === "accepted" && !r.completedAt,
    );
    return `<section class="analysis-card"><p class="eyebrow">REVISIT IN A NEW CONTEXT</p><h3>已确认的复测 <span class="tag">${schedules.length}</span></h3>${schedules.length ? schedules.map((r) => `<div class="analysis-evidence">${wordButton(r.wordId)}<p>${e(r.usage)}</p><p class="analysis-meta">${e(r.scheduledDate)} · ${r.scheduledDate <= learningDay() ? "已到期" : "待到期"}</p>${r.readyBundleId ? `<button type="button" class="text-button" data-report="${e(r.readyBundleId)}">打开新语境练习 →</button>` : '<p class="analysis-meta">待准备复测练习 · 下次 Codex 分析可读取此安排</p>'}</div>`).join("") : '<p class="analysis-meta">完成练习后确认建议，再加入这里。没有材料不计为答错。</p>'}</section>`;
  }
  function overview() {
    const facts = data!.bundle?.facts ?? data!.overview;
    return `<section class="analysis-card"><p class="eyebrow">EVIDENCE, BEFORE INTERPRETATION</p><h3>值得再练的词</h3><p class="analysis-meta">观察近 30 个自然日。同词只占一个名额。</p>${
      facts.candidates.length
        ? facts.candidates
            .slice(0, 8)
            .map(
              (c) =>
                `<details class="analysis-evidence"><summary>${e(words.get(c.wordId)?.term ?? c.wordId)} · ${c.reasons.map((r) => reasons[r]).join(" / ")}</summary><p>${wordButton(c.wordId)} · ${c.unstableDays.length} 个不稳日期</p><ul>${c.evidenceIds
                  .map((id) => facts.evidence.find((v) => v.id === id))
                  .filter((v): v is Evidence => !!v)
                  .map(evidenceLine)
                  .join("")}</ul></details>`,
            )
            .join("")
        : '<p class="analysis-meta">暂无符合门槛的薄弱内容，不代表已全部掌握。</p>'
    }${facts.stabilizing.length ? `<p>近期趋稳：${facts.stabilizing.map((c) => wordButton(c.wordId)).join("")}</p><p class="analysis-meta">至少两个不同日期复测正确，且一次距最后不稳至少 7 天。</p>` : ""}${facts.unknownDateWordIds.length ? `<details class="analysis-evidence"><summary>历史日期未知 · ${facts.unknownDateWordIds.length} 个词</summary><p>${facts.unknownDateWordIds.map(wordButton).join("")}</p><p class="analysis-meta">保留旧自评状态，不编入日期趋势。</p></details>` : ""}</section>`;
  }
  function render() {
    if (!active) return;
    root
      .querySelectorAll("[data-period]")
      .forEach((b) =>
        b.toggleAttribute(
          "aria-current",
          (b as HTMLElement).dataset.period === period,
        ),
      );
    if (!authenticated) {
      body.innerHTML =
        '<div class="empty"><h3>你的分析，只属于你。</h3><p>输入个人口令后查看报告、练习与复测安排。</p><button type="button" data-login>解锁个人记录</button></div>';
      return;
    }
    if (!data) return;
    if (period === "history" && !reportId) {
      body.innerHTML = `<div class="analysis-layout"><div class="analysis-main"><div class="analysis-history">${data.summaries.length ? data.summaries.map((s) => `<button type="button" data-report="${e(s.id)}"><span><strong>${e(s.title)}</strong><span class="analysis-meta">${periodNames[s.period.kind]} · ${e(learningDay(s.period.start))} · 版本 ${s.version}<br/>截至 ${e(dateTime(s.period.cutoff))}</span></span><span class="tag">${s.answeredCount} / ${s.questionCount} 已答 →</span></button>`).join("") : '<div class="empty"><h3>还没有历史报告</h3><p>已保存的每个版本都会保留在这里。</p></div>'}</div></div><aside class="analysis-sidebar">${retests()}${overview()}</aside></div>`;
      return;
    }
    const b = data.bundle;
    if (!b) {
      body.innerHTML = `<div class="analysis-layout"><div class="analysis-main">${requestCopy()}</div><aside class="analysis-sidebar">${retests()}${overview()}</aside></div>`;
      return;
    }
    const ex = b.content.exercise,
      summary = data.summaries.find((s) => s.id === b.id)!;
    const feedback = b.feedback
      .filter((event) => !event.questionId)
      .at(-1)?.payload;
    const first = ex.questions
      .filter((q) => !q.flagged)
      .flatMap((q) => q.attempts.slice(0, 1));
    const independent = first.filter((a) => !a.payload.assisted),
      correct = independent.filter((a) => a.payload.correct).length;
    const complete = ex.questions.every(
      (q) => q.flagged || q.attempts.length > 0,
    );
    const evidence = (ids: string[]) =>
      ids
        .map((id) => b.facts.evidence.find((v) => v.id === id))
        .filter((v): v is Evidence => !!v)
        .map(evidenceLine)
        .join("");
    const questionHtml = ex.questions
      .map((q, index) => {
        const first = q.attempts[0],
          latest = q.attempts.at(-1);
        const answerForm = `<form data-answer-form="${e(q.id)}"><fieldset ${q.flagged ? "disabled" : ""}><legend>${index + 1}. ${e(q.prompt)}</legend>${q.format === "choice" ? q.options.map((o) => `<label class="analysis-option"><input type="radio" name="answer" value="${e(o.id)}" required ${latest?.payload.answer === o.id ? "checked" : ""}/><span>${e(o.text)}</span></label>`).join("") : `<label class="sr-only" for="answer-${e(q.id)}">填空答案</label><input id="answer-${e(q.id)}" type="text" name="answer" autocomplete="off" required maxlength="4000" value="${e(latest?.payload.answer ?? "")}"/>`}</fieldset><div class="analysis-actions"><button class="primary" type="submit" ${q.flagged ? "disabled" : ""}>${latest ? "保存重做答案" : "提交答案"}</button>${!latest ? `<button type="button" data-help="hint" data-question="${e(q.id)}">查看提示</button><button type="button" data-help="reveal" data-question="${e(q.id)}">查看答案</button>` : ""}</div><p class="analysis-meta">${latest ? "重做保留记录，不改变首次正确率。" : "选择后请点击提交；未提交的答案尚未保存。"}</p></form>`;
        return `<article class="analysis-card analysis-question" id="question-${e(q.id)}"><p class="eyebrow">QUESTION ${String(index + 1).padStart(2, "0")} / ${types[q.type]}</p><p class="analysis-material" lang="en">${e(q.context)}</p><p class="analysis-meta">考查：${q.wordIds.map((id) => e(words.get(id)?.term ?? id)).join(" · ")}${q.assisted && !first ? " · 已使用辅助材料" : ""}</p>${q.flagged ? '<div class="analysis-banner">已标记待核对，暂不参与能力分析。原答案保留，修正题将另存版本。</div>' : ""}${latest ? `<div class="analysis-result" data-correct="${latest.payload.correct}"><strong>已确认保存 · ${latest.payload.correct ? "本次答对" : "本次答错"}</strong><p>首次答案：${e(first.payload.answer)} · ${first.payload.correct ? "正确" : "错误"} · ${first.payload.assisted ? "辅助作答，不计独立正确率" : "无提示首次作答"}</p>${q.wordIds.length > 1 && !first.payload.correct ? "<p>这是多词理解题，尚不能定位具体哪个词不稳。</p>" : ""}<p>${e(dateTime(latest.createdAt))} · 共 ${q.attempts.length} 次提交</p></div><details><summary>重做此题</summary>${answerForm}</details><details><summary>查看全部作答记录</summary><ul>${q.attempts.map((a) => `<li>${e(dateTime(a.createdAt))} · ${e(a.payload.answer)} · ${a.payload.correct ? "正确" : "错误"} · ${a.payload.assisted ? "辅助或重做" : "无提示首次"}</li>`).join("")}</ul></details>` : answerForm}${q.hint ? `<div class="analysis-result">提示：${e(q.hint)}</div>` : ""}${q.answers.length ? `<div class="analysis-result"><strong>标准答案：${q.answers.map((a) => e(q.options.find((o) => o.id === a)?.text ?? a)).join(" / ")}</strong><p>${e(q.explanation)}</p></div>` : ""}<details><summary>反馈困难或标记题目有误</summary><form data-question-feedback="${e(q.id)}"><label>这道题卡在哪里？<select name="difficultyType"><option value="meaning">词义</option><option value="collocation">搭配</option><option value="comprehension">句子理解</option></select></label><button type="submit">保存困难反馈</button></form><form data-flag-form="${e(q.id)}"><label for="flag-${e(q.id)}">哪里有误或歧义？</label><textarea id="flag-${e(q.id)}" name="reason" required maxlength="1000" placeholder="描述题目、答案或技术语境的问题"></textarea><button type="submit">标记待核对</button></form></details></article>`;
      })
      .join("");
    const practiceHtml = `<section class="analysis-card" id="analysis-exercise"><p class="eyebrow">03 · APPLY IN A NEW CONTEXT</p><h3>换个语境，试着自己理解。</h3><p class="analysis-meta">${ex.source.kind === "generated" ? "Codex 生成的教学材料" : `真实摘录 · <a href="${e(ex.source.url)}" target="_blank" rel="noopener noreferrer">${e(ex.source.title)}</a>`} · ${e(ex.difficulty)}</p><p class="analysis-material" lang="en">${e(ex.passage)}</p>${ex.examples.map((x) => `<div class="analysis-example"><blockquote lang="en">${e(x.english)}</blockquote>${x.translation ? `<p class="analysis-meta">${e(x.translation)}</p>` : ""}</div>`).join("")}${b.materialRevealed ? `<div class="analysis-result">${e(ex.translation)}</div>` : '<button type="button" data-help="hint" data-question="*">展开译文与释义（未答题将记为辅助作答）</button>'}<p class="analysis-meta">保存进度：${ex.questions.filter((q) => q.attempts.length).length} / ${ex.questions.length} 题 · 可以随时回来继续已保存的部分。</p></section>${questionHtml}<section class="analysis-card" id="analysis-results"><p class="eyebrow">AFTER THIS PRACTICE</p><h3>${complete ? "本次练习已完成" : "本次已保存的结果"}</h3><p>无提示首次正确：${independent.length ? `${correct} / ${independent.length}` : "暂无可计算数据"} · 辅助首次作答 ${first.filter((a) => a.payload.assisted).length} 题 · 待核对 ${ex.questions.filter((q) => q.flagged).length} 题。</p><p class="analysis-meta">首次答案与所有重做记录均保留。以下复测建议只有确认后才会加入安排。</p>${
      complete
        ? b.suggestions
            .map((s) => {
              const saved = b.schedules.find((r) => r.wordId === s.wordId);
              return `<div class="analysis-schedule">${wordButton(s.wordId)}<p>${e(s.reason)}</p>${saved ? `<p class="analysis-meta">${saved.decision === "skipped" ? "已跳过，不计为遗忘" : `已确认 ${e(saved.scheduledDate)} · ${saved.completedAt ? "已完成" : "待准备或完成复测"}`}</p>` : `<form data-schedule-form="${e(s.wordId)}">${s.manualDate ? `<div class="analysis-banner">已有手工复习日期 ${e(s.manualDate)}。请明确选择本次复测安排，原日期保留。</div>` : ""}<label>采用哪个日期？<select name="manualChoice">${s.manualDate ? '<option value="keep">保留手工日期</option>' : ""}<option value="suggested">采用建议日期 ${e(s.suggestedDate)}</option><option value="custom">自选日期</option></select></label><label hidden>自选复测日期<input type="date" name="scheduledDate" value="${e(s.suggestedDate)}" required disabled/></label><div class="analysis-actions"><button type="submit" name="decision" value="accepted" class="primary">确认复测</button><button type="submit" name="decision" value="skipped">跳过建议</button></div></form>`}</div>`;
            })
            .join("") ||
          '<p class="analysis-meta">暂无新的复测建议。可在下方反馈仍模糊的词条，再查看建议。</p>'
        : '<p class="analysis-meta">完成其余题目后查看复测建议。</p>'
    }</section><section class="analysis-card analysis-feedback"><h3>这次的难度如何？</h3><form id="analysis-feedback"><label>难度反馈<select name="difficulty"><option value="suitable" ${!feedback?.difficulty || feedback.difficulty === "suitable" ? "selected" : ""}>合适</option><option value="too-hard" ${feedback?.difficulty === "too-hard" ? "selected" : ""}>太难</option><option value="too-easy" ${feedback?.difficulty === "too-easy" ? "selected" : ""}>太简单</option></select></label><p class="analysis-meta">仍然模糊的词（可选，自述反馈）：</p>${ex.targets.map((t) => `<label><input type="checkbox" name="vagueWordIds" value="${e(t.wordId)}" ${feedback?.vagueWordIds?.includes(t.wordId) ? "checked" : ""}/>${e(words.get(t.wordId)?.term ?? t.wordId)}</label>`).join("")}<button type="submit">保存反馈</button></form>${b.feedback.length ? `<p class="analysis-meta">已保存 ${b.feedback.length} 条反馈，下次 Codex 读取时可用。</p>` : ""}</section>`;
    body.innerHTML = `${summary.hasNewRecords ? '<div class="analysis-banner">有新记录可用于更新。这份报告保留原截止时间；需要更新时请在 Codex 请求重新生成，并保留旧版本。</div>' : ""}<div class="analysis-layout"><div class="analysis-main"><section class="analysis-card hero"><p class="eyebrow">${periodNames[b.period.kind]} · VERSION ${b.version}</p><h3>${e(b.content.title)}</h3><p>${e(b.content.summary)}</p><p class="analysis-meta">${e(learningDay(b.period.start))} 至 ${e(learningDay(new Date(Date.parse(b.period.end) - 1).toISOString()))}（北京时间）<br/>${b.period.complete ? "完整历史周期" : "进行中的周期"} · 截至 ${e(dateTime(b.period.cutoff))}<br/>${ex.targets.length} 个目标词 · ${ex.questions.length} 道题 · ${b.study.hasLesson ? `学习约 ${b.study.estimatedMinutes} 分钟 + ` : ""}练习约 ${ex.mode === "short" ? "5" : "10–15"} 分钟</p><a href="${b.study.stage !== "practice" ? "#analysis-lesson" : "#analysis-exercise"}">${b.study.stage === "concepts" ? "开始学习" : b.study.stage === "reading" ? "继续精读" : complete ? "回看练习与结果" : first.length ? "继续练习" : "开始课后练习"} ↓</a> <a href="#analysis-evidence">查看依据 ↓</a></section><section aria-label="报告统计">${metrics(b.facts.metrics)}<p class="analysis-meta">实际覆盖 ${b.facts.metrics.coveredDays.length} 个学习日${b.facts.metrics.coveredDays.length ? `：${b.facts.metrics.coveredDays[0]} 至 ${b.facts.metrics.coveredDays.at(-1)}` : ""}。旧自评状态不等于长期掌握。</p><details class="analysis-evidence"><summary>${b.period.complete ? "上一个完整周期" : "上一周期相同已过时长"}的数据与比较边界</summary>${metrics(b.facts.previousMetrics)}<p class="analysis-meta">不同词条、不同题目的整体比例变化仅描述表现，不能直接断言能力提升。</p><p class="analysis-meta">同批词复测样本 ${b.facts.retestCohort.sampleCount} 题；共同目标：${b.facts.retestCohort.wordIds.map((id) => e(words.get(id)?.term ?? id)).join("、") || "暂无"}；间隔 ${b.facts.retestCohort.intervalsDays.join("、") || "暂无"} 天。样本不足时不作等级或能力推断。</p><ul>${b.facts.metrics.questionTypes.map((t) => `<li>${types[t.type]}：${accuracy(t)}${t.total ? "" : "（暂无可计算数据）"}</li>`).join("")}</ul></details></section><section class="analysis-card" id="analysis-evidence"><p class="eyebrow">WHY THESE WORDS</p><h3>本次重点与依据</h3>${ex.targets.map((t) => `<details class="analysis-evidence"><summary>${e(words.get(t.wordId)?.term ?? t.wordId)} · ${e(t.reason)}</summary><p>${wordButton(t.wordId)} · ${e(t.meaning)}${t.extension ? "（扩展含义）" : ""}</p><p>目标用法：${e(t.usage)}</p><ul>${evidence(t.evidenceIds) || "<li>用户指定补练词条，尚不构成薄弱诊断。</li>"}</ul></details>`).join("")}${b.content.findings.map((f) => `<details class="analysis-evidence"><summary><span class="analysis-label">${f.kind === "fact" ? "记录事实" : f.kind === "hypothesis" ? "可能原因 · 待验证" : "学习建议"}</span>${e(f.text)}</summary><ul>${evidence(f.evidenceIds) || "<li>这是一项建议或假设，没有作为已验证诊断。</li>"}</ul></details>`).join("")}<h4>下一步</h4><ul class="analysis-next">${b.content.nextSteps.map((s) => `<li>${e(s)}</li>`).join("")}</ul>${b.content.replaces?.map((r) => `<p class="analysis-meta">修正说明：${e(r.reason)} <button type="button" data-report="${e(r.bundleId)}">查看原题版本</button></p>`).join("") ?? ""}</section>${lessonHtml(b, lessonStep)}${b.study.stage === "practice" ? practiceHtml : ""}</div><aside class="analysis-sidebar">${retests()}${overview()}<section class="analysis-card"><h3>报告与练习会保留。</h3><p class="analysis-meta">每次更新都有独立版本。已保存的内容在手机和电脑上共用，无需 Codex 持续在线。</p><button type="button" class="text-button" data-period="history">查看全部历史 →</button></section></aside></div>`;
  }
  async function refresh(keepSelection = true) {
    if (!authenticated || !active || loading || busy) return;
    if ((dirty && data) || pending) {
      status("有尚未确认保存的内容，请先提交、重试或取消待保存操作。", true);
      return;
    }
    loading = true;
    status("正在读取已保存的报告与练习…");
    try {
      const fresh: PracticeData = await api(
        `practice${reportId && keepSelection ? `?report=${encodeURIComponent(reportId)}` : ""}`,
      );
      if (!active || !authenticated) return;
      data = fresh;
      if (!reportId && period !== "history") {
        const current = periodFor(
          period,
          learningDay(),
          new Date().toISOString(),
        );
        const selected = data.summaries.find(
          (s) => s.period.kind === period && s.period.start === current.start,
        );
        if (selected) {
          reportId = selected.id;
          data = await api(`practice?report=${reportId}`);
        }
      }
      if (!active || !authenticated) return;
      url();
      render();
      restoreDrafts();
      status(
        dirty
          ? "已读取保存内容；当前选择仍未提交。"
          : "已读取保存内容 · 北京时间 · 手机和电脑共用",
      );
    } catch (error) {
      body.innerHTML =
        '<div class="empty"><h3>暂时无法读取</h3><p>没有把读取失败计为零记录。请稍后点击“刷新分析与练习”。</p></div>';
      status(error instanceof Error ? error.message : "暂时无法读取", true);
      if ((error as { status?: number }).status === 401) authFailure(error);
    } finally {
      loading = false;
    }
  }
  async function save(action?: Record<string, unknown>) {
    if (busy || !authenticated) return;
    if (action && pending) {
      status("请先重试或取消待保存操作。", true);
      return;
    }
    if (action) {
      pending = {
        ...action,
        operationId: crypto.randomUUID(),
        bundleId: data!.bundle!.id,
      };
      persist();
    }
    if (!pending) return;
    const submittedKey = `${pending.action}:${pending.questionId ?? pending.wordId ?? ""}`;
    busy = true;
    status("正在保存，尚未确认完成…");
    const enabledButtons = [
      ...root.querySelectorAll<HTMLButtonElement>("button:not(:disabled)"),
    ];
    enabledButtons.forEach((button) => (button.disabled = true));
    try {
      const result: PracticeData = await api("practice", "POST", pending);
      pending = null;
      persist();
      drafts.delete(submittedKey);
      dirty = drafts.size > 0;
      data = result;
      lessonStep = null;
      reportId = result.bundle!.id;
      if (!authenticated) return;
      url();
      render();
      restoreDrafts();
      status(
        dirty
          ? "本次提交已保存；其他题目的选择仍未提交。"
          : "已保存并重新读取，可在其他设备继续。",
      );
    } catch (error) {
      status(
        error instanceof Error ? error.message : "尚未确认保存，请重试。",
        true,
      );
      if ((error as { status?: number }).status === 401) authFailure(error);
    } finally {
      busy = false;
      enabledButtons.forEach((button) => (button.disabled = false));
    }
  }
  function canNavigate() {
    if (loading) {
      status("正在读取内容，请稍候。");
      return false;
    }
    if (busy || pending) {
      status("请先处理待保存操作。", true);
      return false;
    }
    if (dirty && !confirm("有未提交的答案或反馈，切换将放弃这些内容。继续吗？"))
      return false;
    drafts.clear();
    dirty = false;
    lessonStep = null;
    return true;
  }
  root.addEventListener("input", (event) => {
    const form = (event.target as Element).closest("form");
    if (form) {
      rememberDraft(form);
      status("当前修改尚未提交保存。");
    }
  });
  root.addEventListener("change", (event) => {
    const form = (event.target as Element).closest("form");
    syncCustomDates();
    if (form) rememberDraft(form);
  });
  root.addEventListener("click", async (event) => {
    const button = (event.target as Element).closest<HTMLButtonElement>(
      "button",
    );
    if (!button) return;
    if (button.dataset.period) {
      if (!canNavigate()) return;
      period = button.dataset.period as typeof period;
      reportId = "";
      void refresh(false);
    }
    if (button.dataset.report) {
      if (!canNavigate()) return;
      reportId = button.dataset.report;
      void refresh();
    }
    if (button.dataset.studyView) {
      lessonStep = "concepts";
      render();
      restoreDrafts();
      el("analysis-lesson").scrollIntoView({ block: "start" });
    }
    if (button.dataset.studyComplete) {
      await save({ action: "study", questionId: button.dataset.studyComplete });
      if (!pending)
        el(
          data?.bundle?.study.stage === "practice"
            ? "analysis-exercise"
            : "analysis-lesson",
        )?.scrollIntoView({ block: "start" });
    }
    if (button.dataset.help)
      void save({
        action: button.dataset.help,
        questionId: button.dataset.question,
      });
    if (button.id === "analysis-copy") {
      try {
        await navigator.clipboard.writeText(
          el<HTMLTextAreaElement>("analysis-prompt").value,
        );
        status("请求已复制，可粘贴到 Codex。");
      } catch {
        el<HTMLTextAreaElement>("analysis-prompt").select();
        status("自动复制不可用，已选中请求文字，请手动复制。", true);
      }
    }
  });
  root.addEventListener("submit", (event) => {
    event.preventDefault();
    const form = event.target as HTMLFormElement,
      f = new FormData(form),
      bundle = data!.bundle!;
    if (form.dataset.answerForm) {
      const q = bundle.content.exercise.questions.find(
        (q) => q.id === form.dataset.answerForm,
      )!;
      void save({
        action: "answer",
        questionId: q.id,
        answer: f.get("answer"),
        expectedAttempt: q.attempts.length,
      });
    }
    if (form.dataset.flagForm)
      void save({
        action: "flag",
        questionId: form.dataset.flagForm,
        reason: f.get("reason"),
      });
    if (form.dataset.questionFeedback)
      void save({
        action: "feedback",
        questionId: form.dataset.questionFeedback,
        difficultyType: f.get("difficultyType"),
      });
    if (form.id === "analysis-feedback")
      void save({
        action: "feedback",
        difficulty: f.get("difficulty"),
        vagueWordIds: f.getAll("vagueWordIds"),
      });
    if (form.dataset.scheduleForm) {
      const proposal = bundle.suggestions.find(
        (s) => s.wordId === form.dataset.scheduleForm,
      )!;
      const choice = String(f.get("manualChoice"));
      const decision =
        (event as SubmitEvent).submitter?.getAttribute("value") ?? "accepted";
      void save({
        action: "schedule",
        wordId: proposal.wordId,
        decision,
        manualChoice: choice,
        manualDate: proposal.manualDate,
        scheduledDate:
          choice === "keep"
            ? proposal.manualDate
            : choice === "suggested"
              ? proposal.suggestedDate
              : f.get("scheduledDate"),
      });
    }
  });
  el("analysis-refresh").addEventListener("click", () => {
    if (canNavigate()) void refresh();
  });
  el("analysis-retry").addEventListener("click", () => void save());
  el("analysis-reconcile").addEventListener("click", async () => {
    if (busy || !pending) return;
    try {
      const fresh = await api(
        `practice?report=${encodeURIComponent(String(pending.bundleId))}`,
      );
      pending = null;
      persist();
      drafts.clear();
      dirty = false;
      data = fresh;
      reportId = fresh.bundle.id;
      url();
      render();
      status("已重新读取服务器结果，未收到的操作已取消。");
    } catch (error) {
      status(error instanceof Error ? error.message : "暂时无法读取", true);
    }
  });
  window.addEventListener("beforeunload", (event) => {
    if (pending || dirty) event.preventDefault();
  });
  return {
    setAuthenticated(value: boolean) {
      const changed = authenticated !== value;
      authenticated = value;
      if (!value) {
        data = null;
        body.innerHTML = "";
        if (active) render();
      } else if (changed && active) {
        if (pending) {
          status("有上次尚未确认保存的操作，请重试或读取已保存结果。", true);
        } else void refresh();
      }
    },
    show(value: boolean) {
      active = value;
      root.hidden = !value;
      if (value) {
        render();
        if (pending)
          status("有尚未确认保存的操作，请重试或读取已保存结果。", true);
        else void refresh();
      }
    },
    canNavigate,
    canLock: () =>
      !busy &&
      (!(pending || dirty) ||
        confirm("有尚未保存的练习内容，锁定会清除本机待保存操作。继续吗？")),
    clear() {
      pending = null;
      persist();
      drafts.clear();
      dirty = false;
      data = null;
    },
    refresh: () => void refresh(),
  };
}
