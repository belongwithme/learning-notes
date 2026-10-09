import type { APIRoute } from "astro";
import {
  handle,
  isAuthenticated,
  json,
  login,
  readBody,
  sameOrigin,
} from "../../../lib/english/server";
export const prerender = false;
export const GET: APIRoute = (context) =>
  handle(async () => json({ authenticated: isAuthenticated(context) }));
export const POST: APIRoute = (context) =>
  handle(async () => {
    sameOrigin(context);
    const data = await readBody(context.request, 2048);
    await login(context, data?.passphrase);
    return json({ authenticated: true });
  });
export const DELETE: APIRoute = (context) =>
  handle(async () => {
    sameOrigin(context);
    context.cookies.delete("english_session", { path: "/api/english" });
    return json({ authenticated: false });
  });
