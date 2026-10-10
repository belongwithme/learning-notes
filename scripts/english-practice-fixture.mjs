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
      "先完成词汇讲解和语料精读，再换语境完成三道题。",
      "完成后按需要确认复测，使用新句子检查同一用法。",
    ],
    lesson: fixtureLesson(),
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

export function fixtureLessonWord(wordId) {
  const word = catalog.entries.find((w) => w.id === wordId);
  const examples = {
    W001: [
      [
        "Read the error message before changing the timeout.",
        "修改超时时间前，先阅读错误信息。",
        "read 后直接接阅读对象；before 后可接动名词。",
      ],
      [
        "Read the release notes to understand the breaking changes.",
        "阅读版本说明，了解不兼容变更。",
        "to understand 说明阅读的目的。",
      ],
    ],
    W501: [
      [
        "Use a helper to manipulate the input text.",
        "用辅助工具处理输入文本。",
        "manipulate 在技术语境中表示操作或处理，并不总有贬义。",
      ],
      [
        "This example shows how to manipulate a list of names.",
        "这个例子演示如何处理姓名列表。",
        "how to 后接动词原形；具体如何处理需要看代码。",
      ],
    ],
    W1000: [
      [
        "The license allows the team to distribute the package.",
        "该许可证允许团队分发这个软件包。",
        "license 作名词，是允许使用或分发的许可条款。",
      ],
      [
        "Read the license before copying code into another project.",
        "将代码复制到另一个项目前，先阅读许可证。",
        "开放源码不等于没有使用条件，条件以具体许可证为准。",
      ],
    ],
  }[wordId] ?? [
    [word.example, word.translation, "测试样例：理解目标词在原句中的作用。"],
    [
      `The glossary explains the term "${word.term}" with a short example.`,
      `术语表用一个短例子解释 ${word.term}。`,
      "测试样例：保留词库含义。",
    ],
  ];
  const contrast = {
    W001: [
      "Read the warning carefully.",
      "仔细阅读警告。",
      "Look at the warning icon.",
      "看一下警告图标。",
      "read 关注文字内容；look at 只说明把目光转向对象，不保证读懂文字。",
    ],
    W501: [
      "The script can manipulate the data.",
      "脚本能够处理数据。",
      "The script can display the data.",
      "脚本能够展示数据。",
      "manipulate 强调操作、处理；display 强调显示。manipulate 本身不说明是否原地修改，需结合接口说明。",
    ],
    W1000: [
      "Check the license for distribution conditions.",
      "查看许可证中的分发条件。",
      "Check the documentation for setup instructions.",
      "查看文档中的安装说明。",
      "license 说明许可和条件；documentation 说明怎样使用。技术上能用并不等于许可允许所有用途。",
    ],
  }[wordId] ?? [
    word.example,
    word.translation,
    examples[1][0],
    examples[1][1],
    "测试样例：比较完整用法与术语说明，实际课程应提供具体的易混辨析。",
  ];
  return {
    wordId,
    explanation: `${word.term}：${word.meaning}。${examples[0][2]}`,
    usageNotes: examples.map((e) => e[2]),
    examples: examples.map(([english, translation, note]) => ({
      english,
      translation,
      note,
    })),
    contrast: {
      left: {
        english: contrast[0],
        translation: contrast[1],
        note: "关注左句的动作或对象。",
      },
      right: {
        english: contrast[2],
        translation: contrast[3],
        note: "对比右句表达的范围。",
      },
      explanation: contrast[4],
    },
  };
}
export function fixtureLesson() {
  return {
    title: "读懂一次代码评审：动作、对象与使用条件",
    objectives: [
      "区分阅读信息、处理数据和许可条件",
      "读懂 before、without 和目的表达，并把它们迁移到新的技术句子",
    ],
    estimatedMinutes: 8,
    words: fixtureWordIds.map(fixtureLessonWord),
    reading: {
      title: "A small change, three useful questions",
      passage:
        "At the start of a code review, read the issue description before discussing a solution. The description explains what the user expects, but it may not describe every edge case. A reviewer can ask for a small example with both input and expected output. The developer then uses a helper to manipulate a list of labels. The team checks whether the helper returns a new list or changes the existing one. The verb alone does not answer that question. Next, someone proposes copying an example from a public repository. Before using the code, the team checks its license and the conditions that apply to distribution. Public access does not by itself remove those conditions. Finally, the reviewer writes a short note explaining the decision. Clear notes help the next developer understand both the technical behavior and the reason for the choice.",
      translation:
        "代码评审开始时，先阅读问题说明，再讨论解决方案。说明解释用户期望，但可能没有涵盖所有边界情况。评审者可以要求提供输入与预期输出。开发者使用辅助工具处理标签列表，团队检查它是返回新列表还是修改原列表；仅凭动词不能判断。接着，有人建议复制公开仓库中的示例。使用前要检查许可证及分发条件，公开可见并不自动免除这些条件。最后用简短笔记记录技术行为和选择理由。",
      sentences: [
        {
          sentence:
            "At the start of a code review, read the issue description before discussing a solution.",
          translation: "代码评审开始时，先阅读问题说明，再讨论解决方案。",
          chunks: [
            {
              text: "At the start of a code review",
              explanation: "时间背景：在代码评审开始时。",
            },
            {
              text: "read the issue description",
              explanation: "祈使句的核心动作：read + 阅读对象。",
            },
            {
              text: "before discussing a solution",
              explanation: "before + 动名词说明先后顺序：阅读在前，讨论在后。",
            },
          ],
          takeaway: "先找核心动词和对象，再用 before 判断动作顺序。",
        },
        {
          sentence:
            "The team checks whether the helper returns a new list or changes the existing one.",
          translation: "团队检查这个工具是返回新列表，还是修改现有列表。",
          chunks: [
            { text: "The team checks", explanation: "主句：团队检查。" },
            {
              text: "whether the helper returns a new list",
              explanation: "whether 引出需要确认的情况。",
            },
            {
              text: "or changes the existing one",
              explanation: "or 连接另一个可能；one 指代 list。",
            },
          ],
          takeaway:
            "不能仅凭 manipulate 推断原地修改；是否返回新对象需要核对实际接口。",
        },
      ],
      source: { kind: "generated" },
    },
    takeaways: [
      "read 后接要阅读的内容；to 可以说明目的。",
      "manipulate 表示处理，是否原地修改由实际接口决定。",
      "license 说明使用条件，documentation 说明技术用法。",
    ],
  };
}
