import type catalogJson from "../data/english.json";
import type dialoguesJson from "../data/english-dialogues.json";
import catalogUrl from "../data/english.json?url";
import dialoguesUrl from "../data/english-dialogues.json?url";

// Fetched as hashed static files rather than bundled: together they are ~800KB,
// which made the page script slow to parse on phones.
async function load<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

let data: [typeof catalogJson, typeof dialoguesJson];
try {
  data = await Promise.all([
    load<typeof catalogJson>(catalogUrl),
    load<typeof dialoguesJson>(dialoguesUrl),
  ]);
} catch (error) {
  const status = document.getElementById("sync-status");
  if (status) status.textContent = "词库读取失败，请检查网络后刷新页面。";
  throw error;
}

export const [catalog, dialogues] = data;
