#!/usr/bin/env python3
"""
Generate an .avif sibling for every shipped .webp.

GitHub Pages is static hosting, so Next's image optimizer cannot run and
`images.unoptimized` serves the source file as-is. Pre-generating AVIF keeps
the format win (measured 50-65% smaller than the equivalent WebP here) without
needing a server, and <picture> falls back to the WebP for anything that does
not accept AVIF.
"""
import pathlib, sys
from PIL import Image
import pillow_avif  # noqa: F401  (registers the AVIF plugin)

roots = [pathlib.Path('public/assets')]
total_webp = total_avif = 0
count = 0
for root in roots:
    for src in sorted(root.rglob('*.webp')):
        dst = src.with_suffix('.avif')
        im = Image.open(src)
        im.save(dst, 'AVIF', quality=52, speed=4)
        w, a = src.stat().st_size, dst.stat().st_size
        total_webp += w; total_avif += a; count += 1
print(f'{count} files')
print(f'webp {total_webp/1024:.0f} KB -> avif {total_avif/1024:.0f} KB '
      f'({100 - 100*total_avif/total_webp:.0f}% smaller)')
