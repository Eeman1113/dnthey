#!/usr/bin/env bash
# Deterministic post-process for a generated asset.
# Usage: scripts/process-asset.sh <raw.png> <out-basename> <category>
# Raw files live in assets/raw/ (gitignored, kept for reprocessing).
# Shipped files land in public/assets/<category>/.
set -euo pipefail

RAW="$1"; BASE="$2"; CAT="$3"
OUTDIR="public/assets/${CAT}"
mkdir -p "$OUTDIR"

case "$CAT" in
  portraits|creatures) W=512; H=512; Q=78; THUMB=128 ;;
  biomes)              W=1280; H=720; Q=72; THUMB=320 ;;
  textures)            W=512;  H=512; Q=70; THUMB=0   ;;
  frames|icons)        W=256;  H=256; Q=82; THUMB=0   ;;
  brand)               W=1200; H=630; Q=80; THUMB=0   ;;
  *) echo "unknown category: $CAT" >&2; exit 1 ;;
esac

cwebp -q "$Q" -resize "$W" "$H" -m 6 -metadata none -quiet "$RAW" -o "$OUTDIR/${BASE}.webp"
if [ "$THUMB" -gt 0 ]; then
  cwebp -q 72 -resize "$THUMB" "$THUMB" -m 6 -metadata none -quiet "$RAW" -o "$OUTDIR/${BASE}@sm.webp"
fi

BYTES=$(stat -f%z "$OUTDIR/${BASE}.webp")
echo "${CAT}/${BASE}.webp  ${W}x${H}  $((BYTES/1024)) KB"
# Budget guard from BUILD_PROMPT.md §9.5
case "$CAT" in
  portraits|creatures) LIMIT=61440 ;;
  biomes)              LIMIT=184320 ;;
  *)                   LIMIT=40960 ;;
esac
[ "$BYTES" -le "$LIMIT" ] || echo "  WARNING: over budget ($((LIMIT/1024)) KB), lower -q and reprocess" >&2
