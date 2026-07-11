#!/usr/bin/env node

import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, '..');
const defaults = {
	source: process.env.CSDN_EXPORT_DIR || '/Users/wangyi/csdn-article-export/exports',
	output: path.join(projectRoot, 'src/content/docs'),
	map: path.join(scriptDir, 'csdn-category-map.json'),
	report: path.join(scriptDir, 'csdn-import-report.json'),
	redirects: path.join(projectRoot, 'src/config/csdn-redirects.mjs'),
};

const args = new Set(process.argv.slice(2));
const valueArg = (name, fallback) => {
	const index = process.argv.indexOf(name);
	return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
};
const sourceRoot = path.resolve(valueArg('--source', defaults.source));
const outputRoot = path.resolve(valueArg('--output', defaults.output));
const mapPath = path.resolve(valueArg('--map', defaults.map));
const reportPath = path.resolve(valueArg('--report', defaults.report));
const redirectsPath = path.resolve(valueArg('--redirects', defaults.redirects));
const force = args.has('--force');
const dryRun = args.has('--dry-run');

const config = JSON.parse(fs.readFileSync(mapPath, 'utf8'));
const uiAssetNames = new Set([
	'3259ea4f509426d53ce8ff12.png',
	'cc9f40004eaf5335490eaee7.png',
	'961edceb8521084b55deeeb3.png',
]);

const ensureDir = directory => {
	if (!dryRun) fs.mkdirSync(directory, { recursive: true });
};

const readJson = file => JSON.parse(fs.readFileSync(file, 'utf8'));

const normalizeDate = value => {
	if (!value) return null;
	const date = new Date(value);
	return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
};

const normalizeTitle = title => String(title || '').replace(/\s+/g, ' ').trim();

const categoryFor = metadata => {
	const articleId = String(metadata.article_id);
	if (config.articleOverrides[articleId]) return config.articleOverrides[articleId];

	const title = normalizeTitle(metadata.title);
	for (const rule of config.titleRules || []) {
		if (new RegExp(rule.pattern, 'iu').test(title)) return rule.category;
	}

	for (const album of metadata.albums || []) {
		if (config.albumToCategory[album.name]) return config.albumToCategory[album.name];
	}

	return 'miscellaneous';
};

const subcategoryFor = (metadata, category) => {
	const articleId = String(metadata.article_id);
	const override = config.articleSubcategoryOverrides?.[articleId];
	if (override) return override;

	const title = normalizeTitle(metadata.title);
	for (const rule of config.subcategoryRules || []) {
		if (rule.category === category && new RegExp(rule.pattern, 'iu').test(title)) return rule.subcategory;
	}

	for (const album of metadata.albums || []) {
		const mapped = config.albumToSubcategory?.[album.name];
		if (mapped && config.subcategories?.[category]?.[mapped]) return mapped;
	}

	return config.categories[category]?.defaultSubcategory;
};

const baseDirFor = category => config.categories[category]?.base || 'knowledge';

const truncateUtf8 = (value, maxBytes = 180) => {
	let result = '';
	for (const character of value) {
		if (Buffer.byteLength(result + character, 'utf8') > maxBytes) break;
		result += character;
	}
	return result.replace(/-+$/g, '');
};

const semanticSlugFor = title => {
	const slug = normalizeTitle(title)
		.normalize('NFKC')
		.toLowerCase()
		.replace(/&+/g, ' and ')
		.replace(/[’']/g, '')
		.replace(/[^\p{Letter}\p{Number}]+/gu, '-')
		.replace(/^-+|-+$/g, '')
		.replace(/-{2,}/g, '-');
	return truncateUtf8(slug) || '未命名文章';
};

const uniqueSlugFor = (title, category, subcategory, usedSlugs) => {
	const key = `${category}/${subcategory}`;
	const baseSlug = semanticSlugFor(title);
	const slugs = usedSlugs.get(key) || new Set();
	let slug = baseSlug;
	let suffix = 2;
	while (slugs.has(slug)) slug = `${baseSlug}-${suffix++}`;
	slugs.add(slug);
	usedSlugs.set(key, slugs);
	return slug;
};

const routeFor = (category, subcategory, slug) =>
	category === 'retrospectives'
		? `/retrospectives/${subcategory}/${slug}/`
		: `/knowledge/${category}/${subcategory}/${slug}/`;

const technicalRouteFor = (category, subcategory, articleId) =>
	category === 'retrospectives'
		? `/retrospectives/${subcategory}/csdn-${articleId}/`
		: `/knowledge/${category}/${subcategory}/${category}-${articleId}/`;

const legacyRouteFor = (category, articleId) =>
	category === 'retrospectives'
		? `/retrospectives/csdn-${articleId}/`
		: `/knowledge/${category}/${category}-${articleId}/`;

const stripMarkdown = value =>
	String(value)
		.replace(/!\[[^\]]*\]\([^)]*\)/g, '')
		.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
		.replace(/<[^>]+>/g, '')
		.replace(/[`*_>#|~-]/g, '')
		.replace(/\s+/g, ' ')
		.trim();

const descriptionFor = (body, title) => {
	let fenced = false;
	for (const rawLine of body.split(/\r?\n/)) {
		const line = rawLine.trim();
		if (/^```/.test(line)) {
			fenced = !fenced;
			continue;
		}
		if (fenced || !line || /^#{1,6}\s/.test(line) || /^>\s*原文/.test(line)) continue;
		const text = stripMarkdown(line);
		if (text.length >= 20) {
			return text.length > 150 ? `${text.slice(0, 147)}...` : text;
		}
	}
	return `围绕“${title}”整理核心概念、实现原理与实践要点。`;
};

const tagsFor = (metadata, category) => {
	const tags = new Set();
	const title = normalizeTitle(metadata.title);
	for (const album of metadata.albums || []) if (album.name) tags.add(album.name);
	const keywordRules = [
		['MySQL', /mysql/i], ['Redis', /redis/i], ['Kafka', /kafka/i], ['Java', /java/i],
		['Spring', /spring/i], ['JUC', /juc|并发|线程|lock/i], ['JVM', /jvm/i],
		['SQL', /sql|join|索引|事务|锁|查询/i], ['TCP/IP', /tcp|udp|http|网络/i],
		['算法', /算法|图论|排序|链表|队列|数组|树|dijkstra|dfs|bfs/i],
	];
	for (const [tag, pattern] of keywordRules) if (pattern.test(title)) tags.add(tag);
	if (category === 'retrospectives') tags.add('问题复盘');
	if (tags.size === 0) tags.add(config.categories[category]?.label || category);
	return [...tags].slice(0, 8);
};

const difficultyFor = title => {
	if (/入门|基础|简单|使用|八股|概念|介绍/i.test(title)) return 'beginner';
	if (/源码|原理|深度|六万字|机制|执行引擎|工作原理/i.test(title)) return 'advanced';
	return 'intermediate';
};

const contentTypeFor = (title, category) => {
	if (category === 'retrospectives') return 'retrospective';
	if (/源码|源码级|工作原理|执行原理|底层|机制/i.test(title)) return 'source-analysis';
	if (/实操|使用|实现|落地|案例|业务|设计/i.test(title)) return 'practice';
	return 'knowledge';
};

const stripLeadingTitleAndToc = (body, title) => {
	let lines = body.replace(/^\uFEFF/, '').split(/\r?\n/);
	while (lines.length && !lines[0].trim()) lines.shift();
	if (lines[0] && /^#\s+/.test(lines[0])) lines.shift();
	while (lines.length && !lines[0].trim()) lines.shift();

	const sourceIndex = lines.findIndex(line => /^>\s*(来源|原文)\s*[:：]/u.test(line));
	if (sourceIndex >= 0) lines.splice(sourceIndex, 1);

	const tocStart = lines.findIndex((line, index) => index < 100 && line.includes('](#'));
	if (tocStart >= 0) {
		let tocEnd = tocStart;
		let linkCount = 0;
		while (tocEnd < lines.length) {
			const line = lines[tocEnd];
			if (line.includes('](#')) {
				linkCount++;
				tocEnd++;
				continue;
			}
			if (!line.trim()) {
				tocEnd++;
				continue;
			}
			break;
		}
		const nextHeading = lines.slice(tocEnd).findIndex(line => /^#{2,6}\s+/.test(line));
		if (linkCount >= 2 && nextHeading >= 0) {
			let removeStart = tocStart;
			while (removeStart > 0 && !lines[removeStart - 1].trim()) removeStart--;
			const tocHeading = lines[removeStart - 1]?.match(/^#{2,6}\s+(.+)$/);
			if (tocHeading && /^(文章目录|目录|table of contents)$/iu.test(tocHeading[1].trim())) {
				removeStart--;
				while (removeStart > 0 && !lines[removeStart - 1].trim()) removeStart--;
			}
			const removeEnd = tocEnd;
			lines.splice(removeStart, removeEnd - removeStart);
		}
	}

	while (lines.length && !lines[0].trim()) lines.shift();
	while (lines.length) {
		const firstHeading = lines[0]?.match(/^#{2,6}\s+(.+)$/);
		if (!firstHeading) break;
		const normalizeComparable = value => String(value).replace(/[\s：:—–-]+/g, '').toLowerCase();
		const headingText = normalizeComparable(firstHeading[1]);
		const titleText = normalizeComparable(title);
		if (headingText.length >= 2 && titleText.includes(headingText)) {
			lines.shift();
			while (lines.length && !lines[0].trim()) lines.shift();
			continue;
		}
		break;
	}

	return lines.join('\n').replace(/^\n+/, '').replace(/\n{4,}/g, '\n\n\n').trim();
};

const cleanBody = (rawBody, metadata, assetPrefix) => {
	let body = stripLeadingTitleAndToc(rawBody, metadata.title);
	const lines = body.split(/\r?\n/);
	const output = [];
	let fenceOpen = false;

	for (const line of lines) {
		if (/^\s*AI写代码.*$/u.test(line) || /^\s*登录后复制\s*$/u.test(line)) continue;
		if (/^\s*运行项目并下载源码(?:java|sql|html|bash|shell)?(?:运行)?\s*$/iu.test(line)) continue;
		if (/^\s*\*\s+\d+\s*$/.test(line)) continue;

		const malformedImageFence = line.match(/^(\s*)```(!\[[^\]]*\]\([^)]*\))\s*$/);
		if (malformedImageFence) {
			if (fenceOpen) output.push(`${malformedImageFence[1]}\`\`\``);
			output.push(`${malformedImageFence[1]}${malformedImageFence[2]}`);
			fenceOpen = false;
			continue;
		}

		const fence = line.match(/^(\s*)```(.*)$/);
		if (fence) {
			const info = fence[2].trim();
			const normalizedFenceLine = info.toLowerCase() === 'git' ? `${fence[1]}\`\`\`bash` : line;
			if (fenceOpen && info) {
				output.push(`${fence[1]}\`\`\``);
				output.push(normalizedFenceLine);
				fenceOpen = true;
			} else {
				output.push(normalizedFenceLine);
				fenceOpen = !fenceOpen;
			}
			continue;
		}

		const uiImage = [...uiAssetNames].some(name => line.includes(`assets/${name}`));
		if (uiImage && /^\s*!\[[^\]]*\]\([^)]*\)\s*$/.test(line)) continue;
		output.push(line);
	}

	if (fenceOpen) output.push('```');

	body = output.join('\n')
		.replace(/(!\[[^\]]*\]\()assets\//g, `$1${assetPrefix}`)
		.replace(/(<img\b[^>]*\bsrc=["'])assets\//gi, `$1${assetPrefix}`)
		.replace(/\n{4,}/g, '\n\n\n')
		.trim();

	const sourceUrl = metadata.url ? `\n\n> 原文：[CSDN](${metadata.url})（历史文章导入，当前状态为草稿）\n` : '';
	return `${sourceUrl}\n${body}\n`;
};

const referencedAssets = (body, assetPrefix) => {
	const names = new Set();
	const normalizedPrefix = assetPrefix.replace(/^\.\//, '');
	const escapedPrefix = normalizedPrefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	const pattern = new RegExp(`(?:\\./)?${escapedPrefix}([^\\s)>'"]+)`, 'g');
	for (const match of body.matchAll(pattern)) {
		const name = decodeURIComponent(match[1]).replace(/[),.;]+$/, '');
		if (name && !uiAssetNames.has(path.basename(name))) names.add(name);
	}
	return names;
};

const materializeRemoteImages = async (body, assetDirectory, assetPrefix) => {
	const missing = [];
	const replacements = new Map();
	for (const match of body.matchAll(/!\[[^\]]*\]\((https?:\/\/[^)]+)\)/g)) {
		const url = match[1];
		if (replacements.has(url)) continue;
		let extension = '.png';
		try {
			const candidate = path.extname(new URL(url).pathname).toLowerCase();
			if (/^\.(png|jpe?g|gif|webp|svg)$/.test(candidate)) extension = candidate;
		} catch {
			// Keep the safe PNG fallback for malformed but fetchable image URLs.
		}
		const filename = `remote-${crypto.createHash('sha256').update(url).digest('hex').slice(0, 16)}${extension}`;
		const relative = `${assetPrefix}${filename}`;
		replacements.set(url, relative);
		if (dryRun) continue;
		const target = path.join(assetDirectory, filename);
		if (fs.existsSync(target)) continue;
		try {
			const response = await fetch(url, { signal: AbortSignal.timeout(20000) });
			if (!response.ok) throw new Error(`HTTP ${response.status}`);
			ensureDir(path.dirname(target));
			fs.writeFileSync(target, Buffer.from(await response.arrayBuffer()));
		} catch (error) {
			missing.push({ url, error: error instanceof Error ? error.message : String(error) });
		}
	}
	for (const [url, relative] of replacements) body = body.replaceAll(url, relative);
	return { body, missing };
};

const yamlList = values => values.length ? values.map(value => `  - ${JSON.stringify(value)}`).join('\n') : '  []';

const frontmatterFor = (metadata, category, subcategory, body) => {
	const title = normalizeTitle(metadata.title);
	const published = normalizeDate(metadata.published_at);
	const updated = normalizeDate(metadata.updated_at);
	const sourceSeries = (metadata.albums || []).map(album => album.name).filter(Boolean);
	const lines = [
		'---',
		`title: ${JSON.stringify(title)}`,
		`description: ${JSON.stringify(descriptionFor(body, title))}`,
		`sourceId: ${JSON.stringify(String(metadata.article_id))}`,
		`source: ${JSON.stringify(metadata.url || '')}`,
		...(sourceSeries.length ? ['sourceSeries:', yamlList(sourceSeries)] : ['sourceSeries: []']),
		`category: ${category}`,
		`subcategory: ${subcategory}`,
		'tags:',
		yamlList(tagsFor(metadata, category)),
		'status: draft',
		`difficulty: ${difficultyFor(title)}`,
		`contentType: ${contentTypeFor(title, category)}`,
		`sidebar:\n  order: ${Number(metadata.article_id) || 999999}`,
	];
	if (published) lines.splice(4, 0, `created: ${published}`);
	if (updated) lines.splice(5, 0, `updated: ${updated}`);
	lines.push('---', '');
	return lines.join('\n');
};

if (!fs.existsSync(sourceRoot)) {
	console.error(`CSDN source directory does not exist: ${sourceRoot}`);
	process.exit(1);
}

const previousReport = fs.existsSync(reportPath) ? readJson(reportPath) : null;
if (force && !dryRun && previousReport?.articles) {
	for (const article of previousReport.articles) {
		if (!article.output) continue;
		const previousFile = path.resolve(projectRoot, article.output);
		if (!previousFile.startsWith(`${outputRoot}${path.sep}`) || !fs.existsSync(previousFile)) continue;
		const content = fs.readFileSync(previousFile, 'utf8');
		if (!content.includes(`sourceId: "${article.articleId}"`)) continue;
		if (path.basename(previousFile) === 'index.md') {
			fs.rmSync(path.dirname(previousFile), { recursive: true, force: true });
		} else {
			fs.rmSync(previousFile, { force: true });
			const previousAssetDirectory = article.assetDirectory
				? path.resolve(projectRoot, article.assetDirectory)
				: path.join(path.dirname(previousFile), 'assets', String(article.articleId));
			if (previousAssetDirectory.startsWith(`${outputRoot}${path.sep}`)) {
				fs.rmSync(previousAssetDirectory, { recursive: true, force: true });
			}
		}
	}
}

const report = {
	generatedAt: new Date().toISOString(),
	sourceRoot,
	outputRoot,
	force,
	imported: 0,
	skipped: 0,
	missingMetadata: [],
	missingAssets: [],
	missingRemoteImages: [],
	byCategory: {},
	bySubcategory: {},
	articles: [],
};

const exportDirs = fs.readdirSync(sourceRoot)
	.map(name => path.join(sourceRoot, name))
	.filter(directory => fs.statSync(directory).isDirectory())
	.filter(directory => fs.existsSync(path.join(directory, 'article.md')))
	.sort((a, b) => a.localeCompare(b, 'zh-CN'));

const usedSlugs = new Map();

for (const sourceDir of exportDirs) {
	const metadataPath = path.join(sourceDir, 'metadata.json');
	if (!fs.existsSync(metadataPath)) {
		report.missingMetadata.push(path.basename(sourceDir));
		continue;
	}

	const metadata = readJson(metadataPath);
	const articleId = String(metadata.article_id || path.basename(sourceDir));
	const category = categoryFor(metadata);
	const categoryConfig = config.categories[category];
	if (!categoryConfig) throw new Error(`No category config for ${category} (${articleId})`);
	const subcategory = subcategoryFor(metadata, category);
	if (!subcategory || !config.subcategories?.[category]?.[subcategory]) {
		throw new Error(`No subcategory config for ${category}/${subcategory} (${articleId})`);
	}
	const outputCategoryDir = category === 'retrospectives'
		? path.join(outputRoot, 'retrospectives')
		: path.join(outputRoot, baseDirFor(category), category);
	const outputDir = path.join(outputCategoryDir, subcategory);
	const title = normalizeTitle(metadata.title);
	const slug = uniqueSlugFor(title, category, subcategory, usedSlugs);
	const outputFile = path.join(outputDir, `${slug}.md`);
	const assetDirectory = path.join(outputDir, 'assets', articleId);
	const assetPrefix = `./assets/${articleId}/`;
	const legacyCategory = config.legacyCategoryOverrides?.[articleId] || category;
	const legacyUrl = legacyRouteFor(legacyCategory, articleId);
	const technicalUrl = technicalRouteFor(category, subcategory, articleId);
	const url = routeFor(category, subcategory, slug);
	const exists = fs.existsSync(outputFile);
	if (exists && !force) {
		report.skipped++;
		report.articles.push({
			articleId,
			category,
			subcategory,
			title,
			slug,
			output: path.relative(projectRoot, outputFile),
			assetDirectory: path.relative(projectRoot, assetDirectory),
			legacyUrl,
			technicalUrl,
			url,
			status: 'skipped',
		});
		continue;
	}

	const rawBody = fs.readFileSync(path.join(sourceDir, 'article.md'), 'utf8');
	let body = cleanBody(rawBody, metadata, assetPrefix);
	const remoteImages = await materializeRemoteImages(body, assetDirectory, assetPrefix);
	body = remoteImages.body;
	if (remoteImages.missing.length) report.missingRemoteImages.push({ articleId, images: remoteImages.missing });
	const destinationBody = `${frontmatterFor(metadata, category, subcategory, body)}${body}`;
	const assets = referencedAssets(body, assetPrefix);
	const missingAssets = [];
	if (!dryRun) ensureDir(outputDir);
	for (const asset of assets) {
		const sourceAsset = path.join(sourceDir, 'assets', asset);
		const targetAsset = path.join(assetDirectory, asset);
		if (!fs.existsSync(sourceAsset)) {
			if (dryRun || fs.existsSync(targetAsset)) continue;
			missingAssets.push(asset);
			continue;
		}
		if (!dryRun) {
			ensureDir(path.dirname(targetAsset));
			fs.copyFileSync(sourceAsset, targetAsset);
		}
	}
	if (missingAssets.length) report.missingAssets.push({ articleId, missingAssets });
	if (!dryRun) fs.writeFileSync(outputFile, destinationBody, 'utf8');

	report.imported++;
	report.byCategory[category] = (report.byCategory[category] || 0) + 1;
	const subcategoryKey = `${category}/${subcategory}`;
	report.bySubcategory[subcategoryKey] = (report.bySubcategory[subcategoryKey] || 0) + 1;
	report.articles.push({
		articleId,
		category,
		subcategory,
		title,
		slug,
		output: path.relative(projectRoot, outputFile),
		assetDirectory: path.relative(projectRoot, assetDirectory),
		legacyUrl,
		technicalUrl,
		url,
		assets: assets.size,
		missingAssets,
		status: 'imported',
	});
}

if (!dryRun) {
	ensureDir(path.dirname(reportPath));
	fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
	const redirects = Object.fromEntries(
		report.articles
			.flatMap(article => [article.legacyUrl, article.technicalUrl]
				.filter(sourceUrl => sourceUrl && article.url && sourceUrl !== article.url)
				.map(sourceUrl => [sourceUrl, article.url]))
			.sort(([left], [right]) => left.localeCompare(right)),
	);
	const redirectsModule = [
		'// Generated by scripts/import-csdn.mjs. Do not edit manually.',
		`export const CsdnRedirects = ${JSON.stringify(redirects, null, 2)};`,
		'',
	].join('\n');
	ensureDir(path.dirname(redirectsPath));
	fs.writeFileSync(redirectsPath, redirectsModule, 'utf8');
}

console.log(JSON.stringify({
	imported: report.imported,
	skipped: report.skipped,
	missingMetadata: report.missingMetadata.length,
	missingAssets: report.missingAssets.length,
	missingRemoteImages: report.missingRemoteImages.length,
	byCategory: report.byCategory,
	bySubcategory: report.bySubcategory,
	dryRun,
}, null, 2));

if (report.missingMetadata.length || report.missingAssets.length || report.missingRemoteImages.length) process.exitCode = 2;
