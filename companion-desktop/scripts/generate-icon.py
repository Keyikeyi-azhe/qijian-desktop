"""Generate Qijian's Windows app icon from its illustrated desk palette."""
from pathlib import Path
from PIL import Image, ImageDraw

destination = Path(__file__).resolve().parents[1] / 'build'
destination.mkdir(exist_ok=True)
icon = Image.new('RGBA', (512, 512))
draw = ImageDraw.Draw(icon)
draw.rounded_rectangle((16, 16, 496, 496), radius=112, fill='#282740')
draw.rounded_rectangle((33, 33, 479, 479), radius=94, outline='#706590', width=5)
# A desk card with a lavender binding and a small reply bubble.
draw.rounded_rectangle((93, 156, 342, 363), radius=33, fill='#75628d')
draw.rounded_rectangle((90, 142, 333, 342), radius=28, fill='#f0ddc5')
draw.rounded_rectangle((90, 142, 333, 199), radius=28, fill='#ad9bc9')
draw.rectangle((90, 172, 333, 199), fill='#ad9bc9')
for x in (149, 270):
    draw.rounded_rectangle((x-8, 124, x+8, 168), radius=8, fill='#f8ead8')
for y, end in ((235, 240), (274, 209)):
    draw.rounded_rectangle((124, y, end, y+12), radius=6, fill='#977f9a')
draw.polygon([(307, 314), (304, 382), (363, 335)], fill='#d1a8a2')
draw.rounded_rectangle((272, 240, 421, 342), radius=41, fill='#d1a8a2')
for x in (314, 347, 380):
    draw.ellipse((x-6, 285, x+6, 297), fill='#432f48')
icon = icon.resize((256, 256), Image.Resampling.LANCZOS)
icon.save(destination / 'icon.png')
icon.save(destination / 'icon.ico', sizes=[(16, 16), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])
