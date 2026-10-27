import { getCollection, type CollectionEntry } from 'astro:content';
import { KnowledgeCategories, KnowledgeSubcategories } from '../config/site-routing';

type Doc = CollectionEntry<'docs'>;

export interface NoteLink {
	href: string;
	title: string;
	/** For learning paths: the stage heading the link sits under. */
	stage?: string;
}

/** `knowledge/<area>/<subcategory>/<slug>` → area and subcategory labels. */
export function noteLocation(id: string) {
	const [root, areaId, subId, slug] = id.split('/');
	if (root !== 'knowledge' || !slug) return null;
	const area = KnowledgeCategories.find(c => c.id === areaId);
	const sub = KnowledgeSubcategories[areaId]?.find(s => s.id === subId);
	if (!area || !sub) return null;
	return {
		area: { label: area.label, href: `/knowledge/${areaId}/` },
		sub: { label: sub.label, href: `/knowledge/${areaId}/#${subId}` },
		dir: `knowledge/${areaId}/${subId}`,
	};
}

/** About 400 Chinese characters or 200 English words per minute, ignoring code blocks. */
export function readingMinutes(body = '') {
	const prose = body.replace(/```[\s\S]*?```/g, '');
	const cjk = prose.match(/[㐀-鿿]/g)?.length ?? 0;
	const words = prose.replace(/[㐀-鿿]/g, ' ').match(/[A-Za-z0-9]+/g)?.length ?? 0;
	return Math.max(1, Math.round(cjk / 400 + words / 200));
}

export const title = (doc: Doc) => doc.data.sidebar.label ?? doc.data.title;

let linkIndex: Promise<Map<string, NoteLink[]>> | undefined;

/** Map of doc id → docs that link to it, built once per build. */
function incomingLinks() {
	linkIndex ??= getCollection('docs').then(docs => {
		const ids = new Set(docs.map(d => d.id));
		const index = new Map<string, NoteLink[]>();
		for (const doc of docs) {
			let stage: string | undefined;
			for (const line of (doc.body ?? '').split('\n')) {
				const heading = /^##\s+(.+)/.exec(line);
				if (heading) stage = heading[1].trim();
				for (const [, target] of line.matchAll(/\]\(\/([^)#\s]+?)\/?(?:#[^)]*)?\)/g)) {
					const id = decodeURI(target);
					if (id === doc.id || !ids.has(id)) continue;
					const list = index.get(id) ?? [];
					if (list.some(l => l.href === `/${doc.id}/`)) continue;
					list.push({ href: `/${doc.id}/`, title: title(doc), stage: doc.id.startsWith('learning-paths/') ? stage : undefined });
					index.set(id, list);
				}
			}
		}
		return index;
	});
	return linkIndex;
}

export async function noteRelations(doc: Doc) {
	const location = noteLocation(doc.id);
	if (!location) return null;
	const incoming = (await incomingLinks()).get(doc.id) ?? [];
	const order = (d: Doc) => d.data.sidebar.order ?? Number.MAX_SAFE_INTEGER;
	const siblings = (await getCollection('docs', d => d.id.startsWith(`${location.dir}/`)))
		.sort((a, b) => order(a) - order(b) || a.data.title.localeCompare(b.data.title, 'zh-CN'))
		.filter(d => d.id !== doc.id)
		.map(d => ({ href: `/${d.id}/`, title: title(d) }));
	return {
		location,
		paths: incoming.filter(l => l.href.startsWith('/learning-paths/')),
		backlinks: incoming.filter(l => !l.href.startsWith('/learning-paths/')),
		siblings,
	};
}
