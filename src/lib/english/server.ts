import pg, { type PoolClient } from "pg";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import type { APIContext } from "astro";
import { z } from "astro/zod";
import catalog from "../../data/english.json";
import { isDate, type LearningData, type Progress, type Review } from "./model";

let pool: pg.Pool | undefined;
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
function settings() {
  const url = process.env.DATABASE_URL;
  const passphrase = process.env.ENGLISH_PASSPHRASE;
  if (!url || !passphrase || passphrase.length < 16)
    throw new HttpError(
      503,
      "学习记录服务尚未配置，请先完成数据库与个人口令设置。",
    );
  return { url, passphrase };
}
export function db() {
  const { url } = settings();
  return (pool ??= new pg.Pool({
    connectionString: url,
    max: 3,
    idleTimeoutMillis: 10000,
    connectionTimeoutMillis: 10000,
  }));
}
const hash = (value: string) =>
  createHash("sha256").update(value).digest("hex");
function sign(value: string) {
  return createHmac("sha256", settings().passphrase)
    .update(value)
    .digest("hex");
}
function equal(a: string, b: string) {
  return timingSafeEqual(Buffer.from(hash(a)), Buffer.from(hash(b)));
}
export function isAuthenticated(context: APIContext) {
  settings();
  const [expires = "", signature = ""] = (
    context.cookies.get("english_session")?.value ?? ""
  ).split(".");
  return (
    /^\d+$/.test(expires) &&
    Number(expires) > Date.now() &&
    equal(signature, sign(expires))
  );
}
export function requireAuth(context: APIContext) {
  if (!isAuthenticated(context)) throw new HttpError(401, "请先输入个人口令。");
}
export function sameOrigin(context: APIContext) {
  if (context.request.headers.get("origin") !== context.url.origin)
    throw new HttpError(403, "请求来源不匹配，请从本站重新打开。");
}
export async function readBody(request: Request, maxBytes = 32_000) {
  if (!request.headers.get("content-type")?.startsWith("application/json"))
    throw new HttpError(415, "需要 JSON 数据。");
  if (Number(request.headers.get("content-length")) > maxBytes)
    throw new HttpError(413, "数据过大。");
  const reader = request.body?.getReader();
  if (!reader) throw new HttpError(400, "缺少数据。");
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > maxBytes) {
      await reader.cancel();
      throw new HttpError(413, "数据过大。");
    }
    chunks.push(value);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new HttpError(400, "数据格式不正确。");
  }
}
export function json(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff",
    },
  });
}
export async function handle(work: () => Promise<Response>) {
  try {
    return await work();
  } catch (error) {
    if (error instanceof HttpError)
      return json({ error: error.message }, error.status);
    if (error instanceof z.ZodError)
      return json(
        { error: "内容格式不正确，请检查日期、词条或文件版本。" },
        400,
      );
    console.error(
      "English service failed",
      error instanceof Error ? error.name : "UnknownError",
    );
    return json(
      { error: "保存服务暂时不可用。当前操作尚未确认保存，请稍后重试。" },
      503,
    );
  }
}
export async function login(context: APIContext, passphrase: unknown) {
  if (typeof passphrase !== "string" || passphrase.length > 256)
    throw new HttpError(400, "口令格式不正确。");
  const window = Math.floor(Date.now() / 900_000);
  // Vercel sets this header. In development use the actual socket address.
  const ip = process.env.VERCEL
    ? (context.request.headers.get("x-vercel-forwarded-for") ?? "unknown")
    : context.clientAddress;
  const bucket = sign(`${ip}:${window}`);
  const attempt = await db().query(
    "INSERT INTO english_login_attempts(bucket, attempts, expires_at) VALUES($1,1,now()+interval '15 minutes') ON CONFLICT(bucket) DO UPDATE SET attempts=english_login_attempts.attempts+1 RETURNING attempts",
    [bucket],
  );
  if (attempt.rows[0].attempts > 10)
    throw new HttpError(429, "尝试次数过多，请 15 分钟后再试。");
  if (!equal(passphrase, settings().passphrase))
    throw new HttpError(401, "口令不正确。");
  await db().query(
    "DELETE FROM english_login_attempts WHERE expires_at < now()",
  );
  const expires = String(Date.now() + 30 * 86400_000);
  context.cookies.set("english_session", `${expires}.${sign(expires)}`, {
    path: "/api/english",
    httpOnly: true,
    secure: context.url.protocol === "https:",
    sameSite: "strict",
    maxAge: 30 * 86400,
  });
}
const ids = new Set(catalog.entries.map((entry) => entry.id));
const wordId = z.string().refine((id) => ids.has(id));
const date = z.string().refine(isDate);
const status = z.enum(["new", "learning", "mastered"]);
const priority = z.enum(["high", "medium", "low"]);
const result = z.enum(["forgot", "vague", "remembered"]);
const progressSchema = z.object({
  wordId,
  status,
  priority,
  plannedDate: date,
  dueDate: date,
  note: z.string().max(2000),
  version: z.number().int().min(0),
});
const reviewSchema = z.object({
  id: z.uuid(),
  wordId,
  result,
  studiedAt: z.iso
    .datetime({ offset: true })
    .refine((value) => Date.parse(value) <= Date.now() + 60_000),
});
const mutationSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("update"),
    operationId: z.uuid(),
    progress: progressSchema,
  }),
  z.object({
    action: z.literal("review"),
    operationId: z.uuid(),
    wordId,
    version: z.number().int().min(0),
    result,
    studiedAt: z.iso
      .datetime({ offset: true })
      .refine((value) => Date.parse(value) <= Date.now() + 60_000),
  }),
  z.object({
    action: z.literal("import"),
    operationId: z.uuid(),
    progress: z.array(progressSchema).max(1000),
    reviews: z.array(reviewSchema).max(100000),
  }),
]);
const selectProgress =
  'SELECT word_id AS "wordId", status, priority, planned_date AS "plannedDate", due_date AS "dueDate", note, version, updated_at AS "updatedAt" FROM english_progress';
export async function loadData(): Promise<LearningData> {
  const client = await db().connect();
  try {
    await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    const progress = await client.query<Progress>(selectProgress);
    const reviews = await client.query<Review>(
      'SELECT id, word_id AS "wordId", result, studied_at AS "studiedAt" FROM english_reviews ORDER BY studied_at DESC, id',
    );
    await client.query("COMMIT");
    return {
      progress: Object.fromEntries(progress.rows.map((p) => [p.wordId, p])),
      reviews: reviews.rows,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
async function ensureWord(client: PoolClient, id: string) {
  await client.query(
    "INSERT INTO english_progress(word_id) VALUES($1) ON CONFLICT DO NOTHING",
    [id],
  );
}
export async function mutate(input: unknown) {
  const mutation = mutationSchema.parse(input);
  const payloadHash = hash(JSON.stringify(mutation));
  const client = await db().connect();
  try {
    await client.query("BEGIN");
    const op = await client.query(
      "INSERT INTO english_operations(id,payload_hash) VALUES($1,$2) ON CONFLICT DO NOTHING RETURNING id",
      [mutation.operationId, payloadHash],
    );
    if (!op.rowCount) {
      const existing = await client.query(
        "SELECT payload_hash FROM english_operations WHERE id=$1",
        [mutation.operationId],
      );
      if (existing.rows[0]?.payload_hash !== payloadHash)
        throw new HttpError(409, "此操作编号已被使用，请重新操作。");
    } else if (mutation.action === "import") {
      // Merge only missing progress. Existing cloud choices always win over an old backup.
      await client.query(
        `INSERT INTO english_progress(word_id,status,priority,planned_date,due_date,note,version)
        SELECT "wordId",status,priority,"plannedDate","dueDate",note,1 FROM jsonb_to_recordset($1::jsonb)
        AS p("wordId" text,status text,priority text,"plannedDate" text,"dueDate" text,note text)
        ON CONFLICT DO NOTHING`,
        [JSON.stringify(mutation.progress)],
      );
      await client.query(
        `INSERT INTO english_progress(word_id)
        SELECT DISTINCT "wordId" FROM jsonb_to_recordset($1::jsonb) AS r("wordId" text) ON CONFLICT DO NOTHING`,
        [JSON.stringify(mutation.reviews)],
      );
      await client.query(
        `INSERT INTO english_reviews(id,word_id,result,studied_at)
        SELECT id,"wordId",result,"studiedAt" FROM jsonb_to_recordset($1::jsonb)
        AS r(id uuid,"wordId" text,result text,"studiedAt" timestamptz) ON CONFLICT DO NOTHING`,
        [JSON.stringify(mutation.reviews)],
      );
    } else {
      const id =
        mutation.action === "update"
          ? mutation.progress.wordId
          : mutation.wordId;
      const version =
        mutation.action === "update"
          ? mutation.progress.version
          : mutation.version;
      await ensureWord(client, id);
      const updated =
        mutation.action === "update"
          ? await client.query(
              "UPDATE english_progress SET status=$3,priority=$4,planned_date=$5,due_date=$6,note=$7,version=version+1,updated_at=now() WHERE word_id=$1 AND version=$2 RETURNING word_id",
              [
                id,
                version,
                mutation.progress.status,
                mutation.progress.priority,
                mutation.progress.plannedDate,
                mutation.progress.dueDate,
                mutation.progress.note,
              ],
            )
          : await client.query(
              "UPDATE english_progress SET status=$3,version=version+1,updated_at=now() WHERE word_id=$1 AND version=$2 RETURNING word_id",
              [
                id,
                version,
                mutation.result === "remembered" ? "mastered" : "learning",
              ],
            );
      if (!updated.rowCount)
        throw new HttpError(
          409,
          "这个词条已在另一台设备更新。请取消本次操作并刷新后重试。",
        );
      if (mutation.action === "review") {
        await client.query(
          "INSERT INTO english_reviews(id,word_id,result,studied_at) VALUES($1,$2,$3,$4)",
          [mutation.operationId, id, mutation.result, mutation.studiedAt],
        );
      }
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
