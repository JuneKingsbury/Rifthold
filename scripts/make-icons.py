#!/usr/bin/env python3
"""Generate electron-builder app icons from a pixel-art source PNG.

Usage: python3 scripts/make-icons.py [source.png]
Default source: icons/RiftholdIcon2.png

Outputs (all nearest-neighbor scaled so pixels stay crisp):
  build/icon.png      1024x1024 (Linux, fallback)
  build/icon.ico      multi-size (Windows)
  build/icon.iconset/ + build/icon.icns (macOS, requires iconutil)
"""
import os
import shutil
import subprocess
import sys

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, 'icons', 'RiftholdIcon2.png')
OUT = os.path.join(ROOT, 'build')
ICONSET = os.path.join(OUT, 'icon.iconset')


def scaled(img, size):
    return img.resize((size, size), Image.NEAREST)


def main():
    img = Image.open(SRC).convert('RGBA')
    os.makedirs(OUT, exist_ok=True)

    scaled(img, 1024).save(os.path.join(OUT, 'icon.png'))

    ico_sizes = [16, 24, 32, 48, 64, 128, 256]
    scaled(img, 256).save(os.path.join(OUT, 'icon.ico'), sizes=[(s, s) for s in ico_sizes])

    shutil.rmtree(ICONSET, ignore_errors=True)
    os.makedirs(ICONSET)
    for base in (16, 32, 128, 256, 512):
        scaled(img, base).save(os.path.join(ICONSET, f'icon_{base}x{base}.png'))
        scaled(img, base * 2).save(os.path.join(ICONSET, f'icon_{base}x{base}@2x.png'))

    if shutil.which('iconutil'):
        subprocess.run(['iconutil', '-c', 'icns', ICONSET, '-o', os.path.join(OUT, 'icon.icns')], check=True)
    else:
        print('iconutil not found (macOS only); skipped icon.icns')

    print(f'Icons generated from {SRC}')


if __name__ == '__main__':
    main()
