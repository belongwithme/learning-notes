import catalog from "../data/english.json";
import { learningDay } from "../lib/english/model";
import { courseStages } from "../lib/english/journey-model";
import type { PracticeData } from "../lib/english/practice-server";

export const escapeHtml = (value: unknown) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        character
      ]!,
  );
export const words = new Map(catalog.entries.map((word) => [word.id, word]));
export const dateTime = (value: string) =>
  new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
export const wordButton = (id: string) =>
  `<button type="button" class="analysis-word" data-open="${escapeHtml(id)}">${escapeHtml(words.get(id)?.term ?? id)}</button>`;
const e = escapeHtml;
type Summary = PracticeData["summaries"][number];
export interface HistoryFilters {
  query: string;
  stage: string;
  retest: boolean;
}

function courseCard(
  data: PracticeData,
  summary: Summary,
  primary = false,
  label?: string,
) {
  const p = summary.progress;
  const evidence = summary.evidenceIds.flatMap(
    (id) => data.overview.evidence.find((item) => item.id === id) ?? [],
  );
  const resultNames: Record<string, string> = {
    forgot: "忘了",
    vague: "模糊",
    remembered: "记得",
    correct: "答对",
    incorrect: "答错",
  };
  return `<article class="analysis-card journey-course${primary ? " journey-recommended" : ""}">
    ${primary ? '<p class="eyebrow">接下来学这一项</p>' : ""}
    <h3>${e(summary.title)}</h3><p>${e(p.label)} · ${p.answeredCount} / ${p.validCount} 道有效题已答</p>
    ${primary ? `<p>${e(summary.reason)}</p><p class="analysis-meta">${summary.estimatedMinutes ? `完整讲解与精读约 ${summary.estimatedMinutes} 分钟；` : "讲解时长未标注；"}练习约 ${summary.practiceMinutes} 分钟。可中途暂停。</p>` : ""}
    <button type="button" ${primary ? 'class="primary"' : ""} data-report="${e(summary.id)}">${e(label ?? p.action)}</button>
    <details class="analysis-evidence"><summary>目标词与课程详情</summary>
      <p>${summary.wordIds.map(wordButton).join(" · ")}</p>
      <p class="analysis-meta">生成于 ${e(dateTime(summary.createdAt))} · 版本 ${summary.version}<br/>分析周期 ${e(learningDay(summary.period.start))} 至 ${e(learningDay(new Date(Date.parse(summary.period.end) - 1)))} · 内容截至 ${e(dateTime(summary.period.cutoff))}</p>
      <p>待复测 ${summary.pendingRetestCount} 项，其中到期 ${summary.dueRetestCount} 项。</p>
      ${evidence.length ? `<ul>${evidence.map((item) => `<li>${e(dateTime(item.at))} · ${e(item.wordIds.map((id) => words.get(id)?.term ?? id).join("、"))} · ${item.kind === "self-review" ? "自评" : "学习证据"} · ${e(resultNames[item.result] ?? "查看当时记录")}</li>`).join("")}</ul>` : ""}
      ${summary.replacedByIds.map((id) => `<button type="button" data-report="${e(id)}">查看修正版</button>`).join("")}
    </details></article>`;
}

export function homeHtml(data: PracticeData) {
  const actions = data.home.actionIds.flatMap(
    (id) => data.summaries.find((s) => s.id === id) ?? [],
  );
  const main = actions[0];
  const continuing = data.summaries.find((s) => s.id === data.home.continueId);
  const preparing =
    data.home.preparationWordIds.length + data.home.preparationRetestIds.length;
  const schedules = data.retests.filter(
    (r) => r.decision === "accepted" && !r.completedAt,
  );
  const today = learningDay(data.home.asOf);
  const due = schedules.filter((r) => r.scheduledDate <= today);
  const missingDue = due.filter((r) => !r.readyBundleId);
  return `<div class="journey-stack">
    <p class="analysis-meta">截至 ${e(dateTime(data.home.asOf))} · 已保存的学习进度可在其他设备继续。</p>
    ${main ? courseCard(data, main, true, main.progress.pendingSuggestionCount ? main.progress.action : main.group === 0 ? "开始到期复习" : main.group === 1 ? "继续上次学习" : "开始今天的学习") : `<section class="analysis-card journey-recommended"><h3>${preparing ? "先准备下一份巩固材料" : data.home.hasRecords ? "今天可以再认识一些词" : "从几个熟悉的词开始"}</h3><p>${preparing ? "已有学习依据，当前还没有可直接开始的课程。准备好材料后即可在这里学习。" : "先看英文，回忆含义，再记录记得、模糊或忘了。随时可以结束。"}</p><button type="button" class="primary" ${preparing ? "data-prepare" : 'data-view="words"'}>${preparing ? "准备巩固材料" : data.home.hasRecords ? "去学词" : "开始学词"}</button></section>`}
    ${continuing && continuing.id !== main?.id ? `<p><button type="button" data-report="${e(continuing.id)}">继续上次课程：${e(continuing.title)}</button></p>` : ""}
    ${
      actions.length > 1
        ? `<details class="journey-other"><summary>其他可学内容 ${actions.length - 1} 项</summary><div class="journey-stack">${actions
            .slice(1)
            .map((s) => courseCard(data, s))
            .join("")}</div></details>`
        : ""
    }
    <div class="analysis-actions"><button type="button" data-view="analysis">历史课程 ${data.summaries.length} 份</button><button type="button" data-view="words">去学词</button></div>
    ${preparing && main ? `<section class="analysis-card"><h3>待准备材料</h3><p>${data.home.preparationWordIds.length} 个目标词，${data.home.preparationRetestIds.length} 项复测需要新材料。不影响先学已有课程。</p><button type="button" data-prepare>查看准备步骤</button></section>` : ""}
    ${schedules.length ? `<details class="analysis-card"><summary>已确认的复习安排 ${schedules.length} 项 · 到期 ${due.length} 项</summary><p>到期安排中 ${missingDue.length} 项待准备材料。安排数量与课程数量分别统计。</p>${schedules.map((r) => `<div class="analysis-evidence">${wordButton(r.wordId)}<p>${e(r.usage)} · ${e(r.scheduledDate)} · ${r.scheduledDate > today ? "尚未到期" : "已到期"}</p>${r.readyBundleId ? `<button type="button" data-report="${e(r.readyBundleId)}">${r.scheduledDate <= today ? "开始复习" : "查看安排"}</button>` : '<span class="analysis-meta">新题待准备</span>'}</div>`).join("")}</details>` : ""}
  </div>`;
}

export function historyHtml(data: PracticeData, filters: HistoryFilters) {
  const query = filters.query.trim().toLowerCase();
  const matches = data.summaries.filter(
    (s) =>
      (!filters.stage || s.progress.stage === filters.stage) &&
      (!filters.retest || s.pendingRetestCount > 0) &&
      (!query ||
        [
          s.title,
          ...s.wordIds.flatMap((id) => [
            id,
            words.get(id)?.term ?? "",
            words.get(id)?.meaning ?? "",
          ]),
        ]
          .join(" ")
          .toLowerCase()
          .includes(query)),
  );
  let lastDay = "";
  const cards = matches
    .map((s) => {
      const day = learningDay(s.createdAt);
      const heading =
        day !== lastDay ? `<h3 class="history-day">${e(day)} 生成</h3>` : "";
      lastDay = day;
      return heading + courseCard(data, s);
    })
    .join("");
  return `<form id="course-filters" class="journey-filters" role="search">
    <label>搜索课程<input type="search" name="query" value="${e(filters.query)}" placeholder="课程标题或目标词" /></label>
    <label>学习进度<select name="stage"><option value="">全部进度</option>${Object.entries(
      courseStages,
    )
      .map(
        ([value, label]) =>
          `<option value="${value}" ${filters.stage === value ? "selected" : ""}>${label}</option>`,
      )
      .join("")}</select></label>
    <label class="journey-checkbox"><input type="checkbox" name="retest" ${filters.retest ? "checked" : ""}/>有待复测安排</label>
    <button type="submit">查询</button><button type="button" data-clear-courses>清除筛选</button></form>
    <p role="status">共 ${data.summaries.length} 份历史课程，当前找到 ${matches.length} 份。</p>
    <div class="journey-stack">${cards || `<div class="empty"><h3>${data.summaries.length ? "当前筛选没有结果" : "还没有保存的历史课程"}</h3><p>${data.summaries.length ? "清除筛选后可查看全部历史。" : "已保存的课程和当时的分析会保留在这里。"}</p></div>`}</div>`;
}

export function preparationHtml(data: PracticeData, periodLabel = "最近的") {
  const ready = data.home.actionIds.flatMap(
    (id) => data.summaries.find((s) => s.id === id) ?? [],
  )[0];
  const wordIds = data.home.preparationWordIds;
  const retests = data.retests.filter((r) =>
    data.home.preparationRetestIds.includes(r.id),
  );
  const request = `请使用 learning-notes 项目的 scripts/english-context.mjs 和 scripts/english-save.mjs（流程见 README），读取我${periodLabel}英语学习记录与已确认复测安排。页面当前待准备词条：${wordIds.join("、") || "以最新读取结果为准"}；待准备复测安排：${retests.map((r) => `${r.id}（${r.wordId}，${r.usage}，${r.scheduledDate}）`).join("；") || "以最新读取结果为准"}。先说明数据范围，不含私人笔记。处理本次初始 generationCoverage.pendingWordIds 中全部词条，可分课但不可截断；已有课程不重复生成。按既有质量要求生成完整讲解、双语例句、逐句精读与新语境客观题；专项复测关联已确认安排与目标用法。生成并保存，保留历史版本，全部保存后读回核对覆盖情况并返回网站课程链接。`;
  return `<section class="analysis-card"><h3>在 Codex 准备材料</h3>
    <ol class="analysis-next"><li>复制下面的准备请求。</li><li>粘贴给 Codex，等待它生成、保存并读回确认。</li><li>打开 Codex 返回的课程链接，或回到这里刷新学习内容。</li></ol>
    <p>复制请求不会启动网站后台生成。尚未读取到材料时，可以先学已有内容或随时离开。</p>
    ${wordIds.length ? `<details><summary>待准备目标词 ${wordIds.length} 个</summary><p>${wordIds.map(wordButton).join(" · ")}</p></details>` : ""}
    ${retests.length ? `<p>需要新语境材料的复测 ${retests.length} 项；未到期安排仍须等约定日期作答。</p>` : ""}
    <label for="analysis-prompt">准备请求</label><textarea id="analysis-prompt" class="analysis-copy" readonly>${e(request)}</textarea>
    <div class="analysis-actions"><button type="button" class="primary" id="analysis-copy">复制准备请求</button><button type="button" data-refresh-material>刷新学习内容</button></div>
    ${ready ? `<p>已有可学习内容：${e(ready.title)}</p><button type="button" data-report="${e(ready.id)}">先学已有内容</button>` : '<button type="button" data-view="words">去学词</button>'}
    <p class="analysis-meta">材料只有保存并读回后才会出现在网站。聊天中的草稿不是已发布课程。</p></section>`;
}
