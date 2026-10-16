import { courseHtml, type CourseScreen } from "./english-course-view";
import {
  escapeHtml as e,
  words,
  dateTime,
  wordButton,
  homeHtml,
  historyHtml,
  preparationHtml,
  type HistoryFilters,
} from "./english-journey-view";
import { blank, normalize } from "../lib/english/cloze";
import { learningDay } from "../lib/english/model";
import {
  periodFor,
  type Evidence,
  type Metrics,
  type PeriodKind,
} from "../lib/english/practice-model";
import type { PracticeData } from "../lib/english/practice-server";

type Api = (path: string, method?: string, body?: unknown) => Promise<any>;
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
    `<div class="lesson-example"><blockquote lang="en">${e(x.english)}</blockquote>${x.translation ? `<p>${e(x.translation)}</p>` : ""}<p class="analysis-meta">${e(x.note)}</p></div>`;
  const concepts = lesson
    ? `<p class="eyebrow">01 · UNDERSTAND THE WORDS</p><h3>先把词和用法学明白</h3>
    <ul class="analysis-next">${lesson.objectives.map((o) => `<li>${e(o)}</li>`).join("")}</ul>
    ${lesson.words.map((w) => `<article class="lesson-word"><h4>${e(words.get(w.wordId)?.term)} <span class="tag">${e(b.content.exercise.targets.find((t) => t.wordId === w.wordId)?.meaning)}</span></h4><p>${e(w.explanation)}</p><h5>怎样使用</h5><ul>${w.usageNotes.map((n) => `<li>${e(n)}</li>`).join("")}</ul><h5>放进句子里理解</h5>${w.examples.map(example).join("")}<h5>容易混淆的地方</h5><div class="lesson-contrast">${example(w.contrast.left)}${example(w.contrast.right)}</div><p class="lesson-note">${e(w.contrast.explanation)}</p></article>`).join("")}`
    : "";
  const reading = lesson
    ? `<p class="eyebrow">02 · READ WITH GUIDANCE</p><h3>${e(lesson.reading.title)}</h3><p class="analysis-meta">${source?.kind === "excerpt" ? `真实摘录 · <a href="${e(source.url)}" target="_blank" rel="noopener noreferrer">${e(source.title)}</a>` : "Codex 生成的教学语料"} · 先通读，再对照句子拆解</p><p class="analysis-material" lang="en">${e(lesson.reading.passage)}</p>${b.translationsAvailable ? `<details class="lesson-translation" open><summary>对照全文译文</summary><p>${e(lesson.reading.translation)}</p></details>` : ""}<h4>一句一句，读清关系</h4>${lesson.reading.sentences.map((s, i) => `<article class="lesson-sentence"><p class="eyebrow">SENTENCE ${i + 1}</p><blockquote lang="en">${e(s.sentence)}</blockquote>${s.translation ? `<p>${e(s.translation)}</p>` : ""}${!s.translation && b.sentenceHelp?.[i] ? `<details class="sentence-help" data-words="${e(b.content.exercise.targets.filter((t) => words.get(t.wordId) && blank(s.sentence, words.get(t.wordId)!)).map((t) => t.wordId).join(","))}"><summary>这句卡住了？看这句译文</summary><p>${e(b.sentenceHelp[i])}</p><p class="analysis-meta">看过译文的句子里的目标词，课后会换个语境再问一次。</p></details>` : ""}<dl>${s.chunks.map((c) => `<div><dt lang="en">${e(c.text)}</dt><dd>${e(c.explanation)}</dd></div>`).join("")}</dl><p class="lesson-note">${e(s.takeaway)}</p></article>`).join("")}<h4>带着这几条去练习</h4><ul class="analysis-next">${lesson.takeaways.map((t) => `<li>${e(t)}</li>`).join("")}</ul>`
    : "";
  return `<section class="analysis-card lesson" id="analysis-lesson">
    <p class="eyebrow">LEARN FIRST · THEN APPLY</p><h3>${e(b.study.title)}</h3>
    <p class="analysis-meta">词汇讲解由 Codex 编写。讲解与精读约 ${b.study.estimatedMinutes} 分钟，练习时间另计。${b.translationsAvailable ? "本课有效题已作答，现可对照译文复盘。" : "先阅读英文并尝试理解；完成本课全部有效题后显示例句、逐句及全文译文，不要求全部答对。"}学习进度与答题成绩分别保存。</p>
    ${b.study.required ? `<ol class="lesson-steps" aria-label="本课进度"><li ${stage === "concepts" ? 'aria-current="step"' : ""}>01 学习讲解${b.study.conceptsAt ? " ✓" : ""}</li><li ${stage === "reading" ? 'aria-current="step"' : ""}>02 语料精读${b.study.completedAt ? " ✓" : ""}</li><li ${stage === "practice" ? 'aria-current="step"' : ""}>03 课后练习</li></ol>` : '<p class="analysis-banner">本次含跨日复测，先在新语境中独立回忆。提前回看学习材料可继续作答，但未答题会记为辅助学习。</p>'}
    ${stage === "practice" ? (lesson ? `${concepts}${reading}` : `<p>学习内容已收起。用新的语境检查自己能否回忆和理解。</p><button type="button" data-help="hint" data-question="*">回看讲解与精读（未答题记为辅助）</button>`) : step === "concepts" ? `${concepts}<div class="analysis-actions"><button type="button" class="primary" data-study-complete="concepts">${b.study.conceptsAt ? "返回语料精读" : "讲解已学完，去精读"} →</button></div><p class="analysis-meta">点击后保存讲解进度，可以换设备继续。</p>` : `<button type="button" class="text-button" data-study-view="concepts">← 回看词汇讲解</button>${reading}<div class="analysis-actions"><button type="button" class="primary" data-study-complete="reading">精读已完成，开始课后练习 →</button></div><p class="analysis-meta">开始后将收起讲解；答题时再回看会记录辅助学习。完成学习不等于已掌握。</p>`}
  </section>`;
}

export function initAnalysis(
  api: Api,
  authFailure: (error: unknown) => void,
  openWord: (id: string) => void,
) {
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
  let period: PeriodKind | "history" = "history";
  let area: "home" | "reports" = "home";
  let preparing = false;
  let filters: HistoryFilters = { query: "", stage: "", retest: false };
  let lessonStep: "concepts" | null = null;
  let questionId: string | null = null;
  let courseScreen: CourseScreen = "learning";
  let batching = false;
  let needsReadback = false;
  let recentWordCount: number | null = null;
  let reportId = new URL(location.href).searchParams.get("report") ?? "";
  // Target words from sentences opened for help, per course; kept in this page only.
  const helped = new Map<string, Set<string>>();
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
    if (form.id === "course-filters") {
      const fields = new FormData(form);
      filters = {
        query: String(fields.get("query") ?? ""),
        stage: String(fields.get("stage") ?? ""),
        retest: fields.has("retest"),
      };
      return;
    }
    drafts.set(
      formKey(form),
      [...new FormData(form)].map(([k, v]) => [k, String(v)]),
    );
    dirty = drafts.size > 0;
  }
  function restoreDrafts() {
    for (const schedule of data?.bundle?.schedules ?? [])
      drafts.delete(`schedule:${schedule.wordId}`);
    dirty = drafts.size > 0;
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
    el("analysis-reconcile").textContent =
      pending?.action === "schedule"
        ? "确认待保存安排的实际结果"
        : "读取已保存结果并取消待保存操作";
    root
      .querySelectorAll<HTMLElement>(".course-save-status")
      .forEach((item) => {
        item.textContent = message;
        item.dataset.error = String(error);
      });
  }
  function url() {
    const url = new URL(location.href);
    url.searchParams.set("view", area === "home" ? "today" : "analysis");
    reportId
      ? url.searchParams.set("report", reportId)
      : url.searchParams.delete("report");
    history.replaceState(null, "", url);
  }
  function requestCopy() {
    return preparationHtml(
      data!,
      period === "history"
        ? "最近的"
        : { day: "今天的", week: "本周的", month: "本月的" }[period],
    );
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
    el("analysis-heading").textContent = reportId
      ? "跟着这一步，继续学习。"
      : area === "home"
        ? "今天，从这里继续。"
        : "历史课程与学习分析";
    el("analysis-periods").hidden = area === "home" || !!reportId || preparing;
    el("analysis-return").hidden = area === "home" && !reportId && !preparing;
    el("analysis-return").textContent =
      area === "reports" && reportId ? "返回历史课程" : "返回今日学习";
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
        '<div class="empty"><h3>解锁后继续你的学习</h3><p>输入个人口令后读取课程、保存进度与复习安排；公开词库仍可浏览。</p><button type="button" class="primary" data-login>解锁并继续</button><button type="button" data-view="library">浏览词库</button></div>';
      return;
    }
    if (!data) return;
    if (!reportId && preparing) {
      body.innerHTML = requestCopy();
      return;
    }
    if (!reportId && area === "home") {
      body.innerHTML = `${recentWordCount === null ? "" : `<p class="analysis-banner">本次已保存 ${recentWordCount} 次自评。可以直接结束，或按下面的推荐继续。</p>`}${homeHtml(data)}`;
      return;
    }
    if (period === "history" && !reportId) {
      body.innerHTML = historyHtml(data, filters);
      return;
    }
    const b = data.bundle;
    if (!b) {
      body.innerHTML = `<div class="analysis-layout"><div class="analysis-main"><div class="analysis-banner">本期尚未生成分析。历史课程 ${data.summaries.length} 份仍可访问。<button type="button" data-period="history">查看历史课程</button></div>${requestCopy()}</div><aside class="analysis-sidebar">${retests()}${overview()}</aside></div>`;
      return;
    }
    const evidence = (ids: string[]) =>
      ids
        .flatMap((id) => b.facts.evidence.find((item) => item.id === id) ?? [])
        .map(evidenceLine)
        .join("");
    const report = `<h3>${e(b.content.title)}</h3><p>${e(b.content.summary)}</p>
      <p class="analysis-meta">${periodNames[b.period.kind]} · 版本 ${b.version} · 截至 ${e(dateTime(b.period.cutoff))}<br/>${e(learningDay(b.period.start))} 至 ${e(learningDay(new Date(Date.parse(b.period.end) - 1)))} · ${b.period.complete ? "完整历史周期" : "进行中的周期"}</p>
      ${data.summaries.find((summary) => summary.id === b.id)?.hasNewRecords ? '<p class="analysis-banner">有新记录可用于更新；这份分析保留原截止时间与统计。</p>' : ""}
      ${metrics(b.facts.metrics)}<p>实际覆盖 ${b.facts.metrics.coveredDays.length} 个学习日。自评不代表长期掌握。</p>
      <details class="analysis-evidence"><summary>上一周期比较与边界</summary>${metrics(b.facts.previousMetrics)}<p>不同题组的整体比例不能直接解释为能力提升。同批词复测样本 ${b.facts.retestCohort.sampleCount} 题，间隔 ${b.facts.retestCohort.intervalsDays.join("、") || "暂无"} 天。</p><ul>${b.facts.metrics.questionTypes.map((item) => `<li>${types[item.type]}：${accuracy(item)}</li>`).join("")}</ul></details>
      <h4>目标词与依据</h4>${b.content.exercise.targets.map((target) => `<details class="analysis-evidence"><summary>${e(words.get(target.wordId)?.term ?? target.wordId)} · ${e(target.reason)}</summary><p>${wordButton(target.wordId)} · ${e(target.meaning)}${target.extension ? "（扩展含义）" : ""}</p><p>目标用法：${e(target.usage)}</p><ul>${evidence(target.evidenceIds) || "<li>用户指定补练，尚不构成薄弱诊断。</li>"}</ul></details>`).join("")}
      ${b.content.findings.map((finding) => `<details class="analysis-evidence"><summary>${finding.kind === "fact" ? "记录事实" : finding.kind === "hypothesis" ? "可能原因，待验证" : "学习建议"}：${e(finding.text)}</summary><ul>${evidence(finding.evidenceIds) || "<li>没有作为已验证诊断。</li>"}</ul></details>`).join("")}
      <h4>当时建议的下一步</h4><ul>${b.content.nextSteps.map((step) => `<li>${e(step)}</li>`).join("")}</ul>
      ${b.content.replaces?.map((item) => `<p>修正说明：${e(item.reason)} <button type="button" data-report="${e(item.bundleId)}">查看原版本</button></p>`).join("") ?? ""}`;
    body.innerHTML = courseHtml(b, {
      questionId,
      screen: courseScreen,
      lesson: lessonHtml(b, lessonStep),
      report,
      helped: [...(helped.get(b.id) ?? [])],
    });
    if (
      courseScreen === "ended" &&
      !data.home.actionIds.some((id) => id !== b.id)
    )
      body.querySelector("[data-another-course]")?.remove();
    const localStatus = document.createElement("p");
    localStatus.className = "analysis-meta course-save-status";
    localStatus.setAttribute("role", "status");
    localStatus.textContent = el("analysis-status").textContent;
    body
      .querySelector(".analysis-question, #analysis-lesson, #analysis-results")
      ?.append(localStatus);
    syncCustomDates();
  }
  async function refresh(keepSelection = true) {
    if (!authenticated || !active || loading || busy || batching) return false;
    if ((dirty && data && !needsReadback) || pending) {
      status("有尚未确认保存的内容，请先提交、重试或取消待保存操作。", true);
      return;
    }
    loading = true;
    const readingButtons = [
      ...root.querySelectorAll<HTMLButtonElement>("button:not(:disabled)"),
    ];
    readingButtons.forEach((button) => (button.disabled = true));
    status("正在读取已保存的报告与练习…");
    try {
      const fresh: PracticeData = await api(
        `practice${reportId && keepSelection ? `?report=${encodeURIComponent(reportId)}` : ""}`,
      );
      if (!active || !authenticated) return;
      data = fresh;
      needsReadback = false;
      if (
        area === "reports" &&
        !preparing &&
        !reportId &&
        period !== "history"
      ) {
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
      return true;
    } catch (error) {
      body.innerHTML =
        '<div class="empty"><h3>暂时无法读取</h3><p>没有把读取失败计为零记录。请稍后点击“刷新学习内容”。</p></div>';
      status(error instanceof Error ? error.message : "暂时无法读取", true);
      if ((error as { status?: number }).status === 401) authFailure(error);
      return false;
    } finally {
      loading = false;
      readingButtons.forEach((button) => (button.disabled = false));
    }
  }
  async function save(action?: Record<string, unknown>) {
    if (busy || loading || !authenticated || needsReadback) return false;
    if (action && pending) {
      status("请先重试或取消待保存操作。", true);
      return false;
    }
    if (action) {
      pending = {
        ...action,
        operationId: crypto.randomUUID(),
        bundleId: data!.bundle!.id,
      };
      persist();
    }
    if (!pending) return false;
    const submitted = pending;
    const submittedKey = `${pending.action}:${pending.questionId ?? pending.wordId ?? ""}`;
    busy = true;
    status("正在保存，尚未确认完成…");
    const enabledButtons = [
      ...root.querySelectorAll<
        | HTMLButtonElement
        | HTMLInputElement
        | HTMLTextAreaElement
        | HTMLSelectElement
      >(
        "button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled)",
      ),
    ];
    enabledButtons.forEach((button) => (button.disabled = true));
    try {
      const result: PracticeData = await api("practice", "POST", pending);
      pending = null;
      persist();
      drafts.delete(submittedKey);
      dirty = drafts.size > 0;
      data = result;
      if (submitted.action === "answer")
        questionId = String(submitted.questionId);
      if (submitted.action === "flag") questionId = null;
      courseScreen = "learning";
      if (
        submitted.action === "schedule" ||
        (submitted.action === "feedback" && !submitted.questionId)
      )
        courseScreen = "results";
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
      return true;
    } catch (error) {
      const code = (error as { status?: number }).status;
      if (code === 400 || code === 409) {
        // These responses mean the transaction was rejected, unlike a timeout.
        // Refresh dates/attempt counts before creating a new operation.
        pending = null;
        persist();
        needsReadback = true;
        try {
          data = await api(
            `practice?report=${encodeURIComponent(String(submitted.bundleId))}`,
          );
          needsReadback = false;
          render();
          restoreDrafts();
        } catch {
          // Keep drafts and require a fresh read before another submission.
        }
      }
      status(
        `${error instanceof Error ? error.message : "尚未确认保存，请重试。"}${needsReadback ? " 请先重新读取最新记录，再确认本次输入。" : ""}`,
        true,
      );
      if ((error as { status?: number }).status === 401) authFailure(error);
      return false;
    } finally {
      busy = false;
      enabledButtons.forEach((button) => (button.disabled = false));
    }
  }
  async function finishSchedules(decision: "accepted" | "skipped") {
    if (busy || batching || pending || needsReadback || !data?.bundle) return;
    const actions: Record<string, unknown>[] = [];
    for (const form of body.querySelectorAll<HTMLFormElement>(
      "[data-schedule-form]",
    )) {
      if (decision === "accepted" && !form.reportValidity()) return;
      const proposal = data.bundle.suggestions.find(
        (item) => item.wordId === form.dataset.scheduleForm,
      )!;
      const fields = new FormData(form);
      const choice =
        decision === "skipped"
          ? "suggested"
          : String(fields.get("manualChoice"));
      actions.push({
        action: "schedule",
        wordId: proposal.wordId,
        decision,
        manualChoice: choice,
        manualDate: proposal.manualDate,
        scheduledDate:
          choice === "keep"
            ? proposal.manualDate
            : choice === "custom"
              ? fields.get("scheduledDate")
              : proposal.suggestedDate,
      });
    }
    // Optional feedback must not be silently discarded by the completion action.
    if ([...drafts.keys()].some((key) => !key.startsWith("schedule:"))) {
      status("还有未提交的答案或反馈，请先保存，或取消修改后再结束。", true);
      return;
    }
    batching = true;
    let finished = true;
    try {
      for (const action of actions) {
        if (!(await save(action))) {
          finished = false;
          break;
        }
      }
    } finally {
      batching = false;
      if (finished && !data.bundle.progress.pendingSuggestionCount)
        courseScreen = "ended";
      render();
      restoreDrafts();
      if (courseScreen === "ended")
        el("analysis-receipt")?.scrollIntoView({ block: "start" });
      status(
        finished
          ? "复习建议已处理，本次学习已保存。"
          : "部分安排尚未确认；已保存部分保留。请先重试待保存项，再处理其余建议。",
        !finished,
      );
    }
  }
  function canNavigate() {
    if (loading) {
      status("正在读取内容，请稍候。");
      return false;
    }
    if (busy || batching || pending) {
      status("请先处理待保存操作。", true);
      return false;
    }
    if (dirty && !confirm("有未提交的答案或反馈，切换将放弃这些内容。继续吗？"))
      return false;
    drafts.clear();
    dirty = false;
    lessonStep = null;
    questionId = null;
    courseScreen = "learning";
    return true;
  }
  root.addEventListener("input", (event) => {
    const form = (event.target as Element).closest("form");
    if (form) {
      rememberDraft(form);
      if (form.id !== "course-filters") status("当前修改尚未提交保存。");
    }
  });
  root.addEventListener("change", (event) => {
    const form = (event.target as Element).closest("form");
    syncCustomDates();
    if (form) rememberDraft(form);
  });
  root.addEventListener(
    "toggle",
    (event) => {
      const help = event.target as HTMLDetailsElement;
      const id = data?.bundle?.id;
      if (!id || !help.classList?.contains("sentence-help") || !help.open) return;
      const set = helped.get(id) ?? new Set<string>();
      help.dataset.words?.split(",").filter(Boolean).forEach((word) => set.add(word));
      helped.set(id, set);
    },
    true,
  );
  root.addEventListener("click", async (event) => {
    const button = (event.target as Element).closest<HTMLButtonElement>(
      "button",
    );
    if (!button || busy || batching) return;
    if (button.hasAttribute("data-reask-check")) {
      const item = button.closest<HTMLElement>(".reask-item")!;
      const given = normalize(item.querySelector("input")!.value);
      const right = [item.dataset.answer!, item.dataset.target!].some(
        (value) => normalize(value) === given,
      );
      item.querySelector(".reask-result")!.textContent = !given
        ? `参考答案：${item.dataset.answer}。`
        : right
          ? "答对了。明天的复习会再检查一次。"
          : `参考答案是“${item.dataset.answer}”，这个用法明天还会再问。`;
      return;
    }
    if (button.dataset.open && data?.bundle?.study.stage === "practice") {
      event.stopPropagation();
      const wordId = button.dataset.open;
      const unanswered = data.bundle.content.exercise.questions.filter(
        (question) =>
          question.wordIds.includes(wordId) &&
          !question.attempts.length &&
          !question.access.blocked &&
          !question.assisted,
      );
      for (const question of unanswered) {
        if (!(await save({ action: "hint", questionId: question.id }))) return;
      }
      openWord(wordId);
      return;
    }
    if (button.hasAttribute("data-discard-drafts")) {
      if (pending) {
        status("请先确认待保存操作的结果。", true);
        return;
      }
      drafts.clear();
      dirty = false;
      render();
      status("已取消本页尚未提交的修改；已保存记录保持不变。");
    }
    if (
      button.hasAttribute("data-next-question") ||
      button.hasAttribute("data-show-results")
    ) {
      if (!canNavigate()) return;
      questionId = data?.bundle?.progress.nextQuestionId ?? null;
      courseScreen = button.hasAttribute("data-show-results")
        ? "results"
        : "learning";
      render();
      body
        .querySelector(".analysis-question, #analysis-results")
        ?.scrollIntoView({ block: "start" });
    }
    if (button.hasAttribute("data-confirm-schedules"))
      await finishSchedules("accepted");
    if (button.hasAttribute("data-skip-schedules"))
      await finishSchedules("skipped");
    if (button.hasAttribute("data-finish-course")) {
      if (!canNavigate()) return;
      courseScreen = "ended";
      render();
      el("analysis-receipt")?.scrollIntoView({ block: "start" });
    }
    if (button.hasAttribute("data-pause-course")) {
      const label = data?.bundle?.progress.label;
      if (!canNavigate()) return;
      reportId = "";
      url();
      render();
      status(
        `已保存阶段：${label ?? "尚无记录"}。下次可继续；未提交内容未保存。`,
      );
      el("analysis-heading").scrollIntoView({ block: "start" });
    }
    if (button.hasAttribute("data-another-course")) {
      if (!canNavigate()) return;
      reportId = data?.home.actionIds.find((id) => id !== reportId) ?? "";
      void refresh();
    }
    if (button.dataset.period) {
      if (!canNavigate()) return;
      preparing = false;
      period = button.dataset.period as typeof period;
      reportId = "";
      void refresh(false);
    }
    if (button.dataset.report) {
      if (!canNavigate()) return;
      preparing = false;
      reportId = button.dataset.report;
      if (await refresh())
        el("analysis-heading").scrollIntoView({ block: "start" });
    }
    if (button.hasAttribute("data-prepare")) {
      if (!canNavigate()) return;
      preparing = true;
      reportId = "";
      url();
      render();
    }
    if (button.hasAttribute("data-clear-courses")) {
      filters = { query: "", stage: "", retest: false };
      render();
    }
    if (button.hasAttribute("data-refresh-material")) {
      const previous = new Set(data?.summaries.map((summary) => summary.id));
      const read = await refresh();
      if (read && data && preparing) {
        const added = data.summaries.find(
          (summary) => !previous.has(summary.id),
        );
        if (added) {
          const notice = document.createElement("div");
          notice.className = "analysis-banner";
          notice.innerHTML = `材料已就绪：${e(added.title)} <button type="button" data-report="${e(added.id)}">打开课程</button>`;
          body.prepend(notice);
        } else status("尚未读取到新材料；确认 Codex 保存完成后再刷新。");
      }
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
    const form = event.target as HTMLFormElement;
    const f = new FormData(form);
    if (form.id === "course-filters") {
      filters = {
        query: String(f.get("query") ?? ""),
        stage: String(f.get("stage") ?? ""),
        retest: f.has("retest"),
      };
      render();
      return;
    }
    const bundle = data!.bundle!;
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
    if (form.dataset.scheduleForm) void finishSchedules("accepted");
  });
  el("analysis-return").addEventListener("click", () => {
    if (area === "reports" && !reportId) {
      document
        .querySelector<HTMLButtonElement>('.view-tabs [data-view="today"]')
        ?.click();
      return;
    }
    if (!canNavigate()) return;
    reportId = "";
    preparing = false;
    period = "history";
    url();
    render();
    void refresh(false);
  });
  el("analysis-refresh").addEventListener("click", () => {
    if (needsReadback || canNavigate()) void refresh();
  });
  el("analysis-retry").addEventListener("click", () => void save());
  el("analysis-reconcile").addEventListener("click", async () => {
    if (busy || batching || !pending) return;
    if (pending.action === "schedule") {
      // An in-flight schedule may commit after a read. Resolve its original operation
      // before allowing a conflicting skip or a new date selection.
      await save();
      return;
    }
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
    wordSessionFinished(count: number) {
      recentWordCount = count;
    },
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
    show(value: "home" | "reports" | null) {
      const changed = value && (area !== value || !active);
      active = value !== null;
      root.hidden = !active;
      if (value) {
        if (changed || data) {
          area = value;
          preparing = false;
          // A deep link retains its exact course until navigation leaves the initial view.
          if (data) reportId = "";
          questionId = null;
          courseScreen = "learning";
          period = "history";
        }
        url();
        render();
        if (pending)
          status("有尚未确认保存的操作，请重试或读取已保存结果。", true);
        else void refresh();
      }
    },
    canNavigate,
    canLock: () =>
      !busy &&
      !batching &&
      (!(pending || dirty) ||
        confirm("有尚未保存的练习内容，锁定会清除本机待保存操作。继续吗？")),
    clear() {
      pending = null;
      persist();
      drafts.clear();
      dirty = false;
      data = null;
      needsReadback = false;
    },
    refresh: () => void refresh(),
  };
}
