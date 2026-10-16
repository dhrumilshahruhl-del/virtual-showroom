"""Reproducible, non-destructive city derivatives. Requires existing Pillow only.

Normals/ORM are resized as numeric data; normals are renormalized. All outputs
are lossless PNG. Only base-color/emissive imagery receives art treatment.
"""
import argparse
import hashlib
import json
import math
from pathlib import Path
from PIL import Image, ImageDraw, ImageEnhance

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'assets/models/Downtown City MegaKit[Standard]/Exports/glTF (Godot)'
OUTPUT = ROOT / 'assets/city-context'
MODELS = ['Building_Large_2.gltf', 'Building_Medium_2_001.gltf', 'Building_Small_1.gltf']

def normal_resize(image, size):
    # Pillow does not color-manage these data channels. Resize vector components
    # separately in float space, then renormalize instead of treating normals as sRGB.
    channels = [c.convert('F').resize(size, Image.Resampling.LANCZOS) for c in image.convert('RGB').split()]
    result = []
    for xyz in zip(*(c.getdata() for c in channels)):
        v = [x / 127.5 - 1 for x in xyz]
        length = math.sqrt(sum(x*x for x in v)) or 1
        result.append(tuple(max(0, min(255, round((x / length + 1) * 127.5))) for x in v))
    out = Image.new('RGB', size)
    out.putdata(result)
    if image.mode == 'RGBA':
        out.putalpha(image.getchannel('A').resize(size, Image.Resampling.LANCZOS))
    return out

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--inspect', type=Path)
    args = parser.parse_args()
    models = {name: json.loads((SOURCE / name).read_text()) for name in MODELS}
    names = sorted({image['uri'] for model in models.values() for image in model['images']})
    if args.inspect:
        sheet = Image.new('RGB', (1000, math.ceil(len(names)/4)*230), '#e5e8eb')
        draw = ImageDraw.Draw(sheet)
        for index, name in enumerate(names):
            image = Image.open(SOURCE / name)
            thumb = image.convert('RGB'); thumb.thumbnail((235,190))
            x,y=(index%4)*250,(index//4)*230
            sheet.paste(thumb,(x,y));draw.text((x,y+192),name,fill='#10283a')
            draw.text((x,y+207),f'{image.width}x{image.height} {image.mode}',fill='#10283a')
        sheet.save(args.inspect)
        print(args.inspect)
        return
    (OUTPUT / 'textures').mkdir(parents=True, exist_ok=True)
    records = []
    for name in names:
        source = SOURCE / name
        image = Image.open(source)
        role = 'normal' if '_Normal' in name else 'orm' if '_ORM' in name else 'base-color' if '_BaseColor' in name else 'interior/emissive'
        limit = 512 if role in ('normal', 'orm') else 1024
        ratio = min(1, limit / max(image.size))
        size = tuple(max(1, round(n * ratio)) for n in image.size)
        if role == 'normal':
            result = normal_resize(image, size)
        elif role == 'orm':
            result = image.resize(size, Image.Resampling.LANCZOS)
        else:
            alpha = image.getchannel('A').resize(size, Image.Resampling.LANCZOS) if image.mode == 'RGBA' else None
            result = image.convert('RGB').resize(size, Image.Resampling.LANCZOS)
            result = ImageEnhance.Color(result).enhance(0.65)
            result = ImageEnhance.Contrast(result).enhance(0.88)
            if alpha is not None: result.putalpha(alpha)
        target = OUTPUT / 'textures' / name
        result.save(target, optimize=True)
        records.append({'source':str(source.relative_to(ROOT)).replace('\\','/'), 'output':str(target.relative_to(ROOT)).replace('\\','/'), 'role':role,'original':list(image.size),'optimized':list(size),'mode':result.mode,'originalBytes':source.stat().st_size,'optimizedBytes':target.stat().st_size,'originalSha256':hashlib.sha256(source.read_bytes()).hexdigest()})
    for name, model in models.items():
        for image in model['images']: image['uri'] = 'textures/' + image['uri']
        for buffer in model['buffers']:
            buffer['uri'] = '../models/Downtown City MegaKit[Standard]/Exports/glTF (Godot)/' + buffer['uri']
        # Geometry, UVs, material assignments and samplers are copied unchanged.
        (OUTPUT / name).write_text(json.dumps(model, separators=(',', ':'))+'\n')
    (OUTPUT / 'manifest.json').write_text(json.dumps({'generator':'docs/build-city-context.py','saturation':0.65,'contrast':0.88,'textures':records},indent=2)+'\n')
    print(f'Created {len(records)} lossless texture derivatives and {len(models)} geometry-preserving manifests.')

if __name__ == '__main__': main()
