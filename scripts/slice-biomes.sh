#!/usr/bin/env bash
# Slice a stacked two-panel sheet into two 16:9 biome backdrops.
# Usage: slice-biomes.sh <sheet.png> <top-name> <bottom-name>
set -euo pipefail
SHEET="$1"; TOP="$2"; BOT="$3"
OUT=public/assets/biomes; mkdir -p "$OUT"
W=$(sips -g pixelWidth "$SHEET" | tail -1 | awk '{print $2}')
H=$(sips -g pixelHeight "$SHEET" | tail -1 | awk '{print $2}')
PANEL=$((H / 2))
# Each panel is W x H/2 (about 2:1). Crop to 16:9 from the panel's vertical centre.
CROPH=$(( W * 9 / 16 ))
[ "$CROPH" -gt "$PANEL" ] && CROPH=$PANEL
i=0
for NAME in "$TOP" "$BOT"; do
  Y=$(( i * PANEL + (PANEL - CROPH) / 2 ))
  cwebp -crop 0 "$Y" "$W" "$CROPH" -resize 1280 720 -q 72 -m 6 -metadata none -quiet "$SHEET" -o "$OUT/$NAME.webp"
  cwebp -crop 0 "$Y" "$W" "$CROPH" -resize 320 180 -q 70 -m 6 -metadata none -quiet "$SHEET" -o "$OUT/$NAME@sm.webp"
  echo "  $NAME.webp  $(( $(stat -f%z "$OUT/$NAME.webp") / 1024 )) KB"
  i=$((i+1))
done
