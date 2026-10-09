"""Extract content only from the original offline HTML; never execute its scripts."""
import collections
import html
import json
import re
import sys
from pathlib import Path

source = Path(sys.argv[1]).read_text()
def text(value):
    return html.unescape(re.sub(r'<[^>]+>', '', value)).strip()
def field(block, tag, css):
    return text(re.search(fr'<{tag} class="{css}"[^>]*>(.*?)</{tag}>', block, re.S).group(1))

entries = []
for attrs, body in re.findall(r'<article class="card"([^>]*)>(.*?)</article>', source, re.S):
    attrs = dict(re.findall(r'data-([\w-]+)="([^"]*)"', attrs))
    entries.append(dict(id=attrs['id'], album=int(attrs['album']), kind=attrs['kind'],
        term=text(re.search(r'<h3>(.*?)</h3>', body, re.S).group(1)),
        part=field(body, 'div', 'meta').split(' · ', 1)[1],
        example=field(body, 'p', 'example'), meaning=field(body, 'p', 'meaning'),
        translation=field(body, 'p', 'translation'),
        note=field(body, 'p', 'note').removeprefix('语法／易错点：')))
albums = []
for index, block in enumerate(re.findall(r'<div class="album-head">(.*?)</div>', source, re.S), 1):
    albums.append(dict(id=index, title=text(re.search(r'<h2>(.*?)</h2>', block).group(1)),
        description=text(re.search(r'<p>(.*?)</p>', block, re.S).group(1)).replace('语法重点：', ' · 语法重点：'),
        sources=re.findall(r'href="#source-([^"]+)"', block)))
sources = []
for block in re.findall(r'<div class="source"[^>]*>.*?</div>', source, re.S):
    sid = re.search(r'id="source-([^"]+)"', block)
    link = re.search(r'<a[^>]*href="(https://[^"]+)"[^>]*>(.*?)</a>', block, re.S)
    title = re.search(r'<b>(.*?)</b>', block, re.S)
    if sid and link: sources.append(dict(id=sid.group(1), url=html.unescape(link.group(1)), title=text(title.group(1)).split(' · ',1)[-1] if title else text(link.group(2))))
assert len(entries) == len({e['id'] for e in entries}) == 1000
assert collections.Counter(e['kind'] for e in entries) == {'words': 500, 'phrases': 500}
assert len(albums) == 20
target = Path(__file__).resolve().parents[1] / 'src/data/english.json'
target.parent.mkdir(parents=True, exist_ok=True)
target.write_text(json.dumps(dict(albums=albums, entries=entries, sources=sources), ensure_ascii=False, indent=2)+'\n')
print(f'Imported {len(entries)} entries, {len(albums)} albums, {len(sources)} sources.')
