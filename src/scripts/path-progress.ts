// Notes the reader marked as read on a learning path, kept in this browser only.
const KEY = 'path-progress';
const normalize = (path: string) => decodeURI(path).replace(/\/?$/, '/');

function load(): Set<string> {
	try {
		return new Set(JSON.parse(localStorage.getItem(KEY) || '[]'));
	} catch {
		return new Set();
	}
}

export function isRead(path: string) {
	return load().has(normalize(path));
}

export function setRead(path: string, read: boolean) {
	const set = load();
	if (read) set.add(normalize(path));
	else set.delete(normalize(path));
	try {
		localStorage.setItem(KEY, JSON.stringify([...set]));
	} catch {}
}
