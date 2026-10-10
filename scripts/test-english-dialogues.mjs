import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (name) => JSON.parse(readFileSync(new URL(`../src/data/${name}.json`, import.meta.url), "utf8"));
const catalog = read("english");
const dialogues = read("english-dialogues");
const words = new Map(catalog.entries.filter((entry) => entry.kind === "words").map((entry) => [entry.id, entry]));

test("every word has exactly one maintained dialogue, with no unknown or phrase IDs", () => {
  const ids = dialogues.flatMap((dialogue) => dialogue.wordIds);
  assert.equal(new Set(ids).size, ids.length, "a word must not silently overwrite another dialogue mapping");
  assert.deepEqual([...ids].sort(), [...words.keys()].sort());
  assert.equal(new Set(dialogues.map((dialogue) => dialogue.id)).size, dialogues.length);
});

test("dialogues stay short, bilingual, and tied to one topic", () => {
  for (const dialogue of dialogues) {
    assert.ok(dialogue.scene.trim(), dialogue.id);
    assert.ok(dialogue.wordIds.length > 0, dialogue.id);
    assert.deepEqual(dialogue.lines.map((line) => line.speaker), ["A", "B", "A", "B"], dialogue.id);
    assert.equal(new Set(dialogue.wordIds.map((id) => words.get(id)?.album)).size, 1, dialogue.id);
    let wordCount = 0;
    for (const line of dialogue.lines) {
      assert.ok(/[a-z]/i.test(line.en), dialogue.id);
      assert.ok(/[\u3400-\u9fff]/.test(line.zh), dialogue.id);
      assert.ok(!/\bTODO\b|\bTBD\b|待补充|待填写|<[^>]+>/i.test(line.en + line.zh), dialogue.id);
      const length = line.en.split(/\s+/).length;
      assert.ok(length <= 35, `${dialogue.id}: one turn is too long (${length})`);
      wordCount += length;
    }
    assert.ok(wordCount <= 65, `${dialogue.id}: dialogue is too long (${wordCount})`);
  }
});

test("every target occurs as a whole word and has a translated recall answer", () => {
  for (const dialogue of dialogues) {
    for (const id of dialogue.wordIds) {
      const { term } = words.get(id);
      const pattern = new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
      const recall = dialogue.lines.find((line) => pattern.test(line.en));
      assert.ok(recall, `${id} (${term}) is absent from ${dialogue.id}`);
      assert.ok(recall.zh.trim(), `${id} has no recall prompt`);
    }
  }
});
