// Read-only entry point for Codex. Credentials are consumed here, never included in output.
import { parseArgs } from "node:util";
import { writeFile } from "node:fs/promises";
import { readLearningContext } from "../src/lib/english/practice-server.ts";
import { closeDb } from "../src/lib/english/server.ts";
import { learningDay } from "../src/lib/english/model.ts";
const { values } = parseArgs({
  options: {
    period: { type: "string", default: "day" },
    date: { type: "string" },
    cutoff: { type: "string" },
    include: { type: "string" },
    exclude: { type: "string" },
    goal: { type: "string" },
    mode: { type: "string" },
    out: { type: "string" },
  },
});
try {
  const context = await readLearningContext({
    kind: values.period,
    date: values.date ?? learningDay(),
    ...(values.cutoff ? { cutoff: values.cutoff } : {}),
    includeWordIds: values.include?.split(",").filter(Boolean) ?? [],
    excludeWordIds: values.exclude?.split(",").filter(Boolean) ?? [],
    ...(values.goal ? { goal: values.goal } : {}),
    ...(values.mode ? { mode: values.mode } : {}),
  });
  const output = JSON.stringify(context, null, 2);
  if (values.out) {
    await writeFile(values.out, output, { mode: 0o600 });
    console.log(
      JSON.stringify({
        contextFile: values.out,
        cutoff: context.input.cutoff,
        contextHash: context.contextHash,
        dataUse: context.dataUse,
      }),
    );
  } else console.log(output);
} catch (error) {
  console.error(
    JSON.stringify({
      error:
        error.name === "ZodError"
          ? "请求参数格式不正确。"
          : error.status
            ? error.message
            : "暂时无法读取学习数据，请检查连接与数据库迁移。",
    }),
  );
  process.exitCode = 1;
} finally {
  await closeDb();
}
