// Fill-in-the-blank questions made from text the site already has: the entry's
// own example sentence, and its scene dialogue as a second, different context.
export interface Cloze {
  text: string;
  answer: string;
  context: "example" | "dialogue";
  zh: string;
}
interface Item {
  term: string;
  kind: string;
  example: string;
  translation: string;
}
interface Dialogue {
  lines: { en: string; zh: string }[];
}
const placeholder = /^(?:[A-Z]|sth|sb|something|someone|\.\.\.)$/;
const escapeRegex = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
// The word to hide: the whole term for a word, the last fixed word of an
// expression ("read A from B" hides "from"; "replication lag" hides "lag").
export function target(item: Pick<Item, "term" | "kind">) {
  if (item.kind === "words") return item.term;
  // "do something" and "doing something" stand for any action, not a fixed word.
  return (
    item.term
      .replace(/\b(?:do|doing) something$/, "something")
      .split(/\s+/)
      .filter((part) => !placeholder.test(part))
      .at(-1) ?? item.term
  );
}
export function blank(sentence: string, item: Pick<Item, "term" | "kind">) {
  const pattern = new RegExp(
    `\\b(${escapeRegex(target(item))}(?:s|es|ed|d|ing)?)\\b`,
    "i",
  );
  const match = pattern.exec(sentence);
  if (!match) return null;
  return {
    text: sentence.replace(pattern, "_____"),
    answer: match[1],
  };
}
// First review: the example sentence. Later reviews: the dialogue line, which
// is a new context, so the answer cannot be copied from the last look.
export function clozeFor(
  item: Item,
  dialogue: Dialogue | undefined,
  repeated: boolean,
): Cloze | null {
  const fromExample = () => {
    const hidden = blank(item.example, item);
    return hidden
      ? { ...hidden, context: "example" as const, zh: item.translation }
      : null;
  };
  const fromDialogue = () => {
    for (const line of dialogue?.lines ?? []) {
      const hidden = blank(line.en, item);
      if (hidden) return { ...hidden, context: "dialogue" as const, zh: line.zh };
    }
    return null;
  };
  return repeated
    ? (fromDialogue() ?? fromExample())
    : (fromExample() ?? fromDialogue());
}
export const normalize = (value: string) =>
  value.trim().toLowerCase().replace(/\s+/g, " ");
