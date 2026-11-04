"""Prepare the optional two-video release seed. Arguments are the source MP4s."""
import hashlib
import json
from pathlib import Path
from shutil import copyfile
import sys

if len(sys.argv) != 3:
    raise SystemExit('Usage: prepare-release-media.py <Qijian demo.mp4> <November 3.mp4>')
output = Path(__file__).resolve().parents[1] / 'release-media'
output.mkdir(exist_ok=True)
items = []
for identifier, title, source in zip(
    ('qijian-demo', 'november-03'), ('《栖间》字幕版', '11月3日'), sys.argv[1:]
):
    source = Path(source)
    if source.suffix.lower() != '.mp4' or not source.is_file() or not source.stat().st_size:
        raise SystemExit(f'Expected a non-empty MP4: {source}')
    filename = f'{identifier}.mp4'
    target = output / filename
    copyfile(source, target)
    with target.open('rb') as file:
        digest = hashlib.file_digest(file, 'sha256').hexdigest()
    items.append({
        'id': identifier, 'title': title, 'categoryId': '', 'filename': filename,
        'size': target.stat().st_size, 'hash': digest, 'addedAt': '2026-11-05T00:00:00Z',
        'duration': 0, 'position': 0,
    })
(output / 'library.json').write_text(
    json.dumps({'version': 1, 'items': items, 'categories': []}, ensure_ascii=False),
    encoding='utf-8',
)
