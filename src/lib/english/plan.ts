import {
  emptyProgress,
  learningDay,
  scheduleFor,
  type LearningData,
  type Progress,
  type Review,
} from "./model.ts";

export interface Item {
  id: string;
  album: number;
  kind: string;
}
const rank = { high: 0, medium: 1, low: 2 };

// New items go album by album: one expression, then two words, so the words and
// expressions of a topic are learned together.
export function studyOrderFor(albums: { id: number }[], entries: Item[]) {
  const order = new Map<string, number>();
  for (const album of albums) {
    const inAlbum = entries.filter((e) => e.album === album.id);
    const phrases = inAlbum.filter((e) => e.kind === "phrases");
    const singles = inAlbum.filter((e) => e.kind === "words");
    for (let i = 0; i < Math.max(phrases.length, singles.length / 2); i++)
      [phrases[i], singles[2 * i], singles[2 * i + 1]].forEach(
        (e) => e && order.set(e.id, order.size),
      );
  }
  return order;
}
export function indexReviews(reviews: Review[]) {
  const byWord = new Map<string, Review[]>();
  for (const r of reviews) {
    const list = byWord.get(r.wordId);
    if (list) list.push(r);
    else byWord.set(r.wordId, [r]);
  }
  return byWord;
}
// Words rated before due dates were scheduled automatically get theirs from the
// same rule as new ratings, so they come back for review too.
function dueOf(p: Progress, reviews: Review[]) {
  return p.dueDate || scheduleFor(reviews)?.dueDate || "";
}
// Today's work: the oldest reviews that are due (up to the daily limit), then
// new items in study order. Whatever was already rated today counts as done.
export function dailyPlan(input: {
  entries: Item[];
  data: LearningData;
  today: string;
  limits: { review: number; fresh: number };
  order: Map<string, number>;
}) {
  const { entries, data, today, limits, order } = input;
  const byWord = indexReviews(data.reviews);
  const progress = (id: string) => data.progress[id] ?? emptyProgress(id);
  const doneToday = new Set<string>();
  let doneReview = 0,
    doneFresh = 0;
  for (const r of data.reviews) {
    if (learningDay(r.studiedAt) !== today || doneToday.has(r.wordId)) continue;
    doneToday.add(r.wordId);
    if (byWord.get(r.wordId)!.some((x) => learningDay(x.studiedAt) < today))
      doneReview++;
    else doneFresh++;
  }
  const due: { id: string; at: string; rank: number }[] = [],
    fresh: Item[] = [];
  for (const e of entries) {
    if (doneToday.has(e.id)) continue;
    const p = progress(e.id),
      reviews = byWord.get(e.id) ?? [],
      dueDate = dueOf(p, reviews);
    if ((dueDate && dueDate <= today) || (p.plannedDate && p.plannedDate <= today))
      due.push({ id: e.id, at: dueDate || p.plannedDate, rank: rank[p.priority] });
    else if (!dueDate && !p.plannedDate && p.status !== "mastered" && !reviews.length)
      fresh.push(e);
  }
  due.sort((a, b) => a.at.localeCompare(b.at) || a.rank - b.rank);
  fresh.sort(
    (a, b) =>
      rank[progress(a.id).priority] - rank[progress(b.id).priority] ||
      (order.get(a.id) ?? Infinity) - (order.get(b.id) ?? Infinity),
  );
  const reviewsLeft = Math.max(0, limits.review - doneReview),
    freshLeft = Math.max(0, limits.fresh - doneFresh);
  return {
    doneReview,
    doneFresh,
    reviewLimit: limits.review,
    freshLimit: limits.fresh,
    dueTotal: due.length,
    queue: [
      ...due.slice(0, reviewsLeft).map((d) => d.id),
      ...fresh.slice(0, freshLeft).map((e) => e.id),
    ],
    moreDue: due.length > reviewsLeft,
    moreFresh: fresh.length > freshLeft,
  };
}
