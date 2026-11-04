"""Build the complete bundled lists from the pinned, attributed upstream snapshots."""
from pathlib import Path
import json
import hashlib

root = Path(__file__).resolve().parents[1]
source = root.parent / 'third_party' / 'vocabulary'
words = {}
stats = {}
for level in ('cet4', 'cet6'):
    path = source / f'{level}.txt'
    lines = path.read_text(encoding='utf-8-sig').splitlines()
    terms = set()
    for line in lines:
        if not line.strip():
            continue
        term, meaning = line.split('\t', 1)
        term, meaning = term.strip(), meaning.strip()
        assert term and meaning and len(term) <= 100
        key = term.casefold()
        terms.add(key)
        record = words.setdefault(key, {'term': term, 'meanings': [], 'levels': []})
        if meaning not in record['meanings']:
            record['meanings'].append(meaning)
        if level not in record['levels']:
            record['levels'].append(level)
    stats[level] = {'rows': len(lines), 'unique': len(terms), 'sha256': hashlib.sha256(path.read_bytes()).hexdigest()}
rows = []
for key, record in sorted(words.items()):
    meaning = '\n'.join(record['meanings'])
    assert len(meaning) <= 2000
    rows.append({'term': record['term'], 'meaning': meaning, 'levels': record['levels']})
result = {'version': '2026-11-04', 'source': 'KyleBing/english-vocabulary', 'commit': 'c4c6c80879ff17d7025c28fb853a4991c8e6be6a', 'stats': stats, 'words': rows}
output = root / 'src/renderer/src/components/tools/exam-vocabulary.json'
output.write_text(json.dumps(result, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
print(json.dumps({'unique': len(rows), 'sources': stats, 'maxMeaning': max(len(r['meaning']) for r in rows)}, ensure_ascii=False))
