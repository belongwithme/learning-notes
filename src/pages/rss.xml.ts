import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';

// Learning paths and notes that have been reworked; raw imports are left out.
const escape = (text: string) =>
	text.replace(/[<>&"]/g, ch => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' })[ch]!);

export const GET: APIRoute = async ({ site }) => {
	const docs = await getCollection(
		'docs',
		doc => doc.id.startsWith('learning-paths/') || (doc.id.startsWith('knowledge/') && !!doc.data.status && doc.data.status !== 'draft'),
	);
	const items = docs.map(doc => {
		const link = new URL(`/${doc.id}/`, site).href;
		const updated = doc.data.lastUpdated instanceof Date ? `<pubDate>${doc.data.lastUpdated.toUTCString()}</pubDate>` : '';
		return `<item><title>${escape(doc.data.title)}</title><link>${link}</link><guid>${link}</guid>${updated}<description>${escape(doc.data.description ?? '')}</description></item>`;
	});
	const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel><title>学习档案</title><link>${site}</link><description>学习路线与整理过的技术笔记</description><language>zh-CN</language>${items.join('')}</channel></rss>`;
	return new Response(xml, { headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' } });
};
