// No model calls and no arbitrary SQL: validate, atomically save, then read back.
import { parseArgs } from "node:util";
import { readFile } from "node:fs/promises";
import {
  findSavedRequest,
  saveLearningContent,
} from "../src/lib/english/practice-server.ts";
import { closeDb } from "../src/lib/english/server.ts";
import { saveSchema } from "../src/lib/english/practice-schema.ts";
import { z } from "astro/zod";
const { values } = parseArgs({
  options: {
    file: { type: "string" },
    request: { type: "string" },
    schema: { type: "boolean", default: false },
  },
});
try {
  let result;
  if (values.schema) result = z.toJSONSchema(saveSchema);
  else if (values.request) result = await findSavedRequest(values.request);
  else {
    if (!values.file)
      throw Object.assign(
        new Error(
          "需要 --file 内容.json，或使用 --request UUID 查询已有结果。",
        ),
        { status: 400 },
      );
    const raw = JSON.parse(await readFile(values.file, "utf8"));
    // On an uncertain outcome, callers query this same request UUID before retrying.
    result = await saveLearningContent(raw);
  }
  const base = process.env.ENGLISH_SITE_URL;
  console.log(
    JSON.stringify(
      {
        ...result,
        ...(result.path && base
          ? { url: new URL(result.path, base).href }
          : {}),
      },
      null,
      2,
    ),
  );
} catch (error) {
  console.error(
    JSON.stringify({
      saved: false,
      error:
        error.name === "ZodError"
          ? "内容格式不正确。"
          : error.status
            ? error.message
            : "尚未确认保存到网站，请按相同请求编号查询后再重试。",
      ...(error.name === "ZodError"
        ? {
            issues: error.issues.map((i) => ({
              path: i.path,
              message: i.message,
            })),
          }
        : {}),
    }),
  );
  process.exitCode = 1;
} finally {
  await closeDb();
}
