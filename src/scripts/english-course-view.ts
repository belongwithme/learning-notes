import {
  escapeHtml as e,
  words,
  wordButton,
  dateTime,
} from "./english-journey-view";
import type { PracticeData } from "../lib/english/practice-server";
import { dialogues } from "./english-data";
import { learningDay } from "../lib/english/model";
import { addDays } from "../lib/english/practice-model";
import { clozeFor, target } from "../lib/english/cloze";

type Course = NonNullable<PracticeData["bundle"]>;
type Question = Course["content"]["exercise"]["questions"][number];
export type CourseScreen = "learning" | "results" | "ended";
const dialogueByWord = new Map(
  dialogues.flatMap((dialogue) =>
    dialogue.wordIds.map((id) => [id, dialogue] as const),
  ),
);
const types = {
  meaning: "词义辨析",
  collocation: "搭配或选词",
  comprehension: "句子与短文理解",
};

function questionHtml(q: Question, index: number, total: number) {
  const first = q.attempts[0],
    latest = q.attempts.at(-1);
  const blocked = q.access.blocked;
  const answerForm = blocked
    ? ""
    : `<form data-answer-form="${e(q.id)}">
    <fieldset><legend>${e(q.prompt)}</legend>
      ${q.format === "choice" ? q.options.map((option) => `<label class="analysis-option"><input type="radio" name="answer" value="${e(option.id)}" required ${latest?.payload.answer === option.id ? "checked" : ""}/><span>${e(option.text)}</span></label>`).join("") : `<label class="sr-only" for="answer-${e(q.id)}">填空答案</label><input id="answer-${e(q.id)}" type="text" name="answer" required maxlength="4000" autocomplete="off" value="${e(latest?.payload.answer ?? "")}"/>`}
    </fieldset><div class="analysis-actions"><button type="submit" ${latest ? "" : 'class="primary"'}>${latest ? "保存重做答案" : "提交答案"}</button>
      ${latest ? "" : `<button type="button" data-help="hint" data-question="${e(q.id)}">查看提示</button><button type="button" data-help="reveal" data-question="${e(q.id)}">查看答案</button>`}
    </div><p class="analysis-meta">${latest ? "重做保留记录，不改变首次表现。" : "选择后请提交；当前答案尚未保存。"}</p></form>`;
  return `<article class="analysis-card analysis-question" id="question-${e(q.id)}">
    <p class="eyebrow">${q.flagged ? "待核对题" : `第 ${index + 1} 题，共 ${total} 道有效题`} · ${types[q.type]}</p>
    <p class="analysis-material" lang="en">${e(q.context)}</p>
    <p class="analysis-meta">考查：${q.wordIds.map((id) => e(words.get(id)?.term ?? id)).join(" · ")}${q.assisted && !first ? " · 已使用辅助材料" : ""}</p>
    ${blocked ? `<p class="analysis-banner">${e(blocked)}</p>${q.access.completedBundleId ? `<button type="button" data-report="${e(q.access.completedBundleId)}">查看完成版本</button>` : ""}` : ""}
    ${
      latest
        ? `<div class="analysis-result" data-correct="${latest.payload.correct}"><strong>已确认保存 · ${latest.payload.correct ? "本次答对" : "本次答错"}</strong>
      <p>首次答案：${e(first.payload.answer)} · ${first.payload.correct ? "正确" : "错误"} · ${first.payload.assisted ? "辅助作答" : "无提示首次作答"}</p>
      ${q.wordIds.length > 1 && !first.payload.correct ? "<p>多词理解题答错，尚不能定位具体哪个词不稳。</p>" : ""}
      <p>${e(dateTime(latest.createdAt))} · 共 ${q.attempts.length} 次提交${q.flagged ? " · 当前不参与有效结果统计" : ""}</p></div>
      ${answerForm ? `<details><summary>重做此题</summary>${answerForm}</details>` : ""}
      <details><summary>全部作答记录</summary><ul>${q.attempts.map((answer) => `<li>${e(dateTime(answer.createdAt))} · ${e(answer.payload.answer)} · ${answer.payload.correct ? "正确" : "错误"} · ${answer.payload.assisted ? "辅助或重做" : "无提示首次"}</li>`).join("")}</ul></details>`
        : answerForm
    }
    ${q.hint ? `<p class="analysis-result">提示：${e(q.hint)}</p>` : ""}
    ${q.answers.length ? `<div class="analysis-result"><strong>标准答案：${q.answers.map((answer) => e(q.options.find((option) => option.id === answer)?.text ?? answer)).join(" / ")}</strong><p>${e(q.explanation)}</p></div>` : ""}
    <details><summary>反馈困难或标记题目有误</summary>
      <form data-question-feedback="${e(q.id)}"><label>这道题卡在哪里？<select name="difficultyType"><option value="meaning">词义</option><option value="collocation">搭配</option><option value="comprehension">句子理解</option></select></label><button type="submit">保存困难反馈</button></form>
      ${q.flagged ? "" : `<form data-flag-form="${e(q.id)}"><label for="flag-${e(q.id)}">哪里有误或歧义？</label><textarea id="flag-${e(q.id)}" name="reason" required maxlength="1000"></textarea><button type="submit">标记待核对</button></form>`}
    </details></article>`;
}

function schedulesHtml(b: Course) {
  return b.suggestions
    .map((suggestion) => {
      const saved = b.schedules.find(
        (schedule) => schedule.wordId === suggestion.wordId,
      );
      return `<div class="analysis-schedule">${wordButton(suggestion.wordId)}<p>${e(suggestion.reason)}</p>
      ${
        saved
          ? `<p>${saved.decision === "accepted" ? `已安排 ${e(saved.scheduledDate)}；${saved.completedAt ? "该次复测已完成" : "下次打开可查看复习安排，新题可能仍待准备"}` : "已跳过本次建议，不计为遗忘"}</p>`
          : `<form data-schedule-form="${e(suggestion.wordId)}">
        ${suggestion.manualDate ? `<p class="analysis-banner">已有手工日期 ${e(suggestion.manualDate)}。请明确选择本次安排，原词库日期保留。</p>` : ""}
        <label>复习日期<select name="manualChoice" required>
          ${suggestion.manualDate ? `<option value="" selected>请选择采用的日期</option><option value="keep" ${suggestion.manualDate <= learningDay() ? "disabled" : ""}>采用手工日期 ${e(suggestion.manualDate)}${suggestion.manualDate <= learningDay() ? "（已过期，请选择新日期）" : ""}</option>` : ""}
          <option value="suggested">采用建议日期 ${e(suggestion.suggestedDate)}</option><option value="custom">自选日期</option>
        </select></label><label hidden>自选日期<input type="date" name="scheduledDate" value="${e(suggestion.suggestedDate)}" min="${addDays(learningDay(), 1)}" required disabled/></label>
      </form>`
      }</div>`;
    })
    .join("");
}

function feedbackHtml(b: Course) {
  const feedback = b.feedback
    .filter((event) => !event.questionId)
    .at(-1)?.payload;
  return `<details class="analysis-card analysis-feedback"><summary>可选反馈：难度与仍然模糊的词</summary>
    <form id="analysis-feedback"><label>本次难度<select name="difficulty">
      ${[
        ["suitable", "合适"],
        ["too-hard", "太难"],
        ["too-easy", "太简单"],
      ]
        .map(
          ([value, label]) =>
            `<option value="${value}" ${feedback?.difficulty === value ? "selected" : ""}>${label}</option>`,
        )
        .join("")}
    </select></label><p>仍然模糊的词（可选）：</p>${b.content.exercise.targets.map((target) => `<label><input type="checkbox" name="vagueWordIds" value="${e(target.wordId)}" ${feedback?.vagueWordIds?.includes(target.wordId) ? "checked" : ""}/>${e(words.get(target.wordId)?.term ?? target.wordId)}</label>`).join("")}
    <button type="submit">保存反馈并更新建议</button><button type="button" data-discard-drafts>取消未提交修改</button></form><p class="analysis-meta">已保存 ${b.feedback.length} 条反馈；未提交的选择不影响结果。</p></details>`;
}

// Words answered wrongly on the first try, plus words from sentences the reader
// opened for help, are asked again in a different sentence. This check is only
// shown here: it saves nothing and counts toward nothing; the confirmed
// next-day review is what gives independent evidence.
function reaskHtml(b: Course, helped: string[]) {
  const wrong = b.content.exercise.questions
    .filter((q) => !q.flagged && q.attempts[0] && !q.attempts[0].payload.correct)
    .flatMap((q) => q.wordIds);
  const items = [...new Set([...wrong, ...helped])].flatMap((id) => {
    const entry = words.get(id);
    const cloze = entry && clozeFor(entry, dialogueByWord.get(id), true);
    return entry && cloze ? [{ entry, cloze }] : [];
  });
  if (!items.length) return "";
  return `<section class="analysis-card" id="analysis-reask"><h4>换个语境，再问一次</h4>
    <p>刚才答错或看了译文求助的用法，换一句话再试。这里只在本页核对，不保存，也不计入成绩。</p>
    ${items.map(({ entry, cloze }) => `<div class="reask-item" data-answer="${e(cloze.answer)}" data-target="${e(target(entry))}"><p>提示：<strong>${e(entry.meaning)}</strong></p><p lang="en">${e(cloze.text)}</p><p class="analysis-meta">${e(cloze.zh)}</p><label class="sr-only" for="reask-${e(entry.id)}">缺少的词</label><input id="reask-${e(entry.id)}" type="text" autocomplete="off" autocapitalize="off" spellcheck="false"/> <button type="button" data-reask-check>核对</button><p class="reask-result" role="status"></p></div>`).join("")}</section>`;
}

function resultsHtml(b: Course, helped: string[]) {
  const p = b.progress;
  return `<section class="analysis-card" id="analysis-results"><p class="eyebrow">本次结果</p><h3>${e(p.label)}</h3>
    <p>${p.validCount ? `${p.correctCount} / ${p.validCount} 道有效题首次答对；已保存 ${p.answeredCount} 道有效答案。` : "暂无可统计的有效题，原答案保留。"}${p.flaggedCount ? `${p.flaggedCount} 道题待核对。` : ""}</p>
    <p>无提示首次正确：${p.independent.total ? `${p.independent.correct} / ${p.independent.total}` : "暂无数据"}。${p.isRetest ? `跨日复测独立通过 ${p.retestPassedWordIds.length} 个目标用法。作答完成与通过分别统计。` : "本次表现不代表已通过跨日复测。"}</p>
    ${
      p.complete
        ? `<h4>下次复习</h4>${schedulesHtml(b) || "<p>当前没有新的复测建议。可以结束本次学习。</p>"}
      <div class="analysis-actions">${p.pendingSuggestionCount ? '<button type="button" class="primary" data-confirm-schedules>按建议安排复习并结束</button><button type="button" data-skip-schedules>本次不安排并结束</button>' : '<button type="button" class="primary" data-finish-course>结束本次学习</button>'}</div>`
        : `<p>${p.stage === "checking" ? "所有题目待核对，不能判定完成或通过。修正材料另存版本，原答案保留。" : "尚有未完成或暂不可作答的内容，已保存答案保留。"}</p>${p.nextQuestionId ? '<button type="button" class="primary" data-next-question>继续未答题</button>' : ""}`
    }
    <details class="analysis-evidence"><summary>查看判定依据</summary><p>只统计有效题的首次答案；提示、答前看答案或在练习中回看教学内容按辅助作答处理。正常课前学习与答后解释不影响已提交答案。</p><p>独立通过的目标用法：${p.passedWordIds.map((id) => e(words.get(id)?.term ?? id)).join("、") || "暂无"}。自评状态不自动修改。</p></details>
  </section>${p.complete ? reaskHtml(b, helped) : ""}${feedbackHtml(b)}`;
}

export function courseHtml(
  b: Course,
  options: {
    questionId: string | null;
    screen: CourseScreen;
    lesson: string;
    report: string;
    helped: string[];
  },
) {
  const p = b.progress,
    exercise = b.content.exercise;
  const valid = exercise.questions.filter((q) => !q.flagged);
  const selected =
    exercise.questions.find((q) => q.id === options.questionId) ??
    exercise.questions.find((q) => q.id === p.nextQuestionId);
  const showResults =
    options.screen === "results" ||
    ["checking", "elsewhere", "waiting"].includes(p.stage) ||
    (b.study.stage === "practice" && !selected);
  const title = `<header class="analysis-card"><h3>${e(b.content.title)}</h3><p>${p.isRetest ? "到期复习：先独立答新题，再看解释" : b.study.hasLesson ? "1 学讲解 → 2 读短文 → 3 做练习 → 本次结果" : "旧版练习：从题目开始，原记录保留"}</p></header>`;
  const translationReview = b.translationsAvailable
    ? `<details class="analysis-card"><summary>查看课后译文与讲解</summary>${options.lesson}<h3>练习语境译文</h3><p class="analysis-material" lang="en">${e(exercise.passage)}</p><p>${e(exercise.translation)}</p>${exercise.examples.map((example) => `<blockquote lang="en">${e(example.english)}</blockquote><p>${e(example.translation)}</p>`).join("")}</details>`
    : "";
  if (options.screen === "ended")
    return `${title}<section class="analysis-card journey-recommended" id="analysis-receipt"><h3>本次学习已保存，可以离开了。</h3><p>本课有效题 ${p.answeredCount} / ${p.validCount} 已答。以下是实际保存的复习安排：</p>${schedulesHtml(b) || "<p>本次没有新增复习安排。</p>"}<p>下次打开今日学习，可继续已保存内容或查看到期复习；没有创建站外通知。</p><div class="analysis-actions"><button type="button" class="primary" data-view="today">返回今日学习</button><button type="button" data-another-course>再学一项</button></div></section>${translationReview}`;
  // The question comes first; the passage opens by itself only when the question
  // is about the passage, and otherwise waits behind one line.
  const material = `<details class="analysis-card" id="analysis-exercise" ${selected?.type === "comprehension" ? "open" : ""}><summary>练习语境：短文与例句</summary>
    <p class="analysis-meta">${exercise.source.kind === "generated" ? "Codex 生成的教学材料" : `真实摘录 · <a href="${e(exercise.source.url)}" target="_blank" rel="noopener noreferrer">${e(exercise.source.title)}</a>`} · ${e(exercise.difficulty)}</p>
    <p class="analysis-material" lang="en">${e(exercise.passage)}</p>${exercise.examples.map((example) => `<blockquote lang="en">${e(example.english)}</blockquote>${example.translation ? `<p>${e(example.translation)}</p>` : ""}`).join("")}
    ${b.translationsAvailable ? `<p class="analysis-result">${e(exercise.translation)}</p>` : '<p class="analysis-meta">完成本课全部有效题后显示译文，不要求全部答对。</p>'}</details>`;
  const content =
    b.study.stage !== "practice" && !showResults
      ? options.lesson
      : showResults
        ? `${resultsHtml(b, options.helped)}${translationReview}`
        : `${selected ? questionHtml(selected, valid.indexOf(selected), valid.length) : ""}
    ${selected?.attempts.length || selected?.access.blocked ? `<div class="analysis-actions"><button type="button" class="primary" ${p.nextQuestionId ? "data-next-question" : "data-show-results"}>${p.nextQuestionId ? "下一题" : "查看本次结果"}</button></div>` : ""}
    ${material}
    <details class="analysis-card"><summary>回看教学内容（尚未作答的题将记为辅助；练习期间打开词条释义同样如此）</summary>${options.lesson}</details>`;
  return `<div class="journey-stack">${title}${content}
    <div class="analysis-actions"><button type="button" data-pause-course>先学到这里</button></div>
    <details class="analysis-card"><summary>查看当时的分析与依据</summary>${b.study.stage === "practice" && exercise.questions.some((q) => !q.attempts.length && !q.access.blocked && !q.assisted) ? '<p>分析包含目标词义与用法。练习中查看后，尚未作答的题将记为辅助；已保存答案不受影响。</p><button type="button" data-help="hint" data-question="*">查看分析（未答题记为辅助）</button>' : options.report}</details>
    ${
      b.study.stage === "practice"
        ? `<details class="journey-other"><summary>回看已答题与暂不可作答的题目</summary><div class="journey-stack">${
            exercise.questions
              .filter(
                (q) =>
                  q.id !== selected?.id &&
                  (q.attempts.length || q.access.blocked),
              )
              .map((q) => questionHtml(q, valid.indexOf(q), valid.length))
              .join("") || "暂无已答题。"
          }</div></details>`
        : ""
    }
  </div>`;
}
