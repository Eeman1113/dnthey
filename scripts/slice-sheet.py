#!/usr/bin/env python3
"""
Slice a generated contact sheet into individual square assets.

Generating 6 portraits as one 3x2 grid instead of 6 separate requests is ~6x fewer
round-trips AND enforces style consistency: the model paints them in one pass, so
they genuinely match. This cuts them apart again.

Uses `cwebp -crop x y w h`, which takes absolute top-left coordinates — unlike
`sips --cropOffset`, which is relative to the image centre and easy to get wrong.

A square crop out of a taller cell is biased UPWARD, because faces sit in the top
of a head-and-shoulders portrait and a centred crop decapitates them.

Usage: slice-sheet.py <sheet.png> <cols> <rows> <out-dir> [--bias F] <name1> ... <nameN>
       --bias 0.0 = flush top, 0.5 = centred (default 0.12)
"""
import subprocess, sys
from pathlib import Path

def dims(path):
    out = subprocess.run(["sips", "-g", "pixelWidth", "-g", "pixelHeight", str(path)],
                         capture_output=True, text=True).stdout
    w = int([l for l in out.splitlines() if "pixelWidth" in l][0].split(":")[1])
    h = int([l for l in out.splitlines() if "pixelHeight" in l][0].split(":")[1])
    return w, h

def main():
    if len(sys.argv) < 6:
        sys.exit(__doc__)
    sheet, cols, rows, outdir = sys.argv[1], int(sys.argv[2]), int(sys.argv[3]), Path(sys.argv[4])
    rest = sys.argv[5:]
    bias = 0.12
    if rest and rest[0] == "--bias":
        bias = float(rest[1]); rest = rest[2:]
    names = rest
    if len(names) != cols * rows:
        sys.exit(f"need {cols*rows} names for a {cols}x{rows} sheet, got {len(names)}")

    outdir.mkdir(parents=True, exist_ok=True)
    W, H = dims(sheet)
    tw, th = W // cols, H // rows
    # Portraits are square; take the largest centred square inside each cell so a
    # tall cell does not stretch the face.
    side = min(tw, th)
    print(f"sheet {W}x{H} -> {cols}x{rows} cells of {tw}x{th}, cropping {side}x{side} at bias {bias}")

    for i, name in enumerate(names):
        cx, cy = i % cols, i // cols
        x = cx * tw + (tw - side) // 2
        y = cy * th + int((th - side) * bias)
        for suffix, size, q in ((".webp", 512, 78), ("@sm.webp", 128, 72)):
            subprocess.run(
                ["cwebp", "-crop", str(x), str(y), str(side), str(side),
                 "-resize", str(size), str(size), "-q", str(q), "-m", "6",
                 "-metadata", "none", "-quiet", str(sheet), "-o", str(outdir / f"{name}{suffix}")],
                check=True)
        kb = (outdir / f"{name}.webp").stat().st_size // 1024
        flag = "  <-- SUSPICIOUS: near-empty tile" if kb < 6 else ""
        print(f"  {name}.webp  {kb} KB{flag}")

if __name__ == "__main__":
    main()
