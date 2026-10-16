from pathlib import Path
from PIL import Image

root = Path(__file__).resolve().parents[1] / 'assets' / 'equipments'
for name in ('ahu', 'heat_pump'):
    with Image.open(root / f'{name}.png') as image:
        image.thumbnail((320, 280), Image.Resampling.LANCZOS)
        image.save(root / f'{name}-popup.webp', 'WEBP', quality=85, method=6)
        print(name, image.size, (root / f'{name}-popup.webp').stat().st_size)
