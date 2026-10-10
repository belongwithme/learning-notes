import catalog from "../data/english.json";
import dialogues from "../data/english-dialogues.json";
import { initAnalysis } from "./english-analysis";
import {
  emptyProgress,
  learningDay,
  priorities,
  results,
  statuses,
  type LearningData,
  type Progress,
  type Result,
  type Review,
} from "../lib/english/model";

type Entry = (typeof catalog.entries)[number];
type Mutation =
  | {
      action: "review";
      operationId: string;
      wordId: string;
      version: number;
      result: Result;
      studiedAt: string;
    }
  | { action: "update"; operationId: string; progress: Progress }
  | {
      action: "import";
      operationId: string;
      progress: Progress[];
      reviews: Review[];
    };
const el = <T extends HTMLElement = HTMLElement>(id: string) =>
  document.getElementById(id) as T;
const input = (id: string) => el<HTMLInputElement>(id).value;
const escape = (value: string | number) =>
  String(value).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
const entriesById = new Map(catalog.entries.map((e) => [e.id, e]));
const dialoguesByWord = new Map(
  dialogues.flatMap((dialogue) => dialogue.wordIds.map((id) => [id, dialogue] as const)),
);
const albums = new Map(catalog.albums.map((a) => [a.id, a.title]));
const dialog = el<HTMLDialogElement>("word-dialog");
let data: LearningData = { progress: {}, reviews: [] };
let authenticated = false;
let view = "today";
let page = 1;
let practiceId = "";
let detailId = "";
let busy = false;
let refreshing = false;
let dirty = false;
let pending: Mutation | null = null;
const pendingKey = "english-pending-v2";
try {
  const saved = sessionStorage.getItem(pendingKey);
  if (saved) pending = JSON.parse(saved);
} catch {
  /* Storage can be disabled; retain the operation in memory. */
}
const getProgress = (id: string) => data.progress[id] ?? emptyProgress(id);
const rank = { high: 0, medium: 1, low: 2 };
const time = (date: string) =>
  new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(date));

class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
async function api(path: string, method = "GET", body?: unknown) {
  let response: Response;
  try {
    response = await fetch(`/api/english/${path}`, {
      method,
      credentials: "same-origin",
      cache: "no-store",
      headers:
        body === undefined ? undefined : { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(20000),
    });
  } catch {
    throw new ApiError(
      0,
      "网络连接中断，尚未确认保存。请保留此页面，联网后重试。",
    );
  }
  const value = await response.json().catch(() => null);
  if (!response.ok)
    throw new ApiError(
      response.status,
      value?.error ?? "服务暂时不可用，请稍后重试。",
    );
  return value;
}
function notify(message: string, error = false) {
  el("sync-status").textContent = message;
  el("connection").dataset.tone = error ? "error" : "normal";
  const detailStatus = el("detail-status");
  if (detailStatus) detailStatus.textContent = message;
  el("retry").hidden = !pending;
  el("cancel-pending").hidden = !pending;
  if (el("detail-recovery")) el("detail-recovery").hidden = !pending;
}
function failure(error: unknown) {
  if (error instanceof ApiError && error.status === 401) {
    authenticated = false;
    data = { progress: {}, reviews: [] };
    render();
    if (dialog.open) dialog.close();
    showLogin();
  }
  notify(error instanceof Error ? error.message : "操作失败，请重试。", true);
}
function persistPending() {
  try {
    if (pending) sessionStorage.setItem(pendingKey, JSON.stringify(pending));
    else sessionStorage.removeItem(pendingKey);
  } catch {
    /* Failed actions remain available in this page even without sessionStorage. */
  }
}
function showLogin() {
  el("login-panel").hidden = false;
  el("login-panel").scrollIntoView({ behavior: "smooth", block: "center" });
  el<HTMLInputElement>("passphrase").focus();
}
function setAuthUI() {
  analysis.setAuthenticated(authenticated);
  el("account").textContent = authenticated ? "锁定记录" : "个人口令";
  el("login-panel").hidden = authenticated;
  for (const id of ["export", "import"])
    el<HTMLButtonElement>(id).disabled = !authenticated;
}
async function refresh(silent = false) {
  if (refreshing || busy || (silent && (pending || dialog.open))) return;
  refreshing = true;
  try {
    const session = await api("session");
    const previousAuth = authenticated;
    const previousData = JSON.stringify(data);
    authenticated = session.authenticated;
    if (authenticated) data = await api("data");
    else data = { progress: {}, reviews: [] };
    if (previousAuth !== authenticated || previousData !== JSON.stringify(data))
      render();
    else setAuthUI();
    if (view === "analysis") analysis.refresh();
    notify(
      pending
        ? "有一项待保存操作。请重试，或读取云端记录后取消。"
        : authenticated
          ? "已读取云端记录 · 手机和电脑共用"
          : "词库可以浏览 · 解锁后保存个人记录",
      !!pending,
    );
  } catch (error) {
    failure(error);
  } finally {
    refreshing = false;
  }
}
async function save(mutation?: Mutation) {
  if (!authenticated) {
    showLogin();
    return;
  }
  if (busy) return;
  if (mutation && pending) {
    notify("请先重试或取消上一项待保存操作。", true);
    return;
  }
  if (mutation) {
    pending = mutation;
    persistPending();
  }
  if (!pending) return;
  busy = true;
  const action = pending;
  const resultButton =
    action.action === "review"
      ? document.querySelector<HTMLButtonElement>(
          `${dialog.open ? "#word-dialog" : "#practice"} [data-word="${action.wordId}"] [data-result="${action.result}"]`,
        )
      : null;
  const resultLabel = resultButton?.textContent ?? "";
  if (resultButton && action.action === "review")
    resultButton.textContent = `${results[action.result]} · 保存中…`;
  notify(
    action.action === "review"
      ? `已选择「${results[action.result]}」，正在保存…`
      : "正在保存到云端…",
  );
  document
    .querySelectorAll<HTMLButtonElement>("[data-result], #save-word, #retry")
    .forEach((b) => (b.disabled = true));
  try {
    const saved: LearningData = await api("data?response=word", "POST", action);
    if (action.action === "import") data = saved;
    else {
      const wordId =
        action.action === "review" ? action.wordId : action.progress.wordId;
      data = {
        progress: { ...data.progress, ...saved.progress },
        reviews: [
          ...data.reviews.filter((r) => r.wordId !== wordId),
          ...saved.reviews,
        ].sort(
          (a, b) =>
            Date.parse(b.studiedAt) - Date.parse(a.studiedAt) ||
            a.id.localeCompare(b.id),
        ),
      };
    }
    pending = null;
    persistPending();
    dirty = false;
    if (action.action === "review") practiceId = "";
    render();
    if (dialog.open && detailId) renderDetail(detailId);
    notify(
      action.action === "import"
        ? "记录已合并到云端；已有设置保持不变。"
        : "已保存到云端 · 其他设备打开或刷新后可见",
    );
  } catch (error) {
    failure(error);
  } finally {
    busy = false;
    if (resultButton?.isConnected) resultButton.textContent = resultLabel;
    document
      .querySelectorAll<HTMLButtonElement>("[data-result], #save-word, #retry")
      .forEach((b) => (b.disabled = false));
  }
}
function tags(p: Progress) {
  if (!authenticated) return '<span class="tag">未解锁记录</span>';
  return `<span class="tag ${p.priority}">${priorities[p.priority]}</span><span class="tag ${p.status}">${statuses[p.status]}</span>`;
}
function dialogueCard(e: Entry) {
  const dialogue = dialoguesByWord.get(e.id);
  if (!dialogue) return "";
  const target = new RegExp(`\\b(${e.term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})\\b`, "gi");
  const highlight = (text: string) => text.split(target)
    .map((part, index) => index % 2 ? `<mark>${escape(part)}</mark>` : escape(part)).join("");
  const recall = dialogue.lines.find((line) => line.en.split(target).length > 1)!;
  return `<section class="dialogue" aria-label="情景对话">
    <p class="dialogue-kicker">情景对话 <span>4 句 · 先读英文，再看翻译</span></p>
    <p class="dialogue-scene">${escape(dialogue.scene)}</p>
    <ol class="dialogue-lines">${dialogue.lines.map((line) => `<li><span class="dialogue-speaker" aria-label="说话人 ${line.speaker}">${line.speaker}</span><p lang="en">${highlight(line.en)}</p></li>`).join("")}</ol>
    <details class="dialogue-translation"><summary>展开中文翻译</summary><ol class="dialogue-lines">${dialogue.lines.map((line) => `<li><span class="dialogue-speaker" aria-label="说话人 ${line.speaker}">${line.speaker}</span><p>${escape(line.zh)}</p></li>`).join("")}</ol></details>
    <div class="dialogue-recall"><p><strong>一句回忆</strong> · 先遮住上面的英文，试着用 <span lang="en">${escape(e.term)}</span> 说出这句话：</p><p class="recall-prompt">${escape(recall.zh)}</p><details><summary>查看参考答案</summary><p class="recall-answer" lang="en">${highlight(recall.en)}</p></details></div>
  </section>`;
}
function card(e: Entry, detail = false) {
  const p = getProgress(e.id);
  return `<article class="word-card" data-word="${e.id}">
    <div class="card-top"><div><span>${e.id} · ${escape(e.part)}</span>${tags(p)}</div><span>${escape(albums.get(e.album)!)}</span></div>
    <h${detail ? "2" : "3"} class="word-term" ${detail ? 'id="detail-title"' : ""} lang="en">${escape(e.term)}</h${detail ? "2" : "3"}>
    <p class="example" lang="en">${escape(e.example)}</p>
    <button type="button" class="reveal" data-reveal aria-expanded="false">回忆一下，再查看释义 ↓</button>
    <div class="answer" hidden><p class="meaning">${escape(e.meaning)}</p><p class="translation">${escape(e.translation)}</p><p class="grammar"><strong>用法提示</strong> · ${escape(e.note)}</p>
    ${e.collocation ? `<p class="grammar"><strong>常用搭配</strong> · <span lang="en">${escape(e.collocation)}</span></p>` : ""}
    ${e.level ? `<p class="grammar"><strong>学习层级</strong> · ${escape(e.level)}</p>` : ""}
    ${dialogueCard(e)}
    ${e.references?.length ? `<details><summary>主题参考（非逐词出处）</summary><div class="sources">${e.references.map(url => `<a href="${escape(url)}" target="_blank" rel="noopener noreferrer">${escape(url)}</a>`).join("")}</div></details>` : ""}
    <div class="review-buttons" aria-label="记录本次学习"><button type="button" data-result="forgot">忘了</button><button type="button" data-result="vague">模糊</button><button type="button" data-result="remembered" class="primary">记得 ✓</button></div></div>
    <div class="card-bottom"><span>${authenticated ? (p.dueDate ? `复习安排 · ${escape(p.dueDate)}` : "复习日期尚未安排") : "输入个人口令后即可记录学习"} </span>${detail ? "" : `<div><button type="button" data-open="${e.id}">安排 / 笔记</button><button type="button" data-next>换一个 →</button></div>`}</div>
    ${detail ? editForm(p) : ""}</article>`;
}
function editForm(p: Progress) {
  const reviews = data.reviews.filter((r) => r.wordId === p.wordId);
  const options = (values: Record<string, string>, selected: string) =>
    Object.entries(values)
      .map(
        ([value, label]) =>
          `<option value="${value}" ${selected === value ? "selected" : ""}>${label}</option>`,
      )
      .join("");
  return `<p id="detail-status" class="row-meta" role="status" aria-live="polite"></p><div id="detail-recovery" ${pending ? "" : "hidden"}><button type="button" data-retry>重试保存</button><button type="button" data-cancel-pending>取消待保存操作</button></div>
    <form class="edit-form" id="edit-form"><h3>留给下次学习的安排</h3><div class="edit-grid">
    <label>优先级<select name="priority">${options(priorities, p.priority)}</select></label><label>掌握状态<select name="status">${options(statuses, p.status)}</select></label>
    <label>计划学习日期<input name="plannedDate" type="date" value="${p.plannedDate}" /></label><label>下次复习日期<input name="dueDate" type="date" value="${p.dueDate}" /></label></div>
    <label class="note-field">自己的例句或笔记<textarea name="note" rows="3" maxlength="2000" placeholder="把这个表达放进你熟悉的场景…">${escape(p.note)}</textarea></label>
    <button id="save-word" type="submit" class="primary">${authenticated ? "保存安排与笔记" : "解锁后保存"}</button></form>
    <section class="word-history"><h3>学习足迹 · ${reviews.length} 次</h3>${
      !authenticated
        ? "<p>解锁后查看学习记录。</p>"
        : reviews.length
          ? `<ul>${reviews
              .slice(0, 20)
              .map(
                (r) =>
                  `<li><span>${escape(learningDay(r.studiedAt))} ${escape(time(r.studiedAt).split(" ").at(-1)!)}</span><span>${results[r.result]}</span></li>`,
              )
              .join(
                "",
              )}</ul>${reviews.length > 20 ? "<p>此处显示最近 20 次，完整记录可在学习记录页查询或导出。</p>" : ""}`
          : `<p>${p.status === "new" ? "还没有学习记录。展开释义后，记录一次回忆结果。" : "已有学习状态，历史学习日期未知。"}</p>`
    }</section>`;
}
function queue() {
  const today = learningDay();
  const reviewed = new Set(
    data.reviews
      .filter((r) => learningDay(r.studiedAt) === today)
      .map((r) => r.wordId),
  );
  return catalog.entries
    .filter((e) => {
      const p = getProgress(e.id);
      if (reviewed.has(e.id)) return false;
      if (
        (p.dueDate && p.dueDate <= today) ||
        (p.plannedDate && p.plannedDate <= today)
      )
        return true;
      if (p.plannedDate > today || p.dueDate > today) return false;
      return p.status !== "mastered";
    })
    .sort((a, b) => {
      const pa = getProgress(a.id),
        pb = getProgress(b.id);
      const group = (p: Progress) =>
        (p.dueDate && p.dueDate <= today) ||
        (p.plannedDate && p.plannedDate <= today)
          ? 0
          : p.status === "learning"
            ? 1
            : 2;
      return group(pa) - group(pb) || rank[pa.priority] - rank[pb.priority];
    });
}
function renderToday() {
  const today = learningDay();
  el("today-date").textContent = `${today.replaceAll("-", " / ")} · 北京时间`;
  const learnedToday = new Set(
    data.reviews
      .filter((r) => learningDay(r.studiedAt) === today)
      .map((r) => r.wordId),
  );
  const learned = new Set([
    ...data.reviews.map((r) => r.wordId),
    ...Object.values(data.progress)
      .filter((p) => p.status !== "new")
      .map((p) => p.wordId),
  ]);
  const stats = {
    "stat-today": learnedToday.size,
    "stat-due": Object.values(data.progress).filter(
      (p) => p.dueDate && p.dueDate <= today && !learnedToday.has(p.wordId),
    ).length,
    "stat-studied": learned.size,
    "stat-mastered": Object.values(data.progress).filter(
      (p) => p.status === "mastered",
    ).length,
  };
  Object.entries(stats).forEach(
    ([id, value]) => (el(id).textContent = authenticated ? String(value) : "—"),
  );
  const available = queue();
  const entry = available.find((e) => e.id === practiceId) ?? available[0];
  practiceId = entry?.id ?? "";
  el("practice").innerHTML = entry
    ? card(entry)
    : '<div class="empty"><h3>今天的安排已完成。</h3><p>可以休息一下，或去词库挑选新的内容。</p><button data-view="library">浏览词库 →</button></div>';
}
function dateMatches(date: string) {
  const from = input("date-from"),
    to = input("date-to");
  return (
    (!from && !to) || (!!date && (!from || date >= from) && (!to || date <= to))
  );
}
function matches(e: Entry, history?: Review) {
  const p = getProgress(e.id),
    q = input("query").trim().toLowerCase();
  if (
    q &&
    ![e.id, e.term, e.meaning, e.example, e.translation, e.note, e.collocation, e.level]
      .join(" ")
      .toLowerCase()
      .includes(q)
  )
    return false;
  if (input("album") && e.album !== Number(input("album"))) return false;
  if (input("kind") && e.kind !== input("kind")) return false;
  if (input("priority") && p.priority !== input("priority")) return false;
  if (input("status") && p.status !== input("status")) return false;
  if (input("date-from") || input("date-to")) {
    if (input("date-type") === "planned") return dateMatches(p.plannedDate);
    if (input("date-type") === "due") return dateMatches(p.dueDate);
    if (history) return dateMatches(learningDay(history.studiedAt));
    return data.reviews.some(
      (r) => r.wordId === e.id && dateMatches(learningDay(r.studiedAt)),
    );
  }
  return true;
}
function renderCollection() {
  const historyMode = view === "history";
  el("collection-kicker").textContent = historyMode
    ? "A RECORD OF YOUR PROGRESS"
    : "YOUR WORD COLLECTION";
  el("collection-heading").textContent = historyMode
    ? "学过的，都留在这里。"
    : "每个词，都有它的语境。";
  el("list-note").textContent = historyMode
    ? "日期按北京时间 · 状态与优先级为当前值"
    : "点击词条查看释义与安排";
  let rows: (Entry | Review)[] = historyMode
    ? data.reviews.filter((r) => matches(entriesById.get(r.wordId)!, r))
    : catalog.entries.filter((e) => matches(e));
  if (
    input("date-from") &&
    input("date-to") &&
    input("date-from") > input("date-to")
  ) {
    el("entries").innerHTML =
      '<div class="empty"><h3>日期范围有误</h3><p>开始日期不能晚于结束日期。</p></div>';
    el("result-count").textContent = "请调整日期";
    el("page-number").textContent = "";
    el<HTMLButtonElement>("previous-page").disabled = true;
    el<HTMLButtonElement>("next-page").disabled = true;
    return;
  }
  const idOf = (row: Entry | Review) => ("wordId" in row ? row.wordId : row.id);
  if (input("sort") === "priority")
    rows.sort(
      (a, b) =>
        rank[getProgress(idOf(a)).priority] -
        rank[getProgress(idOf(b)).priority],
    );
  if (!historyMode && input("sort") === "recent") {
    const recent = new Map<string, number>();
    data.reviews.forEach((r) =>
      recent.set(
        r.wordId,
        Math.max(recent.get(r.wordId) ?? 0, Date.parse(r.studiedAt)),
      ),
    );
    rows.sort(
      (a, b) => (recent.get(idOf(b)) ?? 0) - (recent.get(idOf(a)) ?? 0),
    );
  }
  const maxPage = Math.max(1, Math.ceil(rows.length / 30));
  page = Math.min(page, maxPage);
  el("result-count").textContent = historyMode
    ? `找到 ${rows.length} 次学习记录`
    : `找到 ${rows.length} / ${catalog.entries.length} 条内容`;
  el("page-number").textContent = `${page} / ${maxPage}`;
  el<HTMLButtonElement>("previous-page").disabled = page === 1;
  el<HTMLButtonElement>("next-page").disabled = page === maxPage;
  if (
    !authenticated &&
    (historyMode ||
      input("priority") ||
      input("status") ||
      input("date-from") ||
      input("date-to"))
  ) {
    el("entries").innerHTML =
      '<div class="empty"><h3>解锁你的学习记录</h3><p>输入个人口令后，即可按日期、优先级与状态查询。</p><button data-login>输入个人口令</button></div>';
    el("result-count").textContent = "个人记录尚未解锁";
    return;
  }
  if (!rows.length) {
    el("entries").innerHTML =
      `<div class="empty"><h3>${historyMode ? "这里还没有匹配的学习足迹。" : "没有找到匹配的词条。"}</h3><p>${historyMode ? "记录一次回忆结果，或调整筛选条件。旧版导入的状态没有历史日期。" : "试着缩小关键词，或清除筛选条件。"}</p><button data-clear>清除筛选</button></div>`;
    return;
  }
  let lastDay = "";
  el("entries").innerHTML = rows
    .slice((page - 1) * 30, page * 30)
    .map((row) => {
      if ("wordId" in row) {
        const e = entriesById.get(row.wordId)!,
          day = learningDay(row.studiedAt);
        const heading =
          day !== lastDay ? `<h3 class="history-day">${escape(day)}</h3>` : "";
        lastDay = day;
        return `${heading}<button class="history-row" data-open="${e.id}"><span><span class="row-term" lang="en">${escape(e.term)}</span><span class="row-meta">${escape(e.meaning)} · ${priorities[getProgress(e.id).priority]}</span></span><span class="history-result">${results[row.result]}<span class="row-meta">${escape(time(row.studiedAt))}</span></span></button>`;
      }
      const p = getProgress(row.id),
        latest = data.reviews.find((r) => r.wordId === row.id);
      const date =
        input("date-type") === "planned"
          ? p.plannedDate
          : input("date-type") === "due"
            ? p.dueDate
            : latest
              ? learningDay(latest.studiedAt)
              : "";
      return `<button class="word-row" data-open="${row.id}"><span><span class="row-term" lang="en">${escape(row.term)}</span><span class="row-meta">${row.id} · ${escape(albums.get(row.album)!)} · ${row.kind === "words" ? "词汇" : "表达"}</span></span><span class="row-meaning">${escape(row.meaning)}</span><div>${tags(p)}</div><span class="row-date">${authenticated ? date || (p.status !== "new" && input("date-type") === "studied" ? "日期未知" : "暂无日期") : "—"}</span><span class="row-arrow" aria-hidden="true">↗</span></button>`;
    })
    .join("");
}
function render() {
  setAuthUI();
  renderToday();
  if (view !== "today" && view !== "analysis") renderCollection();
}
function changeView(next: string) {
  if (view === "analysis" && next !== view && !analysis.canNavigate()) return;
  view = next;
  page = 1;
  document
    .querySelectorAll<HTMLElement>(".view-tabs [data-view]")
    .forEach((button) => {
      if (button.dataset.view === view)
        button.setAttribute("aria-current", "page");
      else button.removeAttribute("aria-current");
    });
  el("today-view").hidden = view !== "today";
  el("collection-view").hidden = view === "today" || view === "analysis";
  analysis.show(view === "analysis");
  if (view !== "analysis") {
    const url = new URL(location.href);
    url.searchParams.delete("view");
    url.searchParams.delete("report");
    history.replaceState(null, "", url);
  }
  if (view === "today") renderToday();
  else if (view !== "analysis") renderCollection();
}
function renderDetail(id: string) {
  detailId = id;
  dirty = false;
  el("detail-content").innerHTML = card(entriesById.get(id)!, true);
}
function closeDetail() {
  if (dirty && !confirm("尚有未保存的安排或笔记，确定关闭吗？")) return;
  dialog.close();
  dirty = false;
}
function clearFilters() {
  el<HTMLFormElement>("filters").reset();
  page = 1;
  renderCollection();
}

document.addEventListener("click", (event) => {
  const button = (event.target as Element).closest<HTMLButtonElement>("button");
  if (!button) return;
  if (button.dataset.view) changeView(button.dataset.view);
  if (button.hasAttribute("data-retry")) void save();
  if (button.hasAttribute("data-cancel-pending")) el("cancel-pending").click();
  if (button.hasAttribute("data-login")) showLogin();
  if (button.hasAttribute("data-clear")) clearFilters();
  if (button.dataset.open) {
    renderDetail(button.dataset.open);
    dialog.showModal();
    dialog.scrollTop = 0;
  }
  if (button.hasAttribute("data-reveal")) {
    button.hidden = true;
    button.setAttribute("aria-expanded", "true");
    (button.nextElementSibling as HTMLElement).hidden = false;
  }
  if (button.hasAttribute("data-next")) {
    const available = queue();
    practiceId =
      available[
        (available.findIndex((e) => e.id === practiceId) + 1) % available.length
      ]?.id ?? "";
    renderToday();
  }
  if (button.dataset.result) {
    const id = button.closest<HTMLElement>("[data-word]")!.dataset.word!;
    if (dirty) {
      notify("请先保存安排与笔记，再记录本次学习。", true);
      return;
    }
    if (!authenticated && dialog.open) dialog.close();
    void save({
      action: "review",
      operationId: crypto.randomUUID(),
      wordId: id,
      version: getProgress(id).version,
      result: button.dataset.result as Result,
      studiedAt: new Date().toISOString(),
    });
  }
});
el("login-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = el("login-form").querySelector("button")!;
  button.disabled = true;
  try {
    await api("session", "POST", { passphrase: input("passphrase") });
    el<HTMLInputElement>("passphrase").value = "";
    authenticated = true;
    await refresh();
  } catch (error) {
    failure(error);
  } finally {
    button.disabled = false;
  }
});
el("account").addEventListener("click", async () => {
  if (!authenticated) {
    showLogin();
    return;
  }
  if (busy) return;
  if (!analysis.canLock()) return;
  if (
    pending &&
    !confirm("还有待保存操作。锁定将清除本机待保存操作，确定继续吗？")
  )
    return;
  try {
    await api("session", "DELETE");
    analysis.clear();
    authenticated = false;
    data = { progress: {}, reviews: [] };
    pending = null;
    persistPending();
    render();
    notify("记录已锁定。");
  } catch (error) {
    failure(error);
  }
});
el("refresh").addEventListener("click", () => void refresh());
el("retry").addEventListener("click", () => void save());
el("cancel-pending").addEventListener("click", async () => {
  if (
    busy ||
    !confirm(
      "将重新读取云端并放弃待保存操作。已被服务器接收的操作会保留，确定继续吗？",
    )
  )
    return;
  try {
    data = await api("data");
    pending = null;
    persistPending();
    render();
    if (dialog.open) renderDetail(detailId);
    notify("已重新读取云端记录。");
  } catch (error) {
    failure(error);
  }
});
el("close-dialog").addEventListener("click", closeDetail);
dialog.addEventListener("cancel", (event) => {
  event.preventDefault();
  closeDetail();
});
el("detail-content").addEventListener("input", (event) => {
  if ((event.target as Element).closest(".edit-form")) dirty = true;
});
el("detail-content").addEventListener("change", (event) => {
  if ((event.target as Element).closest(".edit-form")) dirty = true;
});
el("detail-content").addEventListener("submit", (event) => {
  event.preventDefault();
  const form = new FormData(event.target as HTMLFormElement);
  const progress = {
    ...getProgress(detailId),
    status: form.get("status"),
    priority: form.get("priority"),
    plannedDate: form.get("plannedDate"),
    dueDate: form.get("dueDate"),
    note: form.get("note"),
  } as Progress;
  if (!authenticated) {
    closeDetail();
    showLogin();
    return;
  }
  void save({ action: "update", operationId: crypto.randomUUID(), progress });
});
el("filters").addEventListener("submit", (event) => event.preventDefault());
el("filters").addEventListener("input", () => {
  page = 1;
  renderCollection();
});
el("clear-filters").addEventListener("click", clearFilters);
el("previous-page").addEventListener("click", () => {
  page--;
  renderCollection();
  el("result-count").scrollIntoView({ block: "start" });
});
el("next-page").addEventListener("click", () => {
  page++;
  renderCollection();
  el("result-count").scrollIntoView({ block: "start" });
});
el("export").addEventListener("click", async () => {
  try {
    const latest: LearningData = await api("data");
    const blob = new Blob(
      [
        JSON.stringify(
          {
            version: 2,
            exportedAt: new Date().toISOString(),
            progress: Object.values(latest.progress),
            reviews: latest.reviews,
          },
          null,
          2,
        ),
      ],
      { type: "application/json" },
    );
    const url = URL.createObjectURL(blob),
      a = document.createElement("a");
    a.href = url;
    a.download = `英语学习记录-${learningDay()}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    notify("已导出云端记录备份。");
  } catch (error) {
    failure(error);
  }
});
el("import").addEventListener("click", () =>
  el<HTMLInputElement>("import-file").click(),
);
el("import-file").addEventListener("change", async () => {
  const picker = el<HTMLInputElement>("import-file"),
    file = picker.files?.[0];
  if (!file) return;
  try {
    if (file.size > 4_000_000) throw new Error("备份超过 4 MB，请拆分后导入。");
    const value = JSON.parse(await file.text());
    let progress: Progress[], reviews: Review[];
    if (
      value.version === 1 &&
      value.progress &&
      typeof value.progress === "object" &&
      !Array.isArray(value.progress)
    ) {
      const legacy: Record<string, Progress["status"]> = {
        未学: "new",
        待复习: "learning",
        已掌握: "mastered",
      };
      progress = Object.entries(value.progress).map(([id, state]) => {
        if (
          !entriesById.has(id) ||
          typeof state !== "string" ||
          !Object.hasOwn(legacy, state)
        )
          throw new Error("旧版文件包含未知词条或状态。");
        return { ...emptyProgress(id), status: legacy[state] };
      });
      reviews = [];
    } else if (
      value.version === 2 &&
      Array.isArray(value.progress) &&
      Array.isArray(value.reviews)
    ) {
      progress = value.progress;
      reviews = value.reviews;
    } else
      throw new Error(
        "不支持的备份格式。请选择原离线版进度或本模块导出的 JSON。",
      );
    if (
      !confirm(
        `将合并 ${progress.length} 个词条状态与 ${reviews.length} 次学习记录。已有云端设置不会被覆盖。${value.version === 1 ? "旧记录的学习日期保持未知。" : ""}继续吗？`,
      )
    )
      return;
    await save({
      action: "import",
      operationId: crypto.randomUUID(),
      progress,
      reviews,
    });
  } catch (error) {
    failure(error);
  } finally {
    picker.value = "";
  }
});
window.addEventListener("focus", () => void refresh(true));
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") void refresh(true);
});
window.addEventListener("online", () => {
  if (pending) notify("网络已恢复，请点击“重试保存”。", true);
  else void refresh(true);
});
window.addEventListener("beforeunload", (event) => {
  if (pending || dirty) event.preventDefault();
});
const analysis = initAnalysis(api, failure);
render();
if (new URL(location.href).searchParams.get("view") === "analysis") changeView("analysis");
void refresh();
