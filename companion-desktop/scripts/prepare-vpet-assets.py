"""Build local WebP atlases from the pinned VPet PNG frames; requires Pillow."""
import hashlib
import json
import math
from pathlib import Path
import re
import subprocess
from PIL import Image, ImageDraw

PROJECT = Path(__file__).resolve().parents[1]
UPSTREAM = PROJECT.parent / 'third_party/vpet/upstream'
SOURCE = UPSTREAM / 'VPet-Simulator.Windows/mod/0000_core/pet/vup'
OUTPUT = PROJECT / 'src/renderer/src/assets/vpet'
GROUPS = json.loads((PROJECT.parent / 'third_party/vpet/clip-sources.json').read_text(encoding='utf-8'))
CLIPS = {name: folder for group in GROUPS.values() for name, folder in group.items()}
SIZE, COLUMNS = 320, 8


def frame_order(path):
    match = re.fullmatch(r'(.*)_(\d+)_(\d+)\.png', path.name)
    assert match, f'Unexpected frame filename: {path}'
    # FLA and FLB are consecutive sections, each restarting its frame counter.
    return match[1], int(match[2])


def ordered_frames(files):
    # Some prefixes are artist labels (A01_011); others restart numbering (FLA/FLB).
    # A unique global counter takes precedence; restarted counters retain section order.
    numbers = [frame_order(path)[1] for path in files]
    if len(set(numbers)) == len(numbers):
        return sorted(files, key=lambda path: frame_order(path)[1])
    assert len({frame_order(path) for path in files}) == len(files), 'Ambiguous duplicate frame'
    return sorted(files, key=frame_order)


def build_food(manifest, provenance):
    """Bake official rear / moving item / front layers on a shared timeline."""
    for name, config, prop in [('eat', 'Eat/Nomal/info.lps', '面包.png'),
                               ('drink', 'Drink/info.lps', '1L纯净水.png'),
                               ('gift', 'Gift/Nomal/info.lps', '礼物盒子.png')]:
        config_path = SOURCE / config
        line = next(line for line in config_path.read_text(encoding='utf-8-sig').splitlines()
                    if line.startswith('FoodAnimation#') and 'mode#nomal:' in line)
        track = [[float(n) for n in values.split(',')]
                 for values in re.findall(r':\|a\d+#([^:]+)', line)]
        assert track, name
        total = int(sum(item[0] for item in track))
        prop_path = UPSTREAM / 'VPet-Simulator.Windows/mod/0000_core/image/food' / prop
        prop_image = Image.open(prop_path).convert('RGBA')
        layers = {}
        boundaries = {0, total}
        for layer in ('back', 'front'):
            data = manifest[f'{name}-{layer}']
            atlas = Image.open(OUTPUT / 'atlases' / data['file']).convert('RGBA')
            layers[layer] = (data, atlas)
            elapsed = 0
            for duration in data['durations']:
                elapsed += duration
                if elapsed < total: boundaries.add(elapsed)
        elapsed = 0
        for item in track:
            elapsed += int(item[0])
            if elapsed < total: boundaries.add(elapsed)
        times = sorted(boundaries)
        images, boxes = [], []
        def frame_at(durations, t):
            for i, duration in enumerate(durations):
                if t < duration: return i
                t -= duration
            return len(durations) - 1
        for time in times[:-1]:
            frame = Image.new('RGBA', (SIZE, SIZE))
            for layer in ('back', 'front'):
                if layer == 'front':
                    item = track[frame_at([i[0] for i in track], time)]
                    if len(item) > 1:
                        size = round(item[3] * SIZE / 500)
                        image = prop_image.resize((size, size), Image.Resampling.LANCZOS)
                        if len(item) > 4: image = image.rotate(-item[4], resample=Image.Resampling.BICUBIC, expand=True)
                        if len(item) > 5: image.putalpha(image.getchannel('A').point(lambda a: round(a * item[5])))
                        frame.alpha_composite(image, (round(item[1] * SIZE / 500), round(item[2] * SIZE / 500)))
                data, atlas = layers[layer]
                i = frame_at(data['durations'], time)
                x, y = i % data['columns'] * SIZE, i // data['columns'] * SIZE
                frame.alpha_composite(atlas.crop((x, y, x + SIZE, y + SIZE)))
            images.append(frame)
            boxes.append(list(frame.getchannel('A').point(lambda a: 255 if a > 24 else 0).getbbox()))
        columns = min(COLUMNS, len(images))
        atlas = Image.new('RGBA', (columns * SIZE, math.ceil(len(images) / columns) * SIZE))
        for i, frame in enumerate(images): atlas.paste(frame, (i % columns * SIZE, i // columns * SIZE))
        atlas.save(OUTPUT / f'atlases/{name}.webp', lossless=True, method=3)
        manifest[name] = {'file': f'{name}.webp', 'size': SIZE, 'columns': columns,
                          'durations': [b-a for a, b in zip(times, times[1:])], 'hitboxes': boxes,
                          'bounds': [min(b[0] for b in boxes), min(b[1] for b in boxes), max(b[2] for b in boxes), max(b[3] for b in boxes)]}
        provenance.setdefault('composites', []).append({'clip': name, 'layers': [f'{name}-back', f'{name}-front'],
            'config': config_path.relative_to(UPSTREAM).as_posix(), 'configSha256': hashlib.sha256(config_path.read_bytes()).hexdigest(),
            'prop': prop_path.relative_to(UPSTREAM).as_posix(), 'propSha256': hashlib.sha256(prop_path.read_bytes()).hexdigest(),
            'duration': total})


def main():
    (OUTPUT / 'atlases').mkdir(parents=True, exist_ok=True)
    revision = subprocess.check_output(['git', '-C', str(UPSTREAM), 'rev-parse', 'HEAD'], text=True).strip()
    manifest = {}
    provenance = {'repository': 'https://github.com/LorisYounger/VPet', 'revision': revision, 'frames': []}
    preview = Image.new('RGB', (1000, math.ceil((len(CLIPS) + 3) / 4) * 260), '#f5f5ec')
    draw = ImageDraw.Draw(preview)
    for clip_index, (name, folder) in enumerate(CLIPS.items()):
        files = list((SOURCE / folder).glob('*.png'))
        assert files, f'Missing source clip: {folder}'
        files = ordered_frames(files)
        columns = min(COLUMNS, len(files))
        atlas = Image.new('RGBA', (columns * SIZE, math.ceil(len(files) / columns) * SIZE))
        durations = []
        boxes = []
        for index, path in enumerate(files):
            duration = int(re.search(r'_(\d+)\.png$', path.name)[1])
            assert 0 < duration <= 60000, f'Invalid frame duration: {path}'
            durations.append(duration)
            with Image.open(path) as original:
                image = original.convert('RGBA').resize((SIZE, SIZE), Image.Resampling.LANCZOS)
            box = image.getchannel('A').point(lambda value: 255 if value > 24 else 0).getbbox()
            boxes.append(list(box or (100, 100, 220, 300)))
            atlas.paste(image, ((index % columns) * SIZE, (index // columns) * SIZE))
            provenance['frames'].append({'clip': name, 'source': path.relative_to(UPSTREAM).as_posix(),
                                         'sha256': hashlib.sha256(path.read_bytes()).hexdigest(), 'duration': duration})
            if index == 0:
                image.thumbnail((230, 230))
                x, y = (clip_index % 4) * 250, (clip_index // 4) * 260
                preview.paste(image, (x, y), image)
                draw.text((x + 8, y + 235), name, fill='#394332')
        atlas.save(OUTPUT / f'atlases/{name}.webp', lossless=True, method=3)
        manifest[name] = {'file': f'{name}.webp', 'size': SIZE, 'columns': columns, 'durations': durations, 'hitboxes': boxes,
                          'bounds': [min(b[0] for b in boxes), min(b[1] for b in boxes),
                                     max(b[2] for b in boxes), max(b[3] for b in boxes)]}
    build_food(manifest, provenance)
    (OUTPUT / 'manifest.json').write_text(json.dumps(manifest, indent=2), encoding='utf-8')
    metadata = PROJECT.parent / 'third_party/vpet'
    (metadata / 'asset-provenance.json').write_text(json.dumps(provenance, indent=2, ensure_ascii=False), encoding='utf-8')
    notices = PROJECT / 'src/renderer/public/licenses/vpet'
    notices.mkdir(parents=True, exist_ok=True)
    (notices / 'LICENSE.txt').write_bytes((UPSTREAM / 'LICENSE').read_bytes())
    readme = (UPSTREAM / 'README.md').read_text(encoding='utf-8')
    animation_notice = readme.split('## 动画版权声明与授权', 1)[1].split('## 桌面端部署方法', 1)[0]
    (notices / 'ANIMATION-LICENSE.txt').write_text(
        'VPet / 虚拟主播模拟器制作组\nhttps://github.com/LorisYounger/VPet\n'
        f'来源版本：{revision}\n\n## 动画版权声明与授权\n{animation_notice}', encoding='utf-8')
    (OUTPUT / 'ANIMATION-LICENSE.txt').write_bytes((notices / 'ANIMATION-LICENSE.txt').read_bytes())
    previews = PROJECT.parent / 'artifacts/previews/vpet'
    previews.mkdir(parents=True, exist_ok=True)
    preview.save(previews / 'source-contact-sheet.png')
    print(f'{len(manifest)} clips, {len(provenance["frames"])} frames; atlas size: '
          f'{sum(p.stat().st_size for p in (OUTPUT / "atlases").glob("*.webp")) / 1024:.0f} KiB')


if __name__ == '__main__':
    main()
