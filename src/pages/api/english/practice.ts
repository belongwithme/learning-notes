import type { APIRoute } from 'astro';
import { handle, json, readBody, requireAuth, sameOrigin } from '../../../lib/english/server';
import { loadPractice, mutatePractice } from '../../../lib/english/practice-server';
export const prerender = false;
export const GET: APIRoute = context => handle(async () => {
  requireAuth(context);
  return json(await loadPractice(context.url.searchParams.get('report') || undefined));
});
export const POST: APIRoute = context => handle(async () => {
  sameOrigin(context);
  requireAuth(context);
  return json(await mutatePractice(await readBody(context.request)));
});
