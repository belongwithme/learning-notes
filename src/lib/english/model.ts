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
export function isDate(value: unknown): value is string {
  if (value === "") return true;
  return (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(Date.parse(value)) &&
    new Date(value).toISOString().slice(0, 10) === value
  );
}
