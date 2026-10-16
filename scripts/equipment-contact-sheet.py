from pathlib import Path
from tempfile import gettempdir
from PIL import Image, ImageDraw

root = Path(gettempdir())
for width in (1440, 1280, 1024, 768, 390):
    sheet = Image.new('RGB', (1200, 1100), '#ddd')
    draw = ImageDraw.Draw(sheet)
    for step in range(6):
        source = root / f'equipment-{width}-{step}.png'
        if not source.exists():
            continue
        with Image.open(source) as image:
            image.thumbnail((400, 520))
            x, y = (step % 3) * 400, (step // 3) * 550
            sheet.paste(image, (x, y + 25))
            draw.text((x + 10, y + 5), f'{width}px / Step {step + 1}', fill='#000')
    sheet.save(root / f'equipment-sheet-{width}.jpg')
    print(root / f'equipment-sheet-{width}.jpg')
