// Synthetic material for the isolated acceptance tests; never published to personal data.
import catalog from "../src/data/english.json" with { type: "json" };
export const fixtureWordIds = ["W001", "W501", "W1000"];
export function fixtureContent(context, retests = []) {
  const refs = (id) =>
    context.facts.evidence
      .filter((e) => e.wordIds.includes(id))
      .map((e) => e.id);
  return {
    title: "验收示例 · 读懂依赖引入的三个动作",
    summary:
      "根据保存的自评记录，先用短句练习 read、manipulate 和 license；具体错因仍需题目验证。",
    findings: [
      {
        kind: "fact",
        text: "这些目标词留有学习记录，可以据此安排试探性练习。",
        wordIds: fixtureWordIds,
        evidenceIds: fixtureWordIds.flatMap(refs),
      },
      {
        kind: "hypothesis",
        text: "可能需要在具体语境里进一步区分动作和名词含义。",
        wordIds: fixtureWordIds,
        evidenceIds: fixtureWordIds.flatMap(refs),
      },
    ],
    nextSteps: [
      "先读英文，再完成三道题；不确定时可以使用提示。",
      "完成后按需要确认复测，使用新句子检查同一用法。",
    ],
    exercise: {
      mode: "short",
      goal: "java",
      difficulty: "短句 · 少量非目标生词",
      targets: fixtureWordIds.map((id) => {
        const w = catalog.entries.find((e) => e.id === id);
        return {
          wordId: id,
          usage: `${w.term} 的词库目标义`,
          meaning: w.meaning,
          extension: false,
          reason: "已有自评记录，先通过语境题进一步检验。",
          evidenceIds: refs(id),
          ...(retests.find((r) => r.wordId === id)
            ? { retestId: retests.find((r) => r.wordId === id).id }
            : {}),
        };
      }),
      passage:
        "Before adding a library to a Java service, read its documentation carefully. Check the examples and the supported versions. A small utility may manipulate text while leaving the original string unchanged. Try a simple input first and compare the result with the expected value. Also check the license before sharing the application with another team. A technical example can explain a method, but it does not replace the terms that apply to the library. Keep a short note about your choice so that a future reviewer can understand why the dependency was added.",
      translation:
        "给 Java 服务添加库之前，先仔细阅读文档、检查示例和版本。一个工具可以处理文本而不改变原字符串。分享应用前也要查看许可证，并记录选择依据。",
      examples: fixtureWordIds.map((id) => {
        const w = catalog.entries.find((e) => e.id === id);
        return {
          wordIds: [id],
          english: w.example,
          translation: w.translation,
        };
      }),
      questions: [
        {
          id: "q1",
          type: "meaning",
          format: "choice",
          prompt: "What does “read” mean in this sentence?",
          context: "Read the configuration guide before starting the service.",
          wordIds: ["W001"],
          options: [
            {
              id: "A",
              text: "Look at and understand the written information.",
            },
            { id: "B", text: "Delete the configuration." },
          ],
          answers: ["A"],
          explanation: "read 在这里表示阅读并理解书面说明。",
          hint: "关注 written information。",
        },
        {
          id: "q2",
          type: "collocation",
          format: "choice",
          prompt: "Which word completes the sentence?",
          context:
            "The utility can ___ text without changing the original string.",
          wordIds: ["W501"],
          options: [
            { id: "A", text: "license" },
            { id: "B", text: "manipulate" },
          ],
          answers: ["B"],
          explanation: "manipulate text 表示处理文本。",
          hint: "空格需要表示处理动作的动词。",
        },
        {
          id: "q3",
          type: "comprehension",
          format: "choice",
          prompt:
            "What should the developer check before sharing the application?",
          context:
            "Check the license before sharing the application with another team.",
          wordIds: ["W1000"],
          options: [
            { id: "A", text: "Only the color of the editor." },
            { id: "B", text: "The license terms that apply to the library." },
          ],
          answers: ["B"],
          explanation: "这里要求在分享之前检查适用的许可证条款。",
          hint: "before 表示两个动作的先后顺序。",
        },
      ],
      source: { kind: "generated" },
    },
  };
}
