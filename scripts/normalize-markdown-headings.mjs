#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const CONTENT_ROOT = path.resolve('src/content/docs');
const args = new Set(process.argv.slice(2));
const allowedArgs = new Set(['--check', '--write', '--help']);

for (const arg of args) {
	if (!allowedArgs.has(arg)) throw new Error(`Unknown argument: ${arg}`);
}

if (args.has('--help')) {
	console.log(`Usage: node scripts/normalize-markdown-headings.mjs [--check | --write]

With no flag, report the changes that would be made without modifying files.
--check  Exit with an error when normalization would change any file.
--write  Apply normalization and verify the written files.`);
	process.exit(0);
}

if (args.has('--check') && args.has('--write')) {
	throw new Error('Use either --check or --write, not both.');
}

const mode = args.has('--write') ? 'write' : args.has('--check') ? 'check' : 'report';
const ATX_HEADING = /^( {0,3})(#{1,6})(?=[ \t]|(?:\r?\n)?$)/;
const FENCE_OPEN = /^( {0,3})(`{3,}|~{3,})/;

const earlyRootPrefixes = [
	'前言',
	'引言',
	'导读',
	'序言',
	'写在前面',
	'简介',
	'介绍',
	'概述',
	'概览',
	'知识体系概览',
];

const lateRootPrefixes = ['总结', '结语', '结论', '后记', '参考资料', '参考文献', '附录', '常见问题'];

const chineseDigits = new Map([
	['零', 0],
	['〇', 0],
	['一', 1],
	['二', 2],
	['三', 3],
	['四', 4],
	['五', 5],
	['六', 6],
	['七', 7],
	['八', 8],
	['九', 9],
]);

function listContentFiles(directory) {
	return fs
		.readdirSync(directory, { withFileTypes: true })
		.flatMap(entry => {
			const entryPath = path.join(directory, entry.name);
			if (entry.isDirectory()) return listContentFiles(entryPath);
			return /\.(?:md|mdx)$/i.test(entry.name) ? [entryPath] : [];
		})
		.sort((left, right) => left.localeCompare(right));
}

function splitLines(source) {
	const lines = source.split(/(?<=\n)/);
	if (lines.at(-1) === '') lines.pop();
	return lines;
}

function bareLine(line) {
	return line.replace(/\r?\n$/, '');
}

function closingFencePattern(character, minimumLength) {
	const escaped = character === '~' ? '~' : '`';
	return new RegExp(`^ {0,3}${escaped}{${minimumLength},}[ \\t]*$`);
}

function scanDocument(lines, filePath) {
	if (!lines.length || bareLine(lines[0]).replace(/^\uFEFF/, '').trim() !== '---') {
		throw new Error(`Missing YAML frontmatter: ${filePath}`);
	}

	let inFrontmatter = true;
	let frontmatterEnd = null;
	let fence = null;
	const headings = [];

	for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
		const line = lines[lineIndex];
		const bare = bareLine(line);

		if (inFrontmatter) {
			if (lineIndex > 0 && (bare.trim() === '---' || bare.trim() === '...')) {
				inFrontmatter = false;
				frontmatterEnd = lineIndex;
			}
			continue;
		}

		if (fence) {
			if (closingFencePattern(fence.character, fence.length).test(bare)) fence = null;
			continue;
		}

		const openedFence = line.match(FENCE_OPEN);
		if (openedFence) {
			fence = { character: openedFence[2][0], length: openedFence[2].length };
			continue;
		}

		const heading = line.match(ATX_HEADING);
		if (!heading) continue;

		const hashStart = heading[1].length;
		const hashEnd = hashStart + heading[2].length;
		const suffix = line.slice(hashEnd);
		const text = bareLine(suffix)
			.replace(/^[ \t]+/, '')
			.replace(/[ \t]+#+[ \t]*$/, '')
			.trim();

		headings.push({
			lineIndex,
			lineNumber: lineIndex + 1,
			rawLevel: heading[2].length,
			hashStart,
			hashEnd,
			suffix,
			text,
		});
	}

	if (inFrontmatter) throw new Error(`Unclosed YAML frontmatter: ${filePath}`);
	if (fence) throw new Error(`Unclosed fenced code block: ${filePath}`);

	return { frontmatterEnd, headings };
}

function stripLeadingDecoration(text) {
	return text.replace(/^[\s\p{Extended_Pictographic}\p{Punctuation}\p{Symbol}]+/gu, '').trim();
}

function hasPrefix(text, prefixes) {
	const normalized = stripLeadingDecoration(text);
	return prefixes.some(prefix => normalized.startsWith(prefix));
}

function isChapterHeading(text) {
	return /^第\s*[0-9一二三四五六七八九十百零〇]+\s*(?:章|篇|部分)(?:\s|[：:———-]|$)/u.test(
		stripLeadingDecoration(text),
	);
}

function chineseNumber(value) {
	if (chineseDigits.has(value)) return chineseDigits.get(value);
	if (value === '十') return 10;
	if (value.startsWith('十')) return 10 + (chineseDigits.get(value.slice(1)) ?? 0);
	if (value.includes('十')) {
		const [tens, units] = value.split('十', 2);
		return (chineseDigits.get(tens) ?? 1) * 10 + (chineseDigits.get(units) ?? 0);
	}
	return null;
}

function simpleNumber(text) {
	const normalized = stripLeadingDecoration(text);
	const decimal = normalized.match(/^(\d{1,2})(\.|、|:|：|\)|）)(?!\d)\s*/u);
	if (decimal) {
		return { family: 'decimal', value: Number(decimal[1]), delimiter: decimal[2] };
	}

	const chinese = normalized.match(/^([一二三四五六七八九十百零〇]+)(、|\.|:|：)\s*/u);
	if (!chinese) return null;
	return { family: 'chinese', value: chineseNumber(chinese[1]), delimiter: chinese[2] };
}

function rawParents(headings) {
	const parents = Array(headings.length).fill(null);
	const stack = [];

	for (let index = 0; index < headings.length; index += 1) {
		const heading = headings[index];
		while (stack.length && heading.rawLevel <= headings[stack.at(-1)].rawLevel) stack.pop();
		parents[index] = stack.length ? stack.at(-1) : null;
		stack.push(index);
	}

	return parents;
}

function addReason(reasonMap, index, reason) {
	if (!reasonMap.has(index)) reasonMap.set(index, new Set());
	reasonMap.get(index).add(reason);
}

function classifyRootAnchors(headings) {
	const reasons = new Map();
	if (!headings.length) return reasons;

	addReason(reasons, 0, 'first-heading');

	for (let index = 0; index < headings.length; index += 1) {
		const heading = headings[index];
		if (index < 2 && hasPrefix(heading.text, earlyRootPrefixes)) {
			addReason(reasons, index, 'opening-section');
		}
		if (isChapterHeading(heading.text)) addReason(reasons, index, 'chapter');
		if (index >= headings.length - 2 && hasPrefix(heading.text, lateRootPrefixes)) {
			addReason(reasons, index, 'closing-section');
		}
	}

	const parents = rawParents(headings);
	const groups = new Map();

	for (let index = 0; index < headings.length; index += 1) {
		const number = simpleNumber(headings[index].text);
		if (!number || number.value === null) continue;
		const parent = parents[index];
		const key = `${number.family}|${headings[index].rawLevel}|${parent ?? 'root'}`;
		if (!groups.has(key)) groups.set(key, { family: number.family, parent, entries: [] });
		groups.get(key).entries.push({ index, ...number });
	}

	for (const group of groups.values()) {
		const values = new Set(group.entries.map(entry => entry.value));
		const decimalSequence =
			group.family === 'decimal' &&
			group.entries.length >= 3 &&
			((values.has(0) && values.has(1) && values.has(2)) ||
				(values.has(1) && values.has(2) && values.has(3)));
		const chineseSequence =
			group.family === 'chinese' && group.entries.length >= 2 && values.has(1) && values.has(2);

		if (!decimalSequence && !chineseSequence) continue;

		const firstEntry = group.entries[0];
		const parentIsOpeningRoot = group.parent !== null && reasons.get(group.parent)?.has('opening-section');
		const parentIsLeadTitle =
			group.parent === 0 && firstEntry.index <= 2 && group.entries.length >= 3;
		const topLevelScope = group.parent === null || parentIsOpeningRoot || parentIsLeadTitle;
		if (!topLevelScope) continue;

		for (const entry of group.entries) addReason(reasons, entry.index, 'top-level-numbering');
	}

	return reasons;
}

function headingCounts(headings, levelKey = 'rawLevel') {
	const counts = Object.fromEntries(Array.from({ length: 6 }, (_, index) => [index + 1, 0]));
	for (const heading of headings) counts[heading[levelKey]] += 1;
	return counts;
}

function normalizedLines(inputLines, filePath) {
	const originalScan = scanDocument(inputLines, filePath);
	const lines = [...inputLines];
	const emptyHeadings = originalScan.headings.filter(heading => !heading.text);

	for (const heading of emptyHeadings) {
		const ending = lines[heading.lineIndex].match(/\r?\n$/)?.[0] ?? '';
		lines[heading.lineIndex] = ending;
	}

	const beforeScan = scanDocument(lines, filePath);
	const reasons = classifyRootAnchors(beforeScan.headings);
	const targetLevels = [];
	const outlineStack = [];

	for (let index = 0; index < beforeScan.headings.length; index += 1) {
		const heading = beforeScan.headings[index];
		let targetLevel;

		if (reasons.has(index)) {
			outlineStack.length = 0;
			targetLevel = 2;
		} else {
			while (outlineStack.length && heading.rawLevel <= outlineStack.at(-1).rawLevel) {
				outlineStack.pop();
			}
			targetLevel = outlineStack.length ? outlineStack.at(-1).targetLevel + 1 : 2;
		}

		if (targetLevel > 6) {
			throw new Error(`Normalized heading would exceed H6: ${filePath}:${heading.lineNumber}`);
		}

		targetLevels.push(targetLevel);
		outlineStack.push({ rawLevel: heading.rawLevel, targetLevel });
	}

	let headingMarkersChanged = 0;
	for (let index = 0; index < beforeScan.headings.length; index += 1) {
		const heading = beforeScan.headings[index];
		const targetLevel = targetLevels[index];
		if (heading.rawLevel === targetLevel) continue;
		const line = lines[heading.lineIndex];
		lines[heading.lineIndex] =
			line.slice(0, heading.hashStart) + '#'.repeat(targetLevel) + line.slice(heading.hashEnd);
		headingMarkersChanged += 1;
	}

	const afterScan = scanDocument(lines, filePath);
	if (beforeScan.frontmatterEnd !== afterScan.frontmatterEnd) {
		throw new Error(`Frontmatter boundary changed: ${filePath}`);
	}
	if (
		inputLines.slice(0, originalScan.frontmatterEnd + 1).join('') !==
		lines.slice(0, afterScan.frontmatterEnd + 1).join('')
	) {
		throw new Error(`Frontmatter content changed: ${filePath}`);
	}
	if (beforeScan.headings.length !== afterScan.headings.length) {
		throw new Error(`Meaningful heading count changed: ${filePath}`);
	}

	for (let index = 0; index < beforeScan.headings.length; index += 1) {
		const before = beforeScan.headings[index];
		const after = afterScan.headings[index];
		if (before.lineIndex !== after.lineIndex || before.text !== after.text || before.suffix !== after.suffix) {
			throw new Error(`Heading text or position changed: ${filePath}:${before.lineNumber}`);
		}
		if (reasons.has(index) && after.rawLevel !== 2) {
			throw new Error(`Semantic root is not H2: ${filePath}:${after.lineNumber}`);
		}
	}

	const parents = rawParents(beforeScan.headings);
	const numberedSiblingGroups = new Map();
	for (let index = 0; index < beforeScan.headings.length; index += 1) {
		const number = simpleNumber(beforeScan.headings[index].text);
		if (!number) continue;
		const key = `${number.family}|${beforeScan.headings[index].rawLevel}|${parents[index] ?? 'root'}`;
		if (!numberedSiblingGroups.has(key)) numberedSiblingGroups.set(key, []);
		numberedSiblingGroups.get(key).push(index);
	}
	for (const siblingIndexes of numberedSiblingGroups.values()) {
		if (siblingIndexes.length < 2) continue;
		const normalizedLevels = new Set(siblingIndexes.map(index => afterScan.headings[index].rawLevel));
		if (normalizedLevels.size !== 1) {
			const first = beforeScan.headings[siblingIndexes[0]];
			throw new Error(`Numbered sibling levels diverged: ${filePath}:${first.lineNumber}`);
		}
	}

	if (afterScan.headings.length) {
		if (afterScan.headings[0].rawLevel !== 2) {
			throw new Error(`First body heading is not H2: ${filePath}`);
		}
		for (let index = 1; index < afterScan.headings.length; index += 1) {
			if (afterScan.headings[index].rawLevel > afterScan.headings[index - 1].rawLevel + 1) {
				throw new Error(`Heading level jump remains: ${filePath}:${afterScan.headings[index].lineNumber}`);
			}
		}
	}

	if (afterScan.headings.some(heading => heading.rawLevel === 1)) {
		throw new Error(`Body H1 remains: ${filePath}`);
	}

	const reasonCounts = {};
	for (const rootReasons of reasons.values()) {
		for (const reason of rootReasons) reasonCounts[reason] = (reasonCounts[reason] ?? 0) + 1;
	}

	return {
		lines,
		beforeHeadings: beforeScan.headings,
		afterHeadings: afterScan.headings,
		emptyHeadingsRemoved: emptyHeadings.length,
		headingMarkersChanged,
		reasonCounts,
	};
}

function mergeCounts(target, source) {
	for (const [key, value] of Object.entries(source)) target[key] = (target[key] ?? 0) + value;
}

const files = listContentFiles(CONTENT_ROOT);
const results = [];
const beforeLevels = Object.fromEntries(Array.from({ length: 6 }, (_, index) => [index + 1, 0]));
const afterLevels = Object.fromEntries(Array.from({ length: 6 }, (_, index) => [index + 1, 0]));
const reasonCounts = {};
let headingMarkersChanged = 0;
let emptyHeadingsRemoved = 0;

for (const filePath of files) {
	const originalBuffer = fs.readFileSync(filePath);
	const hadBom = originalBuffer.subarray(0, 3).equals(Buffer.from([0xef, 0xbb, 0xbf]));
	const source = originalBuffer.toString('utf8').replace(/^\uFEFF/, '');
	const result = normalizedLines(splitLines(source), filePath);
	const normalizedSource = result.lines.join('');
	const secondPass = normalizedLines(splitLines(normalizedSource), filePath);

	if (secondPass.lines.join('') !== normalizedSource) {
		throw new Error(`Normalization is not idempotent: ${filePath}`);
	}

	mergeCounts(beforeLevels, headingCounts(result.beforeHeadings));
	mergeCounts(afterLevels, headingCounts(result.afterHeadings));
	mergeCounts(reasonCounts, result.reasonCounts);
	headingMarkersChanged += result.headingMarkersChanged;
	emptyHeadingsRemoved += result.emptyHeadingsRemoved;
	results.push({ filePath, originalBuffer, hadBom, normalizedSource, ...result });
}

const changedResults = results.filter(result => {
	const normalizedBuffer = Buffer.from(`${result.hadBom ? '\uFEFF' : ''}${result.normalizedSource}`, 'utf8');
	return !normalizedBuffer.equals(result.originalBuffer);
});

if (mode === 'write') {
	for (const result of changedResults) {
		fs.writeFileSync(result.filePath, `${result.hadBom ? '\uFEFF' : ''}${result.normalizedSource}`, 'utf8');
	}

	for (const result of changedResults) {
		const written = fs.readFileSync(result.filePath);
		const expected = Buffer.from(`${result.hadBom ? '\uFEFF' : ''}${result.normalizedSource}`, 'utf8');
		if (!written.equals(expected)) throw new Error(`Read-back verification failed: ${result.filePath}`);
	}
}

const summary = {
	mode,
	filesScanned: files.length,
	filesChanged: changedResults.length,
	headingMarkersChanged,
	emptyHeadingsRemoved,
	meaningfulHeadingsBefore: Object.values(beforeLevels).reduce((sum, count) => sum + count, 0),
	meaningfulHeadingsAfter: Object.values(afterLevels).reduce((sum, count) => sum + count, 0),
	beforeLevels,
	afterLevels,
	semanticRootReasons: reasonCounts,
	idempotence: 'passed',
	readBack: mode === 'write' ? 'passed' : 'not-requested',
};

console.log(JSON.stringify(summary, null, 2));

if (mode === 'check' && changedResults.length) {
	console.error(`Heading normalization required in ${changedResults.length} file(s).`);
	process.exitCode = 1;
}
