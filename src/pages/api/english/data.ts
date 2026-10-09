import type { APIRoute } from "astro";
import {
  handle,
  json,
  loadData,
  mutate,
  readBody,
  requireAuth,
  sameOrigin,
} from "../../../lib/english/server";
export const prerender = false;
export const GET: APIRoute = (context) =>
  handle(async () => {
    requireAuth(context);
    return json(await loadData());
  });
export const POST: APIRoute = (context) =>
  handle(async () => {
    sameOrigin(context);
    requireAuth(context);
    await mutate(await readBody(context.request, 4_000_000));
    return json(await loadData());
  });
