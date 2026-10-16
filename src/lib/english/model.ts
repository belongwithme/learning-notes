export type Status = "new" | "learning" | "mastered";
export type Priority = "high" | "medium" | "low";
export type Result = "forgot" | "vague" | "remembered";
export interface Progress {
  wordId: string;
  status: Status;
  priority: Priority;
  plannedDate: string;
  dueDate: string;
  note: string;
  version: number;
  updatedAt?: string;
}
export interface Review {
  id: string;
  wordId: string;
  result: Result;
  studiedAt: string;
}
export interface LearningData {
  progress: Record<string, Progress>;
  reviews: Review[];
}
export const statuses = { new: "未学", learning: "学习中", mastered: "已掌握" };
export const priorities = {
  high: "高优先级",
  medium: "中优先级",
  low: "低优先级",
};
export const results = { forgot: "忘了", vague: "模糊", remembered: "记得" };
export function emptyProgress(wordId: string): Progress {
  return {
    wordId,
    status: "new",
    priority: "medium",
    plannedDate: "",
    dueDate: "",
    note: "",
    version: 0,
  };
}
// Every learning day uses Asia/Shanghai, independent of the server or device timezone.
const dayFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Shanghai",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
export function learningDay(value: string | Date = new Date()): string {
  const date = new Date(value);
  return dayFormatter.format(date);
}
// Spaced review: one rule shared by the server (on save) and the page (for
// older words that were rated before due dates were scheduled automatically).
const rememberIntervals = [3, 7, 14, 30];
const masteredStreak = 2;
export function shiftDay(day: string, days: number): string {
  return new Date(Date.parse(`${day}T00:00:00Z`) + days * 86_400_000)
    .toISOString()
    .slice(0, 10);
}
export interface Schedule {
  dueDate: string;
  status: Status;
}
// Only the last rating of each learning day counts, so several ratings on one
// day cannot raise the streak. "Remembered" must happen on masteredStreak
// different days in a row before a word is called mastered.
export function scheduleFor(
  reviews: { result: Result; studiedAt: string | Date }[],
): Schedule | null {
  const byDay = new Map<string, Result>();
  [...reviews]
    .sort((a, b) => +new Date(a.studiedAt) - +new Date(b.studiedAt))
    .forEach((r) => byDay.set(learningDay(r.studiedAt), r.result));
  const days = [...byDay];
  if (!days.length) return null;
  const [lastDay, last] = days[days.length - 1];
  if (last !== "remembered")
    return {
      dueDate: shiftDay(lastDay, last === "forgot" ? 1 : 2),
      status: "learning",
    };
  let streak = 0;
  for (let i = days.length - 1; i >= 0 && days[i][1] === "remembered"; i--)
    streak++;
  return {
    dueDate: shiftDay(
      lastDay,
      rememberIntervals[Math.min(streak, rememberIntervals.length) - 1],
    ),
    status: streak >= masteredStreak ? "mastered" : "learning",
  };
}
export function isDate(value: unknown): value is string {
  if (value === "") return true;
  return (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(Date.parse(value)) &&
    new Date(value).toISOString().slice(0, 10) === value
  );
}
