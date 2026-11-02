#!/usr/bin/env python3
"""
Slice a background-removed contact sheet into individual transparent cutouts.

Unlike slice-sheet.py (fixed grid crop), this trims each figure to its own
alpha bounding box, then centres it in a square with a little breathing room.
Cells are never identically filled by the generator, so a fixed crop leaves
some portraits tiny and clips others.

Usage: slice-cutouts.py <sheet.png> <cols> <rows> <out-dir> <name1> ... <nameN>
"""
import subprocess, sys
from pathlib import Path
from PIL import Image

def main():
    if len(sys.argv) < 6:
        sys.exit(__doc__)
    sheet, cols, rows, outdir = sys.argv[1], int(sys.argv[2]), int(sys.argv[3]), Path(sys.argv[4])
    names = sys.argv[5:]
    if len(names) != cols * rows:
        sys.exit(f"need {cols*rows} names, got {len(names)}")
    outdir.mkdir(parents=True, exist_ok=True)

    im = Image.open(sheet).convert('RGBA')
    W, H = im.size
    tw, th = W // cols, H // rows

    for i, name in enumerate(names):
        cx, cy = i % cols, i // cols
        cell = im.crop((cx * tw, cy * th, (cx + 1) * tw, (cy + 1) * th))

        # Ignore near-transparent fringe when measuring, so halo pixels left by
        # the cutout do not inflate the bounding box.
        alpha = cell.getchannel('A').point(lambda v: 255 if v > 24 else 0)
        box = alpha.getbbox()
        if box is None:
            print(f"  {name}: EMPTY CELL, skipped"); continue
        fig = cell.crop(box)

        # Centre in a square with 6% padding.
        side = int(max(fig.size) * 1.12)
        canvas = Image.new('RGBA', (side, side), (0, 0, 0, 0))
        canvas.paste(fig, ((side - fig.width) // 2, (side - fig.height) // 2), fig)

        tmp = Path('assets/raw/tiles'); tmp.mkdir(parents=True, exist_ok=True)
        src = tmp / f"{name}.png"
        canvas.save(src)

        for suffix, size, q in ((".webp", 384, 82), ("@sm.webp", 160, 76)):
            subprocess.run(
                ["cwebp", "-resize", str(size), str(size), "-q", str(q), "-m", "6",
                 "-alpha_q", "90", "-metadata", "none", "-quiet",
                 str(src), "-o", str(outdir / f"{name}{suffix}")], check=True)
        kb = (outdir / f"{name}.webp").stat().st_size // 1024
        print(f"  {name}.webp  {fig.size[0]}x{fig.size[1]} source  {kb} KB")

if __name__ == "__main__":
    main()
